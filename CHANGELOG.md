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

- Installed `better-auth@^1.6.23` in `packages/api`
- Generated `CloudflareBindings` type via `pnpm cf-typegen`
- Installed `@types/node` dev dependency (required for `nodejs_compat`)
- Created `packages/api/src/auth.ts` with native D1 support (`database: env.DB` — no adapter package)
- Created core Better Auth tables (`user`, `session`, `account`, `verification`) as migration `0014_better_auth_core.sql` — CLI can't reach D1 bindings outside a request handler
- Mounted Better Auth handler at `/api/auth/*` in `index.ts`
- Created `requireAuth` middleware at `packages/api/src/middleware/require-auth.ts`
- Applied auth guard to all `/api/*` routes except `/api/auth/*`
- Created recovery codes routes (`POST /api/recovery-codes/generate`, `GET /api/recovery-codes`) at `packages/api/src/routes/recovery.ts`
- Implemented `POST /api/auth/recover` custom route with:
  - Email + recovery code validation
  - Password hashing via `hashPassword` from `better-auth/crypto`
  - Direct `account.password` update (no session needed)
- Registered recovery route **before** Better Auth catch-all (order matters in Hono)
- Rate-limiting explicitly skipped per `security-review.md` §1
- Updated `auth-integration.md` docs to match actual implementation (native D1, crypto import, manual migration)

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
