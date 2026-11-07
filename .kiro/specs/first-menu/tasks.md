# Implementation Plan

Deadline: Friday, December 4, 2026, 2:00 PM PT. Target submission: Thursday, December 3, to leave a day of buffer.

| Milestone | Dates | Tasks | Done when |
| --- | --- | --- | --- |
| M1 Foundation and safety screen | Nov 9 – Nov 15 | 1 – 3 | Safety screen passes all tests; CI green; empty app deployed to Pages. |
| M2 Recipes, foods and plan | Nov 16 – Nov 22 | 4 – 10 | A full week can be planned on a phone with ghosts and doors working. |
| M3 Prep, grocery, share, theme | Nov 23 – Nov 29 | 11 – 15 | Prep list, grocery list, share link and print all work; illustrations in. Thanksgiving week, so this milestone is lighter. |
| M4 Polish and submission | Nov 30 – Dec 3 | 16 – 18 | Accessibility pass done, write-up and video published, submitted. |

## Tasks

- [ ] 1. Set up the project
  - [x] 1.1 Scaffold React + TypeScript + Vite in the repo root with `base: '/FirstMenu/'`, `HashRouter`, ESLint, Vitest and React Testing Library. Add `zod`, `lz-string`, `react-router-dom`. No analytics, fonts or other files loaded from third-party hosts.
    - _Requirements: 12.2, 12.3, 15.1_
  - [x] 1.2 Add `.github/workflows/ci.yml` (lint, test, build on pull requests) and `.github/workflows/deploy.yml` (build and deploy to GitHub Pages on push to `main`). Pages must be turned on by the maintainer (Settings → Pages → Source: "GitHub Actions"); Kiro's token gets HTTP 403. If it isn't on yet, the deploy job will fail until it is, which doesn't block other tasks.
    - _Requirements: 15.2_
  - [x] 1.3 Add `.kiro/steering/` files: product summary, tech conventions, and a safety-rules steering file stating that every rule needs a source and a test case, and that rules match ingredient names only.
    - _Requirements: 4.6, 4.7, 15.4_
  - [ ] 1.4 After the CI workflow has run once on `main`, ask the maintainer to turn on branch protection for `main` requiring the CI check to pass. (This replaces the earlier save hook: Kiro Web doesn't run hooks, so CI on every PR is where the safety tests run.)
    - _Requirements: 2.6, 4.9, 15.2_

- [x] 2. Domain types and age
  - [x] 2.1 Write `domain/types.ts` with the data models from the design.
    - _Requirements: 2.2, 2.3, 8.1, 12.6_
  - [x] 2.2 Implement `ageInMonths`, `stageFor` and `defaultSlots` in `domain/age.ts`, with tests for month boundaries, end-of-month birthdays and leap years.
    - _Requirements: 1.2, 1.3, 8.2_

- [x] 3. Safety screen
  - [x] 3.1 Implement `safety/normalize.ts` (normalize, tokenize, plural-aware phrase matching) with unit tests.
    - _Requirements: 4.1, 4.2_
  - [x] 3.2 Write `safety/rules.ts` with the block, reminder and allergen rules and the sources table from the design. Find sources for the rules marked "confirm source" (unpasteurized products, egg and meat cooking, 3-day new-food spacing) and record the URLs. Any still missing stay active and are tracked in a GitHub issue until task 17.0. Add `RULESET_VERSION`.
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 6.4, 7.8_
  - [x] 3.3 Implement `screenIngredient` and `screenRecipe` in `safety/screen.ts`, including age limits, exceptions and reminder de-duplication.
    - _Requirements: 4.1 – 4.5, 4.8, 5.3, 5.5, 6.3_
  - [x] 3.4 Write the safety tests: every row of the matching table; each rule fires on at least one term; age limits at `limit - 1` and `limit`; every rule has a source and every source id exists; every term is lowercase and singular.
    - _Requirements: 4.1 – 4.7_

- [ ] 4. Built-in recipes
  - [x] 4.1 Search for published baby recipes and add at least 24 to `data/recipes.ts`, following "Built-in recipe sourcing" in the design: at least 10 per stage, all four meal types, all nine allergen groups. Copy ingredients and quantities, rewrite steps in our own words, record the source and any adaptations, skip recipes that would need other changes. If the published recipes can't meet the counts or allergen coverage, stop and report the gap before using tier 3 sources.
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.7, 2.8, 2.9, 2.10_
  - [x] 4.2 Add recipe invariant tests: counts per stage, allergen coverage, no block findings at the youngest age of each tagged stage, valid categories, source fields present, storage times sourced.
    - _Requirements: 2.1, 2.5, 2.6, 2.7, 2.10_
  - [ ] 4.3 Open a `Recipe review` issue listing every built-in recipe with its source link, stage tags and adaptations, for the maintainer and his wife to review. This doesn't block later tasks. Apply their feedback in a follow-up PR when it arrives, and tick this task then.
    - _Requirements: 2.2, 2.9_

- [ ] 5. State and storage
  - [ ] 5.1 Implement `domain/storage.ts`: schema version, `migrate`, zod validation, corrupt-data backup, debounced save, storage-unavailable detection. Add tests.
    - _Requirements: 12.1, 12.6, 12.7_
  - [ ] 5.2 Implement `AppProvider` with reducer actions (set child, save/delete custom recipe, set food record, set slot, clear slot, set active slots, new week, set prep date, toggle grocery item) and the memoized selectors.
    - _Requirements: 1.6, 3.1, 3.5, 5.4, 8.4, 8.5, 8.6_
  - [ ] 5.3 Add export to JSON and import with validation. Test that a bad file leaves the data unchanged.
    - _Requirements: 12.4, 12.5_

- [ ] 6. App shell
  - [ ] 6.1 Build the layout, navigation, routes, `theme.css` color tokens (checked for AA contrast) and reduced-motion handling. Use placeholder art for now.
    - _Requirements: 14.4, 14.5, 14.6_
  - [ ] 6.2 Add the first-run disclaimer, footer disclaimer, storage banner and the Sources page generated from `rules.ts`.
    - _Requirements: 4.7, 12.7, 13.1, 13.2, 13.3_

- [ ] 7. Onboarding and child profile
  - [ ] 7.1 Build onboarding: birth date, optional name, the under-6 and 12-plus notices, and a tried-foods checklist with the nine allergens first. Add a Settings page to edit these later.
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 7.2_

- [ ] 8. Foods and first tastes
  - [ ] 8.1 Implement `domain/foods.ts`: `foodKeyFor`, descriptor stripping, ignored foods, `collectFoods`, `foodStatus`. Add tests.
    - _Requirements: 3.3, 7.1, 7.3, 7.6_
  - [ ] 8.2 Build the Foods page: doors, monsters and ghosts with text labels; "tried, no reaction" and "noticed a reaction" actions; clearing a reaction; allergen guidance including the peanut note.
    - _Requirements: 5.7, 7.3 – 7.7, 14.3_

- [ ] 9. Recipe library and recipe page
  - [ ] 9.1 Build the library with stage and meal-type filters, ghost cards, door badges and pumpkin badges.
    - _Requirements: 2.4, 5.1, 5.3, 7.3, 9.1_
  - [ ] 9.2 Build the recipe page with ingredients, prep reminders, steps, storage, block reasons, the source link and adaptations, and the disclaimer. Add recipe sources to the Sources page.
    - _Requirements: 2.7, 2.9, 5.3, 6.1, 6.2, 13.1_
  - [ ] 9.3 Build the custom recipe editor: all fields, a "counts as" food per ingredient, screening on save with findings shown, and delete with emptied-slot notice.
    - _Requirements: 3.1 – 3.5, 4.9, 5.6_

- [ ] 10. Week plan
  - [ ] 10.1 Implement `domain/plan.ts`: default start date, new week (keep or empty), new-food spacing warnings. Add tests.
    - _Requirements: 7.8, 8.1, 8.5_
  - [ ] 10.2 Build the week view (a plain, bright grid of day cards) and slot picker: slot toggles, eligible recipes first, ghosts disabled with reasons, door markers, ghosted-slot replacement prompt, spacing warning.
    - _Requirements: 5.2, 5.4, 7.8, 8.2 – 8.4_
  - [ ] 10.3 Component tests: a ghosted recipe can't be added; a reaction ghosts planned slots.
    - _Requirements: 5.2, 5.4, 7.6_

- [ ] 11. Prep list
  - [ ] 11.1 Implement `domain/prep.ts` (servings, cook sessions, fridge/freezer/fresh rules, batches, thaw reminders) with tests.
    - _Requirements: 9.2, 9.4_
  - [ ] 11.2 Build the Prep page with an editable prep day.
    - _Requirements: 9.2, 9.3, 9.5_

- [ ] 12. Grocery list
  - [ ] 12.1 Implement `domain/grocery.ts` (merge by food and unit, "as needed", category grouping, reminders, check reconciliation) with tests.
    - _Requirements: 10.1 – 10.6_
  - [ ] 12.2 Build the Grocery page with check-off.
    - _Requirements: 10.3, 10.5, 10.6_

- [ ] 13. Share link
  - [ ] 13.1 Implement `domain/share.ts` (payload, encode, decode, validation, length warning) with tests for round-trip, tampered links and absence of name and birth date.
    - _Requirements: 11.1 – 11.3, 11.5, 11.6_
  - [ ] 13.2 Build the Share page (copy link, warning) and the read-only shared view. Test that the shared view writes nothing to storage.
    - _Requirements: 11.4, 11.5_

- [ ] 14. Print view
  - [ ] 14.1 Build the print route and print CSS: week grid, prep list, grocery list, reminders, text-only states.
    - _Requirements: 6.1, 11.7_

- [ ] 15. Theme art
  - [ ] 15.1 Draw the SVG set: friendly ghost, mystery door, friendly monsters (one per allergen group plus a generic one), pumpkin badge, lantern. Light, welcoming palette; no haunted house or night scenes. Add door-opening and ghost-float animations that turn off under reduced motion.
    - _Requirements: 14.1, 14.2, 14.3, 14.5_

- [ ] 16. Accessibility and device pass
  - [ ] 16.1 Run `vitest-axe` on main pages, do a keyboard-only pass, test on iOS Safari with VoiceOver and at 360 px width, and fix issues.
    - _Requirements: 14.3, 14.4, 14.6, 15.3_

- [ ] 17. Deploy and verify
  - [ ] 17.0 Release gate: confirm every rule cites a published source with a URL, and switch on the required-source test. If any source is still missing, raise it with you before submission.
    - _Requirements: 4.7_
  - [ ] 17.1 Merge to `main` and confirm the app loads at `https://ashikratnani.github.io/FirstMenu/`. Plan a week end to end on a phone and open a share link on a second device.
    - _Requirements: 15.1, 15.2_

- [ ] 18. Hackathon deliverables
  - [ ] 18.1 Update `README.md`: what the app does, app URL, screenshots, disclaimer, safety and recipe sources, license.
    - _Requirements: 13.1, 15.4_
  - [ ] 18.2 Write `docs/kiro-usage.md`: how the spec drove the build, the steering files, the `pr-reviewer` agent and its review loop (with links to example review comments), and examples of Kiro-generated code and tests.
    - _Requirements: 15.4_
  - [ ] 18.3 Draft a demo script under 3 minutes (setup, ghosted honey, grapes reminder, first-taste door opening, plan, prep and grocery list, share link). You record it and upload it publicly to YouTube.
  - [ ] 18.4 Submit by Thursday, December 3: app URL, YouTube link, repo link, write-up.
