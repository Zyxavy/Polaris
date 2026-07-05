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
