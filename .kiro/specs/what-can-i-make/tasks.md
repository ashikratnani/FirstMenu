# Implementation Plan: What can I make?

**Status: DRAFT, awaiting maintainer approval.** Do not start these tasks until the maintainer approves this spec and this line reads "Status: APPROVED".

Deadline: Friday, December 4, 2026, 2:00 PM PT. Target submission: Thursday, December 3.

| Milestone | Dates | Tasks | Done when |
| --- | --- | --- | --- |
| M1 Domain | Nov 9 – Nov 14 | 1 – 6 | Schema v2, time and effort, nutrition tags, categories, parser, text mentions, matching and prompt all pass tests. No UI change yet. |
| M2 Screens | Nov 15 – Nov 21 | 7 – 9 | Make is the home screen; paste → preview → save works on a phone; prompt helper works. |
| M3 Sharing and polish | Nov 22 – Nov 28 | 10 – 11 | Recipe sharing (if approved), recipe page additions, a11y re-run. Thanksgiving week, so this milestone is lighter. |
| M4 Verify and submit | Nov 29 – Dec 3 | 12 – 13 | Real pastes tested, docs and demo updated, submitted. |

Branch names for this spec use the `v2/` prefix (for example `v2/3-nutrition-tags`) so they don't collide with v1 branches.

## Tasks

- [ ] 1. Schema v2
  - [ ] 1.1 Add `Ingredient.optional`, `Recipe.statedMinutes`, `notes`, `imported`, `clearedMentions`, and `AppState.pantry`, `onHand` to `types.ts` and the zod schemas in `storage.ts`. Set `SCHEMA_VERSION = 2` and add `MIGRATIONS[1]`.
    - _Requirements: 10.1, 10.2_
  - [ ] 1.2 Strip `imported.text` and `clearedMentions` from the plan share payload. Tests: v1 state migrates, a v1 export imports, a v1 plan share link decodes.
    - _Requirements: 10.2, 10.4_
  - [ ] 1.3 Add reducer actions: set pantry, add/remove/clear on-hand, clear text mention. Export `foodKeyFromName` from `foods.ts`.
    - _Requirements: 2.2, 3.2, 7.4_

- [ ] 2. Time and effort
  - [ ] 2.1 Implement `domain/effort.ts` (`recipeMinutes`, `recipeEffort`) per the design, with tests from the built-in recipes' steps and the edge cases listed.
    - _Requirements: 4.1 – 4.4, 10.3_

- [ ] 3. Nutrition tags
  - [ ] 3.1 Confirm each tag's term list against CDC-iron, CDC-encourage and USDA-FNS-iron. Drop terms the sources don't support. Record the sources in the sources table.
    - _Requirements: 5.2, 5.3_
  - [ ] 3.2 Implement `domain/nutrition.ts` with `NUTRITION_VERSION`, using the safety matcher. Tests: term format, sources, each tag fires, `except` cases, optional ingredients ignored.
    - _Requirements: 5.1, 5.3, 5.5, 5.6, 10.3_

- [ ] 4. Grocery category guess
  - [ ] 4.1 Implement `domain/category.ts` (`guessCategory`) with one test per category and the fallback.
    - _Requirements: 6.7_

- [ ] 5. Paste parser and text-mention screen
  - [ ] 5.1 Write paste fixtures (ChatGPT in prompt format, ChatGPT free markdown, Instagram caption with emoji and hashtags, caption without headings, reply that mentions "no salt" in a step).
    - _Requirements: 6.3_
  - [ ] 5.2 Implement `domain/importText.ts` (`parseRecipeText`) per the design, with tests for every fixture and each parsing rule.
    - _Requirements: 6.2, 6.3, 6.6_
  - [ ] 5.3 Implement `screenTextMentions` in `safety/screen.ts` and include text mentions in the ghost decision. Update `.kiro/steering/safety-rules.md` with the pasted-recipe exception. Tests per the design.
    - _Requirements: 7.1 – 7.6_

- [ ] 6. Matching and prompt
  - [ ] 6.1 Implement `domain/make.ts` (`makeResults`, suggested chips) per the design, with tests.
    - _Requirements: 3.3 – 3.9_
  - [ ] 6.2 Implement `domain/prompt.ts` (`buildPrompt`) with tests for content, leave-out list at 10 and 13 months, reaction foods, and no name or birth date.
    - _Requirements: 8.2 – 8.5_

- [ ] 7. Navigation and Plan move
  - [ ] 7.1 Move the week grid to `/plan` with a Week · Prep · Grocery · Share · Print sub-navigation. Update the main nav to Make, My recipes, Add recipe, Foods, Plan, Sources, Settings. Keep old routes working.
    - _Requirements: 1.2 – 1.4_

- [ ] 8. Make screen
  - [ ] 8.1 Build `ui/pages/Make.tsx` at `/`: pantry summary and editor (with the suggested list on first use), on-hand chips and text entry, Clear, filters, Ready now, Missing one with "I have this", ghosted count with expand, empty state with the prompt helper. Add pantry editing to Settings.
    - _Requirements: 1.1, 2.1 – 2.4, 3.1 – 3.10_
  - [ ] 8.2 Component tests: groups render, "I have this" moves a recipe to Ready now, ghosted recipes are excluded.
    - _Requirements: 3.4, 3.5_

- [ ] 9. Add recipe and prompt helper
  - [ ] 9.1 Build `ui/pages/AddRecipe.tsx` at `/add`: source picker and link, paste box, preview with line editing and moving, "mark lines as ingredients" mode, safety results with text mentions and "Not used in this recipe", Save. Link to the typed editor. Include the Instagram and screenshot help text and the fixed-list disclaimer.
    - _Requirements: 6.1, 6.4 – 6.11, 7.3 – 7.5, 11.2_
  - [ ] 9.2 Build the prompt helper on Make and Add recipe: copy, open ChatGPT, "Paste the answer", notice.
    - _Requirements: 8.1, 8.6 – 8.9_
  - [ ] 9.3 Component tests: paste → preview → save with no typing; a text mention ghosts and "Not used" clears it.
    - _Requirements: 6.4, 7.3, 7.4_

- [ ] 10. Recipe page and library
  - [ ] 10.1 Add time, effort, nutrition tags with the explainer, "Original text", cleared mentions, and "Add to plan" to the recipe page. Show time, effort and tags in the library and a "From ChatGPT / Instagram" badge. Add stated time to the typed editor. Add nutrition lists and sources to the Sources page.
    - _Requirements: 1.5, 4.5, 4.6, 5.4, 6.8, 7.4, 11.3_

- [ ] 11. Share a recipe (only if Requirement 9 is approved; otherwise tick as skipped)
  - [ ] 11.1 Implement `domain/recipeShare.ts` (payload, encode, decode, share text) with tests that the payload and text carry no child data or pasted text.
    - _Requirements: 9.3, 9.5_
  - [ ] 11.2 Add "Share recipe" (share sheet or copy) and the read-only `#/r/<data>` view with "Add to my recipes", which screens as a pasted recipe.
    - _Requirements: 9.1, 9.2, 9.4, 9.6, 9.7_

- [ ] 12. Verify
  - [ ] 12.1 Run `vitest-axe` on Make and Add recipe and fix issues.
    - _Requirements: 11.1_
  - [ ] 12.2 Ask the maintainer for 2–3 real pastes (ChatGPT replies and Instagram captions) via a `Decision needed: real paste samples` issue. Add them as fixtures (with any personal details removed) and fix parser gaps. Don't wait for them to continue other tasks.
    - _Requirements: 6.3, 12.2_
  - [ ] 12.3 Carry over from v1: manual iOS VoiceOver and 360 px pass (v1 task 16.1), then deploy and check end to end on a phone, including a real paste (v1 task 17.1).
    - _Requirements: 12.2_

- [ ] 13. Deliverables
  - [ ] 13.1 Update `README.md`, `docs/kiro-usage.md` (including how this spec changed the v1 plan after user feedback) and the demo script for the new flow, under 3 minutes.
    - _Requirements: 12.1_
  - [ ] 13.2 Carry over from v1 task 18.4: maintainer records the video, uploads it to YouTube, and submits by Thursday, December 3.
    - _Requirements: 12.1_
