# Systems List — Page Override

> Page-specific overrides for `design-system/paragon/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

List view of all user systems. Each system is a card. The top-right has a "New System" CTA.

```svelte
<div class="max-w-4xl mx-auto px-6 py-8">
  <!-- Header row -->
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="font-display text-2xl font-semibold text-on-surface">Your systems</h1>
      <p class="font-body text-sm text-muted-foreground mt-1">{systems.length} active</p>
    </div>
    <a href="/systems/new"
       class="bg-gradient-to-br from-primary to-primary-container text-on-primary
              px-5 py-2.5 rounded-2xl font-semibold text-sm
              transition-all duration-200 hover:opacity-90 active:scale-[0.98]
              cursor-pointer">
      + New system
    </a>
  </div>

  <!-- Systems grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    {#each systems as system}
      <a href="/systems/{system.id}"
         class="bg-surface-container-lowest rounded-xl p-6 shadow-ambient-sm
                transition-all duration-200 hover:shadow-ambient-md
                cursor-pointer block">
        <!-- system.name + domain badge -->
        <div class="flex items-start justify-between mb-4">
          <h2 class="font-body text-lg font-semibold text-on-surface">{system.name}</h2>
          <span class="text-xs font-medium text-secondary bg-secondary/10 px-2.5 py-1 rounded-lg">
            {system.domain}
          </span>
        </div>

        <!-- floor_action preview -->
        <p class="font-body text-sm text-muted-foreground line-clamp-2 mb-4">
          {system.floor_action}
        </p>

        <!-- Footer: schedule + streak -->
        <div class="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-4">
          <span class="flex items-center gap-1.5">
            <ClockIcon class="w-3.5 h-3.5" />
            {system.schedule}
          </span>
          {#if system.streak > 0}
            <span class="flex items-center gap-1.5 text-blush">
              <SparkleIcon class="w-3.5 h-3.5" />
              {system.streak} day{system.streak !== 1 ? 's' : ''}
            </span>
          {/if}
        </div>
      </a>
    {/each}
  </div>
</div>
```

## Visual Tone for Systems List

- Two-column card grid at 768px+, single column on mobile — consistent with dashboard bento approach
- Each card shows the system name (title), domain badge (secondary/taupe), floor_action preview (muted), schedule, and optional streak (blush for high-emotion moment)
- Domain badges use `bg-secondary/10 text-secondary` — subtle tint, not a filled pill
- The streak indicator uses blush only when > 0 — this is the one place streak data is shown, and it's subdued
- Empty state: a single centered card with illustration-less guidance — "Create your first system to get started" + the new-system button
- Cards are full-width clickable (`<a>`) — no separate "view" button needed