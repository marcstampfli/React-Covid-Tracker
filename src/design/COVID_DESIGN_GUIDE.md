# COVID Command Center Design Guide

## Purpose
- Establish a high-contrast, data-first interface for rapid outbreak monitoring.
- Keep all metric surfaces visually consistent while preserving metric color semantics.

## Typography
- Headings: `Syne` (`--font-heading`) for identity and section hierarchy.
- Body and numeric data: `Space Grotesk` (`--font-body`, `--font-data`) for compact readability.

## Core Colors
- App background: `--color-bg` and `--gradient-app`.
- Panel surfaces: `--color-surface`, `--color-surface-raised`.
- Borders: `--color-border`, `--color-border-soft`.
- Text levels: `--color-text`, `--color-text-muted`, `--color-text-dim`.

## Metric Semantics
- Cases: `--color-cases` (red)
- Recovered: `--color-recovered` (green)
- Deaths: `--color-deaths` (charcoal steel)
- Vaccinations: `--color-vaccinations` (blue)

## Spacing and Shape
- Use `--space-*` tokens for all component padding and gaps.
- Use `--radius-sm`, `--radius-md`, `--radius-lg` for coherent corner radii.

## Component Rules
- Panels are dark, elevated, and bordered; avoid flat cards.
- Active metric states must have color-led border/glow treatment.
- Inputs and selectors keep dark surfaces with visible focus rings.
- Charts and map overlays use muted grid/border tones to prioritize data lines and markers.

## Layout Rules
- Sticky top command bar for controls and context.
- Full-width map hero sits above analytical panels.
- Secondary analysis uses a two-column command grid on desktop and collapses to one column on mobile.
