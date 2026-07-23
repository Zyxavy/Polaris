# Polaris: P1 Implementation Plan

**Implementation status:** Planned / Target Architecture

**Scope:** P1 per PRD S7: Built-in Systems Framework template library, user-saved templates, remaining widget types (Link List, Streak view, Progress Chart, Notes), AI-assisted creation (suggest-only), R2 attachments (called out as a v1 dependency in PRD S13 decision #2 but explicitly deferred out of the P0 plan's scope), and the `/account` settings surface (recovery-code display/regenerate) that P0 stubbed via the sign-up modal only.

**Explicitly deferred to P2 (do not build yet):** workspace widget reordering/resizing polish, export/backup, CI matrix optimization, any cross-system aggregate dashboard, notifications/reminders, custom widget types, multi-workspace-per-system.

**How to use this doc:** same conventions as `implementation-plan-p0.md`: each slice is a vertical feature, ends in a mergeable PR, and is fully working (backend + frontend + tests) before starting the next one. Branch/PR/commit conventions from `AGENTS.md` apply unchanged (feature branches, no direct push to `main`, `type(scope): description` commits, ask before adding a dependency not already pre-approved).

**Starting state (per `CHANGELOG.md` and current migrations):** P0 is fully merged: auth, Systems CRUD, Schedules, Dashboard + lazy/cron Instance generation, Workspace with Timer/Counter/Checklist/Log widgets, Reviews + Review Day, CI/CD, and a first security/DR sweep are all live. `packages/api/migrations/` currently runs `0001`–`0010`, then `0013`–`0015` (the `0011_attachments.sql` / `0012_seed_builtin_templates.sql` gap called out in D1 Schema S6.2 was intentionally left open for this phase).

---

## A note on migration numbering

D1 Schema S6.2's original plan assumed `0011_attachments.sql` and `0012_seed_builtin_templates.sql` would slot in before `0013_recovery_codes.sql`. Since `0013`–`0015` are already applied in production, **do not reuse those numbers**: migrations are append-only and wrangler tracks applied files by name in its own `d1_migrations` table, but filename collision with a different file body is exactly the kind of drift the append-only convention exists to prevent. Create the new tables as `0016_attachments.sql` and `0017_seed_builtin_templates.sql` instead, and add a one-line note to `docs/ADRs/002-d1-schema.md` S6.2 documenting that the gap was intentionally closed out of order. This is a small, deliberate deviation from the doc: flag it in the PR rather than silently renumbering.

---

## Slice 14: Built-in Template Library (Backend)

**Branch:** `feat/templates-builtin`
**Docs:** PRD S5.6, S9 (the three template bodies, verbatim), D1 Schema S3.5 + S6.3 (seed SQL), `api-routes.md` S7.

### Tasks

1. `packages/api/migrations/0017_seed_builtin_templates.sql`: copy the three `INSERT INTO templates` statements verbatim from D1 Schema S6.3 (Reading System, Studying System, Workout System). `templates` table itself already exists from `0004_templates.sql` (P0): this migration only seeds rows.
2. `packages/api/src/routes/templates.ts`: `GET /api/templates` (optional `?source=built_in|user` filter, otherwise both together, built-ins first per `api-routes.md` S7) and `GET /api/templates/:id`. Both are `user_id IS NULL OR user_id = ?` scoped reads: not the standard ownership-scoped-mutation pattern, since built-ins have no owner.
3. Mount at `/api/templates` in `index.ts`.
4. `POST /api/systems/:id/save-as-template` on the existing `systems.ts` router per `api-routes.md` S2.6: snapshots the System's current field values into a new `templates` row with `source: 'user'`, `user_id` from session. `name` optional in the body, defaults to the System's own `name`.

### Tests

- **Integration:** `GET /api/templates` returns the 3 seeded built-ins with no auth-scoping needed on them; a user's own saved template only appears for that user, never for another session. `POST /api/systems/:id/save-as-template` snapshots current field values (not a live reference: mutate the System afterward and confirm the template is unaffected, per PRD S13 decision #4's "clone at instantiation" framing, which starts here at save-time too).
- **Unit:** none needed: this is straightforward CRUD per `testing-strategy.md` S7.3 Rule 1.

### Definition of Done

- [ ] Seed migration applies cleanly on top of the existing `0015` state.
- [ ] `default_philosophy` on all three seeds is non-empty but generic, per D1 Schema S6.3's note (don't shortcut this to `''`).
- [ ] Save-as-template snapshot independence verified by a test, not just inspection.

**PR:** `feat/templates-builtin` > `main`.

---

## Slice 15: Template Picker (Frontend) + System Creator Wiring

**Branch:** `feat/template-picker`
**Docs:** PRD S6.1 (flow 2), `design-system/polaris/pages/system-creator.md` (the `<details>` Template Picker section, stubbed out in P0), `component-inventory.md` (`TemplatePicker.svelte`).

### Tasks

1. `packages/web/src/lib/api/templates.ts`: `getTemplates()`, `getTemplate(id)`, `saveAsTemplate(systemId, name?)` typed wrappers.
2. `TemplatePicker.svelte`: collapsible `<details>` per the design doc, grid of template cards (built-ins first). Selecting a template pre-fills `SystemForm`'s field state (not a live binding: same "clone at instantiation" independence as the backend) and does **not** call `POST /api/systems` itself; it writes into the same form state the manual-entry path uses, per PRD S6.1's "all three converge on the same System Creator form."
3. Wire `TemplatePicker` into `/systems/new/+page.svelte`, un-stubbing the section deferred in Slice 4 of the P0 plan.
4. Add a "Save as template" action to the System Detail overview page's action row (`system-detail.md`), calling the new endpoint with a small inline name-prompt (reuse the existing `<Modal>` pattern from `component-inventory.md` rather than a native `prompt()`).

### Tests

- **Unit:** selecting a template populates `SystemForm`'s local `$state` fields correctly (mirrors the `SystemForm.svelte.spec.ts` autosave test pattern: fake timers not needed here, just assert field values post-selection).
- **E2E (new P1 flow):** open System Creator > expand template picker > select "Reading System" > confirm floor_action field is pre-filled > edit it > save > confirm the *template* itself (re-fetch via `GET /api/templates/tpl_reading_system`) is unchanged.

### Definition of Done

- [ ] Template selection never calls a save endpoint directly: verified by checking the network tab in the E2E flow or by asserting on a mocked `createSystem`/`patchSystem` call count in a unit test.
- [ ] E2E flow passes.

**PR:** `feat/template-picker` > `main`.

---

## Slice 16: AI-Assisted Creation

**Branch:** `feat/ai-draft-system`
**Docs:** `ai-workers.md` (full doc: S1–S7, skip Appendix A entirely, it's explicitly deferred), PRD S6.1 (flow 3), S8, ADR 001 S5.9.

This is the first slice touching a binding P0 never wired up (`env.AI`).

### Backend

1. Add the `ai` binding to `packages/api/wrangler.jsonc` (`{ "ai": { "binding": "AI" } }`): deferred from Slice 1 of the P0 plan per its own note.
2. `packages/api/src/ai/prompts/system-prompt.v1.ts`: copy `SYSTEM_PROMPT_V1` verbatim from `ai-workers.md` S3. `packages/api/src/ai/prompts/index.ts` re-exports it as `SYSTEM_PROMPT_CURRENT`.
3. `packages/api/src/ai/parse.ts`: `stripThinkTokens`, `parseSystemDraft`, `AIParseError`, `SystemDraft` interface, exactly per `ai-workers.md` S4.
4. `packages/api/src/routes/ai.ts`: `POST /api/ai/draft-system` per S5: validate `prompt` (min 5 chars > 400), call `env.AI.run('@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', { messages: [...], max_tokens: 1024 })` (model ID pinned per `ai-workers.md` S2: don't leave it implicit or infer it only from the system-prompt file), catch `4006`/`neuron` in the error message > `503 ai_unavailable`, catch any other call failure > `502 ai_error`, catch parse failure > `502 ai_parse_failed` (log the raw response trimmed to 500 chars, per `observability.md` S3.2's "don't log full stack traces for expected errors": this is closer to an expected failure mode than an unexpected one, log accordingly).
5. Mount at `/api/ai` in `index.ts`, behind the existing `requireAuth` guard (already applied globally to non-`/api/auth/*` routes: no new middleware needed).

### Frontend

1. `packages/web/src/lib/api/ai.ts`: `draftSystem(prompt)` typed wrapper. Must handle `ai_unavailable` (503) as a distinct, non-toast case (see below), not a generic error.
2. `AIDraftPanel.svelte` per `component-inventory.md` and `system-creator.md`'s AI Draft panel section (stubbed out in P0): prompt input + "Draft" button. On success, writes the returned draft into `SystemForm`'s field state, same non-bypassing convergence as the Template Picker (ADR 003 S1: "AI output never bypasses the form"). On `ai_unavailable`, hide/disable the panel for the rest of the session and show an inline "AI assist is unavailable today: you can still create your system manually" notice per `ai-workers.md` S5: this is a UI state, not a toast, since it's not a transient error the user should retry immediately.
3. Wire into `/systems/new/+page.svelte` alongside the Template Picker.

### Tests

- **Unit:** `stripThinkTokens` (with/without a `</think>` tag, malformed/missing closing tag) and `parseSystemDraft` (valid JSON, missing required field, non-JSON garbage) per `testing-strategy.md` S4.2: real input strings, no live model call.
- **Integration:** mock `env.AI.run()` at the Miniflare binding level (`testing-strategy.md` S4.2's pattern) for three cases: success returns `{ draft }`, a `4006`-flavored thrown error returns `503`, a malformed response returns `502 ai_parse_failed`.
- **E2E:** explicitly **not built** in this slice, per `testing-strategy.md` S3.3's "Not E2E-tested in v1" list: AI-assisted creation requires a live Workers AI call in the test environment. Verify manually once deployed, note this in the PR.

### Definition of Done

- [ ] All three `env.AI.run()` failure modes covered by mocked integration tests (success / quota / parse failure): this is the one route in the app where a third-party-style dependency can fail in three distinct, user-visible ways, and each needs its own test per `testing-strategy.md` S4.2.
- [ ] `AIDraftPanel` never allows AI output to save without a human edit pass: same verification approach as Slice 15's template picker (no direct save call from the panel).
- [ ] 10ms CPU note: confirm this route's total JS work (prompt validation, `stripThinkTokens`, `JSON.parse`) is trivial relative to the `env.AI.run()` I/O wait, which doesn't count against the budget: cite `ai-workers.md` S8's reasoning in the PR rather than re-deriving it.
- [ ] Manual verification of the happy path against a real deployed Worker, documented in the PR (screenshot or a copy of the returned draft): same "can't be automated, document it" pattern as the P0 plan's Slice 9 (Mongo retry path).

**PR:** `feat/ai-draft-system` > `main`.

---

## Slice 17: Notes + Link List Widgets

**Branch:** `feat/notes-linklist-widgets`
**Docs:** PRD S5.5, D1 Schema S3.3.1 ("Why Link List and Notes use `instance_id = NULL`"), `api-routes.md` S6.5–6.6, `component-inventory.md`.

Both widgets share one shape (`widget_entries`, workspace-scoped not instance-scoped, `PUT`-replace-not-append): building them together avoids writing the same route/component pattern twice in separate PRs.

### Backend

1. `packages/api/src/routes/link-list.ts`: `PUT`/`GET /api/workspaces/:workspace_id/link-list/:widget_id` per S6.5: same upsert-by-`(workspace_id, widget_id)` pattern already established for Checklist in P0's `checklist.ts` (P0 route is instance-scoped; this one is workspace-scoped with `instance_id = NULL`, so it's a new file, not a copy-paste of `checklist.ts` with a find-replace: the ownership lookup goes through `getOwnedWorkspace`, not `getOwnedInstance`).
2. `packages/api/src/routes/notes.ts`: same pattern, `entry_type = 'notes'`, `data = {"text": "..."}`.
3. Add `getOwnedWorkspace`-based ownership check reuse (already exists in `lib/ownership.ts` from P0's `workspace.ts`: confirm it's exported and reusable here, don't duplicate).
4. Mount using the same convention as `counter-logs.ts`/`timer-sessions.ts`/`checklist.ts`/`journal-log.ts` in P0: mount each router at the flat `/api` prefix in `index.ts` (`app.route('/api', linkListRoutes)`, `app.route('/api', notesRoutes)`), with the *full* path: `/workspaces/:workspace_id/link-list/:widget_id`, `/workspaces/:workspace_id/notes/:widget_id`: defined inside the route file itself, not in the mount call. Do **not** introduce a new `/api/workspaces/:workspace_id` sub-router pattern for this slice; every other widget-data route file in the app already owns its full path string, and a one-off nested-router style here would be inconsistent for no benefit.

### Frontend

1. `packages/web/src/lib/api/link-list.ts`, `notes.ts`: typed `PUT`/`GET` wrappers.
2. `LinkListWidget.svelte`: label+URL pair list, add/remove rows, single `PUT` on save (debounced, matching the "client always sends the complete list" contract: don't build a per-row save).
3. `NotesWidget.svelte`: single `<textarea>`, debounced `PUT` on change (same `AUTOSAVE_DEBOUNCE_MS` constant from `system-form.config.ts`, imported not redefined).
4. Un-stub both in `WidgetPalette.svelte` (`comingSoon: false`) and add their cases to `WidgetCard.svelte`'s type dispatch.

### Tests

- **Integration:** PUT creates, GET returns it; PUT again with a different payload replaces (not appends) for the same `(workspace_id, widget_id)`: mirrors the Checklist replace-not-append test from P0's `workspace.spec.ts`. 404 on GET before first save, for both widgets.
- **Unit:** none beyond existing debounce coverage: reusing `AUTOSAVE_DEBOUNCE_MS` means no new timer logic to test.

### Definition of Done

- [ ] Both widgets confirmed workspace-scoped (`instance_id = NULL`) at the DB row level in a test: this is the one detail easy to get wrong by copy-pasting instance-scoped Checklist code.
- [ ] Replace-not-append verified for both.
- [ ] Widget palette shows both as active, not "Coming Soon."

**PR:** `feat/notes-linklist-widgets` > `main`.

---

## Slice 18: Streak View + Progress Chart Widgets (read-only)

**Branch:** `feat/streak-progress-widgets`
**Docs:** PRD S5.5, D1 Schema S3.3.1's closing note on Progress Chart's aggregation query (already validated by a P0 test on `counter_logs`, per `CHANGELOG.md` Slice 8's "Definition of Done" item), `component-inventory.md`, MASTER.md's Ring Chart component spec.

Both are **read-only**, derived widgets: no new write endpoints, which keeps this slice smaller than Slice 17 despite touching two widget types.

### Backend

1. No new routes. Streak derives from `GET /api/systems/:system_id/instances` (already exists, P0). Progress Chart derives from the existing `GET /api/widgets/:widget_id/counter-logs` or `.../timer-sessions` (also already exists, P0): this slice is frontend-only on the API side.
2. Confirm (don't re-test, just sanity-check against the live endpoint) that the aggregation query shape from D1 Schema S3.3.1 (`SUM ... GROUP BY date(created_at)`) is what the Progress Chart component actually needs: the P0-era test only validated the raw `SUM`, not a date-bucketed series; if the exact grouping the chart needs isn't already served by the existing route, add a `?group_by=date` option to `counter-logs`/`timer-sessions` GET rather than pulling raw rows and aggregating client-side (10ms budget doesn't apply to `packages/web`, but pulling unbounded raw rows to a browser for charting is still bad practice worth avoiding).

### Frontend

1. `RingChart.svelte` per `component-inventory.md` and MASTER.md's Ring Chart spec (12pt stroke, round caps, gradient fill): a generic `value: number (0-100)` component, not streak-specific, so it's reusable.
2. `StreakWidget.svelte`: computes a simple consecutive-day streak from `GET /api/systems/:system_id/instances` (full/floor counts as "held," missed breaks the streak, per the non-punitive framing in `dashboard.md`'s visual tone notes: "don't break the chain" per `systems-framework.md` Part 05 Step 4, but rendered calmly, no "streak lost" language per MASTER.md's anti-pattern list).
3. `ProgressChartWidget.svelte`: line/bar chart of Counter or Timer data over time. Check `AGENTS.md`'s pre-approved dependency list before reaching for a charting library: none is currently listed (`d3`, `chart.js`, `recharts` are approved for **artifacts**, not necessarily for this production package): if a charting dependency is needed here, this is an "ask before adding" moment per `AGENTS.md`, not a silent `pnpm add`. A simple hand-rolled SVG sparkline may avoid the dependency question entirely for v1's chart needs.
4. Un-stub both in `WidgetPalette.svelte` and `WidgetCard.svelte`.

### Tests

- **Unit:** streak-calculation pure function (extract it out of the component into a plain `.ts` function so it's testable without a browser: full/floor/missed sequences, an empty-history case, a broken-then-resumed streak).
- **Integration:** none new (no new routes).
- **E2E:** not required: read-only display widgets, low risk, covered adequately by the existing Workspace E2E flow (P0 flow #5) once these types are added to that test's widget-add assertions (optional follow-up, not blocking this slice).

### Definition of Done

- [ ] Streak calculation is a pure, unit-tested function, not inline component logic.
- [ ] No new dependency added without flagging it per `AGENTS.md`'s "ask before adding" rule: resolve this explicitly in the PR description even if the answer is "no new dependency needed."
- [ ] Non-punitive visual tone confirmed against MASTER.md's anti-pattern list (no red for misses, no "streak lost" text).

**PR:** `feat/streak-progress-widgets` > `main`.

---

## Slice 19: R2 Attachments

**Branch:** `feat/attachments`
**Docs:** ADR 001 S5.7 (full upload-flow design, orphan handling), `api-routes.md` S9, `security-review.md` S2 (MIME allowlist + size limit: this document is the source-of-truth contract for validation rules), D1 Schema S3.7.

The last piece of infra P0 provisioned (`polaris-attachments` R2 bucket exists since Slice 0 of the P0 plan) but never wired up.

### Backend

1. `packages/api/migrations/0016_attachments.sql`: copy the `attachments` table verbatim from D1 Schema S3.7 (see the migration-numbering note at the top of this document for why it's `0016`, not `0011`).
2. `packages/api/src/lib/attachments.ts`: MIME allowlist array and `MAX_ATTACHMENT_SIZE_BYTES` constant, copied exactly from `security-review.md` S2's table (13 MIME types, 25 MB). Keep this as a named, exported list: both the route and any future test import it, rather than duplicating the literal list.
3. `packages/api/src/routes/attachments.ts`:
   - `POST /api/attachments`: parses `multipart/form-data` (`file`, `workspace_id`, `widget_id`), validates MIME against the allowlist (`400 unsupported_file_type`) and size (`400 file_too_large`, checked **before** any R2 write per the security doc's "reject early" note), generates the R2 key as `{system_id}/{widget_id}/{uuid}.{ext}` (resolve `system_id` from `workspace_id` via `getOwnedWorkspace`), calls `env.ATTACHMENTS.put()`, then writes the D1 pointer row **only after** R2 confirms success (ADR 001 S5.7's ordering requirement: if D1 write fails after a successful R2 put, log the orphaned key per the doc's accepted-risk framing, don't attempt a compensating R2 delete).
   - `GET /api/attachments/:id`: ownership-scoped lookup, then `env.ATTACHMENTS.get(r2_key)`, streamed back with `Content-Type` from the stored `content_type` and `Content-Disposition: inline`.
4. Add the `r2_buckets` binding for `ATTACHMENTS` to `wrangler.jsonc` if not already present for the `production` env block (the `binding` for `polaris-attachments` exists at the top level per the current `wrangler.jsonc`: confirm the `env.production` block also has it, since Slice 12 of the P0 plan's `env.production` override may not have carried it forward; cross-check against the current file before assuming).

### Frontend

1. `packages/web/src/lib/api/attachments.ts`: `uploadAttachment(file, workspaceId, widgetId)` using `FormData` (not the standard `apiFetch` JSON wrapper: this is the one call site that needs a different `Content-Type`; don't force it through the JSON-only wrapper, write a small dedicated function that still sets `credentials: 'include'`), `getAttachmentUrl(id)` (returns the direct API URL for use in `<a href>`/`<img src>`, no fetch needed client-side per the streaming design).
2. A small `AttachmentUpload.svelte` component (file input + upload button + list of existing attachments): attach it to the Log widget and Link List widget per PRD S5.5's "Link list, Log entries" attachment use case. This is new UI surface not previously stubbed in P0's `WidgetPalette`/`WidgetCard`: it's a sub-feature of two existing widgets, not a new widget type of its own.

### Tests

- **Integration:** valid upload (PDF, under size limit) > `201`, D1 pointer row exists with correct `r2_key`; oversized file > `400 file_too_large` (verify R2 was never written: check via `env.ATTACHMENTS.get()` returning null for the would-be key); disallowed MIME type > `400 unsupported_file_type`; `GET /api/attachments/:id` streams back the correct bytes and `Content-Type`; non-owned attachment > `404`.
- **E2E:** not required in v1 per `testing-strategy.md` S3.3's "Not E2E-tested" list (local R2 in Playwright needs a separate Miniflare instance): covered by the integration layer instead, consistent with that doc's existing stance.

### Definition of Done

- [ ] MIME allowlist and size limit match `security-review.md` S2's table exactly, imported from one shared constant, not duplicated inline in the route.
- [ ] R2-then-D1 write ordering verified by a test that simulates a D1 failure after a successful R2 put (or at minimum, code-reviewed against ADR 001 S5.7's explicit ordering requirement if simulating the failure is impractical in Miniflare: state which approach was taken in the PR).
- [ ] `wrangler.jsonc`'s `env.production` R2 binding confirmed present, not just the dev-level one.

**PR:** `feat/attachments` > `main`.

---

## Slice 20: `/account` Settings Page

**Branch:** `feat/account-settings`
**Docs:** `sveltekit-route-architecture.md` S2.3 ("What is NOT a route in v1": this slice is what turns `/account` into an actual v1 route), `auth-integration.md` S5.2 (recovery codes display/regenerate contract, already backed by `GET`/`POST /api/recovery-codes*` from P0).

Small, self-contained slice: the backend already exists (P0 Slice 3); this is purely the settings surface the sign-up modal alone didn't cover (regeneration, later re-viewing).

### Frontend only

1. `packages/web/src/routes/(app)/account/+page.ts`: loads `GET /api/recovery-codes`.
2. `packages/web/src/routes/(app)/account/+page.svelte`: displays codes masked (`POLARIS-****-****`) with a hide/show toggle per `auth-integration.md` S5.2, a "Regenerate" button calling `POST /api/recovery-codes/generate` (with a confirm-before-destructive-action prompt, since regenerating invalidates the old codes: reuse the `<Modal>` pattern).
3. Add an "Account" entry to `NavBar.svelte`'s nav items (both mobile pill and desktop sidebar): this is a genuinely new nav destination, not previously in the P0 nav item list (`Dashboard`, `Systems`, `Review Day`, `Guides`).
4. Update `design-system/polaris/component-inventory.md`'s `NavBar.svelte` entry (nav items table) and its "Page-Specific Components" summary to include `/account`: the inventory doc currently lists only the four P0 nav destinations; this slice is what makes it stale if skipped.

### Tests

- **Unit:** hide/show toggle state.
- **E2E:** optional extension of P0 flow #1 (auth): after sign-in, navigate to `/account`, confirm codes are visible masked, toggle to reveal, regenerate, confirm old codes not returned by a subsequent `GET`.

### Definition of Done

- [ ] Regenerate requires explicit confirmation (destructive: invalidates existing codes).
- [ ] `/account` reachable from both nav layouts (mobile pill icon set may need a 5th icon, or route it as a NavBar overflow item if 5 icons crowds the mobile pill: designer's call, flag in the PR if deviating from a straight 1-for-1 addition).
- [ ] `component-inventory.md` updated with the new nav entry and `/account` page: don't leave this to the Slice 21 sweep if it's a one-line addition here.

**PR:** `feat/account-settings` > `main`.

---

## Slice 21: P1 Definition-of-Done Sweep

**Branch:** `chore/p1-hardening`
**Docs:** `definition-of-done.md`, `security-review.md` S2 (now fully applicable: re-run this section for real against the Slice 19 implementation, it was explicitly marked "not applicable yet" in the P0-era Slice 13 sweep), `testing-strategy.md` S3.3 (confirm the "Not E2E-tested in v1" list is still accurate, or update it if any P1 slice added E2E coverage beyond what was scoped above).

Mirrors P0's closing Slice 13: the gate before considering P1 complete.

### Tasks

1. Re-run `definition-of-done.md`'s checklist holistically across the full P1 surface (Slices 14–20), not per-PR.
2. `security-review.md` S2: now actually exercise the R2 validation rules against the live implementation (P0's Slice 13 sweep explicitly deferred this with "not applicable yet, no upload route exists").
3. Sweep `AGENTS.md`'s test count table and `README.md`'s "Tech Stack (Planned)" table: both need updating now that AI, Queues-adjacent... no, Queues/Mongo were P0: specifically update the Workers AI row (now Active, not Planned) and confirm R2/Cron rows reflect reality (Cron was already P0; R2 moves from "Configured (binding exists)" to "Active" once Slice 19 lands).
4. Cross-doc stale-reference sweep per `definition-of-done.md` S7: grep `docs/` for any remaining "P1" or "deferred" language describing features this plan just shipped (the PRD S7 priority table, `implementation-plan-p0.md`'s own "explicitly deferred" list, `ai-workers.md`'s "not implemented" framing in its header, etc.) and update implementation-status banners to `Current`.
5. Run a fresh manual D1 backup per `disaster-recovery.md` S1.1 now that P1 has added real schema (`templates` seed rows, `attachments` table) worth protecting.

### Definition of Done

- [ ] Every `definition-of-done.md` item confirmed true across P1, or explicitly noted as skipped-with-reason.
- [ ] `security-review.md` S2 re-run against the live attachment upload route.
- [ ] `README.md` and `AGENTS.md` tables updated to reflect P1 completion.
- [ ] Fresh D1 backup taken and uploaded to `polaris-backups`.

**PR:** `chore/p1-hardening` > `main`. **P1 is complete once this merges.**

---

## Summary Table

| # | Branch | Depends on | New infra touched |
|---|---|---|---|
| 14 | `feat/templates-builtin` | P0 complete |: (seed migration only) |
| 15 | `feat/template-picker` | 14 |: |
| 16 | `feat/ai-draft-system` | P0 complete | Workers AI (`env.AI` binding) |
| 17 | `feat/notes-linklist-widgets` | P0 complete |: |
| 18 | `feat/streak-progress-widgets` | 17 (shares Workspace palette state, easier sequenced after) | possibly a charting dependency: ask first |
| 19 | `feat/attachments` | P0 complete | R2 (`ATTACHMENTS` binding, first real use) |
| 20 | `feat/account-settings` | P0 complete (recovery-codes backend already live) |: |
| 21 | `chore/p1-hardening` | 14–20 |: |

Slices 14/15 (templates), 16 (AI), 17/18 (widgets), 19 (attachments), and 20 (account) have no dependencies on each other and can be parallelized freely if working across multiple threads of attention: only 15 strictly needs 14, and 18 is sequenced after 17 for convenience (same palette/card-dispatch files touched) rather than a hard technical dependency. 21 needs all six feature slices merged first.

---

Everything above traces to an existing doc section: PRD S7's priority table for what's in scope, and the specific ADR/reference sections cited per slice for how to build it. When opening each PR, name the slice and the sections it implements so review can check against the same source rather than the plan's paraphrase of it.