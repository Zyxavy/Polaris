# Testing Strategy

**Project:** *Polaris*

**Document type:** Testing Strategy - defines testing layers, tooling choices, scope per layer, and the approach for tricky cases (auto-save debounce, Workers AI mocking, D1 bindings in tests).

**Status:** Draft - v1 scope

**Last updated:** July 2, 2026

---

## 1. Overview

Three testing layers in order of feedback speed:

| Layer | Tool | Scope | Runs |
|---|---|---|---|
| Unit | Vitest | Pure functions, Svelte components in isolation, Hono route handlers (mocked bindings) | On every file save (watch mode) |
| Integration | `@cloudflare/vitest-pool-workers` + Miniflare | Hono routes + real D1 bindings + real R2 bindings in a local Workers runtime | On every push / pre-commit |
| E2E | Playwright | Full user flows against a locally-running dev stack | On every push / before deploy |

The goal is to make the unit layer fast enough to run constantly, the integration layer complete enough to catch binding/schema bugs before they reach E2E, and the E2E layer narrow enough (P0 flows only) to stay under 2 minutes.

---

## 2. Tooling Decisions

### 2.1 Vitest (unit + integration runner)

**Why Vitest over Jest:** the monorepo uses Vite (SvelteKit) and Hono (TypeScript Workers) - both are ESM-native. Vitest runs natively in ESM without transform overhead, shares the same Vite config as the web package, and has a first-class integration with `@cloudflare/vitest-pool-workers`. Jest's CommonJS-first heritage creates friction in this stack that Vitest avoids by design.

**Config:** each package has its own `vitest.config.ts`. The root `package.json` script runs both: `pnpm -r test`.

### 2.2 `@cloudflare/vitest-pool-workers` + Miniflare (integration)

**What it does:** runs Vitest tests inside the same Workers runtime (via Miniflare, the local Workers simulator) that the deployed Worker runs in. D1, R2, Queues, AI, and other bindings are available as real in-process local instances - not mocks. This catches a class of bugs that unit tests with mocked bindings cannot:

- SQL constraint violations that only surface against real D1 (e.g. a UNIQUE constraint on `(system_id, date)` for Instances).
- R2 `put`/`get` round-trips with actual stream handling.
- Cron `scheduled` handler logic with a real `env` object.

**Setup:** `packages/api/vitest.config.ts` uses the `@cloudflare/vitest-pool-workers` pool, pointed at the same `wrangler.toml` as the deployment. D1 in tests uses an in-memory SQLite database seeded from the migration files in `packages/api/migrations/`.

```typescript
// packages/api/vitest.config.ts
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          d1Databases: { DB: 'test-db' },
        },
      },
    },
  },
});
```

### 2.3 Playwright (E2E)

**Why Playwright over Cypress:** Playwright's multi-browser support (Chromium, Firefox, WebKit) with a single API, and its first-class support for async/await without the Cypress callback-heavy style. For a SvelteKit SPA with cookie-based auth, Playwright's browser context / storage-state approach for auth reuse is also cleaner than Cypress's equivalent.

**Scope:** E2E tests run against a local full-stack dev environment (`pnpm dev` in both packages), not against production or a staging environment. Running against production would require seeding/teardown logic that adds complexity without proportional value for a single-user personal tool.

---

## 3. Test Scope by Layer

### 3.1 Unit Tests (Vitest, no Workers runtime)

**Svelte components (`packages/web`):**
- System Creator form: field validation, auto-save trigger (see S4), template pre-fill behaviour.
- Dashboard: Instance state transitions (pending -> full/floor/missed), correct display of today's Instances.
- Workspace Builder: widget add/remove, layout serialisation to the `v: N` JSON schema, `upgradeLayout()` migration function for each version bump.
- Review form: `change_applied` write-back only fires when the field is non-empty.

**Pure functions (`packages/api/src/lib`):**
- `upgradeLayout(layout, fromV, toV)` - all version upgrade paths.
- `toManilaDate(utcDate)` - UTC -> `Asia/Manila` date string conversion.
- `tomorrowManilaDate()` - used by the nightly Cron job.
- `stripThinkTokens(rawResponse)` - strips `<think>...</think>` from Workers AI output.
- `parseSystemDraft(json)` - validates the AI-generated JSON against the expected System blueprint shape.

**Hono route handlers (mocked bindings):**
- Auth middleware: unauthenticated requests return 401.
- `POST /api/systems` - creates a System with valid body, rejects with 422 on missing required fields (floor_action, name).
- `POST /api/attachments` - rejects files over size limit (if a limit is set).

### 3.2 Integration Tests (`@cloudflare/vitest-pool-workers`)

These test the Hono routes with **real D1 bindings** (Miniflare in-memory SQLite, seeded from migration files). No mocking of database calls.

**P0 integration tests:**

- **System CRUD:** create -> read -> update -> soft-delete (status: archived). Verify `updated_at` updates, `template_origin` is preserved.
- **Instance auto-generation (dashboard load path):** seed an active System with a schedule matching today; call the dashboard Instance-generation logic; assert exactly one `pending` Instance is created; call it again and assert no duplicate is created (idempotency).
- **Nightly Cron handler:** invoke `scheduled()` with a mocked `env` and a real D1 binding seeded with active Systems; assert tomorrow's Instances are created; invoke again and assert no duplicates.
- **Instance state transition:** create an Instance in `pending`, PATCH to `full`, assert state and `updated_at` are correct.
- **Review write-back:** POST a Review with `change_applied` containing a new `floor_action`; assert the parent System's `floor_action` field is updated.
- **R2 attachment upload:** POST a small test file to `/api/attachments`; assert the R2 object exists at the generated key; assert a D1 pointer row was created with correct `r2_key`.
- **Auth flows:** sign-up, sign-in, session validation, sign-out - all against the real Better Auth + D1 integration.
- **Link List / Notes upsert:** PUT with a full payload, assert row created with `instance_id = NULL`; PUT again with a different payload, assert the row is replaced (not duplicated) for the same `(workspace_id, widget_id)`.

**What is not integration-tested:**
- MongoDB (Atlas) write path - this is tested in unit tests with a mock, and manually against a real Atlas connection in dev. Miniflare does not emulate external TCP services.
- Workers AI calls - mocked in all automated tests (see S4).

### 3.3 E2E Tests (Playwright)

**P0 flows - these must pass before any deploy:**

1. **Auth:** user signs up with email/password -> lands on Guides tab -> signs out -> signs back in -> lands on Dashboard.
2. **Create System (manual):** click "New System" -> fill all required fields (name, floor_action, trigger, schedule) -> save -> system appears on Dashboard.
3. **Create System (from template):** select "Reading System" template -> fields pre-filled -> edit floor_action -> save -> system appears on Dashboard with correct floor_action.
4. **Daily execution:** open Dashboard -> today's Instance is present in `pending` state -> mark as `full` -> state updates to `full` without page reload -> mark a second system as `floor` -> state updates.
5. **Workspace Builder:** open a system -> open Workspace -> add a Timer widget -> add a Counter widget -> drag Counter above Timer -> save -> reload page -> widget order is preserved.
6. **Weekly Review:** open Review screen for a system -> fill `what_worked`, `what_broke`, `change_applied` -> submit -> system's `floor_action` is updated to the value in `change_applied`.
7. **Guides tab:** navigate to Guides tab -> all three guide sections render without error.

**Not E2E-tested in v1:**
- AI-assisted creation (requires a live Workers AI call in test environment - deferred; tested manually).
- File attachments (R2 upload in E2E environment requires real R2 or a local stub - deferred; tested in integration layer against Miniflare R2).

---

## 4. Tricky Cases

### 4.1 Auto-save debounce testing

The System Creator auto-saves incomplete blueprints on a debounced interval. Testing a debounce in a unit test without leaking timer state is a common source of flakiness.

**Approach:** use Vitest's fake timer API:

```typescript
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it('auto-saves after debounce interval', async () => {
  const saveFn = vi.fn();
  renderSystemCreator({ onSave: saveFn });

  await userEvent.type(screen.getByLabelText('Name'), 'My System');

  // Before debounce fires: no save
  expect(saveFn).not.toHaveBeenCalled();

  // Advance fake timers past the debounce window
  vi.advanceTimersByTime(1500); // assuming 1000ms debounce

  expect(saveFn).toHaveBeenCalledOnce();
  expect(saveFn).toHaveBeenCalledWith(expect.objectContaining({ name: 'My System' }));
});
```

The debounce interval must be a named constant (`AUTOSAVE_DEBOUNCE_MS`) exported from the component's config, not a magic number, so tests can import and reference it without hardcoding.

### 4.2 Workers AI mocking

Real Workers AI calls must never run in automated tests - they consume Neuron quota and require network access. All AI calls are mocked at the `env.AI.run` level.

In integration tests via `@cloudflare/vitest-pool-workers`, Workers AI bindings can be overridden in the Miniflare config with a stub:

```typescript
// In test setup
const mockAI = {
  run: vi.fn().mockResolvedValue({
    response: '<think>reasoning here</think>\n{"name":"Reading System","floor_action":"Read one paragraph",...}'
  })
};
```

The `stripThinkTokens` and `parseSystemDraft` functions are unit-tested independently with real input strings (including malformed `<think>` blocks, missing closing tags, and valid JSON after the think block).

### 4.3 Idempotent Instance generation

The nightly Cron handler and the dashboard lazy-generation path must both be idempotent. The integration test for this is:

```typescript
it('does not create duplicate Instances', async () => {
  // Seed: one active System scheduled for today
  await seedSystem(env.DB, { status: 'active', schedule: todaySchedule() });

  // First call
  await generateTodayInstances(env.DB, today());
  const after1 = await countInstances(env.DB);
  expect(after1).toBe(1);

  // Second call - must be a no-op
  await generateTodayInstances(env.DB, today());
  const after2 = await countInstances(env.DB);
  expect(after2).toBe(1);
});
```

The D1 schema enforces this at the database level with a `UNIQUE (system_id, date)` constraint on the `instances` table - the integration test validates that the constraint exists and that the application code handles the resulting `UNIQUE constraint failed` error gracefully (catching and ignoring it, not surfacing a 500 to the client).

### 4.4 Timezone boundary in tests

All tests that involve "today" or "tomorrow" must use the `toManilaDate()` / `tomorrowManilaDate()` helpers, not `new Date().toISOString()` or `Date.now()`. Tests that cross a UTC midnight boundary (e.g. running a CI pipeline at 15:58 UTC, which is 23:58 Manila) can fail if "today" is computed differently in the test vs. the application code. Mitigation: mock `Date.now()` in date-sensitive tests using Vitest's `vi.setSystemTime()`, pinned to a Manila afternoon time far from any midnight boundary.

---

## 5. CI Pipeline

Runs on every push to `main` and every PR (config not yet created -- to be written during scaffolding as `.github/workflows/ci.yml`):

```
pnpm install
v
pnpm -r lint          # ESLint + Svelte check
v
pnpm -r test:unit     # Vitest unit (fast, no Workers runtime)
v
pnpm -r test:int      # Vitest integration (@cloudflare/vitest-pool-workers)
v
pnpm -r build         # SvelteKit static build + Hono Worker build
v
pnpm test:e2e         # Playwright against locally-started dev stack
```

E2E runs last because it requires a built + running app. The unit and integration steps fail fast before spending time on E2E if there are logic errors.

Deployment (`wrangler deploy` for both packages) only runs on push to `main` after all test steps pass.

---

## 6. What Is Not Tested (and Why)

| Area | Reason not automated |
|---|---|
| MongoDB Atlas write path | Miniflare doesn't emulate external TCP; tested manually in dev against a real Atlas connection |
| Workers AI actual inference | Neuron quota + network required; mocked in all automated tests, tested manually via the UI |
| R2 in E2E | Local R2 in Playwright requires a running Miniflare instance separate from the dev server; deferred to integration layer |
| Workspace drag-and-drop interaction | Playwright has limited support for drag events in headless mode; tested manually; the *result* of a drag (saved `layout` JSON) is covered in unit tests |
| Auth edge cases (password reset, session expiry) | Covered by Better Auth's own test suite; not re-testing the library's internals |

---

## 7. Testability by Design: Hybrid Service Layer

### 7.1 What

A pragmatic hybrid between "route handlers call D1 directly" and "every endpoint has a service function." The API is structured into three tiers, each with a different testability contract:

```
packages/api/src/
├── routes/          # Hono handlers -- parse request, validate body, call service or bindings, return response
├── services/        # Business-logic functions -- accept DB + params, return data, zero Hono/framework imports
├── lib/             # Pure utility functions -- no DB access, no I/O
```

**Frontend** (`packages/web/src/lib/services/`): domain modules wrapping `apiFetch` -- always, no exceptions. Components never call `fetch()` directly.

### 7.2 Why

Three observations drove this design, specific to this architecture's constraints:

**Mocking D1 is a trap.** To unit-test a service function that calls `db.prepare().bind().first()` without Miniflare, you must mock `D1Database` -- replicating `.prepare()`, `.bind()`, `.first()`, `.all()`, `.run()`, and `.batch()`. That mock becomes its own maintenance burden. Meanwhile, integration tests via `@cloudflare/vitest-pool-workers` give you real D1 in ~200ms boot + ~50ms per test. *The faster feedback cycle of unit tests doesn't materialize when the mock is as complex as the real thing.*

**Simple CRUD doesn't benefit from a service layer.** A `DELETE /api/counter-logs/:id` handler that does `db.prepare("DELETE FROM counter_logs WHERE id = ?").bind(id).run()` and nothing else gains nothing from an intermediate function -- it's the same inline logic either way, and it's tested via the integration layer either way. Adding a service file per endpoint doubles the file count with no testability return.

**Extraction is easy; over-abstraction is hard to undo.** Inline `db.prepare()` calls are trivial to extract into a service function later -- pure mechanical refactoring, no behavior change. Starting with services everywhere and discovering half are unnecessary is harder to reverse. This matches the "Ship it" constraint (ADR 001 S2): avoid premature abstraction.

### 7.3 How

**Rule 1: Simple CRUD lives in the route handler.**

```typescript
// routes/counter-logs.ts -- no service layer needed
router.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const row = await getOwnedCounterLog(c.env.DB, id, c.get('userId'));
  if (!row) return c.json({ error: 'not_found', message: 'Counter log not found.' }, 404);

  await c.env.DB.prepare('DELETE FROM counter_logs WHERE id = ?').bind(id).run();
  return c.json({ id, deleted: true });
});
```

Tested via the Miniflare integration layer (S3.2). No unit test needed -- the logic is a single DML statement with an ownership check that's tested as part of the route's integration coverage.

**Rule 2: Business logic lives in a service function, unit-tested without Miniflare.**

Extract a service function when the handler contains any of:
- Multi-step logic (read A, decide, write B)
- Date/time calculations (timezone math, day-of-week bitmask matching)
- AI output parsing (strip think tokens, validate JSON, merge with defaults)
- Cross-table write-back (Review route writes to two tables)

Example -- Instance generation:

```typescript
// services/instances.ts -- pure function accepting D1 as explicit dependency
export async function generateTodayInstances(db: D1Database, userId: string, today: string): Promise<void> {
  const systems = await db.prepare(`
    SELECT systems.id, schedules.days_of_week, schedules.time_window_start
    FROM systems
    JOIN schedules ON schedules.system_id = systems.id
    WHERE systems.user_id = ? AND systems.status = 'active'
  `).bind(userId).all();

  for (const system of systems.results) {
    if (!dayMatchesBitmask(today, system.days_of_week)) continue;
    await db.prepare(
      'INSERT OR IGNORE INTO instances (system_id, date, state) VALUES (?, ?, ?)'
    ).bind(system.id, today, 'pending').run();
  }
}

// lib/calendar.ts -- pure utility, unit-tested independently
export function dayMatchesBitmask(dateStr: string, bitmask: number): boolean { ... }
```

The service function accepts `D1Database` as a parameter -- it's tested with real D1, not a mock. The *pure utility* (`dayMatchesBitmask`) is unit-tested without D1 at all. This split is the key: the service function doesn't need a mock because you run it against Miniflare's real D1 (which is fast enough for unit-speed feedback at the few-dozen-test scale of this project), and the pure function underneath is tested in plain Vitest with no runtime at all.

**Rule 3: Frontend service modules always.**

```typescript
// packages/web/src/lib/services/systems.ts
import { apiFetch } from '$lib/api';
import type { System } from '$lib/types';

export async function getSystems(status?: string): Promise<System[]> {
  const params = status ? `?status=${status}` : '';
  const res = await apiFetch<{ systems: System[] }>(`/api/systems${params}`);
  return res.systems;
}

export async function createSystem(input: CreateSystemInput): Promise<System> {
  return apiFetch<System>('/api/systems', { method: 'POST', body: JSON.stringify(input) });
}
```

Components import from `$lib/services/systems`, never from `$lib/api` directly. In tests, `vi.mock('$lib/services/systems')` replaces the module with stubs -- no fetch mocking, no Miniflare, no network.

### 7.4 File structure summary

```
packages/api/src/
├── index.ts                    # fetch + scheduled + queue exports
├── routes/
│   ├── systems.ts              # CRUD passthroughs inline; POST /confirm calls services/confirm
│   ├── dashboard.ts
│   ├── instances.ts
│   ├── counter-logs.ts         # simple CRUD inline
│   ├── timer-sessions.ts       # simple CRUD inline
│   ├── checklist.ts
│   ├── schedules.ts
│   ├── workspaces.ts
│   ├── reviews.ts              # write-back logic calls services/reviews
│   ├── templates.ts
│   ├── attachments.ts
│   └── ai.ts
├── services/
│   ├── instances.ts            # Instance generation, date-matching logic
│   ├── reviews.ts              # cross-table write-back, change_applied derivation
│   └── dashboard.ts            # lazy generation + window-gated filter
├── lib/
│   ├── auth-middleware.ts
│   ├── ownership.ts            # getOwnedInstance, getOwnedSystem, etc.
│   ├── calendar.ts             # dayMatchesBitmask, toManilaDate, tomorrowManilaDate
│   ├── ai-parser.ts            # stripThinkTokens, parseSystemDraft
│   └── layout-upgrade.ts       # upgradeLayout for workspace v1 -> v2 -> ...
```

Services are only created when Rule 2's criteria are met. The rest of the API stays flat -- route handler calls D1 directly, tested in the integration layer. This keeps the codebase proportional to complexity and avoids the mock-D1 trap.
