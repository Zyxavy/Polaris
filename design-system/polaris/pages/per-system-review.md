# Per-System Review Form — Page Override

> Page-specific overrides for `design-system/polaris/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

Single scrollable form that shows instance summary for the review period, review fields (what worked, what broke, worst day), and editable current system blueprint fields. Changes to blueprint fields are collected into the `change_applied` structured object.

```svelte
<div class="max-w-3xl mx-auto px-6 py-8">
  <!-- Page header -->
  <div class="mb-8">
    <h1 class="font-display text-2xl font-semibold text-on-surface">
      Review: {system.name}
    </h1>
    <p class="font-body text-sm text-muted-foreground mt-1">
      {periodStart} — {periodEnd}
    </p>
  </div>

  <!-- Instance summary — reuse component from Review Day -->
  <div class="bg-surface-container-low rounded-xl p-6 mb-10">
    <h2 class="font-body text-sm font-semibold text-on-surface mb-4 uppercase tracking-wide">Period Summary</h2>
    <div class="flex items-center gap-8">
      <div class="text-center">
        <span class="font-display text-2xl font-semibold text-primary">{counts.full}</span>
        <p class="font-body text-xs text-muted-foreground mt-1">Full</p>
      </div>
      <div class="text-center">
        <span class="font-display text-2xl font-semibold text-secondary">{counts.floor}</span>
        <p class="font-body text-xs text-muted-foreground mt-1">Floor</p>
      </div>
      <div class="text-center">
        <span class="font-display text-2xl font-semibold text-muted-foreground">{counts.missed}</span>
        <p class="font-body text-xs text-muted-foreground mt-1">Missed</p>
      </div>
    </div>
  </div>

  <!-- Review form -->
  <form class="flex flex-col gap-8">
    <!-- Review fields -->
    <section>
      <div class="flex items-center gap-3 mb-4">
        <span class="w-7 h-7 rounded-lg bg-primary/10 text-primary
                     flex items-center justify-center font-display text-xs font-semibold">1</span>
        <h2 class="font-body text-base font-semibold text-on-surface">Reflection</h2>
      </div>
      <div class="bg-surface-container-lowest rounded-xl p-6 shadow-ambient-sm space-y-4">
        <Textarea label="What worked?" bind:value={whatWorked}
                  placeholder="What went well? What felt easy?" rows={3} />
        <Textarea label="What broke?" bind:value={whatBroke}
                  placeholder="What didn't work? Where did you get stuck?" rows={3} />
        <Textarea label="Worst day check" bind:value={worstDayCheck}
                  placeholder="Did the floor action hold up on your worst day? If not, lower it."
                  rows={2} />
      </div>
    </section>

    <!-- Blueprint edit area -->
    <section>
      <div class="flex items-center gap-3 mb-4">
        <span class="w-7 h-7 rounded-lg bg-primary/10 text-primary
                     flex items-center justify-center font-display text-xs font-semibold">2</span>
        <h2 class="font-body text-base font-semibold text-on-surface">Adjust the system</h2>
      </div>
      <p class="font-body text-xs text-muted-foreground ml-10 mb-4">
        Edit the fields below to iterate your system. Changes are captured into this review.
      </p>
      <div class="bg-surface-container-lowest rounded-xl p-6 shadow-ambient-sm space-y-4">
        <Textarea label="Floor action" bind:value={floorAction} rows={2} />
        <Textarea label="Trigger" bind:value={trigger} rows={2} />
        <Textarea label="Barriers" bind:value={barriers} rows={2} />
        <Textarea label="Environment cues" bind:value={environmentCue} rows={2} />
      </div>
    </section>

    <!-- Optional note -->
    <section>
      <div class="bg-surface-container-low rounded-xl p-6">
        <label class="font-body text-sm font-medium text-on-surface block mb-2">
          Change description <span class="text-muted-foreground font-normal">(optional)</span>
        </label>
        <textarea bind:value={changeNote}
                  placeholder="Briefly describe what changed and why..."
                  class="w-full px-4 py-3 bg-surface-container-lowest text-on-surface
                         border border-border rounded-xl text-sm
                         focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
                         placeholder:text-muted-foreground"
                  rows={2}></textarea>
        <p class="font-body text-xs text-muted-foreground mt-2">
          If left empty, a description is auto-derived from the differences above.
        </p>
      </div>
    </section>

    <!-- Submit -->
    <div class="flex items-center justify-between pt-4 border-t border-border/50">
      <a href="/systems/{system.id}/reviews"
         class="text-sm text-muted-foreground hover:text-on-surface transition-colors cursor-pointer">
        Cancel
      </a>
      <button type="submit"
              class="bg-gradient-to-br from-primary to-primary-container text-on-primary
                     px-8 py-3 rounded-2xl font-semibold
                     transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                     cursor-pointer">
        Submit review
      </button>
    </div>
  </form>
</div>
```

## Visual Tone for Per-System Review

- The instance summary at the top uses large display numbers (Manrope) to give a quick visual pulse of the period — full in primary, floor in secondary, missed in muted-foreground
- Review fields (what worked / what broke / worst day) are the primary interaction — they come before the blueprint edits
- Blueprint fields are rendered as editable text areas, not a diff editor — the user rewrites freely
- The "Change description" note is optional and sits in a `surface-container-low` section to differentiate it from the required fields
- The tone of the placeholders is reflective and non-judgmental ("Did the floor action hold up? If not, lower it.")
- Submit is a gradient CTA — submitting a review is an important closing action
- 409 conflict handling: if a review already exists for this period, show an inline message in destructive color rather than blocking entirely