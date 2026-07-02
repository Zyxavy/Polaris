# Layout Specs

> The three shell layouts that wrap page content in Polaris.
> Each layout is a Svelte route group layout file.

---

## 1. Marketing Layout — `(marketing)/+layout.svelte`

**Route:** `/` (landing page only)
**File:** `packages/web/src/routes/(marketing)/+layout.svelte`

### Visual spec

```
┌──────────────────────────────────────────────────┐
│                                                  │
│                    <slot/>                       │
│              (full-viewport panels,              │
│             no chrome whatsoever)                │
│                                                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

- No chrome. No nav bar. No footer. No header.
- The landing page owns its full viewport from edge to edge.
- The layout file is a pass-through: `{@render children()}`
- No auth check — landing page is always reachable.

### CSS

```css
/* No layout styles needed — pass-through */
```

### CSS variables consumed by children

| Variable | Value | Usage |
|----------|-------|-------|
| `--page-max-width` | `100%` | Full bleed — landing hero spans edge-to-edge |
| `--page-padding-x` | `0` | No horizontal padding |

---

## 2. Auth Layout — `(auth)/+layout.svelte`

**Route:** `/sign-in`, `/sign-up`
**File:** `packages/web/src/routes/(auth)/+layout.svelte`

### Visual spec

```
┌──────────────────────────────────────────────────┐
│                                                  │
│                                                  │
│         ┌──────────────────────────┐             │
│         │                          │             │
│         │        ▲ Logo            │             │
│         │                          │             │
│         │     ┌──────────┐         │             │
│         │     │  Form     │         │             │
│         │     │  Fields   │         │             │
│         │     └──────────┘         │             │
│         │                          │             │
│         │   ┌──────────────────┐   │             │
│         │   │  Submit button   │   │             │
│         │   └──────────────────┘   │             │
│         │                          │             │
│         │   "Don't have an         │             │
│         │    account? Sign up"     │             │
│         │                          │             │
│         └──────────────────────────┘             │
│                  max-w-sm                         │
│                                                  │
└──────────────────────────────────────────────────┘
   ↕ flex items-center justify-center min-h-screen
```

### Structure

```svelte
<div class="min-h-screen flex items-center justify-center bg-surface p-4">
  <div class="w-full max-w-sm flex flex-col items-center gap-6">
    <!-- Logo anchor — links to / -->
    <a href="/" class="text-on-surface hover:opacity-80 transition-opacity">
      <LogoIcon class="w-8 h-8" />
    </a>

    <!-- Auth guard: only render children when no active session -->
    {#if !session}
      {@render children()}
    {/if}
  </div>
</div>
```

### Auth guard logic

- On mount, call `authClient.useSession()` reactively
- If session exists, redirect to `/guides` (not `/dashboard` — first-visit flow)
- Children render only when `!session` — prevents form flash before redirect

### CSS variables

| Variable | Value | Usage |
|----------|-------|-------|
| `--page-max-width` | `24rem` (384px) | `max-w-sm` |
| `--page-padding-x` | `1rem` (16px) | `p-4` on container |

### Empty state

The auth layout never shows an empty state — it either renders the form or redirects away. If `session` is loading, the layout renders nothing (or a minimal centered spinner matching `surface` background).

---

## 3. App Layout — `(app)/+layout.svelte`

**Route:** All authenticated pages (`/dashboard`, `/systems`, `/guides`, `/review-day`, etc.)
**File:** `packages/web/src/routes/(app)/+layout.svelte`

### Visual spec

```
┌──────────────────────────────────────────────────┐
│          NavBar (floating pill, mobile)           │
│  ┌───── Sidebar ─────┐ ─── Main content ─────── │
│  │                    │                           │
│  │  ● Logo            │   <main>                  │
│  │                    │    {@render children()}    │
│  │  Dashboard         │   </main>                 │
│  │  Guides            │                           │
│  │  Review Day        │                           │
│  │  Systems           │                           │
│  │                    │                           │
│  │  ───────────       │                           │
│  │  User name         │                           │
│  │  Sign out          │                           │
│  │                    │                           │
│  └────────────────────┘───────────────────────────│
│                                                    │
│          ToastContainer (top-right corner)         │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Structure

```svelte
<script lang="ts">
  import NavBar from '$lib/components/NavBar.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import type { PageData } from './$types';

  let { children, data } = $props();
</script>

<NavBar session={data.session} />
<ToastContainer />
<main class="max-w-6xl mx-auto px-6 py-8">
  {@render children()}
</main>
```

### Main content area

```css
main {
  max-width: 72rem;  /* max-w-6xl */
  margin: 0 auto;
  padding: 2rem 1.5rem;  /* py-8 px-6 */
}
```

### Responsive nav behavior

| Breakpoint | Nav type |
|------------|----------|
| < 768px (mobile) | Floating bottom pill with icons only (labels hidden) |
| ≥ 768px (tablet) | Floating bottom pill with icons + labels |
| ≥ 1024px (desktop) | Sidebar (optional — floating pill remains default) |

### Auth guard

The app layout's `+layout.ts` load function runs first:
1. Call `authClient.getSession()` (non-reactive, returns promise)
2. If no session, `throw redirect(302, '/sign-in')`
3. If session exists, return `{ session }` as `PageData`

### CSS variables

| Variable | Default | Usage |
|----------|---------|-------|
| `--page-max-width` | `72rem` (1152px) | `max-w-6xl` |
| `--page-padding-x` | `1.5rem` (24px) | `px-6` |
| `--page-padding-y` | `2rem` (32px) | `py-8` |
| `--nav-height-mobile` | `64px` | Bottom nav pill height offset |
| `--nav-height-desktop` | `0` | No offset when sidebar |

---

## 4. System Detail Tab Layout — `systems/[id]/+layout.svelte`

**Route:** `/systems/[id]` (and children: `/workspace`, `/reviews`)
**File:** `packages/web/src/routes/systems/[id]/+layout.svelte`

### Visual spec

```
┌──────────────────────────────────────────────────┐
│  ← Back to Systems                                │
│  System Name                          [Edit]      │
│  ┌──────┬───────────┬──────────┐                  │
│  │Overview│Workspace│ Reviews  │  ← tab bar       │
│  └──────┴───────────┴──────────┘                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─              │
│                                                   │
│              {@render children()}                  │
│                                                   │
└──────────────────────────────────────────────────┘
```

### Structure

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import type { PageData, LayoutProps } from './$types';

  let { children, data } = $props();
  let system = $derived(data.system);
</script>

<div class="max-w-4xl mx-auto">
  <!-- Back link + header -->
  <div class="mb-6">
    <a href="/systems" class="text-sm text-muted-foreground hover:text-on-surface
                              transition-colors flex items-center gap-1.5 mb-2">
      <ArrowLeftIcon class="w-4 h-4" />
      All systems
    </a>
    <div class="flex items-center justify-between">
      <h1 class="font-display text-2xl font-semibold text-on-surface">{system.name}</h1>
      <a href="/systems/{system.id}/edit"
         class="text-sm text-primary hover:underline cursor-pointer">Edit</a>
    </div>
  </div>

  <!-- Tab bar -->
  <nav class="flex items-center gap-6 border-b border-border/50 mb-8 pb-0">
    <a href="/systems/{system.id}"
       class="pb-3 text-sm font-medium transition-colors
              {tab === 'overview' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-on-surface'}">
      Overview
    </a>
    <a href="/systems/{system.id}/workspace"
       class="pb-3 text-sm font-medium transition-colors
              {tab === 'workspace' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-on-surface'}">
      Workspace
    </a>
    <a href="/systems/{system.id}/reviews"
       class="pb-3 text-sm font-medium transition-colors
              {tab === 'reviews' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-on-surface'}">
      Reviews
    </a>
  </nav>

  {@render children()}
</div>
```

### Tab bar design

- Uses `border-b border-border/50` as the only 1px line in the app — acceptable because it anchors the tab row beneath the title
- Active tab: `text-primary font-semibold` with no underline or background pill
- Inactive tabs: `text-muted-foreground hover:text-on-surface`
- Tab identification: derived from `$page.url.pathname`:
  - `/systems/[id]` → overview
  - `/systems/[id]/workspace` → workspace
  - `/systems/[id]/reviews` or `/systems/[id]/reviews/new` → reviews

### Data loading

The `+layout.ts` load function fetches the system record once and shares it with all children:
```ts
export const load: LayoutLoad = async ({ params, fetch }) => {
  const system = await apiFetch<System>(`/api/systems/${params.id}`, { fetch });
  return { system };
};
```

---

## 5. CSS Variables Reference

All layouts consume these CSS variables, set on `body` or `html`:

```css
:root {
  /* Page dimensions */
  --page-max-width: 72rem;
  --page-padding-x: 1.5rem;
  --page-padding-y: 2rem;

  /* Nav sizing */
  --nav-height-mobile: 64px;
  --nav-height-desktop: 0px;

  /* Auth layout */
  --auth-card-width: 24rem;
}
```

Each layout overrides as needed:
- **Marketing:** `--page-max-width: 100%; --page-padding-x: 0;`
- **Auth:** `--page-max-width: var(--auth-card-width);`
- **App:** defaults (above)
- **System detail:** `--page-max-width: 56rem;` (max-w-4xl)
