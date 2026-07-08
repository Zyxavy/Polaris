# Changelog

## [Unreleased]

### Slice 0 — Repo & Cloud Bootstrap

- Provisioned D1 databases: `polaris-db-dev`, `polaris-db`
- Provisioned R2 buckets: `polaris-attachments`, `polaris-backups`
- Provisioned Queue: `polaris-journal-retry`
- Created MongoDB Atlas cluster: `PolarisCluster`

### Slice 1 — Monorepo Scaffolding

- Initialized pnpm workspace at root with `pnpm-workspace.yaml`
- Scaffolded `packages/api` with Hono + wrangler via `pnpm create hono`
- Scaffolded `packages/web` with SvelteKit (CSR-only via `@sveltejs/adapter-static`) via `pnpm dlx sv create`
- Configured `wrangler.jsonc`:
  - **Note:** Cloudflare Workers now use `wrangler.jsonc` (JSONC format) instead of `wrangler.toml`. The plan references `.toml` syntax, but all binding configs have been adapted to JSONC.
  - `packages/api`: D1 binding (`DB`), R2 binding (`ATTACHMENTS`), `nodejs_compat` flag, `env.production` block for `polaris-db`
  - `packages/web`: Workers Static Assets config (`site.bucket = "build"`, `main = "build/index.html"`)
- Switched web adapter from `@sveltejs/adapter-cloudflare` to `@sveltejs/adapter-static` with `fallback: 'index.html'`
- Set CSR-only mode: `ssr = false`, `prerender = false` in root `+layout.ts`
- Configured Tailwind CSS v4 with Polaris design tokens:
  - Color palette (surface, primary, secondary, blush, etc.) in `@theme` block
  - `@variant dark` for `data-theme="dark"` attribute strategy
  - Dark mode CSS variable overrides
  - Loaded Manrope + Plus Jakarta Sans via Google Fonts
  - Custom ambient shadows (`shadow-ambient-*`)
- Added Vite dev proxy (`/api/*` → `http://localhost:8787`)
- Added root `package.json` scripts: `deploy`, `deploy:migrations`, `deploy:api`, `deploy:web`
- Set up Vitest + `@cloudflare/vitest-pool-workers` in `packages/api` (v0.17.0, using new `cloudflareTest()` plugin API)
- Cleaned up scaffold artifacts: removed `wrangler types` from web build/check scripts, removed `worker-configuration.d.ts` type reference from web `tsconfig.json`
- Updated package-level scripts (api deploy includes migrations, web has build + deploy)

### Slice 3 — Auth (Better Auth + Recovery Codes)

#### Backend

- Installed `better-auth@^1.6.23` in `packages/api`
- Generated `CloudflareBindings` type via `pnpm cf-typegen`
- Installed `@types/node` dev dependency (required for `nodejs_compat`)
- Created `packages/api/src/auth.ts` with native D1 support (`database: env.DB` — no adapter package)
- Created core Better Auth tables (`user`, `session`, `account`, `verification`) as migration `0014_better_auth_core.sql` — CLI can't reach D1 bindings outside a request handler
- Mounted Better Auth handler at `/api/auth/*` in `index.ts`
- Created `requireAuth` middleware at `packages/api/src/middleware/require-auth.ts`
- Applied auth guard to all `/api/*` routes except `/api/auth/*`
- Created recovery codes routes (`POST /api/recovery-codes/generate`, `GET /api/recovery-codes`) at `packages/api/src/routes/recovery.ts`
- Implemented `POST /api/auth/recover` custom route with email + recovery code validation, hashing via `better-auth/crypto`, direct `account.password` update
- Registered recovery route **before** Better Auth catch-all (order matters in Hono)
- Rate-limiting explicitly skipped per `security-review.md` §1

#### Frontend

- Installed `better-auth` in `packages/web` (client SDK for Svelte)
- Created `packages/web/src/lib/auth-client.ts` — `createAuthClient` wrapper with credentials, destructured `signIn`/`signUp`/`signOut`/`useSession`
- Created `packages/web/src/lib/api/client.ts` — `apiFetch` wrapper with `credentials: 'include'`, JSON parsing, `ApiError` class for non-2xx responses
- Created `(auth)` route group:
  - `+layout.svelte` — redirects signed-in users to `/guides` using `getSession()` (promise-based, avoids reactivity issue with `useSession().data`)
  - `sign-in/+page.svelte` — centered form per design spec, calls `signIn.email()`, redirects to `/dashboard`
  - `sign-up/+page.svelte` — centered form with name/email/password, calls `POST /api/recovery-codes/generate` on sign-up success, shows recovery codes modal with copy/confirm before redirecting to `/guides`
- Created `(app)` route group:
  - `+layout.ts` — auth guard per §3.3, redirects to `/sign-in` if `getSession()` returns null
  - `+layout.svelte` — minimal nav shell with Polaris branding (full NavBar deferred to Slice 11)
- Created placeholder `guides/+page.svelte` as redirect target for post-auth and post-sign-up flows

#### Docs

- Updated `auth-integration.md` to match actual implementation (native D1, crypto import, manual migration)
- Updated `auth-integration.md` §5.2 recovery route to reference extracted `handleRecovery` from `lib/recovery.ts`
- Added 6 new entries to `docs/troubleshooting/d1-vitest-pitfalls.md` (#13–18: signUpEmail result shape, recovery handler extraction, guarded route test setup, Playwright E2E multi-server, invalid ... spread in auth.ts, seedUserStub migration conflict)
- Added 4 new entries to `docs/troubleshooting/d1-vitest-pitfalls.md` (Better Auth D1 adapter, hashPassword API, CLI limitations, CloudflareBindings type)

#### Tests

- Extracted `generateRecoveryCode` + `handleRecovery` to `lib/recovery.ts` for unit-testability (Option A per plan)
- **Unit test** (`recovery.spec.ts`): recovery code format `POLARIS-XXXX-XXXX` + uniqueness (2 tests)
- **Integration tests** (`auth.spec.ts`):
  - sign-up creates user and returns session token
  - guarded route (`requireAuth`) returns 401 without session
  - recovery flow: code resets password, used code cannot be reused
- **E2E test** (`auth.e2e.ts`): sign-up -> dismiss codes -> sign out via API -> sign in -> dashboard
- Updated Playwright config with dual `webServer` entries (API on port 8787 + preview on 4173)
- Created `packages/api/package.json` `dev:e2e` script for running API in E2E mode
- Created `packages/web/src/routes/(app)/dashboard/+page.svelte` placeholder
- Fixed `smoke.spec.ts` `seedUserStub` INSERT to match migration's NOT NULL constraints on user table
- Fixed `auth.ts` — replaced invalid `...` spread with full `emailAndPassword`/`session`/`trustedOrigins` config
- Fixed `recovery.spec.ts` import path (`../recovery` -> `../lib/recovery`)
- Fixed `auth.spec.ts` — added missing `D1Migration` type import, replaced fragile `{ ...env }` spread with explicit auth config

### Slice 2 — D1 Schema + Smoke Tests

- Created 11 migration files in `packages/api/migrations/` (0001–0010, 0013) matching D1 Schema ADR §3 table definitions
- Fixed `0001_enable_foreign_keys.sql`: added missing trailing semicolon
- Applied migrations locally via `wrangler d1 migrations apply DB --local`
- Replaced `vitest.config.ts` scaffold (`cloudflareTest` with `defineConfig`) with async config using `readD1Migrations` + `provide`/`inject`
- Added `test:integration` script to `packages/api/package.json`
- Created `packages/api/src/__tests__/smoke.spec.ts`:
  - Asserts `PRAGMA foreign_keys = ON` after migrations
  - Tests `systems` insert/read round-trip
  - Tests `UNIQUE(system_id, date)` constraint on `instances` rejects duplicates
- Updated `testing-strategy.md` §2.2 config example to match `@cloudflare/vitest-pool-workers` v0.17.0 API
- Created `docs/troubleshooting/d1-vitest-pitfalls.md` documenting 7 resolved issues
- **Status:** all 3 smoke tests passing, slice complete
