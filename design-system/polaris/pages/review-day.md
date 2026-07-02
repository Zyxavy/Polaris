# Review Day — Page Override

> Page-specific overrides for `design-system/polaris/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

Aggregated review view showing all systems due for review. Each system card shows the instance summary and a "Start Review" entry point.

```svelte
<div class="max-w-4xl mx-auto px-6 py-8">
  <!-- Page header -->
  <div class="mb-8">
    <h1 class="font-display text-2xl font-semibold text-on-surface">Review Day</h1>
    <p class="font-body text-sm text-muted-foreground mt-1">
      {#if due.length > 0}
        {due.length} system{due.length !== 1 ? 's' : ''} due for review
      {:else}
        All caught up — no systems due for review
      {/if}
    </p>
  </div>

  {#if due.length > 0}
    <!-- Due list -->
    <div class="flex flex-col gap-6">
      {#each due as item}
        <div class="bg-surface-container-lowest rounded-xl p-6 shadow-ambient-sm
                    transition-shadow duration-200 hover:shadow-ambient-md">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h2 class="font-body text-lg font-semibold text-on-surface">{item.system_name}</h2>
              <p class="font-body text-sm text-muted-foreground mt-1">{item.floor_action}</p>
            </div>
          </div>

          <!-- Instance summary — reuse component from per-system review -->
          <div class="flex items-center gap-6 mb-5">
            <div class="text-center">
              <span class="font-display text-xl font-semibold text-primary">{item.counts.full}</span>
              <p class="font-body text-xs text-muted-foreground">Full</p>
            </div>
            <div class="text-center">
              <span class="font-display text-xl font-semibold text-secondary">{item.counts.floor}</span>
              <p class="font-body text-xs text-muted-foreground">Floor</p>
            </div>
            <div class="text-center">
              <span class="font-display text-xl font-semibold text-muted-foreground">{item.counts.missed}</span>
              <p class="font-body text-xs text-muted-foreground">Missed</p>
            </div>
          </div>

          <a href="/systems/{item.system_id}/reviews/new?period_start={item.period_start}&period_end={item.period_end}"
             class="inline-flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container
                    text-on-primary px-5 py-2.5 rounded-2xl font-semibold text-sm
                    transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                    cursor-pointer">
            Start review
            <ArrowRightIcon class="w-4 h-4" />
          </a>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Empty state -->
    <div class="bg-surface-container-low rounded-xl p-12 text-center">
      <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary
                  flex items-center justify-center mx-auto mb-4">
        <CheckIcon class="w-6 h-6" />
      </div>
      <h2 class="font-body text-lg font-semibold text-on-surface mb-2">All caught up</h2>
      <p class="font-body text-sm text-muted-foreground max-w-sm mx-auto">
        No systems are due for review right now. Check back after your next schedule window closes.
      </p>
    </div>
  {/if}
</div>
```

## Visual Tone for Review Day

- The page is intentionally sparse — it's a landing pad to start reviews, not a dashboard
- Each card mirrors the instance summary layout from the per-system review form, providing visual consistency
- The "Start review" CTA uses a gradient button with an arrow-right icon — forward motion
- Empty state uses a `surface-container-low` section with an icon box in primary/10 tint — calm, not congratulatory
- If all systems are reviewed but some have upcoming schedules, a secondary line of text mentions the next review window
- No badge count on the NavBar for reviews due — the NavBar link text itself serves as the indicator ("Review Day")
- The page entrance animation is 400ms ease-in-out — reflective pacing matching the review act itself