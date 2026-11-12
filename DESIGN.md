---
name: FirstMenu
description: A welcoming, light cute-spooky app that shows a parent what she can make for her baby with what she has.
colors:
  background-body: "#fff8f0"
  surface: "#ffffff"
  card: "#ffffff"
  popover: "#ffffff"
  muted: "#f8eee3"
  accent: "#b4541a"
  accent-muted: "#f6d9c4"
  on-accent: "#ffffff"
  text-accent: "#8f3f10"
  text-primary: "#2b2330"
  text-secondary: "#5c5560"
  text-disabled: "#8d8492"
  icon-secondary: "#6e6573"
  border: "#eadccf"
  border-emphasized: "#9c8574"
  purple-background: "#efe7f7"
  purple-border: "#cdbdf0"
  purple-text: "#4a2f5e"
  orange-background: "#fde6d3"
  orange-border: "#f0b98f"
  orange-text: "#7a3410"
  yellow-background: "#fae19e"
  yellow-text: "#4b3900"
typography:
  body:
    fontFamily: "Figtree"
---

# Design System: FirstMenu

This file records the incumbent system as it is today. It is built only from `src/ui/theme/firstmenu.css`, `.kiro/steering/` and the active spec. Values that Astryx's `theme-neutral` supplies (sizes, radii, spacing, elevation) are not set by FirstMenu, so they are named here but not given numbers. Look them up with `npm run astryx -- component <Name>` instead of copying them.

## Overview

A friendly, calm app for a tired parent. Warm cream page, white cards, one soft orange accent, lavender and orange tints for some states. Light mode only (`<Theme mode="light">`). Rounded shapes and smiling inline-SVG characters: friendly ghost, mystery door, friendly monster, pumpkin. It is an Operate-mode product (see `.kiro/steering/design-skills.md`): the look serves speed and clarity. No hero, no photos, no hosted fonts.

## Colors

Defined as overrides of the Astryx neutral theme in `src/ui/theme/firstmenu.css`.

### Primary
- **Soft orange** (`#b4541a`): the accent, used for the one filled primary button, focus and UI affordances. White text on it is 4.97:1. Hover and pressed states use the accent at low alpha (`#b4541a14`, `#b4541a26`).
- **Accent text** (`#8f3f10`): orange text on cream (6.91:1), for links and small accented text.

### Neutral
- **Cream** (`#fff8f0`): page background. **White** (`#ffffff`): surfaces, cards, popovers. **Muted cream** (`#f8eee3`): quiet fills.
- **Ink** (`#2b2330`, 14.39:1), **secondary ink** (`#5c5560`, 6.82:1), **disabled** (`#8d8492`).
- **Border** (`#eadccf`) for quiet edges; **emphasized border** (`#9c8574`, 3.49:1 on white) for controls that need 3:1.

### Themed state colors
- **Lavender** (`#efe7f7`, border `#cdbdf0`, text `#4a2f5e`): ghosted recipe cards (`Recipes.tsx:83`) and active filter tokens (`Make.tsx:403`).
- **Peach** (`#fde6d3`, border `#f0b98f`, text `#7a3410`): the mystery-door badge (`ResultCard.tsx:55`, `Recipes.tsx:100`) and the suggested meal chip (`Make.tsx:415`).
- **Pumpkin yellow** (`#fae19e`, text `#4b3900`): the freezer badge.

### Named Rules
- **Contrast stays AA.** `npm run check:contrast` reads these tokens. Any change must keep it passing.
- **Palette is the maintainer's.** Do not replace or add palette colors in a design pass.
- **State is never color alone.** Every themed state also appears in text.

## Typography

Figtree, self-hosted through `@fontsource/figtree` (imported in `ThemeRoot.tsx`). Never Google Fonts or a CDN. Sizes, weights and line heights come from the Astryx theme; `firstmenu.css` only names the family.

## Layout

The app must work from 360 px wide and up (`.kiro/steering/tech.md`). Undecided (not stated in the sources): the page grid, column counts and spacing scale.

## Elevation & Depth

`firstmenu.css` sets no shadows. Cards use the white card color (`--color-background-card`) Anything more: Undecided (not stated in the sources).

## Shapes

Rounded shapes are required by `.kiro/steering/product.md`. Radii are not set in `firstmenu.css`; Astryx's neutral theme supplies them.

## Components

Astryx components are used throughout and stay (issue #37). Native controls stay on purpose: `<select>` (recipe page "Add to plan", editor ingredient category) and `<input type="date">`.

### Buttons
One filled primary button per screen (Requirement 17.10), orange with white text. The primary action is coordinated through `usePagePrimaryAction` and `PrimaryAction`: on screens without their own primary, the nav "Add recipe" button is the filled one. Everything else is a quiet gray or outlined button.

### Chips and tags
Food-group tags (Iron-rich, Vegetable and others, active spec Requirement 5) and a pumpkin-yellow freezer badge (`firstmenu.css`). On-hand foods are shown as chips (active spec Requirement 16). Tag and chip colors beyond that: Undecided (not stated in the sources).

### Cards
White card color, used for recipe results. Anything more: Undecided (not stated in the sources).

### Navigation
Main navigation, in order: Make, My recipes, Add recipe, Foods, Plan, Sources, Settings (active Requirement 1.2). The Plan area has its own tabs: Week, Prep, Grocery, Share, Print.

### Disclaimer
`Disclaimer.tsx` wording is fixed by requirements and tests. It may be restyled, never reworded, shortened, moved or removed.

## Do's and Don'ts

### Do:
- Keep Astryx components and the cream, orange, lavender palette.
- Keep one filled primary button per screen.
- Pair every themed illustration (inline SVG, `aria-hidden`) with text for its state.
- Keep motion CSS-only, subtle, and off under `prefers-reduced-motion`.
- Check at 360 px and 1280 px and by keyboard.

### Don't:
- Don't add hero sections, photos, hosted fonts, new dependencies or new palette colors.
- Don't reword or move the disclaimer.
- Don't add health or safety wording that is not in the design or a cited source.
- Don't use night scenes, skulls, gore, sharp teeth or jump scares.
