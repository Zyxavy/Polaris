# System Detail / Overview — Page Override

> Page-specific overrides for `design-system/polaris/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

Tabbed interface inside the system detail shell. The Overview tab shows blueprint fields (read-only), current schedule, instance streak/calendar, and action links.

```svelte
<div class="max-w-4xl mx-auto px-6 py-8">
  <!-- System header -->
  <div class="flex items-start justify-between mb-8">
    <div>
      <h1 class="font-display text-2xl font-semibold text-on-surface">{system.name}</h1>
      <span class="text-sm font-medium text-secondary">{system.domain}</span>
    </div>

    <!-- Action links -->
    <div class="flex items-center gap-3">
      <a href="/systems/{system.id}/edit"
         class="text-sm font-medium text-muted-foreground hover:text-on-surface transition-colors cursor-pointer">
        Edit
      </a>
      <a href="/systems/{system.id}/workspace"
         class="text-sm font-medium text-muted-foreground hover:text-on-surface transition-colors cursor-pointer">
        Workspace
      </a>
    </div>
  </div>

  <!-- Tab bar -->
  <nav class="flex items-center gap-6 mb-8 border-b border-border/50 pb-3">
    <a href="/systems/{system.id}" class="text-sm font-semibold text-primary">Overview</a>
    <a href="/systems/{system.id}/workspace" class="text-sm font-medium text-muted-foreground hover:text-on-surface transition-colors">Workspace</a>
    <a href="/systems/{system.id}/reviews" class="text-sm font-medium text-muted-foreground hover:text-on-surface transition-colors">Reviews</a>
  </nav>

  <!-- Blueprint card -->
  <section class="bg-surface-container-low rounded-xl p-6 mb-8">
    <h2 class="font-body text-sm font-semibold text-on-surface mb-4 uppercase tracking-wide">Blueprint</h2>
    <dl class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="col-span-full">
        <dt class="text-xs font-medium text-muted-foreground mb-1">Purpose</dt>
        <dd class="font-body text-sm text-on-surface">{system.purpose}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium text-muted-foreground mb-1">Floor Action</dt>
        <dd class="font-body text-sm text-on-surface">{system.floor_action}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium text-muted-foreground mb-1">Trigger</dt>
        <dd class="font-body text-sm text-on-surface">{system.trigger}</dd>
      </div>
      {#if system.barriers?.length}
        <div class="col-span-full">
          <dt class="text-xs font-medium text-muted-foreground mb-1">Known Barriers</dt>
          <dd class="font-body text-sm text-on-surface">{system.barriers.join(', ')}</dd>
        </div>
      {/if}
    </dl>
  </section>

  <!-- Schedule + Streak row -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
    <div class="bg-surface-container-lowest rounded-xl p-6 shadow-ambient-sm">
      <h3 class="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Schedule</h3>
      <p class="font-body text-sm text-on-surface">{system.schedule_days} &middot; {system.schedule_window}</p>
    </div>
    <div class="bg-surface-container-lowest rounded-xl p-6 shadow-ambient-sm">
      <h3 class="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Streak</h3>
      <!-- Ring chart or simple count -->
      <div class="flex items-center gap-4">
        <span class="font-display text-3xl font-semibold text-blush">{system.streak}</span>
        <span class="font-body text-sm text-muted-foreground">days</span>
      </div>
    </div>
  </div>

  <!-- Review CTA -->
  <div class="bg-surface-container-low rounded-xl p-6 flex items-center justify-between">
    <div>
      <h3 class="font-body text-sm font-semibold text-on-surface">Ready to review?</h3>
      <p class="font-body text-xs text-muted-foreground mt-1">Review this system's performance over the last period</p>
    </div>
    <a href="/systems/{system.id}/reviews/new"
       class="bg-gradient-to-br from-primary to-primary-container text-on-primary
              px-5 py-2.5 rounded-2xl font-semibold text-sm
              transition-all duration-200 hover:opacity-90
              cursor-pointer">
      Start review
    </a>
  </div>
</div>
```

## Tab Bar

The tab bar is the only place in the app where a subtle bottom border (`border-b border-border/50`) is used — it visually anchors the navigation row beneath the system title.

- Active tab: `text-primary font-semibold`
- Inactive tabs: `text-muted-foreground hover:text-on-surface`

## Visual Tone for System Detail

- Blueprint fields are displayed in a `surface-container-low` section — the secondary background level designates this as "reference material," not interactive
- The streak counter uses blush (`text-blush`) for a soft high-emotion moment without gamification
- Schedule and streak sit side-by-side in `surface-container-lowest` cards — equal visual weight
- The review CTA at the bottom uses a `surface-container-low` background to visually separate it as a call-to-action zone
- All action links use ghost-button treatment — no border, just hover color shift
- The "Archive" action is intentionally absent from the action row (deferred from v1 per PRD)