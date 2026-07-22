# CI/CD & Deployment

**Project:** *Polaris*

**Document type:** Deployment reference -- defines the CI pipeline, deploy order, environment configuration, and rollback strategy. Companion to the [Tech Stack ADR](../ADRs/001-tech-stack-adr.md) (owns the monorepo structure and deployment targets this document operationalizes), the [Testing Strategy](testing-strategy.md) (owns the CI pipeline's test stages), and the [API Route Design](api-routes.md) / [SvelteKit Route Architecture](sveltekit-route-architecture.md) (which define the two deployable artifacts).

**Status:** Live — v1 active

**Implementation status:** Implemented — Slice 12

**Last updated:** July 22, 2026

---

## 1. Artifacts

Two independent deployments:

| Artifact | Directory | Type | Wrangler command |
|---|---|---|---|
| API Worker | `packages/api/` | Workers script + scheduled handler + queue consumer | `wrangler deploy` |
| Web static assets | `packages/web/` | Workers Static Assets (SPA build output) | `wrangler deploy` |

They are deployed independently but always in a specific order (see 3.1). They have no circular dependency -- the Web assets are pure static files that make API calls to whatever origin `VITE_API_BASE_URL` is configured for. A new version of the API Worker can be deployed without touching the frontend, and vice versa, as long as the API contract is backward-compatible (which it always is in v1, since both artifacts are deployed in lockstep from the same commit).

Both artifacts are built and tested in parallel via CI's package matrix (S4) before either is deployed -- see S4.1 for the full pipeline graph.

---

## 2. Environment Configuration

### 2.1 Variables

| Variable | Package | Dev | Production | Secret? |
|---|---|---|---|---|
| `VITE_API_BASE_URL` | `web` | `''` (empty -- same-origin via Vite proxy) | `https://polaris-api.kelpselp.workers.dev` | No |
| `ENVIRONMENT` | `api` | `development` | `production` | No |
| `BETTER_AUTH_SECRET` | `api` | Auto-generated dev secret | Generated secret, stored in `wrangler secret` | Yes |
| `BETTER_AUTH_URL` | `api` | `http://localhost:8787` | `https://polaris-api.kelpselp.workers.dev` | No |
| `MONGODB_URI` | `api` | `mongodb://localhost:27017/polaris` (local Mongo) | Atlas connection string, stored in `wrangler secret` | Yes |

### 2.2 `wrangler.jsonc` -- `packages/api/`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "polaris-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-22",
  "compatibility_flags": ["nodejs_compat"],

  "observability": {
    "enabled": true,
    "logs": { "head_sampling_rate": 1 },
    "traces": { "enabled": true, "head_sampling_rate": 0.01 }
  },

  "triggers": {
    "crons": ["0 15 * * *"]       // 11 PM Asia/Manila, UTC+8
  },

  "queues": {
    "producers": [
      { "binding": "JOURNAL_RETRY_QUEUE", "queue": "polaris-journal-retry" }
    ],
    "consumers": [
      { "queue": "polaris-journal-retry", "max_batch_size": 10, "max_batch_timeout": 5 }
    ]
  },

  "vars": {
    "MONGODB_URI": "mongodb://localhost:27017/polaris"   // dev only; production set via wrangler secret
  },

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "polaris-db-dev",
      "database_id": "bd7d9f42-2c4a-442c-9fd0-a53ded81cc6c"
    }
  ],

  "r2_buckets": [
    { "bucket_name": "polaris-attachments", "binding": "ATTACHMENTS" }
  ],

  "env": {
    "production": {
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "polaris-db",
          "database_id": "6072aa3b-6fad-48a4-b2d6-72eaaaef6a3e"
        }
      ]
    }
  }
}
```

**Secrets:** `BETTER_AUTH_SECRET` and `MONGODB_URI` (production) are NOT in `wrangler.jsonc` -- they are set via `wrangler secret put` and accessed via `env.BETTER_AUTH_SECRET` / `env.MONGODB_URI` at runtime. This keeps them out of version control.

**Deploy with `--env production`** to use the production D1 database (`polaris-db`). Without the flag, the root config's dev database is used. Example:
```bash
cd packages/api
wrangler d1 migrations apply DB --remote --env production
wrangler deploy --env production
```

### 2.3 `wrangler.jsonc` -- `packages/web/`

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "polaris-web",
  "compatibility_date": "2026-07-22",
  "assets": {
    "directory": "build",
    "not_found_handling": "single-page-application"
  }
}
```

Uses the modern Workers Static Assets pattern. No Worker script is needed -- the platform serves files from `build/` directly. The `not_found_handling: "single-page-application"` option serves `index.html` for any unmatched route, providing SPA fallback automatically (the Worker from `packages/web/src/worker.ts` was removed in favor of this built-in feature).

**`VITE_API_BASE_URL`** is baked in at build time via `packages/web/.env.production`. It is NOT set at the Worker runtime -- Vite replaces `import.meta.env.VITE_*` during `vite build`, making the value static in the compiled JS bundle. The file is tracked in git (no secrets in it -- just a public URL).

```env
# packages/web/.env.production
VITE_API_BASE_URL=https://polaris-api.kelpselp.workers.dev
```

For local development, `packages/web/.env.development` keeps `VITE_API_BASE_URL` empty so API calls use the Vite proxy (`localhost:5173/api` → `localhost:8787`).

---

## 3. Deploy Order and Scripts

### 3.1 Order

```
1. D1 migrations (packages/api)  -- wrangler d1 migrations apply DB
2. API Worker (packages/api)     -- wrangler deploy
3. Web static (packages/web)     -- wrangler deploy
```

Migrations run **before** the API Worker deploy so the new code sees the latest schema on its first request. The Web deploy runs last because it has no dependency on the API deployment order beyond `VITE_API_BASE_URL` being correct (which is baked at build time, not deploy time).

**Two ways this order is enforced, depending on path:**

- **Via CI (the normal path, on merge to `main`):** the `deploy` job in S4 runs all three steps in this exact sequence, automatically, only after every test/build stage across both packages has passed. This is the default -- see S4.2 for the workflow definition.
- **Via manual deploy (local machine, day-to-day or first-time setup):** the scripts below run the same three steps by hand. Still useful for local verification before pushing, or for the very first deploy before CI/secrets exist (S3.2).

**Script in root `package.json`:**

```jsonc
{
  "scripts": {
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "test:unit": "pnpm -r test:unit",
    "test:int": "pnpm --filter api test:int",
    "test:e2e": "pnpm --filter web test:e2e",
    "deploy": "pnpm -r deploy",
    "deploy:migrations": "cd packages/api && wrangler d1 migrations apply DB",
    "deploy:api": "cd packages/api && wrangler deploy",
    "deploy:web": "cd packages/web && vite build && wrangler deploy",
  }
}
```

Each package has its own scripts in its `package.json`:

```jsonc
// packages/api/package.json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler d1 migrations apply DB && wrangler deploy",
    "lint": "eslint src/",
    "test:unit": "vitest run",
    "test:int": "vitest run",
    "dev:e2e": "wrangler d1 migrations apply DB --local && wrangler dev --port 8787"
  }
}

// packages/web/package.json
{
  "scripts": {
    "dev": "vite dev",
    "build": "svelte-kit sync && vite build",
    "deploy": "vite build && wrangler deploy",
    "lint": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "test:unit": "vitest",
    "test:e2e": "playwright install chromium && playwright test"
  }
}
```

Running `pnpm -r deploy` from the root runs both in workspace order (api first, web second) because pnpm respects the dependency graph: `web` depends on `api` (for types), so pnpm runs `api`'s deploy first.

**Note:** The `deploy` script for both packages runs migrations (api) or the full build (web). The `deploy:api` and `deploy:web` root scripts are lower-level for targeted manual deploys (e.g., `pnpm deploy:api -- --env production`).

### 3.2 Day-to-day manual deploy (fallback, pre-CI or local verification)

```bash
git pull
pnpm install                     # if dependencies changed
pnpm -r build                    # verify both packages build
pnpm -r deploy                   # migrations, api, web
```

---

## 4. CI Pipeline

Runs on every push to `main` and every PR. Defined in `.github/workflows/ci.yml`.

### 4.0 Why a matrix, and what it does/doesn't parallelize

All referenced scripts (`lint`, `test:unit`, `test:int`, `test:e2e`) are now defined in both packages' `package.json` and the root convenience scripts. The CI pipeline is ready to run.

`lint`, `test:unit`, and `build` are independent per package -- `web`'s lint failing has no bearing on `api`'s unit tests passing, and today's `pnpm -r` runs them serially anyway. Matrixing over `package: [api, web]` runs these three stages concurrently instead, which is the actual bottleneck.

**What stays outside the matrix:**

- `test:int` -- `api`-only (Miniflare/D1); `web` has no integration layer (Testing Strategy S3.2). Matrixing a stage that only exists for one leg buys nothing.
- `test:e2e` -- needs *both* packages built and running together (Testing Strategy S3.3); it depends on the whole matrix finishing, not a single leg.
- `deploy` -- stays a single sequential job (migrations -> API -> web). This ordering is load-bearing (S3.1) and is never matrixed, regardless of how the test stages are parallelized.

### 4.1 Pipeline graph

```mermaid
flowchart TD
    Checkout[Checkout + pnpm install<br/>shared cache: pnpm-lock.yaml hash]

    subgraph Matrix["matrix: package = [api, web]"]
        LintA[lint] --> UnitA[test:unit] --> BuildA[build]
    end

    Checkout --> Matrix
    Matrix --> IntTest["test:int (api only)"]
    Matrix --> E2E["test:e2e (needs both packages built)"]
    IntTest --> E2E
    E2E --> Deploy

    subgraph Deploy["deploy (main branch only, sequential)"]
        Mig[D1 migrations] --> ApiDeploy[Deploy API Worker] --> WebDeploy[Deploy Web static assets]
    end
```

Every matrix leg, `test:int`, and `test:e2e` must succeed before `deploy` runs at all -- `fail-fast: true` on the matrix means one failing leg cancels its siblings immediately, and `deploy`'s `needs:` list means a single red job anywhere upstream skips deploy entirely, never a partial deploy.

### 4.2 Workflow definition

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    strategy:
      fail-fast: true
      matrix:
        package: [api, web]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm       # keyed on the single root pnpm-lock.yaml -- shared across both matrix legs

      - run: pnpm install --frozen-lockfile

      - name: Lint (${{ matrix.package }})
        run: pnpm --filter ${{ matrix.package }} lint

      - name: Unit tests (${{ matrix.package }})
        run: pnpm --filter ${{ matrix.package }} test:unit

      - name: Build (${{ matrix.package }})
        run: pnpm --filter ${{ matrix.package }} build

  integration:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api test:int   # @cloudflare/vitest-pool-workers -- api only, see Testing Strategy S3.2

  e2e:
    needs: [test, integration]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: pnpm --filter web test:e2e
        env:
          VITE_API_BASE_URL: "http://localhost:8787"

  # Note: The CI workflow at .github/workflows/ci.yml is the source of truth.
  # This doc's YAML is kept in sync with the actual file.

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: [test, integration, e2e]     # any failure anywhere above skips this job entirely
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      - name: Apply D1 migrations
        working-directory: packages/api
        run: npx wrangler d1 migrations apply DB --remote
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Deploy API Worker
        working-directory: packages/api
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Deploy Web static assets
        working-directory: packages/web
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Note on migrations in CI:** The `deploy` job applies D1 migrations as its first step, before deploying either Worker. This is a change from the original doc (which kept migrations manual-only). The reason: gating. With migrations inside CI, a bad migration blocks `wrangler deploy` from running at all -- same job, same failure surface -- rather than being a separate manual step a developer could forget to run before pushing. The append-only migration convention (ADR 002 S6.2) already protects against destructive schema changes, so the only failure mode CI catches immediately that a manual process would miss is "migration fails to apply," which is exactly what you want to catch.

### 4.3 What the CI pipeline does NOT do

| Activity | Reason |
|---|---|
| **Matrix the deploy job** | Deploy order (migrations -> API -> web) is load-bearing; matrixing would remove that guarantee. See S4.0. |
| **Per-package cache keys** | Single pnpm workspace, single lockfile -- one shared cache key covers both matrix legs; per-package keys would duplicate the same cache for no benefit. |
| **Deploy to staging/preview** | No staging environment exists. Deploy is directly to production on `main` only, gated by the full matrix + integration + e2e passing. |
| **`wrangler secret` management in CI** | Secrets (`BETTER_AUTH_SECRET`, `MONGODB_URI`) are set manually via `wrangler secret put` and are not available in CI. If CI needed to deploy to an ephemeral environment, this would need solving; for a single-deployment personal app with no staging environment, manual secret management is correct. |

---

## 5. URL Structure

| Environment | API URL | Web URL |
|---|---|---|
| Development (local) | `http://localhost:8787` | `http://localhost:5173` |
| Production | `https://polaris-api.kelpselp.workers.dev` | `https://polaris-web.kelpselp.workers.dev` |

These URLs are determined by the `name` field in each `wrangler.jsonc` (`polaris-api` and `polaris-web` substituted with the actual account subdomain `kelpselp`).

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

These are stored in Cloudflare's secrets store, not in `.env` files or `wrangler.jsonc`. They are accessed at runtime as `env.BETTER_AUTH_SECRET` and `env.MONGODB_URI` inside the Hono Worker.

---

## 9. Deploy Checklist

### 9.1 First-time setup (manual, once)

- [x] Cloudflare account created
- [x] D1 databases created (`wrangler d1 create polaris-db-dev`, `polaris-db`)
- [x] R2 bucket created (`wrangler r2 bucket create polaris-attachments`)
- [x] Queue created (`wrangler queues create polaris-journal-retry`)
- [x] Secrets set locally (`wrangler secret put BETTER_AUTH_SECRET`, `MONGODB_URI`)
- [x] Database UUIDs from step 2 written into both `wrangler.jsonc` files
- [x] Migration files scaffolded via `wrangler d1 migrations create DB <name>` -- one per table, per ADR 002 S6.2's numbered plan
- [x] Better Auth tables generated and applied to D1 (migration `0014_better_auth_core.sql`)
- [x] All 15 migrations applied to remote D1 (`wrangler d1 migrations apply DB --remote`)
- [ ] `CLOUDFLARE_API_TOKEN` added to GitHub Actions repo secrets -- required for the `deploy` job (S4.2) to authenticate; note this is separate from the `wrangler secret put` values above, which live in Cloudflare's secrets store, not GitHub's
- [x] `pnpm -r build` succeeds locally
- [x] `pnpm -r deploy` succeeds locally (first manual deploy completed during Slice 12)
- [ ] Verify: sign up at `https://polaris-web.kelpselp.workers.dev`, create a system, see it on the dashboard
- [ ] Push to `main` once and confirm the CI `deploy` job runs migrations + both deploys successfully end-to-end

**Note:** Steps still unchecked (`CLOUDFLARE_API_TOKEN`, verification, and CI push) are pending the Slice 12 merge to `main`.

### 9.2 Ongoing deploys (after first-time setup, CI-driven)

- [ ] Push/merge to `main`
- [ ] Confirm `test` (matrix), `integration`, and `e2e` jobs all pass in the Actions tab
- [ ] Confirm `deploy` job ran migrations, then API, then web, in that order (S4.1's graph)
- [ ] Spot-check the deployed URL if the change touched a P0 flow (Testing Strategy S3.3)

Manual deploy (`pnpm -r deploy` from a local machine) remains available as a fallback -- e.g. if GitHub Actions itself is down, or for testing a migration against `--local` before pushing -- but is no longer the primary path once CI is wired up.
