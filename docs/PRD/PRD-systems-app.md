# Product Requirements Document

**Project:** *Polaris*
**Document type:** Product Requirements Document - companion to the [Tech Stack ADR](../ADRs/001-tech-stack-adr.md), which owns infrastructure decisions. This document owns feature scope, data model, and user flows.
**Status:** Draft - v1 scope
**Last updated:** July 1, 2026

---

## 1. Summary

This is a web app for designing, running, and iterating on personal **systems** - repeatable processes that produce results without depending on daily motivation. It is not a habit tracker and not a to-do list. The unit of the product is the *system*: a defined protocol with a floor action, a schedule, a dedicated workspace, and a recurring review loop that feeds changes back into the design.

The product's source of truth is three documents already in the project: `Philosophy.md` (the research base - eight creators' frameworks on systems vs. goals), `Systems Framework.md` (the synthesized five-step build process: MVA -> Friction -> Trigger -> Scoreboard -> Review), and `insights.md` (the product-specific synthesis of what that research implies for this app). Every feature in this PRD should trace back to a principle in those three files. Where a feature doesn't trace back to one, that's a flag to question it, not a green light.

## 2. Problem Statement

Goal-tracking apps fail their users in a specific, repeatable way: they assume good days. A streak breaks once, the user feels they've "failed," and they abandon the app entirely rather than the underlying habit. The research base is unanimous on the fix - design for the worst day, not the best one - but no mainstream tracking app actually encodes that. They track binary completion against a fixed target, not a floor/full spectrum against a designed protocol.

This product's bet: if the *unit of tracking* is a designed system (with an explicit floor action, an explicit trigger, and a built-in review loop) rather than a raw habit checkbox, the app survives the moments where habit trackers get abandoned.

## 3. Goals & Non-Goals (v1)

### Goals

- Let a user design a system from scratch, from a built-in template, or with light AI assistance, following the five-step build process (MVA, Friction, Trigger, Scoreboard, Review).
- Let a user attach a custom workspace to each system - a drag-and-drop surface of widgets relevant to that system (timer, exercise log, link list, notes, etc.).
- Let a user schedule each system to a day/time window, execute against it daily via a single dashboard, and log floor/full/missed per occurrence.
- Give every system a weekly review cadence (defaulting to a single user-chosen Review Day, but not exclusive to it) that closes the loop: review -> diagnose -> edit the blueprint -> next week runs the updated version.
- Single source-of-truth philosophy baked into onboarding and into the System Creator itself, not just documentation.

### Non-Goals (v1)

- No multi-user collaboration, sharing, or social features (leaderboards, public templates) - this is a single-player tool.
- No native mobile app - responsive web only.
- No autonomous AI ("AI builds your system and you approve it later") - AI is suggest-only, every output is user-edited before it's saved.
- No offline-first / sync - CSR app, assumes a live connection (consistent with the ADR's auth and D1 model).
- No integrations with external calendars, fitness trackers, or note apps in v1.

## 4. Core Philosophy -> Product Principles

Pulled directly from `insights.md`, restated as build rules:

1. **The system works on the worst day, or it doesn't ship.** Every feature is tested against: does this still function when the user is tired, behind, and has 30 seconds? The floor action and the dashboard's default state both exist because of this rule.
2. **Remove the decision, not just the friction.** Instances (today's occurrence of a system) are auto-generated when the dashboard loads - the user never decides *whether* to engage with a system today, only *how much*.
3. **Capture beats perfection.** Auto-save everywhere, including incomplete blueprints. A half-built system saved is worth more than a perfect one left in a draft that never got finished.
4. **Repetition creates motivation, not the reverse.** Scoring is non-punitive (floor completions count meaningfully, not as a lesser failure-state of "full").
5. **The review closes the loop.** Without it, the product is a tracker. With it, it's a system-design tool. The review screen must produce an *edit*, not just a reflection - that's what separates this from a journal.

## 5. Core Concepts & Data Model

This section is intentionally implementation-aware (D1 = relational, structured tables; Mongo = one bounded document-shaped feature), per the ADR.

### 5.1 System

The top-level entity. A designed protocol, not a task.

| Field | Notes |
|---|---|
| `id`, `user_id`, `name`, `domain` | domain = freeform tag (Study, Health, Finance, etc.) - not a fixed enum, user-defined |
| `purpose` | Why this system exists - the "destination" |
| `philosophy` | The cognitive anchor / reasoning the user wrote for themselves - replaces willpower on bad days (`insights.md`: "Philosophy field") |
| `protocol` | The full-version steps |
| `floor_action` | The MVA - smallest version that counts as a win. Required field, not optional, at creation time |
| `trigger` | "After I [existing habit], I will [system]." Stored as structured text, optionally with a chosen anchor habit from a short list |
| `barrier_list` | *(new, research-backed addition - see §9)* What has prevented this system before |
| `schedule` | Day(s)/time window(s) this system runs against - see §5.2 |
| (workspace) | One-to-one relationship resolved via `Workspace.system_id` — not a FK on System (see ADR 004 S1.3) |
| `template_origin` | Nullable FK - which template/blueprint this was created from, if any |
| `status` | active / paused / archived |
| `created_at`, `updated_at` | |

Stored in **D1** - fully relational, fixed shape, exactly the case the ADR earmarks for SQL.

### 5.2 Schedule

Decoupled from System so a system can have multiple windows (e.g., a study system that runs weekday mornings *and* weekend afternoons differently).

| Field | Notes |
|---|---|
| `id`, `system_id` | |
| `days_of_week` | bitmask or array |
| `time_window_start`, `time_window_end` | Window, not fixed time - consistent with `insights.md`'s point that window-based scheduling is the if-then design, not a fixed-time plan that breaks on first disruption |
| `recurrence` | weekly (v1) - daily/biweekly as stretch |

**Timezone decision:** This is a single-user personal app deployed for use in the Philippines. All "today" calculations - on the dashboard, in Instance generation, and in the nightly Cron Trigger - use `Asia/Manila` (UTC+8, **no DST**). There is no user-configurable timezone field; the timezone is hardcoded as a server-side constant (`TZ = 'Asia/Manila'`). D1 stores all dates as ISO strings in UTC; the API converts to/from `Asia/Manila` at the boundary. This eliminates the entire class of per-user timezone bugs for what is explicitly a single-user tool, and the no-DST property of the Philippines timezone means the UTC offset is permanently stable - no twice-yearly clock-change edge cases. If the app is ever opened to additional users in other timezones, a `user.timezone` field is the correct place to add that, and the conversion layer is already the only place that needs to change.

### 5.3 Instance

A single day's occurrence of a System. This is the thing the user actually marks complete.

| Field | Notes |
|---|---|
| `id`, `system_id`, `date` | |
| `state` | `full` / `floor` / `missed` / `pending` |
| `notes` | optional freeform |
| `workspace_snapshot` | optional - pointer to whatever was logged in the workspace for this instance (e.g., which exercise log entries belong to today) |

Instances are generated via **two complementary paths** - both are v1:

1. **Lazy (on dashboard load):** any active System whose schedule matches today and has no existing Instance gets one auto-created in `pending` state. This is the safety net - it guarantees a correct Instance even if the nightly job fails.
2. **Nightly Cron Trigger:** runs at a fixed UTC time that corresponds to approximately 11 PM Manila time (`0 15 * * *` UTC), pre-generating Instances for the *following day*. This makes tomorrow's schedule visible the night before - useful for planning the next day during an evening review. The job is idempotent: it checks for an existing `(system_id, date)` pair before inserting, so running it twice for the same date is safe. See ADR §5.8 for implementation detail and free-tier feasibility.

Stored in **D1**.

### 5.4 Workspace

The customizable surface attached to a system. Built from **Widgets** (§5.5) on a drag-and-drop canvas.

| Field | Notes |
|---|---|
| `id`, `system_id` | one-to-one with System in v1 (a system has at most one workspace) |
| `layout` | JSON blob (D1 TEXT column): widget positions, sizes, ordering, and configuration. See layout schema below. |

**Layout JSON schema and versioning strategy:**

The `layout` column stores a versioned JSON blob. Widget types and their configuration schemas will evolve over time; without a versioning strategy, old stored layouts silently break when a widget schema changes. The chosen approach is **upgrade-on-read with a schema version field**:

```jsonc
{
  "v": 1,                         // schema version - increment when any widget type's shape changes
  "widgets": [
    {
      "id": "w_abc123",           // stable instance ID (not the widget type)
      "type": "timer",            // widget type from the catalog
      "x": 0, "y": 0,            // grid position
      "w": 2, "h": 1,            // grid span
      "config": { ... }           // widget-type-specific configuration (see §5.5)
    }
  ]
}
```

**Rules:**

- `v` is the layout schema version, stored in the blob. The current expected version is a server-side constant.
- On **read**: if `layout.v < CURRENT_VERSION`, run the upgrade chain `upgradeLayout(layout, fromV, toV)` before returning to the client. The upgrade function is a pure transform - it never writes back automatically, so a read-only view never triggers a write.
- On **write**: always write `layout.v = CURRENT_VERSION`. This means edits silently migrate stale layouts forward.
- Upgrade functions are additive: they only add optional fields or rename with fallback - they never delete data from old layouts.
- **Breaking changes** (e.g. removing a widget type entirely) require an explicit migration script run against D1, not just an upgrade function. Log these in a `LAYOUT_MIGRATIONS.md` file in the repo alongside the version bump.
- v1 ships at `v: 1`. Version bumps are expected to be infrequent for a personal project maintained by one developer.

### 5.5 Widget

A single module placed on a workspace. v1 ships a fixed catalog of widget *types*; the user composes and configures them, but doesn't build new widget types from scratch (that's a v2 idea, not v1 - see §11).

**v1 Widget Catalog:**

| Widget | Use case | Data shape |
|---|---|---|
| Timer | Study/focus sessions, workouts | duration logs, tied to instance |
| Counter / Tally | Reps, pages read, pushups | numeric log over time |
| Log / Journal entry | Free text per instance (PRs, session notes) | text, timestamped |
| Checklist | Sub-steps within a protocol (e.g., warm-up steps) | list with check state |
| Link list | Sources, references, resources | label + URL |
| Streak / calendar view | Visual scoreboard for this specific system | derived from Instance history, read-only |
| Progress chart | Numeric trend (weight lifted, pages/week) | derived from Counter/Log widgets |
| Notes block | Static freeform notes (not per-instance) | text |

Widget *instances and their logged data* are the closest thing in this app to genuinely document-shaped, variable data - this is the natural candidate for the bounded **MongoDB** feature in the ADR (§5.5 of the ADR: "free-form journal/reflection entries, and nothing else"). Recommendation: keep Mongo scoped specifically to the **Log/Journal widget's entries**, not all widget data - counters, checklists, and timers are still simple enough to live as D1 rows without forcing a second database into the hot path.

### 5.6 Template / Blueprint

A reusable System definition a user can instantiate. Two sources in v1:

- **Built-in (v1):** three concrete starter blueprints ship in v1 - Reading System, Studying System, and Workout System. These are practical, high-frequency use cases that reflect real user intent from the start, rather than the more abstract life-domain categories from the Systems Framework document. The Framework's five Life Systems (Goal-Setting, Time Management, Health OS, Relationship, Personal Finance) and the PERO learning framework remain in-app as reference reading (the Guides/Tutorials tab, §6.0) - they inform *how* to fill in a system blueprint, not as templates to clone.
- **User-saved:** any System the user has built can be saved back as a personal template (e.g., they design one good studying system and want to reuse the shape for a different subject or course).

| Field | Notes |
|---|---|
| `id`, `name`, `source` | `built_in` / `user` |
| `default_protocol`, `default_floor_action`, `default_trigger_pattern` | pre-filled, fully editable on instantiation |
| `suggested_widgets` | which widget types this template typically pairs with (e.g., Health template suggests Timer + Counter + Chart) |

Stored in **D1**.

### 5.7 Review

Two levels, per `insights.md`'s point that review must happen *per system* but also have a place for an overall log.

**Per-System Review entry:**

| Field | Notes |
|---|---|
| `id`, `system_id`, `period_start`, `period_end` | |
| `what_worked` | |
| `what_broke` | |
| `worst_day_check` | Did the floor hold? (direct callback to the Systems Framework's weekly review questions) |
| `change_applied` | Free-text description of the actual edit made as a result of this review. This field is what closes the loop - it triggers a write back to the System record (protocol, floor_action, trigger, or schedule fields, whichever the user changed). See conflict note below. |

**`change_applied` conflict resolution:** A System can be edited directly (from its detail page) *and* via the review flow's `change_applied` write-back. If both happen, **the last write wins** - no merge, no conflict UI, no version branching. Rationale: this is a single-user personal app; concurrent edit conflicts from the same user on the same record are not a meaningful failure mode. The direct edit and the review edit are just two paths to the same UPDATE statement. The review entry's `change_applied` field is a text description of the *intent*, not a diff - if the user's direct edit and their review write-back contradict each other, the one that ran second is correct by definition. If this ever becomes a problem in practice, the first thing to add is a `system_version` integer incremented on each write, not a merge strategy.

**Review Day (global):**

A user-designated day of the week is the default review surface - opening it on that day shows every system due for review, one after another, in sequence. But review isn't gated to that day: any system can be reviewed independently from its own page at any time. The Review Day is a *convenience aggregation view*, not an exclusivity lock - this directly reflects the requirement that review "does not have to be exclusive to that day."

Stored in **D1** (structured, fixed-shape, fits the same reasoning as Systems/Instances).

## 6. Key User Flows

### 6.0 Onboarding (First-Run Experience)

The onboarding flow is the only time the user encounters the app's philosophy explicitly before they start building. It runs once, on first login after signup.

**Flow:**

1. **Landing page** (pre-auth) - single-page marketing/intro surface explaining the core concept (systems vs. goals, the floor action idea, what the app does). Two CTAs: Sign Up and Log In. No feature tour, no screenshots - just the philosophy and a CTA. Kept minimal because the user will learn by doing, not by reading about the app.
2. **Sign up** - email/password form (Better Auth). No OAuth in v1.
3. **Guides & Tutorials tab** (post-signup, first screen shown) - a dedicated in-app tab that surfaces the three core philosophy documents as readable content: a distilled version of the Systems Framework (the five-step build process), the floor/full concept, and how reviews work. The user is not forced to read it - they can skip directly to creating a system. But it's the first tab shown on first login to establish context. This tab is always accessible, not a one-time modal.
4. **"Create your first system" prompt** - after (or instead of) the guides, a persistent CTA to open the System Creator. The System Creator itself surfaces the three built-in templates (Reading System, Studying System, Workout System) as the first choice, making the first system creation low-friction.

**What onboarding does not do:**

- No multi-step wizard or forced flow (the user can navigate away at any step).
- No onboarding checklist ("complete your profile," "add your first habit," etc.) - that's the gamification pattern this product explicitly avoids.
- No email confirmation gate before first use - the user is in the app immediately after signup, no verification wall.

### 6.1 Create a System

Three entry points, same end state:

1. **From scratch** - empty form walking through Purpose -> Philosophy -> Protocol -> Floor Action -> Trigger -> Barrier List -> Schedule.
2. **From a template** - pick a built-in (Systems Framework) or personal template, fields pre-filled, user edits before saving.
3. **AI-assisted** - user describes a goal in plain language; AI proposes a draft System (protocol, floor action, trigger suggestion, barrier list) following the five-step framework's structure. Nothing saves until the user reviews and edits - AI output lands in the same editable form as manual creation, it doesn't bypass it.

All three converge on the same System Creator form before save - this matters for the auto-save principle (§4.3): the draft autosaves from the moment the form opens, regardless of entry point.

### 6.2 Build a Workspace

After (or during) System creation, the user opens the Workspace Builder: a drag-and-drop canvas, widgets pulled from the v1 catalog (§5.5), positioned and configured (e.g., a Counter widget configured with a unit label of "pages"). Templates suggest a starting widget set; the user can deviate freely.

### 6.3 Daily Execution (Dashboard)

The dashboard is the daily entry point. On load: any active System with a schedule matching today and no existing Instance gets one auto-created in `pending` state. The user marks each `full` / `floor` / `missed`, optionally drops into that system's Workspace to log details (timer session, counter tally, etc.). This is the highest-frequency screen and should remain the lowest-friction one in the app - minimal taps, no required fields beyond the state itself.

### 6.4 Weekly Review

On the user's chosen Review Day (or anytime, per-system): the app surfaces each due System with its week's Instance history (full/floor/missed counts) pre-populated. User answers the four review fields (§5.7), and critically, is prompted to translate `what_broke` into a `change_applied` that's written back into the System record. The loop is incomplete without this last step - a review that doesn't produce an edit is just a journal entry.

### 6.5 Iterate

Edited Systems take effect on their next scheduled Instance. Past Instances are never retroactively altered - history reflects what the system *was* at the time it ran, not what it later became. This preserves the integrity of the review-trend data (§5.5 streak/chart widgets).

## 7. Feature Priority

| Priority | Feature |
|---|---|
| **P0** | System Creator (manual), Instance auto-generation, Dashboard (full/floor/missed), basic Workspace with 3-4 widget types (Timer, Counter, Log, Checklist), Schedule (day/time window), per-System Review, Review Day aggregation view, Auth |
| **P1** | Built-in Systems Framework template library, user-saved templates, remaining widget types (Link list, Streak view, Progress chart, Notes), AI-assisted creation (suggest-only) |
| **P2** | Barrier List field, Environment cue field (both flagged in `insights.md` as research-backed additions, not yet validated against real usage), workspace widget reordering/resizing polish, export/backup |

## 8. AI Assist Scope (v1)

Confirmed scope: **optional, suggest-only**. Concretely:

- Entry point: a "Draft with AI" button inside the System Creator, never a separate auto-pilot flow.
- Input: a short freeform prompt from the user ("I want to build a daily reading habit").
- Output: a pre-filled (not pre-saved) draft of Purpose, Philosophy, Protocol, Floor Action, Trigger, and Barrier List - structured strictly to the five-step framework - landing in the same editable form fields as manual creation. AI output never bypasses the form.
- The user must explicitly save; nothing AI-generated is committed without a human edit pass. No background regeneration, no AI editing of existing live Systems.
- AI does not see or modify Instance/Review history in v1 - it only assists at creation time.

**Model:** `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` via Cloudflare Workers AI, called from the Hono API Worker using the `env.AI` binding (`env.AI.run('@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', { messages })`). This model is available on the free tier and is optimized for structured reasoning and JSON output. See the AI Workers doc for full prompt design, response parsing, and free-tier budget analysis.

**Free-tier viability:** Workers AI provides 10,000 Neurons/day on the free tier. A single AI-assist call at this model size costs approximately 60-120 Neurons (based on ~1,000 input tokens + ~800 output tokens at 32B parameter neuron rates). This supports dozens of system-creation calls per day - well within personal-app usage, and the feature is inherently low-frequency (a user creates a new system perhaps once per week, not once per minute).

**Graceful degradation:** if the daily neuron quota is exceeded, the API returns a clear error and the frontend displays a non-blocking message ("AI assist is unavailable today - you can still create the system manually"). The System Creator remains fully functional; AI assist is a convenience layer, not a dependency.

## 9. Templates Library

Three built-in templates ship with v1. These were chosen for their specificity and immediate practical value - a new user picks one and knows exactly what it maps to in their life:

### Reading System

- **Purpose (default):** Build a consistent daily reading habit
- **Floor action:** Open the book and read one paragraph
- **Protocol:** Read for [N] minutes after [trigger habit]
- **Trigger suggestion:** "After I brush my teeth at night"
- **Barrier list pre-fill:** Phone on nightstand, no fixed reading time, fall asleep before reading
- **Suggested widgets:** Counter (pages), Log (notes/reflections), Streak view

### Studying System

- **Purpose (default):** Study [subject] consistently using the PERO method
- **Floor action:** Open notes and read one heading
- **Protocol:** Prime (skim headings) -> Encode (explain in own words) -> Reference (Anki cards) -> Retrieve (recall without notes)
- **Trigger suggestion:** "After I sit at my desk in the morning"
- **Barrier list pre-fill:** Phone distractions, no clear stopping point, jumping straight to passive re-reading
- **Suggested widgets:** Timer (Pomodoro sessions), Checklist (PERO phases), Log (session notes), Counter (pages/problems covered)

### Workout System

- **Purpose (default):** Build a consistent exercise habit with progressive overload
- **Floor action:** Put on workout clothes and do one set
- **Protocol:** Warm-up -> Main lifts (log weight/reps) -> Cool-down
- **Trigger suggestion:** "After I eat breakfast"
- **Barrier list pre-fill:** No energy after work, skipping when traveling, no logged baseline
- **Suggested widgets:** Log (exercise sets: exercise name, weight, reps), Counter (total sets), Progress chart (weight over time), Checklist (warm-up/cool-down)

All three templates are clones at instantiation - the template itself is never mutated when the user edits their system. Field values are fully editable before and after saving. The Systems Framework's five Life Systems and the PERO framework remain as reference reading in the Guides tab, not as instantiable templates in v1.

## 10. Non-Functional Requirements

- **Performance:** Dashboard must load and render without a full-page SSR round trip - consistent with the CSR/SPA approach in the ADR; Instance auto-generation on load should not visibly block the UI (optimistic render, generate in background).
- **Data boundaries:** Per the ADR, the only data that should leave D1 is the Log/Journal widget's freeform entries (-> Mongo). If a later widget type turns out to need document-shaped storage, that's a new ADR decision, not a default.
- **Free-tier ceilings:** All structured data (Systems, Instances, Reviews, Schedules, Templates) must stay within D1's free-tier row limits at expected personal-use volume - at even heavy daily use across 10 active systems, this is on the order of a few thousand rows/year, far under the 100K writes/day ceiling.
- **Auth:** Single-user-per-account model is sufficient for v1; Better Auth's session-cookie approach (per ADR) means this is a logged-in-only app, no anonymous/guest mode.

## 11. Out of Scope (v1)

- Custom widget *types* (user-built widgets beyond configuring the existing catalog) - v2 idea.
- Multi-workspace-per-system (e.g., separate workspaces for different schedule windows of the same system).
- Notifications/reminders (push, email) for upcoming Instances or Review Day.
- Any cross-system aggregate dashboard beyond the Review Day view (e.g., a unified "life health score" across all systems) - interesting per `insights.md`'s mention of a health score, but scoped per-system for v1, not as a meta-metric.

## 12. Success Metrics

Since this is a single-user personal tool, "success" is usage-pattern-based rather than growth-based:

- **Floor-hold rate:** % of Instances marked `floor` or `full` (i.e., not `missed`) over rolling 4-week windows, per system - the core signal the whole product is designed around.
- **Review completion rate:** % of due weekly reviews actually completed with a `change_applied` field filled in (a review with no edit is a weak signal the loop isn't working as intended).
- **System survival rate:** % of Systems still `active` (not abandoned/archived) 8 weeks after creation.

## 13. Resolved Decisions Log

Previously open questions, now closed:

| # | Question | Decision |
|---|---|---|
| 1 | Instance pre-generation timing | Dual-path: lazy on dashboard load (safety net) + nightly Cron Trigger at ~11 PM Manila time (convenience). See §5.3 and ADR §5.8. |
| 2 | File storage in workspaces | R2 is a v1 dependency. Attachments are supported from day one on the Log and Link List widgets. See ADR §5.7. |
| 3 | Barrier List & Environment Cue fields in System Creator | Included from day one - both are directly research-backed (§4 principles) and belong in the creation flow, not deferred. |
| 4 | Template-to-System divergence | Templates are clone-on-instantiation. The user's System is always independent of the template it came from; the built-in templates are never mutated by user edits. Personal templates work the same way. |

---

*This PRD treats `Philosophy.md`, `Systems Framework.md`, and `insights.md` as living source documents. Any feature change that can't be traced to a principle in those three files should be treated as a deviation worth questioning, not a default to build.*
