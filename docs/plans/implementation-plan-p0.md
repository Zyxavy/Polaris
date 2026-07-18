# Polaris — P0 Implementation Plan

**Implementation status:** Current

**Scope:** P0 only, per PRD S7 — Auth, System Creator (manual), Schedules, Instance auto-generation (lazy + nightly cron), Dashboard (full/floor/missed), Workspace with Timer/Counter/Log/Checklist widgets, per-System Review, Review Day.

**Explicitly deferred to a later pass (P1/P2 — do not build yet):** AI-assisted creation, built-in/user templates, Link List / Streak / Progress Chart / Notes widgets, R2 attachments, `/account` recovery-code settings polish beyond what auth needs, CI matrix optimization.

**How to use this doc:** each slice is a vertical feature, ends in a mergeable PR, and is fully working (backend + frontend + tests) before you start the next one. I The Agent (Opencode, Claude, etc.) will review each PR against the docs — paste me the diff or ask me to re-read a slice before you open the PR.

---

## Branch & PR Conventions (from AGENTS.md)

- `main` is stable. No direct pushes — every slice is a PR, even self-reviewed.
- One branch per vertical slice: `feat/<slice-name>` (or `chore/<slice-name>` for infra-only slices).
- Commits: `type(scope): short description` — types `feat|fix|docs|refactor|test|chore`, scope `api|web|d1|infra|docs`.
- Every PR must satisfy `docs/reference/definition-of-done.md` before merge. I've folded the relevant checks into each slice below so you don't have to cross-reference constantly.
- **Ask before adding any dependency** not already on the pre-approved list in AGENTS.md.

---
<!-- 
## Slice 0 — Repo & Cloud Bootstrap

**Branch:** `chore/bootstrap`
**Docs:** ADR 001 S5.10, `cicd-deploy.md` S9.1 (first-time setup checklist), `cicd-deploy.md` S2.2–2.3

You said pnpm is ready but wrangler isn't initialized and Atlas isn't set up. Do this first, once, outside the vertical-slice loop — it has no tests of its own.

### Tasks

1. Install wrangler as a dev dependency once the monorepo exists (done in Slice 1) — don't install globally, per pnpm-workspace convention.
2. Cloudflare resources (via `wrangler` CLI, run from `packages/api` once scaffolded):

   ```bash
   wrangler d1 create polaris-db-dev
   wrangler d1 create polaris-db
   wrangler r2 bucket create polaris-attachments   # created now even though unused until P1, cheap and matches ADR S5.7 scope
   wrangler r2 bucket create polaris-backups       # for disaster-recovery.md S1.1
   wrangler queues create polaris-journal-retry
   ```

   Record the returned `database_id` values — you'll paste them into `wrangler.jsonc` in Slice 1.
3. MongoDB Atlas: create a free M0 cluster, a database user, and get the connection string. Don't put it anywhere in git — you'll set it via `wrangler secret put` once the API worker exists (Slice 9, when the Log widget needs it). For local dev, you'll run Mongo in Docker instead (`docker run -d -p 27017:27017 --name polaris-mongo-dev mongo:7`) — do this now if Docker is available, or defer until Slice 9.
4. GitHub repo: confirm branch protection on `main` (require PR, no direct push) since AGENTS.md mandates this — this is a GitHub setting, not code.
5. Do **not** set `CLOUDFLARE_API_TOKEN` as a GitHub Actions secret yet — that's Slice 12 (CI/CD), once there's something to deploy.

### Definition of Done for this slice

- [x] Two D1 databases exist (`polaris-db-dev`, `polaris-db`), IDs recorded somewhere safe (not committed).
- [x] R2 buckets and the Queue exist.
- [x] Atlas cluster reachable (test with `mongosh "<connection-string>"` once you have it).
- [x] Branch protection enabled on `main`.

No PR needed for this slice — it's infra, not code. Move straight to Slice 1.

---

## Slice 1 — Monorepo Scaffolding

**Branch:** `chore/monorepo-scaffold`
**Docs:** ADR 001 S5.10 (project structure), S5.2 (SvelteKit CSR), S5.3 (Hono)

### Tasks

1. Root setup:

   ```bash
   pnpm init
   ```

   Create `pnpm-workspace.yaml`:

   ```yaml
   packages:
     - "packages/*"
   ```

2. Scaffold `packages/api` (Hono on Workers):

   ```bash
   cd packages/api
   pnpm create hono@latest . --template cloudflare-workers
   ```

   Confirm `wrangler.jsonc` matches the shape in `cicd-deploy.md` S2.2 — d1_databases, r2_buckets, queues, ai binding, cron trigger (`0 15 * * *`), and `[env.development]` / `[env.production]` blocks. Paste in the D1 database IDs from Slice 0. **Skip the `[ai]` binding and Queue binding wiring for now** — those come in Slice 9 with the Log widget; adding them now with nothing consuming them just invites drift. Do add the D1 and R2 bindings now since Slice 2 needs D1 immediately.
3. Scaffold `packages/web` (SvelteKit, CSR-only):

   ```bash
   cd packages/web
   pnpm create svelte@latest .
   ```

   Then per `sveltekit-route-architecture.md` S8.3, install `@sveltejs/adapter-static` and configure it exactly as shown there (`fallback: 'index.html'`). Set `export const ssr = false; export const prerender = false;` in the root `+layout.ts` per S1.
4. Tailwind CSS in `packages/web` per `design-system/polaris/MASTER.md` — install Tailwind v4, wire the `data-theme` attribute strategy, add the color palette table from MASTER.md into `tailwind.config.js` (or CSS `@theme` block if using Tailwind v4's CSS-first config — confirm against the installed Tailwind version's docs, don't guess).
5. Root `package.json` scripts per `cicd-deploy.md` S3.1:

   ```jsonc
   { "scripts": {
       "deploy": "pnpm -r deploy",
       "deploy:migrations": "cd packages/api && wrangler d1 migrations apply DB",
       "deploy:api": "cd packages/api && wrangler deploy",
       "deploy:web": "cd packages/web && wrangler deploy"
   }}
   ```

6. Vitest in both packages (empty config for now, real tests start Slice 2) per `testing-strategy.md` S2.1–2.2.
7. Vite dev proxy in `packages/web/vite.config.ts` per `sveltekit-route-architecture.md` S8.1.
8. `.gitignore`: `node_modules`, `.wrangler`, `build`, `.env*`.

### Definition of Done

- [x] `pnpm -r build` succeeds for both packages (even if just placeholder pages).
- [x] `wrangler dev` in `packages/api` boots with no binding errors (D1 + R2 bound, AI/Queue not yet added).
- [x] `pnpm dev` in `packages/web` boots and proxies `/api/*` to `:8787`.
- [x] Tailwind classes render (spot-check one page with a `bg-surface` div).
- [x] No test suite yet — this slice has no logic to test, just scaffolding. State this explicitly in the PR per Definition of Done's exception table.

**PR:** `chore/monorepo-scaffold` → `main`. -->
<!-- 
---

## Slice 2 — D1 Schema Foundation (P0 tables only)

**Branch:** `feat/d1-schema`
**Docs:** D1 Schema ADR (002) — full document is your source of truth here. `testing-strategy.md` S2.2 for the integration test setup.

Only migrate the tables P0 actually needs. Skip `attachments` (0011), skip the built-in template seed (0012) — the empty `templates` table is still needed for the FK, but no seed data yet since templates-as-a-feature is P1.

### Migration files to create (in this order, per D1 Schema S6.2)

```
packages/api/migrations/
├── 0001_enable_foreign_keys.sql
├── 0002_systems.sql
├── 0003_schedules.sql
├── 0004_templates.sql        # table only, no seed rows yet
├── 0005_instances.sql
├── 0006_workspaces.sql
├── 0007_counter_logs.sql
├── 0008_timer_sessions.sql
├── 0009_widget_entries.sql
├── 0010_reviews.sql
└── 0013_recovery_codes.sql   # numbered 0013 to match the doc's final plan; the gap (0011/0012) is intentional and filled in later slices
```

Copy each `CREATE TABLE` statement verbatim from D1 Schema ADR S3.1–3.7, S2.1 (`recovery_codes`), and S6.1 (the `PRAGMA foreign_keys = ON` in `0001`). Don't hand-modify column types or constraints — if something looks wrong, flag it to me before deviating; the schema doc is deliberately the single source of truth other docs reference.

**Note on `systems.template_origin`:** it references `templates(id)`. Since `0004_templates.sql` creates an empty table with no rows in P0, `template_origin` will always be `NULL` in this phase — that's fine, the column and FK just sit unused until the P1 templates slice populates the table.

### Auth tables

Don't hand-write `user`/`session`/`account`/`verification` — those come from the Better Auth CLI in Slice 3. Skip them here.

### Tasks

1. `wrangler d1 migrations create DB <name>` for each file above (creates the empty, correctly-numbered file).
2. Hand-write the SQL in each, from the ADR.
3. Apply locally: `wrangler d1 migrations apply DB --local`.
4. Set up `packages/api/vitest.config.ts` with `@cloudflare/vitest-pool-workers` per `testing-strategy.md` S2.2, pointed at the same `wrangler.jsonc`, D1 in-memory seeded from these migration files.
5. Write a smoke integration test: insert a `systems` row (with a fake `user_id` string — Better Auth's `user` table doesn't exist yet, so skip the FK check for now by disabling `PRAGMA foreign_keys` in this one test, or stub a `user` row manually with the same shape Better Auth will create later). Read it back. Confirm `UNIQUE(system_id, date)` on `instances` throws on duplicate insert (this is the idempotency guarantee Slice 6/7 depend on — verify it now while it's cheap).

### Definition of Done

- [x] All 11 migration files apply cleanly, in order, to a fresh local D1.
- [x] `PRAGMA foreign_keys` confirmed ON (assert in a test, per D1 Schema S6.1's explicit call-out).
- [x] Integration test for the `instances` UNIQUE constraint passes.
- [x] `pnpm test:integration` passes.
- [x] No route/API code yet, this slice is schema-only. State "no API contract change" in the PR.

**PR:** `feat/d1-schema` → `main`. -->

<!-- ---

## Slice 3 — Auth (Better Auth + Recovery Codes)

**Branch:** `feat/auth`
**Docs:** `auth-integration.md` (full doc), ADR 001 S5.6, `security-review.md` S1 and S4.

This is the first slice with a real end-to-end vertical: sign-up → session → sign-in → sign-out, plus the recovery-code fallback (since there's no email provider, per `auth-integration.md` S5).

### Backend tasks

1. `pnpm add better-auth` in `packages/api` (pre-approved dep per AGENTS.md). Confirm the current D1 adapter package name/import against Better Auth's own docs before writing `auth.ts` — the doc explicitly flags this as having moved between versions; don't trust the snippet in `auth-integration.md` S1.1 blindly, verify it.
2. `packages/api/src/auth.ts` — `createAuth(env)` factory per S1.1.
3. Generate Better Auth's own tables via its CLI (not hand-written):

   ```bash
   npx @better-auth/cli generate --config packages/api/src/auth.ts --output packages/api/migrations/
   ```

   Apply locally, confirm `user`/`session`/`account`/`verification` tables exist.
4. Mount `/api/auth/*` in `packages/api/src/index.ts` per S1.2.
5. `requireAuth` middleware per S1.3, applied to all of `/api/*` except `/api/auth/*`.
6. `recovery_codes` table already exists from Slice 2 (migration `0013`) — implement the sign-up flow's code generation (`POST /api/recovery-codes/generate`) and display (`GET /api/recovery-codes`) per S5.2. Code format `POLARIS-XXXX-XXXX` via `crypto.randomUUID()` truncation — no external dependency.
7. `POST /api/auth/recover` custom route per S5.2, registered **before** the Better Auth catch-all — copy the handler logic from S5.2 (email lookup → recovery code match → mark used → hash new password via Better Auth's exported hash function → update `account.password`).
8. Rate-limiting: per `security-review.md` S1, no lockout counter is required for v1 (risk accepted) — don't build one now, it's explicitly deferred.

### Frontend tasks

1. `packages/web/src/lib/auth-client.ts` per S4.1.
2. `(auth)` route group: `sign-up/+page.svelte`, `sign-in/+page.svelte` per `design-system/polaris/pages/sign-in.md` and `sign-up.md`. Include the recovery-codes modal shown once at sign-up (sign-up.md's modal spec) — this is the user's only chance to save them before they scroll past.
3. `(auth)/+layout.svelte` — auth guard redirecting signed-in users to `/guides` per `sveltekit-route-architecture.md` S3.4. (`/guides` itself doesn't need to exist yet with real content — a placeholder page satisfies this slice; full Guides content can be a small follow-up, it's static and low-risk.)
4. `(app)/+layout.ts` auth guard per S3.3 — redirects to `/sign-in` if no session. You'll need at least a placeholder `(app)/+layout.svelte` nav shell (can be minimal — full NavBar polish is fine to defer to Slice 11).
5. `apiFetch` wrapper (`packages/web/src/lib/api/client.ts`) per `sveltekit-route-architecture.md` S6 — every future slice's frontend depends on this existing correctly now, including `credentials: 'include'`.

### Tests

- **Integration (`@cloudflare/vitest-pool-workers`):** sign-up → session cookie set → `GET /api/systems` (once it exists, or a stub authenticated route) returns 200; sign-out invalidates session; unauthenticated request to a guarded route returns 401; recovery flow: generate codes → use one → verify old password no longer works, new one does → verify used code can't be reused.
- **Unit:** recovery code format generator (regex match `POLARIS-[A-Z0-9]{4}-[A-Z0-9]{4}`).
- **E2E (Playwright, P0 flow #1 from `testing-strategy.md` S3.3):** sign up → lands on `/guides` → sign out → sign in → lands on `/dashboard` (dashboard can 404/placeholder at this point, just confirm the redirect target).

### Definition of Done

- [x] All auth integration tests pass against real D1 (Miniflare).
- [x] CSRF/`trustedOrigins` verified end-to-end in dev (sign up via the Vite proxy, confirm cookie is set — `auth-integration.md` S3 flags this as an easy-to-miss dev-only failure).
- [x] `sameSite: lax` cookie config confirmed (check DevTools Application tab).
- [x] E2E flow #1 passes.
- [x] Update `auth-integration.md` only if you deviate from it (e.g. the D1 adapter import path — document what you actually found).

**PR:** `feat/auth` → `main`. -->

<!-- ---

## Slice 4 — Systems CRUD (System Creator, manual only)

**Branch:** `feat/system-creator`
**Docs:** PRD S5.1, S6.1 (flow 1 only — "from scratch"; skip flows 2/3, templates and AI), `api-routes.md` S2, D1 Schema S5 (autosave/`floor_action` resolution), `design-system/polaris/pages/system-creator.md` (minus the Template Picker and AI Draft panel sections — don't build those yet), `sveltekit-route-architecture.md` S7.2.

### Backend tasks

1. `packages/api/src/routes/systems.ts`:
   - `GET /api/systems` (`?status=` filter) — S2.1
   - `POST /api/systems` — S2.2 (accept `template_origin` in the payload shape for forward-compatibility, but the frontend never sends it yet since there's no template picker)
   - `GET /api/systems/:id` — ownership-scoped
   - `PATCH /api/systems/:id` — S2.3, partial update, `floor_action: ""` accepted (autosave-safe)
   - `POST /api/systems/:id/confirm` — S2.4, the one place `floor_action` non-empty is enforced
   - `POST /api/systems/:id/archive` — S2.5
   - Skip `POST /api/systems/:id/save-as-template` (P1 — templates feature).
2. `packages/api/src/lib/ownership.ts` — `getOwnedSystem` helper per `api-routes.md` S1.5 (Systems is the one resource that's directly `user_id`-scoped, but you'll reuse this ownership pattern in every later slice, so build it properly now).
3. Response envelope and error shape exactly per S1.3/S1.4 (`{error, message}`, `barrier_list` returned as parsed JSON array not raw string). -->

<!-- ### Frontend tasks

1. `SystemForm.svelte` per `component-inventory.md` — Purpose, Floor Action + Trigger, Barriers & Environment, Schedule field-groups. **Schedule field group can be a stub for now** (real `SchedulePicker` wiring happens in Slice 5) — just don't block the form on it.
2. Debounced autosave: first tick calls `POST /api/systems` (no id yet), subsequent ticks call `PATCH /api/systems/:id`, per `api-routes.md` S2.2 and `system-creator.md`'s autosave section. Export `AUTOSAVE_DEBOUNCE_MS` as a named constant (testing-strategy.md S4.1 requires this for fake-timer tests).
3. `/systems/new/+page.svelte` — mounts `SystemForm`, no template picker / AI panel yet (defer those `<details>` and AI sections from the design doc).
4. "Confirm system" button calls `POST /api/systems/:id/confirm`, surfaces `floor_action_required` (422) as an inline field error per `loading-states.md` S2.3.
5. `/systems/+page.svelte` — Systems List per `design-system/polaris/pages/systems-list.md` (the streak-count footer can show `0`/hide until Slice 6 gives you real instance data).
6. `/systems/[id]/+layout.ts` + `+layout.svelte` (tab shell) and `/systems/[id]/+page.svelte` (Overview tab) per `sveltekit-route-architecture.md` S2.2 and `design-system/polaris/pages/system-detail.md`. Workspace/Reviews tabs can 404/placeholder — those are Slices 8 and 10.
7. `/systems/[id]/edit/+page.svelte` reusing `SystemForm` pre-filled, per `system-edit.md`. -->

<!-- ### Tests

- **Unit:** autosave debounce (fake timers, per `testing-strategy.md` S4.1 exactly). Form validation (name required).
- **Integration:** System CRUD full cycle (create → read → update → archive) per `testing-strategy.md` S3.2's "System CRUD" bullet. `POST .../confirm` rejects empty `floor_action` with 422, accepts non-empty.
- **E2E (P0 flow #2):** click "New System" → fill required fields → save → confirm → system appears in Systems List.

### Definition of Done

- [ ] All CRUD routes ownership-scoped and tested.
- [ ] `floor_action` empty-string-during-draft / required-on-confirm behavior verified by a test, not just manually.
- [ ] 10ms CPU note in PR: single-row CRUD, no loops — "one indexed SELECT/INSERT per call, no loop, no batch needed."
- [ ] E2E flow #2 passes. -->

<!-- **PR:** `feat/system-creator` → `main`. --> 

---

<!-- ## Slice 5 — Schedules (Completed)

**Branch:** `feat/schedules`
**Docs:** PRD S5.2, D1 Schema S3.2, `api-routes.md` S3, `component-inventory.md`'s `SchedulePicker.svelte` spec.

Small, focused slice — wires the stub from Slice 4 into something real.

### Backend

1. `packages/api/src/routes/schedules.ts`: `GET`/`POST /api/systems/:system_id/schedules`, `PATCH`/`DELETE /api/schedules/:id`, all ownership-scoped through `systems.user_id` per S1.5.
2. Validate `time_window_end > time_window_start`, return `422 invalid_window` on failure per S3.
3. `days_of_week` bitmask handling — wrote (and unit-tested) `dayToBit`, `encodeDaysToBitmask`, `decodeBitmaskToDays`, `dayMatchesBitmask` in `packages/api/src/lib/calendar.ts`. Slice 6 (Dashboard) and Slice 7 (Cron) both need it; building it here, isolated and unit-tested, avoids duplicating logic later.

### Frontend

1. Real `SchedulePicker.svelte` — day-of-week grid + start/end time inputs, self-manages its own CRUD calls via the schedules API module.
2. Wired into `SystemForm`'s Schedule section (replacing the Slice 4 stub).

### Tests

- **Unit (24 tests):** `dayToBit` (4 boundary positions), `encodeDaysToBitmask` (5 cases including empty), `decodeBitmaskToDays` (6 cases including round-trip), `dayMatchesBitmask` (9 cases across bit patterns 0, 21, 127). Pure functions — no D1 needed, per `testing-strategy.md` S7.3.
- **Integration (12 tests):** create schedule (success + 422 invalid window + missing days_of_week + out-of-range bitmask + non-owned system 404), list schedules (success + non-owned 404), patch schedule (update + invalid window + non-owned 404), delete schedule (success + non-owned 404).

### Definition of Done

- [x] Bitmask helpers unit-tested for every bit position, empty, full, and round-trip.
- [x] Integration tests for all 4 routes pass (12 tests, plus 24 calendar unit tests = 36 new tests).
- [x] System Creator form now round-trips a real schedule end-to-end (manual smoke test + E2E flow #2 still passes with schedule data attached).

**PR:** `feat/schedules` → `main`. -->

---

<!-- ## Slice 6 — Dashboard & Instances (lazy generation)

**Branch:** `feat/dashboard`
**Docs:** PRD S5.3, S6.3, `api-routes.md` S4.1–4.4 (the generation-logic SQL is copy-this-closely, it's already CPU-budget-optimized), `design-system/polaris/pages/dashboard.md`, `loading-states.md` (Dashboard rows).

This is the highest-value P0 slice — the daily-use loop.

### Backend

1. `packages/api/src/services/instances.ts` — `generateTodayInstances` per `testing-strategy.md` S7.3's example, using the exact 3-step SQL pattern from `api-routes.md` S4.1 (bitmask match in SQL, `D1.batch()` for inserts, no JS loop over rows). Uses `dayMatchesBitmask`... actually note: the SQL does the bitmask match directly (`sch.days_of_week & ? != 0`), so you don't call the JS helper here — that helper is for the Cron job's date math and any place that can't push it into SQL. Don't reintroduce a JS loop by mistake.
2. `toManilaDate(utcDate)` / a "today in Manila" helper in `packages/api/src/lib/calendar.ts` — unit-tested independently per `testing-strategy.md` S3.1.
3. `GET /api/dashboard` route: run lazy generation, then the filtered SELECT (window-gated) per S4.1. Catch `UNIQUE constraint failed` from a duplicate insert attempt and treat as no-op, not a 500 (per D1 Schema S3.3's note).
4. `GET /api/instances/:id`, `PATCH /api/instances/:id` (state transitions, `pending` never a valid target value) per S4.2–4.3.
5. `GET /api/systems/:system_id/instances` (paginated) per S4.4 — needed for the System Detail streak view and later for Reviews.

### Frontend

1. `dashboard-store.ts` (Svelte 5 runes class) exactly per `sveltekit-route-architecture.md` S5.2 — optimistic update with rollback on `markState`.
2. `InstanceList` / `InstanceCard` / `StateButtons` per `component-inventory.md` and `dashboard.md`'s bento grid + status header spec.
3. Dashboard skeleton loader per `loading-states.md` S1.2 (bento card rectangles, no full-page spinner).
4. Empty state ("Set up your first system") per `loading-states.md` S3.2.
5. Wire the Systems List's streak footer (stubbed in Slice 4) to real instance counts now that `GET /api/systems/:system_id/instances` exists.

### Tests

- **Unit:** `toManilaDate` conversion across a UTC-midnight boundary (per `testing-strategy.md` S4.4 — pin `vi.setSystemTime()` away from midnight for other tests, but write one test specifically crossing it).
- **Integration:** idempotency test exactly as specified in `testing-strategy.md` S4.3 (call `generateTodayInstances` twice, assert no duplicate). Instance state transition test (`pending → full`, `updated_at` changes). Window-gated filter test (a system whose window hasn't opened yet is generated but excluded from the Dashboard response).
- **E2E (P0 flow #4):** open Dashboard → today's Instance present as `pending` → mark `full` → state updates without reload → mark a second system `floor`.

### Definition of Done

- [x] Idempotency test passes (this is the single most load-bearing test in the app — both the lazy path and Slice 7's Cron path depend on it).
- [x] 10ms CPU note: confirm via `wrangler tail` CPU field on a real/local call, note the ms in the PR (Definition of Done S5's explicit ask, not optional for this route).
- [x] Dashboard renders with skeleton, not spinner.
- [ ] E2E flow #4 passes. -->

<!-- **PR:** `feat/dashboard` → `main`. -->

---

<!-- ## Slice 7 — Nightly Cron Instance Pre-generation

**Branch:** `feat/cron-instance-pregeneration`
**Docs:** ADR 001 S5.8, PRD S5.3 (path 2), `testing-strategy.md` S4.3 (Cron idempotency test), `cicd-deploy.md` S2.2 (`[triggers] crons = ["0 15 * * *"]`).

Small slice, reuses Slice 6's service function almost entirely — mostly wiring a `scheduled` export.

### Tasks

1. `tomorrowManilaDate()` helper in `calendar.ts`, unit-tested.
2. `scheduled` export in `packages/api/src/index.ts`, calling the same `generateTodayInstances`-shaped logic but bound to tomorrow's date across **all users** (not scoped to one session — this runs with no request context). Confirm the D1 query in `api-routes.md` S4.1 generalizes correctly when there's no `user_id` in scope — you'll query across all active systems, not just one user's, since this is a background job. (For a single-user personal app this is nearly the same thing, but write the SQL correctly regardless — `WHERE s.status = 'active'`, no `user_id` filter.) 
3. Add the `[triggers]` block to `wrangler.jsonc` (was deferred in Slice 1).
4. Local testing: Miniflare's `wrangler dev --test-scheduled` or invoking the `scheduled()` export directly in an integration test with a real D1 binding and a mocked `env` — per `testing-strategy.md` S3.2's "Nightly Cron handler" bullet.

### Tests

- **Integration:** invoke `scheduled()` twice for the same target date, assert no duplicate Instances (same idempotency pattern as Slice 6, just via the cron entry point). Verify it only touches `date = tomorrow`, never today's date.

### Definition of Done

- [ ] Cron idempotency test passes.
- [ ] Confirmed the lazy path (Slice 6) still works standalone if you simulate the Cron never having run — this is the "safety net" property ADR 001 S5.8 requires, worth an explicit test or at least a manual check.
- [ ] `wrangler tail` shows a `[cron]`-tagged log line locally (per `observability.md` S3.3/S4.2) — add the logging convention now, don't defer it, since Slice 6 should already have `[api]`/`[d1]` prefixes established.

**PR:** `feat/cron-instance-pregeneration` → `main`. -->

---

## Slice 8 — Workspace + D1-backed Widgets (Timer, Counter, Checklist)

**Branch:** `feat/workspace-core-widgets` 
**Docs:** PRD S5.4–S5.5, D1 Schema S3.3.1 + S3.4, `api-routes.md` S5–S6.1/6.2/6.3, `design-system/polaris/pages/workspace-builder.md`, `component-inventory.md` (Workspace components).

The Log/Journal widget (Mongo-backed) is deliberately split into its own slice (9) — everything here is D1-only, which keeps this slice's infra surface small.

### Backend

1. `PUT`/`GET /api/systems/:system_id/workspace` per S5 — full-layout replace, server-side `layout.v` enforcement (`upgradeLayout()` stub is fine now since only `v: 1` exists; write the function so it's a no-op today but has the right signature for future version bumps).
2. `POST /api/instances/:instance_id/counter-logs`, `GET /api/widgets/:widget_id/counter-logs`, `DELETE /api/counter-logs/:id` — S6.1.
3. Same pattern for timer-sessions — S6.2.
4. `PUT`/`GET /api/instances/:instance_id/checklist/:widget_id` — S6.3.
5. `workspace_snapshot` on Instance: compute-on-read per D1 Schema S3.3.1 (query the three logging tables `WHERE instance_id = ?`, don't try to keep it denormalized-and-synced from day one — that's an optimization, not correctness).

### Frontend

1. `WidgetPalette`, `WorkspaceCanvas` (using `svelte-dnd-action`, pre-approved dep), `WidgetCard` type-dispatch, `SaveBar` per `workspace-builder.md`.
2. `TimerWidget`, `CounterWidget`, `ChecklistWidget` components — only these three plus the Slice 9 Log widget populate the palette in P0; the palette list itself can already show all 8 types from the catalog with the P1 ones disabled/grayed, or just list only the 4 P0 types — your call, but if you show all 8, the non-P0 ones must not be selectable (don't half-wire a broken widget type).
3. `workspace-editor-store.ts` (Svelte 5 runes class) exactly per `sveltekit-route-architecture.md` S5.3.
4. `/systems/[id]/workspace/+page.svelte`.

### Tests

- **Unit:** `upgradeLayout()` no-op behavior for `v: 1` (even though there's nothing to upgrade yet, the function's contract should be tested now so future version bumps have a baseline). Layout JSON serialization round-trip.
- **Integration:** R2 is *not* touched in this slice (attachments are P1) — skip that integration bullet from `testing-strategy.md` S3.2 for now. Do cover: PUT workspace layout → GET returns it unchanged; counter-log POST → GET aggregation returns correct SUM via `GROUP BY date()`; checklist PUT replaces (not appends) for the same `(instance_id, widget_id)`.
- **E2E (P0 flow #5, drag-and-drop excluded per `testing-strategy.md` S6):** open a system → open Workspace → add a Timer widget → add a Counter widget → save → reload → widgets still present. Skip the drag-reorder assertion (Playwright headless drag limitation, per the docs) — verify reorder logic only at the unit level (`workspace-editor.svelte.ts`'s `reorder()` method).

### Definition of Done

- [ ] Progress-chart-style aggregation query (`SUM ... GROUP BY date(created_at)`) tested — even though the Progress Chart *widget* is P1, the underlying counter-log aggregation query should already be correct since Counter is P0.
- [ ] Checklist replace-not-append behavior verified by test.
- [ ] E2E flow #5 (minus drag assertion) passes.

**PR:** `feat/workspace-core-widgets` → `main`.

---

(## Two open gaps you'll hit and should bring to me before building around them

1. **Log/Journal widget route contract** (Slice 9) — `api-routes.md` doesn't specify this endpoint despite Log being a P0 widget. Don't invent it silently; we should design it together so it stays consistent with the `PUT`-per-widget pattern used for Checklist/Notes.
2. **Queue-retry pointer-row timing** (Slice 9) — the docs describe the Mongo-write-then-D1-pointer sequence for the happy path clearly, but the retry-success case (where the Queue consumer needs to write *both* the Mongo document and the D1 pointer, since the original request already returned `202`) isn't fully specified. Worth 15 minutes of design discussion before you write that consumer.)

## Slice 9 — MongoDB + Log/Journal Widget

**Branch:** `feat/journal-widget-mongo`
**Docs:** ADR 001 S5.5, MongoDB Schema ADR (003) in full, `api-routes.md` (Log widget isn't separately listed there — it's the `widget_entries.entry_type = 'log_meta'` pointer pattern from D1 Schema S3.3.1, plus a Mongo-backed content route you'll add).

This is the one slice that touches infrastructure not yet exercised (Mongo driver, Queues consumer). Budget more time here than the line count suggests.

### Backend

1. `pnpm add mongodb` in `packages/api` (pre-approved per AGENTS.md).
2. Wire `MONGODB_URI` secret (`wrangler secret put MONGODB_URI` for prod; `mongodb://localhost:27017/polaris` for local dev per MongoDB Schema S8 — start the Docker container from Slice 0 if you haven't yet).
3. `journal_entries` collection — apply the validator from MongoDB Schema S3.1 once, locally, via `mongosh`.
4. A Log widget content route (design it consistent with the Checklist/Notes `PUT`-per-widget pattern already established — something like `POST /api/instances/:instance_id/journal/:widget_id` for a new entry, `GET /api/systems/:system_id/journal/:widget_id?...` for history). **This route isn't specified verbatim in `api-routes.md`** — that doc's S10/S11 inventory doesn't list a Log-widget-specific route, which looks like a gap in the docs rather than an intentional omission (Log is explicitly a P0 widget in the PRD). Flag this to me when you reach this slice and I'll help you design the exact contract consistent with the rest of S6 before you build it, rather than guessing.
5. Write path per ADR 001 S5.5 exactly: attempt direct Mongo write → on success, write the `widget_entries` pointer row (`entry_type: 'log_meta'`, `data: {"mongo_id": "..."}`) to D1 → 200. On Mongo write failure → enqueue to `polaris-journal-retry` → 202, D1 pointer row is **not** written yet (it can't be, you don't have the Mongo `_id`) — the Queue consumer must write both the Mongo document *and* the D1 pointer row on successful retry. This two-write coordination on the retry path isn't fully spelled out in the docs either — work through it with me before implementing, since getting the pointer-row timing wrong breaks the "seam" MongoDB Schema S2 describes.
6. Queue consumer (`queue` export in the same Worker) per ADR 001 S5.5 steps 4–5, retries with backoff, dead-letter queue is inspected manually (no code needed for that part).

### Frontend

1. `LogWidget.svelte` — text entry + history list.
2. Add it to the Workspace palette (now un-stub it from Slice 8).

### Tests

- **Unit:** the Mongo write path is mocked at the driver level (`vi.mock('mongodb')`) per `testing-strategy.md` S3.1/S4.2's Workers AI mocking pattern (same idea, different dependency) — Mongo isn't emulated by Miniflare, confirmed by `testing-strategy.md` S3.2/S6.
- **Manual (not automated, per docs):** verify a real write against your local Docker Mongo; verify the retry path by stopping the Docker container mid-test and confirming a `202` + eventual consistency once you restart it and the Queue consumer runs.

### Definition of Done

- [ ] Direct-write happy path unit-tested with a mocked driver.
- [ ] Manual verification of the retry path documented in the PR description (screenshot or `wrangler tail` log excerpt) — this is explicitly one of the few things the test suite can't cover per `testing-strategy.md` S6.
- [ ] `[mongo]`-tagged log lines present per `observability.md` S3.3.
- [ ] Update `api-routes.md` with the Log widget route contract you and I settle on — this is a real gap in the current doc, closing it satisfies Definition of Done S6/S7 (cross-doc consistency).

**PR:** `feat/journal-widget-mongo` → `main`.

---

## Slice 10 — Reviews (per-System) + Review Day

**Branch:** `feat/reviews`
**Docs:** PRD S5.7, S6.4, D1 Schema S3.6, `api-routes.md` S8, `design-system/polaris/pages/per-system-review.md` and `review-day.md`.

This is the slice that "closes the loop" per the product's core thesis — don't rush it.

### Backend

1. `POST /api/systems/:system_id/reviews` per S8.1 — the two-table write (insert `reviews` row, then conditionally `UPDATE systems` from `change_applied`). Implement as a `services/reviews.ts` function per `testing-strategy.md` S7.3 Rule 2 (cross-table write-back = service-layer logic, not inline route code).
2. `409` on duplicate period — check for an existing `reviews` row with matching `system_id` + `period_start`/`period_end` before insert.
3. `change_applied` derivation: structured object in → human-readable text out, with `change_applied_note` override, exactly per S8.1's format note.
4. `GET /api/systems/:system_id/reviews` (paginated).
5. `GET /api/review-day` per S8.2 — "due" computed server-side, no filter by the user's designated review day (convenience view, not a lock).

### Frontend

1. `InstanceSummary.svelte` (shared component, both `sm`/`md` variants) per `component-inventory.md` — build this once, use it in both Review Day and the per-system Review form.
2. `ReviewForm.svelte` per `per-system-review.md` — instance summary → reflection fields → editable blueprint fields → optional change note → submit. The blueprint fields are inline-editable text areas (not a diff UI), collected into the `change_applied` structured object on submit.
3. `/systems/[id]/reviews/+page.svelte` (history list) per `system-reviews.md`, `/systems/[id]/reviews/new/+page.svelte` (the form).
4. `/review-day/+page.svelte` per `review-day.md`, using `DueReviewList`/`DueReviewCard`.
5. 409 handling: inline banner per `loading-states.md` S2.3's table ("A review already exists for this period").

### Tests

- **Integration:** review write-back test exactly as specified in `testing-strategy.md` S3.2 ("POST a Review with `change_applied` containing a new `floor_action`; assert the parent System's `floor_action` field is updated"). Duplicate-period 409 test.
- **E2E (P0 flow #6):** open Review screen for a system → fill `what_worked`/`what_broke`/`change_applied` → submit → system's `floor_action` updated to the submitted value.

### Definition of Done

- [ ] Write-back integration test passes.
- [ ] 409 duplicate-period test passes.
- [ ] `InstanceSummary` genuinely shared (not copy-pasted) between Review Day and the per-system form — check this in your own PR before asking me to review.
- [ ] E2E flow #6 passes.

**PR:** `feat/reviews` → `main`.

---

## Slice 11 — Frontend Polish Pass

**Branch:** `feat/ui-polish`
**Docs:** `design-system/polaris/MASTER.md` (Pre-Delivery Checklist at the bottom), `loading-states.md` (full doc), `layout-specs.md`, `responsive-specs.md`.

By now every P0 route exists functionally but was built slice-by-slice with placeholder chrome in places (NavBar, Guides content, some empty/error states deferred). This slice is a deliberate sweep, not new features.

### Tasks

1. Full `NavBar.svelte` (floating pill mobile, sidebar option desktop) per `MASTER.md` and `layout-specs.md` S3.
2. `ToastContainer.svelte` wired to `toast-store.ts` per `sveltekit-route-architecture.md` S5.4 — confirm every mutation route that should toast on error actually does (cross-check against `loading-states.md` S2.3's per-page table).
3. Real Guides page content per `guides.md` — the three source docs (`systems-framework.md`, `sources.md`, `insights.md`) distilled into readable guide cards; this was stubbed in Slice 3.
4. Sweep every page against `loading-states.md` S4 (the per-page state matrix) — confirm skeleton/error/empty states exist where the matrix says they should, not just the happy path.
5. Responsive pass against `responsive-specs.md` at 375/768/1024px for every P0 page.
6. Run MASTER.md's Pre-Delivery Checklist literally, line by line.

### Tests

- No new backend tests. Add any missing frontend component unit tests the earlier slices skipped under time pressure (autosave indicator states, toast auto-dismiss timing).

### Definition of Done

- [ ] MASTER.md Pre-Delivery Checklist fully checked off.
- [ ] Manual pass at all 3 breakpoints for every P0 page.
- [ ] `prefers-reduced-motion` respected (checklist item, easy to skip — verify explicitly).

**PR:** `feat/ui-polish` → `main`.

---

## Slice 12 — CI/CD Pipeline

**Branch:** `chore/cicd`
**Docs:** `cicd-deploy.md` (full doc — this is the first time you're implementing what that doc specifies).

### Tasks

1. `.github/workflows/ci.yml` exactly per `cicd-deploy.md` S4.2 — matrix (`lint`/`test:unit`/`build` per package) → `integration` → `e2e` → `deploy` (main-only, sequential: migrations → API → web).
2. Add `CLOUDFLARE_API_TOKEN` to GitHub Actions repo secrets now (this was deliberately deferred from Slice 0).
3. First manual deploy per S9.1's checklist (you're doing this for real now, not just locally) — `pnpm -r build`, `pnpm -r deploy`, verify sign-up works against the live `*.workers.dev` URLs.
4. Push to `main` once, confirm the CI `deploy` job runs end-to-end.

### Definition of Done

- [ ] CI matrix, integration, and e2e jobs all green on a real PR.
- [ ] Manual first deploy succeeded and was verified against the live URL (S9.1's exact verification step: sign up, create a system, see it on the dashboard).
- [ ] Deploy job in CI ran successfully at least once on `main`.

**PR:** `chore/cicd` → `main`. (This one deploys as part of merging — treat the merge itself as the release event.)

---

## Slice 13 — Definition-of-Done / Security / Disaster-Recovery Sweep

**Branch:** `chore/p0-hardening`
**Docs:** `definition-of-done.md`, `security-review.md` S1–S3 (skip S4, already covered in Slice 3), `disaster-recovery.md` S1.1 (manual D1 backup — run it once now that there's real data worth backing up).

This is the "is P0 actually done" gate before you consider starting P1 (templates, AI, remaining widgets).

### Tasks

1. Re-run every item in `definition-of-done.md`'s checklist against the whole P0 surface, not per-PR this time — a holistic pass.
2. `security-review.md` S2 (R2 attachment validation) — **not applicable yet**, since attachments are P1 and no upload route exists. Confirm this explicitly rather than silently skipping.
3. `security-review.md` S3 (XSS in freeform fields) — audit every place `philosophy`/`purpose`/`protocol`/`barrier_list`/Log text/Review fields render, confirm none use `{@html}`.
4. Run a manual D1 backup per `disaster-recovery.md` S1.1 for the first time against production data, confirm the R2 upload succeeds, note the cadence going forward (weekly-ish).
5. Enable GitHub's free Dependabot alerts (Settings → Code security) per `security-review.md` S5 — a one-time repo setting, not code.

### Definition of Done

- [ ] Every Definition of Done checklist item confirmed true across P0, or explicitly noted as skipped-with-reason.
- [ ] First production D1 backup exists in `polaris-backups`.
- [ ] Dependabot alerts on.

**PR:** `chore/p0-hardening` → `main`. **P0 is complete once this merges.**

---

## Summary Table

| # | Branch | Depends on | New infra touched |
|---|---|---|---|
| 0 | `chore/bootstrap` | — | Cloudflare, Atlas accounts |
| 1 | `chore/monorepo-scaffold` | 0 | Wrangler, SvelteKit, Hono, Tailwind |
| 2 | `feat/d1-schema` | 1 | D1 migrations |
| 3 | `feat/auth` | 2 | Better Auth |
| 4 | `feat/system-creator` | 3 | — |
| 5 | `feat/schedules` | 4 | — |
| 6 | `feat/dashboard` | 5 | — |
| 7 | `feat/cron-instance-pregeneration` | 6 | Cron Triggers |
| 8 | `feat/workspace-core-widgets` | 6 | `svelte-dnd-action` |
| 9 | `feat/journal-widget-mongo` | 8 | MongoDB Atlas, Cloudflare Queues |
| 10 | `feat/reviews` | 6, 8 | — |
| 11 | `feat/ui-polish` | 10 | — |
| 12 | `chore/cicd` | 11 | GitHub Actions |
| 13 | `chore/p0-hardening` | 12 | — |

Slices 6/7 and 8/9 can run in either order relative to each other if you want to parallelize your own attention (e.g. do 8 before 7), but 9 must come after 8, and 10 needs both 6 and 8 done since Reviews reads Instance history and (indirectly) confirms the Workspace exists.

---

Everything else in this plan traces directly to an existing doc section — when you open each PR, tell me which slice it is and I'll check it against the specific sections cited above rather than the whole doc set.
