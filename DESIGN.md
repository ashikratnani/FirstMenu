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
  group-vegetable: "#e3f3dd"
  group-fruit: "#fbe0e7"
  group-grain: "#fdf3c4"
  group-protein: "#fde6d3"
  group-dairy: "#e3eefb"
  group-pantry: "#f1ece4"
  group-other: "#f8eee3"
  group-not-yet: "#efe7f7"
typography:
  body:
    fontFamily: "Figtree"
  heading:
    fontFamily: "Fredoka"
    fontWeight: 600
---

# Design System: FirstMenu

This file records the incumbent system as it is today. It is built only from `src/ui/theme/firstmenu.css`, `.kiro/steering/` and the active spec. Values that Astryx's `theme-neutral` supplies (sizes, radii, spacing, elevation) are not set by FirstMenu, so they are named here but not given numbers. Look them up with `npm run astryx -- component <Name>` instead of copying them.

## Overview

A friendly, calm app for a tired parent. Warm cream page, white cards, one soft orange accent, lavender and orange tints for some states. Light mode only (`<Theme mode="light">`). Rounded shapes and smiling characters drawn as inline SVG: the peekaboo monster (a new food), friendly monsters (tried foods), plus Fluent Emoji 3D pictures for foods, the hourglass (Not yet) and the snowflake (freezes well), and Fredoka headings (active spec Requirement 21, decided by the maintainer on November 13, 2026). Until the task 19.4 PRs land, screens still show the earlier door, ghost and pumpkin drawings. It is an Operate-mode product (see `.kiro/steering/design-skills.md`): the look serves speed and clarity. No hero, no photos, no pictures made by an image-generation model, no hosted fonts.

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

### Food group colors
Plate bands and Foods tile circles carry no text (`--fm-color-group-*` in `src/ui/theme.css`): vegetable `#e3f3dd`, fruit `#fbe0e7`, grain `#fdf3c4`, protein `#fde6d3`, dairy `#e3eefb`, pantry `#f1ece4`, other `#f8eee3`, and the lavender `#efe7f7` for any Not yet recipe or food. Nutrition tags are chips in their own background and text pair (`--fm-color-tag-*`, each at least 4.5:1, checked by `npm run check:contrast`): Vegetable `#e3f3dd` / `#1f4d1a`, Fruit `#fbe0e7` / `#6e1f36`, Whole grain `#fdf3c4` / `#4b3900`, Protein `#fde6d3` / `#6b2a10`, Dairy `#e3eefb` / `#1d3f6e`, Iron-rich `#f6dccf` / `#6b2a10`, Healthy fat `#edf3d4` / `#3d4a0f`. Tags always show their names.

### Named Rules
- **Contrast stays AA.** `npm run check:contrast` reads these tokens. Any change must keep it passing.
- **Palette is the maintainer's.** Do not replace or add palette colors in a design pass. The food group and tag colors above were approved with Requirement 21.
- **State is never color alone.** Every themed state also appears in text.

## Typography

Body text, buttons, chips and labels use Figtree, self-hosted through `@fontsource/figtree`. Headings use Fredoka 600 (latin only, `@fontsource/fredoka`, exact version), through Astryx's `--font-family-heading` token set in `firstmenu.css`, followed by the body font stack as the fallback. Plain `h1` to `h3`, recipe card titles and Foods tile names use the same token. Both fonts are imported in `ThemeRoot.tsx` and never come from Google Fonts or a CDN. Sizes, weights and line heights come from the Astryx theme; `firstmenu.css` only names the families.

## Art

Food, group, hourglass and snowflake pictures are Fluent Emoji 3D files (MIT) converted to 128 px WebP in `public/art/`, shown as decorative `<img alt="">` (`FoodPicture`, `StatePicture`, `Plate`). Each file is at most 8 KB (`npm run check:size`). The peekaboo monster and the friendly monsters are SVG drawings (`foodArt.tsx`, colors in `monsterArt.ts`, ids prefixed with `useId()`), drawn from `docs/art/reference/`. A plate shows up to three main foods or the generic bowl, never a choking-shape picture. A Not yet plate keeps its foods, greyed, with the hourglass beside it. Credits are on the Sources page.

## Layout

The app must work from 360 px wide and up (`.kiro/steering/tech.md`). Undecided (not stated in the sources): the page grid, column counts and spacing scale.

## Elevation & Depth

`firstmenu.css` sets no shadows. Cards use the white card color (`--color-background-card`). Anything more: Undecided (not stated in the sources).

## Shapes

Rounded shapes are required by `.kiro/steering/product.md`. Radii are not set in `firstmenu.css`; Astryx's neutral theme supplies them.

## Components

Astryx components are used throughout and stay (issue #37). Native controls stay on purpose: `<select>` (recipe page "Add to plan", editor ingredient category) and `<input type="date">`.

### Buttons
One filled primary button per screen (Requirement 17.10), orange with white text. The primary action is coordinated through `usePagePrimaryAction` and `PrimaryAction`: on screens without their own primary, the nav "Add recipe" button is the filled one. Everything else is a quiet gray or outlined button.

### Chips and tags
Food-group tags (Iron-rich, Vegetable and others, active spec Requirement 5) are colored chips with their names (`TagBadge`, colors above), and the freezer badge is pumpkin yellow (`firstmenu.css`) until the snowflake replaces its drawing in task 19.4. On-hand foods are shown as chips (active spec Requirement 16). Tag and chip colors beyond that: Undecided (not stated in the sources).

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
- Don't add hero sections, photos, hosted fonts, new dependencies or new palette colors. Pictures come only from the committed Fluent Emoji files.
- Don't reword or move the disclaimer.
- Don't add health or safety wording that is not in the design or a cited source.
- Don't use night scenes, skulls, gore, sharp teeth or jump scares.
