# SvelteKit Route Architecture

**Project:** *Polaris*
**Document type:** Frontend architecture -- the page tree, auth layout, store structure, and navigation model. Companion to the [Auth Integration](ADRs/006-auth-integration.md) doc (owns the `authClient` and `useSession()` primitives this document consumes), the [API Route Design](ADRs/005-api-routes.md) doc (owns the endpoints each page calls), and the [PRD](../PRD/PRD-systems-app.md) (owns the user flows this route tree implements).
**Status:** Draft -- v1 scope
**Last updated:** July 1, 2026

---

## 1. Route Tree

All routes live under `packages/web/src/routes/`. The frontend is a CSR SPA (ADR 001 -- SSR disabled), so these are client-side route definitions, not server-rendered pages.

```
+layout.svelte          # Root layout: auth guard + nav shell
+layout.ts              # Root layout load: session check, redirect logic
|
+-- page.svelte         # /  -- Landing page (pre-auth only)
|
+-- (auth)/             # Auth route group -- no nav shell, pre-auth only
|   +-- layout.svelte   # Redirects to /guides or /dashboard if already signed in
|   +-- sign-in/
|   |   +-- page.svelte # Sign In form
|   +-- sign-up/
|       +-- page.svelte # Sign Up form
|
+-- (app)/              # App route group -- post-auth, nav shell
    +-- layout.svelte    # Check authClient.useSession(); redirect to /auth/sign-in if null
    |                    # Renders NavBar + slot for child routes
    |
    +-- guides/
    |   +-- page.svelte  # Guides & Tutorials tab (PRD 6.0)
    |
    +-- dashboard/
    |   +-- page.svelte  # Daily Dashboard (PRD 6.3)
    |
    +-- systems/
    |   +-- new/
    |   |   +-- page.svelte  # System Creator (PRD 6.1)
    |   +-- [id]/
    |       +-- page.svelte  # System detail page
    |       +-- edit/
    |       |   +-- page.svelte  # Edit System (reuses System Creator form)
    |       +-- workspace/
    |       |   +-- page.svelte  # Workspace Builder (PRD 6.2)
    |       +-- review/
    |           +-- page.svelte  # Per-system Review (PRD 6.4)
    |
    +-- review-day/
    |   +-- page.svelte  # Review Day aggregation view (PRD 5.7)
    |
    +-- templates/
        +-- page.svelte  # Optional: user-saved templates browser
```

### 1.1 Route group rationale

The `(auth)` and `(app)` route groups use SvelteKit's route-group convention (parentheses) to apply different layouts to pre-auth and post-auth pages without nesting them under different URL prefixes. Both groups sit at the same URL depth (`/sign-in`, `/guides`, `/dashboard`, etc.) but the `(app)` group renders the NavBar and requires authentication, while the `(auth)` group renders a standalone form layout with no nav and redirects signed-in users away.

### 1.2 What is NOT a route in v1

| Possible route | Reason omitted |
|---|---|
| `/account` | No account settings UI in v1 -- if needed, future additive |
| `/terms`, `/privacy` | Personal app, no legal surface in v1 |
| `/auth/forgot-password` | Password reset deferred (see Auth Integration 5) |
| `/attachments/:id` | Handled by the API route directly as a streamed URL, not a SvelteKit page |

---

## 2. Auth Guard (Root Layout)

### 2.1 Layout load function

```typescript
// packages/web/src/routes/+layout.ts
import type { LayoutLoad } from './$types';
import { authClient } from '$lib/auth-client';

export const ssr = false;          // CSR-only, per ADR 001 5.2
export const prerender = false;    // All pages are dynamic

export const load: LayoutLoad = async () => {
  // useSession() is a runes-compatible store from better-auth/svelte
  // On first call, it fires a fetch to /api/auth/session to hydrate the session
  // Subsequent calls read the cached session store
  const { data: session } = authClient.useSession();
  return { session };
};
```

### 2.2 Root layout component

The root layout is intentionally thin -- it calls the `load` function and hands off to the child layout. It does not render any UI itself (no nav, no header). Its only job is to wait for the session to resolve and let the child layouts decide how to handle the auth state.

```svelte
<!-- packages/web/src/routes/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { authClient } from '$lib/auth-client';

  let { children } = $props();

  const { data: session } = authClient.useSession();
  let checking = $state(true);

  onMount(() => {
    // useSession() may still be loading on first mount
    // Wait one tick for the session fetch to resolve
    checking = false;
  });

  // If session is resolved and null, redirect to sign-in
  // (unless already on an auth page)
  $effect(() => {
    if (!checking && !$session && !$page.url.pathname.startsWith('/auth/') && $page.url.pathname !== '/') {
      goto('/auth/sign-in');
    }
  });
</script>

{@render children()}
```

When `useSession()` has finished its initial fetch (which calls `GET /api/auth/session` internally) and returned `null` (no valid session), the effect fires and redirects any non-auth page to `/auth/sign-in`. While the session is still loading, the effect does not fire (no redirect during hydration). The auth group layout handles the reverse case (redirecting signed-in users away from auth pages).

---

## 3. Auth Group Layout (Pre-Auth)

```svelte
<!-- packages/web/src/routes/(auth)/+layout.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { authClient } from '$lib/auth-client';

  let { children } = $props();
  const { data: session } = authClient.useSession();

  onMount(() => {
    // If already signed in, redirect to the appropriate post-auth destination
    // First-time users go to /guides; returning users go to /dashboard
    // This distinction is determined by the sign-up flow setting a flag,
    // but for redirect-from-auth-page purposes, /guides is the safer default
    // (it's the post-signup landing per PRD 6.0)
    if ($session) {
      goto('/guides');
    }
  });
</script>

<div class="auth-shell">
  {#if !$session}
    {@render children()}
  {/if}
</div>
```

The `auth-shell` wrapper is centered, minimal styling (logo/title at top, form below). It renders children only when there is no active session -- this prevents the sign-in form from flashing momentarily before the redirect.

---

## 4. App Group Layout (Post-Auth, NavBar)

```svelte
<!-- packages/web/src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import { authClient } from '$lib/auth-client';
  import NavBar from '$lib/components/NavBar.svelte';

  let { children } = $props();
  const { data: session } = authClient.useSession();

  // If session becomes null mid-session (token expired, signed out in another tab),
  // the root layout's effect redirects to /auth/sign-in
</script>

{#if $session}
  <NavBar {session} />
  <main>
    {@render children()}
  </main>
{/if}
```

The NavBar is the app's primary navigation. It renders the following items (PRD 6.0, 6.3, 6.4):

| Tab | Route | Shown when |
|---|---|---|
| Dashboard | `/dashboard` | Always, default active |
| Guides | `/guides` | Always, highlighted on first visit post-signup |
| Review Day | `/review-day` | Always, with a badge if any system is due |
| Templates | `/templates` | Always, less prominent |
| Profile / Settings | -- | Only logout button via dropdown |

The NavBar also shows the user's name/email (from `session.user`) and a sign-out button that calls `authClient.signOut()` and navigates to `/`.

---

## 5. Page Descriptions

### 5.1 `/` -- Landing Page (Pre-Auth)

Single-page marketing/intro surface per PRD 6.0(1). Explains: systems vs. goals, the floor action concept, what the app does. Two CTAs: Sign Up and Log In. No feature tour, no screenshots. The philosophy is the product; the page is minimal and text-forward.

This page is always reachable (no auth guard) and is the default redirect target after sign-out.

### 5.2 `/auth/sign-in` and `/auth/sign-up`

Both are thin wrappers around `authClient.signIn.email()` and `authClient.signUp.email()` respectively. The Auth Integration doc (4.2) owns the exact field-by-field form logic. Key routing behavior:

- **Sign-up success** (`authClient.signUp.email()` returns without error) -> redirect to `/guides` (PRD 6.0(3): "Guides & Tutorials tab (post-signup, first screen shown)").
- **Sign-in success** -> redirect to `/dashboard` (PRD 6.0 flow: "signs back in -> lands on Dashboard").

### 5.3 `/guides` -- Guides & Tutorials

PRD 6.0(3): surfaces three core philosophy documents: Systems Framework (five-step build process), floor/full concept, and how reviews work. Always accessible from the NavBar. Rendered as a scrollable document, not a wizard.

### 5.4 `/dashboard` -- Daily Dashboard

PRD 6.3. The highest-frequency screen. On load:

1. Calls `GET /api/dashboard` (which triggers lazy Instance generation server-side).
2. Renders each Instance as a card (system name, domain, floor_action, state selector).
3. User taps `full`, `floor`, or `missed` -- calls `PATCH /api/instances/:id` with the new state.
4. Card updates optimistically.

Each card links to the System's Workspace (`/systems/[id]/workspace`) and the System's detail page (`/systems/[id]`).

The "Create system" button is prominently placed (FAB or similar) and links to `/systems/new`.

### 5.5 `/systems/new` -- System Creator

PRD 6.1. Three entry points, one form:

1. **From scratch:** empty form.
2. **From template:** `?template=tpl_reading_system` query param triggers pre-fill from `GET /api/templates/:id`.
3. **AI-assisted:** `?ai=1` shows a text input at the top; user types a prompt, clicks "Draft with AI" (`POST /api/ai/draft-system`), output fills the form.

The form walks through the five-step process as sections (Purpose, Philosophy, Protocol, Floor Action, Trigger, Barrier List, Schedule). Autosave fires on a debounced timer (`AUTOSAVE_DEBOUNCE_MS`), calling `POST /api/systems` on first save and `PATCH /api/systems/:id` thereafter.

The primary "Save" button (distinct from autosave) calls `POST /api/systems/:id/confirm` after the initial save has created the row, enforcing `floor_action` non-emptiness at the API layer.

On successful save: redirect to `/dashboard`.

### 5.6 `/systems/[id]` -- System Detail Page

Displays the System's full blueprint (all fields), current schedule, recent Instance history (weekly calendar/strip), and links to workspaces, editing, review, and archiving.

### 5.7 `/systems/[id]/edit` -- Edit System

Reuses the System Creator form component, pre-filled from the existing System record (`GET /api/systems/:id`). Same autosave behavior. Save calls `PATCH /api/systems/:id`.

### 5.8 `/systems/[id]/workspace` -- Workspace Builder

PRD 6.2. Drag-and-drop widget canvas built with `svelte-dnd-action`. Loads the current `layout` JSON from `GET /api/systems/:system_id/workspace`. The user adds/removes/reorders widgets; saving calls `PUT /api/systems/:system_id/workspace` with the complete layout.

Each widget renders its own data: Counter shows logged values, Timer shows start/stop, Checklist shows editable steps, Streak shows a calendar heatmap, etc.

Widgets that log per-instance data (Counter, Timer, Checklist) are interactive on this page -- they can be used during the instance's execution window.

### 5.9 `/systems/[id]/review` -- Per-System Review

PRD 6.4. Loads the past week's Instance history (`GET /api/systems/:system_id/instances?from=...&to=...`) and pre-populates the review form. Fields: what_worked, what_broke, worst_day_check (boolean), and the change_applied system fields editor.

The form displays the current System blueprint fields as editable text areas alongside the review fields. When the user fills in a `change_applied` field, that change is written back to the System via `POST /api/systems/:system_id/reviews`.

### 5.10 `/review-day` -- Review Day Aggregation

PRD 5.7. Calls `GET /api/review-day` to fetch all systems due for review. Renders each as a card with instance_summary (full/floor/missed counts) and a "Start review" button linking to `/systems/[id]/review`. Acts as an index into the per-system review pages.

---

## 6. Store Architecture

### 6.1 Auth store (from `better-auth/svelte`)

```typescript
// packages/web/src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

export const { useSession, signIn, signOut, signUp } = authClient;
```

`useSession()` is the only auth store in the app. It returns a Svelte 5 runes-compatible reactive store. Used in the root layout for the auth guard and in the NavBar for displaying the user's name.

### 6.2 Application stores

| Store | Purpose | File |
|---|---|---|
| `activeSystemStore` | Currently selected system ID (for drill-down navigation) | `$lib/stores/navigation.ts` |
| `toastStore` | Non-blocking toast messages (success, error, info) | `$lib/stores/toast.ts` |
| `dashboardStore` | Cached dashboard instances (re-fetched on focus/navigation) | `$lib/stores/dashboard.ts` |

These are minimal stores -- most page state is fetched per-page and held in local `$state()` variables. The app is small enough that a global fetch cache is unnecessary overhead; the stores above exist only for cross-page concerns (toast, navigation scratchpad) and for the Dashboard's optimistic-update pattern (where the cache needs to survive brief navigations to a detail page and back).

### 6.3 API fetch wrapper

```typescript
// packages/web/src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'unknown', message: res.statusText }));
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

Every API call includes `credentials: 'include'` (required by the session cookie per Auth Integration 2). The `ApiError` class carries `status` and `code` for structured error handling in components (e.g. showing inline form errors for 400, showing an "unavailable" banner for 503).

---

## 7. Build Configuration

### 7.1 Vite proxy (development)

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

**Crucially**, `changeOrigin: true` does NOT strip the `Origin` header -- if it does (varies by Vite version), Better Auth's CSRF check will reject the proxied request. Verify this works end-to-end during scaffolding by signing up in dev and confirming the session cookie is set and honored. See Auth Integration 3 for the full failure-mode description.

### 7.2 Environment variables

| Variable | Dev value | Prod value | Used in |
|---|---|---|---|
| `VITE_API_BASE_URL` | `''` (empty -- same-origin via proxy) | `https://polaris-api.<account>.workers.dev` | `auth-client.ts`, `api.ts` |

In dev, the proxy handles `/api/*` so `VITE_API_BASE_URL` is empty string and fetch paths are relative (`/api/systems`). In production, the frontend and API are on separate subdomains, so `VITE_API_BASE_URL` is the full origin of the API Worker.

### 7.3 Static adapter

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
      relative: true,              // assets use relative paths, no base path config needed
    },
  },
};
```

`fallback: 'index.html'` is the critical setting for an SPA on Workers Static Assets -- without it, navigating directly to `/dashboard` would 404 because Cloudflare serves the static file `build/dashboard.html` which doesn't exist. With the fallback, any non-file path serves `index.html` and SvelteKit's client-side router takes over.

---

## 8. Navigation Model Summary

| From | Action | Target |
|---|---|---|
| Anywhere | Sign-up success | `/guides` |
| Anywhere | Sign-in success | `/dashboard` |
| `/auth/*` | Already signed in | `/guides` |
| `/app/*` | Session lost / expired | `/auth/sign-in` |
| `/` | Click "Get Started" | `/auth/sign-up` |
| `/` | Click "Log In" | `/auth/sign-in` |
| NavBar | Click Dashboard | `/dashboard` |
| NavBar | Click Guides | `/guides` |
| NavBar | Click Review Day | `/review-day` |
| Dashboard | Click "Create System" FAB | `/systems/new` |
| Dashboard | Click system card | `/systems/[id]` |
| System detail | Click "Edit" | `/systems/[id]/edit` |
| System detail | Click "Workspace" | `/systems/[id]/workspace` |
| System detail | Click "Review" | `/systems/[id]/review` |
| Review Day | Click "Start Review" | `/systems/[id]/review` |
| NavBar | Click sign-out | `/` |
