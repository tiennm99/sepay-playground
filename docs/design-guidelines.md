# SePay VietQR Playground — Design Guidelines

## Style Direction

**Technical-minimal.** Neutral grays + single indigo accent + sharp 4px-radius corners + monospace for codes/amounts. Why: dev audience scanning code; QR-payment domain benefits from feeling like a terminal/dashboard (precise, trustworthy, low-noise). No gradients, no shadows beyond `sm`, no decorative illustration. Information hierarchy carries weight.

## Color Tokens

### Light mode
| Token | Hex | Use |
|---|---|---|
| `bg` | `#FAFAFA` | page background |
| `surface` | `#FFFFFF` | cards, inputs |
| `border` | `#E5E5E5` | dividers, input borders |
| `text-primary` | `#0A0A0A` | body, headings |
| `text-muted` | `#737373` | labels, hints, timestamps |
| `accent` | `#4F46E5` | primary CTA, focus ring (indigo-600) |
| `accent-hover` | `#4338CA` | hover state |
| `success` | `#16A34A` | paid badge, confirmation |
| `warning` | `#D97706` | pending badge |
| `danger` | `#DC2626` | failed badge, cancel link |

### Dark mode
| Token | Hex |
|---|---|
| `bg` | `#0A0A0A` |
| `surface` | `#171717` |
| `border` | `#262626` |
| `text-primary` | `#FAFAFA` |
| `text-muted` | `#A3A3A3` |
| `accent` | `#6366F1` |
| `accent-hover` | `#818CF8` |
| `success` | `#22C55E` |
| `warning` | `#F59E0B` |
| `danger` | `#EF4444` |

All foreground/background pairs meet WCAG AA (≥4.5:1 for body, ≥3:1 for large text).

## Typography

- **Sans (UI):** `Inter` — broad Vietnamese diacritics support, neutral, dev-familiar.
- **Mono (codes/amounts):** `JetBrains Mono` — distinct `0/O`, `1/l/I`, ideal for order codes & VND figures.
- **Scale (px):** 12 (micro/label) · 14 (body-sm) · 16 (body) · 20 (subhead) · 30 (hero/page title).
- **Weights:** 400 (body), 500 (UI labels, buttons), 600 (headings).
- **Line-height:** 1.5 body, 1.2 headings, 1 for mono single-line amounts.

## Spacing

4-px base scale: `4, 8, 12, 16, 24, 32, 48`. No values outside this set. Card inner padding = 24. Stack gap between form rows = 16. Section gap = 32.

## Component Patterns

- **Button — primary:** filled `accent`, white text, h=40, px=16, radius=4, weight 500. Hover → `accent-hover`. Focus → 2px outline ring offset 2px in `accent`.
- **Button — ghost:** transparent, `text-muted`, hover → `text-primary` + `surface` bg. Used for "cancel / new order".
- **Input:** h=40, border 1px `border`, radius=4, surface bg, focus → border `accent` + 1px ring. Mono font for amount input.
- **Card:** `surface` bg, 1px `border`, radius=4, padding 24. No shadow in light mode; `shadow-sm` only in dark.
- **Badge (status):** inline-flex, h=20, px=8, radius=4, text-12 weight 500, mono. `pending` = warning bg-tint + warning text; `paid` = success bg-tint + success text; `failed` = danger bg-tint + danger text. Optional leading dot.
- **Code block / inline code:** mono, surface bg, 1px border, radius=4, px=6 py=2 (inline) or padding 12 (block).

## Motion

- State transitions (A→B→C on `/pay`): 150ms fade-in + 4px translate-y. No scale, no bounce.
- Waiting spinner: 1.2s linear rotate, 16px, accent-colored, 2px stroke.
- Button press: 100ms opacity 0.9.
- Respect `prefers-reduced-motion: reduce` → disable transitions, swap spinner for static dot.

## shadcn-svelte Mapping

Components installed via `pnpm dlx shadcn-svelte@latest add <name>`. Files land in `src/lib/components/ui/<name>/`.

| Pattern | shadcn-svelte component |
|---|---|
| Primary / ghost button | `Button` (variant `default` / `ghost`) |
| Amount input | `Input` (with `Label`) |
| Card container | `Card` (`Card.Root` / `Card.Header` / `Card.Content` / `Card.Footer`) |
| Status badge | `Badge` (variant custom: pending/paid/failed) |
| Toast on copy / cancel | `Sonner` (svelte-sonner) |
| Cancel confirm | `AlertDialog` |
| Skeleton while QR fetches | `Skeleton` |
| Inline code | custom `<code>` styled per tokens |

Dark mode via `mode-watcher` (shadcn-svelte standard). Icons via `lucide-svelte`.

## Accessibility

- Contrast: all text ≥4.5:1, UI controls ≥3:1.
- Focus ring: 2px solid `accent`, 2px offset, never removed; visible on keyboard nav only (`:focus-visible`).
- Tab order on `/pay` form: amount input → demo-amount link → Generate QR button.
- Amount input: `inputmode="numeric"`, `aria-label="Amount in VND"`, live validation announced via `aria-live="polite"`.
- Awaiting state: `role="status"` on waiting indicator, screen-reader text "Waiting for payment".
- Paid state: `role="status"` announces "Payment received".
- Min touch target 44×44 on mobile (button h=40 + padding satisfies via tap area).
- All links/buttons keyboard-activatable; no pointer-only handlers.

## Layout Rules

- Mobile-first. Max content width 480px on `/pay`, 560px on `/`. Centered, 16px horizontal page padding on mobile, 24px ≥768px.
- Single column throughout. No sidebars. No multi-step UI on `/pay` — same route, swap state.
