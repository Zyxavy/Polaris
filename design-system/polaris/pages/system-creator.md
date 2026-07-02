# System Creator - Page Override

> Page-specific overrides for `design-system/polaris/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

The System Creator is a **single scrollable form with stepper-styled section markers**, not a gated wizard. This preserves the autosave rule from the PRD: every field is part of one persistent form state from the moment the page opens.

| Breakpoint | Layout | Max Width | Section Gap |
|------------|--------|-----------|-------------|
| 375px (mobile) | Single column | full width | gap-8 |
| 768px (tablet) | Single column with sticky progress summary | 720px | gap-8 |
| 1024px+ | Two-column shell: form + right rail | 1120px | gap-11 |

Desktop uses a wide editorial layout: the main form sits left, while a calm right rail shows progress, autosave status, template/AI context, and the current floor action preview. Mobile collapses the rail below the page title.

## Form Sections

Use visual section breaks instead of hard step gates. Each section is a `surface-container-low` block with nested `surface-container-lowest` inputs.

```svelte
<section class="bg-surface-container-low rounded-2xl p-6 shadow-ambient-sm">
  <div class="mb-6 flex items-start justify-between gap-4">
    <div>
      <p class="text-sm font-medium text-secondary">Step {index}</p>
      <h2 class="font-display text-2xl font-semibold text-primary">{title}</h2>
      <p class="mt-2 text-sm text-muted-foreground">{helperText}</p>
    </div>
    <SectionStatus state={completionState} />
  </div>
  {fields}
</section>
```

Required section order: Purpose, Philosophy, Protocol, Floor Action, Trigger, Barrier List, Environment Cue, Schedule.

## Progress Treatment

The page can look like a stepper, but it must not behave like a gated stepper.

- Show a vertical progress rail on desktop and a compact horizontal progress row on mobile.
- Section markers link-scroll to each section; they never hide or lock fields.
- Completion state is soft: `Complete`, `Needs floor action`, `Draft`, not pass/fail language.
- The primary CTA stays available, but `Save System` surfaces inline validation from `POST /api/systems/:id/confirm`.
- Autosave status is always visible in the right rail or sticky bottom bar.

## Template And AI Panels

`<TemplatePicker>` and `<AIDraftPanel>` are calm assistive panels above the form, not separate flows.

```svelte
<div class="grid gap-4 lg:grid-cols-2">
  <section class="bg-surface-container-lowest rounded-2xl p-5 shadow-ambient-sm">
    <h2 class="text-xl font-semibold text-on-surface">Start from a template</h2>
    <p class="mt-2 text-sm text-muted-foreground">Prefill the form, then edit every field.</p>
  </section>
  <section class="bg-surface-container-lowest rounded-2xl p-5 shadow-ambient-sm">
    <h2 class="text-xl font-semibold text-on-surface">Draft with AI</h2>
    <p class="mt-2 text-sm text-muted-foreground">Suggestions land in the same editable form.</p>
  </section>
</div>
```

No modal takeover for either panel. Selection should feel like adding a starting point, not changing modes.

## Field Styling

- Use textareas for Philosophy, Protocol, Barrier List, and Environment Cue when the value may need reflection.
- Use forgiving helper text under each label; avoid validation language until the user explicitly saves.
- Highlight Floor Action with `bg-blush/20` only after it is filled, because it is the product's central worst-day safeguard.
- Environment Cue should prompt for physical or visual cues: "book on pillow", "gym bag by door", "notes open on desk".
- Keep labels concrete and non-punitive: "What usually gets in the way?" instead of "Why do you fail?".

## Save And Error States

- Autosave indicator: muted checkmark + `Saved`, `Saving`, or `Offline draft not saved` in the right rail or sticky bottom bar.
- `floor_action_required` appears inline inside the Floor Action section, not as a toast.
- AI unavailable states stay inside the AI panel; manual creation remains visually primary.
- Confirm button uses the Master primary CTA, but copy should be calm: `Save system`, not `Finish setup now`.

## Visual Tone For System Creator

- The mood is guided reflection, not onboarding pressure.
- Use step language as orientation, not gating.
- Prefer roomy input blocks over dense multi-column forms.
- Do not show completion percentages; they imply gamified progress.
- Do not collapse completed sections automatically; users should be able to revise without friction.
