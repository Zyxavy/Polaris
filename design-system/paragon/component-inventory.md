# Component Inventory

> Every Svelte 5 component needed in the app, organized by page and scope.
> All components use runes mode (`$state`, `$derived`, `$effect`) — not Svelte 4 stores or `onMount`.

---

## Scope Key

| Scope | Description |
|-------|-------------|
| **Global** | Used across multiple pages, in the app shell |
| **Shared** | Used across 2+ pages within a section |
| **Page-specific** | Used in exactly one page |

---

## Global Components

These live in `packages/web/src/lib/components/` and are used by the app layout or across pages.

### `NavBar.svelte`
**Route:** App layout (`(app)/+layout.svelte`)
**Props:**
```ts
type Props = {
  session: Session; // from load function
};
```
**Internal state:** `activeRoute: string` (derived from `$page.url.pathname`)
**Nav items:**
| Label | Route | Icon | Notes |
|-------|-------|------|-------|
| Dashboard | `/dashboard` | Grid icon | Default active |
| Guides | `/guides` | Book icon | Highlighted on first visit post-signup |
| Review Day | `/review-day` | Clipboard icon | Badge if systems due |
| Systems | `/systems` | Layers icon | Always |
**Variants:** Desktop sidebar (hidden on mobile), floating pill (mobile visible)
**Design ref:** MASTER.md §Floating Bottom Navigation

### `ToastContainer.svelte`
**Route:** App layout (`(app)/+layout.svelte`)
**Props:** None (reads `toastStore.items` directly)
**Internal:** Renders toast queue from store, auto-dismisses per `toastStore` timeout
**Design ref:** MASTER.md — toast not spec'd in Master; keep minimal: small pill in top-right, `bg-surface-container-lowest shadow-ambient-lg rounded-xl px-4 py-3`

### `Modal.svelte`
**Props:**
```ts
type Props = {
  open: boolean;
  onClose: () => void;
  children: Snippet; // slot content
};
```
**Design ref:** MASTER.md §Modals — overlay with `backdrop-blur-sm`, modal card `bg-surface-container-lowest rounded-xl shadow-ambient-lg`
**Used by:** Recovery codes display, confirm dialogs

### `RingChart.svelte`
**Props:**
```ts
type Props = {
  value: number;    // 0-100
  size?: number;    // default 64
};
```
**Design ref:** MASTER.md §Ring Charts — 12pt stroke, round caps, gradient fill
**Used by:** StreakWidget, ProgressChartWidget

### `InstanceSummary.svelte`
**Props:**
```ts
type Props = {
  counts: {
    full: number;
    floor: number;
    missed: number;
  };
  size?: 'sm' | 'md'; // default 'md'
};
```
**Design ref:** Shared across `per-system-review.md` and `review-day.md` — reusable component cited in route architecture §7.4-7.5
**Variants:**
- `sm`: inline, display numbers smaller, for DueReviewCard
- `md`: larger display numbers, for review form top section

### `Input.svelte`
**Props:** extends `InputHTMLAttributes`, adds `label?: string`, `error?: string`
**Design ref:** MASTER.md §Inputs — `bg-surface-container-low border-border rounded-xl`

### `Textarea.svelte`
**Props:** extends `TextareaHTMLAttributes`, adds `label?: string`
**Design ref:** Same as Input — same border/background pattern, `rows` configurable

### `SchedulePicker.svelte`
**Props:**
```ts
type Props = {
  value: ScheduleEntry[]; // days + time windows
  onChange: (schedule: ScheduleEntry[]) => void;
};
```
**Design ref:** Used in System Creator and System Edit — day-picker grid with time inputs

---

## Shared Components

### Dashboard Components

#### `InstanceList.svelte`
**Page:** Dashboard
**Props:**
```ts
type Props = {
  instances: Instance[];
};
```
**Design ref:** `dashboard.md` — bento grid wrapper

#### `InstanceCard.svelte`
**Page:** Dashboard
**Props:**
```ts
type Props = {
  instance: Instance;
  onMark: (id: string, state: 'full' | 'floor' | 'missed') => void;
};
```
**Sub-components:**
- `<SystemBadge domain floor_action />`
- `<StateButtons state onMark />`
- `<WorkspaceLink systemId />`
**Design ref:** `dashboard.md` — today's status cards

### System Creator Components

#### `TemplatePicker.svelte`
**Page:** System Creator
**Props:**
```ts
type Props = {
  templates: Template[];
  onSelect: (template: Template) => void;
};
```
**Design ref:** `system-creator.md` — collapsible `details` element, grid of template cards

#### `AIDraftPanel.svelte`
**Page:** System Creator
**Props:**
```ts
type Props = {
  onDraft: (prompt: string) => Promise<DraftResult>;
};
```
**Design ref:** `system-creator.md` — prompt input + "Draft" gradient button

#### `SystemForm.svelte`
**Page:** System Creator, System Edit
**Props:**
```ts
type Props = {
  initialData?: System;   // undefined for create, pre-filled for edit
  onSubmit: (data: SystemFormData) => void;
};
```
**Sub-sections (each a field group):**
- Purpose (name, purpose)
- Floor action (floor_action, trigger)
- Barriers & Environment (barriers, environment_cue)
- Schedule (SchedulePicker)
**Internal state:** `dirty: $state(false)`, `saved: $state(false)` for autosave indicator
**Design ref:** `system-creator.md` — stepper-styled form sections

### Workspace Components

#### `WidgetPalette.svelte`
**Page:** Workspace Builder
**Props:**
```ts
type Props = {
  widgets: WidgetDefinition[];
  onAdd: (widget: WidgetDefinition) => void;
};
```
**Design ref:** `workspace-builder.md` — 200px sidebar, vertical list

#### `WorkspaceCanvas.svelte`
**Page:** Workspace Builder
**Props:**
```ts
type Props = {
  layout: Layout;
  onReorder: (widgets: Widget[]) => void;
};
```
**Design ref:** `workspace-builder.md` — flex-1 area, `use:draggable`

#### `WidgetCard.svelte`
**Page:** Workspace Builder
**Props:**
```ts
type Props = {
  widget: Widget;
  onRemove: (id: string) => void;
};
```
**Dispatches to type-specific sub-components:**
- `<TimerWidget />`
- `<CounterWidget />`
- `<ChecklistWidget />`
- `<LogWidget />`
- `<LinkListWidget />`
- `<StreakWidget />`
- `<ProgressChartWidget />`
- `<NotesWidget />`

#### `SaveBar.svelte`
**Page:** Workspace Builder
**Props:**
```ts
type Props = {
  dirty: boolean;
  onSave: () => void;
};
```
**Design ref:** `workspace-builder.md` — sticky bottom bar with dirty indicator

### Review Components

#### `ReviewForm.svelte`
**Page:** Per-System Review
**Props:**
```ts
type Props = {
  system: System;
  periodStart: string;
  periodEnd: string;
  counts: { full: number; floor: number; missed: number };
  onSubmit: (data: ReviewFormData) => void;
};
```
**Design ref:** `per-system-review.md` — reflection + blueprint adjustment + change note sections

#### `DueReviewList.svelte`
**Page:** Review Day
**Props:**
```ts
type Props = {
  due: DueSystem[];
};
```
**Design ref:** `review-day.md` — vertical card list

#### `DueReviewCard.svelte`
**Page:** Review Day
**Props:**
```ts
type Props = {
  item: DueSystem;
};
```
**Design ref:** `review-day.md` — system name, floor_action, InstanceSummary, Start Review CTA

### Auth Components

#### `AuthShell.svelte`
**Page:** Auth layout (`(auth)/+layout.svelte`)
**Props:** None (renders children in centered card)
**Design ref:** `sign-in.md`, `sign-up.md` — centered form, max-w-sm, logo anchor at top, no nav

---

## Page-Specific Components

These are inline in the page Svelte file or have no reusable wrapper.

| Page | Inline / Simple Components |
|------|---------------------------|
| Landing (`/`) | Hero section, Features grid, CTA section, Footer — all inline in `+page.svelte` |
| Guides (`/guides`) | Guide cards, Quick-start CTA — both simple enough to inline |
| Sign In (`/sign-in`) | Login form — inline (just uses `Input` and button) |
| Sign Up (`/sign-up`) | Registration form + RecoveryCodesModal — form inline, modal uses `<Modal>` |
| Systems List (`/systems`) | System cards in grid — inline, loops over data |
| System Detail Overview (`/systems/[id]`) | Blueprint display, streak calendar, action links — inline, reads from layout data |
| System Reviews List (`/systems/[id]/reviews`) | Review cards + Start Review CTA — inline |
| Review Day (`/review-day`) | Uses `<DueReviewList>` and `<DueReviewCard>` |

---

## Summary

| Scope | Count | Files |
|-------|-------|-------|
| Global | 9 | `NavBar`, `ToastContainer`, `Modal`, `RingChart`, `InstanceSummary`, `Input`, `Textarea`, `SchedulePicker` |
| Shared | 14 | `InstanceList`, `InstanceCard`, `TemplatePicker`, `AIDraftPanel`, `SystemForm`, `WidgetPalette`, `WorkspaceCanvas`, `WidgetCard`, `SaveBar`, `ReviewForm`, `DueReviewList`, `DueReviewCard`, `AuthShell` |
| Page-specific | ~8 | Inline per page |

**Total: ~23 reusable components + ~8 page-specific inline sections**
