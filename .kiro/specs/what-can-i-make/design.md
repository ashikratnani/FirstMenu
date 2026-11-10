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
| Type what you have (search) | New (Requirement 16) | `domain/foodSearch.ts`, `data/foodNames.ts`, `data/searchPhrases.ts`, serving-form and filter logic in `domain/make.ts` |
| Smart suggestions | New (Requirement 17) | `domain/suggest.ts`, Make screen, recipe page ("I made this"), Add recipe ("Paste") |
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
  moreIdeas: MakeResult[];   // only when a filter is active (Requirement 16.12)
}
```

1. `have` = pantry ∪ onHand.
2. For each recipe, required ingredients = not `optional` and not ignored.
3. `missing` = required ingredients whose plain key is not in `have`, de-duplicated.
4. Ghosted (v1 rules, reactions, or uncleared text mentions) → `ghosted`, regardless of `missing`. Filters apply to the ghosted group too, so the "left out" count (Requirement 3.5) shrinks when filters are on: it counts only ghosted recipes that match every active filter.
5. `missing.length === 0` → `readyNow`; `=== 1` → `missingOne`; else dropped.
6. Stage filter (default on): keep recipes whose `stages` include the child's stage. For toddler stages, also keep recipes tagged only for younger stages, and sort them after the child's-stage recipes within each group (Requirement 13.8).
7. "Iron-rich only" filter: keep recipes tagged Iron-rich. This toggle and the `tag:iron-rich` search filter are the same filter: typing "iron rich" turns the toggle on, and turning the toggle off removes the phrase.
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
| mince, minced beef, ground meat, hamburger meat | beef |
| minced chicken | chicken |
| courgette | zucchini |
| aubergine, brinjal | eggplant |
| garbanzo, garbanzo bean, chana | chickpea |
| yoghurt, dahi | yogurt |
| curd ("bean curd" and "lemon curd" are handled by longer entries, below) | yogurt |
| capsicum, pepper (when not "black pepper") | bell pepper |
| coriander leaf, coriander leaves | cilantro |
| rocket | arugula |
| swede | rutabaga |
| bhindi (common in Indian English) | okra |
| bean curd | tofu |
| lady finger, ladyfinger | stop phrase: also a sponge biscuit |
| lemon curd | stop phrase: a sweet spread, not yogurt |
| porridge oats, rolled oats, quick oats, quick cooking oats, old fashioned oats | oat |
| iron fortified cereal, iron fortified infant cereal, baby cereal | cereal |
| whole grain bread, whole wheat bread | bread |
| smooth peanut butter, creamy peanut butter | peanut butter |
| maize, sweetcorn | corn |
| spring onion, scallion | green onion |
| beetroot | beet |
| prawn | shrimp |
| cottage cheese (Indian English sometimes means paneer) | not mapped; shown as cottage cheese |

Targets are food keys exactly as `groceryFoodKey` stores them. Descriptor words like "ground" and "infant" are stripped when keys are made, so the targets are `beef`, `chicken` and `cereal`, not "ground beef" or "infant cereal" (checked against the built-in recipes on November 8: Meat Balls' "lean ground beef" is stored as `beef`). Ambiguous names are not mapped. The list can also hold **stop phrases** that consume their words without adding a food: `lemon curd`, `ladyfinger`, `lady finger`. Because step 3 matches longest first, "bean curd" becomes tofu, "lemon curd" is listed as "Not recognized", and "curd" on its own becomes yogurt. Tests check that every target equals `groceryFoodKey({ name: target })`, that no name maps to two foods, and that "lemon curd" and "ladyfinger" produce no food and appear under "Not recognized".

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
| iron, iron rich · protein · veggie, veggies · fruity · whole grain | `tag:<tag>` | has that nutrition tag |
| make ahead, make-ahead, freeze, freezer, batch, batch cook | `freezer` | `storage.freezerMonths` is set |

  Phrases are stored normalized (`iron rich`, not `iron-rich`). A test checks no phrase is also a known food or other name, comparing plural-aware, so "pick up" never hides a food. "Vegetable" and "fruit" are left out as phrases because recipes use them as food names.

### Serving form (`serveAs`)

`Recipe` gets `serveAs?: Array<'puree' | 'mashed' | 'finger-food' | 'pieces'>` (part of the schema v2 changes).

- **Built-in recipes**: set by hand from the source's texture and steps during the recipe batches (task 14); the v1 recipes are set in batch 1. A test checks every built-in has at least one.
- **Custom and pasted recipes**: derived when `serveAs` is unset, first match per form, from title, texture and steps (whole words, plural-aware):
  - `finger-food`: finger, strips, sticks, bites, puffs, pancake, muffin, fritter, ball, nugget, fries, toast, wedge
  - `puree`: puree, purée, blend, blender, smooth
  - `mashed`: mash, mashed, fork
  - `pieces`: chop, chopped, dice, diced, pieces, cubes
  - nothing matched: the stage default is used, `puree` for `6-8`, `mashed` for `9-12`, `pieces` for toddler stages (the youngest stage the recipe is tagged with). The recipe page shows "Serve as: … (guessed)" so the user can correct it.
- **Simple ideas**: set by hand like other built-ins.

So every recipe always has at least one serving form (Requirement 16.13).
- The recipe page shows "Serve as: …" with an edit button for custom recipes.

### Filters and "More ideas"

- All filters must match (AND). Filters apply to Ready now, Missing one, "Recipes named …" and "More ideas".
- **More ideas** (Requirement 16.12) appears only when at least one filter is active, including the "Iron-rich only" toggle on its own: recipes matching every filter with 2 or more missing foods, not ghosted, sorted by number missing, then time, effort and title, at most 10, each listing what's missing. "I have this" works on each missing food.
- With filters and no foods typed, Ready now and Missing one still use the pantry and on-hand foods.

### Parsing

Steps run in exactly this order. Phrase lists (dish-kind phrases, other names, known foods) are stored in the same normalized form as step 1 produces, so `iron-rich` is stored as `iron rich` and `purée` as `puree`.

1. **Normalize**: lowercase, strip accents, replace hyphens and apostrophes with spaces, remove other punctuation except separators. Numbers stay as tokens for now.
2. **Split** into segments on `,`, `;`, new lines, ` and `, ` with `, `+`, `&`.
3. **One longest-match pass**: in each segment, walk the tokens *as typed* (nothing dropped yet) left to right. At each position, find the longest entry starting there among dish-kind phrases, known foods, other names and stop phrases, plural-aware (`tokenMatches`). On a tie in length, a food or other name wins over a phrase. Consume the match:
   - food or other name → `foods`
   - stop phrase → `unrecognized`, as typed, so the user sees it wasn't counted
   - dish-kind phrase → a phrase candidate (step 4)
   - no entry starts here → leave the token for step 5

   Longest match is what makes "quick oats", "iron fortified cereal", "whole grain bread", "smooth peanut butter", "ground meat" and "sweet potato" come out as foods rather than filters or shorter foods, as long as those names are in the other-names list. It also handles unseparated text like "chicken rice peas".
4. **Descriptor or filter**: a form, speed, effort or food-group phrase (`form:*`, `quick`, `easy`, `tag:*`) that sits next to a food in the same segment, ignoring only filler words in between, describes that food and is dropped, not turned into a filter. A request word in between ("something", "for", …) breaks adjacency, so the phrase stays a filter: "eggs something quick" gives egg plus Quick. Several such phrases in a row next to a food all describe it: "quick mashed banana" gives banana with no filter. So "mashed banana", "mashed ripe banana" and "sweet potato puree" give the foods banana and sweet potato with no filter, while "something mashed for dinner", "finger food" and "iron rich" alone become filters. Meal and `freezer` phrases always become filters.
5. **Drop** filler words, request words and numbers from the tokens left over.
6. **Title words**: remaining tokens of at least 4 letters that match a word in any recipe title (whole word, plural-aware) → `titleWords`.
7. **Typo matching**: Damerau–Levenshtein distance against single-word known foods and other names, never against stop phrases or dish-kind phrases. Allowed distance: 0 for words under 4 letters, 1 for 4–7 letters, 2 for 8 or more. If exactly one candidate has the smallest distance → `didYouMean`; otherwise `unrecognized`.
8. Anything left → `unrecognized`.

Because filler words are dropped only at step 5, they can still be part of a phrase or a food name ("whole grain", "ground meat", "baby cereal"), but never become foods on their own.

Worked examples (required tests). They use the built-in recipes as of November 8, 2026 plus the other-names list; every food in the "Foods" column is either a stored built-in key (chicken, rice, pea, oat, banana, egg, sweet potato, beef, broccoli) or an other-names target (cereal, peanut butter, tofu):

| Typed | Foods | Filters |
| --- | --- | --- |
| leftover chicken, rice and frozen peas | chicken, rice, pea | none |
| something for breakfast | none | Breakfast |
| finger food with chicken | chicken | Finger food |
| quick oats and banana | oat, banana | none |
| something quick with eggs | egg | Quick |
| mashed banana | banana | none |
| mashed ripe banana | banana | none |
| quick cooked rice | rice | none |
| quick mashed banana | banana | none |
| eggs something quick | egg | Quick |
| sweet potato puree for dinner | sweet potato | Dinner |
| iron fortified cereal | cereal | none |
| mince | beef | none |
| iron rich lunch | none | Iron-rich, Lunch |
| smooth peanut butter | peanut butter | none |
| bean curd, lemon curd | tofu | none; "lemon curd" listed under "Not recognized" |
| brocoli | none, "Did you mean broccoli?" | none |

### Screen behavior

- Results use `have = pantry ∪ onHand ∪ result.foods` while typing (Requirement 16.5).
- Enter or "Add" moves `result.foods` into on-hand and clears the box. Tapping a "Did you mean" chip adds that food.
- "Recipes named …" lists recipes whose titles contain any `titleWords`, ghosted ones shown as ghosts, sorted like the other groups.
- The pantry editor (Requirement 2) opens in a dialog with its own name entry, so the Make screen itself has one text box.
- Each filter shows as a removable chip ("Breakfast ✕", "Finger food ✕"). Removing the chip also removes its phrase from the box.
- "More ideas" follows the rules above.
- Parsing runs on every input change, debounced 150 ms.

## Time and effort (`effort.ts`)

### Time

`recipeMinutes(recipe): { minutes: number; kind: 'stated' | 'estimated' } | undefined`

1. If `statedMinutes` is set, use it (`stated`).
2. Otherwise scan each step for durations: a number or range followed by `minute(s)`, `min(s)`, `hour(s)`, `hr(s)`. Ranges ("20-25 minutes", "2 to 3 minutes") use the upper bound. Hours × 60.
3. Within one step, durations joined by "or" are alternatives ("bake about 45 minutes, or microwave about 8 minutes"): use the smallest.
4. Durations with "per side", "each side" or "the other side" count twice.
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

**Task 4.1 result:** the lists in `domain/nutrition.ts` replace the draft above. Only terms named in CDC-iron, CDC-encourage or USDA-FNS-iron were kept, with the quoted evidence in that file's header. Healthy fat has no supporting term in those sources, so it has no rule until task 4.3 finds a sourced term list (see `UNCONFIRMED_TAGS`). Six tags ship first; the maintainer chose this on issue #50.

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

Details (task 5.1): matching uses the safety whole-token, plural-aware helpers. The Dairy tag's exceptions apply here too: the qualifier must directly precede the dairy term (`oat milk`, `peanut butter`, `coconut yogurt`), and `egg` has no exceptions (`egg fried rice`, `soy marinated eggs` stay `dairy-eggs`). `peanut`, `almond`, `oat`, `soy`, `coconut` or `rice` directly before milk or butter (plant milks, nut butters) → `pantry`; directly before other dairy terms → `other`; `breast` or `formula` directly before a dairy term → `other`. `green bean` is produce, `vanilla bean` pantry, `jelly bean` other. A word followed by `free` ("egg-free") is ignored; `dairy free` names are treated as dairy alternatives (milk or butter → `pantry`, other dairy terms → `other`), and `free range eggs` stays `dairy-eggs`. Only the matched bean exception phrase is removed before testing protein terms, so `chicken and green beans` is `protein`. Extra terms: `oatmeal` (grains, one token so `oat` does not match) and `steak` (protein). `buttermilk` counts as dairy.

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
5. Drop common caption filler lines: lines containing "save this", "follow for", "link in bio", "comment", "share with", "tag a". A filler-worded line is kept (it then lands in the steps or notes like any other line) when any block rule fires on it, checked at every age, so the text-mention screen still sees it: "Stir in a spoon of honey, then share with family." stays. Only pure filler is dropped.

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
What do you have?   [ e.g. leftover chicken, rice and peas · something for breakfast ] [ Add ] [ Clear ]
(recognized) chicken ✕  rice ✕  peas ✕   (did you mean) broccoli?   (filters) Breakfast ✕
(suggested) sweet potato  broccoli  spinach  pear  …
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
| `6-8` | 6–8 months | mashed, pureed or strained, very smooth | CDC-solids |
| `9-12` | 9–11 months | thicker and more lumpy foods; soft food cut into small pieces | CDC-solids |
| `12-23` | 12–23 months | soft and mashed, or bite-sized | CDC-encourage |
| `24-36` | 2–3 years | foods that match eating skills, soft and mashed or bite-sized at first | CDC-encourage |

Task 1.3b confirmed the hint wording against Wayback copies of the CDC pages (`STAGE_TEXTURE_HINTS` in `rules.ts` holds each hint, its quote and sources). The CDC pages do not use the phrase "small, bite-sized pieces" and give no age-specific wording for 2 to 3 years, so the toddler hints use one general sentence from the "Starting solid foods" section of the encourage page (match foods to the child's eating skills; soft and mashed or bite-sized at first). It is not an age-specific rule for 2 to 3 years, and a test checks that every content word of each hint appears in its quote.

### Juice limit reminder (Requirement 13.7)

`SafetyRule` gets an optional `fromMonths`. A rule applies while `fromMonths ≤ age < underMonths`; existing rules have no `fromMonths` and behave as before.

| id | Kind | Terms | Except | From | Under | Reminder | Sources |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `juice-limit` | reminder | juice | lemon, lime | 12 mo | 36 mo | 100% juice only, no more than 4 ounces a day. | AAP-juice |

This is a stricter-only change and bumps `RULESET_VERSION`.

## Built-in recipe expansion (Requirement 14)

Target (Requirement 14.1, raised by the maintainer on November 11, 2026): **500** built-ins as the goal and **300** as the hard minimum, **at most 40** of them simple ideas, with per-stage, per-effort and per-allergen-group counts as in Requirement 14.1 and 14.6. A recipe can count toward several stages. The goal is the aim; the hard minimum is what the invariant tests enforce and what ships at the latest.

Available supply, verified on November 11, 2026. Food Hero: the sitemap (`foodhero.org/sitemap.xml`) has 546 `/recipes/` entries; removing 172 `recipe-categories` pages leaves 374 recipe entries, 372 unique URLs. I fetched all 372: 42 return "Page not found" (stale entries, including 2 of the 3 Spanish-titled ones), and the other 330 are live English pages with an ingredient list. Spanish versions live under `/es/recipes/` and are not in the sitemap, so the 372 does not double count English and Spanish and the earlier guess of about 186 was wrong; the unique live English count is **about 330** (counted by fetching each URL, deduplicating by URL and checking for the "Page not found" title and an ingredient list). ICN recipe box: about 142 family child care home recipes (6 servings) plus about 59 six-serving ages 3–5 recipes (counted on November 11, some may overlap). Not every page is usable: screening, texture fit, salt, sugar and honey, and dedupe cut Food Hero to roughly 150–200 usable recipes and ICN to roughly 100–130. Adding the 30 full recipes already merged (10 WIC, 20 batch 2) and up to 40 simple ideas, these sources support about **320 to 400** built-ins, so the 300 hard minimum is safe, 350 to 400 is realistic, and 500 needs other qualifying publishers (a stretch). Supply is the limit for 500 and screening, texture fit and review are the limit below it. The 6-8 and 9-12 stages are limited by what the sources describe for those ages.

| Source | Expected use | Notes |
| --- | --- | --- |
| Minnesota WIC (v1) | 10 existing recipes | Re-tag for toddler stages where the texture fits (meat balls, pancakes, puffs). |
| Simple ideas from WIC and USDA guides | Mostly 6–11 months, up to 40 | Utah WIC "Homemade Baby Foods" lists simple examples by age (6, 8, 10 months). Other WIC and USDA FNS Feeding Infants sheets add more (the cap of 40 was raised from 25 on November 11 so `6-8` can reach its goal). Stored in `data/simpleIdeas.ts`. With the WIC recipes, these carry the `6-8` stage. |
| ICN Child Nutrition Recipe Box (homes, 6 servings; ages 3–5, 6 servings) | Roughly 100–130 usable | Usually no scaling needed. The main source of More-effort recipes. Good for fish (tilapia), tofu, beans, sunflower-seed butter and hummus. Skip the 25–50 and school-size versions when a 6-serving version exists. |
| Food Hero (Oregon State University Extension) | Roughly 150–200 usable | Pages fetch as HTML with exact amounts; about 330 live English recipe pages (372 unique sitemap URLs, 42 of them stale). Prefer the "Kid Approved", "30 Minutes or Less" and "5 Ingredients or Less" lists. Many include salt, sugar or honey, so expect many to be tagged `24-36` only. |

**Recipe source criteria** (Requirement 14.2). A publisher qualifies only if all hold:

1. **Accountable for nutrition content:** a government or public health agency (any country), a WIC or similar nutrition program, a university or extension program, a children's hospital or pediatric health system, or a nonprofit or professional body whose recipes are written or reviewed by registered dietitians.
2. **Free to read:** no login or paywall; fetchable as HTML or PDF.
3. **Exact ingredients with quantities** (feeding-guide simple ideas are exempt, Requirement 14.4).
4. **Not:** a personal or influencer blog, social media, a brand or product marketing site, a recipe aggregator, AI-generated content, or a page whose terms forbid reuse.
5. **In English.**

Prefer publishers already in `docs/recipe-sources.md`; add new ones to fill gaps (allergen groups, stages, meal types). Each new publisher gets a row in `docs/recipe-sources.md` (publisher, type, example URL, criteria notes, verdict, date) in the PR that adds its first recipe, with the verdict "Pending pr-reviewer". After pr-reviewer passes and merges that PR, the next PR updates the verdict to "Approved by pr-reviewer (PR #<n>)". All v1 sourcing rules still apply: ingredients copied, steps reworded, every recipe screened.

**Batches.** Recipes are added in batches of about 50 (40 to 60), one PR each (branch `v2/14-recipes-batch-<n>`, data in `src/data/recipesBatch<n>.ts`, one import line in `recipes.ts`). Each PR keeps the invariant tests green and raises the checkpoint floors (below). Each batch opens a `Recipe review: batch <n>` issue for the primary user and doesn't wait for it. Order: first the scarce cells (stages `6-8` and `9-12`, Easy and Medium; any missing allergen minimums), then `12-23`, then `24-36` with the Medium and More cells, then variety of meal types. Batches 3 onward are cut by gaps in the count table, not by publisher. Two batch PRs may be open at once if they touch different files (they conflict only on the import line in `recipes.ts` and the table in `docs/recipe-sources.md`).

**How the distribution is measured.** `recipes.test.ts` builds a stage by effort table from `BUILTIN_RECIPES`, calling `recipeEffort` from `domain/effort.ts` on each recipe (effort is computed, never stored, so a recipe has one effort in every stage it is tagged for; optional ingredients are ignored by `recipeEffort`). Three constants live in the test file: `HARD_MINIMUM` (Requirement 14.1 and 14.6 tables), `GOAL` (same tables) and `CHECKPOINT` (the floors for the current batch, from the schedule in tasks.md, never above `HARD_MINIMUM` totals once the final batch is in). The tests assert `count >= CHECKPOINT` for the total, simple ideas (`<= 40`), each stage total, each stage by effort cell and each allergen group, and print the whole table with the gap to the goal (`console.table`) so every batch PR body can paste it. Effort cells that the spec accepts as uneven (6-8 Medium and More, 9-12 More) have low minimums by design; the 6-8 More minimum is 0 because More needs more than 8 required ingredients or more than 7 steps, which rarely suits a 6-month-old (proposed, pending maintainer approval, issue to be linked). The existing invariants (no blocks at each stage's youngest age, puree-only recipes not tagged toddler, complete sources, categories) already run over every recipe and need no change. Task 14.4 sets `CHECKPOINT = HARD_MINIMUM`.

**Bundle size and speed with 500 recipes.**

- *Chunk.* Built-in recipe data (`data/recipes.ts`, `data/recipesBatch<n>.ts`, `data/simpleIdeas.ts`) stays in its own `recipe-data` chunk (the `manualChunks` regex in `vite.config.ts` already matches `recipesBatch<n>.ts`), so the Astryx page budget (Requirement 15.6) excludes it. Each batch PR reports the chunk's gzipped size. Measured on November 11 by building (`npm run build`) with 43 built-ins: 45.8 KB raw, 9.94 KB gzipped. 13 of the 43 are simple ideas, which are small (about 0.11 KB gzipped each, by the gzipped share of `simpleIdeas.ts`), so a full recipe is about 0.28 KB gzipped, not 0.4. Extrapolated to 500 with at most 40 simple ideas: 460 × 0.28 + 40 × 0.11 is about 133 KB gzipped (gzip does better on a bigger file with repeated words, so the real figure may be nearer 100 KB; plan for 135 KB). At the 350 to 400 realistic range it is about 95 to 110 KB.
- *Budget proposal.* `scripts/size-report.mjs` gains a recipe-data line with a warning at 160 KB gzipped and a CI failure at 200 KB gzipped (task 14.3, batch 3). The expected size for 500 recipes is about 135 KB, so the warning sits about 20% above it and the failure about 50% above it: 500 recipes will not trip either, while a mistake (for example pasting source text into the data) will. The 200 KB cap is a separate budget from the +250 KB page budget; the app shell plus recipe data is the true first load, so Recipes at +233 KB plus up to 200 KB is the worst case and the maintainer should know that number.
- *Lazy loading, only if needed.* `AppProvider.tsx` and `state/selectors.ts` import the built-ins statically, so the chunk loads on every page. If the chunk passes 160 KB gzipped, or a mid-range phone check in batch 6 shows a slow first paint, switch to `import('../data/recipes')` inside `AppProvider` (built-ins held in state once loaded, the shell and Settings render at once, Make and Recipes show their loading state until the chunk arrives). This is a scope-neutral implementation change, taken under the "decide yourself" rules in `autonomy.md`; do it in its own PR, not inside a recipe batch.
- *Speed.* `makeResults` computes effort, minutes, nutrition tags and required keys per recipe on every call. With 500 recipes plus customs this runs on each keystroke and filter change. Cache the per-recipe derived values (`requiredKeys`, `recipeEffort`, `recipeMinutes`, `recipeNutritionTags`) in a `WeakMap<Recipe, Derived>` in `make.ts`; built-in recipe objects are module constants, and a custom recipe is a new object when edited, so the cache needs no invalidation. Make results are memoized with `useMemo` on (recipes, foods, filters, stage). A Vitest test runs `makeResults` over the built-ins plus 50 generated custom recipes and asserts under 100 ms, and a second test asserts that the cache returns the same object for the same recipe. The Recipes library renders long lists in pages of 50 ("Show more") instead of all 550 cards at once. Search and "More ideas" reuse the same cached values. localStorage is unaffected because built-ins are never stored.
- *Duplicates.* Dedupe (rule 6 below) uses a one-time scratch comparison of main-ingredient keys (`groceryFoodKey`) across the new batch and existing recipes, listed in the batch PR body.

PDFs are read in the sandbox by downloading with `curl` and extracting text with `pdfjs-dist` in a scratch folder outside the repo; it is not an app dependency.

Rules on top of v1's "Built-in recipe sourcing":

1. Salt, sugar, honey or another blocked ingredient: leave it out and record it, as in v1. If the dish depends on it, tag it only for stages where the rule no longer applies (for example sugar and salt: `24-36` only), or skip it.
2. Scaling: only to make 2–6 servings, every quantity by the same factor, rounded to the nearest common kitchen measure. Record "Scaled from N servings to M".
3. Simple ideas: one or two foods, stage from the source's age guidance, quantities left empty (shown as "as needed"), steps reworded, `kind: 'simple-idea'` on the recipe so the UI shows the "Simple idea" label.
4. Tag a recipe for a stage only if its texture fits that stage's texture hint, or can be made to fit by a step the source itself describes (mash, chop).
5. Report to the maintainer if, after the listed and other qualifying publishers, the totals or allergen coverage are under a hard minimum (Requirement 14.7). Misses of a goal only are not sent to the maintainer; they are reported with the final numbers on issue #7.
6. Don't add near-duplicates: two recipes from different sources that have the same main ingredients and method count once; keep the one with the clearer source. The same recipe published in several ICN versions (ages 3-5, ages 6-18, centers, homes) or in English and Spanish counts once.
7. Pick recipes to fill the largest gaps in the stage by effort table, not in the order a site lists them. Effort comes from `recipeEffort`, so check a candidate's effort after adapting it (a removed ingredient or a merged step can change its cell).
8. Other publishers for the remaining volume (about 60 to 100 recipes) must be checked against the source criteria and recorded in `docs/recipe-sources.md` before their first recipe. Candidates, not yet verified: state university extension programs with free recipe databases, other WIC recipe books, NHLBI/NIH, USDA FNS and MyPlate pages, children's hospital pages. Sites that block automated fetches or whose terms forbid reuse are skipped.

`Recipe` gets an optional `kind?: 'recipe' | 'simple-idea'` (default `'recipe'`), added to the schema v2 changes.

## Astryx UI (Requirement 15)

### Trial (gate)

1. Record the v1 build's gzipped JS and CSS sizes from `npm run build` on `main`.
2. Upgrade to React 19 (`react`, `react-dom`, `@types/react`, `@types/react-dom`, and Testing Library if needed). All tests must pass before going further.
3. Install `@astryxdesign/core`, one theme package, `@stylexjs/stylex` (peer dependency), and `@astryxdesign/cli` as a dev dependency. Pin exact versions; Astryx is in beta.
4. Theme: start from the closest Astryx theme and override its CSS custom properties with the v1 palette in `ui/theme/firstmenu.css`. Set `data-astryx-theme` on `<html>`.
5. Font: the Astryx themes name Figtree but don't load it. Self-host it through `@fontsource/figtree` (SIL Open Font License), bundled by Vite. Never use the Google Fonts or CDN setup from the Astryx docs.
6. Convert the app shell (`Layout`), the recipe library and the Settings form.
7. Check: tests and `vitest-axe` pass; keyboard and 360 px work on the converted pages; the heaviest page's first load, excluding the built-in recipe chunk, is within 250 KB gzipped of v1; a new build check (`scripts/check-external.mjs`, run in CI) fails if `dist/` references any `http://` or `https://` URL for fonts, stylesheets or scripts outside the app.
8. Write the results (sizes, findings, screenshots) in the PR. If any check fails, stop and open `Decision needed: Astryx trial`.

### Trial outcome (November 8, 2026)

The first trial build was +320 KB over v1 against the +150 KB budget (issue #37). The maintainer chose the slimmed option:

- **Native date picker.** Astryx DateInput (about 68 KB gzipped on its own) is not used; date fields are native `<input type="date">` styled with the theme tokens. Browsers let a future date be typed past `max`, so forms also check it and block saving.
- **Route-level code splitting.** `src/ui/pages/routes.ts` lazy-loads every page; `App.tsx` wraps the routed page in `<Suspense>` so the shell stays while a page loads. Tests use `routes.eager.ts` through a Vitest alias so component tests stay synchronous; `routes.test.ts` checks both files export the same pages.
- **Size rule.** `scripts/size-report.mjs` reads the Vite manifest and measures each page's first load (entry closure plus the page's static-import closure, JS and CSS, gzipped). Budget: heaviest page at most +250 KB over v1. Result after slimming: heaviest page (Recipes) +224.5 KB; app shell alone 290 KB.

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
- `foodSearch`: step order (phrases before foods before dropping fillers: "mashed", "baby led", "whole grain", "in a hurry", "under 15 minutes", "ground meat" all match), separators and unseparated text, other names and stop phrases ("bean curd" → tofu, "lemon curd" and "ladyfinger" → no food, listed under "Not recognized", "curd" → yogurt), every row of the worked examples, descriptor adjacency ignoring only filler words (request words break it), typo distances and ties, title words, unrecognized words, list checks (every target equals `groceryFoodKey({ name: target })`, no double mapping, no phrase that is also a food).
- `make` filters: serving-form derivation and stage defaults, AND of filters, "Iron-rich only" toggle and "iron rich" phrase are one filter, "More ideas" ordering, cap and ghost exclusion.
- `prompt`: contains age, foods, leave-out labels for 10 and 13 months, reaction foods; never contains name or birth date.
- `storage`: v1 → v2 migration, v1 export import, plan share link from v1 still decodes.
- Components: Make screen groups and "I have this"; paste → preview → save without typing; text mention ghosts and "Not used" clears it.
- a11y: `vitest-axe` on every page after the Astryx conversion.
- `age`: stage boundaries at 8/9, 11/12, 23/24 months; over-36 notice.
- `rules`: `juice-limit` fires at 12 and 35 months, not at 11 or 36; `fromMonths` respected; existing rules unchanged.
- Built-in recipes: the v1 invariant tests extended to four stages, the counts in Requirement 14.1, `kind` set for simple ideas, scaling adaptations recorded when quantities differ from the source.
- Build: `scripts/check-external.mjs` passes in CI.

## Smart suggestions (`suggest.ts`, Requirement 17)

All rules are pure functions of state, the recipe list and the current time, in `domain/suggest.ts`, with no React. Time is passed in (`now: Date`) so tests are deterministic.

### Stored data (added to schema v2, task 1.1)

```ts
interface AppState {
  // ...
  onHandUpdated?: string;                 // YYYY-MM-DD, set whenever onHand changes
  madeLog: Array<{ recipeId: string; date: string }>; // newest first, capped at 100
  onHandDays: Record<string, string[]>;   // food key -> distinct YYYY-MM-DD it was added (last 10)
  dismissed: Record<string, string>;      // suggestion id -> ISO time dismissed
}
```

`MIGRATIONS[1]` sets `madeLog: []`, `onHandDays: {}`, `dismissed: {}`. Deleting a custom recipe removes it from `madeLog`. The plan and recipe share payloads never include these fields.

### "Try this" pick

```ts
pickTryThis(results: MakeResult[], ctx: { now: Date; mealHint?: MealType; madeLog; foods; newFoodKey?: string; dismissed?; ironRich? }): TryThisPick[]
// TryThisPick = { result: MakeResult; score: number; newFood?: string (the one untried food); reason: string }
```

Candidates are Ready now results that are not ghosted, filtered by untried foods (maintainer's option b, PR #41):

1. Never a recipe with two or more untried foods.
2. If a new food is due, a recipe with one untried food is allowed only when that food is the one the new-food banner names, so the screen never offers two different new foods at once (v1 Requirement 7.7). While the new-food banner is dismissed, Try this treats a new food as not due, so rule 3 applies.
3. If no new food is due, a recipe with one untried food is allowed only when it is the **only** non-ghosted Ready now recipe. This count is taken over all Ready now results before any filtering or dismissal, so a recipe with two untried foods, or a dismissed fully tried recipe, still counts as "another recipe" and keeps the untried one out.
4. Whenever the pick has an untried food, its reason starts "Has a new food: <food>".
5. If no candidate is left, the Try this card is hidden, the Make page reports no primary action (`usePagePrimaryAction(false)`), and the shell's "Add recipe" is primary.

Score the remaining candidates (higher is better) and sort; ties go to title order:

| Rule | Points |
| --- | --- |
| Matches the time-of-day meal hint | +3 |
| Time 15 minutes or less (stated or estimated) | +2 |
| Effort Easy | +1 |
| Has the Iron-rich tag | +1 |
| Made today, yesterday or the day before (age 0 to 2 days) | −3 (variety) |

"Show another" walks down the sorted list and wraps. The reason line lists the rules that scored, for example "Ready now · 10 min · Breakfast · Iron-rich".

### Time-of-day meal hint

Local time: 05:00–10:29 breakfast, 10:30–13:59 lunch, 14:00–16:59 snack, 17:00–20:59 dinner, otherwise none. The hint is a ranking signal only: it adds the +3 in the Try this score and shows as a "Suggested: Breakfast" chip. It does not filter results, so it never triggers "More ideas" (Requirement 16.12) on its own. Tapping the chip turns it into a normal `meal:<type>` search filter (Requirement 16.9). Its ✕ records `dismissed['meal-hint']`, and the chip and its score boost are skipped for 4 hours.

### Stale on-hand

If `onHandUpdated` is more than 3 days before today and `onHand` is not empty: a compact prompt above the results, "Still have these? chicken, rice, peas · [Yes, keep] [Clear]". "Yes, keep" sets `onHandUpdated` to today without changing the list.

### New food due

Uses `NEW_FOOD_SPACING_DAYS` and `NEW_FOOD_SPACING_SOURCES` from `safety/rules.ts`, so no new health rule is added. The last new food date is the newest `date` among all `foods` records, `tried` or `reaction`, so a recorded reaction also restarts the wait. Due when that date is at least `NEW_FOOD_SPACING_DAYS` days before today, or no food has been recorded yet. Pick the best-scoring Ready now or Missing one recipe with exactly one untried food, any food, allergen or not. Copy: "Ready for a new food? <Recipe> introduces <food>." with a link to that food on the Foods page. The banner itself makes no health claim. Task 12.1 adds a "New food spacing" entry to the Sources page citing `NEW_FOOD_SPACING_SOURCES` (today no rule cites it, so it isn't listed yet). Allergen doors on the Foods page keep their existing cited guidance.

### Make again

"I made this" on the recipe page appends `{ recipeId, date: today }` (one entry per recipe per day). The Make screen shows up to 5 distinct recipes from `madeLog`, newest first, skipping ghosted ones, as small cards with a secondary "Make again" action.

### Pantry learning

Each day a food is added to on-hand, append the date to `onHandDays[key]` if not already there. When a food has 3 or more dates, is not in the pantry, and `dismissed['pantry:<key>']` is unset, show once: "You often have <food>. Add to pantry? [Add] [No thanks]". "No thanks" dismisses permanently for that food.

### Paste button

`navigator.clipboard.readText()` inside the tap handler only. On success, fill the text box and run "Read recipe". On error or when unsupported, focus the text box and show "Paste with your keyboard or long-press". Never read the clipboard on page load.

### Reasons and dismissal (Requirements 17.8, 17.9)

| Suggestion | "Why this?" reason | Dismiss id | Hidden for |
| --- | --- | --- | --- |
| Try this | scored rules, e.g. "Ready now · 10 min · Breakfast · Iron-rich" | `try-this:<recipe id>` (moves to the next pick) | 24 hours |
| Meal hint chip | "It's breakfast time" | `meal-hint` | 4 hours |
| New food | "3+ days since the last new food", or "No new foods recorded yet" when there are none (spacing from `NEW_FOOD_SPACING_DAYS`) | `new-food` (the whole banner) | 24 hours |
| Still have these? | "Last updated <n> days ago" | `stale-on-hand` | 24 hours, or until on-hand changes |
| Pantry | "Added on <n> different days" | `pantry:<food key>` | permanently ("No thanks") |
| Make again | "Made on <date>" | `make-again` (the whole row) | 24 hours |

`isDismissed(id, now)` compares `dismissed[id]` against the hide time. Times are stored as ISO strings.

### Placement and primary actions

Make screen order: search box, suggested meal chip (with the search filter chips), Try this card, new-food suggestion, stale on-hand prompt, pantry suggestion, Ready now, Missing one, Make again, More ideas. At most two suggestion banners show at once (new food first, then stale on-hand, then pantry).

**One primary button per screen** (Requirement 17.10). Layout's `addRecipeVariant(pathname)` from the Astryx trial can't see page state, so task 10.4 replaces it with a small context:

```tsx
// ui/components/PrimaryAction.tsx
<PrimaryActionProvider>   // in Layout
usePagePrimaryAction(active: boolean)  // a page calls this while it shows its own primary button
```

Layout renders "Add recipe" as `secondary` while any page reports an active primary action, and hides it on `/recipes/new`, `/add` and `/onboarding`. Settings, Print and the edit pages call `usePagePrimaryAction(true)`. The Make page calls it with `true` only while the Try this card is shown. The Layout tests from the trial check variants by pathname with placeholder pages, so task 10.4 rewrites them: placeholder pages call `usePagePrimaryAction`, and the tests check the variant follows it.

All suggestion banner buttons (Yes, keep · Clear · Add · No thanks · Show another · Make again) and "I made this" on the recipe page are secondary. The recipe page has no primary button of its own, so the shell's "Add recipe" stays primary there.

On Add recipe: before a preview, "Paste" is primary and "Read recipe" is secondary. During a preview, "Save recipe" is primary and "Paste" is hidden.

## Decisions confirmed by the maintainer (November 8, 2026)

1. **Text mentions** (Requirement 7): block rules are checked in the steps, title and notes of pasted recipes only, with a one-tap "Not used in this recipe" for false alarms. Typed recipes stay ingredient-only.
2. **Recipe sharing** (Requirement 9): text plus a link that opens the recipe in FirstMenu. No Instagram image cards. First feature to cut if time runs short.
3. **Results groups**: "Ready now" and "Missing one". Recipes missing two or more are hidden, except under "More ideas" when a search filter is active (Requirement 16.12, added later the same day).
4. **Nutrition tags**: seven tags, including Dairy, with lists confirmed against CDC and USDA before they ship.
5. **More recipes** (Requirement 14): Minnesota WIC, simple ideas from WIC and USDA guides, Food Hero and the ICN recipe box. Food Hero is allowed (the earlier "skip Food Hero" instruction from issue #7 no longer applies). Raised again on November 11 to a goal of 500 with a hard minimum of 300 and the stage by effort table in Requirement 14.1. Earlier, on November 8, raised to at least 100 built-ins (at most 25 simple ideas; at least 15 for `6-8`, at least 25 for each other stage) and all nine allergen groups, added in reviewed batches starting right after task 1.
6. **Toddlers** (Requirement 13): up to 36 months, as two stages, 12–23 and 24–36 months.
7. **Astryx** (Requirement 15): trial first, then convert. Build order: trial, new screens and domain, toddler stages, recipes, sharing. The schema and stage plumbing for toddlers (task 1) goes first because every later task builds on the new `StageId`; toddler recipe content comes with the recipe expansion (task 14).
8. **Smart suggestions** (Requirement 17, maintainer UI feedback in issue #36, approved November 9, 2026): Try this card, time-of-day meal hint, stale on-hand prompt, new-food nudge using the existing cited spacing, Make again, pantry learning and a Paste button. All rule-based on the device, no AI service, never a ghosted recipe, never a stored change without a tap. Try this and untried foods: option b. Never two or more. One only when a new food is due and it's the food the new-food banner names, or, when no new food is due, when it's the only non-ghosted Ready now recipe.
