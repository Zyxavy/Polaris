# Guides — Page Override

> Page-specific overrides for `design-system/polaris/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

Single-column, scrollable content page. The guides page is highlighted on first visit after sign-up and acts as the onboarding entry point.

```svelte
<div class="max-w-3xl mx-auto px-6 py-12">
  <!-- Page header -->
  <div class="mb-12">
    <h1 class="font-display text-3xl font-semibold text-primary mb-3">Welcome to Polaris</h1>
    <p class="font-body text-base text-muted-foreground text-balance">
      Systems are repeatable processes that produce results without depending on daily motivation.
      Here's how to build your first one.
    </p>
  </div>

  <!-- Guide cards -->
  <div class="flex flex-col gap-8">
    {#each guides as guide}
      <article class="bg-surface-container-lowest rounded-xl p-6 shadow-ambient-sm
                      transition-shadow duration-200 hover:shadow-ambient-md">
        <div class="flex items-start gap-4">
          <span class="w-8 h-8 rounded-lg bg-accent/10 text-accent
                       flex items-center justify-center font-display text-sm font-semibold shrink-0">
            {guide.number}
          </span>
          <div class="flex-1">
            <h2 class="font-body text-lg font-semibold text-on-surface mb-2">{guide.title}</h2>
            <p class="font-body text-sm text-muted-foreground mb-4">{guide.description}</p>
            <a href={guide.href}
               class="inline-flex items-center gap-1.5 text-sm font-medium text-primary
                      hover:underline transition-colors duration-150">
              {guide.cta} &rarr;
            </a>
          </div>
        </div>
      </article>
    {/each}
  </div>

  <!-- Quick start CTA -->
  <div class="mt-12 bg-surface-container-low rounded-xl p-8 text-center">
    <h2 class="font-display text-xl font-semibold text-on-surface mb-3">Ready to start?</h2>
    <p class="font-body text-sm text-muted-foreground mb-6 max-w-md mx-auto">
      Skip the guides and build your first system right now.
    </p>
    <a href="/systems/new"
       class="inline-block bg-gradient-to-br from-primary to-primary-container text-on-primary
              px-8 py-3 rounded-2xl font-semibold
              transition-all duration-200 hover:opacity-90 active:scale-[0.98]
              cursor-pointer">
      Create your first system
    </a>
  </div>
</div>
```

## Visual Tone for Guides

- Uses the same card pattern as dashboard widgets (`surface-container-lowest`, `rounded-xl`, `shadow-ambient-sm`)
- Each guide is numbered with an accent-colored badge — sequential, not overwhelming
- The quick-start CTA at the bottom uses a `surface-container-low` background (one level deeper) to visually separate it from the guide list
- Guides content is educational and calm — no progress bars, no "3 of 5 completed" tracking
- On first visit post-sign-up, the page entrance uses a 400ms ease-in-out fade-in effect