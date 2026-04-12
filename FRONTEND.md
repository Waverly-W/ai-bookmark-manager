# Frontend UI Specification

## Goal

The default theme follows `DESIGN.md` and adopts a Cohere-like enterprise interface:

- bright white canvas
- cool gray borders
- restrained black/white surfaces
- 22px primary card roundness
- serif display + sans UI typography
- blue reserved for interaction states

The `blueprint` theme keeps its blueprint-grid identity, mono typography, and sharp radii, but it should still use the same component semantics and layout rules documented here.

## Design Tokens

All shared visual tokens live in `assets/main.css`.

- `--font-display`: declaration headlines only
- `--font-sans`: body, controls, tables, settings copy
- `--font-mono`: code, technical tags, Blueprint headings
- `--card-radius`: primary card/container radius, default `1.375rem` (22px)
- `--button-radius`: pill actions
- `--input-radius`: compact utility radius for form controls
- `--primary`: interaction blue only
- `--border`: cool gray structural borders
- `--surface-*`: layered neutrals for containment
- `--shadow-*`: low-contrast elevation only

Do not introduce page-local hard-coded color systems unless the component is intentionally brand-specific.

## Typography

- Use `font-display` for page titles, section headers, dialog titles, and stat numbers with editorial emphasis.
- Use `font-sans` for body text, labels, helper text, and form controls.
- Use `font-mono` for code-like labels, dense metadata, and Blueprint-specific emphasis.
- Prefer hierarchy through size and spacing, not heavy font-weight.
- Default theme headings should keep negative tracking. Blueprint headings remain uppercase mono.

## Surfaces

- Primary content containers use `.panel-shell`.
- Use `.surface-subtle` for light default-theme feature panels.
- Use `.hero-band` only as a contrast band or accent zone, never as the default card background.
- Use `.enterprise-grid` only on large background areas, never inside dense cards.
- Avoid heavy shadows. Prefer borders and surface contrast.

## Shared Components

### Buttons

- `default`: dark solid button on light UI, blue on hover/focus
- `ghost`: transparent by default, color shift on interaction
- `outline`: border-led secondary action
- `link`: inline action only

Buttons should stay pill-shaped in the default theme. Blueprint may keep sharp corners through theme tokens.

### Cards

- Use `Card` for any primary information grouping.
- Default cards should keep the signature 22px roundness.
- Card titles should use display typography unless the context is purely utilitarian.

### Inputs

- Inputs and textareas use contained borders, light surfaces, and blue focus rings.
- Default controls should not use dark fills unless the whole surface is intentionally dark.
- Error states use `destructive` borders without changing the overall control shape.

### Dialogs and Popovers

- Dialogs inherit `panel-shell`.
- Default theme dialogs use rounded, light containers.
- Blueprint dialogs keep dashed borders and grid texture through theme selectors in `assets/main.css`.

## Layout Rules

- Keep section spacing generous. Default vertical rhythm is `24px` to `60px`.
- Use one dominant message per section.
- Keep copy width constrained; avoid full-width paragraphs in wide layouts.
- Prefer 1, 2, or 3-column responsive grids. Do not create arbitrary asymmetry unless it serves hierarchy.

## Blueprint Exception Rules

- Blueprint retains:
  - mono-forward typography
  - dashed borders
  - grid texture
  - sharp radii
  - dark technical palette

- Blueprint should still honor:
  - component variants
  - spacing rhythm
  - semantic token usage
  - shared layout structure

Do not fork component behavior unless Blueprint needs a clearly different visual treatment.

## Implementation Notes

- Prefer shared tokens and utilities over inline Tailwind literals.
- When adding a new shared container, consider whether it should become a reusable utility in `assets/main.css`.
- When updating a reusable component, verify both `default` and `blueprint`.
