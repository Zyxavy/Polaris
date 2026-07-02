# CI/CD & Deployment

**Project:** *Polaris*
**Document type:** Deployment reference -- defines the CI pipeline, deploy order, environment configuration, and rollback strategy. Companion to the [Tech Stack ADR](ADRs/001-tech-stack-adr.md) (owns the monorepo structure and deployment targets this document operationalizes), the [Testing Strategy](ADRs/002-testing-strategy.md) (owns the CI pipeline's test stages), and the [API Route Design](ADRs/005-api-routes.md) / [SvelteKit Route Architecture](sveltekit-route-architecture.md) (which define the two deployable artifacts).
**Status:** Draft -- v1 scope
**Last updated:** July 1, 2026

---

## 1. Artifacts

Two independent deployments:

| Artifact | Directory | Type | Wrangler command |
|---|---|---|---|
| API Worker | `packages/api/` | Workers script + scheduled handler + queue consumer | `wrangler deploy` |
| Web static assets | `packages/web/` | Workers Static Assets (SPA build output) | `wrangler deploy` |

They are deployed independently but always in a specific order (see 3.1). They have no circular dependency -- the Web assets are pure static files that make API calls to whatever origin `VITE_API_BASE_URL` is configured for. A new version of the API Worker can be deployed without touching the frontend, and vice versa, as long as the API contract is backward-compatible (which it always is in v1, since both artifacts are deployed in lockstep from the same commit).

---

## 2. Environment Configuration

### 2.1 Variables

| Variable | Package | Dev | Production | Secret? |
|---|---|---|---|---|
| `VITE_API_BASE_URL` | `web` | `''` (empty -- same-origin via Vite proxy) | `https://polaris-api.<account>.workers.dev` | No |
| `ENVIRONMENT` | `api` | `development` | `production` | No |
| `BETTER_AUTH_SECRET` | `api` | Auto-generated dev secret | Generated secret, stored in `wrangler secret` | Yes |
| `BETTER_AUTH_URL` | `api` | `http://localhost:8787` | `https://polaris-api.<account>.workers.dev` | No |
| `MONGODB_URI` | `api` | `mongodb://localhost:27017/polaris` (local Mongo) | Atlas connection string, stored in `wrangler secret` | Yes |

### 2.2 `wrangler.toml` -- `packages/api/`

```toml
name = "polaris-api"
main = "src/index.ts"
compatibility_date = "2026-07-01"

# Bindings
[[d1_databases]]
binding = "DB"
database_name = "polaris-db"
database_id = "<uuid>"

[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "polaris-attachments"

[[queues]]
binding = "JOURNAL_RETRY"
queue_name = "polaris-journal-retry"

[ai]
binding = "AI"

[triggers]
crons = ["0 15 * * *"]   # 11 PM Asia/Manila, UTC+8

# Environment-specific values
[env.development]
vars = { ENVIRONMENT = "development" }
[[env.development.d1_databases]]
binding = "DB"
database_name = "polaris-db-dev"
database_id = "<dev-uuid>"

[env.production]
vars = { ENVIRONMENT = "production" }
[[env.production.d1_databases]]
binding = "DB"
database_name = "polaris-db"
database_id = "<prod-uuid>"
```

**Note:** `BETTER_AUTH_SECRET` and `MONGODB_URI` are NOT in `wrangler.toml` -- they are set via `wrangler secret put` and accessed via `env.BETTER_AUTH_SECRET` / `env.MONGODB_URI` at runtime. This keeps them out of version control.

### 2.3 `wrangler.toml` -- `packages/web/`

```toml
name = "polaris-web"
main = "build/index.html"    # entry point for the static assets worker
compatibility_date = "2026-07-01"

[site]
bucket = "build"
```

Workers Static Assets (the modern pattern replacing `workers-site/` and `@cloudflare/kv-asset-handler`) serves the `build/` directory directly without a custom Worker script. `main` is set to `build/index.html` as the SPA fallback entry point. No bindings are needed -- this deployment serves files only.

---

## 3. Deploy Order and Scripts

### 3.1 Order

```
1. D1 migrations (packages/api)  -- wrangler d1 migrations apply DB
2. API Worker (packages/api)     -- wrangler deploy
3. Web static (packages/web)     -- wrangler deploy
```

Migrations run **before** the API Worker deploy so the new code sees the latest schema on its first request. The Web deploy runs last because it has no dependency on the API deployment order beyond `VITE_API_BASE_URL` being correct (which is baked at build time, not deploy time).

**Script in root `package.json`:**

```jsonc
{
  "scripts": {
    "deploy": "pnpm -r deploy",
    "deploy:migrations": "cd packages/api && wrangler d1 migrations apply DB",
    "deploy:api": "cd packages/api && wrangler deploy",
    "deploy:web": "cd packages/web && wrangler deploy",
  }
}
```

Each package has its own `deploy` script in its `package.json`:

```jsonc
// packages/api/package.json
{ "scripts": { "deploy": "wrangler d1 migrations apply DB && wrangler deploy" } }

// packages/web/package.json
{ "scripts": { "deploy": "vite build && wrangler deploy" } }
```

Running `pnpm -r deploy` from the root runs both in workspace order (api first, web second) because pnpm respects the dependency graph: `web` depends on `api` (for types), so pnpm runs `api`'s deploy first.

### 3.2 First-time setup (scaffolding)

For a brand-new Cloudflare account and project:

```bash
# 1. Create D1 databases
wrangler d1 create polaris-db-dev
wrangler d1 create polaris-db

# 2. Create R2 bucket
wrangler r2 bucket create polaris-attachments

# 3. Create Queue
wrangler queues create polaris-journal-retry

# 4. Generate first migration
cd packages/api
wrangler d1 migrations create DB 0001_enable_foreign_keys

# 5. Apply migrations (local dev)
wrangler d1 migrations apply DB --local

# 6. Set secrets
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put MONGODB_URI

# 7. Deploy
cd ../..
pnpm deploy
```

### 3.3 Day-to-day deploy

```bash
git pull
pnpm install                     # if dependencies changed
pnpm -r build                    # verify both packages build
pnpm -r deploy                   # migrations, api, web
```

---

## 4. CI Pipeline

Runs on every push to `main` and every PR. Defined in `.github/workflows/ci.yml` (not yet created -- to be written during scaffolding, or equivalent Git hosting CI config).

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install

      - run: pnpm -r lint

      - run: pnpm -r test:unit
      - run: pnpm -r test:int

      - run: pnpm -r build

      - run: pnpm test:e2e
        env:
          VITE_API_BASE_URL: "http://localhost:8787"

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install

      - name: Deploy API
        working-directory: packages/api
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Deploy Web
        working-directory: packages/web
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### 4.1 What the CI pipeline does NOT do

| Activity | Reason |
|---|---|
| **D1 migrations in CI** | Migrations are applied manually (or via the deploy script from a developer's machine), not from CI. Automated schema changes in CI add risk without proportional value for a single-developer project -- the developer runs migrations before pushing, and CI confirms the code works against the already-migrated schema. |
| **`wrangler secret` management** | Secrets (`BETTER_AUTH_SECRET`, `MONGODB_URI`) are set manually via `wrangler secret put` and are not available in CI. If CI needed to deploy to an ephemeral environment, this would need solving; for a single-deployment personal app with no staging environment, manual secret management is correct. |
| **Deploy to staging/preview** | There is no staging environment. Deploy is directly to production (`wrangler deploy` without `--env`). The CI pipeline's test steps are the quality gate before production deploy. |

---

## 5. URL Structure

| Environment | API URL | Web URL |
|---|---|---|
| Development (local) | `http://localhost:8787` | `http://localhost:5173` |
| Production | `https://polaris-api.<account>.workers.dev` | `https://polaris-web.<account>.workers.dev` |

`<account>` is the Cloudflare account's subdomain (e.g. `polaris-project`). These URLs are determined by the `name` field in each `wrangler.toml` (`polaris-api` and `polaris-web`).

---

## 6. Rollback Strategy

For a single-developer personal app, rollback is manual and low-risk:

1. **API Worker:** `wrangler rollback` reverts to the previous deployed version. Wrangler keeps a version history; the rollback is instantaneous and does not require a rebuild.
2. **Web static assets:** `wrangler rollback` works the same way. If the static assets introduced a breaking client-side change and the API has already been rolled back, rolling back the web deployment restores the previous frontend version.
3. **D1 schema:** Migrations are never rolled back automatically. If a migration introduces a breaking schema change that needs reversal, a new forward migration is written (not a revert of the previous one). This is consistent with SQLite/D1's migration conventions -- `ALTER TABLE` is limited, and a "revert" migration is often a separate `CREATE TABLE ... AS SELECT` pattern rather than a simple `DOWN` script. This is a personal app; a broken migration is fixed by writing a corrective one, not by reverting history.
4. **Secrets:** `wrangler secret` changes are not versioned. If a secret rotation breaks the deployed Worker, re-set the previous value with `wrangler secret put`.

---

## 7. Local Development

### 7.1 Running both packages

```bash
# Terminal 1: API Worker
cd packages/api
pnpm dev                      # wrangler dev -- runs on :8787 and applies migrations

# Terminal 2: SvelteKit
cd packages/web
pnpm dev                      # vite dev -- runs on :5173 with proxy to :8787
```

### 7.2 D1 local development

`wrangler dev` (with `--local` flag or the default Miniflare-based local runtime) spins up a local SQLite database for D1. This is the same in-memory/on-disk SQLite used by integration tests (`@cloudflare/vitest-pool-workers`). The local database is at `.wrangler/state/v3/d1/<database_id>/db.sqlite` by default.

To apply migrations to the local database:

```bash
cd packages/api
wrangler d1 migrations apply DB --local
```

To wipe and recreate the local database (e.g. after a schema change):

```bash
rm -rf .wrangler/state/v3/d1
wrangler d1 migrations apply DB --local
```

### 7.3 R2 local development

`wrangler dev` emulates R2 in-memory. Objects written during development are lost when the process restarts. For attachments, this is acceptable -- upload a test file once per session.

### 7.4 AI local development

Workers AI calls (`env.AI.run()`) are **not emulated by Miniflare**. In local development, the AI route either calls the real Workers AI endpoint (if the environment has an active Workers AI account with remaining quota) or returns an error. To work on the System Creator's AI flow without burning neuron quota against a real model, the frontend can bypass the AI route entirely and type manual field values into the form.

---

## 8. Secrets Reference

| Secret | Where to generate | Set via |
|---|---|---|
| `BETTER_AUTH_SECRET` | Random 32-char hex string (`openssl rand -hex 32`) | `wrangler secret put BETTER_AUTH_SECRET` |
| `MONGODB_URI` | Atlas cluster connection string | `wrangler secret put MONGODB_URI` |

These are stored in Cloudflare's secrets store, not in `.env` files or `wrangler.toml`. They are accessed at runtime as `env.BETTER_AUTH_SECRET` and `env.MONGODB_URI` inside the Hono Worker.

---

## 9. Deploy Checklist (first-ever deploy)

- [ ] Cloudflare account created
- [ ] D1 databases created (`wrangler d1 create polaris-db-dev`, `polaris-db`)
- [ ] R2 bucket created (`wrangler r2 bucket create polaris-attachments`)
- [ ] Queue created (`wrangler queues create polaris-journal-retry`)
- [ ] Secrets set (`wrangler secret put BETTER_AUTH_SECRET`, `MONGODB_URI`)
- [ ] Database UUIDs from step 2 written into both `wrangler.toml` files
- [ ] Initial migrations created (`wrangler d1 migrations create`)
- [ ] Migrations applied (`wrangler d1 migrations apply DB --remote`)
- [ ] Better Auth tables generated (`npx @better-auth/cli generate --config path/to/auth.ts --output packages/api/migrations/`)
- [ ] Better Auth tables applied to D1 (manual SQL from generated migration, or via wrangler)
- [ ] `pnpm -r build` succeeds
- [ ] `pnpm -r deploy` succeeds
- [ ] Verify: sign up at `https://polaris-web.<account>.workers.dev`, create a system, see it on the dashboard
