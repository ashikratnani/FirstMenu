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
//     plain instead of vanilla yogurt) or drop a droppable blocked ingredient
//     and record it in `source.adaptations`. Any recipe that would need other
//     changes is SKIPPED. (No recipe below has a block at its tagged ages.)
//  4. Stages are tagged from the source's age guidance/texture: smooth purees
//     -> '6-8' (and also fine as '9-12'); finger foods / pancakes / baked puffs
//     / meatballs -> '9-12'. Per-recipe rationale is noted in comments.
//  5. Storage times come from the source page; each recipe that sets storage
//     records a `source.storageSource` URL.
//  6. publisher / url / retrieved recorded honestly (retrieved on fetch date).

import type { Recipe } from '../domain/types';

const BABYFOOD_URL = 'https://www.health.state.mn.us/people/wic/recipes/babyfood.html';
const INFANTFOODS_URL = 'https://www.health.state.mn.us/people/wic/recipes/infantfoods.html';
const PUBLISHER = 'Minnesota Department of Health, WIC Program';
const RETRIEVED = '2026-11-07';

export const BUILTIN_RECIPES: Recipe[] = [
  // --- Minnesota WIC "Homemade Baby Food" (babyfood.html) -------------------
  {
    // Smooth puree/mash with no added salt, sugar or honey -> fine from 6 months;
    // still appropriate (mashed) at 9-12, so tagged both stages.
    id: 'b-carrots-and-apples',
    origin: 'builtin',
    source: {
      title: 'Carrots and Apples',
      publisher: PUBLISHER,
      url: BABYFOOD_URL,
      retrieved: RETRIEVED,
      adaptations: [],
      storageSource: BABYFOOD_URL,
    },
    title: 'Carrots and Apples',
    stages: ['6-8', '9-12'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'carrots, peeled and sliced', quantity: 1, unit: 'cup', category: 'produce' },
      { name: 'apple, peeled, cored and quartered', quantity: 1, unit: 'piece', category: 'produce' },
      { name: 'water', quantity: 0.25, unit: 'cup', category: 'other' },
    ],
    steps: [
      'Put the carrots, apple and water in a baking dish or a microwave-safe container.',
      'Cover and cook until tender: bake about 45 minutes at 350\u00b0F, or microwave about 8 minutes on high.',
      'Puree or mash with a fork, stirring in some of the cooking liquid until the texture is right for your baby.',
    ],
    texture: 'smooth puree or mash',
    servings: 4,
    storage: { fridgeDays: 2, freezerMonths: 1 },
  },
  {
    // Blended/mashed to desired smoothness, no added salt/sugar/honey -> 6 months
    // and up; also works mashed at 9-12. Tagged both stages.
    id: 'b-sweet-potato-chicken',
    origin: 'builtin',
    source: {
      title: 'Sweet Potato Chicken',
      publisher: PUBLISHER,
      url: BABYFOOD_URL,
      retrieved: RETRIEVED,
      adaptations: [],
      storageSource: BABYFOOD_URL,
    },
    title: 'Sweet Potato and Chicken',
    stages: ['6-8', '9-12'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'sweet potato', quantity: 1, unit: 'piece', category: 'produce' },
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
    servings: 2,
    // Meat is present, so use the shorter 1-day fridge window from the page.
    storage: { fridgeDays: 1, freezerMonths: 1 },
  },
  {
    // Mix & Match Meal, instantiated as the source's own suggested combination
    // "Beef, peas, and potatoes". Blended/mashed, no added salt/sugar/honey.
    id: 'b-beef-peas-potatoes',
    origin: 'builtin',
    source: {
      title: 'Mix & Match Meal',
      publisher: PUBLISHER,
      url: BABYFOOD_URL,
      retrieved: RETRIEVED,
      adaptations: ['Instantiated the page\u2019s suggested combination: beef, peas and potatoes'],
      storageSource: BABYFOOD_URL,
    },
    title: 'Beef, Peas and Potatoes',
    stages: ['6-8', '9-12'],
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
    servings: 3,
    storage: { fridgeDays: 1, freezerMonths: 1 },
  },
  {
    // Mix & Match Meal -> "Chicken, broccoli, and rice" combination.
    id: 'b-chicken-broccoli-rice',
    origin: 'builtin',
    source: {
      title: 'Mix & Match Meal',
      publisher: PUBLISHER,
      url: BABYFOOD_URL,
      retrieved: RETRIEVED,
      adaptations: ['Instantiated the page\u2019s suggested combination: chicken, broccoli and rice'],
      storageSource: BABYFOOD_URL,
    },
    title: 'Chicken, Broccoli and Rice',
    stages: ['6-8', '9-12'],
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
    servings: 3,
    storage: { fridgeDays: 1, freezerMonths: 1 },
  },
  {
    // Mix & Match Meal -> "Beef, squash, and macaroni" combination. Macaroni adds
    // the wheat allergen group (reminder/allergen only, no block).
    id: 'b-beef-squash-macaroni',
    origin: 'builtin',
    source: {
      title: 'Mix & Match Meal',
      publisher: PUBLISHER,
      url: BABYFOOD_URL,
      retrieved: RETRIEVED,
      adaptations: ['Instantiated the page\u2019s suggested combination: beef, squash and macaroni'],
      storageSource: BABYFOOD_URL,
    },
    title: 'Beef, Squash and Macaroni',
    stages: ['6-8', '9-12'],
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
    servings: 3,
    storage: { fridgeDays: 1, freezerMonths: 1 },
  },

  // --- Minnesota WIC "Infant Food Recipes" (infantfoods.html) ---------------
  {
    // Griddle pancakes are a soft finger food -> '9-12'. Source lists "water or
    // apple juice"; apple juice blocks under 12 months, so we use water (the
    // source's own option) and record the adaptation. vanilla extract and
    // cinnamon are not blocks.
    id: 'b-cereal-pancakes',
    origin: 'builtin',
    source: {
      title: 'Cereal Pancakes',
      publisher: PUBLISHER,
      url: INFANTFOODS_URL,
      retrieved: RETRIEVED,
      adaptations: ['Water instead of apple juice'],
      storageSource: INFANTFOODS_URL,
    },
    title: 'Cereal Pancakes',
    stages: ['9-12'],
    mealTypes: ['breakfast'],
    ingredients: [
      { name: 'flour', quantity: 1, unit: 'cup', category: 'grains' },
      { name: 'baby cereal (rice or oatmeal)', quantity: 0.5, unit: 'cup', category: 'grains' },
      { name: 'jar of infant bananas', quantity: 1, unit: 'piece', category: 'produce' },
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
    servings: 12,
    storage: { fridgeDays: 5, freezerMonths: 6 },
  },
  {
    // Soft, spoonable pudding -> fine from 6 months; also works at 9-12. Source
    // lists "vanilla (or plain) yogurt"; we use plain yogurt (its own option) to
    // avoid added sugar, and record the adaptation.
    id: 'b-apple-rice-pudding',
    origin: 'builtin',
    source: {
      title: 'Apple Rice Pudding',
      publisher: PUBLISHER,
      url: INFANTFOODS_URL,
      retrieved: RETRIEVED,
      adaptations: ['Plain yogurt instead of vanilla yogurt'],
      storageSource: INFANTFOODS_URL,
    },
    title: 'Apple Rice Pudding',
    stages: ['6-8', '9-12'],
    mealTypes: ['breakfast', 'snack'],
    ingredients: [
      { name: 'prepared infant rice cereal', quantity: 1, unit: 'cup', category: 'grains' },
      { name: 'plain yogurt', quantity: 1, unit: 'cup', category: 'dairy-eggs' },
      { name: 'jars infant applesauce', quantity: 2, unit: 'piece', category: 'produce' },
      { name: 'cinnamon', quantity: 1, unit: 'tsp', category: 'pantry' },
    ],
    steps: [
      'In a large bowl, stir the rice cereal together with the applesauce.',
      'Stir in the cinnamon and plain yogurt until well mixed.',
      'Spoon into dishes and serve.',
    ],
    texture: 'soft, spoonable',
    servings: 4,
    storage: { fridgeDays: 5, freezerMonths: 6 },
  },
  {
    // Baked meatballs are a soft finger food -> '9-12'. Source lists "Pinch of
    // spice such as pepper, garlic powder, and oregano"; we drop the added
    // seasoning and record the adaptation. Cheese and egg are allergens/reminders,
    // not blocks.
    id: 'b-meat-balls',
    origin: 'builtin',
    source: {
      title: 'Meat Balls',
      publisher: PUBLISHER,
      url: INFANTFOODS_URL,
      retrieved: RETRIEVED,
      adaptations: ['Left out the added seasoning (pepper, garlic powder, oregano)'],
      storageSource: INFANTFOODS_URL,
    },
    title: 'Baby Meatballs',
    stages: ['9-12'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'lean ground beef, turkey or chicken', quantity: 1.25, unit: 'lb', category: 'protein' },
      { name: 'baby cereal (rice or oatmeal)', quantity: 0.5, unit: 'cup', category: 'grains' },
      { name: 'shredded white cheddar or mozzarella cheese', quantity: 1, unit: 'cup', category: 'dairy-eggs' },
      { name: 'jar of pureed baby food vegetables', quantity: 1, unit: 'piece', category: 'produce' },
      { name: 'egg, beaten', quantity: 1, unit: 'piece', category: 'dairy-eggs' },
    ],
    steps: [
      'In a bowl, mix the baby cereal and the jar of vegetables together until smooth.',
      'Add the ground meat, cheese and beaten egg, and mix with clean hands until well combined.',
      'Scoop small portions and roll them into balls about the size of a small egg.',
      'Place the meatballs on a baking sheet and bake at 400\u00b0F until browned and cooked through, about 20 to 25 minutes.',
      'Wash your hands and all surfaces well before and after handling raw meat. Cut each meatball to a safe size before serving.',
    ],
    texture: 'soft finger food',
    servings: 6,
    storage: { fridgeDays: 5, freezerMonths: 6 },
  },
  {
    // Baked "finger puffs" -> soft finger food, '9-12'. No added salt/sugar/honey;
    // egg yolk and milk/butter are allergens/reminders, not blocks.
    id: 'b-spinach-apple-puffs',
    origin: 'builtin',
    source: {
      title: 'Spinach & Apple Puffs',
      publisher: PUBLISHER,
      url: INFANTFOODS_URL,
      retrieved: RETRIEVED,
      adaptations: [],
      storageSource: INFANTFOODS_URL,
    },
    title: 'Spinach and Apple Puffs',
    stages: ['9-12'],
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
      'Put all the ingredients in a blender or food processor and blend until smooth.',
      'Pour the batter into a zip-top bag and snip a tiny bit off one bottom corner.',
      'Squeeze small dots of batter onto the lined cookie sheet.',
      'Bake at 350\u00b0F for 10 minutes, then lower the heat to 250\u00b0F and bake 20 minutes more.',
      'Let the puffs cool, then lift the parchment to loosen them. Cool completely before storing.',
    ],
    texture: 'soft finger food',
    servings: 4,
    storage: { fridgeDays: 5, freezerMonths: 6 },
  },
  {
    // Baked "finger puffs" -> soft finger food, '9-12'.
    id: 'b-sweet-potato-puffs',
    origin: 'builtin',
    source: {
      title: 'Sweet Potato Puffs',
      publisher: PUBLISHER,
      url: INFANTFOODS_URL,
      retrieved: RETRIEVED,
      adaptations: [],
      storageSource: INFANTFOODS_URL,
    },
    title: 'Sweet Potato Puffs',
    stages: ['9-12'],
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
      'Put all the ingredients in a blender or food processor and blend until smooth.',
      'Pour the batter into a zip-top bag and snip a tiny bit off one bottom corner.',
      'Squeeze small dots of batter onto the lined cookie sheet.',
      'Bake at 350\u00b0F for 10 minutes, then lower the heat to 250\u00b0F and bake 20 minutes more.',
      'Let the puffs cool, then lift the parchment to loosen them. Cool completely before storing.',
    ],
    texture: 'soft finger food',
    servings: 4,
    storage: { fridgeDays: 5, freezerMonths: 6 },
  },
];
