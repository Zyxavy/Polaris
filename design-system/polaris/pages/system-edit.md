# System Edit — Page Override

> Page-specific overrides for `design-system/polaris/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

Reuses the System Creator form (`system-creator.md`) pre-filled from the existing System record, with the same autosave pattern. The only differences are the page header and the submit action.

```svelte
<div class="max-w-3xl mx-auto px-6 py-8">
  <!-- Page header — subtle difference from Creator -->
  <div class="mb-10">
    <div class="flex items-center gap-3 mb-1">
      <a href="/systems/{system.id}" class="text-muted-foreground hover:text-on-surface transition-colors">
        <ArrowLeftIcon class="w-4 h-4" />
      </a>
      <h1 class="font-display text-2xl font-semibold text-on-surface">Edit {system.name}</h1>
    </div>
    <p class="font-body text-sm text-muted-foreground mt-1 ml-7">
      Changes are saved automatically. Review before confirming.
    </p>
  </div>

  <!-- Same form sections as System Creator, pre-filled -->
  <!-- ... -->

  <!-- Footer — same as Creator but with different CTA -->
  <div class="flex items-center justify-between pt-4 border-t border-border/50">
    <a href="/systems/{system.id}"
       class="text-sm text-muted-foreground hover:text-on-surface transition-colors cursor-pointer">
      Cancel
    </a>
    <button type="submit"
            class="bg-gradient-to-br from-primary to-primary-container text-on-primary
                   px-8 py-3 rounded-2xl font-semibold
                   transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                   cursor-pointer">
      Save changes
    </button>
  </div>
</div>
```

## Visual Tone for Edit

- Back arrow before the title to reinforce this is a detail-navigation, not a standalone page
- "Cancel" link returns to the system detail overview — no confirmation dialog if no changes are dirty (autosave handles it)
- Autosave uses the same `dirty` state as the Creator — the save indicator shows "Saved" once persisted
- The form layout is identical to the Creator — muscle memory carries over
- No template picker or AI draft panel — those are creation-only affordances