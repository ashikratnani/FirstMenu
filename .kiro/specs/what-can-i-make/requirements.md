# Requirements Document: What can I make?

## Introduction

FirstMenu v1 (spec: `.kiro/specs/first-menu/`) is built and live. It plans a week of baby meals. After using it, the primary user (the parent who plans meals for our 10-month-old) said a weekly plan isn't what she needs day to day. Her real problems are:

1. "I have a few ingredients and the usual things around the house. What can I make, and what's quickest and easiest?"
2. Typing recipes in by hand takes too long.
3. Her recipes come from Instagram reels and ChatGPT.
4. She cares about nutrition in what she makes.

In a second review the maintainer also asked for more built-in recipes, support for toddlers (up to 3 years), and a new UI built on Meta's Astryx design system.

This spec changes FirstMenu's focus to answer those. The safety screen, ghosted foods, first tastes, built-in recipes, theme, local storage and disclaimers from v1 stay. The week plan, prep list, grocery list, print view and plan share link stay as secondary features with no new work beyond what's listed here.

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
- **Prompt helper**: the feature that writes a ChatGPT prompt for the user to copy.
- **Text mention**: a block-rule food found in a pasted recipe's title, steps or notes rather than its ingredient list.
- **Stages**: `6–8 months`, `9–11 months` (id `9-12`, kept from v1), `12–23 months` and `24–36 months`. The last two are the **toddler stages**.
- **Simple idea**: a built-in single-food or two-food preparation taken from a public health feeding guide, with no exact amounts ("ripe banana, mashed").
- **Astryx**: Meta's open source React design system (`@astryxdesign/core`, MIT license).

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

1. THE Add recipe screen SHALL have one large text box for pasting and a "Read recipe" button.
2. THE app SHALL parse the text in the browser, with no network request, into a title, ingredients (quantity, unit, name, optional flag), steps, stated time, servings and notes.
3. THE parser SHALL handle ChatGPT-style text (headings, markdown bold and headers, bullets and numbered lists) and Instagram-style captions (emoji, hashtags, @mentions, "save this" lines, inline lists).
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

1. THE Make screen and the Add recipe screen SHALL offer "Ask ChatGPT".
2. THE app SHALL build a prompt containing: the child's age in months, the on-hand and pantry foods, a texture hint for the stage, the foods to leave out, a request for something quick and easy (iron-rich if possible), and the reply format from the design.
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

1. THE README, `docs/kiro-usage.md` and the demo script SHALL describe the new flow: pantry, on hand, ready-now results, paste from ChatGPT, safety catch, nutrition tags.
2. THE deployed app SHALL be checked end to end on a phone before submission, including pasting a real ChatGPT reply and a real Instagram caption.

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

1. THE app SHALL ship at least 100 built-in recipes and simple ideas in total, of which at most 25 are simple ideas. At least 15 SHALL be tagged for `6–8 months` and at least 25 for each of the other three stages. A recipe tagged for several stages counts toward each. This replaces the counts in v1 Requirement 2.1.
2. BUILT-IN recipes MAY come from these sources, in addition to v1's: the USDA Child Nutrition Recipe Box from the Institute of Child Nutrition (CACFP family child care home recipes), university extension recipe sites (including Food Hero from Oregon State University), and public health feeding guides (WIC, USDA FNS) for simple ideas.
3. A built-in recipe MAY differ from its source by scaling every quantity by the same factor to make 2 to 6 servings, recorded as an adaptation ("Scaled from 25 servings to 4"). This adds to the changes allowed by v1 Requirement 2.9.
4. A simple idea MAY have no ingredient quantities and SHALL be labeled "Simple idea" in the app. This is an exception to v1 Requirement 2.8 for simple ideas only.
5. EVERY built-in recipe and simple idea SHALL keep v1's sourcing rules: source title, publisher, URL and retrieval date recorded and shown; ingredients from the source; steps in the app's own words; storage times from the source or a cited food-safety source.
6. THE built-in set SHALL include, across all recipes, at least one recipe containing each of the nine allergen groups. This restores v1 Requirement 2.5, which issue #7 had relaxed.
7. IF the sources can't reach the counts in criterion 1 or the allergen coverage in criterion 6 THEN work SHALL stop and the shortfall SHALL be reported to the maintainer before any other source is used or the set ships short.
8. NEW built-in recipes SHALL be added in batches of about 20. EACH batch SHALL have a review issue listing its recipes with source links, stage tags and adaptations, for the primary user to review. Reviews SHALL NOT block later batches; feedback SHALL be applied when it arrives.

### Requirement 15: UI with the Astryx design system

**User Story:** As a parent, I want the app to look clean and be easy to use on my phone, so that it feels pleasant to open every day.

#### Acceptance Criteria

1. THE app SHALL use Astryx components for layout, navigation, forms, buttons, cards, chips, dialogs and lists, after a trial that meets every criterion in this requirement. Date fields SHALL use the browser's native date picker instead of Astryx DateInput, to keep the app small (issue #37).
2. THE app SHALL upgrade to React 19, which Astryx requires.
3. THE app SHALL use a custom Astryx theme with the v1 palette (creams, soft oranges, lavender), meeting WCAG 2.1 AA contrast. The friendly ghosts, doors, monsters and pumpkins SHALL stay as the app's own inline SVGs.
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

1. WHEN an allowed pick exists THEN the top of the Make screen SHALL show one "Try this" card: the single best Ready now recipe, chosen by the rules in the design. IT SHALL NEVER pick a recipe with two or more untried foods. IT SHALL pick a recipe with one untried food only when a new food is due (criterion 4) and that food is the one the new-food suggestion names, or when that recipe is the only non-ghosted Ready now recipe; the card then says "Has a new food: <food>". (Option b, chosen by the maintainer on November 9, 2026.) WHEN no allowed pick exists THEN the card SHALL be hidden. The card SHALL have one primary button that opens the recipe, and a "Show another" action that moves to the next-best allowed recipe.
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

## Out of scope

- Calling any AI service from the app, or any backend.
- Suggestions based on how often to re-offer allergens, until a cited source gives an interval.
- Semantic search with a language model or embeddings (Requirement 16 uses a fixed name list and typo rules instead).
- Food names in languages other than English.
- Opening Instagram links, transcribing reel audio or video, or reading text from images inside the app.
- Nutrient amounts, calorie or portion tracking.
- Image cards for Instagram stories (possible later, depending on Requirement 9 review).
- New work on the week plan, prep list, grocery list, print view or plan share link.
- Children older than 3 years.
- Built-in recipes from commercial recipe blogs or sites outside Requirement 14.2.
