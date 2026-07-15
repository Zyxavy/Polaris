# Changelog

## [Unreleased]

### Slice 0: Repo & Cloud Bootstrap

- Provisioned D1 databases: `polaris-db-dev`, `polaris-db`
- Provisioned R2 buckets: `polaris-attachments`, `polaris-backups`
- Provisioned Queue: `polaris-journal-retry`
- Created MongoDB Atlas cluster: `PolarisCluster`

---

### Slice 1: Monorepo Scaffolding

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

---

### Slice 2: D1 Schema + Smoke Tests

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

---

### Slice 3: Auth (Better Auth + Recovery Codes)

#### Backend

- Installed `better-auth@^1.6.23` in `packages/api`
- Generated `CloudflareBindings` type via `pnpm cf-typegen`
- Installed `@types/node` dev dependency (required for `nodejs_compat`)
- Created `packages/api/src/auth.ts` with native D1 support (`database: env.DB`: no adapter package)
- Created core Better Auth tables (`user`, `session`, `account`, `verification`) as migration `0014_better_auth_core.sql`: CLI can't reach D1 bindings outside a request handler
- Mounted Better Auth handler at `/api/auth/*` in `index.ts`
- Created `requireAuth` middleware at `packages/api/src/middleware/require-auth.ts`
- Applied auth guard to all `/api/*` routes except `/api/auth/*`
- Created recovery codes routes (`POST /api/recovery-codes/generate`, `GET /api/recovery-codes`) at `packages/api/src/routes/recovery.ts`
- Implemented `POST /api/auth/recover` custom route with email + recovery code validation, hashing via `better-auth/crypto`, direct `account.password` update
- Registered recovery route **before** Better Auth catch-all (order matters in Hono)
- Rate-limiting explicitly skipped per `security-review.md` §1

#### Frontend

- Installed `better-auth` in `packages/web` (client SDK for Svelte)
- Created `packages/web/src/lib/auth-client.ts`: `createAuthClient` wrapper with credentials, destructured `signIn`/`signUp`/`signOut`/`useSession`
- Created `packages/web/src/lib/api/client.ts`: `apiFetch` wrapper with `credentials: 'include'`, JSON parsing, `ApiError` class for non-2xx responses
- Created `(auth)` route group:
  - `+layout.svelte`: redirects signed-in users to `/guides` using `getSession()` (promise-based, avoids reactivity issue with `useSession().data`)
  - `sign-in/+page.svelte`: centered form per design spec, calls `signIn.email()`, redirects to `/dashboard`
  - `sign-up/+page.svelte`: centered form with name/email/password, calls `POST /api/recovery-codes/generate` on sign-up success, shows recovery codes modal with copy/confirm before redirecting to `/guides`
- Created `(app)` route group:
  - `+layout.ts`: auth guard per §3.3, redirects to `/sign-in` if `getSession()` returns null
  - `+layout.svelte`: minimal nav shell with Polaris branding (full NavBar deferred to Slice 11)
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
- Fixed `auth.ts`: replaced invalid `...` spread with full `emailAndPassword`/`session`/`trustedOrigins` config
- Fixed `recovery.spec.ts` import path (`../recovery` -> `../lib/recovery`)
- Fixed `auth.spec.ts`: added missing `D1Migration` type import, replaced fragile `{ ...env }` spread with explicit auth config

---

### Slice 4: Systems CRUD (Backend + Frontend)

#### Backend

- Created `packages/api/src/lib/ownership.ts`: `getOwnedSystem` helper that SELECTs from systems scoped to `user_id` and parses `barrier_list` from stored JSON text. Why: every mutation endpoint needs ownership-scoped lookup; parsing barrier_list here keeps the API the JSON parse/serialize boundary so the frontend never sees raw D1 TEXT encoding.
- Created `packages/api/src/routes/systems.ts`: 6 endpoints on a Hono sub-router behind `requireAuth`:
  - `GET /api/systems`: paginated list (`?limit=`, `?cursor=`), optional `?status=` filter, ordered by `name ASC`, all scoped to `WHERE user_id = ?`
  - `POST /api/systems`: creates with `user_id` from session, accepts all optional fields at defaults
  - `GET /api/systems/:id`: ownership-scoped single-system lookup
  - `PATCH /api/systems/:id`: partial update (accepts any subset of fields, including `floor_action: ""` to support autosave of drafts)
  - `POST /api/systems/:id/confirm`: validates `floor_action` is non-empty, returns 422 `floor_action_required` if empty; the one place enforcement happens, distinct from the lenient autosave-safe PATCH
  - `POST /api/systems/:id/archive`: sets `status = 'archived'`, returns 409 `already_archived` if already archived
  - Why: PATCH must accept empty floor_action because autosave fires continuously on draft data; confirm is the explicit user checkpoint where "is this ready" is meaningful. Archive is a soft-delete state machine transition, not a hard DELETE: preserves history for the System detail page.
- Mounted systems routes in `packages/api/src/index.ts` below the auth guard. Why: inherits session validation for all systems endpoints without per-route duplication.
- Enhanced `requireAuth` middleware with early-return: checks `c.get('user')` first and skips Better Auth session validation if a user is already set in context. Why: allows route-scoped `requireAuth` (in systems.ts) to stack safely on top of the global guard without redundant API calls; enables integration tests to pre-authenticate by injecting a user in test middleware without needing valid session cookies (the previous approach required matching BETTER_AUTH_SECRET between Miniflare and test setup, which was fragile and caused persistent 401 failures).

#### Frontend

- Created `packages/web/src/lib/stores/toast.svelte.ts`: `$state`-based toast notification queue with `addToast` / `dismissToast`. Why: user-facing feedback for API errors and success states needs a shared reactive store that any component can push to.
- Created `packages/web/src/lib/api/index.ts`: `apiFetchWithToast` wrapper that calls `apiFetch` and dispatches toast on non-2xx responses. Why: keeps error handling consistent across all API calls without duplicating toast logic per component.
- Created `packages/web/src/lib/api/systems.ts`: typed `<T>` wrappers for all 6 systems endpoints. Why: frontend service modules convention: components never call `fetch()` directly.
- Created `packages/web/src/lib/components/ToastContainer.svelte`: fixed-position toast stack that reads from the toast store, auto-dismisses after 5s, supports success/error/info variants. Why: renders notifications without layout shift.
- Created `packages/web/src/lib/components/NavBar.svelte`: top navigation bar with branding, active state for Dashboard / Guides / Systems tabs. Why: app shell navigation required for the (app) layout.
- Created `packages/web/src/lib/components/SystemForm.svelte`: reusable form component with:
  - All System fields from the D1 schema (name, domain, purpose, philosophy, protocol, floor_action, trigger, barrier_list, environment_cue)
  - Autosave via `$effect` + debounce (`AUTOSAVE_DEBOUNCE_MS = 2000`): first save fires `POST /api/systems`, subsequent saves fire `PATCH /api/systems/:id`
  - Explicit confirm button that calls `POST /api/systems/:id/confirm` and shows inline `floor_action_required` error without navigation
  - Loading and error states per save action
  - Why: autosave eliminates the "lost work" problem during drafting; confirm is the deliberate checkpoint where floor_action is enforced; inline error on confirm avoids destructive navigation when validation fails.
- Created `packages/web/src/lib/components/system-form.config.ts`: exports `AUTOSAVE_DEBOUNCE_MS` as a named constant. Why: extracted to a plain Type module so unit tests can import the constant without compiling a Svelte component (which requires a browser env).
- Created route pages under `packages/web/src/routes/(app)/systems/`:
  - `+page.ts` / `+page.svelte`: systems list page with status tabs (active/paused/archived/all), paginated cards
  - `new/+page.svelte`: standalone System Creator form
  - `[id]/+layout.ts`: load function fetches system by ID, redirects to 404 page if null
  - `[id]/+layout.svelte`: tab shell with Overview / Workspace / Reviews / Edit tabs
  - `[id]/+page.svelte`: Overview tab: display of all System fields with inline edit capability
  - `[id]/edit/+page.svelte`: full edit form (same SystemForm component)
  - Why: file-based routing with data loading in `+layout.ts` avoids repeated fetch calls per tab; tab shell keeps navigation context while switching views.
- Updated `(app)/+layout.svelte` to include `<NavBar>` and `<ToastContainer>`. Why: integrate new navigation and toast infrastructure into the existing app shell.

#### Tests

- Created `packages/api/src/__tests__/systems.spec.ts`: 16 integration tests against real D1 (via `@cloudflare/vitest-pool-workers`):
  - 2 create tests (success + missing name → 400)
  - 2 list tests (owned list + status filter)
  - 2 single-get tests (owned → 200 + non-owned → 404)
  - 3 patch tests (partial update + empty floor_action accepted + non-owned → 404)
  - 3 confirm tests (empty floor_action → 422 + non-empty → 200 + non-owned → 404)
  - 3 archive tests (success → archived + already archived → 409 + non-owned → 404)
  - 1 unauthenticated test (no session → 401)
  - Why: full boundary coverage for every status code in the API contract; ownership-scoped non-owned tests return 404 per S1.5 to avoid leaking existence info.
- Created `packages/web/src/lib/components/SystemForm.svelte.spec.ts`: unit test with Vitest fake timers (`vi.useFakeTimers()` / `advanceTimersByTimeAsync`) verifying autosave fires after `AUTOSAVE_DEBOUNCE_MS` and does not fire before. Why: debounce behavior is timing-sensitive and would be flaky in E2E; fake timers make it deterministic.
- Created `packages/web/src/routes/(app)/systems/systems.e2e.ts`: Playwright E2E for P0 flow #2: create system from scratch (navigate to New, fill name + floor_action, confirm, verify success toast and redirect to the detail page). Why: validates the full stack from form submission through API to toast notification.
- Rewrote systems API tests to inject `userId` directly via test middleware instead of creating a real Better Auth session. Why: `createAuth(c.env)` in `requireAuth` was creating a fresh auth instance with BETTER_AUTH_SECRET from Miniflare env that didn't match the test's auth secret: consistent 401 failures. Injecting a user in context skips the session validation entirely (using the new early-return pattern) and makes the tests about route logic, not auth setup.
- Fixed Svelte 5 `state_referenced_locally` warnings by capturing prop to `const initial`. Why: passing a `$state` prop reference directly to a child triggers a warning in Svelte 5 runes mode; assigning to a local `const` breaks the reactive binding cleanly.
- Fixed E2E test to wait for confirm success toast before asserting redirect. Why: without this wait, the test races ahead before the API response is processed, causing intermittent failures.

#### Docs

- Updated `docs/reference/auth-integration.md` §1.3 to match the `requireAuth` early-return implementation.
- Updated `AGENTS.md` test count (8 → 24) and added `requireAuth` early-return pattern to the Auth conventions section.
- Updated `AGENTS.md` snapshot with full Slice 4 progress status (done, blocked, key decisions, critical context).

---

### Slice 5: Schedules (Backend + Frontend)

#### Backend

- Created `packages/api/src/lib/calendar.ts`: 4 pure bitmask functions: `dayToBit`, `encodeDaysToBitmask`, `decodeBitmaskToDays`, `dayMatchesBitmask(day: number, bitmask: number)`. Why: Slice 6 (Dashboard) and Slice 7 (Cron) both need bitmask matching; building it as isolated, unit-tested helpers avoids duplicating the bit-shift logic in SQL contexts where the match can't be pushed into a `WHERE` clause.
- Added `getOwnedSchedule` to `packages/api/src/lib/ownership.ts`: SELECTs from `schedules` JOINed to `systems` on `system_id`, scoped to `systems.user_id`. Why: ownership-scoped lookup for non-systems resources pattern (S1.5).
- Created `packages/api/src/routes/schedules.ts`: 4 handlers on a Hono sub-router:
  - `GET /api/systems/:system_id/schedules`: list schedules for a system, ownership-scoped through the system
  - `POST /api/systems/:system_id/schedules`: create schedule, validates `time_window_end > time_window_start` (422 `invalid_window`), `recurrence` always server-set to `'weekly'`
  - `PATCH /api/schedules/:id`: update schedule fields, ownership-scoped via JOIN through `systems.user_id`
  - `DELETE /api/schedules/:id`: ownership-scoped via JOIN
- Mounted schedule routes in `packages/api/src/index.ts` at two prefixes: `/:system_id/schedules` (for GET/POST) and `/schedules/:id` (for PATCH/DELETE). Why: nested path for creation/listing, flat path for resource-by-ID, matching api-routes.md S3.
- `recurrence` never accepted from request body: always server-set to `'weekly'` matching D1 Schema S3.2 `CHECK` constraint.

#### Frontend

- Created `packages/web/src/lib/api/schedules.ts`: 4 typed functions (`listSchedules`, `createSchedule`, `updateSchedule`, `deleteSchedule`) using the existing `apiFetch` wrapper. Why: frontend service modules convention.
- Created `packages/web/src/lib/components/SchedulePicker.svelte`: self-contained day-of-week grid (7 toggleable day buttons) + time window inputs (start/end). Manages its own CRUD via the schedules API module, accepts `systemId` prop.
- Updated `packages/web/src/lib/components/SystemForm.svelte`: replaced Slice 4's stub schedule section with `<SchedulePicker systemId={systemId} />`. Why: no schedule state managed in SystemForm; SchedulePicker is fully self-contained.

#### Tests

- Created `packages/api/src/__tests__/calendar.spec.ts`: 24 unit tests covering all 4 bitmask helpers: `dayToBit` (4 boundary cases), `encodeDaysToBitmask` (5 cases including empty), `decodeBitmaskToDays` (6 cases including round-trip), `dayMatchesBitmask` (9 cases across bit patterns 0, 21, 127). No D1 required: pure function tests.
- Created `packages/api/src/__tests__/schedules.spec.ts`: 12 integration tests against real D1 (via `@cloudflare/vitest-pool-workers`):
  - 3 create tests (success + invalid window 422 + missing days_of_week 400 + out-of-range bitmask 400 + non-owned system 404)
  - 2 list tests (success + non-owned system 404)
  - 3 patch tests (update fields + invalid window 422 + non-owned schedule 404)
  - 2 delete tests (success + non-owned schedule 404)
- Fixed TypeScript errors: `systemId` undefined guard in ownership helper, `createRes` variable name conflict in schedules test (redeclared in nested scopes).

---

### Slice 6: Dashboard & Instances (Backend + Frontend)

#### Backend

- Created `packages/api/src/services/instances.ts`: `generateTodayInstances(db, userId)` — lazy instance generation pushing bitmask matching into SQL `WHERE (days_of_week & ?) != 0`, batch INSERT via `db.batch()` (one I/O call, not per-row). Returns `{ created: number }`.
- Created `packages/api/src/services/dashboard.ts`: `getDashboardData(db, userId)` — calls `generateTodayInstances`, then runs the window-gated filtered SELECT (only returns instances whose scheduled time window has opened, using `time_window_start <= ?` with the current Manila time string).
- Created `packages/api/src/routes/dashboard.ts`: `GET /api/dashboard` — the single most important route. Calls `getDashboardData`, returns instances with flat system fields (`name`, `domain`, `floor_action` from SQL `JOIN`), no pagination (bounded by active system count per S1.6 exclusion).
- Created `packages/api/src/routes/instances.ts`:
  - `GET /api/instances/:id` — ownership-scoped single Instance lookup
  - `PATCH /api/instances/:id` — state transition (`pending` → `full`/`floor`/`missed`), accepts optional `notes`. Rejects `state: "pending"` with 422. Ownership-scoped via `getOwnedInstance` JOIN through `systems.user_id`.
- Added `getOwnedInstance` to `packages/api/src/lib/ownership.ts` (SELECT from instances JOIN systems WHERE instances.id = ? AND systems.user_id = ?).
- Mounted dashboard and instances routes in `packages/api/src/index.ts`.

#### Frontend

- Created `packages/web/src/lib/api/instances.ts`: 3 typed wrappers (`getDashboard`, `getInstance`, `patchInstance`) using `apiFetch`.
- Created `packages/web/src/lib/stores/dashboard.svelte.ts`: `DashboardStore` class with `$state<DashboardInstance[]>` — optimistic update on `markState` (instantly flips `state` in the array, rolls back on API failure, pushes error toast), `load(instances)` for bulk replacement.
- Created `packages/web/src/routes/(app)/dashboard/+page.ts`: `load` function calls `getDashboard()`, returns typed `DashboardResponse`.
- Created `packages/web/src/routes/(app)/dashboard/+page.svelte`: 4 states — skeleton (loading shimmer rows), error (retry button), empty ("Create your first system" CTA with link to `/systems/new`), normal (instance cards with streak footer showing per-system state indicators). Uses `{#each}`, `{#if}` per Svelte 5 conventions. Calls `dashboardStore.markState` via arrow function wrapper to preserve `this` binding.
- Added `.skeleton` CSS class to `layout.css` (gradient shimmer animation for loading placeholders).

#### Tests

- Created `packages/api/src/__tests__/instances.spec.ts`: 7 integration tests against real D1:
  - Generation creates no instances for inactive or unowned systems
  - Generation creates one `pending` instance for an active system with today's schedule
  - Generation is idempotent — second call returns `{ created: 0 }`, no duplicate row
  - `GET /api/instances/:id` returns 200 for owned, 404 for non-owned
  - `PATCH /api/instances/:id` transitions `pending` → `full`, updates `updated_at`
  - `PATCH` non-owned instance returns 404
  - Dashboard endpoint returns instances with flat system fields
- Created `packages/api/src/__tests__/dashboard.spec.ts`: 4 integration tests:
  - Dashboard returns 200 with instances
  - Returns correct flat `name`, `domain`, `floor_action` fields
  - Lazy-generates when no instances exist yet that day
  - Idempotent on re-fetch (no duplicate instances created)
- Created `packages/web/src/routes/(app)/dashboard/dashboard.e2e.ts`: P0 flow #4 — logs in, creates active system with today's schedule, navigates to dashboard, sees pending instance, marks it `full`, verifies state updates without page reload.
- Fixed D1 state leaking across tests: each `beforeEach` now creates a unique `currentUserId` via `crypto.randomUUID()` so tests don't share seeded data.
- Fixed fake timer freeze in `instances.spec.ts` PATCH test: `vi.advanceTimersByTime(1000)` before reading `updated_at` so the timestamp actually changes.
- Fixed `vi` import missing in `calendar.spec.ts` (added `import { vi } from 'vitest'`).
- Fixed self-closing tag in E2E auth test (`<input>` → `<select>` for recovery code dropdown).
- Fixed E2E `locator('..')` anti-pattern: replaced with `.filter({ hasText })` for finding the right instance card.
- **Integration test count:** 60 → 71
- **E2E test count:** 3 → 4

#### Docs

- Updated `docs/reference/api-routes.md` §4.1: flat system fields response shape, corrected generation SQL (6-column INSERT, `db.batch(batch)` array syntax, `time_window_start <= ?` parameter), implementation status S6 live.
- Updated `docs/reference/testing-strategy.md`: Instance/dashboard tests marked live with ✓, idempotency example corrected to match actual `generateTodayInstances(db, userId)` signature and `{ created: number }` return type, service function example updated to reflect SQL bitmask matching (no JS loop).
- Updated `docs/reference/sveltekit-route-architecture.md` §5.2: Dashboard store uses `DashboardInstance[]` type, PATCH success handler merges server fields into existing row (not wholesale replacement) because PATCH response lacks flat system fields.
- Updated `AGENTS.md`: test count 60 → 71 with instances (7) and dashboard (4) breakdown, store filename `dashboard-store.ts` → `dashboard.svelte.ts`.
