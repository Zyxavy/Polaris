# SvelteKit Route Architecture

**Project:** *Polaris*

**Document type:** Frontend architecture -- the page tree, auth guard, store design, component hierarchy, and navigation model for `packages/web`. Companion to the [API Route Design](api-routes.md) (owns every endpoint this frontend calls), [Auth Integration](auth-integration.md) (owns `authClient`/session primitives this document consumes), and the [PRD](../PRD/PRD-systems-app.md) (owns the user flows this route tree implements).
**Status:** Draft -- v1 scope

**Implementation status:** Planned / Target Architecture

**Last updated:** July 2, 2026

---

## 1. Foundational Constraints

ADR 001 S5.2 disables SSR entirely -- SvelteKit is served as static assets with zero Worker invocation for the frontend. This has one structural consequence that shapes every route below: **there is no server-side code in `packages/web` at all.** Every `load` function is a **universal** `+page.ts` / `+layout.ts` (not `+page.server.ts`), which SvelteKit runs client-side when SSR is off.

```typescript
// packages/web/src/routes/+layout.ts
export const ssr = false;
export const prerender = false;
```

Set once at the root; every route inherits it. Every load function's `fetch` call to `/api/*` must still set `credentials: 'include'` explicitly (Auth Integration S2) -- SvelteKit's enhanced `fetch` only auto-forwards cookies during SSR, which this app never does.

### 1.1 Theme boot before first paint

Because SSR is disabled, the frontend must set the theme before Svelte mounts or users will see a flash of the wrong theme. `packages/web/src/app.html` should include a tiny inline script in `<head>` that reads `localStorage.theme`, falls back to `prefers-color-scheme`, and sets `document.documentElement.dataset.theme` to `light` or `dark` before the app bundle loads. The Svelte theme toggle then updates the same `data-theme` attribute and persists the value back to `localStorage`.

```html
<script>
  (() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = stored || (prefersDark ? 'dark' : 'light');
  })();
</script>
```

Keep this script dependency-free and synchronous. It exists only to prevent theme flash; all interactive theme UI still lives in Svelte.

---

## 2. Route Tree

```
src/routes/
├── +layout.ts                    # ssr=false, prerender=false (root, S1)
├── +layout.svelte                # renders <slot/> with no chrome -- session resolved here
│
├── (marketing)/
│   └── +page.svelte              # /  -- Landing page (pre-auth only), PRD 6.0 step 1
│
├── (auth)/                       # Pre-auth route group -- no nav shell, centered form layout
│   ├── +layout.svelte            # Redirects signed-in users to /guides
│   ├── sign-up/
│   │   └── +page.svelte          # Sign Up form, Auth Integration 4.2
│   └── sign-in/
│       └── +page.svelte          # Sign In form, Auth Integration 4.2
│
└── (app)/                        # Post-auth route group -- nav shell, auth guard
    ├── +layout.ts                # Auth guard load function (S3)
    ├── +layout.svelte            # Nav sidebar shell (S4)
    │
    ├── guides/
    │   └── +page.svelte          # Guides & Tutorials tab, PRD 6.0 step 3
    │
    ├── dashboard/
    │   ├── +page.ts              # loads GET /api/dashboard
    │   └── +page.svelte          # Daily Dashboard, PRD 6.3
    │
    ├── systems/
    │   ├── +page.ts              # loads GET /api/systems
    │   ├── +page.svelte          # "All systems" list view
    │   ├── new/
    │   │   └── +page.svelte      # System Creator, PRD 6.1
    │   └── [id]/
    │       ├── +layout.ts        # loads GET /api/systems/:id once, shared by all tabs below
    │       ├── +layout.svelte    # System detail shell: tabs for Overview / Workspace / Reviews
    │       ├── +page.svelte      # Overview tab: blueprint fields, streak/calendar, PRD 6.5
    │       ├── edit/
    │       │   └── +page.svelte  # Edit System (reuses System Creator form)
    │       ├── workspace/
    │       │   ├── +page.ts      # loads GET /api/systems/:id/workspace
    │       │   └── +page.svelte  # Workspace Builder, PRD 6.2
    │       └── reviews/
    │           ├── +page.ts      # loads GET /api/systems/:id/reviews
    │           ├── +page.svelte  # Per-system review history + "start a review" entry point
    │           └── new/
    │               └── +page.svelte  # Per-system Review form, PRD 6.4
    │
    └── review-day/
        ├── +page.ts              # loads GET /api/review-day
        └── +page.svelte          # Review Day aggregation view, PRD 5.7
```

### 2.1 Route group rationale

Route groups (parenthesized directories) apply different layouts without changing the URL:

- **`(marketing)`** -- the landing page has no chrome at all. Separate group so it never inherits the auth form shell.
- **`(auth)`** -- sign-up/login share a centered minimal form layout. Redirects signed-in users away.
- **`(app)`** -- every authenticated page has the nav sidebar and requires a valid session.

If a future pass wants a shared "unauthenticated" layout across both marketing and auth pages (e.g. a site-wide header), that's a one-file addition without restructuring routes.

### 2.2 Why `[id]` gets its own nested layout

`systems/[id]/+layout.ts` loads the System record once via `GET /api/systems/:id` and exposes it through `PageData` to every child route -- the Overview tab, workspace, reviews, and edit page all share the same fetched record rather than independently re-fetching. This matters because the System detail page is a tabbed interface: navigating between Overview/Workspace/Reviews should feel instant, not re-trigger a full-page loading state. SvelteKit's nested-layout data model gives this for free.

### 2.3 What is NOT a route in v1

| Possible route | Reason omitted |
|---|---|
| `/account` | Recovery codes display + regenerate; no other account settings in v1 |
| `/terms`, `/privacy` | Personal app, no legal surface in v1 |
| `/auth/forgot-password` | Password reset deferred (Auth Integration 5) |
| `/attachments/:id` | Handled by the API route directly as a streamed URL, not a SvelteKit page |
| `/templates` | Template browser deferred; templates are selected inline during System creation |

---

## 3. Auth Guard

The auth guard lives in `(app)/+layout.ts`, **not** the root layout. The root layout resolves the session but does not redirect -- that responsibility belongs to each route group's own layout.

### 3.1 Root layout load function

```typescript
// packages/web/src/routes/+layout.ts
import type { LayoutLoad } from './$types';

export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async () => {
  // Session is resolved here so child layouts and pages can access it via data.session.
  // The root layout never redirects -- each route group's own layout decides.
  return {};
};
```

### 3.2 Root layout component

The root layout is intentionally thin -- it renders children with no chrome. It does not import `authClient` or any auth logic. Its only job is to be the render root.

```svelte
<!-- packages/web/src/routes/+layout.svelte -->
<script lang="ts">
  let { children } = $props();
</script>

{@render children()}
```

### 3.3 App group auth guard

```typescript
// packages/web/src/routes/(app)/+layout.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { authClient } from '$lib/auth-client';

export const load: LayoutLoad = async () => {
  // getSession() is the SDK's non-reactive API -- it returns a promise, works in load context.
  // This avoids duplicating Better Auth's session-check contract in a hand-rolled fetch.
  const { data: session } = await authClient.getSession();

  if (!session) {
    throw redirect(302, '/sign-in');
  }

  return { session };
};
```

Every route under `(app)/` inherits this guard. No individual page needs its own auth check -- a page component under `(app)/` can assume `data.session` is present.

**Sign-out** does not need a symmetric guard. `authClient.signOut()` clears the session cookie, and the next navigation to any `(app)/` route re-runs this load function and redirects to `/sign-in`.

### 3.4 Auth group layout (pre-auth)

```svelte
<!-- packages/web/src/routes/(auth)/+layout.svelte -->
<script lang="ts">
  import { redirect } from '@sveltejs/kit';
  import { authClient } from '$lib/auth-client';

  let { children, data } = $props();

  // Check session on mount -- if already signed in, redirect to guides
  const { data: session } = authClient.useSession();
  $effect(() => {
    if ($session) {
      throw redirect(302, '/guides');
    }
  });
</script>

<div class="auth-shell">
  {#if !$session}
    {@render children()}
  {/if}
</div>
```

The `auth-shell` wrapper is centered, minimal styling (logo/title at top, form below). It renders children only when there is no active session -- this prevents the sign-in form from flashing momentarily before redirect.

### 3.5 Marketing layout

```svelte
<!-- packages/web/src/routes/(marketing)/+layout.svelte -->
<script lang="ts">
  let { children } = $props();
</script>

{@render children()}
```

No chrome, no auth check. The landing page is always reachable.

---

## 4. App Group Layout -- Nav Shell

```svelte
<!-- packages/web/src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import { authClient } from '$lib/auth-client';
  import NavBar from '$lib/components/NavBar.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import type { PageData } from './$types';

  let { children, data } = $props();
  const session = data.session;
</script>

<NavBar {session} />
<ToastContainer />
<main>
  {@render children()}
</main>
```

The NavBar is the app's primary navigation. It renders the following items:

| Tab | Route | Shown when |
|---|---|---|
| Dashboard | `/dashboard` | Always, default active |
| Guides | `/guides` | Always, highlighted on first visit post-signup |
| Review Day | `/review-day` | Always, with a badge if any system is due |
| Systems | `/systems` | Always |

The NavBar also shows the user's name/email (from `session.user`) and a sign-out button that calls `authClient.signOut()` and navigates to `/`.

`<ToastContainer>` is mounted here -- the one place in the app where `toastStore.items` is rendered (S5.4). No page below `(app)/` re-declares it.

---

## 5. Store Design

All stores use Svelte 5 `$state` runes (not `svelte/store` `writable`), except where Better Auth's client provides its own store.

### 5.1 Auth client

```typescript
// packages/web/src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

export const { useSession, signIn, signOut, signUp } = authClient;
```

`useSession()` is a runes-compatible reactive store from `better-auth/svelte`. Used in the auth group layout (S3.4) for display and in the NavBar (S4) for showing the user's name. The auth guard (S3.3) uses `authClient.getSession()` instead -- the SDK's non-reactive API that returns a promise and works inside `load` functions.

### 5.2 Dashboard store

```typescript
// packages/web/src/lib/stores/dashboard.svelte.ts
class DashboardStore {
  instances = $state<Instance[]>([]);

  load(instances: Instance[]) {
    this.instances = instances;
  }

  async markState(instanceId: string, state: 'full' | 'floor' | 'missed') {
    const idx = this.instances.findIndex(i => i.id === instanceId);
    if (idx === -1) return;

    const prev = this.instances[idx];
    this.instances[idx] = { ...prev, state };

    try {
      const updated = await patchInstance(instanceId, { state });
      this.instances[idx] = updated;
    } catch (e) {
      this.instances[idx] = prev;
      toastStore.push({ type: 'error', message: 'Could not save -- try again.' });
    }
  }
}

export const dashboardStore = new DashboardStore();
```

`dashboard/+page.ts`'s `load` function calls `GET /api/dashboard` and calls `dashboardStore.load(data.instances)` -- the store, not the page component, is the single source of truth for Instance state on the Dashboard. The optimistic-update-with-rollback pattern here is what PRD S10's non-functional requirement ("Instance auto-generation on load should not visibly block the UI") cashes out to at the Dashboard's most frequent interaction: marking full/floor/missed needs to feel instant.

### 5.3 Workspace editor store

```typescript
// packages/web/src/lib/stores/workspace-editor.svelte.ts
class WorkspaceEditorStore {
  layout = $state<Layout | null>(null);
  dirty = $state(false);
  systemId = $state('');

  load(systemId: string, layout: Layout) {
    this.systemId = systemId;
    this.layout = layout;
    this.dirty = false;
  }

  addWidget(widget: Widget) {
    this.layout!.widgets.push(widget);
    this.dirty = true;
  }

  removeWidget(id: string) {
    this.layout!.widgets = this.layout!.widgets.filter(w => w.id !== id);
    this.dirty = true;
  }

  reorder(widgets: Widget[]) {
    this.layout!.widgets = widgets;
    this.dirty = true;
  }

  async save() {
    const saved = await putWorkspace(this.systemId, this.layout);
    this.layout = saved.layout;
    this.dirty = false;
  }
}
```

Scoped to the Workspace Builder page only -- instantiated fresh per visit, not a singleton like `dashboardStore`. `dirty` backs a "you have unsaved changes" guard on navigation-away.

### 5.4 Toast store

```typescript
// packages/web/src/lib/stores/toast.svelte.ts
class ToastStore {
  items = $state<{ id: string; type: 'error' | 'info'; message: string }[]>([]);

  push(item: { type: 'error' | 'info'; message: string }) {
    const id = crypto.randomUUID();
    this.items = [...this.items, { id, ...item }];
    setTimeout(() => {
      this.items = this.items.filter(i => i.id !== id);
    }, 4000);
  }
}

export const toastStore = new ToastStore();
```

The single consumer of every API error across the app (S6). Rendered by `<ToastContainer>` in the app layout (S4).

---

## 6. API Client Wrapper

Every `load` function and store action goes through one wrapper rather than calling `fetch` directly, so `credentials: 'include'` and the error contract are enforced in one place.

```typescript
// packages/web/src/lib/api/client.ts
import { toastStore } from '$lib/stores/toast.svelte';

const BASE = import.meta.env.VITE_API_BASE_URL;

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'unknown', message: 'Something went wrong.' }));
    throw new ApiError(res.status, body.error, body.message);
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

`apiFetch` throws `ApiError` on non-2xx responses -- it does **not** push toasts itself. Error-toast handling happens at the store or component level so call sites that need to opt out (e.g. `floor_action_required` from `POST /api/systems/:id/confirm` should surface as inline form validation, not a toast) can `catch` the `ApiError` and handle it differently without fighting a built-in toast.

A higher-order wrapper for store and load-function usage handles the common case (default: push a toast):

```typescript
// packages/web/src/lib/api/index.ts
import { apiFetch, ApiError } from './client';
import { toastStore } from '$lib/stores/toast.svelte';

export async function apiFetchWithToast<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(path, options);
  } catch (e) {
    if (e instanceof ApiError && e.status < 500) {
      toastStore.push({ type: 'error', message: e.message });
    }
    throw e;
  }
}
```

Thin typed helpers per resource group:

```
src/lib/api/
├── client.ts          # apiFetch, ApiError
├── index.ts           # apiFetchWithToast (default toast on client error)
├── systems.ts         # getSystems, createSystem, patchSystem, confirmSystem, archiveSystem
├── instances.ts       # patchInstance, getInstance
├── dashboard.ts       # getDashboard
├── schedules.ts       # getSchedules, createSchedule, patchSchedule, deleteSchedule
├── workspaces.ts      # getWorkspace, putWorkspace
├── counter-logs.ts    # createCounterLog, getCounterLogs, deleteCounterLog
├── timer-sessions.ts  # createTimerSession, getTimerSessions, deleteTimerSession
├── checklist.ts       # putChecklist, getChecklist
├── link-list.ts       # getLinkList, putLinkList
├── notes.ts           # getNotes, putNotes
├── reviews.ts         # getReviews, createReview
├── review-day.ts      # getReviewDay
├── templates.ts       # getTemplates, getTemplate
├── attachments.ts     # uploadAttachment, getAttachmentUrl
└── ai.ts              # draftSystem
```

One file per resource group, mirroring API Route Design's section numbering, so a given endpoint's frontend helper is easy to find.

---

## 7. Component Hierarchy Per Page

Only pages with non-trivial composition are broken down -- simple pages (Guides, marketing landing page, sign-up/login forms) are single-component and don't need a hierarchy diagram.

### 7.1 Dashboard (`(app)/dashboard/+page.svelte`)

```
+page.svelte
├── +page.ts          # calls apiFetchWithToast('GET /api/dashboard'), passes to dashboardStore.load()
└── <InstanceList instances={dashboardStore.instances}>
    └── <InstanceCard> (one per instance)
        ├── <SystemBadge domain floor_action />
        ├── <StateButtons state onMark={dashboardStore.markState} />  -- full / floor / missed
        └── <WorkspaceLink systemId />
```

### 7.2 System Creator (`(app)/systems/new/+page.svelte`)

Design override: `design-system/polaris/pages/system-creator.md`. This page is a single scrollable form with stepper-styled section markers, not a gated wizard, so autosave can track every field from one form state.

```
+page.svelte
├── <TemplatePicker templates onSelect />       -- built-ins + user templates, GET /api/templates
├── <AIDraftPanel onDraft />                    -- "Draft with AI" button + prompt, POST /api/ai/draft-system
└── <SystemForm>
    ├── field groups: Purpose, Philosophy, Protocol, Floor Action, Trigger, Barrier List, Environment Cue, Schedule
    ├── autosave: debounced PATCH on every field change (AUTOSAVE_DEBOUNCE_MS)
    └── <ConfirmButton onClick={() => confirmSystem(id)} />  -- POST /api/systems/:id/confirm
```

`<TemplatePicker>` and `<AIDraftPanel>` both write into the same `<SystemForm>` field state rather than bypassing it -- this implements PRD 6.1's "AI output never bypasses the form" and PRD 5.6's "clone at instantiation, fully editable" for templates. Neither component ever calls `POST /api/systems` itself.

The edit route (`/systems/[id]/edit`) reuses `<SystemForm>` pre-filled from the existing System record, with the same autosave pattern.

### 7.3 Workspace Builder (`(app)/systems/[id]/workspace/+page.svelte`)

Design override: `design-system/polaris/pages/workspace-builder.md`. This page uses a drag-and-drop bento canvas with palette/canvas/save zones and widget-specific persistent content rules.

```
+page.svelte
├── +page.ts          # calls apiFetchWithToast('GET /api/systems/:id/workspace')
├── <WidgetPalette onAdd={workspaceEditorStore.addWidget} />   -- v1 widget catalog, PRD 5.5
├── <WorkspaceCanvas layout={workspaceEditorStore.layout}>     -- svelte-dnd-action drag surface
│   └── <WidgetCard> (one per widget in layout.widgets, dispatches by type)
│       ├── <TimerWidget />        -- POST/GET timer-sessions, API Route Design 6.2
│       ├── <CounterWidget />      -- POST/GET counter-logs, 6.1
│       ├── <ChecklistWidget />    -- PUT/GET checklist, 6.3
│       ├── <LogWidget />          -- Mongo-backed journal
│       ├── <LinkListWidget />     -- PUT/GET link-list, API Route Design 6.4
│       ├── <StreakWidget />       -- read-only, derived from GET /api/systems/:id/instances
│       ├── <ProgressChartWidget />-- read-only, GET counter-logs or timer-sessions
│       └── <NotesWidget />        -- PUT/GET notes, API Route Design 6.5
└── <SaveBar dirty={workspaceEditorStore.dirty} onSave={workspaceEditorStore.save} />
```

`<WidgetCard>`'s type-dispatch is the one piece of client-side logic that must stay in sync with D1 Schema S3.3.1's widget catalog and the layout JSON schema (D1 Schema S3.4). A new widget type requires: a new case in this dispatch, a new `suggested_widgets` string in Templates, and (if it logs numeric/timed data) a new typed table -- all three in the same PR.

### 7.4 Per-System Review Form (`(app)/systems/[id]/reviews/new/+page.svelte`)

```
+page.svelte
├── +page.ts          # loads GET /api/systems/:id/instances?from=...&to=... for the review period
├── <InstanceSummary counts={{ full, floor, missed }} />
└── <ReviewForm>
    ├── what_worked, what_broke, worst_day_check fields
    ├── current System blueprint fields rendered as editable text areas (floor_action, purpose, etc.)
    │   -- user edits these directly; changed values are collected into the change_applied structured object
    ├── <ChangeAppliedNote />  -- optional free-text override for the auto-derived review description
    └── <SubmitButton />  -- POST /api/systems/:id/reviews, handles 409 review_already_exists inline
```

Per PRD 6.4, the review form displays the current System blueprint fields alongside the review fields as editable text areas. When the user changes a value (e.g. lowers `floor_action`), that change is written back via the `change_applied` structured object in `POST /api/systems/:id/reviews`. This is inline editing of the System fields -- not checkboxes or a diff editor. The user's own words for the review description go into `change_applied_note` if they want something different from the auto-derived description.

### 7.5 Review Day (`(app)/review-day/+page.svelte`)

```
+page.svelte
├── +page.ts          # calls apiFetchWithToast('GET /api/review-day')
└── <DueReviewList due={data.due}>
    └── <DueReviewCard>
        ├── system name, floor_action
        ├── <InstanceSummary counts={instance_summary} />  -- same component as 7.4
        └── <StartReviewButton href="/systems/{id}/reviews/new?period_start=...&period_end=..." />
```

Reuses `<InstanceSummary>` from 7.4 -- both contexts show the identical full/floor/missed breakdown for a period.

### 7.6 System Detail (`(app)/systems/[id]/+page.svelte`)

```
+page.svelte
└── <SystemBlueprint system={data.system} />    -- reads from nested layout's loaded data
    ├── all blueprint fields (read-only in overview mode)
    ├── current schedule (days, time window)
    ├── instance streak/calendar (GET /api/systems/:id/instances)
    └── action links: Edit, Workspace, Review, Archive
```

---

## 8. Build Configuration

### 8.1 Vite proxy (development)

In development, the SvelteKit dev server runs on `localhost:5173` and the API Worker runs on `localhost:8787`. `vite.config.ts` proxies `/api/*` requests to the API Worker:

```typescript
// packages/web/vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
```

Better Auth's CSRF check can reject proxied requests if `changeOrigin` strips the `Origin` header -- verify this works end-to-end during scaffolding by signing up in dev and confirming the session cookie is set and honored (Auth Integration 3).

### 8.2 Environment variables

| Variable | Dev value | Prod value | Used in |
|---|---|---|---|
| `VITE_API_BASE_URL` | `''` (empty -- same-origin via proxy) | `https://polaris-api.kelpselp.workers.dev` | `auth-client.ts`, `api/client.ts` |

In dev, the proxy handles `/api/*` so `VITE_API_BASE_URL` is empty string and fetch paths are relative (`/api/systems`). In production, the frontend and API are on separate subdomains, so `VITE_API_BASE_URL` is the full origin of the API Worker.

### 8.3 Static adapter

```typescript
// packages/web/svelte.config.js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',     // SPA fallback -- all routes served from index.html
      precompress: false,          // wrangler handles compression
    }),
    paths: {
      relative: true,
    },
  },
};
```

`fallback: 'index.html'` is critical for SPA on Workers Static Assets -- without it, navigating directly to `/dashboard` would 404. With the fallback, any non-file path serves `index.html` and SvelteKit's client-side router takes over.

---

## 9. Navigation Model Summary

| From | Action | Target |
|---|---|---|
| Anywhere | Sign-up success | `/guides` |
| Anywhere | Sign-in success | `/dashboard` |
| `/sign-in`, `/sign-up` | Already signed in | `/guides` |
| Any `(app)/*` route | Session lost / expired | `/sign-in` |
| `/` | Click "Get Started" | `/sign-up` |
| `/` | Click "Log In" | `/sign-in` |
| NavBar | Click Dashboard | `/dashboard` |
| NavBar | Click Guides | `/guides` |
| NavBar | Click Review Day | `/review-day` |
| NavBar | Click Systems | `/systems` |
| Dashboard | Click "Create System" | `/systems/new` |
| Dashboard | Click system card | `/systems/[id]` |
| System detail | Click "Edit" | `/systems/[id]/edit` |
| System detail | Click "Workspace" | `/systems/[id]/workspace` |
| System detail | Click "Review" | `/systems/[id]/reviews/new` |
| Review Day | Click "Start Review" | `/systems/[id]/reviews/new?period_start=...&period_end=...` |
| NavBar | Click sign-out | `/` |
