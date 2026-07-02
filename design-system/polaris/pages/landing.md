# Landing — Page Override

> Page-specific overrides for `design-system/polaris/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

The landing page is a **storytelling-driven** single-column scroll with no chrome, no nav shell, no auth guard. Always reachable. Uses `rounded-2xl` (1.5rem) on hero containers and feature cards for extra softness.

| Section | Visual Treatment | Notes |
|---------|-----------------|-------|
| Hero | Full-viewport, centered content, large display typography | "Good morning" mood — Manrope Display at 3.5rem |
| Features | 2-3 column grid, asymmetric layout | Bento-style cards with ambient shadows |
| CTA | Single gradient button, centered | Primary → primary-container gradient |
| Footer | Minimal, surface-container-low background | Logo, copyright, "Log In" and "Get Started" links only |

## Hero Section

Large, airy, and centered. Heavy negative space. No hero image — the typography and spacing carry the mood.

```svelte
<section class="min-h-[90vh] flex flex-col items-center justify-center gap-8 px-6 text-center">
  <h1 class="font-display text-6xl md:text-7xl font-semibold text-primary leading-[0.9]">
    Build systems<br />that survive<br /><span class="text-on-surface">the worst days</span>
  </h1>
  <p class="max-w-xl text-lg text-muted-foreground text-balance">
    A personal tool for designing, running, and refining repeatable processes
    that produce results without depending on daily motivation.
  </p>
  <div class="flex items-center gap-4 mt-4">
    <a href="/sign-up" class="bg-gradient-to-br from-primary to-primary-container text-on-primary
                            px-8 py-4 rounded-2xl font-semibold
                            transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                            cursor-pointer">
      Get Started
    </a>
    <a href="/sign-in" class="text-muted-foreground hover:text-on-surface transition-colors
                            px-6 py-4 rounded-2xl font-medium cursor-pointer">
      Log In
    </a>
  </div>
</section>
```

## Feature Cards

Asymmetric bento grid. No border — surface nesting only.

```svelte
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto px-6">
  {#each features as feature}
    <div class="bg-surface-container-lowest rounded-2xl p-8 shadow-ambient-md
                transition-shadow duration-300 hover:shadow-ambient-lg
                {feature.wide ? 'md:col-span-2' : ''}">
      <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        {@html feature.icon}
      </div>
      <h3 class="font-body text-xl font-semibold text-on-surface mb-2">{feature.title}</h3>
      <p class="font-body text-base text-muted-foreground">{feature.description}</p>
    </div>
  {/each}
</div>
```

## Visual Tone for Landing

- No screenshots, no mockups — the typography and negative space sell the product
- No features list before the fold — the headline and tagline are enough
- The mood is calm and confident, not urgent or hype-driven
- "Get Started" is the primary action, "Log In" is a subdued ghost link
- Footer is just logo + two links — no sitemap, no legal text
- Animation: 400-600ms ease-in-out for scroll reveals, 300ms for hover effects