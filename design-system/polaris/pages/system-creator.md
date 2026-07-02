# System Creator — Page Override

> Page-specific overrides for `design-system/polaris/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

Single scrollable form with stepper-styled section markers — not a gated wizard. Autosave tracks every field from one form state. Template picker and AI draft panel sit above the form as optional starting points.

```svelte
<div class="max-w-3xl mx-auto px-6 py-8">
  <!-- Page header -->
  <div class="mb-10">
    <h1 class="font-display text-2xl font-semibold text-on-surface">Create a system</h1>
    <p class="font-body text-sm text-muted-foreground mt-1">
      Define a repeatable process that works even on your worst day.
    </p>
  </div>

  <!-- Template picker (collapsible) -->
  <details class="mb-8 bg-surface-container-low rounded-xl p-5 open:pb-8">
    <summary class="font-body text-sm font-semibold text-on-surface cursor-pointer select-none
                    flex items-center justify-between">
      Start from a template
      <ChevronIcon class="w-4 h-4 text-muted-foreground transition-transform duration-200
                          open:rotate-180" />
    </summary>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
      {#each templates as template}
        <button onclick={() => selectTemplate(template)}
                class="bg-surface-container-lowest rounded-xl p-4 text-left shadow-ambient-sm
                       transition-all duration-200 hover:shadow-ambient-md
                       cursor-pointer">
          <h4 class="font-body text-sm font-semibold text-on-surface">{template.name}</h4>
          <p class="font-body text-xs text-muted-foreground mt-1">{template.description}</p>
        </button>
      {/each}
    </div>
  </details>

  <!-- AI Draft panel -->
  <div class="mb-8 bg-surface-container-low rounded-xl p-5">
    <h3 class="font-body text-sm font-semibold text-on-surface mb-3">Draft with AI</h3>
    <div class="flex gap-3">
      <input type="text" bind:value={aiPrompt}
             placeholder="Describe your system in a sentence..."
             class="flex-1 px-4 py-3 bg-surface-container-lowest text-on-surface
                    border border-border rounded-xl text-sm
                    focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
                    placeholder:text-muted-foreground" />
      <button onclick={handleAIDraft}
              class="bg-gradient-to-br from-primary to-primary-container text-on-primary
                     px-5 py-3 rounded-2xl font-semibold text-sm
                     transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                     cursor-pointer">
        Draft
      </button>
    </div>
  </div>

  <!-- Main form -->
  <form class="flex flex-col gap-10">
    <!-- Section: Purpose -->
    <section>
      <div class="flex items-center gap-3 mb-4">
        <span class="w-7 h-7 rounded-lg bg-primary/10 text-primary
                     flex items-center justify-center font-display text-xs font-semibold">1</span>
        <h2 class="font-body text-base font-semibold text-on-surface">Purpose</h2>
      </div>
      <div class="bg-surface-container-lowest rounded-xl p-6 shadow-ambient-sm space-y-4">
        <Input label="System name" bind:value={name} placeholder="e.g. Reading System" />
        <Textarea label="Why does this system exist?" bind:value={purpose}
                  placeholder="What will this system help you achieve?" rows={3} />
      </div>
    </section>

    <!-- Section: Floor Action -->
    <section>
      <div class="flex items-center gap-3 mb-4">
        <span class="w-7 h-7 rounded-lg bg-primary/10 text-primary
                     flex items-center justify-center font-display text-xs font-semibold">2</span>
        <h2 class="font-body text-base font-semibold text-on-surface">Floor Action</h2>
      </div>
      <div class="bg-surface-container-lowest rounded-xl p-6 shadow-ambient-sm space-y-4">
        <p class="font-body text-xs text-muted-foreground">
          The minimum viable action that counts as a win — must be doable on your worst day.
        </p>
        <Textarea label="What's the smallest version?" bind:value={floorAction}
                  placeholder="e.g. Read one page" rows={2} />
        <Input label="Trigger (after I [X], I will [Y])" bind:value={trigger}
               placeholder="After I pour my morning coffee, I will open my book" />
      </div>
    </section>

    <!-- Section: Barriers & Environment -->
    <section>
      <div class="flex items-center gap-3 mb-4">
        <span class="w-7 h-7 rounded-lg bg-primary/10 text-primary
                     flex items-center justify-center font-display text-xs font-semibold">3</span>
        <h2 class="font-body text-base font-semibold text-on-surface">Barriers & Environment</h2>
      </div>
      <div class="bg-surface-container-lowest rounded-xl p-6 shadow-ambient-sm space-y-4">
        <Textarea label="What usually gets in the way?" bind:value={barriers}
                  placeholder="e.g. Phone notifications, tired after work" rows={2} />
        <Input label="Environment cue" bind:value={environmentCue}
               placeholder="e.g. Book on the pillow, gym bag by the door" />
      </div>
    </section>

    <!-- Section: Schedule -->
    <section>
      <div class="flex items-center gap-3 mb-4">
        <span class="w-7 h-7 rounded-lg bg-primary/10 text-primary
                     flex items-center justify-center font-display text-xs font-semibold">4</span>
        <h2 class="font-body text-base font-semibold text-on-surface">Schedule</h2>
      </div>
      <div class="bg-surface-container-lowest rounded-xl p-6 shadow-ambient-sm">
        <p class="font-body text-xs text-muted-foreground mb-4">
          How often does this system run? Each day has its own time window.
        </p>
        <SchedulePicker bind:value={schedule} />
      </div>
    </section>

    <!-- Save -->
    <div class="flex items-center justify-between pt-4 border-t border-border/50">
      <span class="text-xs text-muted-foreground">
        {#if saved}
          Saved <CheckIcon class="w-3 h-3 inline" />
        {:else if dirty}
          Unsaved changes
        {/if}
      </span>
      <button type="submit"
              class="bg-gradient-to-br from-primary to-primary-container text-on-primary
                     px-8 py-3 rounded-2xl font-semibold
                     transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                     cursor-pointer">
        Confirm system
      </button>
    </div>
  </form>
</div>
```

## Section Stepper Pattern

Each form section follows this structure:
1. Section number badge (primary/10 background, text-primary, small rounded square)
2. Section heading (Plus Jakarta Sans, semibold, text-on-surface)
3. Content card (surface-container-lowest, rounded-xl, shadow-ambient-sm)

The number badge provides a subtle sense of progress without being a traditional wizard step indicator. No "3 of 4" labels — the user scrolls freely.

## Autosave

Per PRD S6.1, every field change triggers a debounced PATCH (AUTOSAVE_DEBOUNCE_MS). The save indicator in the footer shows:
- "Saved" with a small checkmark when persisted
- "Unsaved changes" when dirty
- Nothing on initial load

The "Confirm system" button remains disabled until all required fields are filled. It calls `POST /api/systems/:id/confirm`.

## Visual Tone for System Creator

- No wizard gating — the user can jump between sections freely
- Template picker and AI draft are collapsed/optional — they don't impose a flow
- The form feels like a structured document, not a survey
- Placeholder text uses concrete examples ("Read one page") rather than abstract guidance ("Enter your goal")
- The floor action section includes a brief explanation of what "floor" means — this is the core concept of the app
- All inputs are border-bordered (the one exception to the no-line rule) for clear interactive zones