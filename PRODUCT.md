# Product

<!-- impeccable:product-schema 1 -->

Source note: no one was available for the impeccable init interview, so this file was written only from `.kiro/steering/product.md`, `.kiro/steering/tech.md`, `.kiro/steering/design-skills.md`, the active spec (`.kiro/specs/what-can-i-make/`) and `src/ui/theme/firstmenu.css`. Anything not stated there is marked "Undecided" and must not be filled in by guesswork.

## Platform

web

## Stack

React 19 and TypeScript with Vite, Astryx components (`@astryxdesign/core`) with the FirstMenu theme in `src/ui/theme/`, CSS modules for app-specific pieces, Vitest. Fonts are self-hosted Figtree through `@fontsource/figtree`. `HashRouter`, Vite `base` `'/FirstMenu/'`, hosted on GitHub Pages. No other CSS framework or CSS-in-JS.

## Users

The parent of a baby or toddler who decides what to cook, on her phone, often with one hand. Built for a 10-month-old and designed for any child from 6 months to 3 years (stages 6-8 months, 9-11 months, 12-23 months, 2-3 years). She gets recipes from Instagram reels and ChatGPT and does not want to type recipes in. Family sharing is not a priority. Sharing a single recipe with friends is approved (active spec Requirement 9). A second audience is the recipient of a shared plan or recipe, who opens a read-only link with no account.

## Product Purpose

Answer "What can I make for my baby with what I have?" The parent sets her usual pantry once, taps what else she has today, and sees recipes she can make now, quickest and easiest first, with food-group tags. Every recipe is screened against a fixed infant-safety list based on pediatric guidance. Success measures: Undecided (not stated in the sources).

## Positioning

Undecided (not stated in the sources).

## Operating Context

- Used on a phone, also on desktop. Must work from 360 px wide and up and be fully keyboard-usable.
- All data lives in the browser's `localStorage`. One child per device. The user can export all data to JSON and import it back.
- Recipes arrive by pasting a ChatGPT reply or an Instagram caption; the app can write the ChatGPT or Meta AI question for her. The app never calls an AI service and never opens Instagram links.
- Screens: Make (home), My recipes, recipe page, recipe editor, Add recipe, Foods, Sources, Settings, onboarding, and under Plan: Week, Prep, Grocery, Share, Print. Read-only shared plan (`/shared/:data`) and shared recipe (`/r/:data`) views sit outside the app shell.
- Plan, prep, grocery, print and plan share are secondary: no new work on them.

## Capabilities and Constraints

- Make: pantry plus on-hand foods give Ready now and Missing one, sorted by time and effort, with Iron-rich and other food-group tags. Tags show food groups, not nutrient amounts.
- Safety: ingredient names are matched against a fixed rule list (block rules show a ghost, prep reminders, allergen rules show a mystery door). Pasted recipes also get block rules checked against title, steps and notes until the user taps "Not used in this recipe". The rule list is not user-editable and every rule has a cited source (AAP, WHO, CDC, FDA/EPA or NIAID).
- First tastes: untried foods are mystery doors, introduced foods are friendly monsters, a recorded reaction ghosts recipes until cleared.
- No network requests other than the app's own files. No analytics, ads, trackers, web fonts, photos or third-party hosts. Illustrations are inline SVG, `aria-hidden`, and every state is also in text.
- Animations are CSS-only and off under `prefers-reduced-motion`.
- WCAG 2.1 AA contrast. Build checks: `check:contrast`, `check:external`, `check:size`.
- One filled primary button per screen (Requirement 17.10).
- Disclaimer wording is fixed and pinned by tests (`src/ui/components/Disclaimer.tsx`). It stays on first run, in every page footer, on every recipe page, in the paste preview and in the prompt helper.
- Out of scope: accounts, cloud sync, any backend or in-app AI, reading Instagram links or videos, nutrient amounts or calorie tracking, more than one child per device, allergy diagnosis, offline install (PWA), translations.
- Undecided (not stated in the sources): the voice guide beyond "welcoming" and "light cute-spooky", target performance numbers, any brand assets beyond the name and the ghost, door, monster and pumpkin art.

## Brand Commitments

- Name: FirstMenu.
- Welcoming, with a light cute-spooky touch: friendly ghosts, pumpkins, mystery doors, friendly monsters. Light palette (creams, soft oranges, lavender), rounded shapes, smiling characters.
- Never haunted houses, night scenes, frightening imagery, gore, skulls, blood, sharp teeth or jump scares.
- Theme decisions (palette, visual world) belong to the maintainer. The Astryx components stay.

## Evidence on Hand

- Built-in recipes and their publishers: `docs/recipe-sources.md`. The Sources page lists the nutrition tag food lists and their sources (active Requirement 11.3).
- Inspiration notes: `docs/design-inspiration.md` (patterns only, never copy another site).
- Absent and not to be invented: user testimonials, usage data, photographs, press, a logo file.

## Product Principles

1. Every screen is a task screen (find something to cook, add a recipe, check a food). Ambition shows as clarity, speed and precision, not spectacle (`.kiro/steering/design-skills.md`, Mode: Operate).
2. Disclaimer wording is fixed and may be restyled only, never reworded, shortened, removed or moved (`.kiro/steering/design-skills.md`).
3. Add a recipe by pasting text, with preview and save with no typing (`.kiro/steering/product.md`).
4. Copy does not add health or safety wording that is not in the design or a cited source (`.kiro/steering/autonomy.md`).
5. Other principles: Undecided (not stated in the sources).

## Accessibility & Inclusion

WCAG 2.1 AA contrast, full keyboard use, screen-reader text for every themed state, reduced-motion support, usable at 360 px and up (v1 Requirement 14.4, active Requirement 15.5).
