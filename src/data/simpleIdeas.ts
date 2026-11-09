// Built-in "simple ideas": one or two plain foods with a preparation, taken from
// public-health feeding guides rather than full recipes (spec Requirement 14.4).
// Pure data, no React. Ingredients carry no quantity.
//
// Sources (both fetched 2026-11-10; publishers already approved in
// docs/recipe-sources.md):
//  A. Utah Department of Health WIC, "Homemade Baby Foods" (Simple Examples by age:
//     6 months pureed/mashed, 8 months ground/finely chopped, 10 months chopped or
//     small pieces of finger foods).
//  B. USDA Food and Nutrition Service, "Feeding Infants in the CACFP", Chapter 7
//     (cited for the no-salt-added and mash adaptations; it gives no age for eggs,
//     so no egg idea is included rather than inventing stages).
//
// Stage rule: the stage comes from the source's age guidance (6 and 8 month items
// -> '6-8' and '9-12'; 10 month items -> '9-12'). '12-23' and '24-36' are added
// only where the idea is soft small pieces. Pureed or mashed only ideas are not
// tagged for toddler stages. No storage times are set (none are sourced per idea).
// Steps are written in our own words. Dropped: nothing; every listed item was
// found in the fetched text.
//
// Note on the Utah 8 month items (peaches, carrots, ground beef): the source says
// "ground or finely chopped", but design rule 3 stages simple ideas from the
// source's age guidance, and 8 months falls in '6-8', so they keep that stage.

import type { Recipe } from '../domain/types';

const UTAH_URL = 'https://wic.stage.utah.gov/wp-content/uploads/Homemade-Baby-Foods-1.pdf';
const UTAH_PUBLISHER = 'Utah Department of Health, WIC Program';
const RETRIEVED = '2026-11-10';

const UTAH_SIX_MONTHS = 'Source lists this under 6 months, pureed or mashed';
const UTAH_EIGHT_MONTHS = 'Source lists this under 8 months, ground or finely chopped';
const UTAH_TEN_MONTHS = 'Source lists this under 10 months, chopped or small pieces of finger foods';

export const SIMPLE_IDEAS: Recipe[] = [
  // --- Utah WIC, 6 months: pureed/mashed (stages 6-8, 9-12 only) -------------
  {
    id: 'b-idea-mashed-banana',
    origin: 'builtin',
    kind: 'simple-idea',
    source: {
      title: 'Ripe bananas, mashed',
      publisher: UTAH_PUBLISHER,
      url: UTAH_URL,
      retrieved: RETRIEVED,
      adaptations: [UTAH_SIX_MONTHS],
    },
    title: 'Mashed banana',
    stages: ['6-8', '9-12'],
    mealTypes: ['breakfast', 'snack'],
    ingredients: [{ name: 'ripe banana', category: 'produce' }],
    steps: ['Peel a ripe banana.', 'Mash it with a fork until it is as smooth as you want.'],
    texture: 'smooth mash',
    servings: 1,
    serveAs: ['mashed'],
  },
  {
    id: 'b-idea-sweet-potato-puree',
    origin: 'builtin',
    kind: 'simple-idea',
    source: {
      title: 'Sweet potatoes, baked until soft, pureed',
      publisher: UTAH_PUBLISHER,
      url: UTAH_URL,
      retrieved: RETRIEVED,
      adaptations: [UTAH_SIX_MONTHS],
    },
    title: 'Sweet potato puree',
    stages: ['6-8', '9-12'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [{ name: 'sweet potato', category: 'produce' }],
    steps: ['Bake the sweet potato until it is soft all the way through.', 'Peel it and puree until smooth.'],
    texture: 'smooth puree',
    servings: 1,
    serveAs: ['puree'],
  },
  {
    id: 'b-idea-mashed-oats',
    origin: 'builtin',
    kind: 'simple-idea',
    source: {
      title: 'Cooked oats, mashed',
      publisher: UTAH_PUBLISHER,
      url: UTAH_URL,
      retrieved: RETRIEVED,
      adaptations: [UTAH_SIX_MONTHS],
    },
    title: 'Mashed cooked oats',
    stages: ['6-8', '9-12'],
    mealTypes: ['breakfast'],
    ingredients: [{ name: 'oats', category: 'grains' }],
    steps: ['Cook the oats until soft.', 'Mash them with a fork to a smooth, thick texture.'],
    texture: 'smooth mash',
    servings: 1,
    serveAs: ['mashed'],
  },
  {
    id: 'b-idea-chicken-puree',
    origin: 'builtin',
    kind: 'simple-idea',
    source: {
      title: 'Fully cooked chicken, pureed',
      publisher: UTAH_PUBLISHER,
      url: UTAH_URL,
      retrieved: RETRIEVED,
      adaptations: [UTAH_SIX_MONTHS],
    },
    title: 'Chicken puree',
    stages: ['6-8', '9-12'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [{ name: 'chicken', category: 'protein' }],
    steps: ['Cook the chicken all the way through.', 'Puree it until smooth.'],
    texture: 'smooth puree',
    servings: 1,
    serveAs: ['puree'],
  },

  // --- Utah WIC, 8 months: ground/finely chopped ----------------------------
  {
    id: 'b-idea-chopped-peaches',
    origin: 'builtin',
    kind: 'simple-idea',
    source: {
      title: 'Fresh peaches, peeled, finely chopped',
      publisher: UTAH_PUBLISHER,
      url: UTAH_URL,
      retrieved: RETRIEVED,
      adaptations: [UTAH_EIGHT_MONTHS],
    },
    title: 'Finely chopped peaches',
    // Soft fruit in small pieces stays suitable for toddlers.
    stages: ['6-8', '9-12', '12-23', '24-36'],
    mealTypes: ['breakfast', 'snack'],
    ingredients: [{ name: 'fresh peach', category: 'produce' }],
    steps: ['Peel a ripe peach and remove the pit.', 'Chop the fruit into very small pieces.'],
    texture: 'soft finely chopped pieces',
    servings: 1,
    serveAs: ['pieces'],
  },
  {
    id: 'b-idea-chopped-carrots',
    origin: 'builtin',
    kind: 'simple-idea',
    source: {
      title: 'Carrots, cooked, finely chopped',
      publisher: UTAH_PUBLISHER,
      url: UTAH_URL,
      retrieved: RETRIEVED,
      adaptations: [UTAH_EIGHT_MONTHS],
    },
    title: 'Finely chopped cooked carrots',
    // Cooked soft carrot pieces stay suitable for toddlers.
    stages: ['6-8', '9-12', '12-23', '24-36'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [{ name: 'carrots', category: 'produce' }],
    steps: ['Peel the carrots and cook them in a little water until tender.', 'Chop them into very small pieces.'],
    texture: 'soft finely chopped pieces',
    servings: 1,
    serveAs: ['pieces'],
  },
  {
    id: 'b-idea-mashed-rice',
    origin: 'builtin',
    kind: 'simple-idea',
    source: {
      title: 'Well cooked rice, mashed',
      publisher: UTAH_PUBLISHER,
      url: UTAH_URL,
      retrieved: RETRIEVED,
      adaptations: [UTAH_EIGHT_MONTHS],
    },
    title: 'Mashed rice',
    stages: ['6-8', '9-12'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [{ name: 'rice', category: 'grains' }],
    steps: ['Cook the rice until it is very soft.', 'Mash it with a fork.'],
    texture: 'soft mash',
    servings: 1,
    serveAs: ['mashed'],
  },
  {
    id: 'b-idea-ground-beef',
    origin: 'builtin',
    kind: 'simple-idea',
    source: {
      title: 'Fully cooked beef, ground',
      publisher: UTAH_PUBLISHER,
      url: UTAH_URL,
      retrieved: RETRIEVED,
      adaptations: [UTAH_EIGHT_MONTHS],
    },
    title: 'Ground beef',
    stages: ['6-8', '9-12'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [{ name: 'beef', category: 'protein' }],
    steps: ['Cook the beef all the way through.', 'Grind it fine with a food grinder or processor.'],
    texture: 'finely ground',
    servings: 1,
    serveAs: ['pieces'],
  },

  // --- Utah WIC, 10 months: chopped/small pieces of finger foods ------------
  {
    id: 'b-idea-green-bean-fingers',
    origin: 'builtin',
    kind: 'simple-idea',
    source: {
      title: 'Canned green beans as finger foods',
      publisher: UTAH_PUBLISHER,
      url: UTAH_URL,
      retrieved: RETRIEVED,
      adaptations: [
        UTAH_TEN_MONTHS,
        'Choose no-salt-added canned vegetables (USDA Food and Nutrition Service, Feeding Infants in the CACFP, Chapter 7)',
      ],
    },
    title: 'Green beans as finger food',
    stages: ['9-12', '12-23', '24-36'],
    mealTypes: ['lunch', 'dinner', 'snack'],
    ingredients: [{ name: 'green beans', category: 'produce' }],
    steps: ['Drain the canned green beans.', 'Serve the soft beans as finger food.'],
    texture: 'soft finger food',
    servings: 1,
    serveAs: ['finger-food'],
  },
  {
    id: 'b-idea-steamed-cauliflower',
    origin: 'builtin',
    kind: 'simple-idea',
    source: {
      title: 'Cauliflower or broccoli, steamed, chopped',
      publisher: UTAH_PUBLISHER,
      url: UTAH_URL,
      retrieved: RETRIEVED,
      adaptations: [UTAH_TEN_MONTHS],
    },
    title: 'Steamed cauliflower or broccoli',
    stages: ['9-12', '12-23', '24-36'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [{ name: 'cauliflower', category: 'produce' }],
    steps: ['Steam the cauliflower or broccoli until tender.', 'Chop it into small pieces.'],
    texture: 'soft small pieces',
    servings: 1,
    serveAs: ['pieces'],
  },
  {
    id: 'b-idea-toast-pieces',
    origin: 'builtin',
    kind: 'simple-idea',
    source: {
      title: 'Whole wheat bread, toasted, torn into small pieces',
      publisher: UTAH_PUBLISHER,
      url: UTAH_URL,
      retrieved: RETRIEVED,
      adaptations: [UTAH_TEN_MONTHS],
    },
    title: 'Whole wheat toast pieces',
    stages: ['9-12', '12-23', '24-36'],
    mealTypes: ['breakfast', 'snack'],
    ingredients: [{ name: 'whole wheat bread', category: 'grains' }],
    steps: ['Toast the bread.', 'Tear it into small pieces.'],
    texture: 'small toast pieces',
    servings: 1,
    serveAs: ['pieces'],
  },
  {
    id: 'b-idea-mashed-beans',
    origin: 'builtin',
    kind: 'simple-idea',
    source: {
      title: 'Canned or dry beans, cooked',
      publisher: UTAH_PUBLISHER,
      url: UTAH_URL,
      retrieved: RETRIEVED,
      adaptations: [
        UTAH_TEN_MONTHS,
        'Mash the beans, following USDA Food and Nutrition Service, Feeding Infants in the CACFP, Chapter 7: cook until soft enough to puree or mash',
      ],
    },
    title: 'Mashed beans',
    stages: ['9-12'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [{ name: 'beans', category: 'protein' }],
    steps: [
      'Cook dry beans until very soft, or drain and rinse canned beans.',
      'Mash them, adding a little liquid if needed.',
    ],
    texture: 'soft mash',
    servings: 1,
    serveAs: ['mashed'],
  },
  {
    id: 'b-idea-shredded-mozzarella',
    origin: 'builtin',
    kind: 'simple-idea',
    source: {
      title: 'Shredded mozzarella cheese',
      publisher: UTAH_PUBLISHER,
      url: UTAH_URL,
      retrieved: RETRIEVED,
      adaptations: [UTAH_TEN_MONTHS],
    },
    title: 'Shredded mozzarella',
    stages: ['9-12', '12-23', '24-36'],
    mealTypes: ['snack'],
    ingredients: [{ name: 'mozzarella cheese', category: 'dairy-eggs' }],
    steps: ['Shred the mozzarella.', 'Serve the shreds as a finger food.'],
    texture: 'soft shreds',
    servings: 1,
    serveAs: ['finger-food'],
  },
];
