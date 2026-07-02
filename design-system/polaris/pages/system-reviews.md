# System Reviews List — Page Override

> Page-specific overrides for `design-system/polaris/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

Tab content within the System Detail shell (third tab: Reviews). Shows a history of past reviews and a "Start review" CTA for the current period.

```svelte
<div class="flex flex-col gap-6">
  <!-- "Start review" CTA — shown when no review exists for current period -->
  {#if showStartCta}
    <div class="bg-surface-container-low rounded-xl p-6 flex items-center justify-between">
      <div>
        <h2 class="font-body text-sm font-semibold text-on-surface">Review this period</h2>
        <p class="font-body text-xs text-muted-foreground mt-1">
          {currentPeriod}
        </p>
      </div>
      <a href="/systems/{system.id}/reviews/new?period_start={periodStart}&period_end={periodEnd}"
         class="bg-gradient-to-br from-primary to-primary-container text-on-primary
                px-5 py-2.5 rounded-2xl font-semibold text-sm
                transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                cursor-pointer">
        Start review
      </a>
    </div>
  {/if}

  <!-- Reviews list -->
  {#if reviews.length > 0}
    <div class="flex flex-col gap-4">
      {#each reviews as review}
        <div class="bg-surface-container-lowest rounded-xl p-6 shadow-ambient-sm">
          <!-- Period header -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-body text-sm font-semibold text-on-surface">
              {review.period_start} — {review.period_end}
            </h3>
            <span class="text-xs text-muted-foreground">
              {review.created_at}
            </span>
          </div>

          <!-- Review fields -->
          <div class="space-y-3">
            <div>
              <p class="font-body text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                What worked
              </p>
              <p class="font-body text-sm text-on-surface">{review.what_worked}</p>
            </div>

            {#if review.what_broke}
              <div>
                <p class="font-body text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  What broke
                </p>
                <p class="font-body text-sm text-on-surface">{review.what_broke}</p>
              </div>
            {/if}

            {#if review.worst_day_check}
              <div>
                <p class="font-body text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Worst day check
                </p>
                <p class="font-body text-sm text-on-surface">{review.worst_day_check}</p>
              </div>
            {/if}
          </div>

          <!-- Change applied summary -->
          {#if review.change_applied}
            <div class="mt-4 pt-4 border-t border-border/30">
              <p class="font-body text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Change applied
              </p>
              <p class="font-body text-sm text-secondary">{review.change_applied}</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    {#if hasMore}
      <button onclick={loadMore}
              class="w-full py-3 text-sm text-muted-foreground hover:text-on-surface
                     transition-colors duration-200 cursor-pointer">
        Load earlier reviews
      </button>
    {/if}
  {:else}
    <!-- Empty state -->
    <div class="bg-surface-container-low rounded-xl p-10 text-center">
      <p class="font-body text-sm text-muted-foreground">
        No reviews yet. Once you complete a review period, past reviews will appear here.
      </p>
    </div>
  {/if}
</div>
```

## Visual Tone for Reviews List

- The "Start review" CTA sits in a `surface-container-low` banner at the top — visually separate from the review cards. Shows only when the current period has no review yet.
- Each review card uses `surface-container-lowest` with `shadow-ambient-sm` — subtle lift, calm reading experience
- Review field labels use muted uppercase small text for quiet hierarchy
- "What worked" always shown; "What broke" and "Worst day check" conditionally shown if non-empty
- Change applied section is separated by a thin `border-border/30` line — this is acceptable because it's within a card, distinguishing two semantic zones without creating visual noise on the page level
- Empty state uses `surface-container-low` with centered text — understated, no illustration
- "Load earlier reviews" is a ghost button at the bottom — no gradient, minimal visual weight
- Cancel from the review form (`/systems/[id]/reviews/new`) returns here