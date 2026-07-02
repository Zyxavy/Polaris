# Workspace Builder - Page Override

> Page-specific overrides for `design-system/polaris/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

The Workspace Builder is a **drag-and-drop bento canvas** for composing widgets attached to one system. It is more tactile than the Dashboard, but it keeps the same tranquil surface nesting and no-line rule.

| Breakpoint | Canvas Columns | Palette Placement | Gutter |
|------------|----------------|-------------------|--------|
| 375px (mobile) | 1 | Bottom sheet / stacked above canvas | gap-4 |
| 768px (tablet) | 2 | Collapsible top panel | gap-4 |
| 1024px+ | 6 logical grid columns | Left rail palette | gap-6 |

Desktop uses a three-zone layout: left widget palette, center canvas, right inspector/save rail. Mobile stacks palette, canvas, and save controls in that order.

## Canvas Spec

The canvas sits on `surface-container-low` and contains widget cards on `surface-container-lowest`.

```svelte
<section class="bg-surface-container-low rounded-2xl p-4 shadow-ambient-sm lg:p-6">
  <div class="grid auto-rows-[120px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6 lg:gap-6">
    {#each widgets as widget}
      <WidgetCard {widget} />
    {/each}
  </div>
</section>
```

Use ghost placeholders during drag with `bg-primary/10`, rounded corners, and no border. Never use dashed outlines as the main drop affordance.

## Widget Palette

The palette is a calm catalog, not an app store. Each widget option uses a small line icon, concise description, and one muted example.

```svelte
<button class="w-full rounded-xl bg-surface-container-lowest p-4 text-left shadow-ambient-sm
               transition-shadow duration-200 hover:shadow-ambient-md focus:outline-none focus:ring-2 focus:ring-ring">
  <div class="flex items-center gap-3">
    <WidgetIcon class="h-5 w-5 text-primary" />
    <div>
      <p class="font-semibold text-on-surface">{widgetName}</p>
      <p class="text-sm text-muted-foreground">{shortDescription}</p>
    </div>
  </div>
</button>
```

Do not show all configuration options in the palette. Add first, configure in the widget card or inspector.

## Widget Card Spec

Workspace widget cards share Dashboard card DNA, but add edit affordances.

```svelte
<article class="bg-surface-container-lowest text-on-surface rounded-xl p-4 shadow-ambient-sm
                transition-shadow duration-200 hover:shadow-ambient-md
                min-h-[120px] cursor-grab active:cursor-grabbing">
  <header class="mb-3 flex items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      <WidgetIcon class="h-4 w-4 text-primary" />
      <h3 class="text-sm font-semibold text-on-surface">{widget.title}</h3>
    </div>
    <button class="text-muted-foreground transition-colors hover:text-on-surface">
      <GripIcon class="h-4 w-4" />
    </button>
  </header>
  {widgetBody}
</article>
```

Drag handles should be visible but quiet. Use cursor changes, shadow depth, and ghost placement rather than strong outlines.

## Widget-Specific Notes

- Timer and Counter: compact controls first, details second; avoid oversized controls that dominate the canvas.
- Checklist: show the configured steps as calm check rows with large tap targets.
- Link List: persistent workspace content; show labels as resource chips or stacked rows with subtle external-link icons.
- Notes: persistent workspace content; present as a soft writing block, not a per-day log.
- Streak and Progress Chart: read-only widgets; label them as summaries, not goals to chase.
- Log/Journal: distinguish from Notes by showing instance/date context.

## Save Bar And Dirty State

Use a sticky bottom save bar on mobile and a right-rail save panel on desktop.

- `Saved`: muted checkmark, fades after 2s.
- `Unsaved changes`: warm taupe text, no warning red.
- `Saving`: subtle pulsing dot, no spinner.
- `Could not save`: destructive text with a retry button, still non-punitive.

The Workspace Builder may autosave later, but v1's explicit SaveBar must remain visually obvious because layout changes are structural.

## Empty Canvas

Empty state should invite composition, not imply work is missing.

```svelte
<div class="bg-surface-container-lowest rounded-2xl p-8 text-center shadow-ambient-sm">
  <p class="font-display text-2xl font-semibold text-primary">Build the surface this system needs</p>
  <p class="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
    Add one or two widgets that make the next action obvious. You can rearrange them anytime.
  </p>
</div>
```

## Visual Tone For Workspace Builder

- The mood is arranging a personal desk, not configuring a dashboard product.
- Make drag-and-drop feel forgiving: clear undo/retry affordances, no destructive language.
- Avoid dense inspector panels; prefer progressive disclosure inside cards.
- Keep canvas chrome quiet so the user's system content is the focus.
- Do not use gridlines or visible cell borders; use spacing and ghost cards for placement.
