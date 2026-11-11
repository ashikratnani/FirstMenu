// Built-in recipe data (Requirement 2, design.md "Built-in recipe sourcing").
// Pure data, no React.
//
// OPTION 4 REDUCED FIRST BATCH (maintainer decision, GitHub issue #7)
// --------------------------------------------------------------------
// This is the first, intentionally SMALL batch of built-in recipes. In this
// environment web_fetch can only reach the two Minnesota WIC HTML recipe pages
// that carry real recipe content, which cover the allergen groups dairy, egg
// and wheat only. The maintainer explicitly approved shipping this smaller but
// fully-compliant batch now (Option 4). The remaining six allergen groups
// (peanut, tree nuts, soy, fish, shellfish, sesame) and the full Requirement 2
// coverage targets (>=24 recipes, >=10 per stage, all nine allergen groups) are
// DEFERRED and tracked on issue #7 as follow-up work.
//
// SOURCING RULES FOLLOWED (design.md "Built-in recipe sourcing"):
//  1. Every recipe comes from a real published source with a working URL; we do
//     NOT invent recipes and we do NOT use any tier-3 source (Food Hero skipped
//     per the maintainer). Both sources here are tier-1 US public-health (MN WIC).
//  2. Ingredients and quantities are copied from the source; the method steps
//     are rewritten in our own words, keeping the source's method/times/temps.
//  3. The safety screen is run at the youngest age of each tagged stage (6 months
//     for '6-8', 9 months for '9-12'). Where an ingredient would block, we use
//     only the source's own safe option (e.g. water instead of apple juice,
//     plain instead of vanilla yogurt). We never silently drop a non-blocked
//     source ingredient. Any recipe that would need other changes is SKIPPED.
//     (No recipe below has a block at its tagged ages.)
//  4. Stages are tagged from the source's age guidance and texture. The
//     infantfoods.html page states only that its recipes are "suitable for
//     infants over 6 months of age"; it gives NO explicit 9-12 age. The baked /
//     finger-food recipes (pancakes, meatballs, puffs) are therefore tagged
//     '9-12' BY TEXTURE (finger foods / baked items older infants can self-feed),
//     not from an explicit source age. Smooth purees -> '6-8' (and also fine as
//     '9-12'). Per-recipe rationale is noted in comments.
//  5. Storage times: where the recipe's own source does not state fridge/freezer
//     times for the COOKED dish, we fall back to the Minnesota WIC homemade baby
//     food guidance (babyfood.html): refrigerate no more than 2 days, with
//     meats/eggs/fish/chicken used within 1 day, and freeze for up to 1 month.
//     The infantfoods.html "Storing Leftover Infant Foods" 3-5 day / 4-6 month
//     ranges describe jarred-leftover storage, NOT these cooked recipes, so we do
//     not use them. Each recipe that sets storage records a `source.storageSource`
//     URL pointing at the homemade-guidance page (babyfood.html).
//  6. publisher / url / retrieved recorded honestly (retrieved on fetch date).
//
// SERVINGS (maintainer Option A, issue #9)
// --------------------------------------------------------------------
// The Minnesota WIC baby-food recipes give no serving/yield counts (the one
// exception is Cereal Pancakes, which states "Makes approximately twelve 4\"
// pancakes"). For every other recipe we ESTIMATE servings deterministically from
// the ingredient quantities so the number is reproducible and auditable:
//
//   servings = max(1, round(totalYieldOz / INFANT_PORTION_OZ))
//
// with a 2 oz (~60 ml) infant portion. The total cooked yield in ounces is the
// sum of each ingredient quantity converted with ONE fixed conversion table
// (applied uniformly to every recipe, nutritional precision is not the point):
//
//   1 cup            = 8 oz        1 tbsp = 0.5 oz      1 tsp = 0 oz (negligible)
//   1 lb             = 16 oz       1 (4 oz) jar = 4 oz   1 pinch = 0 oz (negligible)
//   1 egg / egg yolk = 1 oz  (piece)
//   1 apple          = 5 oz  (piece)
//   1 sweet potato   = 5 oz  (piece)
//
// Each estimated recipe carries its YIELD_OZ in a comment so the arithmetic can
// be checked, and an adaptations note that the serving count is an estimate. The
// matching test (recipes.test.ts) recomputes servings from YIELD_OZ via the same
// helper so the pinned numbers cannot silently drift.

import type { Recipe } from '../domain/types';
import { BATCH_2_RECIPES } from './recipesBatch2';
import { BATCH_3_RECIPES } from './recipesBatch3';
import { BATCH_4_RECIPES } from './recipesBatch4';
import { BATCH_5_RECIPES } from './recipesBatch5';
import { BATCH_6_RECIPES } from './recipesBatch6';
import { SIMPLE_IDEAS } from './simpleIdeas';

const BABYFOOD_URL = 'https://www.health.state.mn.us/people/wic/recipes/babyfood.html';
const INFANTFOODS_URL = 'https://www.health.state.mn.us/people/wic/recipes/infantfoods.html';
const PUBLISHER = 'Minnesota Department of Health, WIC Program';
const RETRIEVED = '2026-11-07';

/** A single infant serving, in ounces (~60 ml). Used by {@link estimateServings}. */
export const INFANT_PORTION_OZ = 2;

/**
 * Deterministic serving estimate for recipes whose source gives no yield
 * (maintainer Option A, issue #9): round total cooked yield (oz) down/up to the
 * nearest whole 2 oz infant portion, never below 1. See the SERVINGS block at
 * the top of this file for the fixed oz conversion table used to derive yieldOz.
 */
export function estimateServings(yieldOz: number): number {
  return Math.max(1, Math.round(yieldOz / INFANT_PORTION_OZ));
}

/** Note appended to adaptations when servings are estimated (not from the source). */
const SERVINGS_ESTIMATE_NOTE =
  'Serving count is an estimate (source gives no yield): total cooked yield \u00f7 a 2 oz infant portion.';

export const RECIPES: Recipe[] = [
  // --- Minnesota WIC "Homemade Baby Food" (babyfood.html) -------------------
  {
    // Smooth puree/mash with no added salt, sugar or honey -> fine from 6 months;
    // still appropriate (mashed) at 9-12, so tagged both stages.
    // YIELD_OZ = carrots 1 cup (8) + apple 1 piece (5) + water 1/4 cup (2) = 15
    // -> estimateServings(15) = round(7.5) = 8.
    id: 'b-carrots-and-apples',
    origin: 'builtin',
    source: {
      title: 'Carrots and Apples',
      publisher: PUBLISHER,
      url: BABYFOOD_URL,
      retrieved: RETRIEVED,
      adaptations: [SERVINGS_ESTIMATE_NOTE],
      storageSource: BABYFOOD_URL,
    },
    title: 'Carrots and Apples',
    // Toddler tag rationale: Smooth puree or mash only, so no toddler stage.
    stages: ['6-8', '9-12'],
    serveAs: ['puree', 'mashed'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'carrots, peeled and sliced', quantity: 1, unit: 'cup', category: 'produce' },
      { name: 'medium apple, peeled, cored and quartered', quantity: 1, unit: 'piece', category: 'produce' },
      { name: 'water', quantity: 0.25, unit: 'cup', category: 'other' },
    ],
    steps: [
      'Add the carrots and apple to a baking dish or microwave-safe container, then pour the water over them.',
      'Cover and cook until tender: bake about 45 minutes at 350\u00b0F, or microwave about 8 minutes on high.',
      'Puree or mash with a fork, stirring in some of the cooking liquid until the texture is right for your baby.',
    ],
    texture: 'smooth puree or mash',
    servings: estimateServings(15),
    storage: { fridgeDays: 2, freezerMonths: 1 },
  },
  {
    // Blended/mashed to desired smoothness, no added salt/sugar/honey -> 6 months
    // and up; also works mashed at 9-12. Tagged both stages.
    // YIELD_OZ = sweet potato 1 piece (5) + chicken 1/4 cup (2) + brown rice
    // 1/2 cup (4) + liquid 1/2 cup (4) = 15 -> estimateServings(15) = 8.
    id: 'b-sweet-potato-chicken',
    origin: 'builtin',
    source: {
      title: 'Sweet Potato Chicken',
      publisher: PUBLISHER,
      url: BABYFOOD_URL,
      retrieved: RETRIEVED,
      adaptations: [SERVINGS_ESTIMATE_NOTE],
      storageSource: BABYFOOD_URL,
    },
    title: 'Sweet Potato Chicken',
    // Toddler tag rationale: Blended or mashed only, so no toddler stage.
    stages: ['6-8', '9-12'],
    serveAs: ['puree', 'mashed'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'small sweet potato', quantity: 1, unit: 'piece', category: 'produce' },
      { name: 'cooked chicken, cut into bite-size pieces', quantity: 0.25, unit: 'cup', category: 'protein' },
      { name: 'cooked brown rice', quantity: 0.5, unit: 'cup', category: 'grains' },
      { name: 'breastmilk, water or prepared formula', quantity: 0.5, unit: 'cup', category: 'other' },
    ],
    steps: [
      'Wash the sweet potato and cook until soft all the way through: bake about 50 minutes at 425\u00b0F, or microwave about 5 minutes on high.',
      'Peel the sweet potato, then combine it with the chicken, rice and liquid.',
      'Blend, mash or grind until as smooth as you want.',
    ],
    texture: 'smooth puree or mash',
    servings: estimateServings(15),
    // Chicken is present, so use the shorter 1-day fridge window from the
    // homemade-guidance page (meats/eggs/fish/chicken within 1 day).
    storage: { fridgeDays: 1, freezerMonths: 1 },
  },
  {
    // Mix & Match Meal, instantiated as the source's own suggested combination
    // "Beef, peas, and potatoes". Blended/mashed, no added salt/sugar/honey.
    // YIELD_OZ = beef 1 cup (8) + potatoes 1/2 cup (4) + peas 3/4 cup (6) +
    // liquid 3/4 cup (6) = 24 -> estimateServings(24) = 12.
    id: 'b-beef-peas-potatoes',
    origin: 'builtin',
    source: {
      title: 'Mix & Match Meal',
      publisher: PUBLISHER,
      url: BABYFOOD_URL,
      retrieved: RETRIEVED,
      adaptations: [
        'Instantiated the page\u2019s suggested combination: beef, peas and potatoes',
        SERVINGS_ESTIMATE_NOTE,
      ],
      storageSource: BABYFOOD_URL,
    },
    title: 'Beef, Peas and Potatoes',
    // Toddler tag rationale: Served as puree or mash only (steps blend, grind or mash), so no toddler stage.
    stages: ['6-8', '9-12'],
    serveAs: ['puree', 'mashed'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'cooked cubed beef', quantity: 1, unit: 'cup', category: 'protein' },
      { name: 'cooked diced potatoes', quantity: 0.5, unit: 'cup', category: 'produce' },
      { name: 'cooked peas', quantity: 0.75, unit: 'cup', category: 'produce' },
      { name: 'breastmilk, water or prepared formula', quantity: 0.75, unit: 'cup', category: 'other' },
    ],
    steps: [
      'Combine the beef, potatoes, peas and liquid.',
      'Blend, grind or mash until as smooth as you want.',
    ],
    texture: 'smooth puree or mash',
    servings: estimateServings(24),
    storage: { fridgeDays: 1, freezerMonths: 1 },
  },
  {
    // Mix & Match Meal -> "Chicken, broccoli, and rice" combination.
    // YIELD_OZ = chicken 1 cup (8) + rice 1/2 cup (4) + broccoli 3/4 cup (6) +
    // liquid 3/4 cup (6) = 24 -> estimateServings(24) = 12.
    id: 'b-chicken-broccoli-rice',
    origin: 'builtin',
    source: {
      title: 'Mix & Match Meal',
      publisher: PUBLISHER,
      url: BABYFOOD_URL,
      retrieved: RETRIEVED,
      adaptations: [
        'Instantiated the page\u2019s suggested combination: chicken, broccoli and rice',
        SERVINGS_ESTIMATE_NOTE,
      ],
      storageSource: BABYFOOD_URL,
    },
    title: 'Chicken, Broccoli and Rice',
    // Toddler tag rationale: Served as puree or mash only (steps blend, grind or mash), so no toddler stage.
    stages: ['6-8', '9-12'],
    serveAs: ['puree', 'mashed'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'cooked cubed chicken', quantity: 1, unit: 'cup', category: 'protein' },
      { name: 'cooked rice', quantity: 0.5, unit: 'cup', category: 'grains' },
      { name: 'cooked diced broccoli', quantity: 0.75, unit: 'cup', category: 'produce' },
      { name: 'breastmilk, water or prepared formula', quantity: 0.75, unit: 'cup', category: 'other' },
    ],
    steps: [
      'Combine the chicken, rice, broccoli and liquid.',
      'Blend, grind or mash until as smooth as you want.',
    ],
    texture: 'smooth puree or mash',
    servings: estimateServings(24),
    storage: { fridgeDays: 1, freezerMonths: 1 },
  },
  {
    // Mix & Match Meal -> "Beef, squash, and macaroni" combination. Note: the
    // token "macaroni" is in the wheat allergen rule's terms (added in
    // RULESET_VERSION 2), so "cooked macaroni" surfaces a wheat allergen door
    // here. Allergen rules never block, so there is still no block at the tagged
    // ages; wheat coverage for the batch also comes from the flour and baby
    // cereal in b-cereal-pancakes.
    // YIELD_OZ = beef 1 cup (8) + macaroni 1/2 cup (4) + squash 3/4 cup (6) +
    // liquid 3/4 cup (6) = 24 -> estimateServings(24) = 12.
    id: 'b-beef-squash-macaroni',
    origin: 'builtin',
    source: {
      title: 'Mix & Match Meal',
      publisher: PUBLISHER,
      url: BABYFOOD_URL,
      retrieved: RETRIEVED,
      adaptations: [
        'Instantiated the page\u2019s suggested combination: beef, squash and macaroni',
        SERVINGS_ESTIMATE_NOTE,
      ],
      storageSource: BABYFOOD_URL,
    },
    title: 'Beef, Squash and Macaroni',
    // Toddler tag rationale: Served as puree or mash only (steps blend, grind or mash), so no toddler stage.
    stages: ['6-8', '9-12'],
    serveAs: ['puree', 'mashed'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'cooked cubed beef', quantity: 1, unit: 'cup', category: 'protein' },
      { name: 'cooked macaroni', quantity: 0.5, unit: 'cup', category: 'grains' },
      { name: 'cooked diced squash', quantity: 0.75, unit: 'cup', category: 'produce' },
      { name: 'breastmilk, water or prepared formula', quantity: 0.75, unit: 'cup', category: 'other' },
    ],
    steps: [
      'Combine the beef, macaroni, squash and liquid.',
      'Blend, grind or mash until as smooth as you want.',
    ],
    texture: 'smooth puree or mash',
    servings: estimateServings(24),
    storage: { fridgeDays: 1, freezerMonths: 1 },
  },

  // --- Minnesota WIC "Infant Food Recipes" (infantfoods.html) ---------------
  {
    // Griddle pancakes are a soft finger food; tagged '9-12' BY TEXTURE (the page
    // states only "over 6 months", with no explicit 9-12 age). Source lists
    // "water or apple juice"; apple juice blocks under 12 months, so we use water
    // (the source's own option). vanilla extract and cinnamon are not blocks.
    // The source states a yield ("Makes approximately twelve 4\" pancakes"), so
    // servings is the SOURCE yield (12), not an estimate.
    id: 'b-cereal-pancakes',
    origin: 'builtin',
    source: {
      title: 'Cereal Pancakes',
      publisher: PUBLISHER,
      url: INFANTFOODS_URL,
      retrieved: RETRIEVED,
      adaptations: ['Water instead of apple juice', 'Butter instead of margarine'],
      storageSource: BABYFOOD_URL,
    },
    title: 'Cereal Pancakes',
    // Toddler tag rationale: Pancakes are a self-fed finger food that stays suitable for toddlers.
    stages: ['9-12', '12-23', '24-36'],
    serveAs: ['finger-food'],
    mealTypes: ['breakfast'],
    ingredients: [
      { name: 'flour', quantity: 1, unit: 'cup', category: 'grains' },
      { name: 'baby cereal (rice or oatmeal)', food: 'oat', quantity: 0.5, unit: 'cup', category: 'grains' },
      { name: '(4 oz) jar of infant bananas', quantity: 1, unit: 'jar', category: 'produce' },
      { name: 'melted butter', quantity: 1, unit: 'tbsp', category: 'dairy-eggs' },
      { name: 'egg yolks', quantity: 3, unit: 'piece', category: 'dairy-eggs' },
      { name: 'cinnamon (optional)', quantity: 0.25, unit: 'tsp', category: 'pantry' },
      { name: 'vanilla extract (optional)', quantity: 1, unit: 'tsp', category: 'pantry' },
      { name: 'water', quantity: 1, unit: 'cup', category: 'other' },
    ],
    steps: [
      'Mix everything except the water together in a bowl.',
      'Slowly stir in the water until you have a batter.',
      'Lightly oil a skillet and heat it over the stove.',
      'Pour about 1/4 cup of batter into the hot skillet. Small bubbles will form on top as it cooks.',
      'Once the top looks dry and a few bubbles have formed, flip the pancake and cook the other side 2 to 3 minutes.',
      'Let each pancake cool before serving it to your baby.',
    ],
    texture: 'soft finger food',
    // Source yield: "Makes approximately twelve 4\" pancakes".
    servings: 12,
    // Contains 3 egg yolks, so use the shorter 1-day fridge window from the
    // homemade-guidance page (meats/eggs/fish/chicken within 1 day), matching
    // the puff recipes which also contain egg yolks.
    storage: { fridgeDays: 1, freezerMonths: 1 },
  },
  {
    // Soft, spoonable pudding -> fine from 6 months; also works at 9-12. Source
    // lists "vanilla (or plain) yogurt"; we use plain yogurt (its own option) to
    // avoid added sugar.
    // YIELD_OZ = rice cereal 1 cup (8) + yogurt 1 cup (8) + applesauce 2 (4 oz)
    // jars (8) + cinnamon 1 tsp (0) = 24 -> estimateServings(24) = 12.
    id: 'b-apple-rice-pudding',
    origin: 'builtin',
    source: {
      title: 'Apple Rice Pudding',
      publisher: PUBLISHER,
      url: INFANTFOODS_URL,
      retrieved: RETRIEVED,
      adaptations: ['Plain yogurt instead of vanilla yogurt', SERVINGS_ESTIMATE_NOTE],
      storageSource: BABYFOOD_URL,
    },
    title: 'Apple Rice Pudding',
    // Toddler tag rationale: Pureed pudding only, so no toddler stage.
    stages: ['6-8', '9-12'],
    serveAs: ['puree'],
    mealTypes: ['breakfast', 'snack'],
    ingredients: [
      { name: 'prepared infant rice cereal', quantity: 1, unit: 'cup', category: 'grains' },
      { name: 'plain yogurt', quantity: 1, unit: 'cup', category: 'dairy-eggs' },
      { name: '(4 oz) jars infant applesauce', quantity: 2, unit: 'jar', category: 'produce' },
      { name: 'cinnamon', quantity: 1, unit: 'tsp', category: 'pantry' },
    ],
    steps: [
      'In a large bowl, stir the rice cereal together with the applesauce.',
      'Mix in the cinnamon and plain yogurt until everything is evenly combined.',
      'Spoon into dishes and serve.',
    ],
    texture: 'soft, spoonable',
    servings: estimateServings(24),
    storage: { fridgeDays: 2, freezerMonths: 1 },
  },
  {
    // Baked meatballs are a soft finger food; tagged '9-12' BY TEXTURE (the page
    // states only "over 6 months", no explicit 9-12 age). We keep the source's
    // "pinch of spice such as pepper, garlic powder, and oregano" as listed:
    // none of those block, and dropping a non-blocked source ingredient is not a
    // change the source offers (Requirement 2.9). Cheese and egg are
    // allergens/reminders, not blocks.
    // YIELD_OZ = ground meat 1.25 lb (20) + baby cereal 1/2 cup (4) + cheese
    // 1 cup (8) + pureed veg 1 (4 oz) jar (4) + egg 1 piece (1) = 37
    // -> estimateServings(37) = round(18.5) = 19.
    id: 'b-meat-balls',
    origin: 'builtin',
    source: {
      title: 'Meat Balls',
      publisher: PUBLISHER,
      url: INFANTFOODS_URL,
      retrieved: RETRIEVED,
      adaptations: [SERVINGS_ESTIMATE_NOTE],
      storageSource: BABYFOOD_URL,
    },
    title: 'Meat Balls',
    // Toddler tag rationale: Source says cut to an appropriate size, so it stays suitable for toddlers.
    stages: ['9-12', '12-23', '24-36'],
    serveAs: ['finger-food', 'pieces'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'lean ground beef, turkey or chicken', quantity: 1.25, unit: 'lb', category: 'protein' },
      { name: 'baby cereal (rice or oatmeal)', food: 'oat', quantity: 0.5, unit: 'cup', category: 'grains' },
      { name: 'shredded white cheddar or mozzarella cheese', quantity: 1, unit: 'cup', category: 'dairy-eggs' },
      { name: '(4 oz) jar of pureed baby food vegetables', food: 'vegetable', quantity: 1, unit: 'jar', category: 'produce' },
      { name: 'egg, beaten', quantity: 1, unit: 'piece', category: 'dairy-eggs' },
      { name: 'pinch of spice such as pepper, garlic powder, and oregano', quantity: 1, unit: 'pinch', category: 'pantry' },
    ],
    steps: [
      'In a bowl, mix the baby cereal and the jar of vegetables together until smooth.',
      'Add the ground meat, cheese, beaten egg and the pinch of spice, and mix with clean hands until well combined.',
      'Scoop small portions and roll them into balls about the size of a small egg.',
      'Place the meatballs on a baking sheet and bake at 400\u00b0F until browned and cooked through, about 20 to 25 minutes.',
      'Wash your hands and all surfaces well before and after handling raw meat. Cut each meatball to a safe size before serving.',
    ],
    texture: 'soft finger food',
    servings: estimateServings(37),
    storage: { fridgeDays: 1, freezerMonths: 1 },
  },
  {
    // Baked "finger puffs" -> soft finger food; tagged '9-12' BY TEXTURE (the page
    // states only "over 6 months", no explicit 9-12 age). No added
    // salt/sugar/honey; egg yolk and milk/butter are allergens/reminders, not
    // blocks.
    // YIELD_OZ = rice cereal 1/2 cup (4) + egg yolks 2 pieces (2) + applesauce
    // 1/2 cup (4) + spinach 1 cup (8) + milk 2 tbsp (1) + butter 1 tbsp (0.5) +
    // baking powder 1 tsp (0) = 19.5 -> estimateServings(19.5) = round(9.75) = 10.
    id: 'b-spinach-apple-puffs',
    origin: 'builtin',
    source: {
      title: 'Spinach & Apple Puffs',
      publisher: PUBLISHER,
      url: INFANTFOODS_URL,
      retrieved: RETRIEVED,
      adaptations: [SERVINGS_ESTIMATE_NOTE],
      storageSource: BABYFOOD_URL,
    },
    title: 'Spinach & Apple Puffs',
    // Toddler tag rationale: Small dissolvable dots, suitable for toddlers too.
    stages: ['9-12', '12-23', '24-36'],
    serveAs: ['finger-food'],
    mealTypes: ['snack'],
    ingredients: [
      { name: 'single-grain rice cereal', quantity: 0.5, unit: 'cup', category: 'grains' },
      { name: 'large egg yolks', quantity: 2, unit: 'piece', category: 'dairy-eggs' },
      { name: 'pureed applesauce', quantity: 0.5, unit: 'cup', category: 'produce' },
      { name: 'spinach', quantity: 1, unit: 'cup', category: 'produce' },
      { name: 'milk', quantity: 2, unit: 'tbsp', category: 'dairy-eggs' },
      { name: 'unsalted butter', quantity: 1, unit: 'tbsp', category: 'dairy-eggs' },
      { name: 'baking powder', quantity: 1, unit: 'tsp', category: 'pantry' },
    ],
    steps: [
      'Heat the oven to 350\u00b0F and line a cookie sheet with parchment paper.',
      'Combine everything in a food processor or blender and run it until the mixture is completely smooth.',
      'Pour the batter into a zip-top bag and snip a tiny bit off one bottom corner.',
      'Squeeze small dots of batter onto the lined cookie sheet.',
      'Start baking at 350\u00b0F for the first 10 minutes, then turn the oven down to 250\u00b0F and give the puffs another 20 minutes.',
      'Let the puffs cool, then lift the parchment to loosen them. Cool completely before storing.',
    ],
    texture: 'soft finger food',
    servings: estimateServings(19.5),
    storage: { fridgeDays: 1, freezerMonths: 1 },
  },
  {
    // Baked "finger puffs" -> soft finger food; tagged '9-12' BY TEXTURE (the page
    // states only "over 6 months", no explicit 9-12 age).
    // YIELD_OZ = rice cereal 1/2 cup (4) + egg yolks 2 pieces (2) + sweet potato
    // 1/2 cup (4) + applesauce 1/4 cup (2) + butter 1 tbsp (0.5) + baking powder
    // 1 tsp (0) + cinnamon 1/4 tsp (0) = 12.5 -> estimateServings(12.5) = round(6.25) = 6.
    id: 'b-sweet-potato-puffs',
    origin: 'builtin',
    source: {
      title: 'Sweet Potato Puffs',
      publisher: PUBLISHER,
      url: INFANTFOODS_URL,
      retrieved: RETRIEVED,
      adaptations: [SERVINGS_ESTIMATE_NOTE],
      storageSource: BABYFOOD_URL,
    },
    title: 'Sweet Potato Puffs',
    // Toddler tag rationale: Small dissolvable dots, suitable for toddlers too.
    stages: ['9-12', '12-23', '24-36'],
    serveAs: ['finger-food'],
    mealTypes: ['snack'],
    ingredients: [
      { name: 'single-grain rice cereal', quantity: 0.5, unit: 'cup', category: 'grains' },
      { name: 'large egg yolks', quantity: 2, unit: 'piece', category: 'dairy-eggs' },
      { name: 'pureed sweet potato', quantity: 0.5, unit: 'cup', category: 'produce' },
      { name: 'pureed applesauce', quantity: 0.25, unit: 'cup', category: 'produce' },
      { name: 'unsalted butter', quantity: 1, unit: 'tbsp', category: 'dairy-eggs' },
      { name: 'baking powder', quantity: 1, unit: 'tsp', category: 'pantry' },
      { name: 'ground cinnamon', quantity: 0.25, unit: 'tsp', category: 'pantry' },
    ],
    steps: [
      'Heat the oven to 350\u00b0F and line a cookie sheet with parchment paper.',
      'Combine everything in a food processor or blender and run it until the mixture is completely smooth.',
      'Pour the batter into a zip-top bag and snip a tiny bit off one bottom corner.',
      'Squeeze small dots of batter onto the lined cookie sheet.',
      'Start baking at 350\u00b0F for the first 10 minutes, then turn the oven down to 250\u00b0F and give the puffs another 20 minutes.',
      'Let the puffs cool, then lift the parchment to loosen them. Cool completely before storing.',
    ],
    texture: 'soft finger food',
    servings: estimateServings(12.5),
    storage: { fridgeDays: 1, freezerMonths: 1 },
  },
];

/**
 * Everything built in: the 10 sourced WIC recipes, the simple ideas and the
 * batch 2, 3, 4, 5 and 6 recipes (Food Hero, ICN, NHLBI, Oregon Sea Grant and
 * others; see recipesBatch2.ts to recipesBatch6.ts).
 */
export const BUILTIN_RECIPES: Recipe[] = [
  ...RECIPES,
  ...SIMPLE_IDEAS,
  ...BATCH_2_RECIPES,
  ...BATCH_3_RECIPES,
  ...BATCH_4_RECIPES,
  ...BATCH_5_RECIPES,
  ...BATCH_6_RECIPES,
];
