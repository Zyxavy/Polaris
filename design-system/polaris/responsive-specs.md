# Responsive Specs

> Breakpoint behavior for every page layout in Polaris.
> Mobile-first, single-column default. Layout shifts at 768px (tablet) and 1024px (desktop).

---

## Breakpoint Definitions

Token value may change — refer to config constant:

| Name | Token | Width | Target |
|------|-------|-------|--------|
| Mobile | `--bp-mobile` | < 768px | Phones (375-414px) |
| Tablet | `--bp-tablet` | 768px - 1023px | Landscape phones, small tablets |
| Desktop | `--bp-desktop` | ≥ 1024px | Laptops, desktops |

All pages are **mobile-first** — the single-column layout is the default and breakpoints add complexity.

---

## 1. NavBar

| Breakpoint | Layout | Detail |
|------------|--------|--------|
| Mobile | Floating bottom pill | Icon only (no labels). `fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full` — 5 items with 6px gap. |
| Tablet | Floating bottom pill | Icon + short label (1 word). Slightly wider pill. `gap-8` between items. |
| Desktop | Floating bottom pill OR sidebar | Same pill as tablet (default). Optional sidebar for wide screens. Sidebar: `fixed left-0 top-0 h-screen w-48 bg-surface-container-low` with stacked items + user info at bottom. |

### Floating pill dimensions

```css
.nav-pill {
  height: 56px;        /* h-14 */
  padding: 0 1.5rem;   /* px-6 */
  border-radius: 9999px;
  background: rgba(248, 250, 243, 0.7);  /* bg-surface/70 */
  backdrop-filter: blur(24px);
  box-shadow: 0 8px 24px rgba(85, 98, 77, 0.05);  /* shadow-ambient-lg */
}
```

### Main content offset

Add `padding-bottom: calc(56px + 1.5rem)` to `main` on mobile to prevent content from hiding behind the floating nav. On desktop, remove the offset (or reduce to `1rem`).

---

## 2. Dashboard

| Breakpoint | Grid columns | Card min height | Gap |
|------------|-------------|-----------------|-----|
| Mobile | 1 | 200px | `gap-4` |
| Tablet | 2 | 160px | `gap-4` |
| Desktop | 3 | 140px | `gap-6` |

### Greeting header

| Breakpoint | Font size | Layout |
|------------|-----------|--------|
| Mobile | `text-2xl` (Manrope display) | Stacked: greeting on one line, subtext below |
| Tablet | `text-3xl` | Same stacked |
| Desktop | `text-4xl` | Inline: greeting + subtext on same row |

### Today's status header

| Breakpoint | Layout |
|------------|--------|
| Mobile | Single column: counts stacked (full / floor / missed in a row), date below |
| Tablet | Inline row: counts left, date right |
| Desktop | Same as tablet |

---

## 3. Systems List

| Breakpoint | Grid columns | Card padding | Gap |
|------------|-------------|--------------|-----|
| Mobile | 1 | `p-4` | `gap-4` |
| Tablet | 2 | `p-5` | `gap-5` |
| Desktop | 2 | `p-6` | `gap-6` |

### Page title

| Breakpoint | Heading | Subtext |
|------------|---------|---------|
| Mobile | `text-xl` hidden | Shown below heading |
| Tablet | `text-2xl` | Same row as heading |
| Desktop | `text-3xl` | Same row as heading |

---

## 4. System Detail

| Breakpoint | Layout | Content width |
|------------|--------|---------------|
| Mobile | Full-width single column | `max-w-100%` with `px-4` |
| Tablet | Centered single column | `max-w-2xl` |
| Desktop | Centered single column | `max-w-4xl` |

### Blueprint fields (read-only overview)

| Breakpoint | Field layout |
|------------|-------------|
| Mobile | Label above value, stacked |
| Tablet | Label above value, stacked |
| Desktop | Label + value inline (label 200px, value flex-1) on wide-container fields |

### Tab bar

| Breakpoint | Tab style |
|------------|-----------|
| Mobile | Scrollable horizontal (overflow-x-auto), 3 tabs visible |
| Tablet | Full-width, 3 tabs evenly spaced |
| Desktop | Left-aligned tabs, same as tablet |

---

## 5. System Creator / System Edit

| Breakpoint | Form width | Section card padding |
|------------|-----------|---------------------|
| Mobile | Full-width `px-4` | `p-4` |
| Tablet | `max-w-2xl` mx-auto | `p-5` |
| Desktop | `max-w-3xl` mx-auto | `p-6` |

### Section layout

All breakpoints: single-column form, sections stacked vertically. No multi-column at any size — form fields need full width.

### Template picker (Creator only)

| Breakpoint | Grid |
|------------|------|
| Mobile | 1 column |
| Tablet | 2 columns |
| Desktop | 3 columns |

---

## 6. Workspace Builder

| Breakpoint | Layout | Palette position | Canvas columns |
|------------|--------|-----------------|----------------|
| Mobile | Palette as horizontal scrollable strip above canvas | Top (overflow-x-auto, 80px tall) | 1 column |
| Tablet | Side-by-side | Left sidebar, 180px | 2 columns |
| Desktop | Side-by-side | Left sidebar, 200px | 3 columns |

### Mobile palette strip

```css
.palette-strip {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.75rem 1rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;  /* Firefox */
}
.palette-strip::-webkit-scrollbar {
  display: none;  /* Chrome/Safari */
}
```

### Save bar

| Breakpoint | Position |
|------------|----------|
| Mobile | Fixed bottom (above nav pill) — `bottom-[72px]` |
| Tablet | Sticky within workspace layout |
| Desktop | Same as tablet |

---

## 7. Auth Pages (Sign In / Sign Up)

| Breakpoint | Form card width | Vertical alignment |
|------------|----------------|-------------------|
| Mobile | Full-width with `px-4` (no visible card — form directly on surface) | `min-h-screen` centered |
| Tablet | `max-w-sm` card | Same |
| Desktop | `max-w-sm` card | Same |

No layout shift between breakpoints — auth pages are intentionally simple. The only change is horizontal padding reduces on mobile.

---

## 8. Review Day

| Breakpoint | Card layout | Instance summary |
|------------|-------------|-----------------|
| Mobile | Full-width cards, stacked | 3 stat rows inline (full / floor / missed), small display numbers |
| Tablet | Full-width cards | Same as mobile |
| Desktop | Full-width cards, slightly narrower container (`max-w-4xl`) | Same layout with larger display numbers |

---

## 9. Per-System Review Form

| Breakpoint | Form width | Section layout |
|------------|-----------|---------------|
| Mobile | Full-width `px-4` | Single column, stacked |
| Tablet | `max-w-2xl` mx-auto | Same |
| Desktop | `max-w-3xl` mx-auto | Same |

### Instance summary at top

| Breakpoint | Layout |
|------------|--------|
| Mobile | 3 stats in horizontal row, compact |
| Tablet | 3 stats with more spacing |
| Desktop | Same as tablet |

---

## 10. System Reviews List

| Breakpoint | Card width |
|------------|-----------|
| Mobile | Full-width |
| Tablet | Full-width within `max-w-2xl` |
| Desktop | Full-width within `max-w-3xl` |

---

## 11. Landing Page

| Breakpoint | Hero layout | Display font size | Content width |
|------------|-------------|-------------------|---------------|
| Mobile | Full-bleed, stacked | `text-3xl` (2rem) | `px-6` |
| Tablet | Full-bleed, slightly more breathing | `text-4xl` (2.5rem) | `px-12` |
| Desktop | Full-bleed, feature sections wider | `text-5xl` (3.5rem) | `max-w-5xl` mx-auto for feature sections |

No layout shift on hero — always single-column, always full-bleed. Only font size and padding change.

---

## 12. Guides Page

| Breakpoint | Card layout | Gap |
|------------|-------------|-----|
| Mobile | Single column, full-width cards | `gap-6` |
| Tablet | Single column, `max-w-2xl` centered | `gap-6` |
| Desktop | Single column, `max-w-3xl` centered | `gap-8` |

Always single-column — guides are read sequentially.

---

## Layout Override Summary Table

| Page | Mobile (default) | 768px+ | 1024px+ |
|------|-----------------|--------|---------|
| NavBar | Floating pill, icons only | Pill, icons + labels | Same or sidebar |
| Landing | Stacked, `text-3xl` hero | `text-4xl` | `text-5xl` + constrained features |
| Auth | Full-width form | `max-w-sm` card | Same |
| Guides | Single column | `max-w-2xl` | `max-w-3xl` |
| Dashboard | 1-col grid | 2-col grid | 3-col grid |
| Systems List | 1-col grid | 2-col grid | 2-col grid |
| System Creator | Full-width | `max-w-2xl` | `max-w-3xl` |
| System Detail | Full-width | `max-w-2xl` | `max-w-4xl` |
| Workspace | Palette strip top, 1-col canvas | Side palette, 2-col canvas | Side palette, 3-col canvas |
| Review Day | Full-width cards | `max-w-2xl` | `max-w-4xl` |
| Review Form | Full-width | `max-w-2xl` | `max-w-3xl` |
| System Reviews | Full-width | `max-w-2xl` | `max-w-3xl` |
