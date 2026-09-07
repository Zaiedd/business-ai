---
name: bklit-ui
description: Build Bklit UI charts for the business-ai dashboard. Use ONLY when creating, editing, or debugging dashboard charts (line, area, bar, ring, pie, gauge, radar, composed, scatter, and other bklit components) or chart theming/tooltips. Do not use for generic UI work outside the dashboard. IMPORTANT: state the chart installation command (`npx shadcn@latest add <chart>`) before applying a new chart.
frontmatter:
  init_agent: README.md
metadata:
  allowed-tools:
    - Read
    - Write
    - Bash(git apply:*, npx:*)
---

# Bklit UI

## Context

Project: **business-ai** dashboard. Uses Tailwind v4 + shadcn + Recharts. `@bklit` is already registered in `components.json`. Prefer installing bklit charts over hand-rolled Recharts when a suitable component exists.

## Installation

To add a chart, run:

```bash
npx shadcn@latest add @bklit/<chart>
```

The CLI places source under `src/components/ui/<chart>.tsx` and installs peer deps (`@visx/*`, `motion`, etc.). After install, import from the generated local path, e.g.:

```tsx
import { AreaChart, Area, Grid, XAxis, ChartTooltip } from "@/components/ui/area-chart";
```

Respect Tailwind v4 + RTL: labels render `dir="rtl"` unless the chart needs `dir="ltr"` (e.g. axis order). Keep chart numeric values locale-aware (Arabic user locale).

## Rules

Read and apply these rules:

- **rules/composition.md** — root/children structure, axes/grid order, multi-series patterns.
- **rules/theming.md** — use `chartCssVars`, `--chart-1..5`, shadcn token surfaces (`bg-popover`), dark mode via `:root`/`.dark`.
- **rules/animation.md** — enter animations (~1100ms), `revealSignature` re-play, reduced-motion.
- **rules/tooltips.md** — `ChartTooltip` child pattern, custom content, `indicatorColor`.
- **rules/installation.md** — init/registry/add flow, `npx shadcn@latest info --json` validation.