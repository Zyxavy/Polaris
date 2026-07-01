# API Route Design

**Project:** *Polaris*
**Document type:** API contract -- the request/response shape for every endpoint the SvelteKit frontend calls. Companion to the [D1 Schema](004-d1-schema.md) (owns table shapes) and the [Tech Stack ADR](001-tech-stack-adr.md) (owns the decision to use Hono). This document owns paths, methods, payloads, status codes, and auth requirements -- not implementation code beyond the middleware pattern needed to make ownership checks unambiguous.
**Status:** Draft -- v1 scope
**Last updated:** July 1, 2026

---

## 1. Conventions

### 1.1 Base path and route ownership

Two route trees exist in the same Hono Worker:

- **`/api/auth/*`** -- owned entirely by Better Auth's own handler (`auth.handler`). Not designed here; see the Auth Integration doc.
- **`/api/*`** (everything else) -- the application API surface this document defines.

There is no `/api/v1` prefix. This is a single-developer personal app with one frontend consumer that deploys in lockstep with the API (ADR 001 §5.10, root `pnpm -r deploy`) -- a version prefix defends against a compatibility problem (old client, new server) that structurally can't happen here. If the API is ever opened to a second consumer, that's the point to introduce versioning, not before.

### 1.2 Auth requirement -- default is "required"

Every route under `/api/*` requires a valid session **except none in v1** -- including the AI draft route (already stated in ADR 003 §5). There is no public read-only API surface. The auth middleware runs before every route handler in this tree; a request with no valid session cookie gets `401` before any handler-specific logic runs, including before request body validation.

### 1.3 Response envelope

- **Single resource** (GET one, POST create, PATCH update): the resource itself, top-level, no wrapper. `{ "id": "...", "name": "...", ... }`
- **List** (GET many): wrapped in a named key matching the resource, plural. `{ "systems": [...] }`
- **Action with a side effect but no natural "resource"** (e.g. archive): the updated resource, same as a PATCH.
- **Error** (any 4xx/5xx): `{ "error": "snake_case_code", "message": "human-readable sentence" }` -- this is already the shape ADR 003 established for the AI route; every other route follows it for consistency. `error` is stable and meant to be matched on in frontend code; `message` is meant to be shown to the user directly, so it must never leak internals (raw DB errors, stack traces).

### 1.4 Status codes used

| Code | Meaning in this API |
|---|---|
| `200` | Successful GET, PATCH, or action route |
| `201` | Successful POST that created a new resource |
| `400` | Request body failed validation (missing required field, wrong type, value outside allowed range) |
| `401` | No valid session |
| `404` | Resource doesn't exist, **or** exists but isn't owned by the session user (see §1.5 -- these are intentionally indistinguishable to the client) |
| `409` | A state-machine violation (e.g. archiving an already-archived System, or double-submitting a Review for a period that already has one, returns `409`) |
| `422` | Body is syntactically valid but semantically rejected by a business rule (e.g. `time_window_end` before `time_window_start`) |
| `502` | Upstream dependency (Workers AI, MongoDB via Queue) failed -- already precedented in ADR 003 |
| `503` | Upstream dependency's quota/capacity is exhausted (Workers AI neuron quota -- ADR 003) |

`400` vs `422` distinction: `400` is "the shape is wrong," `422` is "the shape is right but the values don't make sense together." This matters less for a single client than it would for a public API, but keeping it consistent means frontend form-validation code can trust the split rather than string-matching `message`.

### 1.5 Ownership checks (cross-cutting -- read this before any route below)

Only `systems` and `templates` carry `user_id` directly (D1 Schema §3.1, §3.5). Every other resource (`schedules`, `instances`, `workspaces`, `reviews`, `attachments`, `counter_logs`, `timer_sessions`, `widget_entries`) is scoped to a user only transitively, through its `system_id` / `workspace_id` chain back to a `systems` row. **Every route that reads or mutates one of these must join back to `systems.user_id` and compare against the session user -- not just look the row up by its own `id`.**

Concretely, this means a helper used by every non-`systems` route, e.g.:

```typescript
// packages/api/src/lib/ownership.ts
export async function getOwnedInstance(db: D1Database, instanceId: string, userId: string) {
  const row = await db.prepare(`
    SELECT instances.*
    FROM instances
    JOIN systems ON systems.id = instances.system_id
    WHERE instances.id = ? AND systems.user_id = ?
  `).bind(instanceId, userId).first();

  return row; // null if not found OR not owned -- caller returns 404 either way
}
```

A row that exists but belongs to another account returns the same `404` as a row that doesn't exist at all -- never `403`. This avoids confirming a given ID exists to a caller who doesn't own it. This pattern is referenced as "ownership-scoped lookup" in every route table below rather than repeated per-route.

### 1.6 Pagination

Not implemented in v1. Every list endpoint returns its full result set. PRD §10 puts the ceiling at a few thousand rows/year across all tables at heavy personal use -- well within a single unpaginated response. If this stops being true, pagination is an additive query-param change (`?cursor=`), not a breaking one, since the envelope is already a named array key rather than a bare array.

---

## 2. Systems

| Method | Path | Auth-scoped query |
|---|---|---|
| `GET` | `/api/systems` | `WHERE user_id = ?`, optional `?status=active\|paused\|archived` filter |
| `POST` | `/api/systems` | insert with `user_id` from session |
| `GET` | `/api/systems/:id` | ownership-scoped lookup |
| `PATCH` | `/api/systems/:id` | ownership-scoped lookup, then update |
| `POST` | `/api/systems/:id/confirm` | ownership-scoped lookup, then update -- see §2.4 |
| `POST` | `/api/systems/:id/archive` | ownership-scoped lookup, then update |
| `POST` | `/api/systems/:id/save-as-template` | ownership-scoped lookup on system, insert into `templates` |

### 2.1 `GET /api/systems`

Backs the Dashboard's system list and any "all systems" view. **Not** the Dashboard's Instance view -- see §4.1 for that.

```
Query params: ?status=active   (optional; omit for all statuses)
Response 200:
{
  "systems": [
    {
      "id": "sys_...", "name": "Reading System", "domain": "Study",
      "purpose": "...", "philosophy": "...", "protocol": "...",
      "floor_action": "...", "trigger": "...",
      "barrier_list": ["...", "..."],
      "template_origin": "tpl_reading_system",
      "status": "active",
      "created_at": "...", "updated_at": "..."
    }
  ]
}
```

`barrier_list` is returned as a parsed JSON array, not the raw stored string -- the API is the JSON parse/serialize boundary; the frontend never sees the D1 `TEXT` encoding.

### 2.2 `POST /api/systems`

Creates a System. Used by all three entry points in PRD §6.1 (from scratch, from template, AI-assisted) -- all three converge on this one endpoint because all three land in the same editable form before save (PRD §6.1). The `template_origin` field is how "from template" is distinguished from "from scratch" at the data level; the AI-assisted path has no special marker at all, since AI output is edited into the same form fields and saved the same way a manual entry would be (ADR 003 §1: "AI output never bypasses the form").

```
Request body:
{
  "name": "Reading System",           // required, min 1 char
  "domain": "Study",                  // optional
  "purpose": "",                      // optional, default ''
  "philosophy": "",                   // optional, default ''
  "protocol": "",                     // optional, default ''
  "floor_action": "",                 // optional at this call -- see §2.4
  "trigger": "",                      // optional, default ''
  "barrier_list": [],                 // optional, default []
  "template_origin": "tpl_reading_system"  // optional, null if from scratch or AI
}

Response 201: the created System (same shape as §2.1's list items)
Response 400: { "error": "invalid_input", "message": "name is required." }
```

This is also the endpoint the autosave flow calls on the very first debounced save (PRD §4.3) -- the moment the System Creator form opens and the user types a name, the first autosave tick fires this `POST` (not a `PATCH`, since no `id` exists yet). Every subsequent autosave tick calls `PATCH /api/systems/:id`.

### 2.3 `PATCH /api/systems/:id`

Partial update -- only fields present in the body are changed. This is the workhorse route: autosave ticks after the first one, direct edits from the System detail page, and the `change_applied` write-back from a Review submission (D1 Schema §3.6's note -- that write-back is a second call to this same endpoint, not a special-cased path).

```
Request body: any subset of the POST body's fields
Response 200: the updated System
Response 404: not found / not owned
```

No field in this body is ever required to be present -- `PATCH` semantics mean partial. This is where the tension with `floor_action` in D1 Schema §5 lives: a `PATCH` with `floor_action: ""` is accepted without complaint, because it's still a draft.

### 2.4 `POST /api/systems/:id/confirm`

The one place `floor_action` is actually enforced as required, per D1 Schema §5's resolution. Called when the user explicitly saves/finalizes a System from the Creator form (as opposed to the ambient autosave that's been running the whole time).

```
Request body: {}   (no body -- this validates the System's current stored state, it doesn't accept new field values)
Response 200: the System, unchanged, if floor_action is non-empty
Response 422:
{
  "error": "floor_action_required",
  "message": "Every system needs a floor action - the smallest version that still counts as a win."
}
```

Why a separate route instead of validating inside `PATCH`: `PATCH` is called continuously by autosave with partial, often-incomplete data -- it must never reject a draft. `confirm` is the one explicit checkpoint where "is this actually done" is a meaningful question. The frontend calls this once, when the user clicks the form's primary "Save System" action (distinct from the invisible autosave that's already been running).

### 2.5 `POST /api/systems/:id/archive`

```
Request body: {}
Response 200: the System with status: "archived"
Response 409: { "error": "already_archived", "message": "This system is already archived." }
```

Per D1 Schema §4, this only flips `status` -- it never touches `instances` or `reviews` rows, and the frontend continues to show full history from the System's detail page after archiving.

### 2.6 `POST /api/systems/:id/save-as-template`

Implements PRD §5.6 ("any System the user has built can be saved back as a personal template"). Snapshots the System's current field values into a new `templates` row with `source: 'user'`.

```
Request body: { "name": "My Studying Shape" }   // template display name, defaults to the System's name if omitted
Response 201: the created Template (see §7 for shape)
```

---

## 3. Schedules

| Method | Path |
|---|---|
| `GET` | `/api/systems/:system_id/schedules` |
| `POST` | `/api/systems/:system_id/schedules` |
| `PATCH` | `/api/schedules/:id` |
| `DELETE` | `/api/schedules/:id` |

Nested under `systems` for creation/listing (a schedule doesn't exist independent of its system), flat for `PATCH`/`DELETE` (once you have a schedule's own `id`, no need to re-supply the parent). All four ownership-check through `systems.user_id`.

```
POST /api/systems/:system_id/schedules
Request body:
{
  "days_of_week": 62,              // bitmask, bit 0 = Monday .. bit 6 = Sunday (D1 Schema §3.2)
  "time_window_start": "06:00",    // "HH:MM", Asia/Manila local time, no timezone in payload
  "time_window_end": "08:00"
}
Response 201: { "id": "...", "system_id": "...", "days_of_week": 62, "time_window_start": "06:00", "time_window_end": "08:00", "recurrence": "weekly", "created_at": "...", "updated_at": "..." }
Response 422: { "error": "invalid_window", "message": "End time must be after start time." }
```

`recurrence` is not accepted in the request body in v1 -- it's always `'weekly'`, set server-side, matching the `CHECK` constraint in D1 Schema §3.2. Sending it is silently ignored rather than rejected, so the field can be safely wired up client-side ahead of a future `'daily'`/`'biweekly'` migration without a breaking change.

---

## 4. Dashboard & Instances

### 4.1 `GET /api/dashboard`

The single most important route in the app -- backs PRD §6.3. This is the one intentional exception to "GET has no side effects": on every call, it performs the lazy Instance-generation check (PRD §5.3, path 1) for the session user before returning results. This is safe to call repeatedly because it's guarded by the same `UNIQUE (system_id, date)` constraint the nightly Cron job relies on (D1 Schema §3.3) -- a second call the same day is a no-op past the first.

```
Response 200:
{
  "instances": [
    {
      "id": "inst_...",
      "state": "pending",
      "notes": null,
      "workspace_snapshot": null,
      "created_at": "...", "updated_at": "...",
      "system": {
        "id": "sys_...", "name": "Reading System", "domain": "Study",
        "floor_action": "Open the book and read one paragraph"
      }
    }
  ]
}
```

The `system` object embedded per instance is intentionally a narrow projection (not the full System record from §2.1) -- the Dashboard card only ever needs name, domain, and floor_action for its collapsed state; the full record is fetched separately if the user drills into a specific System. Keeping this response small matters more here than anywhere else in the API, since PRD §10 calls this out as the one screen with a hard non-blocking-render requirement.

**Generation logic (server-side, not a separate endpoint):**

The dashboard path and the nightly Cron path have different scope but share the same idempotency guarantee:

**Nightly Cron Trigger** (date-only, no window check):
Runs once per night at `0 15 * * *` UTC (~11 PM Asia/Manila). For every active System belonging to this user whose schedule matches tomorrow's day-of-week bitmask:
- `INSERT OR IGNORE INTO instances (system_id, date, state) VALUES (?, tomorrow, 'pending')`

This pre-generates the DB row regardless of time windows. The row exists but the dashboard won't surface it until the window opens (see below).

**Lazy dashboard load** (date + window check):
On every `GET /api/dashboard` call:
- Step 1 (generation): for each active System whose `days_of_week` matches today's day-of-week bitmask, `INSERT OR IGNORE INTO instances (system_id, date, state) VALUES (?, today, 'pending')`. The `IGNORE` handles the Cron-pre-generated case -- the insert is a no-op if the row already exists.
- Step 2 (filter): `SELECT` today's Instances for this user, but only return those whose associated Schedule's `time_window_start <= current_time Asia/Manila`. An Instance whose window hasn't opened yet exists in D1 but is excluded from the response.

This ensures: (a) tomorrow's Instance is visible the night before (the Cron row exists), but today's Instance for a 6 PM window doesn't clutter the morning Dashboard, and (b) the Cron job and dashboard path never fight over duplicates.

**Why two passes instead of one query with a window check on the insert?** The insert must be date-only because the Cron job has no concept of "current time" when it runs at 11 PM for tomorrow -- inserting with a `WHERE time_window_start <= tomorrow_08_00` would skip systems whose window is in the afternoon, meaning those rows never get pre-generated. Keeping the insert date-only and the filter window-gated avoids coupling the generation logic to the Cron's execution time window.

### 4.2 `GET /api/instances/:id`

```
Response 200: the Instance (same shape as embedded in §4.1's "instances" array, minus the "system" projection)
Response 404: not found / not owned
```

Needed for deep-linking to a single Instance and for refreshing one Instance's state after a `PATCH` without re-fetching the whole `/api/dashboard` payload. Ownership-scoped, same pattern as everything else.

### 4.3 `PATCH /api/instances/:id`

```
Request body: { "state": "full" }   // or "floor" | "missed"
Response 200: the updated Instance (same shape as embedded in §4.1, minus the "system" projection)
Response 422: { "error": "invalid_transition", "message": "Cannot set state to 'pending' directly." }
```

`state: "pending"` is never a valid value in this body -- per ADR 003 Appendix A.5 (`instance.mark`)'s own note, there's no supported path back to `pending` once an Instance has been marked. This route is also how the Workspace's optional "log details" flow (PRD §6.3) sets `notes`:

```
Request body: { "state": "full", "notes": "Finished chapter 3" }
```

`notes` and `state` can be set together or independently -- both are optional in the body, but at least one must be present (an empty `{}` body returns `400`).

### 4.4 `GET /api/systems/:system_id/instances`

Instance history for one System -- backs the System detail page's streak/calendar view and the Review flow's week-of-history lookup (§8.1).

```
Query params: ?from=2026-06-24&to=2026-06-30   (both optional; omitting both returns full history)
Response 200: { "instances": [ ...same shape as §4.3's response, one per matching date... ] }
```

---

## 5. Workspaces

| Method | Path |
|---|---|
| `GET` | `/api/systems/:system_id/workspace` |
| `PUT` | `/api/systems/:system_id/workspace` |

`PUT`, not `POST`/`PATCH` -- the one-to-one relationship (D1 Schema §3.4) and the upgrade-on-read/write-always-current versioning scheme (ADR 001 §5.4) mean "create" and "replace the whole layout" are the same operation from the client's point of view: the Workspace Builder always sends the complete current `layout` JSON on every save (drag-drop reorder, add widget, resize), never a partial patch to it. `PUT` being idempotent and always specifying the full resource state matches that.

```
PUT /api/systems/:system_id/workspace
Request body:
{
  "layout": {
    "v": 1,
    "widgets": [
      { "id": "w_abc123", "type": "timer", "x": 0, "y": 0, "w": 2, "h": 1, "config": { "label": "Pomodoro" } }
    ]
  }
}
Response 200:
{ "id": "ws_...", "system_id": "sys_...", "layout": { "v": 1, "widgets": [...] }, "created_at": "...", "updated_at": "..." }
```

Server-side, this route is also where `layout.v` gets forced to `CURRENT_VERSION` on write (ADR 001 §5.4's "on write: always write `layout.v = CURRENT_VERSION`") -- if the client sends a stale `v`, the server does not trust it; `upgradeLayout()` runs server-side before persisting, not just on read. This means the Workspace Builder never needs to know about the upgrade chain at all -- it always receives an already-current layout from `GET` and always sends whatever it received (plus edits) back on `PUT`.

```
GET /api/systems/:system_id/workspace
Response 200: same shape as PUT's response, with layout already upgraded to CURRENT_VERSION if it was stored stale
Response 404: no workspace exists yet for this system -- the frontend treats this as "show an empty Workspace Builder," not an error state
```

---

## 6. Widget Data

Three tables, three endpoint groups, matching D1 Schema §3.3.1's hybrid design exactly. All are ownership-scoped through `instances -> systems` or `workspaces -> systems`.

### 6.1 Counter logs

```
POST /api/instances/:instance_id/counter-logs
Request body: { "widget_id": "w_counter1", "value": 12, "unit_label": "pages" }
Response 201: { "id": "...", "workspace_id": "...", "widget_id": "...", "instance_id": "...", "value": 12, "unit_label": "pages", "created_at": "..." }

GET /api/widgets/:widget_id/counter-logs?from=&to=
Response 200: { "counter_logs": [...] }   -- cross-instance, powers the Progress chart widget's SUM/trend query (D1 Schema §3.3.1)

DELETE /api/counter-logs/:id
Response 200: { "id": "...", "deleted": true }
```

The `GET` is keyed by `widget_id` rather than nested under an instance or a system, because a Progress chart widget's whole purpose is aggregating *across* instances -- there is no single-instance version of this query that makes sense. Ownership is still checked, just via a join from `widget_id`'s owning `workspace_id -> system_id -> user_id` rather than through an instance.

`DELETE` exists here deliberately, unlike Instances (§4.3, no supported path back to `pending`). A mistyped Counter tally is a raw data-entry error, not a historical record the way an Instance's daily state is -- PRD §6.5's "past Instances are never retroactively altered" is a statement about the Instance state machine specifically, not a blanket rule against ever correcting logged numbers. Letting a fat-fingered "120 pages" become "12 pages" via delete-and-re-add (no update endpoint, since these rows are treated as immutable once correct) keeps the correction path simple without reopening the bigger question of whether Instance history itself should ever be editable.

### 6.2 Timer sessions

```
POST /api/instances/:instance_id/timer-sessions
Request body: { "widget_id": "w_timer1", "duration_secs": 1500, "started_at": "...", "ended_at": "..." }
Response 201: same shape pattern as counter-logs

GET /api/widgets/:widget_id/timer-sessions?from=&to=
Response 200: { "timer_sessions": [...] }

DELETE /api/timer-sessions/:id
Response 200: { "id": "...", "deleted": true }
```

Same correction rationale as §6.1.

### 6.3 Checklist state

```
PUT /api/instances/:instance_id/checklist/:widget_id
Request body: { "steps": [ { "label": "Warm-up", "checked": true }, { "label": "Main set", "checked": false } ] }
Response 200: { "id": "...", "instance_id": "...", "widget_id": "...", "entry_type": "checklist_state", "data": { "steps": [...] }, "created_at": "..." }

GET /api/instances/:instance_id/checklist/:widget_id
Response 200: same shape, or 404 if the checklist hasn't been touched for this instance yet (frontend renders all-unchecked in that case)
```

`PUT` here too, same reasoning as the Workspace layout -- the client always sends the complete current step list, not a single-step toggle, since a `widget_entries` row is replaced wholesale rather than patched (D1 Schema §3.3.1 stores it as one JSON blob per instance+widget, not one row per step). No `DELETE` for Checklist specifically: correcting a mis-checked step is already a `PUT` with the corrected `steps` array, so a separate delete path would be redundant rather than a missing capability.

---

## 7. Templates

| Method | Path |
|---|---|
| `GET` | `/api/templates` |
| `GET` | `/api/templates/:id` |

No `POST`/`PATCH`/`DELETE` here -- creation happens via `POST /api/systems/:id/save-as-template` (§2.6), and v1 has no template-editing or template-deletion flow (PRD doesn't call for one; a user who wants a different shape just saves a new template from a different System).

```
GET /api/templates?source=built_in
Response 200:
{
  "templates": [
    {
      "id": "tpl_reading_system", "name": "Reading System", "source": "built_in",
      "default_purpose": "...", "default_philosophy": "...", "default_protocol": "...",
      "default_floor_action": "...", "default_trigger_pattern": "...",
      "default_barrier_list": ["...", "..."],
      "suggested_widgets": ["counter", "log", "streak"],
      "created_at": "...", "updated_at": "..."
    }
  ]
}
```

`source` is not required -- omitting it returns both built-in and the session user's own saved templates together, which is what the System Creator's template picker (PRD §6.1) actually needs: one list, built-ins first by convention (sorted server-side, `source = 'built_in'` before `'user'`, then alphabetical within each group).

---

## 8. Reviews

| Method | Path |
|---|---|
| `GET` | `/api/systems/:system_id/reviews` |
| `POST` | `/api/systems/:system_id/reviews` |
| `GET` | `/api/review-day` |

### 8.1 `POST /api/systems/:system_id/reviews`

The loop-closing route (PRD §5.7, §6.4). This is the one endpoint in the whole API that writes to two tables in one request: it inserts the `reviews` row, then -- if `change_applied` is non-empty -- issues a second `UPDATE` against `systems` for whichever fields the description implies changed, per D1 Schema §3.6's note that this is plain sequential application code, not a trigger.

```
Request body:
{
  "period_start": "2026-06-24",
  "period_end": "2026-06-30",
  "what_worked": "...",
  "what_broke": "...",
  "worst_day_check": true,
  "change_applied": {
    "floor_action": "Touch the book and read the chapter title only"
  }
}
Response 201:
{
  "review": { "id": "...", "system_id": "...", "period_start": "...", "period_end": "...", "what_worked": "...", "what_broke": "...", "worst_day_check": true, "change_applied": "I lowered the floor action: Touch the book and read the chapter title only", "created_at": "...", "updated_at": "..." },
  "updated_system": { ...full System record, post-write-back... }
}
Response 409: { "error": "review_already_exists", "message": "A review for this period already exists." }
```

**`change_applied` design:** The request body accepts `change_applied` as a structured object (`{ field_name: "new value", ... }`) for two reasons:

1. **Write-back is unambiguous.** The API maps each key directly to an `UPDATE systems SET field = ?` -- no guessing which field changed.
2. **No double-entry.** The Review screen already exposes editable System fields. If the user changes `floor_action` in the review form, they shouldn't have to *also* type "I lowered the floor action" as free text.

The stored text is auto-derived from the structured object (concatenating field names and values) **unless** the request also includes an optional `change_description` string field. If present, that string is stored verbatim in `reviews.change_applied` instead. This preserves the PRD's intent of `change_applied` being a human-readable reflective statement when the user wants to write one, while keeping the write-back path unambiguous in the common case (user just edits fields without writing a separate note).

**Duplicate reviews are blocked** (`409`). If the user double-clicks submit or refreshes after posting, they get a clear error rather than a silent duplicate. If they genuinely want to re-review a period early, they submit with an earlier `period_end`.

### 8.2 `GET /api/review-day`

Backs PRD §5.7's aggregation view -- "every system due for review, one after another."

```
Response 200:
{
  "due": [
    {
      "system": { "id": "...", "name": "Reading System", "floor_action": "..." },
      "period_start": "2026-06-24", "period_end": "2026-06-30",
      "instance_summary": { "full": 3, "floor": 2, "missed": 2 },
      "last_review_id": "rev_..."   // null if this system has never been reviewed
    }
  ]
}
```

"Due" is computed server-side as: every active System belonging to the user with no `reviews` row whose `period_start`/`period_end` covers the most recently completed 7-day window. This intentionally does not filter by the user's designated Review Day -- per PRD §5.7, the Review Day is "a convenience aggregation view, not an exclusivity lock," so this endpoint returns whatever's due regardless of which day it's called on; the frontend decides when to surface it prominently.

---

## 9. Attachments

| Method | Path |
|---|---|
| `POST` | `/api/attachments` |
| `GET` | `/api/attachments/:id` |

Implements ADR 001 §5.7's proxied-upload flow exactly -- this document just pins down the HTTP contract around it.

```
POST /api/attachments
Content-Type: multipart/form-data
Fields: file (binary), workspace_id, widget_id

Response 201: { "id": "att_...", "workspace_id": "...", "widget_id": "...", "filename": "notes.pdf", "content_type": "application/pdf", "size_bytes": 48213, "created_at": "..." }
Response 400: { "error": "file_too_large", "message": "..." }   // if a size limit is set -- Testing Strategy §3.1 flags this as conditional ("if a limit is set")
```

`GET /api/attachments/:id` streams the R2 object back directly (`Content-Type` set from the stored `content_type`, `Content-Disposition: inline` so PDFs/images render in-browser rather than force-downloading) rather than returning a JSON pointer -- the frontend links directly to this URL as an `<a href>` / `<img src>`.

---

## 10. AI Assist

Already fully specified in ADR 003 §5 (`POST /api/ai/draft-system`) -- not repeated here. Included in this document's route inventory (§11) for completeness only.

---

## 11. Full Route Inventory

| Method | Path | Ownership check | Notes |
|---|---|---|---|
| `*` | `/api/auth/*` | Better Auth-managed | See Auth Integration doc |
| `GET` | `/api/systems` | `user_id` | |
| `POST` | `/api/systems` | `user_id` on insert | |
| `GET` | `/api/systems/:id` | ownership-scoped | |
| `PATCH` | `/api/systems/:id` | ownership-scoped | |
| `POST` | `/api/systems/:id/confirm` | ownership-scoped | enforces `floor_action` |
| `POST` | `/api/systems/:id/archive` | ownership-scoped | |
| `POST` | `/api/systems/:id/save-as-template` | ownership-scoped | |
| `GET` | `/api/systems/:system_id/schedules` | ownership-scoped | |
| `POST` | `/api/systems/:system_id/schedules` | ownership-scoped | |
| `PATCH` | `/api/schedules/:id` | ownership-scoped | |
| `DELETE` | `/api/schedules/:id` | ownership-scoped | |
| `GET` | `/api/dashboard` | `user_id` | lazy Instance generation |
| `GET` | `/api/instances/:id` | ownership-scoped | |
| `PATCH` | `/api/instances/:id` | ownership-scoped | |
| `GET` | `/api/systems/:system_id/instances` | ownership-scoped | |
| `GET` | `/api/systems/:system_id/workspace` | ownership-scoped | |
| `PUT` | `/api/systems/:system_id/workspace` | ownership-scoped | |
| `POST` | `/api/instances/:instance_id/counter-logs` | ownership-scoped | |
| `GET` | `/api/widgets/:widget_id/counter-logs` | ownership-scoped | |
| `DELETE` | `/api/counter-logs/:id` | ownership-scoped | |
| `POST` | `/api/instances/:instance_id/timer-sessions` | ownership-scoped | |
| `GET` | `/api/widgets/:widget_id/timer-sessions` | ownership-scoped | |
| `DELETE` | `/api/timer-sessions/:id` | ownership-scoped | |
| `PUT` | `/api/instances/:instance_id/checklist/:widget_id` | ownership-scoped | |
| `GET` | `/api/instances/:instance_id/checklist/:widget_id` | ownership-scoped | |
| `GET` | `/api/templates` | `user_id` (+ built-in) | |
| `GET` | `/api/templates/:id` | `user_id` (+ built-in) | |
| `GET` | `/api/systems/:system_id/reviews` | ownership-scoped | |
| `POST` | `/api/systems/:system_id/reviews` | ownership-scoped | two-table write |
| `GET` | `/api/review-day` | `user_id` | |
| `POST` | `/api/attachments` | ownership-scoped (via workspace_id) | proxied R2 upload |
| `GET` | `/api/attachments/:id` | ownership-scoped | streams R2 object |
| `POST` | `/api/ai/draft-system` | session only | see ADR 003 |

---

## 12. Nightly Cron Handler

Not an HTTP route, but lives in the same Worker as the Hono API (exported as `scheduled`) and is part of the API's total surface area. Documented here for completeness.

```
Export: scheduled(event, env, ctx)
Schedule: 0 15 * * * (11 PM Asia/Manila, UTC+8)
Idempotency: INSERT OR IGNORE INTO instances (system_id, date, state) VALUES (?, ?, 'pending')

Logic:
For each active System belonging to any user:
  For each of its Schedules where days_of_week matches tomorrow's day-of-week bitmask:
    INSERT OR IGNORE INTO instances (system_id, tomorrow_date, state) VALUES (?, ?, 'pending')
```

No window-gating on generation -- the Cron pre-generates the DB row for all matching systems regardless of their time window. Window filtering is the dashboard's responsibility (§4.1). Idempotency is guaranteed by the `UNIQUE (system_id, date)` constraint -- running the Cron twice for the same date is safe.
