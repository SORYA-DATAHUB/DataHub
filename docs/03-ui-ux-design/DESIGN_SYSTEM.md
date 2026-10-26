# DataHub — Design System Documentation

| Field | Value |
|---|---|
| Document | #18 — Design System Documentation |
| Path | `docs/03-ui-ux-design/DESIGN_SYSTEM.md` |
| Version | v1.0 |
| Date | 2026-10-26 |
| Status | Baseline |
| Owner | Design lead (CTO role) |
| Related | [`UI_UX_DESIGN.md`](UI_UX_DESIGN.md), [`USER_FLOWS.md`](USER_FLOWS.md), [`WIREFRAMES/`](WIREFRAMES/README.md), [`../ENGINEERING_BASELINE.md`](../ENGINEERING_BASELINE.md) |

## 0. Document header

**Purpose.** Define the visual language and component rules of the DataHub web application precisely enough that `apps/web` can implement them verbatim: colour tokens for light and dark themes, typography (Latin + Khmer), spacing, grid, breakpoints, component specifications, the full status-badge map, money and byte formatting, and accessibility contrast evidence.

**Scope.** All surfaces of `apps/web` (public marketing pages, authentication, contributor / annotator / reviewer / admin workspaces, the annotation editor, the dataset review workspace, global error pages) and HTML email templates (which reuse the colour and type tokens). Out of scope: native mobile apps (none in v1), Khmer UI translation (strings are catalogued, English ships first — baseline A-02).

**Assumptions.**
- Stack per baseline §3: Next.js 15 App Router, Tailwind CSS 4 (CSS-first `@theme`), shadcn/ui vendored into `apps/web/src/components/ui`, lucide-react, Recharts, next-themes, `next/font` self-hosting Inter and Noto Sans Khmer.
- Content (dataset titles, descriptions, messages, transcriptions, comments) is frequently Khmer; UI chrome is English.
- Users work on laptops/desktops for review and annotation; contributors frequently use phones for checking status and earnings.

**Decisions.**
- D-DS-01 Identity is an "archival ledger": cool slate neutrals, deep indigo primary (`#3047D1`), teal reserved for money and accepted states, amber for pending, red for rejected/destructive. No gradients on app surfaces, no glassmorphism, no decorative illustration inside workspaces.
- D-DS-02 Tokens are OKLCH CSS variables (hex equivalents documented for design tools and email). The CSS in §3.4 is the canonical source for `apps/web/src/app/globals.css`.
- D-DS-03 Radius: 8 px controls, 12 px panels/cards/dialogs, 4–6 px badges and chips.
- D-DS-04 App base font size is 14 px (dense data UI); marketing pages use 16 px body.
- D-DS-05 Every status in baseline §9 maps to exactly one badge tone + label + icon (§9). Colour is never the only carrier of meaning.
- D-DS-06 Money is formatted from integer micros with BigInt, floored to cents, never through floating point (§12). Bytes use decimal units (§13).
- D-DS-07 Khmer text: line-height ≥ 1.8, letter-spacing always 0, no uppercase transforms, no JS word splitting (§4.4).

**Dependencies.** Engineering baseline §3 (stack), §7 (formats), §8 (money), §9 (state machines), §14 (WCAG 2.2 AA). `UI_UX_DESIGN.md` consumes these tokens and components; wireframes reference component names defined here.

**Acceptance criteria.**
1. `globals.css` in `apps/web` contains the exact variables in §3.4 for `:root` and `.dark`.
2. Every text/background token pair listed in §15 meets the stated contrast ratio (verified by automated check in CI using the hex values in §3.2/§3.3).
3. Every status value enumerated in baseline §9 renders through the `<StatusBadge>` component using the mapping in §9; a unit test iterates all enum values and fails on an unmapped value.
4. `formatMoney`, `parseMoneyInput`, `formatBytes`, `formatGB` implement §12–§13 and pass the listed examples as unit tests.
5. Khmer sample strings render without clipped diacritics (subscript consonants and vowel signs) in tables, inputs, badges, toasts and the editor at 100 % and 200 % zoom in both themes.

---

## 1. Design principles

1. **Ledger clarity.** Numbers, statuses and timestamps are the product. Tables are dense, aligned and scannable; figures use tabular numerals and right alignment.
2. **Calm surfaces, meaningful colour.** Surfaces are neutral slate. Colour appears only to communicate: indigo = action/selection, teal = money/accepted, amber = pending/waiting, red = rejected/destructive, sky = in-progress.
3. **Khmer-first content.** Any container that can show user content is sized for Khmer line height and stacked diacritics.
4. **Explicit over clever.** Financial and destructive actions are spelled out with exact amounts, recipients and consequences.
5. **Keyboard parity.** Everything achievable by pointer is achievable by keyboard with a visible focus ring.

## 2. Brand

- **Wordmark:** "DataHub" set in Inter 600, letter-spacing −0.01em, preceded by the mark: a 20 × 20 px rounded square (radius 5 px) in `--primary` containing three horizontal ledger lines of decreasing length in `--primary-foreground`. SVG lives at `apps/web/public/brand/mark.svg`; favicon is the mark alone.
- **Product voice:** plain, precise, respectful. Sentences, not slogans. Example: "We pay $1.00 for each accepted GB of raw data." — never "Monetise your data!".
- **Operator attribution:** footer line "DataHub is operated by SKAI Technology, Phnom Penh, Cambodia."
- **Imagery (public pages only):** monochrome document textures (scanned page edges, ledger rules) tinted with `--primary` at 8 % opacity. No stock photos of people, no 3-D blobs.

## 3. Colour

### 3.1 Roles

| Token | Role |
|---|---|
| `background` | App canvas behind panels |
| `foreground` | Primary text |
| `card` / `card-foreground` | Panels, cards, table containers |
| `popover` / `popover-foreground` | Menus, popovers, command palette, tooltips |
| `primary` / `primary-foreground` | Primary buttons, links, selection, focus ring |
| `secondary` / `secondary-foreground` | Secondary buttons, segmented controls |
| `muted` / `muted-foreground` | Subtle fills (table header, zebra hover), secondary text |
| `accent` / `accent-foreground` | Hover/selected row, active menu item |
| `destructive` / `destructive-foreground` | Destructive buttons |
| `border` | Decorative dividers and panel outlines (not required to meet 3:1) |
| `input` | Form-control borders (meets 3:1 non-text contrast against `card`) |
| `ring` | Focus indicator |
| `sidebar*` | Sidebar surface, text, active item, border |
| `success*`, `warning*`, `danger*`, `info*`, `progress*`, `neutral*` | Status tones: text/icon colour + tinted background |
| `money` | Alias of `success`; used for all positive currency figures |
| `chart-1 … chart-6` | Categorical chart series |

### 3.2 Light theme values

| Token | Hex | OKLCH |
|---|---|---|
| background | `#F6F7F9` | `oklch(0.976 0.003 264.5)` |
| foreground | `#0E1525` | `oklch(0.198 0.034 265.4)` |
| card | `#FFFFFF` | `oklch(1 0 0)` |
| card-foreground | `#0E1525` | `oklch(0.198 0.034 265.4)` |
| popover | `#FFFFFF` | `oklch(1 0 0)` |
| popover-foreground | `#0E1525` | `oklch(0.198 0.034 265.4)` |
| primary | `#3047D1` | `oklch(0.476 0.212 268.9)` |
| primary-foreground | `#FFFFFF` | `oklch(1 0 0)` |
| secondary | `#ECEFF5` | `oklch(0.952 0.009 264.5)` |
| secondary-foreground | `#1B2436` | `oklch(0.261 0.036 263.6)` |
| muted | `#EEF1F5` | `oklch(0.957 0.006 255.5)` |
| muted-foreground | `#586174` | `oklch(0.492 0.032 265.2)` |
| accent | `#E8ECFA` | `oklch(0.944 0.019 273.2)` |
| accent-foreground | `#1F2F9E` | `oklch(0.377 0.178 268.8)` |
| destructive | `#C42B32` | `oklch(0.538 0.189 24.3)` |
| destructive-foreground | `#FFFFFF` | `oklch(1 0 0)` |
| border | `#DCE1E9` | `oklch(0.908 0.012 259.8)` |
| input | `#848DA0` | `oklch(0.643 0.030 265.3)` |
| ring | `#3047D1` | `oklch(0.476 0.212 268.9)` |
| sidebar | `#EFF2F6` | `oklch(0.960 0.006 255.5)` |
| sidebar-foreground | `#2A3345` | `oklch(0.321 0.035 263.9)` |
| sidebar-accent (active item bg) | `#E2E7F8` | `oklch(0.929 0.024 272.8)` |
| sidebar-accent-foreground | `#22339C` | `oklch(0.384 0.170 269.1)` |
| sidebar-border | `#DCE1E9` | `oklch(0.908 0.012 259.8)` |
| success | `#0B7A6E` | `oklch(0.521 0.091 182.8)` |
| success-bg | `#E3F4F1` | `oklch(0.954 0.018 184.3)` |
| warning | `#A15C07` | `oklch(0.543 0.123 61.8)` |
| warning-bg | `#FCF1DE` | `oklch(0.962 0.028 81.5)` |
| danger | `#BE2930` | `oklch(0.526 0.185 24.3)` |
| danger-bg | `#FCEAEA` | `oklch(0.951 0.020 17.5)` |
| info | `#3047D1` | `oklch(0.476 0.212 268.9)` |
| info-bg | `#E8ECFA` | `oklch(0.944 0.019 273.2)` |
| progress | `#0366A0` | `oklch(0.492 0.121 244.3)` |
| progress-bg | `#E2F1FA` | `oklch(0.950 0.020 233.9)` |
| neutral | `#586174` | `oklch(0.492 0.032 265.2)` |
| neutral-bg | `#EDF0F4` | `oklch(0.954 0.006 255.5)` |
| chart-1 (indigo) | `#3047D1` | `oklch(0.476 0.212 268.9)` |
| chart-2 (teal) | `#0E9384` | `oklch(0.596 0.104 182.2)` |
| chart-3 (amber) | `#BF7A06` | `oklch(0.637 0.137 70.0)` |
| chart-4 (sky) | `#0B83C9` | `oklch(0.587 0.141 243.7)` |
| chart-5 (violet) | `#8A4FD6` | `oklch(0.563 0.199 300.2)` |
| chart-6 (slate) | `#7A8496` | `oklch(0.611 0.030 262.3)` |

### 3.3 Dark theme values

| Token | Hex | OKLCH |
|---|---|---|
| background | `#0A0E16` | `oklch(0.164 0.018 263.9)` |
| foreground | `#E5E9F1` | `oklch(0.933 0.012 264.5)` |
| card | `#10151F` | `oklch(0.196 0.022 263.9)` |
| card-foreground | `#E5E9F1` | `oklch(0.933 0.012 264.5)` |
| popover | `#141B27` | `oklch(0.221 0.026 261.0)` |
| popover-foreground | `#E5E9F1` | `oklch(0.933 0.012 264.5)` |
| primary | `#7083F2` | `oklch(0.648 0.166 273.6)` |
| primary-foreground | `#0A0E16` | `oklch(0.164 0.018 263.9)` |
| secondary | `#1B2232` | `oklch(0.253 0.032 265.9)` |
| secondary-foreground | `#E5E9F1` | `oklch(0.933 0.012 264.5)` |
| muted | `#181F2D` | `oklch(0.239 0.029 263.8)` |
| muted-foreground | `#98A2B5` | `oklch(0.710 0.030 263.4)` |
| accent | `#1D2645` | `oklch(0.277 0.059 270.0)` |
| accent-foreground | `#C7D0FB` | `oklch(0.865 0.060 275.8)` |
| destructive | `#E5484D` | `oklch(0.626 0.193 23.0)` |
| destructive-foreground | `#0A0E16` | `oklch(0.164 0.018 263.9)` |
| border | `#242C3C` | `oklch(0.293 0.031 263.9)` |
| input | `#5E6A7E` | `oklch(0.522 0.035 260.6)` |
| ring | `#7083F2` | `oklch(0.648 0.166 273.6)` |
| sidebar | `#0D121B` | `oklch(0.182 0.020 262.0)` |
| sidebar-foreground | `#C3CAD7` | `oklch(0.838 0.020 263.0)` |
| sidebar-accent | `#1A2240` | `oklch(0.261 0.057 270.7)` |
| sidebar-accent-foreground | `#C7D0FB` | `oklch(0.865 0.060 275.8)` |
| sidebar-border | `#1E2533` | `oklch(0.264 0.028 263.9)` |
| success | `#3CC8B4` | `oklch(0.754 0.121 181.3)` |
| success-bg | `#0D2A28` | `oklch(0.262 0.035 189.1)` |
| warning | `#F2B44E` | `oklch(0.809 0.137 76.9)` |
| warning-bg | `#2E2110` | `oklch(0.259 0.035 72.7)` |
| danger | `#F27779` | `oklch(0.712 0.152 20.7)` |
| danger-bg | `#33161A` | `oklch(0.244 0.047 12.4)` |
| info | `#8FA0F7` | `oklch(0.728 0.128 274.4)` |
| info-bg | `#1A2140` | `oklch(0.259 0.059 272.1)` |
| progress | `#5DB8EE` | `oklch(0.748 0.117 237.2)` |
| progress-bg | `#0F2536` | `oklch(0.256 0.043 243.9)` |
| neutral | `#A3ACBD` | `oklch(0.743 0.027 263.3)` |
| neutral-bg | `#1C2331` | `oklch(0.256 0.028 263.9)` |
| chart-1 | `#7083F2` | `oklch(0.648 0.166 273.6)` |
| chart-2 | `#2FB8A5` | `oklch(0.707 0.116 181.2)` |
| chart-3 | `#E9A63A` | `oklch(0.771 0.142 75.0)` |
| chart-4 | `#4FAFE8` | `oklch(0.720 0.122 237.9)` |
| chart-5 | `#A77CEB` | `oklch(0.675 0.163 299.9)` |
| chart-6 | `#8A93A6` | `oklch(0.662 0.030 265.3)` |

Dark theme rules: elevation is expressed by lighter surfaces (`background` < `card` < `popover`) and 1 px `border`, not by shadows. Primary buttons in dark mode use dark text on the lighter indigo (`primary-foreground` = `#0A0E16`).

### 3.4 Canonical CSS (`apps/web/src/app/globals.css`)

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --radius: 0.5rem; /* 8px controls */

  --background: oklch(0.976 0.003 264.5);
  --foreground: oklch(0.198 0.034 265.4);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.198 0.034 265.4);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.198 0.034 265.4);
  --primary: oklch(0.476 0.212 268.9);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.952 0.009 264.5);
  --secondary-foreground: oklch(0.261 0.036 263.6);
  --muted: oklch(0.957 0.006 255.5);
  --muted-foreground: oklch(0.492 0.032 265.2);
  --accent: oklch(0.944 0.019 273.2);
  --accent-foreground: oklch(0.377 0.178 268.8);
  --destructive: oklch(0.538 0.189 24.3);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.908 0.012 259.8);
  --input: oklch(0.643 0.030 265.3);
  --ring: oklch(0.476 0.212 268.9);

  --sidebar: oklch(0.960 0.006 255.5);
  --sidebar-foreground: oklch(0.321 0.035 263.9);
  --sidebar-primary: oklch(0.476 0.212 268.9);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.929 0.024 272.8);
  --sidebar-accent-foreground: oklch(0.384 0.170 269.1);
  --sidebar-border: oklch(0.908 0.012 259.8);
  --sidebar-ring: oklch(0.476 0.212 268.9);

  --success: oklch(0.521 0.091 182.8);
  --success-bg: oklch(0.954 0.018 184.3);
  --warning: oklch(0.543 0.123 61.8);
  --warning-bg: oklch(0.962 0.028 81.5);
  --danger: oklch(0.526 0.185 24.3);
  --danger-bg: oklch(0.951 0.020 17.5);
  --info: oklch(0.476 0.212 268.9);
  --info-bg: oklch(0.944 0.019 273.2);
  --progress: oklch(0.492 0.121 244.3);
  --progress-bg: oklch(0.950 0.020 233.9);
  --neutral: oklch(0.492 0.032 265.2);
  --neutral-bg: oklch(0.954 0.006 255.5);
  --money: var(--success);

  --chart-1: oklch(0.476 0.212 268.9);
  --chart-2: oklch(0.596 0.104 182.2);
  --chart-3: oklch(0.637 0.137 70.0);
  --chart-4: oklch(0.587 0.141 243.7);
  --chart-5: oklch(0.563 0.199 300.2);
  --chart-6: oklch(0.611 0.030 262.3);

  --shadow-panel: 0 1px 2px oklch(0.198 0.034 265.4 / 0.06);
  --shadow-overlay: 0 8px 24px oklch(0.198 0.034 265.4 / 0.12), 0 2px 6px oklch(0.198 0.034 265.4 / 0.08);
}

.dark {
  --background: oklch(0.164 0.018 263.9);
  --foreground: oklch(0.933 0.012 264.5);
  --card: oklch(0.196 0.022 263.9);
  --card-foreground: oklch(0.933 0.012 264.5);
  --popover: oklch(0.221 0.026 261.0);
  --popover-foreground: oklch(0.933 0.012 264.5);
  --primary: oklch(0.648 0.166 273.6);
  --primary-foreground: oklch(0.164 0.018 263.9);
  --secondary: oklch(0.253 0.032 265.9);
  --secondary-foreground: oklch(0.933 0.012 264.5);
  --muted: oklch(0.239 0.029 263.8);
  --muted-foreground: oklch(0.710 0.030 263.4);
  --accent: oklch(0.277 0.059 270.0);
  --accent-foreground: oklch(0.865 0.060 275.8);
  --destructive: oklch(0.626 0.193 23.0);
  --destructive-foreground: oklch(0.164 0.018 263.9);
  --border: oklch(0.293 0.031 263.9);
  --input: oklch(0.522 0.035 260.6);
  --ring: oklch(0.648 0.166 273.6);

  --sidebar: oklch(0.182 0.020 262.0);
  --sidebar-foreground: oklch(0.838 0.020 263.0);
  --sidebar-primary: oklch(0.648 0.166 273.6);
  --sidebar-primary-foreground: oklch(0.164 0.018 263.9);
  --sidebar-accent: oklch(0.261 0.057 270.7);
  --sidebar-accent-foreground: oklch(0.865 0.060 275.8);
  --sidebar-border: oklch(0.264 0.028 263.9);
  --sidebar-ring: oklch(0.648 0.166 273.6);

  --success: oklch(0.754 0.121 181.3);
  --success-bg: oklch(0.262 0.035 189.1);
  --warning: oklch(0.809 0.137 76.9);
  --warning-bg: oklch(0.259 0.035 72.7);
  --danger: oklch(0.712 0.152 20.7);
  --danger-bg: oklch(0.244 0.047 12.4);
  --info: oklch(0.728 0.128 274.4);
  --info-bg: oklch(0.259 0.059 272.1);
  --progress: oklch(0.748 0.117 237.2);
  --progress-bg: oklch(0.256 0.043 243.9);
  --neutral: oklch(0.743 0.027 263.3);
  --neutral-bg: oklch(0.256 0.028 263.9);
  --money: var(--success);

  --chart-1: oklch(0.648 0.166 273.6);
  --chart-2: oklch(0.707 0.116 181.2);
  --chart-3: oklch(0.771 0.142 75.0);
  --chart-4: oklch(0.720 0.122 237.9);
  --chart-5: oklch(0.675 0.163 299.9);
  --chart-6: oklch(0.662 0.030 265.3);

  --shadow-panel: none;
  --shadow-overlay: 0 8px 24px oklch(0 0 0 / 0.45);
}

@theme inline {
  --font-sans: var(--font-inter), var(--font-noto-khmer), ui-sans-serif, system-ui, sans-serif;
  --font-khmer: var(--font-noto-khmer), var(--font-inter), ui-sans-serif, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", "Cascadia Mono", "Menlo", "Consolas", monospace;

  --radius-xs: 4px;   /* badges, kbd */
  --radius-sm: 6px;   /* chips, small inline controls */
  --radius-md: 8px;   /* buttons, inputs, selects (shadcn default rounded-md) */
  --radius-lg: 12px;  /* dialogs, popovers, sheets */
  --radius-xl: 12px;  /* cards, panels (shadcn Card uses rounded-xl) */
  --radius-2xl: 16px; /* marketing feature tiles only */

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-success: var(--success);
  --color-success-bg: var(--success-bg);
  --color-warning: var(--warning);
  --color-warning-bg: var(--warning-bg);
  --color-danger: var(--danger);
  --color-danger-bg: var(--danger-bg);
  --color-info: var(--info);
  --color-info-bg: var(--info-bg);
  --color-progress: var(--progress);
  --color-progress-bg: var(--progress-bg);
  --color-neutral: var(--neutral);
  --color-neutral-bg: var(--neutral-bg);
  --color-money: var(--money);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-chart-6: var(--chart-6);
  --shadow-panel: var(--shadow-panel);
  --shadow-overlay: var(--shadow-overlay);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    @apply bg-background text-foreground font-sans antialiased;
    font-size: 0.875rem;      /* 14px app base */
    line-height: 1.5714;      /* 22px */
    font-feature-settings: "cv11", "ss01"; /* Inter: single-storey a off, open digits */
  }
  :focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  :where(:lang(km)), .text-content {
    font-family: var(--font-khmer);
    line-height: 1.8;
    letter-spacing: 0 !important;
    text-transform: none !important;
    overflow-wrap: anywhere;
  }
  .tabular { font-variant-numeric: tabular-nums; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
  }
}
```

Font variables are created in `apps/web/src/app/layout.tsx`:

```ts
import { Inter, Noto_Sans_Khmer } from "next/font/google"; // self-hosted at build time by next/font
export const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });
export const notoKhmer = Noto_Sans_Khmer({ subsets: ["khmer"], weight: ["400", "500", "600", "700"], variable: "--font-noto-khmer", display: "swap" });
// <html lang="en" className={`${inter.variable} ${notoKhmer.variable}`} suppressHydrationWarning>
```

## 4. Typography

### 4.1 Families

| Use | Family | Notes |
|---|---|---|
| UI and Latin text | Inter (variable, 400–700) | `font-sans` stack falls back to Noto Sans Khmer for Khmer code points automatically (Inter has no Khmer glyphs). |
| Khmer content | Noto Sans Khmer (400/500/600/700) | Applied via `:lang(km)` or `.text-content`; Inter remains in the stack for embedded Latin/digits. |
| IDs, hashes, payment references, JSON | System monospace (`font-mono`) | No third font is downloaded. |

### 4.2 Type scale (app)

| Token | Size / line-height (Latin) | Khmer line-height | Weight | Use |
|---|---|---|---|---|
| `text-display` | 36 / 44 px, tracking −0.02em | 64 px | 600 | Marketing hero only |
| `text-h1` | 24 / 32 px, tracking −0.01em | 44 px | 600 | Page title |
| `text-h2` | 18 / 28 px | 34 px | 600 | Section/panel title |
| `text-h3` | 15 / 22 px | 28 px | 600 | Card title, dialog title |
| `text-body` | 14 / 22 px | 26 px (1.86) | 400 | Default UI text, table cells |
| `text-body-lg` | 16 / 26 px | 30 px | 400 | Marketing body, editor transcription field (16 px minimum for editing Khmer) |
| `text-small` | 13 / 20 px | 24 px | 400/500 | Helper text, metadata, table secondary line |
| `text-caption` | 12 / 16 px | 22 px | 500 | Badges, overlines, axis labels; minimum size anywhere |
| `text-metric` | 28 / 32 px, tabular | n/a (numerals) | 600 | KPI figures |
| `text-mono` | 13 / 20 px | n/a | 400 | IDs, hashes, references |

Overlines (section labels above groups, e.g. "FINANCE" in the sidebar) use `text-caption`, uppercase, tracking +0.06em — **Latin UI chrome only**; never applied to content.

### 4.3 Numerals

All money, byte sizes, counts and dates in tables and KPI cards use `tabular-nums` (`.tabular`) and are right-aligned in table columns. Negative money uses the true minus sign `−` (U+2212).

### 4.4 Khmer text rules (mandatory)

1. **Line-height ≥ 1.8** for any element that can contain Khmer (`.text-content` on all user-generated content containers: dataset titles/descriptions, file names, messages, comments, transcriptions, notifications bodies, metadata values). Single-line elements (table cells, badges, inputs) get a height that fits a 1.8 line box: inputs 40 px tall when `lang="km"` or for content fields; table rows with content cells use 44 px minimum.
2. **Never letter-space Khmer.** `letter-spacing: 0 !important` in `.text-content` and `:lang(km)`; tracking utilities are only used on Latin chrome tokens.
3. **No word-splitting assumptions.** Khmer has no inter-word spaces. Do not split strings on spaces, do not truncate with `str.slice(n)` (breaks COENG clusters). Truncate visually with CSS (`line-clamp`, `text-overflow: ellipsis`) or, where programmatic truncation is unavoidable (email subject, notification preview), segment with `Intl.Segmenter("km", { granularity: "grapheme" })`.
4. **Line breaking** relies on the browser's ICU dictionary; `overflow-wrap: anywhere` is set as a safety net for long unbroken strings and only breaks between grapheme clusters.
5. **No case transforms** (`uppercase`, `capitalize`) on content.
6. **Vertical clipping**: never set `overflow: hidden` with a fixed height smaller than the line box on Khmer text; badges that can contain Khmer (labels, categories) use `py-0.5` and `line-height: 1.8`.
7. **Input**: Khmer IME composition is respected — keyboard shortcuts are ignored while `event.isComposing` is true; transcription fields set `spellcheck={false}`, `autocapitalize="off"`, `autocorrect="off"`, `lang="km"` when the task language is Khmer.
8. **Verbatim storage**: the editor never normalises, trims, or collapses whitespace in transcription text; zero-width spaces (U+200B) and COENG (U+17D2) sequences are preserved. A "Show invisible characters" toggle renders ZWSP as a thin dotted marker overlay without changing the value.
9. **Sorting/search**: use `Intl.Collator("km")` for client-side sorting of Khmer strings.

## 5. Spacing

4 px base unit (Tailwind default spacing scale, `--spacing: 0.25rem`).

| Token | px | Typical use |
|---|---|---|
| 1 | 4 | Icon–text gap in badges |
| 1.5 | 6 | Badge horizontal padding |
| 2 | 8 | Icon–text gap in buttons, compact cell padding |
| 3 | 12 | Table cell horizontal padding, form field vertical gap |
| 4 | 16 | Card padding (compact), gap between form rows |
| 5 | 20 | Card padding (default) |
| 6 | 24 | Gap between panels, page section gap |
| 8 | 32 | Page top padding, gap between page sections on desktop |
| 12 | 48 | Marketing section spacing (mobile) |
| 20 | 80 | Marketing section spacing (desktop) |

Density modes for tables: **Comfortable** (row 44 px, default for tables with content cells) and **Compact** (row 36 px, admin ledger/audit tables; user-toggleable, persisted in `localStorage`).

## 6. Grid and layout

- **App shell:** sidebar 248 px (expanded) / 56 px (icon rail) + fluid main column. Top bar 56 px. Main content max-width 1440 px, horizontal padding 24 px (≥ lg), 16 px (< lg).
- **Content grid:** 12 columns, 24 px gutter (≥ lg), 16 px gutter (< lg). KPI rows use 4 columns ≥ xl, 2 columns md–lg, 1 column < md.
- **Detail pages:** two-column `8 / 4` (main / aside) ≥ xl; aside stacks below < xl.
- **Forms:** single column, max-width 640 px; label above field.
- **Split workspaces** (review workspace, annotation editor, messaging): full-bleed, resizable panels (`react-resizable-panels` via shadcn Resizable), min widths documented in UI_UX_DESIGN §9.
- **Marketing:** 12-column grid, max-width 1200 px, 24 px gutters.

## 7. Breakpoints

Tailwind defaults (min-width):

| Name | px | Behaviour |
|---|---|---|
| (base) | 0–639 | Phone: sidebar becomes a sheet; tables render as cards; single-column forms; sticky bottom action bar. |
| `sm` | 640 | Large phone: two-column KPI grid. |
| `md` | 768 | Tablet portrait: tables as tables with priority columns; sidebar is a sheet. |
| `lg` | 1024 | Tablet landscape/small laptop: sidebar icon rail (expand on hover/pin); review workspace usable (2 panels). |
| `xl` | 1280 | Laptop: full sidebar; annotation editor three-panel minimum. |
| `2xl` | 1536 | Desktop: wider preview panels; main content caps at 1440 px. |

## 8. Components

All components are shadcn/ui primitives (Radix) styled with the tokens above, plus DataHub composites in `apps/web/src/components/` (named in `PascalCase` below).

### 8.1 Buttons (`Button`)

| Variant | Style | Use |
|---|---|---|
| `default` (primary) | `bg-primary text-primary-foreground`, hover: 8 % darker (light) / 8 % lighter (dark) via `color-mix` | One per view region: the main action ("Submit for review", "Approve payout") |
| `secondary` | `bg-secondary text-secondary-foreground` | Secondary actions ("Save draft", "Export CSV") |
| `outline` | 1 px `input` border, `bg-card` | Toolbar actions, filters |
| `ghost` | transparent, hover `accent` | Icon buttons, table row actions |
| `destructive` | `bg-destructive text-destructive-foreground` | Irreversible or harmful actions (reject payout, take down, revoke sessions) — always behind a confirmation |
| `money` | `bg-success text-white` (light) / `bg-success text-[#0A0E16]` (dark) | Exclusively for "Mark as paid" and "Request withdrawal" confirmations |
| `link` | `text-primary underline-offset-4 hover:underline` | Inline navigation |

Sizes: `sm` 32 px (h-8, px-3, text-small), `default` 36 px (h-9, px-4), `lg` 40 px (h-10, px-5), `icon` 36 × 36 (icon 16 px). On touch (`pointer: coarse`) all buttons get min 44 × 44 hit area via padding/`::after` expansion. Radius `rounded-md` (8 px). Loading state: spinner replaces leading icon, label kept, `aria-busy="true"`, button disabled to prevent double submit. Disabled: 50 % opacity plus `cursor-not-allowed`, and a tooltip explaining why when the reason is not obvious (e.g., "Verification required before withdrawing").

### 8.2 Forms

- **Field anatomy:** `Label` (text-small 500) → control → helper text (text-small muted) or error (text-small `danger`, icon `CircleAlert`, linked by `aria-describedby`). Required marker: "(required)" text in muted, not an asterisk alone.
- **Controls:** Input/Select/Textarea height 36 px (40 px for content fields that may hold Khmer), 1 px `input` border, `rounded-md`, `bg-card`; focus: 2 px `ring` outline offset 2 px; invalid: `danger` border + `aria-invalid`.
- **Validation:** React Hook Form + Zod; validate on blur, re-validate on change after first error; on submit, focus the first invalid field and show an error summary at top of form for forms > 6 fields. Server errors map `error.details[].field` to fields; unmapped errors show in an inline `Alert`.
- **Money input (`MoneyInput`):** prefix "$", inputmode `decimal`, accepts digits and one dot with ≤ 2 decimals, shows available balance and min/max under the field; parsing per §12.2.
- **File drop (`FileDropzone`):** dashed 1.5 px `input` border, 12 px radius, 160 px min height; keyboard-accessible "Choose files" and "Choose folder" buttons inside; drag-over state uses `accent` background and `primary` border.
- **Selectors:** `Combobox` (Command + Popover) for users/datasets/projects; multi-select chips for labels; `DateRangePicker` for filters.
- **Checkbox/radio/switch:** 16 px controls with 24 px min target; switch only for immediately-applied settings.
- **Type-to-confirm (`ConfirmTypedDialog`):** see §8.7.

### 8.3 Tables (`DataTable`)

- TanStack Table on top of shadcn `Table`. Container: `Card` with 12 px radius, header row `bg-muted`, `text-caption` uppercase muted labels (Latin chrome), sticky header within scroll container.
- Row height 44 px (comfortable) / 36 px (compact). Hover `accent/50`; selected `accent` + 2 px left `primary` inset bar.
- Numeric columns right-aligned, tabular. Status column uses `StatusBadge`. Date column shows relative time ("3 h ago") with absolute UTC-local tooltip and `<time datetime>`.
- Toolbar: search input (debounced 300 ms, mirrors `?q=`), filter chips (each filter maps to an explicit API query param), column visibility menu, density toggle, export CSV (where API supports). All filter/sort/page state lives in the URL (`?page=&page_size=&sort=&status=`).
- Pagination: server-side per baseline §12 (`page`, `page_size` 25 default, options 25/50/100), footer shows "1–25 of 1,240".
- Bulk selection: checkbox column; bulk action bar slides in above table ("3 selected · Accept · Reject · Clear").
- Row actions: trailing `ghost` icon button (`Ellipsis`) opening a `DropdownMenu`; whole row is a link when a detail page exists (anchor wraps primary cell; row click delegated, middle-click opens tab).
- **Responsive:** below `md`, `DataTable` renders `ResponsiveCardList`: each row becomes a card with the primary cell as title, status badge top-right, 2–4 "priority" fields as label/value pairs, and the row action menu. Each column definition declares `priority: 1|2|3` and `mobileLabel`.
- Empty, loading and error states per UI_UX_DESIGN §11.

### 8.4 Cards

- `Card`: `bg-card`, 1 px `border`, `rounded-xl` (12 px), `shadow-panel`, padding 20 px (16 px < md). Header: `text-h3` title + optional description + trailing actions.
- `KpiCard`: overline label, `text-metric` value, delta or sub-label (e.g., "Available to withdraw"), optional sparkline (40 px tall). Money KPIs render the value in `text-money` only when the figure is credited money (Available, Paid, Approved); Pending/Reserved use `text-foreground` with an amber/neutral dot.
- `StatCardGroup`: 4-up grid of KpiCards with shared border (single container, 1 px internal dividers) for financial summaries.
- `EntityHeader`: page-level header for details pages (title with `.text-content`, status badge, ID in mono with copy button, primary/secondary actions, metadata row).

### 8.5 Modals (`Dialog`, `AlertDialog`)

- Width: `sm` 400 px (confirmations), `md` 560 px (forms), `lg` 720 px (previews). `rounded-lg` (12 px), `shadow-overlay`, overlay `oklch(0 0 0 / 0.5)`.
- Focus moves to the first interactive element (or the least destructive button in `AlertDialog`); `Esc` closes unless a request is in flight; focus returns to the trigger.
- Title states the action and object ("Reject payout PO-7F3A2B for $125.00?"). Body lists consequences. Footer buttons: Cancel (left, `outline`) and the action (right, matching variant).
- Mobile (< md): dialogs become bottom sheets (`Drawer` from vaul) with the same content.

### 8.6 Drawers / sheets (`Sheet`)

- Right-side sheet 480 px (`md`) or 640 px (`lg`) for record detail without leaving a list (verification case, export job detail, ledger journal detail, user quick view). Left sheet 280 px for mobile navigation.
- Sheets have a header (title + close), scrollable body and sticky footer for actions. Opening a sheet updates the URL (`?verification=<id>`) so it is linkable and survives reload.

### 8.7 Confirmation patterns

| Level | Component | Used for |
|---|---|---|
| L1 inline undo | Toast with "Undo" (5 s) | Non-destructive reversible UI changes (mark notification read, archive filter) |
| L2 confirm | `AlertDialog` | Withdraw dataset, delete draft file, cancel withdrawal request, release review claim, unassign task, close conversation, revoke a session |
| L3 confirm with reason | `AlertDialog` + required textarea (min 10 chars) | Reject verification, reject payout, request changes, reject dataset, suspend user, mark payout failed, cancel approved payout |
| L4 type-to-confirm | `ConfirmTypedDialog` | **Mark payout as paid** (type the exact amount, e.g. `125.00`), **reverse payout** (type amount), **create adjustment** (type amount), **finalize dataset review** (type the payable amount shown in summary when > $0.00), **take down dataset** (type the dataset short ID, e.g. `DS-3F9A1C`), **publish new pricing rule** (type the new rate), **change roles to grant admin/super_admin** (type the user's email), **disable MFA**, **request account deletion** (type `DELETE`) |

`ConfirmTypedDialog` shows the expected value in a mono chip, an input with `autocomplete="off"`, and enables the action button only on exact match (trimmed, for amounts also accepts a leading `$`). Paste is allowed (accessibility) but a summary of what will happen is always displayed above the input.

### 8.8 Navigation components

- `AppSidebar`: workspace switcher (top), grouped nav (overline group labels), footer with help link and collapse toggle. Active item: `sidebar-accent` background, `sidebar-accent-foreground` text, 2 px left indicator in `sidebar-primary`. Count badges (e.g., pending payouts) right-aligned, `neutral` tone, `warning` tone when items exceed SLA.
- `WorkspaceSwitcher`: dropdown listing only the workspaces the user's roles allow (Contribute, Annotate, Review, Admin), each with icon and description, keyboard shortcut `G` then `1–4` (sequence shortcut, disabled while typing).
- `TopBar`: breadcrumbs (left), `CommandMenu` trigger ("Search… Ctrl K"), notifications bell with unread count, messages icon with unread dot, theme toggle, `UserMenu`.
- `PageHeader`: title, description, actions; tabs (`Tabs` underline style) when the page has sub-views; tab state in the URL.
- `Breadcrumbs`: last crumb is the current page (not a link, `aria-current="page"`).

### 8.9 Feedback components

- `Toast` (sonner): bottom-right (desktop), top (mobile); 4 s default, 8 s for errors, persistent for actions with "Undo"/"Retry". Tone icon + title + optional description; never the only channel for critical errors (inline error also shown).
- `Alert` (inline banner): tones info/success/warning/danger; used for page-level state (verification required, maintenance window, account suspended).
- `Progress`: linear 4 px (inline) / 8 px (upload rows) using `progress` colour; indeterminate shimmer for "processing".
- `Skeleton`: `bg-muted` animated pulse (disabled with reduced motion) matching final layout dimensions.
- `NotificationItem`: icon by event type, title, `.text-content` body (2-line clamp), relative time, unread dot (`primary`), link to the entity.
- `SaveIndicator` (editor): "Saved · 10:42", "Saving…", "Unsaved changes", "Offline — changes kept locally", "Conflict — review needed" with tone and icon.

### 8.10 Icons

lucide-react, stroke width 1.75, 16 px in controls/tables, 20 px in sidebar, 24 px in empty states (inside a 48 px `muted` circle). Icons accompanying text are `aria-hidden`; icon-only buttons have `aria-label` and a tooltip.

| Concept | Icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| Datasets | `Database` |
| Upload | `UploadCloud` |
| File / document | `FileText` (PDF/DOCX/TXT), `FileImage` (images/TIFF), `FileSpreadsheet` (CSV/XLSX), `FileJson` (JSON/JSONL/XML), `FileArchive` (ZIP) |
| Earnings | `Wallet` |
| Withdrawals / payouts | `Banknote` |
| Ledger | `BookOpenText` |
| Pricing | `Tags` |
| Annotation | `PenLine` |
| Review | `ClipboardCheck` |
| Users | `Users` |
| Verification | `BadgeCheck` |
| Messages | `MessagesSquare` |
| Notifications | `Bell` |
| Exports | `PackageOpen` |
| Analytics | `ChartColumn` |
| Audit | `ScrollText` |
| Settings | `Settings` |
| Security / MFA | `ShieldCheck` |
| Duplicate | `Copy` |
| Malware / quarantine | `ShieldAlert` |

### 8.11 Charts (Recharts)

- Series colours in order `chart-1 … chart-6`; money series always `chart-2` (teal); pending series `chart-3` (amber); rejected series `danger`.
- Grid lines `border`, axes `muted-foreground` `text-caption`, tooltip uses `popover` surface with tabular values formatted via §12/§13.
- Types: area/line for time series (uploads per day, payouts per week), stacked bar for status distributions (datasets by status), horizontal bar for top-N (languages, categories). No pie charts with > 4 slices; donuts only for a 2–4 part composition (accepted vs rejected bytes).
- Every chart has a visible title, a text summary (`aria-describedby`), and a "View as table" toggle rendering the same data in a `DataTable` (WCAG 1.1.1 / 1.4.1).
- Empty chart: muted axis frame with centered "No data for this period".

### 8.12 Other composites

- `StatusBadge` (§9), `ShortRef` (display reference = entity prefix + last 6 hex digits of the UUID, uppercase: `DS-3F9A1C` dataset, `FL-` file, `RV-` review, `PO-7F3A2B` payout, `TK-` annotation task, `PR-` annotation project, `EX-` export, `CV-` conversation, `US-` user; full UUID available via copy), `MoneyAmount` (§12), `ByteSize` (§13), `RelativeTime`, `CopyableId` (mono, truncated middle "0192…3F9A1C", copy button with toast "ID copied"), `UserChip` (avatar initials + name + email tooltip), `DatasetChip`, `EmptyState`, `ErrorState`, `FilePreview` (page image viewer with zoom/pan/rotate), `UploadQueue`, `UploadTray` (global floating upload progress), `KeyboardShortcutsDialog`, `CommandMenu`.

## 9. Status badges

`StatusBadge` = 20 px tall pill-rectangle (`rounded-xs` 4 px), `text-caption` 500, `px-1.5`, leading 6 px dot or 12 px icon in the tone colour, background `{tone}-bg`, text `{tone}`. Variant **outline** (transparent bg, 1 px `border`, `neutral` text) is used for inactive terminal states. Labels are sentence case. The badge always includes text; icon/dot is decorative.

Tones: **neutral** (slate), **info** (indigo), **progress** (sky), **warning** (amber), **success** (teal), **danger** (red).

### 9.1 `users.status`

| Value | Label | Tone | Icon |
|---|---|---|---|
| `pending_email` | Email unverified | warning | `MailWarning` |
| `active` | Active | success | dot |
| `suspended` | Suspended | danger | `Ban` |
| `deactivated` | Deactivated | neutral (outline) | `UserX` |
| `anonymized` | Anonymized | neutral (outline) | `EyeOff` |

### 9.2 Contributor verification (`contributor_verifications.status` / `users.verification_status`)

| Value | Label | Tone | Icon |
|---|---|---|---|
| `unverified` | Not verified | neutral | `ShieldQuestion` |
| `pending` | Verification pending | warning | `Hourglass` |
| `approved` | Verified | success | `BadgeCheck` |
| `rejected` | Verification rejected | danger | `ShieldX` |
| `needs_info` | More info needed | warning | `MessageSquareWarning` |

### 9.3 `upload_sessions.status`

| Value | Label | Tone | Icon |
|---|---|---|---|
| `initiated` | Starting | neutral | dot |
| `uploading` | Uploading | progress | `ArrowUpFromLine` |
| `completed` | Uploaded | success | `Check` |
| `aborted` | Cancelled | neutral (outline) | `X` |
| `expired` | Expired | neutral (outline) | `TimerOff` |

Client-only upload states shown in `UploadQueue` (not persisted server-side): `queued` → "Queued" neutral; `paused` → "Paused" warning (`Pause`); `needs_file` → "Re-select file to resume" warning (`FileSearch`); `error` → "Upload error — retry" danger (`RotateCcw`).

### 9.4 `dataset_files.processing_status`

| Value | Label | Tone | Icon |
|---|---|---|---|
| `pending_upload` | Waiting for upload | neutral | dot |
| `uploaded` | Queued for processing | neutral | `Clock` |
| `processing` | Processing | progress | spinner (static icon `Loader` under reduced motion) |
| `ready` | Ready | success | `Check` |
| `failed` | Failed | danger | `CircleX` (tooltip shows reason, e.g. `type_mismatch`, `disallowed_type`, `nested_archive`) |
| `quarantined` | Quarantined | danger | `ShieldAlert` |

### 9.5 `dataset_files.scan_status`

| Value | Label | Tone | Icon |
|---|---|---|---|
| `pending` | Scan pending | neutral | `Clock` |
| `clean` | Clean | success | `ShieldCheck` |
| `infected` | Infected | danger | `ShieldAlert` |
| `error` | Scan error | warning | `ShieldQuestion` |
| `skipped_container` | Archive container | neutral (outline) | `FileArchive` |

### 9.6 `datasets.status`

| Value | Label | Tone | Icon |
|---|---|---|---|
| `draft` | Draft | neutral | `PencilLine` |
| `submitted` | Submitted | info | `Send` |
| `in_review` | In review | progress | `ClipboardCheck` |
| `approved` | Approved | success | `CircleCheck` |
| `partially_approved` | Partially approved | success | `CircleDashed` |
| `rejected` | Rejected | danger | `CircleX` |
| `changes_requested` | Changes requested | warning | `MessageSquareWarning` |
| `withdrawn` | Withdrawn | neutral (outline) | `Undo2` |
| `taken_down` | Taken down | danger (outline: danger border + danger text, no fill) | `Ban` |

### 9.7 `dataset_reviews.status` and decisions

| Value | Label | Tone |
|---|---|---|
| `in_progress` | Review in progress | progress |
| `finalized` + decision `approve` | Finalized · Approved | success |
| `finalized` + decision `partial` | Finalized · Partially approved | success |
| `finalized` + decision `reject` | Finalized · Rejected | danger |
| `finalized` + decision `request_changes` | Finalized · Changes requested | warning |
| `released` | Released | neutral (outline) |

File-level review decision (`dataset_file_reviews.decision`): `accepted` → "Accepted" success (`Check`); `rejected` → "Rejected" danger (`X`); no row yet → "Undecided" neutral (UI-only).

### 9.8 `annotation_tasks.status`

| Value | Label | Tone | Icon |
|---|---|---|---|
| `unassigned` | Unassigned | neutral | dot |
| `assigned` | Assigned | info | `UserCheck` |
| `in_progress` | In progress | progress | `PenLine` |
| `submitted` | Submitted | info | `Send` |
| `in_review` | In review | progress | `ClipboardCheck` |
| `approved` | Approved | success | `CircleCheck` |
| `changes_requested` | Changes requested | warning | `MessageSquareWarning` |
| `cancelled` | Cancelled | neutral (outline) | `X` |

Annotation project state (derived from whether the project has been closed via `POST /annotation/projects/{id}/close`): "Active" info / "Closed" neutral (outline).

### 9.9 `payout_requests.status`

| Value | Label | Tone | Icon |
|---|---|---|---|
| `requested` (approvals_count = 0) | Requested | warning | `Hourglass` |
| `requested` (approvals_count = 1, dual approval required) | 1 of 2 approvals | warning | `UsersRound` |
| `approved` | Approved · awaiting payment | info | `CircleCheck` |
| `paid` | Paid | success | `Banknote` |
| `rejected` | Rejected | danger | `CircleX` |
| `cancelled` | Cancelled | neutral (outline) | `X` |
| `failed` | Payment failed | danger | `TriangleAlert` |
| `reversed` | Reversed | danger (outline) | `Undo2` |

### 9.10 `export_jobs.status`

| Value | Label | Tone | Icon |
|---|---|---|---|
| `queued` | Queued | neutral | `Clock` |
| `running` | Building | progress | spinner |
| `completed` | Ready to download | success | `Download` |
| `failed` | Failed | danger | `CircleX` |
| `expired` | Expired | neutral (outline) | `TimerOff` |

### 9.11 `conversations.status`

| Value | Label (admin view) | Label (contributor view) | Tone |
|---|---|---|---|
| `open` | Open | Waiting for support | info |
| `awaiting_user` | Awaiting user | Reply needed | warning |
| `closed` | Closed | Closed | neutral (outline) |

### 9.12 Other enumerations shown as badges/chips

| Enumeration | Value → label (tone) |
|---|---|
| `data_class` | `raw` → Raw (neutral), `labeled` → Labeled (info) |
| `dataset_duplicates.kind` | `exact` → Exact duplicate (danger, `Copy`), `near` → Possible duplicate (warning, `Copy`) |
| Roles | `contributor` Contributor, `annotator` Annotator, `reviewer` Reviewer, `admin` Admin, `super_admin` Super admin — all neutral outline chips; `super_admin` chip uses `ShieldCheck` icon |
| Payout method | `bank_transfer` Bank transfer, `aba_pay` ABA Pay, `wise` Wise, `paypal` PayPal, `other` Other — neutral outline |
| Ledger journal kind (transactions list) | `dataset_earning` Dataset earning (success, +), `annotation_reward` Annotation reward (success, +), `earning_release` Pending released (neutral), `payout_reserve` Reserved for withdrawal (warning), `payout_release` Reservation released (neutral), `payout_settle` Paid out (success), `adjustment_credit` Adjustment credit (info, +), `adjustment_debit` Adjustment debit (danger, −), `payout_reversal` Payment reversed (danger) |
| Annotation review decision | `approve` Approved (success), `request_changes` Changes requested (warning) |
| Security event severity | info (info), warning (warning), critical (danger) |

## 10. Notifications (visual)

- **In-app list item** (§8.9) grouped by day ("Today", "Yesterday", date). Event → icon/tone: email verified (`MailCheck`, success); contributor approved (`BadgeCheck`, success); dataset received (`Inbox`, info); processing finished (`Cog`, info; danger if any file failed); dataset approved (`CircleCheck`, success); dataset rejected (`CircleX`, danger); changes requested (`MessageSquareWarning`, warning); earnings credited (`Wallet`, success); withdrawal requested (`Banknote`, info); withdrawal approved (`CircleCheck`, info); payment recorded (`Banknote`, success); annotation assigned (`PenLine`, info); annotation returned (`MessageSquareWarning`, warning); annotation approved (`CircleCheck`, success); new support message (`MessagesSquare`, info).
- **Real-time toast** on `notification.created` WebSocket event when the user is not already on the relevant page; max 3 stacked; "View" action.
- **Bell badge** shows unread count up to 99 ("99+").
- **Email**: 600 px single column, white card on `#F6F7F9`, mark + wordmark header, Inter → Arial fallback (Noto Sans Khmer → system Khmer fallback), single `primary` CTA button (`#3047D1`, white text, 8 px radius), footer with operator line and preference link.

## 11. Light and dark themes

- `next-themes` with `attribute="class"`, default `system`, options Light / Dark / System in the top bar and in Settings → Appearance. Persisted in `localStorage` (`dh-theme`).
- No flash: `suppressHydrationWarning` on `<html>` and the next-themes inline script.
- Document page images in the review workspace and editor are displayed on a neutral `#FFFFFF` page surface in both themes (documents are not inverted); the surrounding canvas is `muted`. An optional "Dim pages" toggle in dark mode applies `filter: brightness(0.85)`.
- Charts read CSS variables at render, so they switch with theme without reload.
- Email templates are light-only.

## 12. Money formatting

Source of truth: integer micro-USD (`*_micros`) from the API, delivered as JSON integers (the client accepts either a JSON number or an integer string, so the API contract can switch to string serialisation without UI changes, and always converts with `BigInt(value)` before arithmetic).

### 12.1 Display (`formatMoney(micros, opts)`)

1. `m = BigInt(micros)`; sign = `m < 0n`; `a = |m|`.
2. `cents = a / 10_000n` (BigInt division truncates = **round down** toward zero on the absolute value; never overstates).
3. Render `$` + thousands-separated dollars + `.` + 2-digit cents, using `en-US` grouping. Negative → prefix `−` (U+2212): `−$12.50`.
4. If `a > 0n` and `cents == 0n` → render `< $0.01` (tooltip shows exact micros).
5. `opts.exact = true` (finance admin views, ledger, tooltips) → render 6-decimal micros in mono as secondary text: `$1.234567`.
6. `opts.compact = true` (chart axes only) → `$1.2k`, `$3.4M` (rounded down).
7. Estimates are prefixed `≈` and labelled "Estimate" (baseline §8.6).

| Input micros | Output |
|---|---|
| `0` | `$0.00` |
| `1` | `< $0.01` |
| `9_999` | `< $0.01` |
| `10_000` | `$0.01` |
| `1_234_567` | `$1.23` |
| `1_999_999` | `$1.99` |
| `125_000_000` | `$125.00` |
| `5_000_000_000` | `$5,000.00` |
| `-12_505_000` | `−$12.50` |

### 12.2 Input (`parseMoneyInput(text)`)

Accepts `^\$?\s*\d{1,7}(\.\d{1,2})?$` after removing grouping commas; converts by string manipulation to cents then `× 10_000n` micros (no `parseFloat`). Rejects > 2 decimals with message "Enter an amount in dollars and cents, e.g. 25.00". Withdrawal requests additionally validate min/max/available (baseline A-06, §8.7) client-side and display the server's error if the server disagrees.

### 12.3 Rates

Pricing rates (`rate_micros_per_gb`) render as "$1.00 / GB" (raw) and "$1.50 / GB" (labeled) — same floor rule. Annotation rewards render "$0.40 / task", "$0.05 / page".

### 12.4 Placement

Money is right-aligned and tabular in tables; credited amounts use `text-money`; debits/negatives use `text-foreground` with `−` sign (red is reserved for failure states, not for normal debits such as withdrawals).

## 13. Byte formatting

Decimal SI units (baseline §8.1: 1 GB = 1,000,000,000 bytes). Labels: B, KB, MB, GB, TB (never KiB/MiB).

### 13.1 `formatBytes(bytes)` — general display

| Range | Format | Example |
|---|---|---|
| < 1,000 | integer B | `512 B` |
| < 10 units | 2 decimals | `4.27 MB` |
| < 100 units | 1 decimal | `48.3 GB` |
| ≥ 100 units | 0 decimals | `734 MB` |

Rounding: **down** (truncate) so sizes are never overstated; computed with BigInt then formatted.

### 13.2 `formatGB(bytes)` — financial contexts

Used wherever bytes feed an earning (review summary, dataset estimate, earnings breakdown): always GB with 3 decimals, rounded down, plus exact bytes on hover/secondary line: `1.234 GB` / `1,234,567,890 bytes`. Example: accepted `2,500,000,001` bytes at raw → `2.500 GB × $1.00 / GB = $2.50`.

## 14. Motion

Durations: 120 ms (hover/press), 180 ms (popover/menus), 240 ms (sheets/dialogs). Easing `cubic-bezier(0.2, 0, 0, 1)`. No parallax, no auto-playing animation in workspaces. All motion disabled under `prefers-reduced-motion`.

## 15. Accessibility contrast (computed, WCAG 2.x relative luminance)

Light theme:

| Pair | Ratio | Requirement |
|---|---|---|
| foreground on background | 17.00 : 1 | ≥ 4.5 ✓ |
| muted-foreground on background | 5.80 : 1 | ≥ 4.5 ✓ |
| muted-foreground on card | 6.22 : 1 | ≥ 4.5 ✓ |
| muted-foreground on muted (table header) | 5.49 : 1 | ≥ 4.5 ✓ |
| primary-foreground on primary | 7.12 : 1 | ≥ 4.5 ✓ |
| primary (link) on card | 7.12 : 1 | ≥ 4.5 ✓ |
| destructive-foreground on destructive | 5.62 : 1 | ≥ 4.5 ✓ |
| accent-foreground on accent | 9.09 : 1 | ≥ 4.5 ✓ |
| sidebar-foreground on sidebar | 11.28 : 1 | ≥ 4.5 ✓ |
| sidebar-accent-foreground on sidebar-accent | 8.42 : 1 | ≥ 4.5 ✓ |
| input border on card | 3.33 : 1 | ≥ 3 (non-text) ✓ |
| ring on background | 6.65 : 1 | ≥ 3 (focus) ✓ |
| success on success-bg / card | 4.59 / 5.22 : 1 | ≥ 4.5 ✓ |
| warning on warning-bg / card | 4.64 / 5.19 : 1 | ≥ 4.5 ✓ |
| danger on danger-bg / card | 5.10 / 5.92 : 1 | ≥ 4.5 ✓ |
| info on info-bg / card | 6.04 / 7.12 : 1 | ≥ 4.5 ✓ |
| progress on progress-bg / card | 5.33 / 6.15 : 1 | ≥ 4.5 ✓ |
| neutral on neutral-bg / card | 5.44 / 6.22 : 1 | ≥ 4.5 ✓ |
| chart-1…6 on card | 7.12, 3.80, 3.50, 4.11, 5.04, 3.77 | ≥ 3 (graphics) ✓ |

Dark theme:

| Pair | Ratio | Requirement |
|---|---|---|
| foreground on background | 15.87 : 1 | ✓ |
| muted-foreground on background / card / muted | 7.51 / 7.11 / 6.42 : 1 | ✓ |
| primary-foreground on primary | 5.72 : 1 | ✓ |
| primary (link) on card | 5.41 : 1 | ✓ |
| destructive-foreground on destructive | 4.93 : 1 | ✓ |
| accent-foreground on accent | 9.78 : 1 | ✓ |
| sidebar-foreground on sidebar | 11.39 : 1 | ✓ |
| sidebar-accent-foreground on sidebar-accent | 10.28 : 1 | ✓ |
| input border on card | 3.34 : 1 | ≥ 3 ✓ |
| ring on background | 5.72 : 1 | ≥ 3 ✓ |
| success / warning / danger / info / progress / neutral on own bg | 7.33 / 8.51 / 6.05 / 6.39 / 7.14 / 6.89 : 1 | ✓ |
| chart-1…6 on card | 5.41, 7.41, 8.69, 7.51, 5.85, 5.92 | ✓ |

`border` (decorative dividers, 1.55 : 1 light) is intentionally below 3 : 1; it is never the sole indicator of a control's boundary — controls use `input`.

Other rules: focus indicator 2 px solid `ring` with 2 px offset, never removed (WCAG 2.4.7, 2.4.11 focus not obscured — sticky headers/footers add `scroll-padding`); minimum target 24 × 24 px (2.5.8), 44 × 44 on touch; text resizes to 200 % without loss; content reflows at 320 px width except the annotation editor and review workspace canvas (2-D content exemption, with read-only notice — UI_UX_DESIGN §9).
