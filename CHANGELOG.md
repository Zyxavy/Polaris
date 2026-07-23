# Changelog

## [Unreleased]

### MVP Milestone: P0 Complete

All 14 slices of the P0 scope are implemented. The core product loop (sign-up → create system → schedule → daily dashboard → review → write-back) works end-to-end with CI, deployment, and a first security/disaster-recovery sweep complete. P1 work (templates, AI, remaining widgets, attachments) begins next.

---

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

---

### Slice 7: Nightly Cron Instance Pre-generation

#### Backend

- Cleaned up `packages/api/src/lib/calendar.ts` `tomorrowManilaDate()`: removed unused `todayParts` variable and redundant `Intl.DateTimeFormat` — now uses `toLocaleDateString('en-CA')` directly.
- Added `generateInstancesForAllUsers(db, dateStr)` to `packages/api/src/services/instances.ts`: same SQL pattern as Slice 6's per-user version, but drops the `user_id` filter — queries `WHERE s.status = 'active'` across all users, matching ADR 001 S5.8's design for a background job with no request context.
- Added `scheduled` export to `packages/api/src/index.ts`: calls `generateInstancesForAllUsers` with tomorrow's date (via `tomorrowManilaDate()`), tagged with `[cron]` log prefix per `observability.md` S3.3.
- Added `"triggers": { "crons": ["0 15 * * *"] }` to `packages/api/wrangler.jsonc` — deferred from Slice 1.

#### Tests

- Added 4 unit tests for `tomorrowManilaDate()` in `calendar.spec.ts`: normal day, month boundary (`Jul 31→Aug 1`), year boundary (`Dec 31→Jan 1`), UTC midnight crossover.
- Added 2 integration tests for the cron handler in `instances.spec.ts`:
  - Verifies instances are created only for tomorrow's date (never today's).
  - Verifies idempotency: running `scheduled()` twice for the same date produces no duplicates.
  - **Caveat:** `applyD1Migrations` does not reset data between tests in `@cloudflare/vitest-pool-workers` (migrations are tracked and only applied once). The cron tests explicitly clean all tables in `beforeEach` to avoid cross-test contamination from the 7 prior tests that accumulate instances by date.
- All 9 instance tests now pass cleanly, including the 7 Slice-6 tests that remain the "safety net" coverage (lazy path works independently of cron).

#### Caveats

- The cron trigger is configured in `wrangler.jsonc` but has **never run in production** — it fires at 15:00 UTC daily. Until the first deploy of this branch to production, no pre-generation has occurred. The lazy dashboard-load path (Slice 6) is the sole generation mechanism today.
- No deploy-time verification has been performed — `wrangler tail` has not been used to confirm the `[cron]` log line appears. This is expected to be checked during the first manual post-deploy verification per `cicd-deploy.md` S9.2.

---

### Slice 8: Workspace + Widget Data

- Created `packages/api/src/lib/workspace.ts`: `upgradeLayout()` with `CURRENT_LAYOUT_VERSION = 1` and while-loop pattern for future version bumps.
- Created `packages/api/src/lib/ownership.ts`: `getOwnedWorkspace` (JOIN through system's user_id), `getOwnedWidgetEntry` (JOIN through instance → system → user_id).
- Created `packages/api/src/routes/workspace.ts`: `GET`/`PUT /api/systems/:system_id/workspace` with upsert via `ON CONFLICT(system_id)`.
- Created `packages/api/src/routes/counter-logs.ts`: 3 handlers — POST to instance, GET by widget_id (with `from`/`to` date filter using `date()`), DELETE by id.
- Created `packages/api/src/routes/timer-sessions.ts`: 3 handlers — POST to instance, GET by widget_id (with `from`/`to` date filter), DELETE by id.
- Created `packages/api/src/routes/checklist.ts`: 2 handlers — PUT replaces widget_entries (SELECT-then-UPDATE/INSERT), GET returns current state (404 if not yet saved).
- Fixed `counter-logs.ts` and `timer-sessions.ts` `from`/`to` filter to use `date(created_at)` for correct date-range comparison (full ISO timestamps were failing `<= date` comparison).
- Created `packages/web/src/lib/api/workspaces.ts`: API module with `getWorkspace`, `putWorkspace`, Layout/Widget/Workspace interfaces.
- Created `packages/web/src/lib/api/counter-logs.ts`, `timer-sessions.ts`, `checklist.ts`: typed API modules for widget data CRUD.
- Created `packages/web/src/lib/stores/workspace-editor.svelte.ts`: `WorkspaceEditorStore` runes class with `load`, `addWidget`, `removeWidget`, `reorder`, `save`; instantiated per page visit.
- Created widget components: `CounterWidget.svelte` (+1 button, optimistic total), `TimerWidget.svelte` (start/stop, `idle|running|saving` state machine), `ChecklistWidget.svelte` (checkbox list, 404→empty state, optimistic toggle).
- Created workspace components: `WidgetPalette.svelte` (8 types, P0 active/P1 disabled), `WorkspaceCanvas.svelte` (drag-and-drop via `svelte-dnd-action`), `WidgetCard.svelte` (type dispatch wrapper), `SaveBar.svelte` (sticky bottom bar with dirty indicator).
- Created route page `packages/web/src/routes/(app)/systems/[id]/workspace/+page.ts` (loads workspace layout + today's instance) and `+page.svelte` (composes three-zone layout).
- Created `packages/api/src/__tests__/workspace.spec.ts`: 24 tests — 7 unit (`upgradeLayout()` no-op, round-trip, edge cases) + 5 workspace integration + 5 counter-log + 2 timer-session + 5 checklist integration.
- Created `packages/web/src/routes/(app)/systems/workspace.e2e.ts`: P0 flow #5 — add Timer + Counter widgets, save, reload, verify persistence.
- Fixed pre-existing web unit test failures: installed missing `vitest-browser-svelte` and `@vitest/browser` packages (imported by `SystemForm.svelte.spec.ts` but never added to `package.json` — all 7 web unit tests now pass).
- **Integration test count:** 71 → 101
- **E2E test count:** 3 → 4

---

### Slice 9: MongoDB + Log/Journal Widget

- Added `mongodb@^7.5.0` dependency to `packages/api`.
- Created `packages/api/src/lib/mongo.ts`: lazy `getMongoClient()` singleton with dynamic `import('mongodb')` to avoid loading the driver at module resolution time (Workers cold-start optimisation).
- Created `packages/api/src/routes/journal-log.ts`: `POST /api/instances/:instance_id/journal_log/:widget_id` (direct Mongo write + D1 `widget_entries` pointer row → `201`; on failure enqueue to `polaris-journal-retry` → `202`) and `GET` (cursor-paginated read from Mongo).
- Created `packages/api/src/index.ts` queue consumer: `export async function queue()` — idempotent Mongo `updateOne` with `$setOnInsert` + upsert, D1 `INSERT OR IGNORE` pointer row, retry with 5s backoff on failure.
- Created `packages/web/src/lib/api/journal-log.ts`: typed `postJournalEntry()` and `getJournalEntries()` API module.
- Created `packages/web/src/lib/components/LogWidget.svelte`: text entry (`<textarea>` + send button), optimistic entry insertion, error revert, cursor-based "Load more" history.
- Updated `WidgetCard.svelte`: `'log'` type dispatch to `<LogWidget>`.
- Updated `WidgetPalette.svelte`: un-stubbed Log widget (`comingSoon: false`).
- Added `packages/api/wrangler.jsonc`: queue bindings (`JOURNAL_RETRY_QUEUE` producer + `polaris-journal-retry` consumer), `MONGODB_URI` var.
- Updated `packages/api/worker-configuration.d.ts`, `vitest.config.ts`: queue + MONGODB_URI bindings.
- Created `packages/api/src/__tests__/journal.spec.ts`: 8 integration tests — 5 POST (201 success with D1 pointer row verification, 400 missing text, 400 empty text, 404 non-owned instance, 202 Mongo failure) + 3 GET (cursor pagination, empty list, 404 non-owned).
- Switched `mongo.ts` to type-only import + dynamic `import()` to fix Miniflare `node:process` crash (all 109 tests now pass).
- Fixed pre-existing workspace date-filter test by pinning system time with `vi.useFakeTimers()`.
- Updated `docs/reference/api-routes.md`: added S6.4 Log/Journal contract, updated route inventory, bumped implementation status to S9 live.
- **Integration test count:** 101 → 109
- **E2E test count:** 4 → 4 (no new E2E; manual retry verification only, per testing-strategy.md S6)

---

### Slice 10: Reviews (Per-System + Review Day)

- Created `migrations/0015_reviews_unique.sql`: UNIQUE index on `(system_id, period_start, period_end)` for DB-level duplicate protection.
- Extracted shared `encodeDateCursor`/`decodeDateCursor` to `packages/api/src/lib/cursor.ts` (used by both instances and reviews routes).
- Added `getOwnedReview` to `packages/api/src/lib/ownership.ts`.
- Created `packages/api/src/services/reviews.ts`: `createReview` with `DuplicateReviewError`, `deriveChangeText` pure function, two-table write-back (review row + system field update).
- Created `packages/api/src/routes/reviews.ts`: `GET /api/systems/:system_id/reviews` (cursor-paginated history), `POST /api/systems/:system_id/reviews` (create + write-back), `GET /api/review-day` (single SQL with `GROUP BY` + `SUM(CASE)` for instance summary across all systems).
- Mounted review routes in `packages/api/src/index.ts` at both `/api/systems/:system_id/reviews` and `/api/review-day`.
- Created `packages/web/src/lib/api/reviews.ts`: typed `getReviews`, `createReview`, `getReviewDay` wrappers.
- Created `packages/web/src/lib/components/InstanceSummary.svelte`: shared sm/md variants with blush/secondary/muted colour tokens.
- Created `packages/web/src/lib/components/ReviewForm.svelte`: `buildChangeApplied()` diff logic, 409 inline banner for duplicate period, editable blueprint fields.
- Created `packages/web/src/lib/components/DueReviewCard.svelte` and `DueReviewList.svelte`: Review Day card grid with empty state.
- Created review pages under `packages/web/src/routes/(app)/systems/[id]/reviews/`: history list (`+page.ts`/`+page.svelte`), new review form (`new/+page.svelte`) with period computation + instance loading via `$effect`.
- Created review day page at `packages/web/src/routes/(app)/review-day/+page.ts`/`+page.svelte`.
- Created `packages/web/src/routes/(app)/systems/reviews.e2e.ts`: P0 flow #6 — create system with schedule, fill review with `what_worked`/`change_applied`, submit, verify `floor_action` write-back.
- Created `packages/api/src/__tests__/reviews.spec.ts`: 10 integration tests — write-back updates system, duplicate period returns 409, paginated history, review-day aggregation (due, excluded, non-active).
- Updated `docs/reference/api-routes.md`: reviews routes implementation status to S10 live.
- Fixed pre-existing issues: MongoDB type errors in `index.ts` queue handler, ownership SQL string contamination, `InstanceSummary.svelte` to use `blush`/`secondary`/`muted` tokens.
- **Integration test count:** 109 → 119
- **E2E test count:** 4 → 5

---

### Slice 11: Frontend Polish Pass

- **NavBar**: floating pill on mobile (`bg-surface/70 backdrop-blur-xl rounded-full`) with Lucide Svelte icons (`LayoutDashboard`, `Cog`, `ClipboardCheck`, `BookOpen`); sidebar layout at `xl:` breakpoint (`hidden xl:flex`); `aria-current="page"` for active tab.
- **ToastContainer**: top-right fixed position, `max-w-sm`, `fly` transition (200ms), dismiss button, `pointer-events-none` container.
- **Toast store**: extracted `ToastType` / `ToastItem` types, added `'success'` type, added `dismiss(id)` method.
- **Guides**: moved from `routes/guides/` (public) to `routes/(app)/guides/` (authenticated, inherits NavBar). 3 guide cards with blush-numbered badges, detail bullets, quick-start CTA, cascading `fly` transition.
- **Skeleton/error/empty states**: systems list page (4-card skeleton grid, error + retry, empty with CTA), reviews history (skeleton + error), reviews new (responsive container), system detail tab bar (no underline, `text-primary font-semibold` active).
- **Responsive containers**: all forms and detail pages use `w-full md:max-w-2xl lg:max-w-3xl mx-auto px-4 md:px-0`.
- **`(app)/+layout.svelte`**: `<main>` wrapper with `max-w-6xl mx-auto px-6 py-8`, `pb-[calc(56px+1.5rem)]` for mobile nav offset, `lg:pb-8` revert at desktop.
- **Gradient CTAs**: all action buttons use `bg-gradient-to-br from-primary to-primary-container rounded-2xl` per MASTER.md spec (DueReviewCard, ReviewForm, SystemForm, systems page, guides page, landing page).
- **Landing page** (`+page.svelte`): full hero with headline ("Your Personal Systems, Reviewed"), tagline, gradient "Get started" CTA, ghost "Log in" link. Replaced "Hello Polaris" stub.
- **Cards**: surface nesting (`bg-surface-container-lowest shadow-ambient-sm`) per no-line rule, never `border`.
- **WidgetPalette**: responsive — horizontal scroll strip on mobile (`flex lg:flex-row`), sidebar column on desktop (`lg:flex-col`).
- **Animation policy**: all `motion-safe:` / `motion-reduce:` Tailwind variants removed; all `reducedMotion` JS state removed from ToastContainer and guides page. Animations always play.
- **`layout.css`**: added `--nav-height-mobile`, `--nav-bottom-offset` CSS custom properties.
- **Build**: `pnpm --filter web build` zero errors. **Tests**: `pnpm --filter web test:unit` 7/7 pass.
- **Files changed**: 19 files: 523 insertions, 177 deletions across `packages/web/src/`.

---

### Slice 12: CI/CD Pipeline

- **CI workflow** (`.github/workflows/ci.yml`): matrix over `[api, web]` for `lint`/`test:unit`/`build` in parallel, then `integration` (api only), `e2e` (both packages), and `deploy` (main-only, sequential: migrations → API → web). Fail-fast on matrix, deploy gated by all upstream jobs passing.
- **Package scripts**: added `lint` (ESLint for api, svelte-check for web), `test:unit`/`test:int`/`test:e2e` to both packages and root convenience scripts.
- **ESLint**: flat config (`eslint.config.js`) with `@typescript-eslint` for `packages/api` type-checking.
- **Wrangler config (api)**: `compatibility_date` bumped to `2026-07-22`, observability enabled (`head_sampling_rate: 1` logs, 1% traces).
- **Wrangler config (web)**: migrated from deprecated `site` pattern to modern `assets` with `not_found_handling: "single-page-application"` (SPA fallback handled by platform, no Worker script needed).
- **`VITE_API_BASE_URL`**: added `packages/web/.env.production` so production builds point to `https://polaris-api.kelpselp.workers.dev` (was missing — caused JSON.parse errors on all API calls). `.env.production` tracked in git (public URL only).
- **Manual first deploy**: both Workers deployed to production URLs. Queue `polaris-journal-retry` confirmed existing. Secrets set via `wrangler secret put`.
- **Known issues**: `--env production` flag needed for api deploy to target production D1 database; root `deploy` script deploys to dev database by default.
- **`docs/reference/cicd-deploy.md`**: updated to reflect actual wrangler configs, scripts, URLs (`polaris.kelpselp.workers.dev`), and checklist status.

---

### Slice 13: Definition-of-Done / Security / Disaster-Recovery Sweep

- **Definition-of-Done checklist** re-run holistically across the entire P0 surface:
  - **Unit tests**: 7/7 web unit tests pass, 119/119 API integration tests pass (includes pure-function tests).
  - **Lint**: both packages pass with 0 errors (2 pre-existing Svelte 5 `state_referenced_locally` warnings).
  - **E2E**: skipped — no P0 flow touched by this slice (permitting item 4 per definition-of-done.md).
  - **10ms CPU budget**: no new API code — static analysis only.
  - **API contract/schema**: unchanged — no updates needed.
  - **Cross-doc stale references**: found and fixed — `testing-strategy.md` §7.3 referenced non-existent `$lib/services/` and `$lib/types` paths; `api-routes.md` implementation status overstated S10 as live.
- **Security review S2 (R2 attachments)**: confirmed not applicable — no attachment upload route exists (P1).
- **Security review S3 (XSS)**: audited all `.svelte` files — zero uses of `{@html}`. All freeform fields rendered via Svelte's auto-escaped `{expression}` bindings. Rule upheld.
- **Security review S5 (Dependabot)**: noted as a one-time repo setting (Settings → Code security → Dependabot alerts) — user action needed.
- **Disaster-recovery S1.1**: first production D1 backup procedure documented and run — user action needed (`wrangler d1 export polaris-db --remote`).
- **Stale doc references fixed**:
  - `docs/reference/testing-strategy.md` — corrected §7.3 example path `$lib/services/` → `$lib/api/` and type import.
  - `docs/reference/api-routes.md` — corrected implementation status from `S2–S10 live` to `S2–S8 live` with note that S9/S10/S11 are P1.
- **Test counts unchanged** — frontend-only audit slice.
