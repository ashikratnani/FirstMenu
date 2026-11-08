# Implementation Plan: What can I make?

**Status: APPROVED** by the maintainer on November 8, 2026.

Deadline: Friday, December 4, 2026, 2:00 PM PT. Target submission: Thursday, December 3.

Build order agreed with the maintainer: Astryx trial, then domain work and new screens, then toddler stages, then more recipes, then recipe sharing. Recipes now run alongside the other work instead of after it (see "Task 14 runs alongside the others" below). One adjustment: the toddler schema and stage plumbing (task 1) comes before the trial, because every later task builds on the new stages and it's small. Toddler recipe content arrives with the recipe expansion (task 14). Sharing (task 15) is the first thing to cut if the schedule slips.

**Task 14 runs alongside the others.** Because the target is 100 recipes, task 14 starts right after task 1 merges and continues in batches through M4, interleaved with tasks 2–13 (for example one recipe batch after each other task's PR merges). This is the one exception to working through the tasks strictly in order.

| Milestone | Dates | Tasks | Done when |
| --- | --- | --- | --- |
| M1 Foundation | Nov 9 – Nov 13 | 1 – 2, 14 batch 1 | Schema v2 and toddler stages merged; Astryx trial passed (or a decision issue opened); first recipe batch merged (about 35 built-ins). |
| M2 Domain | Nov 14 – Nov 18 | 3 – 8, 14 batches 2–3 | Time and effort, nutrition tags, categories, parser, text mentions, matching and prompt pass tests; about 75 built-ins. |
| M3 Screens | Nov 19 – Nov 25 | 9 – 13, 14 batch 4 | Make is home; paste → preview → save works on a phone; all pages on Astryx; about 95 built-ins. |
| M4 Recipes and sharing | Nov 26 – Nov 30 | 14 (final batch), 15 | At least 100 built-ins meeting the stage and allergen targets; sharing if time allows. Thanksgiving week, so this milestone is lighter. |
| M5 Verify and submit | Dec 1 – Dec 3 | 16 – 17 | Real pastes and phone checks done, docs and demo updated, submitted. |

Counts assume batch 1 brings the total to about 35 (10 WIC recipes plus up to 25 simple ideas) and each later batch adds about 20.

Branch names use the `v2/` prefix (for example `v2/6-paste-parser`) so they don't collide with v1 branches.

## Tasks

- [ ] 1. Schema v2 and toddler stages
  - [ ] 1.1 Add `Ingredient.optional`, `Recipe.statedMinutes`, `notes`, `imported`, `clearedMentions`, `kind`, `serveAs`, and `AppState.pantry`, `onHand` to `types.ts` and the zod schemas. Extend `StageId` with `12-23` and `24-36`. Set `SCHEMA_VERSION = 2` and add `MIGRATIONS[1]`.
    - _Requirements: 10.1, 10.2, 13.2, 14.4, 16.13_
  - [ ] 1.2 Strip `imported.text` and `clearedMentions` from the plan share payload. Tests: v1 state migrates, a v1 export imports, a v1 plan share link decodes.
    - _Requirements: 10.2, 10.4_
  - [ ] 1.3 Update `stageFor`, `defaultSlots`, stage labels ("9–11 months" for `9-12`), the over-36 notice, and onboarding and Settings wording for 6 months to 3 years. Confirm the stage texture hints against their sources. Extend the built-in recipe invariant test to the new stages.
    - _Requirements: 13.1 – 13.5, 13.9_
  - [ ] 1.4 Add `fromMonths` to `SafetyRule` and the `juice-limit` reminder (12 to 36 months, AAP-juice). Bump `RULESET_VERSION`. Tests per the design.
    - _Requirements: 13.6, 13.7_
  - [ ] 1.5 Add reducer actions: set pantry, add/remove/clear on-hand, clear text mention. Export `foodKeyFromName` from `foods.ts`.
    - _Requirements: 2.2, 3.2, 7.4_

- [ ] 2. Astryx trial
  - [ ] 2.1 Open `Decision needed: what to change in the UI`, asking for the primary user's specific complaints. Don't wait for the answer.
    - _Requirements: 15.8_
  - [ ] 2.2 Record v1 build sizes. Upgrade to React 19 with all tests passing.
    - _Requirements: 15.2, 15.6_
  - [ ] 2.3 Install pinned Astryx packages, add the FirstMenu theme with the v1 palette, self-host Figtree, and add `scripts/check-external.mjs` to CI.
    - _Requirements: 15.3, 15.4_
  - [ ] 2.4 Convert the app shell, recipe library and Settings form. Check tests, `vitest-axe`, keyboard, 360 px and the size budget, and report the results in the PR. Update `tech.md`. If any check fails, open `Decision needed: Astryx trial` and continue with tasks 3–8.
    - _Requirements: 15.1, 15.5 – 15.7_

- [ ] 3. Time and effort
  - [ ] 3.1 Implement `domain/effort.ts` (`recipeMinutes`, `recipeEffort`) per the design, with tests from the built-in recipes' steps and the listed edge cases.
    - _Requirements: 4.1 – 4.4, 10.3_

- [ ] 4. Nutrition tags
  - [ ] 4.1 Confirm each tag's term list against CDC-iron, CDC-encourage and USDA-FNS-iron. Drop terms the sources don't support. Add the sources to the sources table.
    - _Requirements: 5.2, 5.3_
  - [ ] 4.2 Implement `domain/nutrition.ts` with `NUTRITION_VERSION`, using the safety matcher. Tests: term format, sources, each tag fires, `except` cases, optional ingredients ignored.
    - _Requirements: 5.1, 5.3, 5.5, 5.6, 10.3_

- [ ] 5. Grocery category guess
  - [ ] 5.1 Implement `domain/category.ts` (`guessCategory`) with one test per category and the fallback.
    - _Requirements: 6.7_

- [ ] 6. Paste parser and text-mention screen
  - [ ] 6.1 Write paste fixtures: ChatGPT in the prompt format, ChatGPT free markdown, an Instagram caption with emoji and hashtags, a caption without headings, and a reply that mentions "no salt" in a step.
    - _Requirements: 6.3_
  - [ ] 6.2 Implement `domain/importText.ts` (`parseRecipeText`) per the design, with tests for every fixture and parsing rule.
    - _Requirements: 6.2, 6.3, 6.6_
  - [ ] 6.3 Implement `screenTextMentions` in `safety/screen.ts` and include text mentions in the ghost decision. Tests per the design.
    - _Requirements: 7.1 – 7.6_

- [ ] 7. Matching
  - [ ] 7.1 Implement `domain/make.ts` (`makeResults`, suggested chips) per the design, including younger-stage recipes for toddlers. Tests.
    - _Requirements: 3.3 – 3.9, 13.8_
  - [ ] 7.2 Implement `data/foodNames.ts`, `data/searchPhrases.ts` and `domain/foodSearch.ts` (`buildVocabulary`, `searchHave`) per "Type what you have" in the design. Tests: every row of the worked-examples table in the design; separators and unseparated text; filler and request words; quantities; the single longest-match pass with ties going to foods ("sweet potato" vs "potato", "quick oats" vs "quick"); descriptor vs filter (step 4); other names and stop phrases ("bean curd" → tofu, "lemon curd" and "ladyfinger" → no food, listed under "Not recognized", "curd" → yogurt); typo distances and ties, and no typo match against stop phrases or dish-kind phrases; each dish-kind phrase ("something for breakfast", "finger food", "quick", "iron rich", "make ahead"); title words; unrecognized words; list checks (every target equals `groceryFoodKey({ name: target })`, no name mapped to two foods, no phrase that is also a food, plural-aware); descriptor adjacency ignoring filler words ("mashed ripe banana", "quick cooked rice"); stop phrases listed under "Not recognized".
    - _Requirements: 16.1 – 16.4, 16.7 – 16.11_
  - [ ] 7.3 Add `serveAs` derivation for custom recipes and the filter logic, including "More ideas", to `make.ts`. Tests: derivation keywords, stage defaults when nothing matches, AND of filters, the "Iron-rich only" toggle and the "iron rich" phrase as one filter, "More ideas" ordering, cap and ghost exclusion, "More ideas" with only the toggle on, filters with no foods typed.
    - _Requirements: 16.9, 16.12, 16.13_

- [ ] 8. Prompt helper logic
  - [ ] 8.1 Implement `domain/prompt.ts` (`buildPrompt`) with per-stage texture hints. Tests: content, leave-out list at 10, 13 and 25 months, reaction foods, "toddler" wording at 12 months and over, no name or birth date.
    - _Requirements: 8.2 – 8.5, 13.5_

- [ ] 9. Navigation and Plan move (Astryx)
  - [ ] 9.1 Move the week grid to `/plan` with a Week · Prep · Grocery · Share · Print sub-navigation. Main nav: Make, My recipes, Add recipe, Foods, Plan, Sources, Settings. Keep old routes working.
    - _Requirements: 1.2 – 1.4_

- [ ] 10. Make screen (Astryx)
  - [ ] 10.1 Build `ui/pages/Make.tsx` at `/`: pantry summary and editor (suggested list on first use), on-hand chips and suggested-food chips, Clear (the text box itself comes in 10.3), filters, Ready now, Missing one with "I have this", ghosted count with expand, empty state with the prompt helper. Add pantry editing to Settings.
    - _Requirements: 1.1, 2.1 – 2.4, 3.1 – 3.10_
  - [ ] 10.2 Component tests: groups render, "I have this" moves a recipe to Ready now, ghosted recipes are excluded.
    - _Requirements: 3.4, 3.5_
  - [ ] 10.3 Add the "What do you have?" search box to the Make screen: live chips and results while typing, "Did you mean" chips, "Not recognized" list, "Recipes named …" group, removable filter chips, "More ideas", Enter or "Add" to keep. Add "Serve as" with editing to the recipe page for custom recipes. Component tests: typing "leftover chicken, rice and peas" shows three chips and updates results; a typo needs a tap before it counts; Enter moves foods to on-hand; "something for breakfast" alone shows breakfast recipes including "More ideas"; "finger food" filters to finger-food recipes; typing "iron rich" turns on the "Iron-rich only" toggle and removing the chip turns it off; a custom recipe with a guessed form shows "(guessed)" and can be edited.
    - _Requirements: 3.9, 16.5 – 16.9, 16.12, 16.13_

- [ ] 11. Add recipe and prompt helper (Astryx)
  - [ ] 11.1 Build `ui/pages/AddRecipe.tsx` at `/add`: source picker and link, paste box, preview with line editing and moving, "mark lines as ingredients" mode, safety results with text mentions and "Not used in this recipe", Save. Link to the typed editor. Include the Instagram and screenshot help text and the fixed-list disclaimer.
    - _Requirements: 6.1, 6.4 – 6.11, 7.3 – 7.5, 11.2_
  - [ ] 11.2 Build the prompt helper UI on Make and Add recipe: copy, open ChatGPT, "Paste the answer", notice.
    - _Requirements: 8.1, 8.6 – 8.9_
  - [ ] 11.3 Component tests: paste → preview → save with no typing; a text mention ghosts and "Not used" clears it.
    - _Requirements: 6.4, 7.3, 7.4_

- [ ] 12. Recipe page and library
  - [ ] 12.1 Add time, effort, nutrition tags with the explainer, "Original text", cleared mentions, "Simple idea" label and "Add to plan" to the recipe page. Show time, effort and tags in the library, plus a "From ChatGPT / Instagram" badge. Add stated time to the typed editor. Add nutrition lists and sources to the Sources page.
    - _Requirements: 1.5, 4.5, 4.6, 5.4, 6.8, 7.4, 11.3, 14.4_

- [ ] 13. Convert remaining pages to Astryx
  - [ ] 13.1 Convert Foods, recipe page, typed editor, Prep, Grocery, Share, Sources and Onboarding. Keep print CSS. Apply any UI feedback received under task 2.1. Re-run `vitest-axe` on every page.
    - _Requirements: 15.1, 15.5, 15.8_

- [ ] 14. More built-in recipes (starts after task 1, runs in batches alongside tasks 2–13)
  - [ ] 14.1 Move built-in recipe data into its own build chunk and report its gzipped size. Ships in the batch 1 PR, before any recipes are added, so every batch PR can report the chunk size.
    - _Requirements: 15.6_
  - [ ] 14.2 Batch 1: re-tag the 10 Minnesota WIC recipes for toddler stages where the texture fits, set `serveAs` on them, and add simple ideas from WIC and USDA feeding guides to `data/simpleIdeas.ts` (at most 25 in total).
    - _Requirements: 13.2, 14.2, 14.4, 14.5, 14.8, 16.13_
  - [ ] 14.3 Batches 2 onward: add ICN Child Nutrition Recipe Box and Food Hero recipes, about 20 per PR, following the expansion rules in the design, with `serveAs` set on each. Prioritize missing allergen groups first, then stage counts. Open a `Recipe review: batch <n>` issue for each batch.
    - _Requirements: 14.2, 14.3, 14.5, 14.8, 16.13_
  - [ ] 14.4 Ships with the final batch PR. Set the invariant tests to the final counts in Requirement 14.1 and to all nine allergen groups. If short of either, open `Decision needed: recipe shortfall` with the numbers and don't ship short without an answer. Comment on issue #7 with the final numbers.
    - _Requirements: 14.1, 14.6, 14.7_

- [ ] 15. Share a recipe (first to cut)
  - [ ] 15.1 Implement `domain/recipeShare.ts` (payload, encode, decode, share text), with tests that the payload and text carry no child data or pasted text.
    - _Requirements: 9.3, 9.5_
  - [ ] 15.2 Add "Share recipe" (share sheet or copy) and the read-only `#/r/<data>` view with "Add to my recipes", which screens as a pasted recipe.
    - _Requirements: 9.1, 9.2, 9.4, 9.6, 9.7_

- [ ] 16. Verify
  - [ ] 16.1 Ask the maintainer for 2–3 real pastes (ChatGPT replies and Instagram captions) in a `Decision needed: real paste samples` issue. Add them as fixtures with personal details removed, and fix parser gaps. Don't wait for them to continue other tasks.
    - _Requirements: 6.3, 12.2_
  - [ ] 16.2 Carried over from v1: manual iOS VoiceOver and 360 px pass (v1 task 16.1), then deploy and check end to end on a phone with a baby profile and a toddler profile, including a real paste (v1 task 17.1).
    - _Requirements: 11.1, 12.2, 13.1_

- [ ] 17. Deliverables
  - [ ] 17.1 Update `README.md`, `docs/kiro-usage.md` (including how this spec changed the v1 plan after user feedback) and the demo script for the new flow, under 3 minutes.
    - _Requirements: 12.1_
  - [ ] 17.2 Carried over from v1 task 18.4: the maintainer records the video, uploads it to YouTube, and submits by Thursday, December 3.
    - _Requirements: 12.1_
