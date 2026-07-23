# Workspace Builder — Page Override

> Page-specific overrides for `design-system/paragon/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

Drag-and-drop bento canvas with palette/canvas/save zones. Three-zone layout:

```
+--------------------------------------------------+
|  Workspace — [system name]            [Save]     |
+--------------------------------------------------+
|  Widget Palette  |  Canvas (drag zone)           |
|  +-------------+ |  +-------------------------+  |
|  | Timer       | |  | [Widget] [Widget]       |  |
|  | Counter     | |  |                         |  |
|  | Checklist   | |  | [Widget] [Widget]       |  |
|  | Log/Journal | |  |                         |  |
|  | Link List   | |  +-------------------------+  |
|  | Notes       | |                               |
|  +-------------+ |                               |
+--------------------------------------------------+
```

| Zone | Background | Width | Notes |
|------|-----------|-------|-------|
| Palette | `surface-container-low` | 200px (collapsible on mobile) | Widget catalog, vertical list |
| Canvas | `surface` | `flex-1` | Grid drop zone, bento layout |
| Save bar | `surface-container-lowest` | full-width bottom bar | Shows dirty state |

## Widget Palette

```svelte
<aside class="w-[200px] shrink-0 bg-surface-container-low rounded-xl p-4 flex flex-col gap-2">
  <h3 class="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Widgets</h3>
  {#each availableWidgets as widget}
    <button onclick={() => workspaceEditorStore.addWidget(widget)}
            draggable="true"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-on-surface
                   transition-all duration-150 hover:bg-surface-container-lowest hover:shadow-ambient-sm
                   cursor-grab active:cursor-grabbing">
      <Icon icon={widget.icon} class="w-4 h-4 text-primary" />
      <span class="font-medium">{widget.label}</span>
    </button>
  {/each}
</aside>
```

## Workspace Canvas

```svelte
<div class="flex-1 bg-surface rounded-xl p-6 min-h-[60vh]"
     use:draggable={{ onSort: handleReorder }}>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each workspaceEditorStore.layout.widgets as widget (widget.id)}
      <div class="bg-surface-container-lowest rounded-xl p-4 shadow-ambient-sm
                  transition-shadow duration-200 hover:shadow-ambient-md
                  draggable cursor-grab active:cursor-grabbing
                  min-h-[140px] flex flex-col">
        <!-- Widget header -->
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-body text-sm font-semibold text-on-surface">{widget.label}</h4>
          <button onclick={() => workspaceEditorStore.removeWidget(widget.id)}
                  class="text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
            <XIcon class="w-4 h-4" />
          </button>
        </div>
        <!-- Widget content area — dispatched by type -->
        {#if widget.type === 'timer'}
          <TimerWidget data={widget.data} />
        {:else if widget.type === 'counter'}
          <CounterWidget data={widget.data} />
        {:else if widget.type === 'checklist'}
          <ChecklistWidget data={widget.data} />
        {:else if widget.type === 'log'}
          <LogWidget data={widget.data} />
        {:else if widget.type === 'link-list'}
          <LinkListWidget data={widget.data} />
        {:else if widget.type === 'streak'}
          <StreakWidget data={widget.data} />
        {:else if widget.type === 'progress'}
          <ProgressChartWidget data={widget.data} />
        {:else if widget.type === 'notes'}
          <NotesWidget data={widget.data} />
        {/if}
      </div>
    {/each}

    <!-- Empty state -->
    {#if workspaceEditorStore.layout.widgets.length === 0}
      <div class="col-span-full flex items-center justify-center h-48
                   bg-surface-container-low rounded-xl">
        <p class="font-body text-sm text-muted-foreground">
          Drag widgets from the palette to build your workspace
        </p>
      </div>
    {/if}
  </div>
</div>
```

## Save Bar

```svelte
<div class="sticky bottom-0 mt-6 bg-surface-container-lowest rounded-xl px-6 py-4 shadow-ambient-md
            flex items-center justify-between">
  <span class="text-xs text-muted-foreground flex items-center gap-2">
    {#if workspaceEditorStore.dirty}
      <span class="w-1.5 h-1.5 rounded-full bg-secondary" />
      Unsaved changes
    {:else}
      <CheckIcon class="w-3 h-3" />
      Saved
    {/if}
  </span>
  <button onclick={() => workspaceEditorStore.save()}
          disabled={!workspaceEditorStore.dirty}
          class="bg-gradient-to-br from-primary to-primary-container text-on-primary
                 px-6 py-2.5 rounded-2xl font-semibold text-sm
                 transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                 disabled:opacity-40 disabled:cursor-not-allowed
                 cursor-pointer">
    Save layout
  </button>
</div>
```

## Visual Tone for Workspace Builder

- The palette uses `surface-container-low` — visually receded, placing focus on the canvas
- Canvas uses `surface` (the page background) — the widgets themselves provide the visual structure
- Empty canvas state uses `surface-container-low` with centered muted text — subtle guidance
- Widget cards follow the same bento-card pattern as dashboard widgets
- The sticky save bar is flush-bottom with `surface-container-lowest` background and ambient shadow — it appears to float above the canvas
- An unsaved-changes indicator uses a small pulsing dot in `secondary` (warm taupe) — soft, not alarming
- Transitions on drag are 200ms with ease-out — responsive, not laggy
- Scroll behavior: the palette scrolls independently from the canvas (both overflow-y-auto)
- Mobile: palette collapses to a horizontal scrollable strip at the top, canvas below