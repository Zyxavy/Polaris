# Design System Master File — Polaris

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Polaris
**Generated:** 2026-07-02
**Category:** Personal Systems Builder / Journal

**App Philosophy:** "Works on the worst day." Low-friction, non-punitive, warm, personal. Designed for daily repetition and weekly reflection. Not a habit tracker — a systems builder.

**Creative North Star:** "The Digital Sanctuary" — the screen is a series of curated, layered spaces. Intentional asymmetry, breathing negative space, fine paper or frosted glass rather than a digital interface.

---

## Global Rules

### Color Palette

Sophisticated interplay of deep sage, warm taupe, and warm cream tones. Tonal depth over structural containment.

**Tailwind v4 with `data-theme` attribute strategy:**

```html
<html data-theme="light">  <!-- or "dark" -->
```

Toggle via `localStorage` + `prefers-color-scheme`.

| Role | Light Hex | Dark Hex | Tailwind Class |
|------|-----------|----------|----------------|
| Surface (base background) | `#E9E4D7` | `#101519` | `bg-surface` |
| Surface Container Low | `#DDD5C3` | `#1A1F24` | `bg-surface-container-low` |
| Surface Container Lowest | `#F4F0E6` | `#22282E` | `bg-surface-container-lowest` |
| On Surface (foreground) | `#191c18` | `#D1CFC0` | `text-on-surface` |
| Primary (accent) | `#55624d` | `#8FA88A` | `text-primary`, `bg-primary` |
| On Primary | `#ffffff` | `#101519` | `text-on-primary` |
| Primary Container (gradient pair) | `#98a68e` | `#6B7D65` | `bg-primary-container` |
| Secondary (warm taupe) | `#755754` | `#A08684` | `text-secondary`, `bg-secondary` |
| Blush (high-emotion moments) | `#fed7d2` | `#D6A09B` | `text-blush`, `bg-blush` |
| Muted | `rgba(25,28,24,0.04)` | `rgba(255,255,255,0.04)` | `bg-muted` |
| Muted Foreground | `#6B6B6B` | `#9B9B8E` | `text-muted-foreground` |
| Border (inputs only) | `rgba(25,28,24,0.12)` | `rgba(209,207,192,0.10)` | `border-border` |
| Outline Variant (ghost fallback) | `#c5c8be` | `#4A4D46` | `border-outline-variant` |
| Destructive | `#C24545` | `#E07070` | `bg-destructive`, `text-destructive` |
| Ring | `#55624d` | `#8FA88A` | `ring-ring` |

**Color Notes:**

- Surface is warm cream (`#E9E4D7`) — not pure white, adds warmth and reduces eye strain
- Dark mode uses deep charcoal-blue (`#101519`) for a calm night feel
- Primary is deep sage (`#55624d`) — grounded, natural, never loud
- Secondary/warm taupe (`#755754`) adds emotional warmth to callouts and highlights
- Blush (`#fed7d2`) reserved for "high-emotion" moments — completed streaks, badges, celebrations
- No pure black or pure white anywhere — every surface and text has a warm tint

### The "No-Line" Rule

**Prohibit 1px solid borders for sectioning cards and content areas.** Boundaries are defined solely through background color shifts. A `surface-container-low` section sitting on a `surface` background provides enough contrast without visual noise.

**Surface nesting pattern:**

```
surface (#E9E4D7)           →  outermost page background
  └─ surface-container-low (#DDD5C3)  →  section grouping
       └─ surface-container-lowest (#F4F0E6) →  interactive cards
```

**Exception:** Input fields and form controls may use a subtle `border-border` stroke to define the interactive zone.

### Typography

Pairing of **Manrope** for structural authority and **Plus Jakarta Sans** for modern, approachable legibility.

| Level | Font | Weight | Size | Usage |
|-------|------|--------|------|-------|
| Display | Manrope | 600 | 3.5rem / `text-6xl` | Mood-setting moments ("Good morning"), hero |
| Headline | Manrope | 600 | 1.875rem / `text-3xl` | Page titles, modal headers |
| Title | Plus Jakarta Sans | 600 | 1.25rem / `text-xl` | Card headings, section labels |
| Body | Plus Jakarta Sans | 400 | 1rem / `text-base` | All UI text, data, descriptions |
| Label | Plus Jakarta Sans | 500 | 0.875rem / `text-sm` | Buttons, form labels, nav items |

**Google Fonts:**

```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
```

**Tailwind config:**

```js
fontFamily: {
  display: ['Manrope', 'sans-serif'],
  body: ['Plus Jakarta Sans', 'sans-serif'],
}
```

**Hierarchy through weight, not just size:** Use `text-primary` for headlines to keep them soft, and `text-on-surface` at reduced weight for body to lower eye strain.

### Spacing

Use Tailwind's built-in spacing scale with generous gaps for breathing room.

| Scale | Value | Usage |
|-------|-------|-------|
| `p-3` / `gap-3` | `0.75rem` (12px) | Tight icon-label spacing |
| `p-4` / `gap-4` | `1rem` (16px) | Standard card padding |
| `p-6` / `gap-6` | `1.5rem` (24px) | Section padding |
| `gap-8` | `2rem` (32px) | Large section gaps |
| `gap-11` | `2.75rem` (44px) | Content block separators (no divider lines) |

**No divider lines anywhere.** Use `gap-11` (2.75rem) to separate content blocks visually.

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-lg` | `0.75rem` (12px) | Small elements, tags |
| `rounded-xl` | `1rem` (16px) | Standard cards, inputs, modals |
| `rounded-2xl` | `1.5rem` (24px) | Hero containers, feature cards |
| `rounded-full` | `9999px` | Floating nav pill, avatars |

### Shadows (Ambient Softness)

Traditional shadows are too heavy for a tranquility-focused app. Use ambient softness instead.

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-ambient-sm` | `0 2px 8px rgba(85,98,77,0.04)` | Subtle card lift |
| `shadow-ambient-md` | `0 8px 24px rgba(85,98,77,0.05)` | Cards, buttons |
| `shadow-ambient-lg` | `0 16px 40px rgba(85,98,77,0.06)` | Modals, dropdowns, floating nav |
| `shadow-ambient-xl` | `0 24px 60px rgba(85,98,77,0.07)` | Featured cards, hero |

**Rules:**

- Shadow color uses `primary` (`#55624d`) as base, not black — softer, tinted
- Wide blur (24-60px), zero spread, low opacity (4-7%)
- In dark mode, shadows are invisible — rely on surface stacking for depth
- **Ghost border fallback:** If a border is needed for accessibility, use `outline-variant` (`#c5c8be`) at 15% opacity

---

## Component Specs

### Buttons (Tailwind)

All buttons use `rounded-2xl` for a noticeably rounded look. Primary CTA uses a subtle gradient.

```svelte
<!-- Primary CTA (Gradient — sage → primary-container) -->
<button class="bg-gradient-to-br from-primary to-primary-container text-on-primary
             px-6 py-3 rounded-2xl font-semibold
             transition-all duration-200 hover:opacity-90 active:scale-[0.98]
             focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
             cursor-pointer">
  {label}
</button>

<!-- Secondary (Warm taupe outline) -->
<button class="border border-secondary/30 text-secondary
             px-6 py-3 rounded-2xl font-semibold
             transition-all duration-200 hover:bg-secondary/5
             focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
             cursor-pointer">
  {label}
</button>

<!-- Ghost (Minimal, for system rows) -->
<button class="text-muted-foreground px-3 py-2 rounded-xl font-medium
             transition-all duration-150 hover:bg-muted hover:text-on-surface
             focus:outline-none focus:ring-2 focus:ring-ring
             cursor-pointer">
  {label}
</button>
```

### Cards

No border — separation via surface nesting only.

```svelte
<div class="bg-surface-container-lowest text-on-surface rounded-xl p-6 shadow-ambient-md
            transition-shadow duration-200 hover:shadow-ambient-lg">
  {content}
</div>
```

**Do not use translateY hover on card grids** — it causes visual jitter. Use shadow depth only.

### Inputs

Inputs are the one exception to the no-line rule — they retain a subtle border.

```svelte
<input
  class="w-full px-4 py-3 bg-surface-container-low text-on-surface
         border border-border rounded-xl
         transition-colors duration-200
         focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
         placeholder:text-muted-foreground"
  {...rest}
/>
```

**Focus state:** On focus, transition background to `primary-container` at 20% opacity rather than adding a heavy border.

### Floating Bottom Navigation

Glassmorphism pill — unboxed and floating.

```svelte
<nav class="fixed bottom-6 left-1/2 -translate-x-1/2
            bg-surface/70 backdrop-blur-xl
            rounded-full px-8 py-3
            shadow-ambient-lg
            flex items-center gap-6
            z-50">
  {#each navItems as item}
    <button class="flex flex-col items-center gap-1
                   {item.active
                     ? 'text-primary'
                     : 'text-muted-foreground hover:text-on-surface'}
                   transition-colors duration-200 cursor-pointer">
      <Icon icon={item.icon} class="w-5 h-5 stroke-1" />
      <span class="text-[10px] font-medium">{item.label}</span>
    </button>
  {/each}
</nav>
```

**Icon style:** Thin-stroke (1pt) line-art icons. Active state uses `text-primary` — no fill, no background pill.

### Modals

```svelte
<!-- Overlay -->
<div class="fixed inset-0 bg-on-surface/30 backdrop-blur-sm z-40 flex items-center justify-center p-4">
  <!-- Modal -->
  <div class="bg-surface-container-lowest text-on-surface rounded-xl p-8 shadow-ambient-lg max-w-lg w-full">
    {content}
  </div>
</div>
```

### Progress / Status

For system trackers (floor/full states):

```svelte
<!-- Floor achieved (minimum viable) -->
<span class="inline-flex items-center gap-1.5 text-sm text-secondary">
  <CheckIcon class="w-4 h-4" /> Floor
</span>

<!-- Full completed — use blush for high-emotion moments -->
<span class="inline-flex items-center gap-1.5 text-sm text-blush font-medium">
  <CheckCircleIcon class="w-4 h-4" /> Full
</span>

<!-- Missed/skipped -->
<span class="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
  <XIcon class="w-4 h-4" /> Missed
</span>
```

### Ring Charts (Wellness / Streak Progress)

```svelte
<!-- 12pt stroke width, round end-caps -->
<svg class="w-16 h-16">
  <!-- Background track -->
  <circle cx="32" cy="32" r="26" fill="none"
          stroke="currentColor" class="text-surface-container-low"
          stroke-width="12" stroke-linecap="round" />
  <!-- Progress fill — gradient -->
  <circle cx="32" cy="32" r="26" fill="none"
          stroke="url(#progress-grad)"
          stroke-width="12" stroke-linecap="round"
          stroke-dasharray={circumference}
          stroke-dashoffset={offset} />
  <defs>
    <linearGradient id="progress-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="var(--color-primary)" />
      <stop offset="100%" stop-color="var(--color-primary-container)" />
    </linearGradient>
  </defs>
</svg>
```

---

## Style Guidelines

**Style:** The Breathable Interface — editorial, layered, tranquil

**Keywords:** Tonal depth, ambient shadows, glassmorphism, sage + taupe + blush, negative space

**Best For:** Daily-use personal tools, journaling, productivity, reading/reflection apps

**Key Effects:**

- No-line sectioning via background color shifts (`surface` → `surface-container-low` → `surface-container-lowest`)
- Ambient tinted shadows (wide blur, primary-colored at 4-7% opacity)
- Glassmorphism on floating elements (`backdrop-blur-xl`, 70% opacity)
- Signature gradient on primary CTAs (`primary` → `primary-container` at 135°)
- Blush (`#fed7d2`) for high-emotion moments (completions, badges, streaks)
- Rounded corners throughout (16px on cards/buttons, 24px on heroes)
- Prioritize negative space — if a screen feels full, increase spacing by one increment
- Asymmetrical layouts to break the "standard app" feel

### Animation Timing

| Context | Duration | Easing | Example |
|---------|----------|--------|---------|
| Micro-interactions | 200ms | ease-out | Button hover, focus rings, icon toggles |
| Element transitions | 300ms | ease-in-out | Card expand, modal open/close, nav switch |
| Mood-setting / page | 400-600ms | ease-in-out | Page transitions, greeting cards, progress reveals |

### Page Patterns

| Page | Pattern | Notes |
|------|---------|-------|
| Landing/marketing | Storytelling-Driven | Hero > Features > CTA > Footer |
| Dashboard (daily view) | Bento Grid | Widget grid, today's status at top, floating nav |
| System Creator | Sectioned Form | Stepper-styled visual progress, but all fields live in one autosaving form |
| Workspace | Bento Grid | Drag-and-drop widget layout |
| Weekly Review | List + Summary | Reflective, not transactional |

---

## Design Philosophy — Polar-Specific

1. **Works on the worst day** — UI must be usable when user is tired, stressed, or unmotivated. Large tap targets, clear labels, forgiving inputs.
2. **Remove the decision** — Pre-fill defaults, auto-save everything, minimize settings screens.
3. **Capture beats perfection** — Favor quick-add over structured forms. Allow rough input, refine later.
4. **Repetition creates motivation** — Make the daily check-in feel rewarding, not obligatory. Warm tone, simple feedback.
5. **The review closes the loop** — The weekly review is the most important screen after the daily dashboard. Make it reflective, not punitive.

---

## Anti-Patterns (Do NOT Use)

- ❌ **Pure black or pure white** — `#000000` and `#FFFFFF` are forbidden. All surfaces and text must be muted and warm-tinted.
- ❌ **Neon or high-saturation colors** — No bright blues, greens, or purples. The palette is deliberately muted.
- ❌ **1px solid borders on sections/cards** — Use background color shifts instead. Only form inputs may use borders.
- ❌ **Sharp/square corners on interactive elements** — All buttons use `rounded-2xl`. Minimum `rounded-lg` (0.75rem) on anything interactive.
- ❌ **Divider lines** — Use generous spacing (`gap-11` / 2.75rem) to separate content blocks.
- ❌ **Bright red for destructive actions** — Use muted warm red (`#C24545`) instead.
- ❌ **Heavy black shadows** — Always use ambient tinted shadows (primary-colored base, wide blur, low opacity).
- ❌ **Emojis as icons** — Use SVG (Phosphor for web, Heroicons fallback). Thin-stroke (1pt) line-art for nav icons.
- ❌ **Layout-shifting hovers** — No scale transforms on cards in grids.
- ❌ **Punitive language** — Never "streak lost" or "you failed." Use "missed" / "skipped" / "tomorrow's a new day."
- ❌ **Empty states without guidance** — Empty dashboard shows the "Create your first system" prompt, not a blank page.
- ❌ **Full-screen loading spinners** — Use skeleton loaders for dashboard widgets.
- ❌ **Confetti / pop animations** — The app's tone is warm and calm, not gamified. Use ease-in-out with deliberate pacing.

---

## Pre-Delivery Checklist

- [ ] No emojis as icons (use Phosphor SVG icons, thin-stroke line-art)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Micro-interactions at 200ms, page transitions at 400ms+
- [ ] Light mode: body text contrast >=4.5:1
- [ ] Focus states visible for keyboard navigation using accent ring
- [ ] `prefers-reduced-motion` respected — fall back to instant transitions
- [ ] Responsive: 375px, 768px, 1024px
- [ ] No border lines on cards or sections — verified against the no-line rule
- [ ] Floating nav uses glassmorphism (`bg-surface/70 backdrop-blur-xl rounded-full`)
- [ ] Auto-save indicator present on mutable forms
- [ ] Non-punitive language for misses (no "streak lost")
- [ ] Empty states have helpful guidance, not blank pages
- [ ] Dark mode tested independently (not inferred from light)
- [ ] All touch targets >=44px
- [ ] Blush (`#fed7d2`) used for high-emotion moments — not bright green or gold
