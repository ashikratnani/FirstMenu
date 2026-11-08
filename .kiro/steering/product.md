---
inclusion: always
---

# Product: FirstMenu

FirstMenu is a free web app that answers "What can I make for my baby with what
I have?" The parent sets her usual pantry once, taps what else she has today,
and sees recipes she can make now, quickest and easiest first, with nutrition
tags. She adds recipes by pasting a ChatGPT reply or an Instagram caption, and
the app can write the ChatGPT question for her. Every recipe is screened
against a fixed infant-safety list based on pediatric guidance.

Active spec: `.kiro/specs/what-can-i-make/`. v1 baseline (built):
`.kiro/specs/first-menu/`.

## Who it is for

- Built for a 10-month-old, designed for any parent of a baby or toddler from
  6 months to 3 years. Stages: 6–8 months, 9–11 months, 12–23 months, 2–3
  years.
- Primary user: the parent who decides what to cook, on her phone. She gets
  recipes from Instagram reels and ChatGPT and doesn't want to type recipes in.
- Family sharing is not a priority. Sharing a single recipe with friends is
  proposed (active spec Requirement 9).

## What it does

- "What can I make?": pantry + on-hand foods → Ready now and Missing one,
  sorted by time and effort, with Iron-rich and other food-group tags.
- Add a recipe by pasting text, parsed in the browser; preview and save with
  no typing. A prompt helper writes the ChatGPT question with the foods to
  leave out.
- Screens every ingredient name against a fixed safety rule list. For pasted
  recipes, block rules are also checked in the steps. Unsafe-for-age foods
  appear as ghosts.
- Tracks first tastes: untried foods are mystery doors; introduced foods become
  friendly monsters; a recorded reaction ghosts recipes until cleared.
- Secondary (under Plan): 7-day plan, prep list, grocery list, print view and
  plan share link. No new work on these.

## Hard constraints

- No backend and no account. All data lives in the browser's `localStorage`.
- The app makes no network requests other than loading its own files. It never
  calls an AI service and never opens Instagram links itself. No analytics,
  ads, trackers, web fonts or files from third-party hosts.
- The user can export all data to JSON and import it back.
- One child per device.

## Theme boundaries

- Welcoming, with a light cute-spooky touch: friendly ghosts, pumpkins, mystery
  doors, friendly monsters. Light palette (creams, soft oranges, lavender),
  rounded shapes, smiling characters.
- Never haunted houses, night scenes, frightening imagery, gore, skulls, blood,
  sharp teeth or jump scares.
- Every state shown by a theme element is also shown in text that screen readers
  announce.

## Not medical advice

The app is not medical advice. It states this on first run, in the footer of
every page, on every recipe page, and in the paste preview and prompt helper,
and tells users to check with their pediatrician. The safety screen checks
against a fixed list and can miss foods, amounts or preparations. Nutrition
tags show food groups, not nutrient amounts.

## Out of scope

Accounts, cloud sync, any backend or in-app AI, reading Instagram links or
videos, nutrient amounts or calorie tracking, more than one child per device,
allergy diagnosis, offline install (PWA) and translations.
