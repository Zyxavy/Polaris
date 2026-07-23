# Troubleshooting

Issues encountered during development and CI, with fixes.

## CI Pipeline

### 1. `npx` blocked by devEngines

`devEngines.packageManager` in root `package.json` enforces pnpm. Running `npx <tool>` fails because npm is not the configured package manager.

**Fix:** Use `pnpm exec <tool>` or `pnpm --filter <pkg> run <script>` instead of `npx`.

### 2. API missing `build` script

CI matrix runs `pnpm --filter api build` but the API package had no `build` script. The API is a Cloudflare Worker (TypeScript entry point, no compile step needed), but the CI expects the script to exist.

**Fix:** Added `"build": "wrangler types --env-interface CloudflareBindings"` to `packages/api/package.json`. This regenerates type bindings, which is useful in CI.

### 3. `devEngines` version mismatch warning

```
"packageManager" and "devEngines.packageManager" specify different versions of pnpm in package.json. "packageManager" will be ignored
```

`packageManager: "pnpm@11.9.0"` (exact) vs `devEngines.packageManager.version: "^11.9.0"` (range). pnpm warns when they differ.

**Fix:** Use exact version `"11.9.0"` in `devEngines.packageManager.version` to match `packageManager`.

### 4. Node.js 20 action deprecation

```
Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4, pnpm/action-setup@v4
```

GitHub Actions runners ship Node.js 24 by default. Old action major versions bundle Node.js 20.

**Fix:** Bump to latest major versions that target Node.js 22+:
- `actions/checkout@v4` → `@v7`
- `actions/setup-node@v4` → `@v7`
- `pnpm/action-setup@v4` → `@v6`

### 5. API unit tests fail: workerd max compatibility date

```
This Worker requires compatibility date "2026-07-22", but the newest date supported by this server binary is "2026-07-07".
```

Miniflare `4.20260630.0` bundles a workerd binary that supports compatibility dates up to `2026-07-07`. The `wrangler.jsonc` had `compatibility_date: "2026-07-22"`.

**Fix:** Lowered `compatibility_date` to `2026-07-07` in `packages/api/wrangler.jsonc`. Production deploys are unaffected — Cloudflare's edge supports any recent date.

### 6. Playwright browsers not installed in CI

E2E tests run on a fresh VM. If Playwright browsers aren't installed, tests fail with browser-not-found errors.

**Fix:** Added `pnpm --filter web run playwright:install` step to both the `test` matrix (for `web` package) and the `e2e` job. The script runs `playwright install --with-deps chromium`.

### 7. Redundant Playwright browser install in `test:e2e`

`test:e2e` script ran `playwright install chromium && playwright test`. When CI has already installed browsers (step 6 above), this duplicates work and increases CI time. It also omits `--with-deps` for system dependencies.

**Fix:** Changed `test:e2e` to just `playwright test`. Browser installation is handled separately by `playwright:install`.

### 8. Double web build in E2E

CI runs `pnpm -r build` before the e2e job, but `playwright.config.ts` also ran `pnpm build && pnpm preview` in its web server command. This built the web app twice.

**Fix:** Changed Playwright web server command from `pnpm build && pnpm preview` to just `pnpm preview`. CI builds once, Playwright serves the existing build.

### 9. `VITE_API_BASE_URL` not set during CI web build

E2E tests built the web bundle without `VITE_API_BASE_URL` set. Vite baked the value from `.env.production` (`https://polaris-api-production.kelpselp.workers.dev`) instead of the local API worker (`http://localhost:8787`). All API calls from the test app went to the production URL or fell back to same-origin, causing every e2e test to fail.

The CI workflow set the env var on the `test:e2e` step, but Vite reads `VITE_*` vars at build time, not at runtime. The build ran in a separate step without the env var.

**Fix:** Moved `VITE_API_BASE_URL: "http://localhost:8787"` to the `pnpm -r build` step so Vite bakes the correct localhost URL into the bundle at build time.

### 10. Deploy job missing `--env production`

The CI deploy job ran `wrangler deploy` without `--env production`, targeting the default (dev) environment and dev D1 database (`polaris-db-dev`). Production must use `--env production` to use `polaris-db`.

**Fix:** Added `--env production` to both the D1 migration command (`wrangler d1 migrations apply DB --remote --env production`) and the API deploy command (`wrangler deploy --env production`) in the CI workflow.

## E2E Test Failures

### 11. Bottom nav intercepts form submit clicks

NavBar.svelte renders a fixed bottom `<nav>` with `z-50` at all viewport sizes. On smaller screens (below `xl`), this can overlap form submit buttons (Save System, Submit Review) after Playwright scrolls them into view. The nav intercepts pointer events.

**Fix:** Added `xl:hidden` to the bottom `<nav>` class list. On xl screens the sidebar is visible, so the bottom nav is hidden. Each navigation pattern is visible at exactly one breakpoint.

### 12. Desktop sidebar overlays content

The sidebar `<aside>` is `fixed left-0 top-0 h-screen w-48 z-40`. On `xl` screens, it overlays the main content area (which lacked left margin), causing all clicks in the left 192px to be intercepted.

**Fix:** Added `xl:ml-48` to the `<main>` tag in `(app)/+layout.svelte`. Content shifts right by 192px, clearing the sidebar.

### 13. WidgetPalette selector targets wrong element

Workspace E2E used `page.locator('aside button:has-text("Timer")')`, but `WidgetPalette` was a `<div>`, not an `<aside>`. The NavBar sidebar `<aside>` was the only `<aside>` in the shell, so the selector resolved to a non-existent element.

**Fix:** 
- Changed `WidgetPalette` root from `<div>` to `<aside aria-label="Widget palette">`
- Updated E2E selectors to `page.getByRole('complementary', { name: 'Widget palette' }).getByRole('button', { name: 'Timer' })`

### 14. Reviews heading resolves to 2 elements

Both `[id]/+layout.svelte` and `reviews/new/+page.svelte` rendered `<h1>{system.name}</h1>`, causing Playwright's `text=Weekly Review Test` to match two elements.

**Fix:** Removed the duplicate `<h1>` from `reviews/new/+page.svelte`. The layout already renders the system name.

## Frontend Build Warnings

### 15. `state_referenced_locally` Svelte warnings

```
This reference only captures the initial value of `initial`. Did you mean to reference it inside a derived instead?
```

`SystemForm.svelte` and `ReviewForm.svelte` initialized `$state()` fields directly from the reactive `initial` prop. Svelte warns because the value is captured once at component creation and doesn't react to prop changes — which is exactly the intended behavior for a form that should not reset when props change.

**Fix:** Created a non-reactive snapshot (`const snap = { ...initial }`) before all `$state()` declarations. `$state()` initializers and dirty-check comparisons reference `snap` instead of `initial`. This makes the intentional one-time capture explicit and silences the warning.

## Lint Warnings

### 16. `no-explicit-any` in test files

Test files (`__tests__/*.ts`) use `any` extensively for mock responses and dynamic assertions. ESLint was configured with `'@typescript-eslint/no-explicit-any': 'warn'` for all `src/**/*.ts` files.

**Fix:** Added a test file override in `eslint.config.js` that disables the rule for `src/**/__tests__/*.ts`.

### 17. Unused variable/parameter warnings

| File | Symbol | Fix |
|---|---|---|
| `packages/api/src/lib/workspace.ts:8` | `v` | Commented out dead assignment (future version upgrade chain is stubbed) |
| `packages/api/src/index.ts:90,100` | `ctx` | Renamed to `_ctx` to match the `^_` ignore pattern |
| `packages/api/src/__tests__/workspace.spec.ts:45` | `seedSchedule` | Removed unused function entirely |

## Svelte Type Errors

### 18. `ComponentType` vs `Component` in NavBar

`NavBar.svelte` used `ComponentType` from Svelte 4's `svelte` export. In Svelte 5 runes mode, the correct type is `Component`.

**Fix:** Changed `import type { ComponentType } from 'svelte'` to `import type { Component } from 'svelte'` and updated the NavItem interface accordingly.

---

## CI/CD Deployment

### 19. Queue consumer registration fails during deploy

```
✘ [ERROR] Some triggers failed to deploy for polaris-api-production:
    - A request to the Cloudflare API (/accounts/.../queues/...) failed.
```

The `consumers` block in `wrangler.jsonc` queues config tells wrangler to register the Worker as a consumer on `polaris-journal-retry` during deploy. This can fail when:
- The `CLOUDFLARE_API_TOKEN` lacks `Queues:Edit` permission (add it to the token at https://dash.cloudflare.com/profile/api-tokens)
- The queue doesn't exist yet (create it with `wrangler queues create polaris-journal-retry`)

**Fix:** Remove the `consumers` block from `wrangler.jsonc` (both top-level and `env.production`) so the deploy doesn't try to register it. Register the consumer manually after deploy:

```bash
wrangler queues consumer add polaris-journal-retry --script polaris-api-production --env production
```

### 20. Deploy job runs on fresh runner — no build artifacts

```
✘ [ERROR] The directory specified by the "assets.directory" field in your configuration file does not exist:
  /home/runner/work/Polaris/Polaris/packages/web/build
```

GitHub Actions jobs run on isolated VMs. The `test` job (which runs `pnpm --filter web build`) and the `e2e` job (which runs `pnpm -r build`) each get a fresh checkout — their build output doesn't persist to the `deploy` job.

**Fix:** Add a `pnpm -r build` step in the deploy job before the web deploy step, with `VITE_API_BASE_URL` set to the production URL:

```yaml
- run: pnpm -r build
  env:
    VITE_API_BASE_URL: "https://polaris-api-production.kelpselp.workers.dev"
- name: Deploy Web static assets
  working-directory: packages/web
  run: pnpm exec wrangler deploy
```

### 21. `vars` in production env overwrites remote secret

```
▲ [WARNING] Environment variable `MONGODB_URI` conflicts with an existing remote secret.
  This deployment will replace the remote secret with your environment variable.
```

Setting `vars.MONGODB_URI` in `env.production` of `wrangler.jsonc` (git-tracked) replaces the secret set via `wrangler secret put MONGODB_URI --env production`. The Worker connects to the dev `localhost` URI instead of the production MongoDB Atlas URI.

**Fix:** Remove the `vars` block from `env.production` entirely. Secrets set via `wrangler secret put` take precedence over `vars` at runtime and can be scoped per environment. The dev URI stays in the top-level `vars` for local development.

### 22. API token permissions checklist for production deploy

The `CLOUDFLARE_API_TOKEN` GitHub secret needs all of these:

| Resource | Permission | Required for |
|---|---|---|
| Workers Scripts | Edit | Deploy Workers |
| D1 | Edit | Run migrations |
| Workers R2 Storage | Edit | R2 bucket bindings |
| Queues | Edit | Register queue producers + consumers |
| Cloudflare Pages | Edit | Deploy static assets (if using Pages) |
