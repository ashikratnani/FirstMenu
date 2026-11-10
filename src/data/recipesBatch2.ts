// Built-in recipes, batch 2 (task 14.3, Requirement 14). Pure data, no React.
//
// Priority of this batch: the six allergen groups the first batch did not cover
// (peanut, tree nuts, soy, fish, shellfish, sesame), then stage counts.
//
// Rules followed (design.md "Built-in recipe expansion" and "Recipe source
// criteria", plus the v1 sourcing rules):
//  - Every recipe comes from a published page of an accepted publisher: Food
//    Hero (Oregon State University Extension), the Institute of Child Nutrition
//    Child Nutrition Recipe Box (USDA), and, as a new publisher for the only
//    shellfish recipe found, the NHLBI (NIH). Ingredients and quantities are
//    copied from the page; steps are reworded and keep the source's method,
//    times and temperatures.
//  - Salt, sugar, honey, soy sauce or juice that the screen blocks are left out
//    and recorded in source.adaptations. When the dish needs the ingredient, the
//    recipe is tagged only for stages where the rule no longer applies (24-36).
//  - Servings are the source's own count when it states one. Otherwise they are
//    an estimate (total yield divided by a 1/2 cup portion, 1/4 cup for dips),
//    disclosed in source.adaptations and pinned in recipes.test.ts.
//  - Stage tags follow texture (design rule 4). A recipe served only as a puree
//    or mash is not tagged for toddler stages (it still shows for toddlers,
//    because recipes tagged for younger stages sort after the child's stage).
//  - No `storage` is set: none of these pages gives fridge or freezer days.
//
// This file must not import from ./recipes (recipes.ts imports it).

import type { Recipe } from '../domain/types';

const FH_PUBLISHER = 'Food Hero, Oregon State University Extension';
const ICN_PUBLISHER = 'Institute of Child Nutrition, Child Nutrition Recipe Box (USDA)';
const NHLBI_PUBLISHER =
  'National Heart, Lung, and Blood Institute (NHLBI), National Institutes of Health';
const RETRIEVED = '2026-11-10';

const ESTIMATE_HALF_CUP =
  'Serving count is an estimate (source gives no servings): total yield divided by a 1/2 cup portion.';
const ESTIMATE_QUARTER_CUP =
  'Serving count is an estimate (source gives no servings): total yield divided by a 1/4 cup portion.';

export const BATCH_2_RECIPES: Recipe[] = [
  // --- Peanut ---------------------------------------------------------------
  {
    // Soft dip served with fruit or vegetable slices, so a finger food for
    // 12 months and up. Yogurt and peanut butter, no blocked ingredient.
    // Makes 12 Tbsp (3/4 cup); at a 1/4 cup portion that is 3 servings.
    id: 'b-fh-peanut-butter-yogurt-dip',
    origin: 'builtin',
    source: {
      title: 'Peanut Butter Yogurt Dip',
      publisher: FH_PUBLISHER,
      url: 'https://foodhero.org/recipes/peanut-butter-yogurt-dip',
      retrieved: RETRIEVED,
      adaptations: [ESTIMATE_QUARTER_CUP],
    },
    title: 'Peanut Butter Yogurt Dip',
    stages: ['12-23', '24-36'],
    serveAs: ['finger-food'],
    mealTypes: ['snack'],
    ingredients: [
      { name: 'nonfat or low-fat plain yogurt', quantity: 0.5, unit: 'cup', category: 'dairy-eggs' },
      { name: 'peanut butter', quantity: 0.25, unit: 'cup', category: 'pantry' },
      { name: 'cinnamon', quantity: 0.75, unit: 'tsp', category: 'pantry', optional: true },
    ],
    steps: [
      'Stir the yogurt and peanut butter together in a small bowl until smooth. Mix in the cinnamon if you like.',
      'Serve with slices of fruit or vegetables. Offer the dip thinly spread, never by the spoonful.',
    ],
    texture: 'soft, smooth dip for soft finger foods',
    servings: 3,
  },
  {
    // Blended until smooth, served as a drink or spoonable smoothie: puree only,
    // so no toddler tag. No blocked ingredient (nonfat dry milk powder is dairy,
    // which the screen flags as an allergen, not a block).
    // Makes 4 cups; at a 1/2 cup portion that is 8 servings.
    id: 'b-fh-peanut-power-smoothie',
    origin: 'builtin',
    source: {
      title: 'Peanut Power Smoothie',
      publisher: FH_PUBLISHER,
      url: 'https://foodhero.org/recipes/peanut-power-smoothie',
      retrieved: RETRIEVED,
      adaptations: [ESTIMATE_HALF_CUP],
    },
    title: 'Peanut Power Smoothie',
    stages: ['9-12'],
    serveAs: ['puree'],
    mealTypes: ['breakfast', 'snack'],
    ingredients: [
      { name: 'peanut butter', quantity: 0.25, unit: 'cup', category: 'pantry' },
      { name: 'banana (or any other fresh or canned and drained fruit)', quantity: 1.75, unit: 'cup', category: 'produce' },
      { name: 'nonfat dry milk powder', quantity: 0.25, unit: 'cup', category: 'dairy-eggs' },
      { name: 'cold water', food: 'water', quantity: 1.5, unit: 'cup', category: 'other' },
    ],
    steps: [
      'Put the peanut butter, banana, milk powder and cold water in a blender.',
      'Blend on low until smooth, then serve.',
    ],
    texture: 'smooth puree',
    servings: 8,
  },
  {
    // Pita halves with a spread of peanut butter and fruit slices. The source
    // chef tip warns nut butter and apple slices are a choking risk under 4, so
    // this is 24-36 only and the step keeps the tip (thin layer, grated apple).
    id: 'b-icn-fruit-nut-butter-pita-pockets',
    origin: 'builtin',
    source: {
      title: 'Fruit and Nut Butter Pita Pockets \u2013 USDA Recipe for Family Child Care Homes',
      publisher: ICN_PUBLISHER,
      url: 'https://theicn.org/cnrb/ages-3-5/age-3-5-6-servings/fruit-and-nut-butter-pita-pockets-usda-recipe-for-family-child-care-centers/',
      retrieved: RETRIEVED,
      adaptations: [],
    },
    title: 'Fruit and Nut Butter Pita Pockets',
    stages: ['24-36'],
    serveAs: ['pieces'],
    mealTypes: ['lunch', 'snack'],
    ingredients: [
      { name: 'whole-wheat pita rounds (at least 56 g or 2 oz each)', quantity: 3, unit: 'piece', category: 'grains' },
      { name: 'smooth peanut butter', food: 'peanut butter', quantity: 0.375, unit: 'cup', category: 'pantry' },
      { name: 'fresh apple slices, unpeeled, cored, 1/4 inch thick (about 1 medium apple)', food: 'apple', quantity: 6, unit: 'slice', category: 'produce' },
      { name: "fresh red D'Anjou pear slices, unpeeled, cored, 1/4 inch thick (about 1 large pear)", food: 'pear', quantity: 7, unit: 'slice', category: 'produce' },
    ],
    steps: [
      'Wash hands, then wash the apple and pear under running water before cutting.',
      'Cut each pita round in half.',
      'Spread 1 Tbsp of peanut butter inside each pita half, in a thin layer.',
      'Cut the apple and pear slices in half. Tuck 2 pieces of apple and 2 to 3 pieces of pear into each pita half. For children under 4, the source suggests grating the apple instead of using slices.',
      'Serve right away, or keep cold at 40\u00b0F or lower.',
    ],
    texture: 'soft pita halves with a thin nut butter layer',
    servings: 6,
  },

  // --- Tree nuts ------------------------------------------------------------
  {
    // Apple slices with a thin layer of almond butter. The source warns nut
    // butter is a choking risk under 4 and says to spread it thinly, so the step
    // keeps that. 24-36 only (hard apple slices).
    id: 'b-icn-apples-and-almond-butter',
    origin: 'builtin',
    source: {
      title: 'Apples and Almond Butter USDA Recipe for Family Child Care Homes',
      publisher: ICN_PUBLISHER,
      url: 'https://theicn.org/cnrb/ages-3-5/age-3-5-6-servings/apples-and-almond-butter-usda-cacfp-snack-recipe-for-ages-3-5/',
      retrieved: RETRIEVED,
      adaptations: [],
    },
    title: 'Apples and Almond Butter',
    stages: ['24-36'],
    serveAs: ['pieces'],
    mealTypes: ['snack'],
    ingredients: [
      { name: 'fresh apples, unpeeled, cored, thinly sliced (about 3 large apples)', quantity: 3, unit: 'cup', category: 'produce' },
      { name: 'smooth almond butter', food: 'almond butter', quantity: 0.375, unit: 'cup', category: 'pantry' },
    ],
    steps: [
      'Wash hands, then wash the apples under running water before cutting.',
      'For each serving, offer 1/2 cup of apple slices (about 5 to 7) with 1 Tbsp of almond butter. Spread the almond butter in a thin layer on the slices.',
      'Serve right away, or keep cold at 40\u00b0F or lower.',
    ],
    texture: 'thin apple slices with a thin nut butter layer',
    servings: 6,
  },
  {
    // Rice simmered in almond milk until soft, then stirred: a soft mash, so no
    // toddler tag. Left out the sugar and the optional toasted almonds.
    // Makes 6 cups; at a 1/2 cup portion that is 12 servings.
    id: 'b-fh-almond-rice-pudding',
    origin: 'builtin',
    source: {
      title: 'Almond Rice Pudding',
      publisher: FH_PUBLISHER,
      url: 'https://foodhero.org/recipes/almond-rice-pudding',
      retrieved: RETRIEVED,
      adaptations: [
        'Left out 1/4 cup sugar (no added sugar before 2 years)',
        'Left out optional 1/4 cup toasted almonds (whole nuts are a choking hazard)',
        ESTIMATE_HALF_CUP,
      ],
    },
    title: 'Almond Rice Pudding',
    stages: ['9-12'],
    serveAs: ['mashed'],
    mealTypes: ['breakfast', 'snack'],
    ingredients: [
      { name: 'almond milk', quantity: 3, unit: 'cup', category: 'other' },
      { name: 'uncooked white or brown rice', food: 'rice', quantity: 1, unit: 'cup', category: 'grains' },
      { name: 'vanilla', quantity: 1, unit: 'tsp', category: 'pantry' },
      { name: 'almond extract', quantity: 0.25, unit: 'tsp', category: 'pantry' },
      { name: 'cinnamon, to taste', category: 'pantry' },
    ],
    steps: [
      'Bring the almond milk and rice to a boil in a 2 to 3 quart saucepan.',
      'Turn the heat down, cover, and simmer 30 to 45 minutes until the rice is soft.',
      'Stir in the vanilla, almond extract and cinnamon. Serve warm.',
    ],
    texture: 'soft, creamy rice pudding',
    servings: 12,
  },

  // --- Soy ------------------------------------------------------------------
  {
    // Blended silken tofu and banana, a smooth pudding: puree/mash only, so no
    // toddler tag. Not 6-8 because the source tops it with sliced banana.
    // Left out the sugar. Makes 3 1/2 cups; at a 1/2 cup portion that is 7.
    id: 'b-fh-tofu-banana-pudding',
    origin: 'builtin',
    source: {
      title: 'Tofu Banana Pudding',
      publisher: FH_PUBLISHER,
      url: 'https://foodhero.org/recipes/tofu-banana-pudding',
      retrieved: RETRIEVED,
      adaptations: [
        'Left out 2 Tbsp sugar (no added sugar before 2 years)',
        ESTIMATE_HALF_CUP,
      ],
    },
    title: 'Tofu Banana Pudding',
    stages: ['9-12'],
    serveAs: ['puree', 'mashed'],
    mealTypes: ['snack', 'breakfast'],
    ingredients: [
      { name: 'silken tofu', quantity: 16, unit: 'oz', category: 'protein' },
      { name: 'ripe bananas (mash 2, slice 1)', quantity: 3, unit: 'piece', category: 'produce' },
      { name: 'vanilla', quantity: 1, unit: 'tsp', category: 'pantry' },
    ],
    steps: [
      'Blend the tofu, 2 mashed bananas and the vanilla until smooth.',
      'Pour into a serving bowl or small dishes, cover, and chill in the refrigerator.',
      'Just before serving, top with the sliced banana.',
    ],
    texture: 'smooth, creamy pudding',
    servings: 7,
  },
  {
    // Crumbled tofu scramble with soft vegetables: soft pieces for 9 months and
    // up. Left out the salt. Makes 5 cups; at a 1/2 cup portion that is 10.
    id: 'b-fh-tofu-scramble',
    origin: 'builtin',
    source: {
      title: 'Tofu Scramble',
      publisher: FH_PUBLISHER,
      url: 'https://foodhero.org/recipes/tofu-scramble',
      retrieved: RETRIEVED,
      adaptations: [
        'Left out 1/2 teaspoon salt (no added salt before 2 years)',
        ESTIMATE_HALF_CUP,
      ],
    },
    title: 'Tofu Scramble',
    stages: ['9-12', '12-23', '24-36'],
    serveAs: ['pieces', 'finger-food'],
    mealTypes: ['breakfast', 'lunch'],
    ingredients: [
      { name: 'extra-firm tofu', quantity: 14, unit: 'oz', category: 'protein' },
      { name: 'chopped onion', quantity: 1, unit: 'cup', category: 'produce' },
      { name: 'chopped bell pepper (any color)', quantity: 1, unit: 'cup', category: 'produce' },
      { name: 'vegetable oil', quantity: 1, unit: 'tsp', category: 'pantry' },
      { name: 'frozen chopped spinach, thawed and drained', quantity: 10, unit: 'oz', category: 'frozen' },
      { name: 'garlic powder (or 4 garlic cloves, minced)', quantity: 1, unit: 'tsp', category: 'pantry' },
      { name: 'black pepper', quantity: 0.5, unit: 'tsp', category: 'pantry' },
      { name: 'shredded cheddar cheese', quantity: 0.25, unit: 'cup', category: 'dairy-eggs' },
    ],
    steps: [
      'Drain and press the tofu to remove extra liquid, then crumble it into a bowl.',
      'Saute the onion and bell pepper in the oil over medium heat for about 5 to 7 minutes, until tender.',
      'Stir in the spinach, garlic and black pepper.',
      'Add the tofu and stir until heated through. Sprinkle the cheese over the top and serve hot.',
    ],
    texture: 'soft crumbles and tender vegetables',
    servings: 10,
  },
  {
    // Soy sauce, hoisin and the reduced-sodium soy sauce are part of the
    // marinade, so these are kept and the recipe is 24-36 only.
    id: 'b-icn-baked-tofu-bites',
    origin: 'builtin',
    source: {
      title: 'Baked Tofu Bites USDA Recipe for Family Child Care Homes',
      publisher: ICN_PUBLISHER,
      url: 'https://theicn.org/cnrb/ages-3-5/age-3-5-6-servings/baked-tofu-bites-usda-recipe-for-family-child-care-centers/',
      retrieved: RETRIEVED,
      adaptations: [],
    },
    title: 'Baked Tofu Bites',
    stages: ['24-36'],
    serveAs: ['finger-food'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'nonstick cooking spray', category: 'pantry' },
      { name: 'firm tofu, rinsed, drained, cut into 1/2 inch cubes', quantity: 20, unit: 'oz', category: 'protein' },
      { name: 'hoisin sauce', quantity: 2, unit: 'tbsp', category: 'pantry' },
      { name: 'reduced-sodium soy sauce', quantity: 2, unit: 'tbsp', category: 'pantry' },
      { name: 'water', quantity: 1, unit: 'tbsp', category: 'other' },
      { name: 'whole-wheat flour', quantity: 0.5, unit: 'cup', category: 'grains' },
      { name: 'whole grain medium-grind cornmeal', food: 'cornmeal', quantity: 0.25, unit: 'cup', category: 'grains' },
      { name: 'dry ground mustard', quantity: 0.25, unit: 'tsp', category: 'pantry' },
      { name: 'garlic powder', quantity: 0.25, unit: 'tsp', category: 'pantry' },
    ],
    steps: [
      'Heat the oven to 400\u00b0F and lightly spray a baking sheet with cooking spray.',
      'Seal the hoisin sauce, soy sauce and water in a 1-gallon bag and squeeze to mix. Add the tofu cubes, turn the bag gently so they do not break, and marinate in the refrigerator (40\u00b0F or lower) for 1 hour, turning the bag every 15 minutes.',
      'In a second 1-gallon bag, shake together the whole-wheat flour, cornmeal, dry mustard and garlic powder.',
      'Lift a few tofu cubes at a time out of the marinade, turn them in the flour mixture to coat, and set them on the baking sheet in a single layer. Throw away the leftover marinade.',
      'Bake 15 minutes, until lightly crisp and heated to 140\u00b0F or higher.',
    ],
    texture: 'soft inside, lightly crisp finger-food cubes',
    servings: 6,
  },

  // --- Fish -----------------------------------------------------------------
  {
    // Soft patties of canned salmon with minced vegetables: a finger food for
    // 9 months and up. Canned salmon "with bones" is mashed, as the source says.
    // The source states 4 patties.
    id: 'b-fh-salmon-patties',
    origin: 'builtin',
    source: {
      title: 'Salmon Patties',
      publisher: FH_PUBLISHER,
      url: 'https://foodhero.org/recipes/salmon-patties',
      retrieved: RETRIEVED,
      adaptations: [],
    },
    title: 'Salmon Patties',
    stages: ['9-12', '12-23', '24-36'],
    serveAs: ['finger-food', 'pieces'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'canned salmon with bones, drained', food: 'salmon', quantity: 14.75, unit: 'oz', category: 'protein' },
      { name: 'slice of bread, torn into small pieces', quantity: 1, unit: 'slice', category: 'grains' },
      { name: 'mayonnaise', quantity: 1, unit: 'tbsp', category: 'pantry' },
      { name: 'lemon juice', quantity: 1, unit: 'tbsp', category: 'pantry' },
      { name: 'egg, lightly beaten', quantity: 1, unit: 'piece', category: 'dairy-eggs' },
      { name: 'minced celery', food: 'celery', quantity: 0.5, unit: 'cup', category: 'produce' },
      { name: 'minced or grated carrot', food: 'carrot', quantity: 0.5, unit: 'cup', category: 'produce' },
      { name: 'minced onion', food: 'onion', quantity: 0.5, unit: 'cup', category: 'produce' },
    ],
    steps: [
      'Wash the vegetables. In a medium bowl, break up the salmon and mash the bones with a fork. Take off the skin if you like.',
      'Add the bread, mayonnaise, lemon juice, egg, celery, carrot and onion and mix well.',
      'Lightly grease a large skillet and heat it over medium heat.',
      'Press about 1/2 cup of the mixture firmly into a patty about 1 inch thick. Make 3 more patties the same way.',
      'Cook the patties 5 to 7 minutes on each side, until golden brown.',
    ],
    texture: 'soft, moist patties',
    servings: 4,
  },
  {
    // Breadcrumb and parmesan coated baked white fish, cut into strips or flaked
    // for little hands. 8 servings stated by the source.
    id: 'b-fh-crispy-parmesan-baked-fish',
    origin: 'builtin',
    source: {
      title: 'Crispy Parmesan Baked Fish',
      publisher: FH_PUBLISHER,
      url: 'https://foodhero.org/recipes/crispy-parmesan-baked-fish',
      retrieved: RETRIEVED,
      adaptations: [],
    },
    title: 'Crispy Parmesan Baked Fish',
    stages: ['12-23', '24-36'],
    serveAs: ['finger-food', 'pieces'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'plain breadcrumbs', quantity: 0.75, unit: 'cup', category: 'grains' },
      { name: 'grated parmesan cheese', quantity: 0.25, unit: 'cup', category: 'dairy-eggs' },
      { name: 'thyme', quantity: 0.25, unit: 'tsp', category: 'pantry' },
      { name: 'onion powder', quantity: 0.25, unit: 'tsp', category: 'pantry' },
      { name: 'paprika', quantity: 0.125, unit: 'tsp', category: 'pantry' },
      { name: 'nonfat or 1% milk', quantity: 0.75, unit: 'cup', category: 'dairy-eggs' },
      { name: 'fish fillets (try any white fish)', quantity: 2, unit: 'lb', category: 'protein' },
    ],
    steps: [
      'Heat the oven to 500\u00b0F and lightly grease a baking sheet.',
      'Mix the breadcrumbs, parmesan, thyme, onion powder and paprika in a small bowl, then spread the mixture on a flat plate or a sheet of wax paper.',
      'Dip each fish fillet in the milk, then press it into the crumbs to coat every side. Throw away any leftover crumbs and milk.',
      'Lay the fish on the baking sheet in a single layer. Bake 10 to 15 minutes, depending on thickness, until the fish reaches 145\u00b0F or is opaque and flakes easily with a fork.',
      'Check carefully for bones and cut into strips or small flakes before serving.',
    ],
    texture: 'flaky, lightly crumbed fish',
    servings: 8,
  },
  {
    // Folded tortilla filled with tuna, corn, pepper and cheese; cut into small
    // strips for little hands. The source says tuna in water; the screen only
    // blocks high-mercury fish such as bigeye tuna, which canned tuna is not.
    id: 'b-fh-tuna-quesadillas',
    origin: 'builtin',
    source: {
      title: 'Tuna Quesadillas',
      publisher: FH_PUBLISHER,
      url: 'https://foodhero.org/recipes/tuna-quesadillas',
      retrieved: RETRIEVED,
      adaptations: [],
    },
    title: 'Tuna Quesadillas',
    stages: ['12-23', '24-36'],
    serveAs: ['pieces'],
    mealTypes: ['lunch'],
    ingredients: [
      { name: 'canned tuna in water, drained', quantity: 5, unit: 'oz', category: 'protein' },
      { name: 'corn (cooked from fresh or frozen, or canned, drained and rinsed)', quantity: 0.5, unit: 'cup', category: 'produce' },
      { name: 'diced bell pepper', quantity: 0.5, unit: 'cup', category: 'produce' },
      { name: 'shredded cheese (try cheddar or mozzarella)', quantity: 0.5, unit: 'cup', category: 'dairy-eggs' },
      { name: '8-inch flour tortillas', quantity: 4, unit: 'piece', category: 'grains' },
    ],
    steps: [
      'Wash the vegetables. Mix the tuna, corn, bell pepper and cheese in a bowl.',
      'Spread a quarter of the filling over half of each tortilla and fold the tortilla over it.',
      'Heat each quesadilla in a skillet over medium heat until the cheese melts.',
      'Flip and cook another 30 seconds to 1 minute. Let cool, then cut into small pieces.',
    ],
    texture: 'soft folded tortilla with a melted filling, cut small',
    servings: 4,
  },

  // --- Shellfish ------------------------------------------------------------
  {
    // Fresh spring rolls with shrimp and chicken or pork. The soy sauce, brown
    // sugar and salt are all in the sauce or filling, so the recipe is 24-36
    // only. Left out the chopped dry roasted peanut garnish (nut pieces are a
    // choking hazard under 4). The source says 8 servings, 1 lumpia each.
    id: 'b-nhlbi-fresh-lumpia',
    origin: 'builtin',
    source: {
      title: 'Fresh Lumpia (Lumpiang Sariwa)',
      publisher: NHLBI_PUBLISHER,
      url: 'https://www.nhlbi.nih.gov/health/heart-healthy-living/healthy-foods/healthy-eating-recipes/fresh-lumpia-lumpiang-sariwa',
      retrieved: RETRIEVED,
      adaptations: [
        'Left out 1/3 C dry roasted peanuts, chopped (nut pieces are a choking hazard under 4)',
      ],
    },
    title: 'Fresh Lumpia (Lumpiang Sariwa)',
    stages: ['24-36'],
    serveAs: ['pieces'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'olive oil', quantity: 1, unit: 'tbsp', category: 'pantry' },
      { name: 'ground chicken breast or lean pork', food: 'chicken', quantity: 0.5, unit: 'cup', category: 'protein' },
      { name: 'shrimp, peeled and deveined', quantity: 0.5, unit: 'cup', category: 'protein' },
      { name: 'garlic cloves, chopped', food: 'garlic', quantity: 2, unit: 'clove', category: 'produce' },
      { name: 'cabbage, julienned', quantity: 0.5, unit: 'cup', category: 'produce' },
      { name: 'green beans, julienned', quantity: 0.5, unit: 'cup', category: 'produce' },
      { name: 'carrots, julienned', quantity: 0.5, unit: 'cup', category: 'produce' },
      { name: 'celery, julienned', quantity: 0.25, unit: 'cup', category: 'produce' },
      { name: 'jicama, julienned', quantity: 0.25, unit: 'cup', category: 'produce' },
      { name: 'low-sodium chicken broth', quantity: 0.5, unit: 'cup', category: 'pantry' },
      { name: 'salt', quantity: 0.25, unit: 'tsp', category: 'pantry' },
      { name: 'black pepper', quantity: 0.25, unit: 'tsp', category: 'pantry' },
      { name: 'broth from preparing the filling (for the sauce)', food: 'chicken broth', quantity: 1, unit: 'cup', category: 'other' },
      { name: 'lite soy sauce', quantity: 1, unit: 'tbsp', category: 'pantry' },
      { name: 'brown sugar', quantity: 1, unit: 'tbsp', category: 'pantry' },
      { name: 'garlic cloves, minced (for the sauce)', food: 'garlic', quantity: 3, unit: 'clove', category: 'produce' },
      { name: 'cornstarch', quantity: 1, unit: 'tsp', category: 'pantry' },
      { name: 'cold water', food: 'water', quantity: 2, unit: 'tbsp', category: 'other' },
      { name: 'Vietnamese spring-roll wrappers or lumpia wrappers', food: 'spring roll wrapper', quantity: 8, unit: 'piece', category: 'grains' },
      { name: 'red leaf lettuce', quantity: 8, unit: 'piece', category: 'produce' },
    ],
    steps: [
      'Filling: heat the oil in a saute pan and cook the ground meat, shrimp and chopped garlic.',
      'Add the cabbage, green beans, carrots, celery and jicama and saute until slightly crisp. Pour in the chicken broth and keep cooking until the vegetables are cooked, then season with the salt and pepper.',
      'Take off the heat and strain in a colander, saving the broth for the sauce. Let the filling cool to room temperature.',
      'Sauce: in a saucepan, bring 1 cup of the saved broth, the soy sauce, brown sugar and minced garlic to a boil. Stir the cornstarch into the cold water, add it slowly, and stir over medium heat until the sauce thickens.',
      'Wrap: soak one wrapper in warm water until soft and clear, then pat it dry right away. Lay it on a plate, put a lettuce leaf on it, and add 2 Tbsp of filling.',
      'Fold the bottom of the wrapper over the filling, fold in one side, and roll to the other side to seal. Repeat with the remaining wrappers and filling.',
      'Serve with the sauce spooned over the top. Cut into small pieces for young children.',
    ],
    texture: 'soft rolls with tender chopped filling, cut small',
    servings: 8,
  },

  // --- Sesame ---------------------------------------------------------------
  {
    // Baked sweet potato pureed with chickpeas and tahini: smooth, so it fits
    // 6-8 (puree or mash only, so no toddler tag). Left out the salt. The tahini (sesame) is a seed butter, thinned with
    // water as the source allows. The source says 6 servings (1/2 cup each).
    id: 'b-icn-sweet-potato-hummus',
    origin: 'builtin',
    source: {
      title: 'Sweet Potato Hummus USDA Recipe for Family Child Care Homes',
      publisher: ICN_PUBLISHER,
      url: 'https://theicn.org/cnrb/recipes-for-homes/sweet-potato-hummus-usda-recipe-for-family-child-care-homes/',
      retrieved: RETRIEVED,
      adaptations: ['Left out 1/4 tsp salt (no added salt before 2 years)'],
    },
    title: 'Sweet Potato Hummus',
    stages: ['6-8', '9-12'],
    serveAs: ['puree', 'mashed'],
    mealTypes: ['snack', 'lunch'],
    ingredients: [
      { name: 'whole fresh sweet potatoes', quantity: 1, unit: 'lb', category: 'produce' },
      { name: 'canned low-sodium chickpeas, rinsed and drained', quantity: 15, unit: 'oz', category: 'pantry' },
      { name: 'tahini', quantity: 0.25, unit: 'cup', category: 'pantry' },
      { name: 'olive oil', quantity: 2, unit: 'tbsp', category: 'pantry' },
      { name: 'lemon juice', quantity: 2, unit: 'tbsp', category: 'pantry' },
      { name: 'minced garlic', food: 'garlic', quantity: 1, unit: 'tbsp', category: 'produce' },
      { name: 'ground paprika', quantity: 1, unit: 'tsp', category: 'pantry' },
      { name: 'ground coriander', quantity: 0.25, unit: 'tsp', category: 'pantry' },
      { name: 'ground cinnamon', quantity: 0.25, unit: 'tsp', category: 'pantry' },
    ],
    steps: [
      'Heat the oven to 375\u00b0F. Prick the sweet potatoes 5 or 6 times, put them on a parchment-lined sheet pan, and bake about 50 minutes (45 minutes at 350\u00b0F in a convection oven) until the flesh is fork tender.',
      'Let the sweet potatoes cool, then scoop the flesh out of the skins into a large food processor.',
      'Add the chickpeas, tahini, olive oil, lemon juice, garlic, paprika, coriander and cinnamon. Puree about 4 minutes until smooth, scraping down the bowl as needed and pureeing another 15 seconds if needed.',
      'If it is too thick, slowly add up to 1/8 cup water.',
      'Serve right away, or cover and refrigerate. Serve with pita bread, crackers or veggies for older children.',
    ],
    texture: 'smooth, creamy puree',
    servings: 6,
  },
  {
    // Broccoli sauteed in a soy-vinegar-sugar sauce. The sugar and soy sauce are
    // part of the sauce, so the recipe is 24-36 only. Sesame seeds are optional
    // in the source and kept as optional. Makes 2 cups; 1/2 cup portions = 4.
    id: 'b-fh-sesame-broccoli',
    origin: 'builtin',
    source: {
      title: 'Sesame Broccoli',
      publisher: FH_PUBLISHER,
      url: 'https://foodhero.org/recipes/sesame-broccoli',
      retrieved: RETRIEVED,
      adaptations: [ESTIMATE_HALF_CUP],
    },
    title: 'Sesame Broccoli',
    stages: ['24-36'],
    serveAs: ['pieces'],
    mealTypes: ['dinner', 'lunch'],
    ingredients: [
      { name: 'sesame seeds', quantity: 1, unit: 'tbsp', category: 'pantry', optional: true },
      { name: 'water', quantity: 2, unit: 'tbsp', category: 'other' },
      { name: 'vinegar', quantity: 1, unit: 'tbsp', category: 'pantry' },
      { name: 'low-sodium soy sauce', quantity: 2, unit: 'tsp', category: 'pantry' },
      { name: 'sugar', quantity: 1, unit: 'tbsp', category: 'pantry' },
      { name: 'corn starch', food: 'cornstarch', quantity: 1, unit: 'tsp', category: 'pantry' },
      { name: 'red pepper flakes', food: 'red pepper flake', quantity: 0.125, unit: 'tsp', category: 'pantry', optional: true },
      { name: 'sesame oil or vegetable oil', quantity: 1, unit: 'tsp', category: 'pantry' },
      { name: 'chopped broccoli (fresh or frozen)', quantity: 3, unit: 'cup', category: 'produce' },
    ],
    steps: [
      'If using sesame seeds, toast them in a dry skillet over medium-high heat for about 3 minutes until golden, then set aside.',
      'Saute the broccoli in the oil in a medium skillet over medium heat for 2 to 3 minutes.',
      'In a small bowl, stir together the water, vinegar, soy sauce, sugar, corn starch and red pepper flakes (if using).',
      'Pour the sauce over the broccoli and cook, stirring, 3 to 5 minutes until the broccoli is tender and the sauce thickens.',
      'Sprinkle with the toasted sesame seeds if using, and serve.',
    ],
    texture: 'tender broccoli pieces in a thin sauce',
    servings: 4,
  },

  // --- Stage and meal type variety -------------------------------------------
  {
    // Chickpea dip made without tahini, blended smooth (or mashed with a fork
    // as the source also allows). Puree/mash only, so no toddler tag. Makes
    // 2 cups; at a 1/4 cup portion that is 8 servings.
    id: 'b-fh-hummus-no-tahini',
    origin: 'builtin',
    source: {
      title: 'Hummus (No Tahini)',
      publisher: FH_PUBLISHER,
      url: 'https://foodhero.org/recipes/hummus-no-tahini',
      retrieved: RETRIEVED,
      adaptations: [ESTIMATE_QUARTER_CUP],
    },
    title: 'Hummus (No Tahini)',
    stages: ['6-8', '9-12'],
    serveAs: ['puree', 'mashed'],
    mealTypes: ['snack', 'lunch'],
    ingredients: [
      { name: 'garbanzo beans, drained and rinsed', food: 'chickpea', quantity: 15, unit: 'oz', category: 'pantry' },
      { name: 'lemon juice (fresh or bottled)', quantity: 2, unit: 'tbsp', category: 'pantry' },
      { name: 'vegetable oil', quantity: 2, unit: 'tsp', category: 'pantry' },
      { name: 'nonfat plain yogurt', quantity: 0.5, unit: 'cup', category: 'dairy-eggs' },
      { name: 'garlic clove (or 1/4 teaspoon garlic powder)', food: 'garlic', quantity: 1, unit: 'clove', category: 'produce' },
      { name: 'black pepper', quantity: 0.25, unit: 'tsp', category: 'pantry' },
      { name: 'cumin', quantity: 0.5, unit: 'tsp', category: 'pantry' },
    ],
    steps: [
      'Put all the ingredients in a blender and blend until the dip is as smooth as you want it.',
      'Or mash the garbanzo beans on a large plate with a fork until smooth, then mix in the other ingredients in a small bowl.',
      'If it is too thick, add 2 teaspoons of water.',
    ],
    texture: 'smooth dip',
    servings: 8,
  },
  {
    // Soft baked muffins. Left out the sugar and salt. The source states 12.
    id: 'b-fh-banana-oatmeal-muffins',
    origin: 'builtin',
    source: {
      title: 'Banana Oatmeal Muffins',
      publisher: FH_PUBLISHER,
      url: 'https://foodhero.org/recipes/banana-oatmeal-muffins',
      retrieved: RETRIEVED,
      adaptations: [
        'Left out 1/2 cup sugar (no added sugar before 2 years)',
        'Left out 1/4 tsp salt (no added salt before 2 years)',
      ],
    },
    title: 'Banana Oatmeal Muffins',
    stages: ['9-12', '12-23', '24-36'],
    serveAs: ['finger-food'],
    mealTypes: ['breakfast', 'snack'],
    ingredients: [
      { name: 'oats (quick-cooking or old fashioned rolled)', quantity: 1, unit: 'cup', category: 'grains' },
      { name: 'low-fat milk', quantity: 0.25, unit: 'cup', category: 'dairy-eggs' },
      { name: 'eggs', quantity: 2, unit: 'piece', category: 'dairy-eggs' },
      { name: 'vegetable oil', quantity: 1 / 3, unit: 'cup', category: 'pantry' },
      { name: 'mashed ripe banana', quantity: 1, unit: 'cup', category: 'produce' },
      { name: 'whole-wheat flour', quantity: 1.5, unit: 'cup', category: 'grains' },
      { name: 'baking powder', quantity: 2, unit: 'tsp', category: 'pantry' },
      { name: 'baking soda', quantity: 1, unit: 'tsp', category: 'pantry' },
    ],
    steps: [
      'Heat the oven to 400\u00b0F and lightly grease the bottoms and sides of 12 muffin cups.',
      'Wash the fruit. In a medium bowl, mix the oats, milk, eggs, oil and mashed banana, then let the mixture stand at least 10 minutes.',
      'In a large bowl, stir together the flour, baking powder and baking soda.',
      'Add the oat mixture to the dry ingredients and stir gently until just moistened.',
      'Fill the muffin cups 3/4 full and bake 18 to 20 minutes, until golden brown and a toothpick in the center comes out moist but clean.',
    ],
    texture: 'soft, moist baked muffins',
    servings: 12,
  },
  {
    // Whole-wheat spirals with sauteed broccoli and a little mozzarella. Pasta
    // is cooked al dente per the source; offer as soft pieces.
    id: 'b-icn-spiral-pasta-and-broccoli',
    origin: 'builtin',
    source: {
      title: 'Spiral Pasta and Broccoli USDA Recipe for Family Child Care Homes',
      publisher: ICN_PUBLISHER,
      url: 'https://theicn.org/cnrb/ages-3-5/age-3-5-6-servings/spiral-pasta-and-broccoli-usda-recipe-for-family-child-care-centers/',
      retrieved: RETRIEVED,
      adaptations: [],
    },
    title: 'Spiral Pasta and Broccoli',
    stages: ['9-12', '12-23', '24-36'],
    serveAs: ['pieces', 'finger-food'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'frozen chopped broccoli, thawed and drained', quantity: 4, unit: 'cup', category: 'frozen' },
      { name: 'whole-wheat spiral pasta, uncooked', quantity: 1.0625, unit: 'cup', category: 'grains' },
      { name: 'water', quantity: 3, unit: 'cup', category: 'other' },
      { name: 'trans fat-free margarine', food: 'margarine', quantity: 1, unit: 'tsp', category: 'pantry' },
      { name: 'garlic powder', quantity: 1, unit: 'tsp', category: 'pantry' },
      { name: 'part-skim shredded mozzarella cheese', quantity: 0.125, unit: 'cup', category: 'dairy-eggs' },
    ],
    steps: [
      'Boil the water in a medium pot, add the pasta, and cook 8 minutes until al dente. Drain and rinse well with cold water.',
      'Melt the margarine in a medium nonstick skillet over medium-high heat and stir in the garlic powder.',
      'Saute the broccoli 3 to 5 minutes, until the tips begin to brown.',
      'Turn the heat down to medium, add the pasta, and stir gently for 3 to 5 minutes until hot (140\u00b0F or higher).',
      'Take off the heat, stir in the cheese, and serve about 1/2 cup.',
    ],
    texture: 'tender spirals and soft broccoli',
    servings: 6,
  },
  {
    // Roasted sweet potato cubes. Left out the salt. 100% orange juice (2 Tbsp)
    // is kept: the juice block applies under 12 months only, so no 9-12 tag.
    id: 'b-icn-roasted-sweet-potato-hash',
    origin: 'builtin',
    source: {
      title: 'Roasted Sweet Potato Hash \u2013 USDA Recipe for Family Child Care Homes',
      publisher: ICN_PUBLISHER,
      url: 'https://theicn.org/cnrb/ages-3-5/age-3-5-6-servings/roasted-sweet-potato-hash-usda-recipe-for-family-child-care-centers/',
      retrieved: RETRIEVED,
      adaptations: ['Left out 1/4 tsp salt (no added salt before 2 years)'],
    },
    title: 'Roasted Sweet Potato Hash',
    stages: ['12-23', '24-36'],
    serveAs: ['pieces'],
    mealTypes: ['breakfast', 'dinner'],
    ingredients: [
      { name: 'nonstick cooking spray', category: 'pantry' },
      { name: 'ground cinnamon', quantity: 1, unit: 'tsp', category: 'pantry' },
      { name: 'canola oil', quantity: 2, unit: 'tsp', category: 'pantry' },
      { name: '100% orange juice', quantity: 2, unit: 'tbsp', category: 'pantry' },
      { name: 'fresh sweet potatoes, peeled, 1/2 inch cubed (about 1 lb 5 1/4 oz)', quantity: 4, unit: 'cup', category: 'produce' },
    ],
    steps: [
      'Heat the oven to 400\u00b0F.',
      'Wash the sweet potatoes. Whisk the cinnamon, oil and orange juice together in a small bowl.',
      'Toss the sweet potato cubes in the mixture.',
      'Spread them in a single, uncrowded layer on a baking sheet sprayed with cooking spray.',
      'Roast 20 minutes, until heated to 140\u00b0F or higher. Let rest 2 to 3 minutes and serve about 1/2 cup.',
    ],
    texture: 'soft roasted cubes',
    servings: 6,
  },
  {
    // Black beans and boiled egg. Left out the salt. "Tomatoes ... in juice"
    // contains the word juice, which the screen blocks under 12 months, so no
    // 9-12 tag.
    id: 'b-icn-breakfast-black-beans-with-eggs',
    origin: 'builtin',
    source: {
      title: 'Breakfast Black Beans With Eggs \u2013 USDA Recipe for Family Child Care Homes',
      publisher: ICN_PUBLISHER,
      url: 'https://theicn.org/cnrb/ages-3-5/age-3-5-6-servings/breakfast-black-beans-with-eggs-usda-recipe-for-family-child-care-centers/',
      retrieved: RETRIEVED,
      adaptations: ['Left out 1/2 tsp salt (no added salt before 2 years)'],
    },
    title: 'Breakfast Black Beans With Eggs',
    stages: ['12-23', '24-36'],
    serveAs: ['pieces'],
    mealTypes: ['breakfast', 'lunch'],
    ingredients: [
      { name: 'nonstick cooking spray', category: 'pantry' },
      { name: 'fresh large whole eggs', quantity: 2, unit: 'piece', category: 'dairy-eggs' },
      { name: 'low-sodium canned black beans, drained (about 2 1/2 15 oz cans)', quantity: 3.75, unit: 'cup', category: 'pantry' },
      { name: 'canned petite-cut tomatoes with onions and garlic in juice (about 1/2 of a 14 oz can)', food: 'tomato', quantity: 0.75, unit: 'cup', category: 'pantry' },
      { name: 'water', quantity: 0.25, unit: 'cup', category: 'other' },
      { name: 'ground cumin', quantity: 1, unit: 'tsp', category: 'pantry' },
      { name: 'fresh chopped cilantro', quantity: 0.25, unit: 'cup', category: 'produce' },
    ],
    steps: [
      'Put the eggs in a large pot with 1 inch of water above them. Bring to a boil over medium-high heat, remove from the heat, cover, and let stand 12 minutes. Wash hands after touching raw eggs.',
      'Move the eggs to an ice bath (ice and water in a large bowl) for 10 minutes.',
      'Heat a medium nonstick skillet over medium-high heat and spray with cooking spray. Add the beans, tomatoes with their juice, water and cumin. Bring to a boil, turn the heat to medium, and simmer 5 minutes until heated to 140\u00b0F or higher.',
      'Peel the eggs and cut each into 3 pieces.',
      'Serve 1/2 cup of the bean mixture with 1 egg piece and some chopped cilantro.',
    ],
    texture: 'soft beans with egg pieces',
    servings: 6,
  },
  {
    // Soft scrambled eggs with broccoli and a little parmesan. Left out the salt.
    id: 'b-icn-egg-and-broccoli-scramble',
    origin: 'builtin',
    source: {
      title: 'Egg and Broccoli Scramble \u2013 USDA Recipe for Family Child Care Homes',
      publisher: ICN_PUBLISHER,
      url: 'https://theicn.org/cnrb/ages-3-5/age-3-5-6-servings/egg-and-broccoli-scramble-usda-recipe-for-family-child-care-centers/',
      retrieved: RETRIEVED,
      adaptations: ['Left out 1/8 tsp salt (no added salt before 2 years)'],
    },
    title: 'Egg and Broccoli Scramble',
    stages: ['9-12', '12-23', '24-36'],
    serveAs: ['pieces'],
    mealTypes: ['breakfast'],
    ingredients: [
      { name: 'frozen chopped broccoli, thawed and drained (5 oz)', quantity: 1.75, unit: 'cup', category: 'frozen' },
      { name: 'water', quantity: 1, unit: 'tbsp', category: 'other' },
      { name: 'garlic powder', quantity: 0.5, unit: 'tsp', category: 'pantry' },
      { name: 'ground black pepper', quantity: 0.25, unit: 'tsp', category: 'pantry' },
      { name: 'fresh large whole eggs', quantity: 6, unit: 'piece', category: 'dairy-eggs' },
      { name: 'grated parmesan cheese', quantity: 1, unit: 'tbsp', category: 'dairy-eggs' },
      { name: 'nonstick cooking spray', category: 'pantry' },
    ],
    steps: [
      'Whisk the eggs, water, garlic powder, pepper and parmesan together in a medium bowl. Wash hands after touching raw eggs.',
      'Spray a small nonstick skillet with cooking spray and heat it over medium-high heat.',
      'Saute the broccoli 3 to 5 minutes, until the tips begin to brown.',
      'Pour in the egg mixture and stir constantly with a heat-resistant spatula, scraping up any egg that sticks, until heated to 160\u00b0F or higher.',
      'Serve about 1/3 cup, right away or kept warm at 140\u00b0F or higher.',
    ],
    texture: 'soft scrambled egg with tender broccoli',
    servings: 6,
  },
];
