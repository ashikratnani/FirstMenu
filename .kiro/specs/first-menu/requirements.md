# Requirements Document

## Introduction

FirstMenu is a free web app for planning a week of baby meals. Parents pick recipes from a library sorted by age stage, or add their own, and get a weekly plan, a make-ahead prep list and a grocery list. Every recipe is screened against a fixed infant-safety list based on pediatric guidance. Foods that are not safe for the child's age yet appear as ghosts and cannot be planned. New foods appear as mystery doors until the parent marks them as introduced.

The app is built for a 10-month-old and designed for any parent of a baby roughly 6 to 12 months old. The primary user plans the week on her own device. Secondary users (family members who cook or follow the plan) receive a read-only share link or a printout. There is no backend and no account.

Project constraints:

- Stack: React + TypeScript + Vite, static hosting on GitHub Pages.
- Repository: public, MIT license, `ashikratnani/FirstMenu`.
- Hackathon deadline: Friday, December 4, 2026, 2:00 PM PT. Deliverables: a working app URL, a public YouTube demo video under 3 minutes, and a short write-up of how Kiro was used.
- Theme: cute-spooky (friendly ghosts, pumpkins, a haunted house). Nothing scary.

## Glossary

- **Child**: the one baby the plan is for. v1 supports one child per device.
- **Age**: the child's age in whole months on the plan's start date.
- **Stage**: an age band used to sort recipes. `6–8 months` or `9–12 months`.
- **Recipe**: a built-in recipe shipped with the app, or a custom recipe entered by a user.
- **Ingredient name**: the free-text name of one ingredient line in a recipe, such as "red grapes".
- **Food**: the thing an ingredient counts as for first tastes, such as "grape". Allergens are grouped (all peanut forms count as "peanut").
- **Safety screen**: the check of every ingredient name against the fixed rule list.
- **Rule**: one entry in the rule list. A rule is a block rule, a prep reminder or an allergen rule.
- **Ghost / ghosted**: a food or recipe that a block rule (or a recorded reaction) makes unavailable for the child right now.
- **Prep reminder**: a preparation note shown next to an ingredient, such as "quarter grapes lengthwise". It never blocks.
- **Allergen**: one of the nine common allergen groups: peanut, egg, dairy (cow's milk), tree nuts, soy, wheat, fish, shellfish, sesame.
- **Mystery door**: a food the child has not tried yet.
- **Friendly monster**: a food the parent has marked as introduced with no reaction.
- **Week plan**: 7 days by the active meal slots, each slot holding at most one recipe.
- **Slot**: one meal on one day (breakfast, lunch, dinner or snack). One slot is one serving.
- **Prep list**: the make-ahead plan for the week (what to cook when, what to freeze).
- **Share link**: a URL that carries a read-only copy of the week plan in its fragment.

## Requirements

### Requirement 1: Child profile and age stage

**User Story:** As a parent, I want to enter my baby's birth date once, so that the app shows recipes and safety rules for his age.

#### Acceptance Criteria

1. WHEN the app opens with no child profile THEN the app SHALL ask for the child's birth date and an optional first name before showing the plan.
2. THE app SHALL compute the child's age in whole months on the plan's start date and use that age for every safety and stage decision.
3. THE app SHALL map ages below 9 months to the `6–8 months` stage and ages 9 months and above to the `9–12 months` stage.
4. IF the child's age is below 6 months THEN the app SHALL show a notice that most babies start solids around 6 months and to talk to a pediatrician before starting, and SHALL still allow planning.
5. IF the child's age is 12 months or more THEN the app SHALL show a notice that the app is designed for 6 to 12 months, and SHALL apply the safety rules for the child's actual age.
6. WHEN the user edits the birth date THEN the app SHALL re-run the safety screen for all recipes and the current plan.

### Requirement 2: Built-in recipe library

**User Story:** As a parent, I want a list of baby recipes sorted by age stage, so that I can plan without searching elsewhere.

#### Acceptance Criteria

1. THE app SHALL ship at least 24 built-in recipes, with at least 10 tagged for each stage.
2. EACH recipe SHALL have a title, one or more stages, one or more meal types, an ingredient list (name, optional quantity and unit, grocery category), steps, a texture note, and the number of servings it makes.
3. EACH recipe MAY have storage info: days it keeps in the fridge, months it keeps in the freezer, and a make-ahead note.
4. THE library SHALL show recipes for the child's stage by default and SHALL offer a filter to show all stages and to filter by meal type.
5. THE built-in library SHALL include, across all recipes, at least one recipe containing each of the nine allergen groups.
6. EVERY built-in recipe SHALL pass the safety screen with no block findings at the youngest age of each stage it is tagged with (6 months for `6–8 months`, 9 months for `9–12 months`).

### Requirement 3: Custom recipes

**User Story:** As a parent, I want to add my own recipes, so that I can plan the meals we already cook.

#### Acceptance Criteria

1. THE app SHALL let the user create, edit and delete custom recipes with the same fields as built-in recipes.
2. WHEN the user saves a custom recipe THEN the app SHALL run the safety screen on it before it can be added to a plan.
3. FOR each ingredient line THE editor SHALL show the food it counts as for first tastes, derived from the ingredient name, and SHALL let the user change it.
4. IF a custom recipe has no storage info THEN the app SHALL treat it as cook-fresh and SHALL NOT assume fridge or freezer times.
5. WHEN a custom recipe used in the plan is deleted THEN the app SHALL empty those slots and tell the user which slots were emptied.

### Requirement 4: Safety screen

**User Story:** As a parent, I want every recipe checked against a fixed infant-safety list, so that I don't plan something my baby should not have yet.

#### Acceptance Criteria

1. THE safety screen SHALL check ingredient names only. It SHALL NOT read steps, titles or notes.
2. THE matcher SHALL be case-insensitive, SHALL match whole words and multi-word phrases, and SHALL treat singular and plural forms as the same word.
3. EACH rule SHALL be one of three kinds: a block rule, a prep reminder, or an allergen rule.
4. A rule MAY list exception words. IF an ingredient name contains an exception word for a rule THEN that rule SHALL NOT fire for that ingredient.
5. A rule MAY have an age limit. THE rule SHALL apply only WHILE the child's age is below that limit.
6. THE rule list SHALL be fixed in the app's source code and SHALL NOT be editable by users.
7. EACH rule SHALL cite at least one published source (AAP, WHO, CDC, FDA/EPA or NIAID) shown in the app.
8. WHEN an ingredient matches no rule THEN the app SHALL allow it.
9. THE safety screen SHALL run on built-in recipes, custom recipes and recipes in a share link, using the same rule list.

### Requirement 5: Ghosted foods

**User Story:** As a parent, I want unsafe foods to show up as ghosts that can't be planned, so that the safety screen is visible and hard to miss.

#### Acceptance Criteria

1. WHEN a recipe has one or more block findings for the child's age THEN the app SHALL show it as a ghost in the library, the recipe page and the slot picker.
2. THE app SHALL NOT let the user add a ghosted recipe to a plan slot.
3. A ghosted recipe SHALL show, in text, each blocking ingredient, the reason, and the age when it stops being blocked (if the rule has an age limit).
4. IF a recipe already in the plan becomes ghosted (birth date changed, recipe edited, or reaction recorded) THEN the slot SHALL show as ghosted, SHALL be left out of the grocery and prep lists, and SHALL prompt the user to replace it.
5. WHEN the child reaches the age limit of every block rule on a recipe THEN the recipe SHALL stop being ghosted without user action.
6. WHEN the user edits a custom recipe so that it has no block findings THEN the recipe SHALL stop being ghosted.
7. THE Foods page SHALL list each block rule's foods as ghosts with the reason and the age they become available, if any.

### Requirement 6: Prep reminders

**User Story:** As a parent, I want preparation reminders for foods that are only safe when prepared a certain way, so that I'm reminded every time without having to answer questions.

#### Acceptance Criteria

1. WHEN an ingredient matches a prep reminder rule THEN the app SHALL show the reminder next to that ingredient on the recipe page, in the grocery list and in the print view.
2. THE app SHALL show prep reminders proactively and SHALL NOT ask the user to confirm preparation.
3. A prep reminder SHALL NOT block a recipe or change whether it can be planned.
4. THE rule list SHALL include, at minimum, a reminder for grapes to quarter them lengthwise.

### Requirement 7: First tastes

**User Story:** As a parent, I want new foods shown as mystery doors that turn into friendly monsters once introduced, so that I can track what my baby has tried and introduce new foods one at a time.

#### Acceptance Criteria

1. THE app SHALL keep a list of foods derived from every ingredient in built-in and custom recipes, with allergens grouped into the nine allergen groups.
2. DURING first-run setup THE app SHALL let the user mark foods the child has already tried, with the nine allergens listed first.
3. A food the child has not tried SHALL appear as a mystery door. A recipe containing one or more untried foods SHALL show a door badge naming those foods.
4. Mystery doors SHALL NOT block planning. Allergens SHALL be mystery doors and SHALL NOT be ghosted by an allergen rule.
5. WHEN the user marks a food "tried, no reaction" THEN the app SHALL record the date and show the food as a friendly monster.
6. WHEN the user marks a food "noticed a reaction" THEN the app SHALL ghost every recipe containing that food for this child until the user clears the flag, and SHALL tell the user to contact their pediatrician and, for severe symptoms such as trouble breathing, to call emergency services.
7. EACH allergen door SHALL show short guidance from the cited sources: introduce one at a time, keep offering it regularly once tolerated, and serve it in a safe form. The peanut door SHALL also say to ask a pediatrician first if the baby has severe eczema or an egg allergy.
8. WHEN two or more untried foods first appear in the plan within 3 days of each other THEN the plan SHALL show a warning naming the foods and days. The warning SHALL NOT block the plan.

### Requirement 8: Weekly plan

**User Story:** As a parent, I want to fill a week of meal slots from eligible recipes, so that the whole family knows what he eats each day.

#### Acceptance Criteria

1. THE plan SHALL cover 7 consecutive days from a start date the user picks. The default start date SHALL be the next Monday, or today if today is Monday.
2. THE user SHALL be able to turn each meal slot (breakfast, lunch, dinner, snack) on or off. The defaults SHALL depend on the child's stage, as defined in the design.
3. WHEN the user opens a slot THEN the app SHALL list recipes for that meal type and the child's stage first, show ghosted recipes as disabled, and mark recipes with mystery doors.
4. THE user SHALL be able to replace or clear any slot.
5. WHEN the user starts a new week THEN the app SHALL ask whether to keep the current recipes in the same slots or start empty.
6. THE app SHALL keep one active plan per device.

### Requirement 9: Make-ahead and freezer

**User Story:** As a parent, I want to see what I can cook ahead and freeze, so that I can batch-cook on one prep day.

#### Acceptance Criteria

1. A recipe with freezer storage info SHALL show a pumpkin badge with how long it keeps frozen.
2. THE prep list SHALL show, for each recipe in the plan, the servings needed, the number of batches to cook, and when to cook them.
3. THE prep day SHALL default to the day before the plan's start date, and the user SHALL be able to change it.
4. THE app SHALL schedule cooking by the rules in the design: fridge if every use falls within the recipe's fridge days of cooking, freeze if the recipe can be frozen, and cook fresh otherwise.
5. WHEN the plan changes THEN the prep list SHALL update.

### Requirement 10: Grocery list

**User Story:** As a parent, I want a grocery list built from the week's plan, so that I can shop once.

#### Acceptance Criteria

1. THE grocery list SHALL include every ingredient from non-ghosted slots, multiplied by the number of batches from the prep list.
2. THE list SHALL merge lines with the same food and unit, and SHALL list lines with different units for the same food separately.
3. THE list SHALL group items by grocery category.
4. Ingredients without a quantity SHALL appear as "as needed".
5. THE user SHALL be able to check items off. Checks SHALL persist and SHALL be kept for items that are still on the list after the plan changes.
6. Items with prep reminders SHALL show the reminder.

### Requirement 11: Share and print

**User Story:** As a parent, I want to send the week to family members who cook for him, so that they follow the same plan and safety reminders.

#### Acceptance Criteria

1. THE app SHALL create a share link containing the plan, the full recipes it uses (including custom recipes), the child's age in months, and the tried and reaction-flagged foods.
2. THE share link SHALL carry its data in the URL fragment so that it is not sent to the web host.
3. THE share link SHALL NOT include the child's name or birth date.
4. WHEN someone opens a share link THEN the app SHALL show a read-only plan, prep list, grocery list and recipes, SHALL re-run the safety screen on the shared recipes, and SHALL NOT change any data stored on the viewer's device.
5. IF a share link is invalid or damaged THEN the app SHALL say the link can't be read and SHALL NOT show partial data.
6. IF a share link is longer than the limit in the design THEN the app SHALL warn that some messaging apps may cut it off and suggest the print view.
7. THE app SHALL offer a print view of the plan, prep list and grocery list with prep reminders, readable in black and white.

### Requirement 12: Local data and backup

**User Story:** As a parent, I want my data to stay on my device and be easy to back up, so that I don't need an account and don't lose my recipes.

#### Acceptance Criteria

1. THE app SHALL store all data in the browser's local storage and SHALL NOT require an account.
2. THE app SHALL make no network requests other than loading its own files.
3. THE app SHALL NOT include analytics, ads or third-party trackers.
4. THE app SHALL let the user export all data to a JSON file and import it back.
5. IF an imported file fails validation THEN the app SHALL reject it and leave existing data unchanged.
6. THE stored data SHALL carry a schema version, and the app SHALL migrate older versions on load.
7. IF local storage is unavailable or full THEN the app SHALL show a banner saying changes will not be saved.

### Requirement 13: Health disclaimers and sources

**User Story:** As a parent, I want the app to be plain about its limits, so that I know when to ask our pediatrician.

#### Acceptance Criteria

1. ON first run, in the footer of every page, and on every recipe page, THE app SHALL state that it is not medical advice and to check with a pediatrician.
2. THE app SHALL state that the safety screen checks ingredient names against a fixed list and can miss foods or preparations that are not on it.
3. THE app SHALL have a Sources page listing every rule with its message and source links.

### Requirement 14: Theme and accessibility

**User Story:** As a parent, I want a cute, friendly look that is easy to use on my phone, so that planning feels light and nothing is confusing.

#### Acceptance Criteria

1. THE visual theme SHALL use cute-spooky elements only (friendly ghosts, pumpkins, doors, friendly monsters, a haunted house) and SHALL NOT use frightening imagery, gore or jump scares.
2. EACH theme element SHALL map to a feature as listed in the design.
3. EVERY state shown by a theme element (ghosted, mystery door, friendly monster, freezer-friendly) SHALL also be shown in text that screen readers announce.
4. THE app SHALL meet WCAG 2.1 AA color contrast and SHALL be fully usable with a keyboard.
5. WHEN the user's system requests reduced motion THEN the app SHALL turn off animations.
6. THE app SHALL be usable on screens 360 px wide and up.

### Requirement 15: Hosting and delivery

**User Story:** As the maintainer, I want the app built and deployed automatically from the public repo, so that the working URL is always current for judges and family.

#### Acceptance Criteria

1. THE app SHALL be a static site deployed to GitHub Pages at `https://ashikratnani.github.io/FirstMenu/`.
2. A GitHub Actions workflow SHALL run lint, tests and build on every pull request, and deploy on every push to `main`.
3. THE app SHALL work in the current and previous major versions of Chrome, Safari (including iOS), Firefox and Edge.
4. THE repository SHALL include the MIT license, a README with the app URL and a disclaimer, and a write-up of how Kiro was used.

## Out of scope for v1

- Accounts, cloud sync or live shared editing (Option B).
- Automatically generated plans.
- Nutrition tracking (iron, calories, portions).
- More than one child per device.
- Diagnosing allergies or interpreting reactions.
- Offline install (PWA) and translations.
