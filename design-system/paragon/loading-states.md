# Loading, Error, and Empty States

> Patterns for every page in the app. All states follow the no-line rule, non-punitive language, and tonal depth of the Master design system.

---

## 1. Loading States

### 1.1 Global rule

No full-screen spinners ever. Use skeleton loaders that match the page layout shape. Skeletons use `bg-muted` with a subtle pulse animation.

```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.skeleton {
  background: var(--color-muted);
  border-radius: 1rem;  /* rounded-xl */
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
```

### 1.2 Per-page skeletons

| Page | Skeleton shape | Notes |
|------|---------------|-------|
| **Dashboard** | 3-6 bento card rectangles (240×180px each, in grid) + greeting skeleton line (200×24px) | Cards have no border — skeletons match the bento grid layout exactly |
| **Systems List** | 4-6 card rectangles (1/2 width each, 120px tall) in 2-column grid | Narrower than dashboard cards |
| **System Detail** | Title skeleton (250×28px) + tab bar skeleton (3 short bars) + blueprint field skeletons (3 text lines) | Tab bar skeleton appears instant — system name is the slow load |
| **System Creator** | Form section skeletons (3 rectangles, each 60px tall) separated by step marker skeletons | Single-column form shape |
| **Workspace Builder** | 6 widget card skeletons (1/3 width, 140px tall) in grid + palette sidebar skeleton (200px wide, vertical lines) | Palette loads with the page — widget data may lag |
| **Review Day** | 2-3 review card skeletons (full-width, 160px tall) | Same vertical list shape |
| **Review Form** | Instance summary skeleton (3 small stat circles) + textarea skeletons (2 large rectangles) | Summary loads instantly from parent layout — form data may lag |
| **Landing** | No skeleton — static HTML hero loads immediately | No API calls on this page |
| **Sign In / Sign Up** | No skeleton — form is static HTML | No API calls until submit |
| **Guides** | No skeleton — static content | No API calls until "Create your first system" |

### 1.3 Svelte 5 pattern

```svelte
{#if data.loading}
  <div class="grid grid-cols-2 gap-4">
    {#each Array(4) as _}
      <div class="skeleton h-[120px]" />
    {/each}
  </div>
{:else}
  <ActualContent data={data} />
{/if}
```

Avoid wrapping skeleton and content in the same `{#if}` that compiles both branches — use `{#key}` or separate variables to ensure skeletons unmount cleanly once data arrives.

---

## 2. Error States

### 2.1 Toast pattern (default)

The default error handling is a toast via `apiFetchWithToast.ts`:

```ts
try {
  return await apiFetch<T>(path, options);
} catch (e) {
  if (e instanceof ApiError && e.status < 500) {
    toastStore.push({ type: 'error', message: e.message });
  }
  throw e;
}
```

Toast appears in top-right corner via `<ToastContainer>` in the app layout. Auto-dismisses after 4 seconds.

### 2.2 Inline error pattern (form validation)

For validation errors (422), errors appear inline beneath the relevant input:

```svelte
<div>
  <Input label="System name" bind:value={name} error={errors.name} />
  {#if errors.name}
    <p class="font-body text-xs text-destructive mt-1.5 ml-1">{errors.name}</p>
  {/if}
</div>
```

Inline errors use `text-destructive` (`#C24545`) — muted warm red, not bright red.

### 2.3 Per-page inline errors

| Page | Error scenario | Behavior |
|------|---------------|----------|
| **Sign In** | Invalid credentials | Inline error above submit: "Incorrect email or password" |
| **Sign Up** | Email taken | Inline error on email field: "An account with this email already exists" |
| **System Creator** | Floor action required on confirm | `floor_action_required` from API surfaces as inline field error on floor action textarea |
| **Per-System Review** | Review already exists (409) | Inline banner at top of form: "A review already exists for this period" with link to edit existing |
| **Any form** | Network error | Toast: "Could not save — try again" (from optimistic-update rollback pattern) |

### 2.4 Page-level error state (unrecoverable)

For full-page load failures (API down, 500s), show a centered error section:

```svelte
<div class="flex flex-col items-center justify-center py-20 gap-4">
  <div class="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive
              flex items-center justify-center">
    <AlertIcon class="w-6 h-6" />
  </div>
  <h2 class="font-body text-lg font-semibold text-on-surface">Something went wrong</h2>
  <p class="font-body text-sm text-muted-foreground text-center max-w-sm">
    {errorMessage || "We couldn't load this page. Please try again."}
  </p>
  <button onclick={retry}
          class="bg-gradient-to-br from-primary to-primary-container text-on-primary
                 px-5 py-2.5 rounded-2xl font-semibold text-sm mt-2 cursor-pointer">
    Try again
  </button>
</div>
```

Used on: Dashboard, Systems List, System Detail, Review Day, Workspace Builder.

### 2.5 404 within app context

If a system record doesn't exist (API returns 404 on `GET /api/systems/:id`):

```svelte
<div class="flex flex-col items-center justify-center py-20 gap-4">
  <div class="w-12 h-12 rounded-2xl bg-surface-container-low text-muted-foreground
              flex items-center justify-center">
    <SearchIcon class="w-6 h-6" />
  </div>
  <h2 class="font-body text-lg font-semibold text-on-surface">System not found</h2>
  <p class="font-body text-sm text-muted-foreground text-center max-w-sm">
    This system may have been archived or the link is incorrect.
  </p>
  <a href="/systems"
     class="text-sm text-primary hover:underline mt-2 cursor-pointer">
    Browse all systems
  </a>
</div>
```

---

## 3. Empty States

### 3.1 Language tone

No "nothing here" or "no items yet." Use warm, guiding language that invites the first action. Non-punitive — never imply the user hasn't done enough.

### 3.2 Per-page empty states

| Page | Empty condition | UI |
|------|----------------|-----|
| **Dashboard** | No instances for today (no systems or no schedules due) | "Set up your first system to get started" + gradient "Create a system" CTA linking to `/systems/new`. Uses `surface-container-low` card. |
| **Dashboard** | Systems exist but all instances completed for today | Greeting shows all tasks done — blush checkmark, "All caught up for today" in relaxed tone. No confetti or celebrations. |
| **Systems List** | No systems created yet | "Design your first system" card with brief explanation + CTA. Full-width `surface-container-lowest` card. |
| **System Detail** | System has no instances yet | Streak area shows "Waiting for your first instance" in muted text. Schedule is displayed as configured. |
| **Review Day** | No systems due for review | "All caught up — no systems are due for review right now. Check back after your next schedule window closes." Blush checkmark icon in `bg-primary/10` box. |
| **System Reviews** | No reviews exist yet | "No reviews yet. Once you complete a review period, past reviews will appear here." Centered, `surface-container-low`. |
| **Workspace Builder** | Canvas is empty | "Drag widgets from the palette to build your workspace" — centered in `surface-container-low` with indicator arrow. |
| **Guides** | N/A — static content page | Always has content. No empty state. |
| **Landing** | N/A — static content | Always has content. |
| **Sign In / Sign Up** | N/A — always renders form | Form always present. |

### 3.3 Empty state component pattern

```svelte
<div class="bg-surface-container-low rounded-xl p-10 text-center">
  <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary
              flex items-center justify-center mx-auto mb-4">
    <Icon icon={icon} class="w-6 h-6" />
  </div>
  <h2 class="font-body text-lg font-semibold text-on-surface mb-2">{title}</h2>
  <p class="font-body text-sm text-muted-foreground max-w-sm mx-auto mb-6">
    {description}
  </p>
  {#if cta}
    <a href={cta.href}
       class="bg-gradient-to-br from-primary to-primary-container text-on-primary
              px-5 py-2.5 rounded-2xl font-semibold text-sm inline-block
              transition-all duration-200 hover:opacity-90 active:scale-[0.98]
              cursor-pointer">
      {cta.label}
    </a>
  {/if}
</div>
```

### 3.4 Empty state icon guidelines

| Mood | Icon | Container style |
|------|------|----------------|
| Action needed (first system) | `PlusIcon` or `CompassIcon` | `bg-primary/10 text-primary` |
| All done / caught up | `CheckIcon` | `bg-primary/10 text-primary` |
| None yet / waiting | `InboxIcon` or `ClockIcon` | `bg-surface-container-low text-muted-foreground` |
| Not found | `SearchIcon` | `bg-surface-container-low text-muted-foreground` |

---

## 4. Per-page State Matrix

| Page | Loading | Error (recoverable) | Error (unrecoverable) | Empty | Edge case |
|------|---------|---------------------|-----------------------|-------|-----------|
| Landing | — | — | — | — | — |
| Sign In | — | Form inline | Page error | — | Already signed in → redirect `/guides` |
| Sign Up | Submit button disabled + spinner | Form inline | Page error | — | Already signed in → redirect `/guides` |
| Guides | — | — | — | — | Confirmed user → `/dashboard` redirect |
| Dashboard | Skeleton grid | Toast on markState failure | Centered error + retry | "Set up first system" CTA | All done → "Caught up" message |
| Systems List | Skeleton cards | Toast on load failure | Centered error + retry | "Design first system" CTA | — |
| System Creator | Form section skeletons | Inline field errors | Toast on save failure | — | Edit mode: form pre-filled |
| System Detail | Title + tab skeleton | Toast on load failure | 404 page (system not found) | "Waiting for first instance" | — |
| System Edit | Same as Creator skeleton | Inline + toast | Toast | — | — |
| Workspace Builder | Widget skeletons + palette | Toast on save failure | Centered error | "Drag widgets" prompt | Layout dirty → navigate-away guard |
| Review Day | Card skeletons | Toast on load failure | Centered error + retry | "All caught up" | — |
| Review Form | Summary + field skeletons | Inline 409 banner | Toast on submit failure | — | Period already reviewed → edit flow |
| System Reviews | Card skeletons | Toast on load failure | Centered error | "No reviews yet" | — |
