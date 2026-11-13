# Requirements Document: What can I make?

## Introduction

FirstMenu v1 (spec: `.kiro/specs/first-menu/`) is built and live. It plans a week of baby meals. After using it, the primary user (the parent who plans meals for our 10-month-old) said a weekly plan isn't what she needs day to day. Her real problems are:

1. "I have a few ingredients and the usual things around the house. What can I make, and what's quickest and easiest?"
2. Typing recipes in by hand takes too long.
3. Her recipes come from Instagram reels and ChatGPT.
4. She cares about nutrition in what she makes.

In a second review the maintainer also asked for more built-in recipes, support for toddlers (up to 3 years), and a new UI built on Meta's Astryx design system.

Maintainer changes of November 10, 2026 (approved in session): recipes now arrive through a JSON prompt flow instead of unstructured pastes (Requirements 18 and 19), and a short problem-first onboarding helps new users (Requirement 20). Free-text pasting stays as a fallback.

Maintainer changes of November 13, 2026 (approved in session): food pictures, a plate of main foods on every recipe card, new theme art and Fredoka headings (Requirement 21).

This spec changes FirstMenu's focus to answer those. The safety screen, ghosted foods, first tastes, built-in recipes, local storage and disclaimers from v1 stay. The v1 theme stays except for its pictures, which Requirement 21 replaces. The week plan, prep list, grocery list, print view and plan share link stay as secondary features with no new work beyond what's listed here.

Constraints carried over from v1: no backend, no account, no network requests other than the app's own files, React + TypeScript + Vite on GitHub Pages, MIT license. Deadline: Friday, December 4, 2026, 2:00 PM PT (submission planned Thursday, December 3).

Where this spec conflicts with the v1 spec, this spec wins. Requirements in v1 not mentioned here are unchanged.

## Glossary

Terms from the v1 glossary keep their meaning. New terms:

- **Pantry**: foods the user usually has at home, set once and kept.
- **On hand**: foods the user has today in addition to the pantry, picked each time.
- **Have**: the pantry plus the on-hand foods.
- **Ready now**: a recipe whose every required ingredient is covered by what the user has.
- **Missing one**: a recipe with exactly one required ingredient not covered.
- **Required ingredient**: an ingredient that is not optional and is not an ignored food (water, breast milk, formula, ice).
- **Pasted recipe**: a custom recipe created by pasting text (from ChatGPT, an Instagram caption or elsewhere).
- **Stated time**: a total time written in the recipe text. **Estimated time**: a time the app computes from durations in the steps.
- **Effort**: Easy, Medium or More, computed from the recipe.
- **Nutrition tag**: a food-group label (Iron-rich, Protein, Vegetable, Fruit, Whole grain, Dairy, Healthy fat) shown when a recipe contains a food from that group.
- **Recipe JSON**: the fixed JSON format (`firstmenu_recipe` version 1) defined in the design that the app asks an AI chat app to reply in, and that the app parses strictly.
- **Question**: the text the user types for ChatGPT (for example "a quick lunch with eggs and rice").
- **Wrapped prompt**: the question plus the app's age, safety and output-format context, ready to copy.
- **Reel prompt**: a prompt built from an Instagram reel URL that asks an AI chat app to extract the recipe as Recipe JSON.
- **Problem choices**: the short list of things a new user says they want help with during onboarding.
- **Prompt helper**: the feature that writes a ChatGPT prompt for the user to copy.
- **Text mention**: a block-rule food found in a pasted recipe's title, steps or notes rather than its ingredient list.
- **Stages**: `6–8 months`, `9–11 months` (id `9-12`, kept from v1), `12–23 months` and `24–36 months`. The last two are the **toddler stages**.
- **Simple idea**: a built-in single-food or two-food preparation taken from a public health feeding guide, with no exact amounts ("ripe banana, mashed").
- **Astryx**: Meta's open source React design system (`@astryxdesign/core`, MIT license).
- **Food picture**: the picture of one food, from Microsoft Fluent Emoji in the 3D style (MIT license), shipped with the app (Requirement 21).
- **Food group**: the one group a food belongs to for pictures and colors: vegetable, fruit, grain, protein, dairy, pantry or other. A food can have several nutrition tags but has exactly one food group.
- **Group picture**: the picture shown for a food that has no food picture of its own, and on a Foods tile in place of a choking-shape picture (a whole round or tube-shaped food, or a food with no safe form) whose food no Requirement 21.6 rule matches. It shows no food: an empty jar for the pantry group, and an empty bowl, the **generic bowl**, for every other group. A food the picture map does not list shows the generic bowl.
- **Main foods**: a recipe's foods in ingredient order, leaving out optional ingredients, ignored foods and staples such as oil, salt and spices (rules in the design).
- **Plate**: the round picture on a recipe card and at the top of a recipe page that shows up to 3 of the recipe's main foods.
- **Not yet**: the visible name of a ghosted food or recipe (v1 glossary "Ghost / ghosted"), shown with the hourglass where pictures are shown.
- **Peekaboo monster**: the picture for a food the child has not tried yet. It replaces the mystery door picture; the state keeps the name `door` in code.

## Requirements

### Requirement 1: Home screen and navigation

**User Story:** As a parent, I want the app to open on "What can I make?", so that the thing I use every day is one tap away.

#### Acceptance Criteria

1. WHEN an onboarded user opens the app THEN the app SHALL show the "What can I make?" screen at `/`.
2. THE main navigation SHALL list, in order: Make, My recipes, Add recipe, Foods, Plan, Sources, Settings.
3. THE Plan item SHALL open the week plan, with links from there to the prep list, grocery list, print view and plan share link.
4. EXISTING links to `/prep`, `/grocery`, `/share`, `/print` and `/shared/...` SHALL keep working.
5. EVERY recipe page SHALL keep an "Add to plan" action that adds the recipe to a chosen plan slot.

### Requirement 2: Pantry

**User Story:** As a parent, I want to tell the app once what I usually have at home, so that I only pick the few extra things each time.

#### Acceptance Criteria

1. THE app SHALL let the user set pantry foods from a suggested list and by typing any food name.
2. THE pantry SHALL persist on the device until the user changes it.
3. THE user SHALL be able to edit the pantry from the Make screen and from Settings.
4. ON first use of the Make screen with an empty pantry, THE app SHALL offer the suggested list and SHALL let the user skip it.

### Requirement 3: What can I make?

**User Story:** As a parent, I want to tap what I have and see what I can cook, quickest and easiest first, so that I can decide in a minute.

#### Acceptance Criteria

1. THE Make screen SHALL let the user pick on-hand foods by tapping suggested foods or by typing in the search box from Requirement 16. There is one text box, not two.
2. THE on-hand list SHALL persist until the user clears it, and SHALL have a one-tap "Clear" action.
3. THE app SHALL match foods by the same food keys used for first tastes and grocery merging, so that "2 cups diced sweet potatoes" counts as "sweet potato".
4. THE Make screen SHALL show a "Ready now" group and a "Missing one" group. Each "Missing one" recipe SHALL name the missing food and offer "I have this", which adds it to on-hand.
5. RECIPES that are ghosted for the child SHALL NOT appear in either group. THE screen SHALL show how many were left out and SHALL let the user expand them as ghosts with their reasons.
6. BY default THE screen SHALL show recipes tagged for the child's stage. A filter SHALL show all stages.
7. WITHIN each group, recipes SHALL be sorted by time (shortest first), then effort (Easy first), then title.
8. EACH result SHALL show title, time (marked "about" when estimated), effort, nutrition tags, and mystery-door badges for untried foods.
9. THE screen SHALL offer an "Iron-rich only" filter.
10. IF no recipe is ready now or missing one THEN the screen SHALL say so and offer the prompt helper.

### Requirement 4: Time and effort

**User Story:** As a parent, I want to see how long a recipe takes and how much work it is, so that I can pick something quick.

#### Acceptance Criteria

1. A recipe MAY have a stated total time in minutes.
2. IF a recipe has no stated time THEN the app SHALL estimate one from durations in its steps, using the rules in the design, and SHALL label it as an estimate.
3. IF neither is possible THEN the app SHALL show "Time not given" and SHALL sort the recipe after recipes with times.
4. THE app SHALL compute effort (Easy, Medium, More) from the number of required ingredients, the number of steps and whether the oven is used, using the rules in the design.
5. TIME and effort SHALL be shown on result cards, recipe pages and the library.
6. THE user SHALL be able to set or change the stated time on any custom recipe.

### Requirement 5: Nutrition tags

**User Story:** As a parent, I want to see which food groups a recipe gives my baby, especially iron, so that I can choose more nourishing meals.

#### Acceptance Criteria

1. THE app SHALL tag each recipe with the nutrition tags whose food lists match at least one of its required ingredient names.
2. THE tags SHALL be Iron-rich, Protein, Vegetable, Fruit, Whole grain, Dairy and Healthy fat.
3. EACH tag's food list SHALL be fixed in source code, matched with the safety screen's matcher, and SHALL cite at least one published source (CDC, USDA, AAP or WHO) shown on the Sources page.
4. THE app SHALL say, wherever tags are explained, that tags show which food groups are in a recipe and not how much of a nutrient it provides.
5. THE app SHALL NOT show nutrient amounts, calories or portion targets.
6. TAGS SHALL work on built-in, typed and pasted recipes with no extra input.

### Requirement 6: Add a recipe by pasting

**User Story:** As a parent, I want to paste a recipe from ChatGPT or an Instagram caption and save it in a couple of taps, so that I never have to type a recipe in.

#### Acceptance Criteria

1. THE Add recipe screen SHALL have one large text box for pasting and a "Read recipe" button. The box accepts Recipe JSON (Requirement 18) or plain text; plain text uses the free-text parser as a fallback.
2. THE app SHALL parse the text in the browser (Recipe JSON strictly, plain text with the free-text parser), with no network request, into a title, ingredients (quantity, unit, name, optional flag), steps, stated time, servings and notes.
3. THE free-text parser (the fallback) SHALL handle ChatGPT-style text (headings, markdown bold and headers, bullets and numbered lists) and Instagram-style captions (emoji, hashtags, @mentions, "save this" lines, inline lists).
4. AFTER parsing, THE app SHALL show a preview with the safety screen results, time, effort and nutrition tags. The user SHALL be able to save without typing anything.
5. IN the preview, THE user SHALL be able to fix the title, delete or edit any ingredient or step line, and move a line between ingredients, steps and notes.
6. IF the parser finds no ingredients THEN the app SHALL say so and let the user mark which lines are ingredients.
7. A pasted recipe SHALL get, without asking: the child's current stage, all four meal types, a grocery category for each ingredient from the keyword table in the design, and a texture note for the stage.
8. THE app SHALL keep the original pasted text with the recipe and show it on the recipe page under "Original text".
9. THE user MAY record where the recipe came from (ChatGPT, Instagram, Other) and an optional link. The app SHALL NOT fetch that link.
10. THE Add recipe screen SHALL explain that the app can't open Instagram reels, and that the user can copy the caption, or on a phone copy text from a screenshot.
11. THE existing typed recipe editor SHALL remain available from Add recipe.

### Requirement 7: Safety screen for pasted recipes

**User Story:** As a parent, I want pasted recipes checked even when an unsafe food is only mentioned in the steps, so that "add a pinch of salt" doesn't slip through.

#### Acceptance Criteria

1. PASTED recipes SHALL be screened like every other recipe: all rules against ingredient names (v1 Requirement 4).
2. IN addition, THE app SHALL check a pasted recipe's title, steps and notes against the block rules only. This is the only exception to v1 Requirement 4.1.
3. A text mention SHALL ghost the recipe, and SHALL show the sentence where the food was found.
4. FOR a text mention only, THE user SHALL be able to tap "Not used in this recipe" to clear it. The app SHALL record this on the recipe and show it on the recipe page.
5. A block finding from the ingredient list SHALL NOT be clearable this way. The user can delete the ingredient line instead.
6. WHEN a pasted recipe's text changes THEN the app SHALL re-check it, and cleared text mentions whose sentence changed SHALL apply again.

### Requirement 8: ChatGPT prompt helper

**User Story:** As a parent, I want the app to write the ChatGPT question for me, so that I get a safe, quick recipe in a format the app can read.

#### Acceptance Criteria

1. THE Make screen and the Add recipe screen SHALL offer "Ask ChatGPT", which opens the question box of Requirement 18.
2. THE app SHALL build a prompt containing: the child's age in months, a texture hint for the stage, the foods to leave out, and the Recipe JSON reply format from the design, wrapped around the user's question (Requirement 18). The on-hand foods and the request for something quick and easy (iron-rich if possible) are not added by the prompt builder: they appear only in the editable pre-filled question of Requirement 18.1, so the user sees and controls them.
3. THE foods to leave out SHALL be the labels of the block rules that apply at the child's age, plus foods with a recorded reaction.
4. THE prompt SHALL ask ChatGPT not to mention the left-out foods anywhere in its reply.
5. THE app SHALL NOT include the child's name or birth date in the prompt.
6. THE user SHALL be able to copy the prompt with one tap and open ChatGPT in a new tab with one tap.
7. AFTER copying, THE app SHALL show a "Paste the answer" step that leads to the Add recipe screen.
8. THE app SHALL NOT call any AI service itself.
9. THE helper SHALL state that AI recipes can be wrong, that the app checks them against its fixed list, and to check with a pediatrician.

### Requirement 9: Share a recipe (approved; first to cut if time runs short)

**User Story:** As a parent, I want to send a recipe to friends or other parents from my phone, so that I can pass on what worked.

#### Acceptance Criteria

1. EVERY recipe page SHALL have a "Share recipe" action.
2. ON devices that support the system share sheet, THE app SHALL open it with the recipe as text and a link. Otherwise THE app SHALL copy the text and link.
3. THE shared text SHALL include title, ingredients, steps, prep reminders, the source (for built-in recipes) and the line "Shared from FirstMenu. Not medical advice; check with your pediatrician."
4. THE link SHALL open a read-only view of the recipe in FirstMenu, with the data in the URL fragment, and an "Add to my recipes" action.
5. THE shared text and link SHALL NOT include the child's name, birth date, age, food records or the original pasted text.
6. WHEN a recipe is added from a link THEN the app SHALL screen it for the recipient's child like a pasted recipe.
7. THE plan share link (v1 Requirement 11) SHALL stay as is with no new work.

### Requirement 10: Data and migration

**User Story:** As a parent, I want my existing recipes and food records kept when the app updates, so that I don't lose anything.

#### Acceptance Criteria

1. THE stored data SHALL move to schema version 2, adding pantry, on-hand foods and the new optional recipe fields.
2. VERSION 1 data SHALL migrate on load with no loss, and existing exports SHALL still import.
3. TIME estimates, effort, nutrition tags and match results SHALL be computed, not stored.
4. PLAN share links made before this change SHALL still open.

### Requirement 11: Disclaimers and sources

**User Story:** As a parent, I want the app to be clear about what it can and can't check, so that I know when to ask our pediatrician.

#### Acceptance Criteria

1. THE v1 disclaimers SHALL stay (v1 Requirement 13).
2. THE Add recipe preview and pasted recipe pages SHALL state that the safety screen checks against a fixed list and can miss foods, amounts and preparations.
3. THE Sources page SHALL list the nutrition tag food lists and their sources.

### Requirement 12: Delivery

**User Story:** As the maintainer, I want the submission to show the new flow, so that judges see what the app is for now.

#### Acceptance Criteria

1. THE README, `docs/kiro-usage.md` and the demo script SHALL describe the new flow: pantry, on hand, ready-now results, the ChatGPT and Instagram JSON prompt flows, safety catch, nutrition tags, onboarding.
2. THE deployed app SHALL be checked end to end on a phone before submission, including a real ChatGPT reply in Recipe JSON, a real reel prompt run in Meta AI or another AI chat app, and the onboarding on a phone.

### Requirement 13: Toddler support

**User Story:** As a parent of a toddler, I want the app to keep working after my child's first birthday, so that I don't have to switch apps.

#### Acceptance Criteria

1. THE app SHALL support children from 6 to 36 months old.
2. THE app SHALL map ages to stages: under 9 months `6–8 months`; 9 to 11 months `9–11 months`; 12 to 23 months `12–23 months`; 24 months and over `24–36 months`.
3. IF the child is older than 36 months THEN the app SHALL show a notice that the app is designed for 6 months to 3 years, and SHALL still apply the rules for the child's actual age. This replaces v1 Requirement 1.5.
4. ONBOARDING, the Settings page and all age wording SHALL describe the app as being for babies and toddlers from 6 months to 3 years.
5. EVERY stage SHALL have a texture hint used on recipe pages and in the prompt helper, taken from a cited source.
6. THE safety screen SHALL keep applying each rule's age limit unchanged. Rules that end at 12 or 24 months stop applying at those ages.
7. THE rule list SHALL add a prep reminder for 100% fruit juice from 12 up to 36 months: limit to 4 ounces a day. It SHALL cite the AAP source already used for juice.
8. FOR toddler stages, THE Make screen SHALL also show recipes tagged for younger stages, after recipes tagged for the child's stage.
9. THE default meal slots for both toddler stages SHALL be breakfast, lunch, dinner and snack.

### Requirement 14: More built-in recipes

**User Story:** As a parent, I want enough built-in recipes that "What can I make?" finds something before I've pasted any of my own.

#### Acceptance Criteria

1. THE app SHALL ship **500 built-in recipes and simple ideas as the goal and no fewer than 300 as the hard minimum**, of which at most 40 are simple ideas. A recipe tagged for several stages counts toward each of them. Each stage SHALL meet the hard-minimum counts below, split by effort, and SHOULD reach the goal counts, which are a target and not tested (Easy, Medium, More, as computed by `recipeEffort` in `domain/effort.ts`, Requirement 10.3). This replaces the counts in v1 Requirement 2.1. The 300 minimum, the stage table and the cap of 40 simple ideas are approved by the maintainer on #68.

   | Stage | Goal (Easy / Medium / More) | Goal total | Hard minimum (Easy / Medium / More) | Minimum total |
   | --- | --- | --- | --- | --- |
   | `6–8 months` | 30 / 12 / 3 | 45 | 20 / 10 / 0 | 30 |
   | `9–12 months` | 50 / 45 / 25 | 120 | 30 / 25 / 15 | 70 |
   | `12–23 months` | 80 / 80 / 60 | 220 | 45 / 45 / 30 | 120 |
   | `24–36 months` | 130 / 130 / 120 | 380 | 70 / 70 / 60 | 200 |

   The older the stage, the more recipes it gets. Within a stage the split aims to be even, but it is not required to be. Only `6–8` leans toward Easy (30 / 12 / 3), because few recipes suit a 6-month-old, and that is accepted; `9–12` is close to even (50 / 45 / 25), with More the smallest cell. The `6–8` More cell has a minimum of 0 because More means more than 8 required ingredients or more than 7 steps (Requirement 10.3 and the design's Effort rules), which few recipes suit a 6-month-old, and the task 14.4 CI check would otherwise fail; reaching 3 is a goal only. This 0 (was 2) and the Medium minimum of 10 (was 8, so the stage total of 30 still adds up) are approved by the maintainer on #68. The goal totals add up to 765 stage tags over 500 recipes (about 1.5 stages per recipe). The invariant tests SHALL fail below the hard minimum and SHALL report the goal as a count table without failing; the goal is never enforced by a test.
2. BUILT-IN recipes MAY come from any publisher that meets every recipe source criterion in the design (an accountable public health, government, university or extension, children's hospital, or dietitian-led nonprofit publisher; free to read; exact quantities; not a blog, social media, brand, aggregator or AI site). Minnesota and other WIC programs, USDA FNS, the ICN Child Nutrition Recipe Box and Food Hero already qualify. EACH new publisher SHALL be checked by pr-reviewer before its first recipe merges and recorded in `docs/recipe-sources.md` with the verdict. (Changed from a fixed list by the maintainer on November 9, 2026.)
3. A built-in recipe MAY differ from its source by scaling every quantity by the same factor to make 2 to 6 servings, recorded as an adaptation ("Scaled from 25 servings to 4"). This adds to the changes allowed by v1 Requirement 2.9.
4. A simple idea MAY have no ingredient quantities and SHALL be labeled "Simple idea" in the app. This is an exception to v1 Requirement 2.8 for simple ideas only.
5. EVERY built-in recipe and simple idea SHALL keep v1's sourcing rules: source title, publisher, URL and retrieval date recorded and shown; ingredients from the source; steps in the app's own words; storage times from the source or a cited food-safety source.
6. THE built-in set SHALL include recipes containing each of the nine allergen groups, in at least these numbers (hard minimum / goal): dairy, egg, wheat and soy 30 / 60 each; peanut, tree nuts and fish 8 / 15 each; sesame 4 / 8; shellfish 3 / 6. Most goals are double the minimum; peanut, tree nuts and fish are 8 / 15, a little under double. This restores v1 Requirement 2.5, which issue #7 had relaxed, and scales it to the larger set. These allergen minimums and goals are approved by the maintainer on #68. Counts come from the real safety screen, as in the v1 tests.
7. IF qualifying publishers can't reach the hard minimums in criterion 1 or the allergen minimums in criterion 6 THEN the shortfall SHALL be reported to the maintainer before the set ships short. Falling short of a goal but meeting every hard minimum needs no report beyond the final numbers on issue #7, because the maintainer set the 500 goal on November 11, 2026. The hard minimums (300 total, the per-stage, per-effort and per-allergen counts, the cap of 40 simple ideas and the November 30 freeze) are approved by the maintainer on #68.
8. NEW built-in recipes SHALL be added in batches of about 50 (40 to 60). EACH batch SHALL have a review issue listing its recipes with source links, stage tags and adaptations, for the primary user to review. Reviews SHALL NOT block later batches; feedback SHALL be applied when it arrives. No batch SHALL merge after November 30, 2026.
9. WITH 500 built-in recipes THE app SHALL stay fast on a mid-range phone: opening Make, searching and changing a filter SHALL each finish rendering within 100 ms of the interaction for the full built-in set plus 50 custom recipes (measured by a Vitest timing test on `makeResults`, with generous CI margins), and the built-in data SHALL stay within the recipe data budget in the design.

### Requirement 15: UI with the Astryx design system

**User Story:** As a parent, I want the app to look clean and be easy to use on my phone, so that it feels pleasant to open every day.

#### Acceptance Criteria

1. THE app SHALL use Astryx components for layout, navigation, forms, buttons, cards, chips, dialogs and lists, after a trial that meets every criterion in this requirement. Date fields SHALL use the browser's native date picker instead of Astryx DateInput, to keep the app small (issue #37).
2. THE app SHALL upgrade to React 19, which Astryx requires.
3. THE app SHALL use a custom Astryx theme with the v1 palette (creams, soft oranges, lavender) plus the pastel food-group colors of Requirement 21, meeting WCAG 2.1 AA contrast. Theme art SHALL follow Requirement 21. (Changed by the maintainer on November 13, 2026. Until then this criterion kept the friendly ghosts, doors, monsters and pumpkins as the app's own inline SVGs.)
4. ALL fonts and styles SHALL ship with the app. THE app SHALL NOT load fonts, CSS or scripts from Google Fonts, a CDN or any other host (v1 Requirement 12.2 still applies).
5. THE app's `vitest-axe` tests SHALL pass on every page, and every page SHALL work with a keyboard and on screens 360 px wide.
6. Pages SHALL load their code the first time they are opened. THE first load of the heaviest page (gzipped JavaScript and CSS the browser downloads to open it, excluding the built-in recipe data) SHALL be no more than 250 KB larger than the v1 build, which loaded everything at once. THE size check SHALL report every page's first load and the gzipped size of the built-in recipe data. (Raised from 150 KB by the maintainer on November 8, 2026, issue #37.)
7. IF the trial fails any criterion THEN work SHALL stop on the UI change and the maintainer SHALL be asked whether to fix it, accept it, or restyle with plain CSS instead.
8. THE primary user's specific complaints about the current UI SHALL be collected and addressed. Collecting them SHALL NOT block other work.

### Requirement 16: Type what you have

**User Story:** As a parent, I want to type what I have the way I'd say it, like "leftover chicken, some rice and frozen peas", and see what I can make, so that I don't have to tap foods one by one or spell them exactly.

#### Acceptance Criteria

1. THE Make screen SHALL have one search box that accepts free English text listing foods, separated by commas, "and", "with", "+", "&" or new lines, or not separated at all ("chicken rice peas").
2. THE app SHALL turn the text into foods in the browser, with no network request, ignoring quantities, units and filler words ("2", "cups", "some", "leftover", "a bit of", "half a").
3. THE app SHALL recognize common other English names for the same food, including US, UK and Indian English names (for example mince for ground beef, courgette for zucchini, garbanzo for chickpea, curd for yogurt, capsicum for bell pepper), from a fixed list in source code.
4. THE app SHALL recognize misspelled food names using the typo rules in the design. A food found only through a typo match SHALL be shown as "Did you mean …?" and SHALL NOT count as on hand until the user taps it.
5. WHILE the user types, THE app SHALL show the recognized foods as chips and SHALL update Ready now and Missing one as if those foods were on hand.
6. WHEN the user presses Enter or taps "Add" THEN the recognized foods SHALL be added to on-hand and the box SHALL clear. THE user SHALL be able to remove any chip.
7. WORDS the app can't place SHALL be listed as "Not recognized". Unrecognized words SHALL NOT be counted as foods.
8. IF the text matches words in recipe titles ("pancakes", "pudding") THEN the screen SHALL also show those recipes under "Recipes named …", with ghosted recipes shown as ghosts.
9. THE search box SHALL understand requests for a kind of dish, from a fixed phrase list in the design, and turn each into a filter: meals ("something for breakfast", "lunch", "dinner", "snack"), forms ("finger food", "puree", "mashed"), speed and effort ("quick", "easy"), food groups ("iron-rich", "protein", "veggie") and "make ahead" (freezer-friendly). EACH active filter SHALL be shown as a chip that can be removed.
10. THE search SHALL NOT change the safety screen. Safety checks keep using recipe ingredient names as written.
11. Only English is supported. Other languages are out of scope.
12. WHEN the search has at least one filter THEN, below Ready now and Missing one, THE screen SHALL show "More ideas": up to 10 more recipes matching every filter that need two or more foods the user doesn't have, fewest missing first, each naming the missing foods. This applies even when no foods are typed, so "something for breakfast" alone lists breakfast recipes.
13. EVERY recipe SHALL have a serving form (puree, mashed, finger food, or pieces) used by the form filters: set by hand for built-in recipes, and derived from the recipe text for custom recipes using the rules in the design, editable on the recipe.

### Requirement 17: Smart suggestions

**User Story:** As a parent, I want the app to guess what I'm about to do and offer it, so that I tap once instead of setting things up every time.

These suggestions come from the maintainer's UI feedback (issue #36): the app should anticipate and suggest, not wait to be told. Every suggestion is worked out on the device from simple rules, with no AI service.

#### Acceptance Criteria

1. WHEN an allowed pick exists THEN the top of the Make screen SHALL show one "Try this" card: the single best Ready now recipe, chosen by the rules in the design. IT SHALL NEVER pick a recipe with two or more untried foods. IT SHALL pick a recipe with one untried food only when a new food is due (criterion 4) and that food is the one the new-food suggestion names, or, when no new food is due, when that recipe is the only non-ghosted Ready now recipe; the card then says "Has a new food: <food>". (Option b, chosen by the maintainer on November 9, 2026.) WHEN no allowed pick exists THEN the card SHALL be hidden. The card SHALL have one primary button that opens the recipe, and a "Show another" action that moves to the next-best allowed recipe.
2. WHEN the Make screen opens THEN the app SHALL show a "Suggested: <meal>" chip for the time of day (breakfast, lunch, snack or dinner; no chip from 9 PM to 5 AM). The hint SHALL only raise matching recipes in the Try this pick; it SHALL NOT filter results or show "More ideas" unless the user taps the chip, which turns it into a normal meal filter. Dismissing the chip SHALL hide it for 4 hours. It SHALL never change stored data other than the dismissal.
3. IF the on-hand foods were last changed more than 3 days ago THEN the Make screen SHALL ask "Still have these?" with the foods listed and one-tap "Yes, keep" and "Clear" actions.
4. WHEN at least 3 days have passed since the child's last new food (the spacing from v1 Requirement 7.8 and its source) THEN the Make screen MAY show "Ready for a new food?" with one Ready now or Missing one recipe that contains exactly one untried food, naming that food. The last new food is the newest food record of any status, so a recorded reaction also restarts the wait. The app SHALL NOT pick allergens over other foods and SHALL NOT add new health advice.
5. EVERY recipe page SHALL have an "I made this" action that records the date. THE Make screen SHALL show a "Make again" row of the most recently made recipes that are still not ghosted.
6. WHEN the user has added the same food to on-hand on 3 or more different days and it is not in the pantry THEN the app SHALL offer once "You often have <food>. Add to pantry?"
7. THE Add recipe screen SHALL have a primary "Paste" button that reads the clipboard only when tapped, and SHALL fall back to the text box when the browser doesn't allow it.
8. A suggestion SHALL NEVER show a ghosted recipe, SHALL NEVER change stored data without a tap, and SHALL show a short "Why this?" reason (for example "Ready now · 10 min · Breakfast").
9. EACH suggestion SHALL be dismissible with one tap, and a dismissed suggestion SHALL stay hidden for at least 24 hours, except the time-of-day meal hint, which follows criterion 2.
10. EACH screen SHALL have at most one filled primary button at a time. On the Make screen it is the "Try this" button when that card is shown. On Add recipe it is "Paste" before a preview and "Save recipe" during a preview, and the shell's "Add recipe" button is hidden there.
11. ALL suggestion state (made log, on-hand date, food counts, dismissals) SHALL be stored on the device in schema v2, SHALL be included in export and import, and SHALL NOT be included in share links or the ChatGPT prompt.

### Requirement 18: JSON prompt flow for ChatGPT

**User Story:** As a parent, I want to type the question I would ask ChatGPT, run it, paste the answer and have the app add the recipe, so that I never retype a recipe and the app can read the answer reliably.

#### Acceptance Criteria

1. THE "Ask ChatGPT" screen SHALL have a text box for the user's question, pre-filled with a suggestion based on what the user has on hand (editable), and a limit of 1,000 characters.
2. THE app SHALL build the wrapped prompt: the child's age in months and stage texture hint, the foods to leave out (Requirement 8.3), the instruction not to mention those foods, the user's question inside a clearly marked block, and the Recipe JSON output template with the instruction to reply with only the JSON. The prompt SHALL NOT contain the child's name or birth date.
3. THE user SHALL be able to copy the wrapped prompt and open ChatGPT in a new tab, then paste the reply into Add recipe (with the source preset to ChatGPT).
4. THE app SHALL parse a pasted reply as Recipe JSON when it contains a JSON object: it SHALL accept the object alone or inside a markdown code fence with text around it, and SHALL ignore text outside the object as recipe content: that text is not shown as steps or notes and is not saved in the recipe, and is kept only in the original text (Requirement 18.10). THE preview SHALL say when a long outside text (over 200 characters) or a second JSON object was ignored.
5. THE Recipe JSON parser SHALL be strict: a wrong version, a missing or empty title, no ingredients, no steps, an ingredient with no name, a quantity that is not a number, or a wrong type SHALL be rejected with a plain-language message that names the field. A rejected reply SHALL NOT be saved.
6. WHEN the reply is rejected THEN the app SHALL offer a "Copy a fix-up request" prompt that asks the AI chat app to resend the recipe in the exact format, and SHALL offer "Read as plain text instead".
7. IF the reply contains no JSON object THEN the app SHALL read it with the free-text parser, say "This isn't in the expected format, so it was read as plain text. Check each line.", and continue with the same preview.
8. THE parsed recipe SHALL go through exactly the same preview, line editing, safety screen (ingredient screen plus text-mention screen on title, steps and notes, Requirement 7), time, effort and nutrition tags as a text paste. THE app SHALL NOT offer any way to skip or clear a text mention except the user's tap on "Not used in this recipe".
9. EVERY string inside the reply's JSON object, at any depth, that the format does not define (extra fields, nested values, ingredient-level extra fields, an ingredient's unit) SHALL be added to the recipe's notes and screened as recipe text, so nothing inside the object is dropped unscreened. IF the reply has more such text than the limits in the design THEN the app SHALL reject it as invalid rather than truncate it. An ingredient's `unit` SHALL be screened through the text-mention screen, not the ingredient-name match (v1 Requirement 4.1 is not widened). Text outside the object is covered by 18.4.
10. THE raw reply SHALL be kept as the recipe's original text (Requirement 6.8).
11. A reply of more than 20,000 characters SHALL NOT be parsed.
12. THE app SHALL NOT call any AI service. The question and the reply stay on the device.

### Requirement 19: Instagram reel prompt flow

**User Story:** As a parent, I find recipes in Instagram reels. I want the app to give me a prompt for Meta AI or another AI chat app that is connected to my Instagram, so that the recipe comes back in a form the app can read.

#### Acceptance Criteria

1. THE Add recipe screen SHALL have a "From an Instagram reel" option with a box for the reel URL.
2. THE app SHALL accept only an `https://` URL up to 500 characters. IF the host is not `instagram.com`, `www.instagram.com` or `instagr.am` THEN the app SHALL show a warning but still allow the prompt.
3. THE app SHALL build the reel prompt: the URL, an instruction to open the reel and extract the recipe from the caption, spoken audio and on-screen text, to leave a quantity empty rather than guess it, to reply with only Recipe JSON in the template of Requirement 18, and to reply with the `error` object of the template when the reel can't be opened.
4. THE reel prompt SHALL NOT contain the child's name, birth date or age.
5. THE user SHALL be able to copy the reel prompt and open Meta AI (`https://www.meta.ai/`) in a new tab with one tap each, and the screen SHALL say that any AI chat app that can open the user's Instagram works.
6. THE app SHALL NEVER fetch, embed or preview the URL. THE URL SHALL be kept only as the recipe's optional link (Requirement 6.9), with the source preset to Instagram.
7. THE pasted reply SHALL follow Requirement 18.4 to 18.11, including the full safety screen. A reply with the `error` object SHALL show "The AI app couldn't open this reel" and a tip to paste the caption instead.
8. THE Add recipe screen SHALL keep the help text that reels can't be opened by FirstMenu (Requirement 6.10), reworded to point to this option.

### Requirement 20: Short problem-first onboarding

**User Story:** As a new parent, I want to say what I need help with and see the app do one useful thing right away, so that I understand what the app is for without a long tour.

#### Acceptance Criteria

1. AFTER the child profile (birth date, required, v1 Requirement 1), THE first run SHALL show one screen of problem choices (multi-select, one tap each): "What can I make with what I have", "Save recipes from ChatGPT or Instagram", "Plan the week and make a grocery list", "What's safe for my child", and "Just looking".
2. THE problem choices SHALL be skippable with one tap ("Skip"), which goes straight to the Make screen. The child profile step itself SHALL NOT be skippable, because the safety screen needs the age.
3. THE app SHALL then run one quick solve for the first problem chosen, in this fixed order of the list above, each finishing in at most three taps and using only data and code on the device:
   1. What can I make: the user types what they have; live results show the Ready now and Missing one recipes; "Keep these foods" stores them as on-hand and opens Make.
   2. Save recipes: the user sees the question box for ChatGPT and the reel box side by side with "Try an example", which parses a bundled sample reply and shows the preview with its safety result without saving; "Open Add recipe" goes on.
   3. Plan and grocery: one tap fills the week using the existing plan logic and shows the grocery list, with "Keep this plan" and "Not now".
   4. What's safe: shows the leave-out list for the child's age with its sources and a free-text food check, with the existing disclaimers (`SCREEN_LIMITS` and `NOT_MEDICAL_ADVICE`) beside the result. WHEN no rule fires for the typed food THEN it SHALL show exactly "FirstMenu's list has no rule for {food} at this age." and never "safe", "OK" or a green state (approved by the maintainer on #65).
4. THE quick solve SHALL be skippable at every step. WHEN a user chose more than one problem THEN the end screen SHALL link to the other chosen features in one line each.
5. THE onboarding after the profile SHALL be at most three screens, shall not require typing except in the quick solve, and SHALL NOT hold back the Make screen: finishing or skipping lands on Make.
6. THE tried-foods checklist (v1 Requirement 7.2) SHALL be offered as an optional collapsed section on the profile screen ("Foods already tried") instead of an open list, so the first screen is short. Nothing it records changes.
7. USERS who already finished onboarding SHALL NOT be shown the new screens automatically; they see them only when they open "Quick tour" (20.10), which opens the problems step at `/onboarding/tour`. THE onboarding SHALL add no stored fields (it uses the existing `onboarded` flag) and make no network request.
8. THE onboarding SHALL meet Requirement 15 (Astryx, WCAG 2.1 AA, keyboard, 360 px, one filled primary button per screen) and SHALL be loaded with the Make screen's chunk or lazily, within the size budget of Requirement 15.6.
9. EVERY quick-solve screen that shows safety results (What's safe, and the Save recipes example preview) SHALL show the disclaimers of Requirement 11 (`NOT_MEDICAL_ADVICE` and `SCREEN_LIMITS`) next to the results, not only in the page footer.
10. THE onboarding SHALL be re-openable from Settings as "Quick tour".

### Requirement 21: Food pictures and theme art

**User Story:** As a parent, I want to see pictures of the foods in each recipe and a warmer look made for babies, so that I can spot a recipe at a glance and the app feels friendly to open.

The maintainer asked for this on November 13, 2026, in session: "I think the app needs images for foods, recipes. Also, the UI lacks art and general baby app feel. It feels very dull." After seeing the options he approved the direction ("yes, I like this direction": Fluent 3D food pictures, theme art redrawn in the same style, Fredoka headings, no photos and no AI-generated images). He said the mystery door and "the pumpkin for freezes well" didn't make sense, asked to replace the ghost too, and picked "New food: Peekaboo monster", "Freezes well: Snowflakes" and "I like hourglass for not yet". The boards are in `docs/art/`.

This requirement replaces the theme elements of v1 Requirement 14.1 and the mapping of v1 Requirement 14.2. It changes the pictures, not the behavior, of v1 Requirements 5, 7.3, 7.5 and 9.1. v1 Requirements 14.3 to 14.6 still apply. Where other requirements say ghost, mystery door or pumpkin, they mean the state, which is now shown with the pictures below.

#### Acceptance Criteria

1. EVERY Foods page tile SHALL show its food's picture, and every plate (criterion 5) SHALL show its foods' pictures. A food's picture SHALL be the one the map (criterion 4) gives it: its own picture from Microsoft Fluent Emoji in the 3D style (MIT license), or, IF Fluent Emoji has no picture of that food, THEN the group picture of its food group. A food the map does not list SHALL show the generic bowl, and a Foods tile SHALL show the group picture instead of a choking-shape picture (a picture of a whole round or tube-shaped food, or of a food with no safe form, listed in the design) whose food no criterion 6 rule matches. A food SHALL NEVER show a picture of a different food. Other screens, such as the week plan, the slot picker and print, get no food pictures and keep their current art, except that a freezes-well picture anywhere becomes the snowflake (criterion 9; the design lists the screens).
2. THE app SHALL NOT show photos or pictures made by an image-generation model. EVERY picture SHALL be a file that ships with the app or an SVG drawn in the app's code, and SHALL NEVER be loaded from another host.
3. EVERY food picture SHALL have its width and height set, SHALL load lazily, and SHALL be decorative (empty `alt` text).
4. A fixed map in source code SHALL give each food key (as `src/domain/foods.ts` makes it) its own picture or its food group. EVERY food that a built-in recipe uses, and the food of each block rule, which the Foods page shows as a Not yet tile while the rule applies (`blockRuleFoods()`, v1 Requirement 5.7), SHALL have an entry, and a test SHALL check this. That covers every main food of the built-in recipes: 206 foods on November 13, 2026 by the design's rules, more than the 168 that the session counted with a rougher rule.
5. EVERY recipe card (the design lists them), for built-in and pasted recipes, and the top of every recipe page SHALL show a plate with up to 3 of the recipe's main foods, chosen by the rules in the design.
6. A plate SHALL NEVER show a food that is matched, at any age, by the `choking-no-safe-form` block rule or by a prep reminder for round or tube-shaped foods (`grapes`, `cherry-tomato`, `cherries`, `small-round-fruit`, `sausages`, `whole-nuts`). It SHALL show the recipe's other main foods instead, or the generic bowl IF none are left.
7. A Foods page tile MAY show the picture of a food that criterion 6 keeps off plates, but only with that rule's message, unchanged, as the first line under the picture and the food's name.
8. A food or recipe is Not yet for the child when it is blocked for the child's age or paused after a recorded reaction. THE cards and recipe page of a Not yet recipe, and the Foods tile of a Not yet food, SHALL show the hourglass, and the plate of a Not yet recipe SHALL be greyed. EVERY picture of a Not yet food SHALL be greyed, so a plate SHALL NEVER show a Not yet food in full color. Only pictures are greyed; text keeps its contrast. ON the shared recipe view, Not yet is what that view's "Not yet" section shows for the viewer's child, so with no child set up nothing is greyed. Other screens keep showing Not yet as text.
9. THE state pictures SHALL be:

   | State | Shown for | Picture |
   | --- | --- | --- |
   | New food | a food the child has not tried, including allergens | The peekaboo monster: a friendly monster hiding in a dark round hole, with only its eyes and horn tips showing |
   | Tried | a food marked "tried, no reaction" | The same friendly monster out of its hole, in one color for each allergen group or a generic color |
   | Not yet | a food or recipe blocked for the child's age, or paused after a recorded reaction | Fluent 3D "Hourglass not done" |
   | Freezes well | a recipe with freezer storage info | Fluent 3D "Snowflake" |

   THE peekaboo monster and the friendly monster SHALL be SVGs drawn in the app's code in the Fluent 3D look (soft gradients, no outlines), following the reference drawings in `docs/art/reference/`.
10. EVERY picture SHALL be decorative, and each state SHALL stay in visible text and in the accessible name (v1 Requirement 14.3). THE state labels SHALL NOT change ("New food: egg", "egg — tried on Nov 12", "Not yet: honey. Available at 12 months.", "Freezes for 3 months" and the others). THE app's own wording SHALL NOT call a state a ghost, a door or a pumpkin. Recipe and food names, such as a pumpkin recipe, are not the app's own wording.
11. Headings SHALL use Fredoka at weight 600 (SIL Open Font License) from the `@fontsource/fredoka` package, latin subset only, bundled with the build. Body text SHALL stay as it is.
12. EACH recipe card SHALL have a pastel band in the color of its main food group (the Not yet color for a Not yet recipe), and EACH nutrition tag SHALL have its own color, as listed in the design. ALL text SHALL meet WCAG 2.1 AA, and `npm run check:contrast` SHALL check every new pair of text and background colors.
13. WHEN the user taps "Tried, no reaction" on a Foods tile THEN its friendly monster SHALL pop out of its hole, in an animation of 600 ms or less. WHEN the user's system requests reduced motion THEN the app SHALL show the tried picture with no animation.
14. THE empty states on the Make, My recipes and Foods pages (the design lists them) SHALL show a friendly monster picture next to their text. Their text SHALL NOT change.
15. THE Fluent Emoji MIT license text SHALL ship next to the pictures. THE Sources page SHALL credit Fluent Emoji (MIT) and Fredoka (SIL Open Font License).
16. THE size check (`npm run check:size`) SHALL keep the picture files out of the JavaScript budget, SHALL fail when any picture file is larger than 8 KB, and SHALL warn when the picture files together pass 900 KB. `npm run check:external` SHALL still pass.

## Out of scope

- Calling any AI service from the app, or any backend.
- Suggestions based on how often to re-offer allergens, until a cited source gives an interval.
- Semantic search with a language model or embeddings (Requirement 16 uses a fixed name list and typo rules instead).
- Food names in languages other than English.
- Opening or fetching Instagram links, transcribing reel audio or video, or reading text from images inside the app (the AI chat app the user chooses does this, Requirement 19).
- Nutrient amounts, calorie or portion tracking.
- Image cards for Instagram stories (possible later, depending on Requirement 9 review).
- Photos, pictures made by an image-generation model, and pictures from other hosts (Requirement 21).
- New work on the week plan, prep list, grocery list, print view or plan share link, apart from the snowflake on the Prep page's freezer badge (Requirement 21.1).
- Children older than 3 years.
- Built-in recipes from publishers that fail the recipe source criteria (Requirement 14.2).
