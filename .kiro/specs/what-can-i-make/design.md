# Design Document: What can I make?

## Overview

This change adds pure domain modules and three screens to the built v1 app, moves the week plan off the home route, adds two toddler stages, expands the built-in recipes, and moves the UI to the Astryx design system. Everything new runs in the browser. Nothing new is stored that can be computed.

| Area | New or changed | Where |
| --- | --- | --- |
| Matching what you have | New | `domain/make.ts` |
| Time and effort | New | `domain/effort.ts` |
| Nutrition tags | New | `domain/nutrition.ts` (rules) |
| Paste parser | New | `domain/importText.ts` |
| Grocery category guess | New | `domain/category.ts` |
| Text-mention screen | New function | `domain/safety/screen.ts` |
| Prompt helper | New | `domain/prompt.ts` |
| Recipe share link | New (Requirement 9, first to cut) | `domain/recipeShare.ts` |
| Toddler stages | Changed | `domain/types.ts`, `domain/age.ts`, `safety/rules.ts` |
| Built-in recipes | Expanded | `data/recipes.ts`, new `data/simpleIdeas.ts` |
| Design system | Astryx, after a trial | `package.json`, `ui/theme/`, all pages |
| Schema v2 | Changed | `domain/types.ts`, `domain/storage.ts` |
| Make screen | New, home route | `ui/pages/Make.tsx` |
| Add recipe (paste + preview) | New | `ui/pages/AddRecipe.tsx` |
| Week plan | Moved to `/plan` | `ui/pages/Home.tsx` renamed `Plan.tsx` |

Facts about the current code this design relies on (from the v1 build):

- `screenRecipe(recipe, ageMonths)` screens ingredient names only. Nothing scans steps.
- The private `deriveKeyFromName(name)` in `foods.ts` turns "2 cups diced sweet potatoes" into `sweet potato`. `foodKeyFor` maps allergen ingredients to `allergen:<group>` keys for first tastes; `groceryFoodKey` returns the plain key.
- `Ingredient.category` is required and set by hand today. No name-to-category mapping exists.
- Recipes have no time, effort or nutrition fields. Built-in steps contain times as free text.
- `storage.ts` has `SCHEMA_VERSION = 1`, an empty `MIGRATIONS` registry and a compile-time check that the zod schema matches `AppState`.
- There are 10 built-in recipes, all from Minnesota WIC: 6 tagged `6-8`, 10 tagged `9-12`.

## Data model changes (schema v2)

```ts
interface Ingredient {
  // v1 fields unchanged: name, food?, quantity?, unit?, category
  optional?: boolean;              // "(optional)" in the source; skipped for matching and tags
}

interface Recipe {
  // v1 fields unchanged
  statedMinutes?: number;          // total time written in the recipe, or set by the user
  notes?: string[];                // pasted lines that are neither ingredients nor steps
  imported?: {
    from: 'chatgpt' | 'instagram' | 'shared' | 'other';
    url?: string;                  // user-entered, never fetched
    text: string;                  // original pasted text (Requirement 6.8)
    date: string;                  // YYYY-MM-DD
  };
  clearedMentions?: Array<{ ruleId: string; sentence: string }>; // Requirement 7.4
  kind?: 'recipe' | 'simple-idea';  // Requirement 14.4; default 'recipe'
  serveAs?: Array<'puree' | 'mashed' | 'finger-food' | 'pieces'>; // Requirement 16.13
}

type StageId = '6-8' | '9-12' | '12-23' | '24-36';  // Requirement 13

interface AppState {
  schemaVersion: 2;
  // v1 fields unchanged
  pantry: string[];                // food keys
  onHand: string[];                // food keys
}
```

- `MIGRATIONS[1]` adds `pantry: []`, `onHand: []` and sets `schemaVersion: 2`. All new recipe fields are optional, so v1 recipes need no change.
- A recipe is a **pasted recipe** when `imported` is set.
- The plan share payload (v1) strips `imported.text` and `clearedMentions` to keep links short. Its `v` stays 1 because new fields are optional. Old links decode unchanged.
- Derived, never stored: estimated time, effort, nutrition tags, match groups, text mentions.

## Food keys for pantry and on-hand

`deriveKeyFromName` is exported as `foodKeyFromName(name: string): string` and used for anything the user types into pantry or on-hand. Typing "Sweet potatoes" stores `sweet potato`.

Matching uses **plain keys** only: `groceryFoodKey(ingredient)` for recipe ingredients (it honors the "counts as" override and never returns an allergen key) and `foodKeyFromName` for typed foods. Allergen group keys (`allergen:dairy`) are not used for matching, so having yogurt does not cover butter. First-taste doors keep using `foodKeyFor` as in v1.

Ignored foods (`water`, `breast milk`, `breastmilk`, `formula`, `ice`) are always covered.

## Matching (`make.ts`)

```ts
interface MakeResult {
  recipe: Recipe;
  missing: string[];          // plain keys of uncovered required ingredients
  minutes?: number; minutesKind?: 'stated' | 'estimated';
  effort: 'easy' | 'medium' | 'more';
  tags: NutritionTag[];
}

makeResults(recipes, have: Set<string>, ageMonths, foods, options): {
  readyNow: MakeResult[]; missingOne: MakeResult[]; ghosted: MakeResult[];
}
```

1. `have` = pantry ∪ onHand.
2. For each recipe, required ingredients = not `optional` and not ignored.
3. `missing` = required ingredients whose plain key is not in `have`, de-duplicated.
4. Ghosted (v1 rules, reactions, or uncleared text mentions) → `ghosted`, regardless of `missing`.
5. `missing.length === 0` → `readyNow`; `=== 1` → `missingOne`; else dropped.
6. Stage filter (default on): keep recipes whose `stages` include the child's stage. For toddler stages, also keep recipes tagged only for younger stages, and sort them after the child's-stage recipes within each group (Requirement 13.8).
7. "Iron-rich only" filter: keep recipes tagged Iron-rich.
8. Sort each group by `minutes` ascending (unknown last), then effort (easy, medium, more), then title.

Suggested on-hand chips: all plain keys from required ingredients across all recipes, minus pantry, ordered by how many recipes use them, with the user's recent picks first.

### Suggested pantry list

Shown as tick boxes on first use. Built from the built-in recipes' common ingredients plus a few household staples: oats, rice, infant cereal, flour, egg, butter, plain yogurt, milk, olive oil, cinnamon, frozen peas, banana. Every item is an ordinary food name and passes through `foodKeyFromName`; none is health guidance.

## Type what you have (`foodSearch.ts`, Requirement 16)

Free-text search without a language model. Fuzzy matching only turns her words into foods; deciding what she can make stays exact (`make.ts`), so a near match never puts a recipe in "Ready now" by itself.

```ts
interface FoodSearchResult {
  foods: string[];                               // plain food keys, counted as on hand
  didYouMean: Array<{ typed: string; food: string }>; // typo matches, not counted until tapped
  filters: SearchFilter[];                       // from dish-kind phrases, see below
  titleWords: string[];                          // words matched against recipe titles
  unrecognized: string[];
}
searchHave(text: string, vocabulary: Vocabulary): FoodSearchResult
buildVocabulary(recipes: Recipe[], pantry: string[]): Vocabulary
```

### Vocabulary

- **Known foods**: every plain key (`groceryFoodKey`) from built-in and custom recipe ingredients, the suggested pantry list, and every target in the other-names list.
- **Other names** (`data/foodNames.ts`): a fixed map from an English name to a known food key. Starter list, extended as recipes are added:

| Typed | Food |
| --- | --- |
| mince, minced beef, ground meat, hamburger meat | ground beef |
| minced chicken | ground chicken |
| courgette | zucchini |
| aubergine, brinjal | eggplant |
| garbanzo, garbanzo bean, chana | chickpea |
| curd, yoghurt | yogurt |
| capsicum, pepper (when not "black pepper") | bell pepper |
| coriander leaf, coriander leaves | cilantro |
| rocket | arugula |
| swede | rutabaga |
| lady finger, ladyfinger, bhindi (common in Indian English) | okra |
| porridge oats, rolled oats | oats |
| maize, sweetcorn | corn |
| spring onion, scallion | green onion |
| beetroot | beet |
| prawn | shrimp |
| cottage cheese (Indian English sometimes means paneer) | not mapped; shown as cottage cheese |

Ambiguous names are not mapped. A test checks every target is a known food and no name maps to two foods.

- **Filler words** (dropped): some, any, a, an, the, bit, of, little, few, half, leftover, leftovers, fresh, frozen, cooked, raw, plus the v1 `DESCRIPTOR_WORDS`, `PREP_WORDS`, `UNIT_WORDS` and numbers. "Frozen" is dropped for matching only.
- **Request words** (dropped): something, anything, ideas, idea, for, make, can, i, what, to, recipe, recipes, food (unless part of "finger food"), meal, baby, toddler, kid, kids.
- **Dish-kind phrases** (`data/searchPhrases.ts`), matched longest first before foods, each turning into a `SearchFilter`:

| Phrases | Filter | Applies to recipes where |
| --- | --- | --- |
| breakfast · lunch · dinner, supper · snack, snacks | `meal:<type>` | `mealTypes` includes the type |
| finger food, finger foods, self feeding, self-feeding, baby led, blw, pick up, bites | `form:finger-food` | `serveAs` includes `finger-food` |
| puree, purée, smooth, blended | `form:puree` | `serveAs` includes `puree` |
| mash, mashed, mushy | `form:mashed` | `serveAs` includes `mashed` |
| quick, fast, in a hurry, under 15 minutes | `quick` | time (stated or estimated) is 15 minutes or less |
| easy, simple, no fuss | `easy` | effort is Easy |
| iron, iron rich, iron-rich · protein · veggie, veggies, vegetable · fruit, fruity · whole grain | `tag:<tag>` | has that nutrition tag |
| make ahead, make-ahead, freeze, freezer, batch, batch cook | `freezer` | `storage.freezerMonths` is set |

  A test checks no phrase is also a known food or other name, so "pick up" never hides a food.

### Serving form (`serveAs`)

`Recipe` gets `serveAs?: Array<'puree' | 'mashed' | 'finger-food' | 'pieces'>` (part of the schema v2 changes).

- **Built-in recipes**: set by hand from the source's texture and steps during the recipe batches (task 14); the v1 recipes are set in batch 1. A test checks every built-in has at least one.
- **Custom and pasted recipes**: derived when `serveAs` is unset, first match per form, from title, texture and steps (whole words, plural-aware):
  - `finger-food`: finger, strips, sticks, bites, puffs, pancake, muffin, fritter, ball, nugget, fries, toast, wedge
  - `puree`: puree, purée, blend, blender, smooth
  - `mashed`: mash, mashed, fork
  - `pieces`: chop, chopped, dice, diced, pieces, cubes
  - nothing matched: no form, so the recipe doesn't appear under form filters.
- The recipe page shows "Serve as: …" with an edit button for custom recipes.

### Filters and "More ideas"

- All filters must match (AND). Filters apply to Ready now, Missing one, "Recipes named …" and "More ideas".
- **More ideas** (Requirement 16.12) appears only when at least one filter is active: recipes matching every filter with 2 or more missing foods, not ghosted, sorted by number missing, then time, effort and title, at most 10, each listing what's missing. "I have this" works on each missing food.
- With filters and no foods typed, Ready now and Missing one still use the pantry and on-hand foods.

### Parsing

1. Lowercase, strip accents and punctuation except separators. Split into segments on `,`, `;`, new lines, ` and `, ` with `, `+`, `&`.
2. Within each segment, drop filler words, then match greedily left to right, longest first, against known foods and other names (multi-word first: "sweet potato" before "potato", "black bean" before "bean"). Plural-aware with the safety matcher's `tokenMatches`. This handles unseparated text like "chicken rice peas".
3. Before food matching, dish-kind phrases are matched longest first and removed (→ `filters`), and request words are dropped. Remaining tokens that match a word in any recipe title (whole word, plural-aware, at least 4 letters) → `titleWords`; otherwise try typo matching.
4. **Typo matching**: Damerau–Levenshtein distance against single-word known foods and other names. Allowed distance: 0 for words under 4 letters, 1 for 4–7 letters, 2 for 8 or more. If exactly one candidate has the smallest distance → `didYouMean`; otherwise `unrecognized`.
5. Anything left → `unrecognized`.

### Screen behavior

- Results use `have = pantry ∪ onHand ∪ result.foods` while typing (Requirement 16.5).
- Enter or "Add" moves `result.foods` into on-hand and clears the box. Tapping a "Did you mean" chip adds that food.
- "Recipes named …" lists recipes whose titles contain any `titleWords`, ghosted ones shown as ghosts, sorted like the other groups.
- Each filter shows as a removable chip ("Breakfast ✕", "Finger food ✕"). Removing the chip also removes its phrase from the box.
- "More ideas" follows the rules above.
- Parsing runs on every input change, debounced 150 ms.

## Time and effort (`effort.ts`)

### Time

`recipeMinutes(recipe): { minutes: number; kind: 'stated' | 'estimated' } | undefined`

1. If `statedMinutes` is set, use it (`stated`).
2. Otherwise scan each step for durations: a number or range followed by `minute(s)`, `min(s)`, `hour(s)`, `hr(s)`. Ranges ("20-25 minutes", "2 to 3 minutes") use the upper bound. Hours × 60.
3. Within one step, durations joined by "or" are alternatives ("bake about 45 minutes, or microwave about 8 minutes"): use the smallest.
4. Durations with "per side" or "each side" count twice.
5. If at least one duration was found: `minutes = 5 + sum`, rounded up to the next 5 (`estimated`). The 5 minutes covers washing and setup.
6. If none: undefined ("Time not given").

Required tests use the built-in steps, for example carrots and apples (45 or 8 minutes → about 15), sweet potato chicken (50 or 5 → about 10), cereal pancakes (2-3 minutes per side → about 15), meat balls (20-25 → about 30). Expected values are set from the actual step text in `recipes.ts` when the tests are written.

Built-in recipes don't state a total time in their source, so they get estimates. A built-in recipe gets `statedMinutes` only if its source states a total time.

### Effort

- **Easy**: at most 5 required ingredients, at most 4 steps, and no step mentions `oven`, `bake` or `roast`.
- **More**: more than 8 required ingredients or more than 7 steps.
- **Medium**: everything else.

## Nutrition tags (`nutrition.ts`)

Tags reuse the safety matcher (`matchesTerm`, whole-token, plural-aware) and the same rule shape minus `kind` and `underMonths`:

```ts
interface NutritionRule { tag: NutritionTag; terms: string[]; except?: string[]; sources: SourceId[] }
type NutritionTag = 'iron-rich' | 'protein' | 'vegetable' | 'fruit' | 'whole-grain' | 'dairy' | 'healthy-fat';
```

A recipe gets a tag when any required ingredient name matches. Draft term lists below; task 4.1 confirms each list against its sources and records them. Terms not supported by a source are dropped, not kept, since a wrong tag is not a safety failure but a wrong claim.

| Tag | Draft terms | Except | Sources |
| --- | --- | --- | --- |
| Iron-rich | beef, lamb, pork, chicken, turkey, liver, salmon, tuna, sardine, egg, egg yolk, lentil, bean, chickpea, tofu, infant cereal, iron fortified cereal, spinach | green bean, jelly bean, vanilla bean | CDC-iron, USDA-FNS-iron |
| Protein | beef, lamb, pork, chicken, turkey, fish, salmon, cod, egg, lentil, bean, chickpea, tofu, peanut butter, yogurt | jelly bean, vanilla bean | CDC-encourage |
| Vegetable | sweet potato, carrot, pea, broccoli, squash, spinach, zucchini, cauliflower, green bean, potato, corn, tomato, kale, beet, bell pepper | sweet potato puff | CDC-encourage |
| Fruit | apple, banana, pear, peach, mango, avocado, blueberry, strawberry, raspberry, plum, papaya, kiwi, prune, applesauce | apple juice | CDC-encourage |
| Whole grain | oat, oatmeal, brown rice, quinoa, barley, whole wheat, whole grain | | CDC-encourage |
| Dairy | yogurt, cheese, cottage cheese, ricotta, milk | breast, formula, peanut, almond, oat, soy, coconut, rice | CDC-encourage |
| Healthy fat | avocado, olive oil, salmon, nut butter, peanut butter, almond butter, tahini, ground flaxseed, chia | | CDC-encourage |

New sources added to the sources table (shared with safety rules):

| id | Source |
| --- | --- |
| CDC-iron | [CDC: Iron (Infant and Toddler Nutrition)](https://www.cdc.gov/infant-toddler-nutrition/vitamins-minerals/iron.html) |
| CDC-encourage | [CDC: Foods and drinks to encourage](https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/foods-and-drinks-to-encourage.html) |
| USDA-FNS-iron | [USDA FNS: For parents, making sure your baby gets enough iron (PDF)](https://www.fns.usda.gov/sites/default/files/resource-files/FI_PHa_5MakingSureEnoughIron.pdf) |

The tag explainer (Requirement 5.4): "Tags show which food groups are in a recipe, not how much of each nutrient it gives."

`NUTRITION_VERSION` is bumped when tag lists change. A test checks every term is lowercase and singular, every rule has a source, and each tag fires on at least one built-in recipe or a fixture.

## Grocery category guess (`category.ts`)

`guessCategory(name): GroceryCategory`, first match wins:

1. `frozen` token → `frozen`.
2. Nutrition Dairy terms or `egg`, `butter` → `dairy-eggs`.
3. Meat, poultry, fish, shellfish, tofu, lentil, bean, chickpea → `protein`.
4. Rice, oat, flour, pasta, noodle, bread, cereal, quinoa, barley, cracker → `grains`.
5. Nutrition Vegetable or Fruit terms → `produce`.
6. Oil, spice names (cinnamon, cumin, nutmeg, ginger, garlic powder, paprika, oregano), baking powder, baking soda, vanilla → `pantry`.
7. Otherwise `other`.

Used for pasted recipes only. Typed recipes keep the manual select, pre-filled with the guess.

## Paste parser (`importText.ts`)

```ts
interface ParsedRecipe {
  title: string;
  ingredients: Array<{ name: string; quantity?: number; unit?: string; optional: boolean; line: number }>;
  steps: Array<{ text: string; line: number }>;
  notes: Array<{ text: string; line: number }>;
  statedMinutes?: number;
  servings?: number;
  warnings: string[];                 // e.g. "No ingredient list found"
}
parseRecipeText(text: string): ParsedRecipe
```

### Clean-up

1. Normalize line endings, trim lines, drop empty lines (keep them as section breaks).
2. Strip markdown: `#` headers, `**bold**`, `__bold__`, `*italic*`, inline code ticks.
3. Strip emoji and decorative symbols, but keep `½ ¼ ¾ ⅓ ⅔`.
4. Drop lines made only of hashtags and @mentions, and remove trailing hashtag runs from other lines.
5. Drop common caption filler lines: lines containing "save this", "follow for", "link in bio", "comment", "share with", "tag a".

### Sections

- Ingredient headings: `ingredients`, `what you need`, `what you'll need`, `you will need`, `you'll need`.
- Step headings: `instructions`, `steps`, `method`, `directions`, `how to make`, `how to make it`, `preparation`.
- Notes headings: `notes`, `tips`, `storage`, `serving`.
- A heading may end with `:` and may share its line with content ("Ingredients: 1 banana, 2 tbsp oats").
- Title: a `Title:` line if present; otherwise the first line before the first heading if it is under 80 characters and not a list item; otherwise "Pasted recipe".
- `Total time`, `Ready in`, or `Prep time` + `Cook time` (summed) → `statedMinutes`. `Serves`, `Servings`, `Makes N servings`, `Yield` → `servings`.

### Lists

- List markers: `-`, `*`, `•`, `▪`, `–`, `1.`, `1)`, `Step 1:`.
- An inline ingredient list after a heading on one line is split on commas and " and " only when every piece is under 6 words.
- Without headings (common in captions): consecutive short lines (under 8 words) that start with a quantity, a unit, or a list marker form the ingredient list; numbered lines or sentences with a cooking verb (add, mix, stir, cook, bake, steam, boil, blend, mash, serve, heat, combine, pour, cut, chop) form steps; everything else becomes notes.

### Ingredient lines

- Quantity: integer, decimal, fraction (`1/2`), unicode fraction, mixed (`1 1/2`, `1½`), range (`1-2`, `1 to 2`: use the upper bound).
- Unit: the v1 `UNIT_WORDS` list plus `pinch`, `handful`, `clove`, `slice`, `can`, `jar`.
- `(optional)`, `optional`, `if you like`, `to taste` → `optional: true`. `to taste` is for spices; salt "to taste" is still screened (it's still an ingredient name).
- Name: the rest of the line as written, so the safety screen sees the full name.

### Fixtures

Parser tests use fixtures in `src/domain/__fixtures__/paste/`. v1 of the fixtures is written by Kiro and covers: a ChatGPT reply in the prompt helper's format, a ChatGPT reply in free markdown, an Instagram caption with emoji, hashtags and a one-line ingredient list, a caption with no headings, and a reply that mentions "no salt" in a step. Real pastes from the primary user replace or extend these when she provides them (task 16.1).

## Safety screen for pasted recipes

New function in `safety/screen.ts`:

```ts
interface TextMention { ruleId: string; label: string; message: string; sentence: string; where: 'title' | 'step' | 'note' }
screenTextMentions(recipe: Recipe, ageMonths: number): TextMention[]
```

- Runs only when `recipe.imported` is set (Requirement 7.2).
- Splits title, steps and notes into sentences and runs **block rules only** (with their age limits and exceptions) on each sentence.
- Skips a mention whose rule already has a block finding from the ingredient list (it's already ghosted, and the ingredient finding is the one to fix).
- Drops mentions whose `{ruleId, sentence}` is in `recipe.clearedMentions`. Because the sentence is part of the key, editing the sentence brings the mention back (Requirement 7.6).
- A recipe is ghosted if `screenRecipe` has blocks **or** `screenTextMentions` returns any mention **or** a reaction applies (v1).

There is no negation handling ("no salt", "without honey"). Negation rules would make the screen miss "don't forget the honey". Instead the user clears false alarms with one tap, and the prompt helper asks ChatGPT not to mention left-out foods at all, which avoids most of them.

UI wording for a text mention: "The recipe text mentions **{label}**: "{sentence}". {rule message}" with the button "Not used in this recipe". The recipe page lists cleared mentions under "You marked as not used".

`safety-rules.md` steering is updated to record this exception.

## Prompt helper (`prompt.ts`)

`buildPrompt({ ageMonths, have, stage, leaveOut }): string` returns:

```
Suggest one quick and easy recipe for my {ageMonths}-month-old {baby | toddler (12 months and over)}.
Use only foods from this list (you don't need to use all of them): {have, comma-separated}.
Texture: {the stage texture hint from the table in "Toddler stages"}.
Leave out: {leaveOut, comma-separated}. Don't mention these foods anywhere in your reply.
If you can, include an iron-rich food.
Reply in exactly this format and nothing else:
Title: <name>
Total time: <number> minutes
Serves: <number>
Ingredients:
- <amount> <unit> <ingredient>
Steps:
1. <step>
```

- Texture hints never use a pronoun (no pronoun is stored about the child).
- `leaveOut` = labels of block rules with `underMonths` undefined or greater than `ageMonths`, plus `foodLabel` of each food with a `reaction` record. No name or birth date (Requirement 8.5).
- Texture hints come from the v1 stage texture notes and CDC-solids.
- Buttons: "Copy question" (Clipboard API, with a select-all fallback) and "Open ChatGPT" (a plain link to `https://chatgpt.com/` with `target="_blank" rel="noopener noreferrer"`). A link the user taps is not a request the app makes, so Requirement 12.2 of v1 still holds.
- Then "Paste the answer" opens Add recipe with `from = chatgpt` preselected.
- Helper notice (Requirement 8.9): "AI recipes can be wrong. FirstMenu checks them against its fixed safety list, which can miss things. Check with your pediatrician."

## Screens

### Make (`/`)

```
[ Pantry: 9 foods · Edit ]
What do you have today?   [ type a food… ] [ Clear ]
(chips) sweet potato ✓  chicken ✓  broccoli  spinach  pear  …
[ Iron-rich only ]  [ All stages ]

Ready now (3)
  Sweet potato chicken · about 10 min · Easy · Iron-rich Protein Vegetable · 🚪 New: chicken
  …
Missing one (2)
  Chicken, broccoli and rice · missing: rice  [ I have this ]
3 not safe yet  ▸ show

Nothing fits? [ Ask ChatGPT ]
```

Result cards link to the recipe page. Door badges and ghost cards reuse v1 components.

### Add recipe (`/add`)

1. Source picker (ChatGPT, Instagram, Other) and optional link.
2. Large text area, "Read recipe".
3. Preview: title, ingredient rows (each with ✕, edit, "move to steps/notes"), step rows, notes, time, effort, tags, safety results including text mentions. "Save recipe".
4. Help text: "Instagram reels can't be opened here. Copy the caption instead. On a phone, you can also copy text from a screenshot by pressing and holding on it."
5. Link to the typed editor ("Type a recipe instead").

Saving builds a `Recipe` with `origin: 'custom'`, the child's stage, all meal types, guessed categories, texture `"As described in the recipe"` plus the stage hint, `imported`, and goes through the existing `saveCustomRecipe` action.

### Plan (`/plan`)

The v1 Home week grid, unchanged, plus a sub-navigation: Week · Prep · Grocery · Share · Print. `/prep`, `/grocery`, `/share`, `/print` stay as routes.

### Recipe page additions

Time and effort, nutrition tags with the explainer, "Original text" (collapsed) for pasted recipes, cleared mentions, "Add to plan", and "Share recipe" (Requirement 9).

## Toddler stages (Requirement 13)

```ts
type StageId = '6-8' | '9-12' | '12-23' | '24-36';   // '9-12' kept for v1 data; labeled "9–11 months"
stageFor(m): m < 9 ? '6-8' : m < 12 ? '9-12' : m < 24 ? '12-23' : '24-36'
defaultSlots('12-23' | '24-36') = [breakfast, lunch, dinner, snack]
```

- Extending the `StageId` union and its zod enum needs no migration; existing data only uses the two old ids.
- The v1 test "no block findings at the youngest age of each tagged stage" covers the new stages at 12 and 24 months.
- Age notices: under 6 months unchanged; over 36 months: "FirstMenu is designed for 6 months to 3 years. Safety rules still use your child's actual age." The 12-month notice from v1 is removed.

| Stage | Label | Texture hint | Source |
| --- | --- | --- | --- |
| `6-8` | 6–8 months | smooth or well-mashed | CDC-solids |
| `9-12` | 9–11 months | mashed, or soft small pieces to pick up | CDC-solids |
| `12-23` | 12–23 months | soft, small, bite-sized pieces | CDC-encourage |
| `24-36` | 2–3 years | small, bite-sized pieces | CDC-encourage |

Task 1 confirms the hint wording against the sources and adjusts it to match them.

### Juice limit reminder (Requirement 13.7)

`SafetyRule` gets an optional `fromMonths`. A rule applies while `fromMonths ≤ age < underMonths`; existing rules have no `fromMonths` and behave as before.

| id | Kind | Terms | Except | From | Under | Reminder | Sources |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `juice-limit` | reminder | juice | lemon, lime | 12 mo | 36 mo | 100% juice only, no more than 4 ounces a day. | AAP-juice |

This is a stricter-only change and bumps `RULESET_VERSION`.

## Built-in recipe expansion (Requirement 14)

Target: **at least 100** built-ins, **at most 25** of them simple ideas, **at least 15** tagged `6-8` and **at least 25** for each other stage, and all nine allergen groups. A recipe can count toward several stages.

Available supply, counted on November 8, 2026: Food Hero's sitemap lists 368 recipes; the ICN recipe box has about 125 recipes for family child care homes (6 servings) plus about 58 six-serving recipes for ages 3–5. Supply is not the limit; screening, texture fit and review are.

| Source | Expected use | Notes |
| --- | --- | --- |
| Minnesota WIC (v1) | 10 existing recipes | Re-tag for toddler stages where the texture fits (meat balls, pancakes, puffs). |
| Simple ideas from WIC and USDA guides | Mostly 6–11 months, up to 25 | Utah WIC "Homemade Baby Foods" lists simple examples by age (6, 8, 10 months). Other WIC and USDA FNS Feeding Infants sheets add more. Stored in `data/simpleIdeas.ts`. With the WIC recipes, these carry the `6-8` stage. |
| ICN Child Nutrition Recipe Box (homes, 6 servings; ages 3–5, 6 servings) | Roughly 30–40 | Usually no scaling needed. Good for fish (tilapia), tofu, beans, sunflower-seed butter and hummus. Skip the 25–50 and school-size versions when a 6-serving version exists. |
| Food Hero (Oregon State University Extension) | Roughly 30–40 | Pages fetch as HTML with exact amounts. Prefer the "Kid Approved", "30 Minutes or Less" and "5 Ingredients or Less" lists. Many include salt, sugar or honey, so expect many to be tagged `24-36` only. |

**Batches.** Recipes are added in batches of about 20, one PR each (branch `v2/14-recipes-batch-<n>`). Each PR keeps the invariant tests green for the recipes so far. Each batch opens a `Recipe review: batch <n>` issue for the primary user and doesn't wait for it. Order: batch 1 re-tags the WIC recipes and adds simple ideas (covers `6-8` early); later batches prioritize missing allergen groups, then stage counts, then variety of meal types.

**Bundle size.** Built-in recipe data (`data/recipes.ts`, `data/simpleIdeas.ts`) is put in its own chunk with Vite `build.rollupOptions.output.manualChunks`, so the Astryx size budget (Requirement 15.6) excludes it. Each recipe batch PR reports that chunk's gzipped size. Rough estimate for 100 recipes: 30–50 KB gzipped.

PDFs are read in the sandbox by downloading with `curl` and extracting text with `pdfjs-dist` in a scratch folder outside the repo; it is not an app dependency.

Rules on top of v1's "Built-in recipe sourcing":

1. Salt, sugar, honey or another blocked ingredient: leave it out and record it, as in v1. If the dish depends on it, tag it only for stages where the rule no longer applies (for example sugar and salt: `24-36` only), or skip it.
2. Scaling: only to make 2–6 servings, every quantity by the same factor, rounded to the nearest common kitchen measure. Record "Scaled from N servings to M".
3. Simple ideas: one or two foods, stage from the source's age guidance, quantities left empty (shown as "as needed"), steps reworded, `kind: 'simple-idea'` on the recipe so the UI shows the "Simple idea" label.
4. Tag a recipe for a stage only if its texture fits that stage's texture hint, or can be made to fit by a step the source itself describes (mash, chop).
5. Stop and report if, after going through these sources, the totals or allergen coverage are under the targets.
6. Don't add near-duplicates: two recipes from different sources that have the same main ingredients and method count once; keep the one with the clearer source.

`Recipe` gets an optional `kind?: 'recipe' | 'simple-idea'` (default `'recipe'`), added to the schema v2 changes.

## Astryx UI (Requirement 15)

### Trial (gate)

1. Record the v1 build's gzipped JS and CSS sizes from `npm run build` on `main`.
2. Upgrade to React 19 (`react`, `react-dom`, `@types/react`, `@types/react-dom`, and Testing Library if needed). All tests must pass before going further.
3. Install `@astryxdesign/core`, one theme package, `@stylexjs/stylex` (peer dependency), and `@astryxdesign/cli` as a dev dependency. Pin exact versions; Astryx is in beta.
4. Theme: start from the closest Astryx theme and override its CSS custom properties with the v1 palette in `ui/theme/firstmenu.css`. Set `data-astryx-theme` on `<html>`.
5. Font: the Astryx themes name Figtree but don't load it. Self-host it through `@fontsource/figtree` (SIL Open Font License), bundled by Vite. Never use the Google Fonts or CDN setup from the Astryx docs.
6. Convert the app shell (`Layout`), the recipe library and the Settings form.
7. Check: tests and `vitest-axe` pass; keyboard and 360 px work on the converted pages; the size increase, excluding the built-in recipe chunk, is within 150 KB gzipped; a new build check (`scripts/check-external.mjs`, run in CI) fails if `dist/` references any `http://` or `https://` URL for fonts, stylesheets or scripts outside the app.
8. Write the results (sizes, findings, screenshots) in the PR. If any check fails, stop and open `Decision needed: Astryx trial`.

### After the trial

- New screens (Make, Add recipe, Plan sub-navigation) are built with Astryx from the start.
- Remaining v1 pages (Foods, Recipe page, editor, Prep, Grocery, Share, Sources, Onboarding) are converted afterwards. Print keeps its own print CSS.
- CSS modules stay for app-specific pieces (theme art, week grid). Astryx components accept `className`, so no wrappers are needed.
- `tech.md` is updated in the trial PR to name Astryx and React 19 as the stack.
- UI feedback: at the start of the trial, open `Decision needed: what to change in the UI` asking for the primary user's specific complaints. Apply them when they arrive, without waiting.

## Recipe share (`recipeShare.ts`, Requirement 9, first to cut)

- Payload `{ v: 1, recipe }` where `recipe` has `imported` reduced to `{ from: 'shared', date }` and no `clearedMentions` or `food` overrides. Encoded with lz-string into `#/r/<data>`. Validated with `recipeSchema` on decode.
- The read-only view renders the recipe with the viewer's own safety screen and offers "Add to my recipes", which saves it as a pasted recipe with `imported.text` set to the shared text, so text-mention screening applies.
- Text for the share sheet is built by `recipeShareText(recipe, screenResult)`.
- `navigator.share({ title, text, url })` when available; otherwise copy `text + "\n" + url` to the clipboard.

## Error handling

| Situation | Behavior |
| --- | --- |
| Paste has no recognizable ingredients | Warning plus "mark lines as ingredients" mode (Requirement 6.6). |
| Paste is empty or over 20,000 characters | Inline message; over-limit text is not parsed. |
| Clipboard API unavailable | Select the prompt text and ask the user to copy. |
| `navigator.share` rejected or cancelled | No error shown; copy fallback offered. |
| Bad recipe share link | "This link can't be read." Nothing rendered. |
| v1 data on load | Migrated to v2. |

## Testing strategy

- `importText`: every fixture, plus unit tests for quantity forms, headings on the same line, inline lists, emoji and hashtag stripping, optional markers, time and servings lines.
- `screenTextMentions`: fires in steps, title and notes; respects age limits; skips rules already blocked by ingredients; cleared mention stays cleared until its sentence changes; doesn't run for non-pasted recipes.
- `make`: ready now, missing one, ghosted exclusion, ignored and optional ingredients, plain-key allergen matching (yogurt doesn't cover butter), stage and iron filters, sort order.
- `effort`: the built-in examples above, ranges, "or" alternatives, per side, hours, none found.
- `nutrition`: term format, sources, each tag fires, `except` cases (green bean is not Iron-rich via `bean`).
- `category`: one case per category and the fallback.
- `prompt`: contains age, foods, leave-out labels for 10 and 13 months, reaction foods; never contains name or birth date.
- `storage`: v1 → v2 migration, v1 export import, plan share link from v1 still decodes.
- Components: Make screen groups and "I have this"; paste → preview → save without typing; text mention ghosts and "Not used" clears it.
- a11y: `vitest-axe` on every page after the Astryx conversion.
- `age`: stage boundaries at 8/9, 11/12, 23/24 months; over-36 notice.
- `rules`: `juice-limit` fires at 12 and 35 months, not at 11 or 36; `fromMonths` respected; existing rules unchanged.
- Built-in recipes: the v1 invariant tests extended to four stages, the counts in Requirement 14.1, `kind` set for simple ideas, scaling adaptations recorded when quantities differ from the source.
- Build: `scripts/check-external.mjs` passes in CI.

## Decisions confirmed by the maintainer (November 8, 2026)

1. **Text mentions** (Requirement 7): block rules are checked in the steps, title and notes of pasted recipes only, with a one-tap "Not used in this recipe" for false alarms. Typed recipes stay ingredient-only.
2. **Recipe sharing** (Requirement 9): text plus a link that opens the recipe in FirstMenu. No Instagram image cards. First feature to cut if time runs short.
3. **Results groups**: only "Ready now" and "Missing one". Recipes missing two or more are hidden.
4. **Nutrition tags**: seven tags, including Dairy, with lists confirmed against CDC and USDA before they ship.
5. **More recipes** (Requirement 14): Minnesota WIC, simple ideas from WIC and USDA guides, Food Hero and the ICN recipe box. Food Hero is allowed (the earlier "skip Food Hero" instruction from issue #7 no longer applies). Raised on November 8 to at least 100 built-ins (at most 25 simple ideas; at least 15 for `6-8`, at least 25 for each other stage) and all nine allergen groups, added in reviewed batches starting right after task 1.
6. **Toddlers** (Requirement 13): up to 36 months, as two stages, 12–23 and 24–36 months.
7. **Astryx** (Requirement 15): trial first, then convert. Build order: trial, new screens and domain, toddler stages, recipes, sharing. The schema and stage plumbing for toddlers (task 1) goes first because every later task builds on the new `StageId`; toddler recipe content comes with the recipe expansion (task 14).
