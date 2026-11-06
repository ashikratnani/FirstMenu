---
inclusion: always
---

# Product: FirstMenu

FirstMenu is a free web app for planning a week of baby meals. Parents pick
recipes from a library sorted by age stage, or add their own, and get a weekly
plan, a make-ahead prep list and a grocery list. Every recipe is screened
against a fixed infant-safety list based on pediatric guidance.

## Who it is for

- Built for a 10-month-old, designed for any parent of a baby roughly 6 to 12
  months old.
- Primary user: the parent planning the week on her own device.
- Secondary users: family members who cook or follow the plan. They get a
  read-only share link or a printout. There is no account.

## What it does

- Screens every ingredient name against a fixed safety rule list. Unsafe-for-age
  foods appear as ghosts and cannot be planned.
- Tracks first tastes: untried foods are mystery doors; introduced foods become
  friendly monsters; a recorded reaction ghosts recipes until cleared.
- Builds a 7-day plan, a make-ahead/freezer prep list, and a merged grocery
  list.
- Shares a week as a read-only link (data in the URL fragment) and offers a
  print view.

## Hard constraints

- No backend and no account. All data lives in the browser's `localStorage`.
- The app makes no network requests other than loading its own files. No
  analytics, no ads, no third-party trackers, no web fonts or files loaded from
  third-party hosts.
- The user can export all data to JSON and import it back.
- One child per device in v1.

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
every page, and on every recipe page, and tells users to check with their
pediatrician. The safety screen checks ingredient names against a fixed list and
can miss foods or preparations that are not on it.

## Out of scope for v1

Accounts, cloud sync or live shared editing, auto-generated plans, nutrition
tracking, more than one child per device, allergy diagnosis, offline install
(PWA) and translations.
