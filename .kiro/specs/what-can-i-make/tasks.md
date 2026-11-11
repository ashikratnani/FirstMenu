# Implementation Plan: What can I make?

**Status: APPROVED** by the maintainer on November 8, 2026.

**Change note, November 10, 2026:** the maintainer sent three replies in session, quoted verbatim:

1. "should puree-only recipes be allowed for toddlers? No"
2. "Instead of taking in unschematized pastes, let's give user a prompt which includes JSON format output template. The user will input the prompt they would send to ChatGPT, and the app will generate a prompt with output template that you can parse. The task for the user will be to run the prompt and paste the output into the app, and the app will parse the output and add it to their recipes. For Instagram, we will need the user to access Meta AI or any AI chat app that can connect to user's Insta account. The user will have to paste the reel url in our app, the app generates a prompt instructing the AI chat app to parse the recipe and output a parseable JSON."
3. "I like the new UI. It's clean and it's proactive like I asked. It's still a bit daunting to a new user. There should be some onboarding process to help user understand what the app can do and how to use it. We shouldn't spend too much time of onboarding because we do want the user to be delighted on first impression. We should have them say what problems they have and we should quickly help solve one of them so they know this app can do something for them."

Resulting scope: (1) a JSON prompt flow for ChatGPT and an Instagram reel prompt flow in place of unstructured pastes (new tasks 11.5 to 11.7, Requirements 18 and 19, task 16.1 reworked), (2) a short problem-first onboarding (new task 18, Requirement 20), and (3) puree-only recipes for toddlers are not allowed (batch 1 invariant kept). These are approved scope changes, not Decide-yourself spec fixes. Order: 11.5 to 11.7 come next (11.1 to 11.4 are done), before 12; task 18 comes after 13 because it builds on the Astryx Onboarding page, and is part of M3. Tasks already ticked are unchanged, except the parent checkbox of task 11, which is unticked again until 11.5 to 11.7 land.

Deadline: Friday, December 4, 2026, 2:00 PM PT. Target submission: Thursday, December 3.

Build order agreed with the maintainer: Astryx trial, then domain work and new screens, then toddler stages, then more recipes, then recipe sharing. Recipes now run alongside the other work instead of after it (see "Task 14 runs alongside the others" below). One adjustment: the toddler schema and stage plumbing (task 1) comes before the trial, because every later task builds on the new stages and it's small. Toddler recipe content arrives with the recipe expansion (task 14). Sharing (task 15) is the first thing to cut if the schedule slips.

**Task 14 runs alongside the others.** Because the goal is 500 recipes (hard minimum 300; raised from 100 by the maintainer on November 11), task 14 starts right after task 1 merges and continues in batches through M4, interleaved with tasks 2–13 (for example one recipe batch after each other task's PR merges). This is the one exception to working through the tasks strictly in order.

| Milestone | Dates | Tasks | Done when |
| --- | --- | --- | --- |
| M1 Foundation | Nov 9 – Nov 13 | 1 – 2, 14 batches 1–3 | Schema v2 and toddler stages merged; Astryx trial passed (or a decision issue opened); batches 1–2 merged (43 built-ins), batch 3 merged (plan line about 85; about 95 on the stretch line). |
| M2 Domain | Nov 14 – Nov 18 | 3 – 8, 14 batches 4–5 | Time and effort, nutrition tags, categories, parser, text mentions, matching, prompt and suggestions pass tests; batches 4–5 merged (plan line about 165; about 195 on the stretch line). |
| M3 Screens | Nov 19 – Nov 25 | 9 – 13, 11.5 – 11.7, 18, 14 batches 6–9 | Make is home; paste → preview → save works on a phone, including the JSON prompt flows and the short onboarding; all pages on Astryx; batch 6 (Nov 19) also checks first-load speed; about 325 built-ins on the plan line (about 395 on the stretch line), so the hard minimum of 300 is passed by Nov 25. |
| M4 Recipes and sharing | Nov 26 – Nov 30 | 14 batches 10–11 (final), 15 | At least the hard minimum of 300 and its stage, effort and allergen counts (the plan line reaches about 405; 500 is the stretch goal); recipe freeze on Nov 30; sharing if time allows. Thanksgiving week (Nov 26), so lighter. |
| M5 Verify and submit | Dec 1 – Dec 3 | 16 – 17 | JSON prompt flows run in real AI apps and phone checks done, docs and demo updated, submitted. No new recipes. |

Counts assume batches 1 and 2 are merged (43 built-ins on November 11). There are two lines. The **plan line** is realistic: about 40 per batch, reaching about 405 by batch 11, in line with the 350 to 400 the supply numbers in the design support. The **stretch line** is the plan for the 500 goal: about 50 per batch. Checkpoints (cumulative built-ins, merged), plan line / stretch line: batch 3 about 85 / 95 (Nov 13), batch 4 about 125 / 145 (Nov 15), batch 5 about 165 / 195 (Nov 17), batch 6 about 205 / 245 (Nov 19), batch 7 about 245 / 295 (Nov 21), batch 8 about 285 / 345 (Nov 23), batch 9 about 325 / 395 (Nov 25), batch 10 about 365 / 445 (Nov 28), batch 11 about 405 / 500 (Nov 30). The checkpoints are the plan for the goal, not commitments; the 500 goal is a stretch and the hard minimum of 300 is the commitment. The `CHECKPOINT` floors in the tests follow the plan line, never above the hard minimum. If the total at a checkpoint is more than 15% behind the plan line (for example under 106 at batch 4), say so in the session and in the batch PR, and follow the cut order in "If recipes fall behind" below. Being behind the stretch line alone is not a trigger.

**If recipes fall behind** (approved by the maintainer on #68): (1) keep going; run two batch PRs at once; (2) cut task 15 (recipe sharing), as `autonomy.md` already allows; (3) lower the goal but never the hard minimum: stop batching at the best count by Nov 30 and report the numbers on issue #7; (4) if the total is under 300 on Nov 25, open `Decision needed: recipe shortfall` with the stage by effort table and a recommendation. Never lower sourcing, safety screening or review rules to reach a count.

Branch names use the `v2/` prefix (for example `v2/6-paste-parser`) so they don't collide with v1 branches.

## Tasks

- [x] 1. Schema v2 and toddler stages
  - [x] 1.1 Add `Ingredient.optional`, `Recipe.statedMinutes`, `notes`, `imported`, `clearedMentions`, `kind`, `serveAs`, and `AppState.pantry`, `onHand`, `onHandUpdated`, `madeLog`, `onHandDays`, `dismissed` to `types.ts` and the zod schemas. Extend `StageId` with `12-23` and `24-36`. Set `SCHEMA_VERSION = 2` and add `MIGRATIONS[1]`.
    - _Requirements: 10.1, 10.2, 13.2, 14.4, 16.13, 17.11_
  - [x] 1.2 Strip `imported.text` and `clearedMentions` from the plan share payload. Tests: v1 state migrates, a v1 export imports, a v1 plan share link decodes.
    - _Requirements: 10.2, 10.4_
  - [x] 1.3 Update `stageFor`, `defaultSlots`, stage labels ("9–11 months" for `9-12`), the over-36 notice, and onboarding and Settings wording for 6 months to 3 years. Extend the built-in recipe invariant test to the new stages.
    - _Requirements: 13.1 – 13.4, 13.9_
  - [x] 1.3b Add the stage texture hints (Req 13.5) with a cited source each, confirmed against the source page (CDC pages returned 403 from the sandbox; the archived "Foods and Drinks to Encourage" page says "At first, foods may need to be soft and mashed or bite-sized." and gives no age-specific wording for 2–3 years). Add the source to `SOURCES` in `rules.ts` so the release-gate test covers it, and test the hints. Task 8.1 (the prompt helper, which uses the per-stage texture hints) consumes them first, and the recipe page display in task 12.1 also shows them. Req 13.5 stays listed in both 1.3b and 8.1 so the criterion is not lost.
    - _Requirements: 13.5_
  - [x] 1.4 Add `fromMonths` to `SafetyRule` and the `juice-limit` reminder (12 to 36 months, AAP-juice). Bump `RULESET_VERSION`. Tests per the design.
    - _Requirements: 13.6, 13.7_
  - [x] 1.5 Add reducer actions: set pantry, add/remove/clear on-hand, clear text mention. Export `foodKeyFromName` from `foods.ts`.
    - _Requirements: 2.2, 3.2, 7.4_

- [x] 2. Astryx trial
  - Ran before task 1 at the maintainer's request (November 8, 2026). Results are in PR #38. Size decision (issue #37): slimmed Astryx, native date picker, pages loaded on first open, budget +250 KB for the heaviest page.
  - [x] 2.1 Open `Decision needed: what to change in the UI`, asking for the primary user's specific complaints. Don't wait for the answer.
    - _Requirements: 15.8_
  - [x] 2.2 Record v1 build sizes. Upgrade to React 19 with all tests passing.
    - _Requirements: 15.2, 15.6_
  - [x] 2.3 Install pinned Astryx packages, add the FirstMenu theme with the v1 palette, self-host Figtree, and add `scripts/check-external.mjs` to CI.
    - _Requirements: 15.3, 15.4_
  - [x] 2.4 Convert the app shell, recipe library and Settings form. Check tests, `vitest-axe`, keyboard, 360 px and the size budget, and report the results in the PR. Update `tech.md`. If any check fails, open `Decision needed: Astryx trial` and continue with tasks 3–8.
    - _Requirements: 15.1, 15.5 – 15.7_

- [x] 3. Time and effort
  - [x] 3.1 Implement `domain/effort.ts` (`recipeMinutes`, `recipeEffort`) per the design, with tests from the built-in recipes' steps and the listed edge cases.
    - _Requirements: 4.1 – 4.4, 10.3_

- [ ] 4. Nutrition tags
  - [ ] 4.1 Confirm each tag's term list against CDC-iron, CDC-encourage and USDA-FNS-iron. Drop terms the sources don't support. Add the sources to the sources table. Six tags confirmed; healthy fat pending 4.3.
    - _Requirements: 5.2, 5.3_
  - [ ] 4.2 Implement `domain/nutrition.ts` with `NUTRITION_VERSION`, using the safety matcher. Tests: term format, sources, each tag fires, `except` cases, optional ingredients ignored. Six tags implemented; healthy fat pending 4.3.
    - _Requirements: 5.1, 5.3, 5.5, 5.6, 10.3_
  - [ ] 4.3 Follow-up for issue #50: find a sourced Healthy fat term list (an AAP, USDA MyPlate, WHO or CDC page, with a URL, that names fat-rich foods for babies and toddlers). Add the tag rule, the source to the sources table, and tests, then bump `NUTRITION_VERSION` and remove `healthy-fat` from `UNCONFIRMED_TAGS`. Tick 4.1, 4.2 and 4 when this lands.
    - _Requirements: 5.2_

- [x] 5. Grocery category guess
  - [x] 5.1 Implement `domain/category.ts` (`guessCategory`) with one test per category and the fallback.
    - _Requirements: 6.7_

- [x] 6. Paste parser and text-mention screen
  - [x] 6.1 Write paste fixtures: ChatGPT in the prompt format, ChatGPT free markdown, an Instagram caption with emoji and hashtags, a caption without headings, and a reply that mentions "no salt" in a step.
    - _Requirements: 6.3_
  - [x] 6.2 Implement `domain/importText.ts` (`parseRecipeText`) per the design, with tests for every fixture and parsing rule.
    - _Requirements: 6.2, 6.3, 6.6_
  - [x] 6.3 Implement `screenTextMentions` in `safety/screen.ts` and include text mentions in the ghost decision. Tests per the design.
    - _Requirements: 7.1 – 7.6_

- [x] 7. Matching
  - [x] 7.1 Implement `domain/make.ts` (`makeResults`, suggested chips) per the design, including younger-stage recipes for toddlers. Tests. The `tags` field on `MakeResult` (Req 3.8) and the Iron-rich filter (Req 3.9) landed with 7.3.
    - _Requirements: 3.3 – 3.9, 13.8_
  - [x] 7.2 Implement `data/foodNames.ts`, `data/searchPhrases.ts` and `domain/foodSearch.ts` (`buildVocabulary`, `searchHave`) per "Type what you have" in the design. Tests: every row of the worked-examples table in the design; separators and unseparated text; filler and request words; quantities; the single longest-match pass with ties going to foods ("sweet potato" vs "potato", "quick oats" vs "quick"); descriptor vs filter (step 4); other names and stop phrases ("bean curd" → tofu, "lemon curd" and "ladyfinger" → no food, listed under "Not recognized", "curd" → yogurt); typo distances and ties, and no typo match against stop phrases or dish-kind phrases; each dish-kind phrase ("something for breakfast", "finger food", "quick", "iron rich", "make ahead"); title words; unrecognized words; list checks (every target equals `groceryFoodKey({ name: target })`, no name mapped to two foods, no phrase that is also a food, plural-aware); descriptor adjacency ignoring only filler words ("mashed ripe banana", "quick cooked rice", "quick mashed banana"), with a request word keeping the phrase a filter ("eggs something quick"); stop phrases listed under "Not recognized".
    - _Requirements: 16.1 – 16.4, 16.7 – 16.11_
  - [x] 7.3 Add `serveAs` derivation for custom recipes and the filter logic, including "More ideas", to `make.ts`. Tests: derivation keywords, stage defaults when nothing matches, AND of filters, the "Iron-rich only" toggle and the "iron rich" phrase as one filter, "More ideas" ordering, cap and ghost exclusion, "More ideas" with only the toggle on, filters with no foods typed.
    - _Requirements: 3.8, 3.9, 16.9, 16.12, 16.13_

- [x] 8. Prompt helper logic
  - [x] 8.1 Implement `domain/prompt.ts` (`buildPrompt`) with per-stage texture hints. Tests: content, leave-out list at 10, 13 and 25 months, reaction foods, "toddler" wording at 12 months and over, no name or birth date, suggestion state absent from the prompt.
    - _Requirements: 8.2 – 8.5, 13.5_

  - [x] 8.2 Implement `domain/suggest.ts` per "Smart suggestions" in the design: `pickTryThis` with scoring and reasons, time-of-day meal hint, stale on-hand check, new-food-due check using `NEW_FOOD_SPACING_DAYS`, Make again list, pantry learning. Reducer actions: record made, record on-hand day, dismiss suggestion, keep on-hand. Tests with a fixed `now`: each score rule, ghosted recipes never picked, hint boundaries (10:29 vs 10:30), 4-hour hint dismissal, 24-hour dismissals, spacing at 2 and 3 days, a reaction record restarts the wait, no food recorded yet, Try this untried-food rules (two or more never; with a new food due, only the banner's food; with none due, only when it is the sole non-ghosted Ready now recipe, counted before filtering and dismissals: one-untried plus two-untried recipes gives no card, and dismissing the only fully tried recipe gives no card; "Has a new food: <food>" reason in both allowed cases; the day after a reaction, no untried-food pick while others exist; no allowed pick hides the card; with a new food due, the sole-recipe exception does not apply; while the new-food banner is dismissed a new food counts as not due), `isDismissed` for each row of the dismissal table, the new-food reason when no food is recorded, no meal hint from 21:00 to 04:59, made-log dedupe per day and cap, deleted recipe removed from the log, export/import round-trip, suggestion state absent from share payloads.
    - _Requirements: 17.1 – 17.6, 17.8, 17.9, 17.11_

- [x] 9. Navigation and Plan move (Astryx)
  - [x] 9.1 Move the week grid to `/plan` with a Week · Prep · Grocery · Share · Print sub-navigation. Main nav: Make, My recipes, Add recipe, Foods, Plan, Sources, Settings. Keep old routes working.
    - _Requirements: 1.2 – 1.4_

- [x] 10. Make screen (Astryx)
  - [x] 10.1 Build `ui/pages/Make.tsx` at `/`: pantry summary and editor (suggested list on first use), on-hand chips and suggested-food chips, Clear (the text box itself comes in 10.3), filters, Ready now, Missing one with "I have this", ghosted count with expand, empty state with the prompt helper. Add pantry editing to Settings.
    - _Requirements: 1.1, 2.1 – 2.4, 3.1 – 3.10_
  - [x] 10.2 Component tests: groups render, "I have this" moves a recipe to Ready now, ghosted recipes are excluded.
    - _Requirements: 3.4, 3.5_
  - [x] 10.3 Add the "What do you have?" search box to the Make screen: live chips and results while typing, "Did you mean" chips, "Not recognized" list, "Recipes named …" group, removable filter chips, "More ideas", Enter or "Add" to keep. Add "Serve as" with editing to the recipe page for custom recipes. Component tests: typing "leftover chicken, rice and peas" shows three chips and updates results; a typo needs a tap before it counts; Enter moves foods to on-hand; "something for breakfast" alone shows breakfast recipes including "More ideas"; "finger food" filters to finger-food recipes; typing "iron rich" turns on the "Iron-rich only" toggle and removing the chip turns it off; a custom recipe with a guessed form shows "(guessed)" and can be edited.
    - _Requirements: 3.9, 16.5 – 16.9, 16.12, 16.13_

  - [x] 10.4 Add the suggestions to the Make screen in the order in the design: suggested meal chip (with the search filter chips), Try this card (the screen's one primary button when shown, with "Show another" and "Why this?"), new-food suggestion, stale on-hand prompt, pantry suggestion, Make again row; at most two banners at once; every suggestion dismissible. Replace Layout's `addRecipeVariant` with `PrimaryActionProvider` / `usePagePrimaryAction` per the design, and move Settings, Print and edit pages onto it. Component tests: Try this opens the right recipe; dismissing hides it; the meal chip doesn't filter results until tapped and doesn't come back within 4 hours after ✕; each suggestion shows its reason; exactly one filled primary button on Make, Settings, Print, edit and Add recipe; with no allowed Try this pick the card is hidden and the shell's "Add recipe" is primary; rewrite the trial's pathname-based Layout tests so placeholder pages report through `usePagePrimaryAction`; all suggestion buttons are secondary.
    - _Requirements: 17.1 – 17.6, 17.8 – 17.10_

- [x] 11. Add recipe and prompt helper (Astryx) (11.5 to 11.7 added November 10, 2026)
  - [x] 11.1 Build `ui/pages/AddRecipe.tsx` at `/add`: source picker and link, paste box, preview with line editing and moving, "mark lines as ingredients" mode, safety results with text mentions and "Not used in this recipe", Save. Link to the typed editor. Include the Instagram and screenshot help text and the fixed-list disclaimer.
    - _Requirements: 6.1, 6.4 – 6.11, 7.3 – 7.5, 11.2_
  - [x] 11.2 Build the prompt helper UI on Make and Add recipe: copy, open ChatGPT, "Paste the answer", notice.
    - _Requirements: 8.1, 8.6 – 8.9_
  - [x] 11.3 Component tests: paste → preview → save with no typing; a text mention ghosts and "Not used" clears it.
    - _Requirements: 6.4, 7.3, 7.4_
  - [x] 11.4 Add the primary "Paste" button to Add recipe (clipboard read only on tap, fallback message when not allowed); "Read recipe" secondary; during a preview "Save recipe" is the only primary button and "Paste" is hidden; the shell's "Add recipe" is hidden on `/add`. Component tests with a mocked clipboard: success fills and reads the recipe; rejection shows the fallback; one filled primary button before and during a preview.
    - _Requirements: 17.7, 17.10_
  - [x] 11.5 Recipe JSON format and strict parser (domain only, no UI). Add `src/domain/recipeJson.ts` (`parseRecipeReply`, the template constant, zod schema) and extend `src/domain/prompt.ts` with `buildWrappedPrompt`, `buildReelPrompt`, `buildFixupPrompt` (keep `leaveOutFor`, `PROMPT_NOTICE`; remove the old free-text reply format from the prompt). Fixtures in `src/domain/__fixtures__/json/` (valid, fenced with prose, broken, wrong version, quantity "1/2", unknown keys, `unit` with a blocked food, error object). Tests per the design, including that JSON and equivalent text give the same safety result and that the template's own example parses.
    - _Requirements: 18.2, 18.4 – 18.6, 18.8 – 18.11, 19.3, 19.4, 8.2 – 8.5_
  - [x] 11.6 Ask ChatGPT question flow and Add recipe JSON intake. Question box (pre-filled from on-hand foods), copy, Open ChatGPT, "Paste the answer"; Add recipe calls `parseRecipeReply` with the invalid, no-JSON fallback and fix-up states; extras notice; raw reply kept as original text. Update `AskChatGpt.tsx` and `AddRecipe.tsx`, and the Make empty state. Component tests per the design, a spy that no network API is called, `npm run check:external`, `vitest-axe`, size report.
    - _Requirements: 18.1 – 18.12, 6.1, 8.1, 8.6 – 8.9, 17.10_
  - [x] 11.7 Instagram reel prompt flow. Reel URL box with validation, `buildReelPrompt`, copy, Open Meta AI, error-object handling, source preset to Instagram, URL saved only as `link`; reword the Instagram help text. Component tests: URL validation, no child data in the prompt, no fetch.
    - _Requirements: 19.1 – 19.8, 6.9, 6.10_

- [x] 12. Recipe page and library
  - [x] 12.1 Add time, effort, nutrition tags with the explainer, "Original text", cleared mentions, "Simple idea" label and "Add to plan" to the recipe page. Show time, effort and tags in the library, plus a "From ChatGPT / Instagram" badge. Add stated time to the typed editor. Add nutrition lists and sources to the Sources page, plus a "New food spacing" entry citing `NEW_FOOD_SPACING_SOURCES`, with a Sources page test that the entry lists every spacing source with its URL.
    - _Requirements: 1.5, 4.5, 4.6, 5.4, 6.8, 7.4, 11.2, 11.3, 14.4, 17.4_
  - [x] 12.2 Add a secondary "I made this" button to the recipe page (records today once per day, confirms with a short status message). Component test: one filled primary button on the recipe page.
    - _Requirements: 17.5, 17.10_

- [x] 13. Convert remaining pages to Astryx
  - [x] 13.1 Convert Foods, recipe page, typed editor, Prep, Grocery, Share, Sources and Onboarding. Keep print CSS. Apply any UI feedback received under task 2.1 (the November 10 feedback, that the UI is clean but daunting to new users, is handled by task 18). Re-run `vitest-axe` on every page.
    - _Requirements: 15.1, 15.5, 15.8_

- [ ] 14. More built-in recipes (starts after task 1, runs in batches alongside tasks 2–13)
  - [x] 14.1 Move built-in recipe data into its own build chunk and report its gzipped size. Ships in the batch 1 PR, before any recipes are added, so every batch PR can report the chunk size.
    - _Requirements: 15.6_
  - [x] 14.2 Batch 1: re-tag the 10 Minnesota WIC recipes for toddler stages where the texture fits, set `serveAs` on them, and add simple ideas from WIC and USDA feeding guides to `data/simpleIdeas.ts` (at most 25 in total at the time; the cap is now 40, Requirement 14.1).
    - _Requirements: 13.2, 14.2, 14.4, 14.5, 14.8, 16.13_
  - [ ] 14.3 Batches 3 to 11, about 50 recipes per PR (branch `v2/14-recipes-batch-<n>`, data in `src/data/recipesBatch<n>.ts`): add Food Hero and ICN Child Nutrition Recipe Box recipes and recipes from other publishers that meet the recipe source criteria (new publishers go through pr-reviewer and into `docs/recipe-sources.md`), following the expansion rules in the design, with `serveAs` set on each. Fill the biggest gaps in the stage by effort table first (scarce cells in `6-8` and `9-12`, then missing allergen minimums, then `12-23`, then `24-36`). Change the existing `SIMPLE_IDEAS.length <= 25` assertion in `recipes.test.ts` (near line 229, in the test that ships the WIC recipes, simple ideas and batch 2 recipes) to the new cap of 40. Batch 3 also adds the `recipes.test.ts` count table with `HARD_MINIMUM`, `GOAL` and `CHECKPOINT`, the recipe-data size warning (160 KB gzipped) and failure (200 KB gzipped) in `scripts/size-report.mjs`, and the `makeResults` derived-value cache with its timing test (design "Bundle size and speed with 500 recipes"). Each batch PR body pastes the count table, the recipe-data gzipped size and the duplicate check. Open a `Recipe review: batch <n>` issue for each batch. Batch 6 checks first-load speed and decides on lazy-loading the data chunk.
    - _Requirements: 14.2, 14.3, 14.5, 14.8, 14.9, 16.13_
  - [ ] 14.4 Ships with the final batch PR. Set `CHECKPOINT = HARD_MINIMUM` in the invariant tests (Requirement 14.1 and 14.6 tables, where the `6-8` More minimum is 0, approved by the maintainer on #68: total, simple ideas, each stage, each stage by effort, each allergen group). If short of any hard minimum, open `Decision needed: recipe shortfall` with the numbers and don't ship short without an answer. Comment on issue #7 with the final numbers.
    - _Requirements: 14.1, 14.6, 14.7_

- [ ] 15. Share a recipe (first to cut)
  - [ ] 15.1 Implement `domain/recipeShare.ts` (payload, encode, decode, share text), with tests that the payload and text carry no child data or pasted text.
    - _Requirements: 9.3, 9.5_
  - [ ] 15.2 Add "Share recipe" (share sheet or copy) and the read-only `#/r/<data>` view with "Add to my recipes", which screens as a pasted recipe.
    - _Requirements: 9.1, 9.2, 9.4, 9.6, 9.7_

- [ ] 16. Verify
  - [ ] 16.1 Real-world checks of the JSON flows (replaces asking for real pastes, November 10, 2026). Run the wrapped prompt in ChatGPT and the reel prompt in Meta AI (or another AI chat app) as the maintainer or a tester, for at least three different questions and two reels. Save the replies with personal details removed as extra JSON fixtures, record how often the reply parsed on the first try, and fix prompt or parser gaps. Anything that needs an account or a paid service is reported to the maintainer, not worked around. Also keep the existing free-text fixtures as the fallback tests.
    - _Requirements: 18.4 – 18.7, 19.7, 12.2_
  - [ ] 16.2 Carried over from v1: manual iOS VoiceOver and 360 px pass (v1 task 16.1), then deploy and check end to end on a phone with a baby profile and a toddler profile, including a real ChatGPT JSON reply, a reel prompt run in an AI chat app, and the onboarding (v1 task 17.1). Also do the real-browser 360 px and keyboard checks (jsdom cannot cover them) on the pages converted in task 13: Foods, recipe page, typed editor (recipe editor), Prep, Grocery, Share, Sources, Onboarding (the problems screen, each quick solve, the end screen and `/onboarding/tour`), Add recipe, Print (check the print preview still hides the button) and the Disclaimer button.
    - _Requirements: 11.1, 12.2, 13.1_

- [ ] 17. Deliverables
  - [ ] 17.1 Update `README.md`, `docs/kiro-usage.md` (including how this spec changed the v1 plan after user feedback) and the demo script for the new flow, under 3 minutes: onboarding, the JSON prompt flow, the reel prompt flow, the safety catch.
    - _Requirements: 12.1_
  - [ ] 17.2 Carried over from v1 task 18.4: the maintainer records the video, uploads it to YouTube, and submits by Thursday, December 3.
    - _Requirements: 12.1_

- [x] 18. Problem-first onboarding (added November 10, 2026; after task 13, part of M3)
  - [x] 18.1 Slim the profile step and add the problems screen: collapse the tried-foods checklist into "Foods already tried (optional)" in `src/ui/pages/Onboarding.tsx`; add the problems screen (five chips, "Show me", "Skip") and the done screen. Lazy-load the new components. Tests: skip lands on Make; previously onboarded users never see the screens; no stored field added.
    - _Requirements: 20.1, 20.2, 20.5, 20.6, 20.7, 20.8_
  - [x] 18.2 Quick solves: What can I make (reuse the Make search box), Save recipes (question and reel boxes, "Try an example" with a bundled sample reply, no save), Plan and grocery (draft week, grocery list, keep or discard), What's safe (leave-out list for the child's age with sources, plus a free-text food check with the existing `SCREEN_LIMITS` and `NOT_MEDICAL_ADVICE` disclaimers; when no rule fires it shows exactly "FirstMenu's list has no rule for {food} at this age.", approved by the maintainer on #65). Tests assert the disclaimers show, the exact sentence shows when no rule fires, and no "safe", "OK" or green state appears. Tests per solve, a11y, one primary button per step, 360 px, size report.
    - _Requirements: 20.3, 20.4, 20.8, 20.9_
  - [x] 18.3 Add "Quick tour" to Settings and the new `/onboarding/tour` route (problems step onward; `OnboardingGate` unchanged). Test it, including that a not-yet-onboarded user is redirected to `/onboarding`.
    - _Requirements: 20.7, 20.10_
