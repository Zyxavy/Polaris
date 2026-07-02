# Dashboard — Page Override

> Page-specific overrides for `design-system/polaris/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

The dashboard is a **bento grid** of widgets (8 types: Timer, Counter/Tally, Log/Journal, Checklist, Link List, Streak/Calendar, Progress Chart, Notes).

| Breakpoint | Columns | Widget Min Height | Gutter |
|------------|---------|-------------------|--------|
| 375px (mobile) | 1 | 120px | gap-4 |
| 768px (tablet) | 2 | 140px | gap-4 |
| 1024px+ | 3 | 160px | gap-6 |

## Today's Status Header

Always visible at the top. Three states using subtle background tints, not bright colors:

```svelte
<!-- All systems complete — blush for high-emotion moment -->
<div class="bg-blush/30 text-blush rounded-xl px-6 py-4 flex items-center gap-3">
  <StarIcon class="w-5 h-5" />
  <span class="font-semibold">All systems nominal today</span>
</div>

<!-- Some pending — secondary/warm taupe -->
<div class="bg-secondary/10 text-secondary rounded-xl px-6 py-4 flex items-center gap-3">
  <ClockIcon class="w-5 h-5" />
  <span class="font-semibold">{n} systems left today</span>
</div>

<!-- All missed / end of day — muted -->
<div class="bg-muted text-muted-foreground rounded-xl px-6 py-4 flex items-center gap-3">
  <MoonIcon class="w-5 h-5" />
  <span class="font-semibold">Tomorrow's a new day</span>
</div>
```

Use soft background fills for status — no bright greens, no harsh reds. The "all complete" state uses a subtle blush tint for a warm celebratory moment.

## Widget Card Spec

Cards use surface nesting rather than borders. Follow the no-line rule.

```svelte
<div class="bg-surface-container-lowest text-on-surface rounded-xl p-4 shadow-ambient-sm
            transition-shadow duration-200 hover:shadow-ambient-md
            draggable cursor-grab active:cursor-grabbing
            min-h-[120px] flex flex-col">
  <!-- Widget header -->
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-sm font-semibold text-on-surface">{widget.title}</h3>
    <button class="text-muted-foreground hover:text-on-surface transition-colors cursor-pointer">
      <GripIcon class="w-4 h-4" />
    </button>
  </div>
  <!-- Widget content (slot) -->
  {slot}
</div>
```

## Visual Tone for Dashboard

- **No confetti, no celebrations** — even when "all systems nominal"
- The mood is quiet satisfaction, not gamified excitement
- **Don't use bright greens for completion** — use blush tinted backgrounds instead
- **Don't use bright reds for misses** — use muted foreground/muted background
- "All systems nominal" > "You're on a 30-day streak" (no streak counting in the UI)
- Skeleton loaders (not spinners) for widget loading — use a subtle pulsing card placeholder
- Auto-save indicator in top-right: muted checkmark + "Saved" label, fades after 2s
- Floating bottom nav via glassmorphism pill (see MASTER.md component spec)
