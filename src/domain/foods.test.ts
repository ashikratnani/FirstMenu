import { describe, expect, it } from 'vitest';
import {
  ALLERGEN_GENERIC_GUIDANCE,
  ALLERGEN_PEANUT_NOTE,
  allergenGuidance,
  allergenKey,
  collectFoods,
  allFoodKeys,
  blockFoodKeys,
  DESCRIPTOR_WORDS,
  foodKeyFor,
  foodKeyFromName,
  foodStatus,
  groceryFoodKey,
  isBlockCovered,
  isIgnoredFood,
} from './foods';
import { RULES } from './safety/rules';
import { BUILTIN_RECIPES } from '../data/recipes';
import type { AppState, Ingredient, Recipe, WeekPlan } from './types';

// A minimal AppState for foodStatus tests. foodStatus only reads state.foods.
function makeState(foods: AppState['foods'] = {}): AppState {
  const plan: WeekPlan = {
    startDate: '2026-01-05',
    prepDate: '2026-01-04',
    activeSlots: ['breakfast'],
    days: [{}, {}, {}, {}, {}, {}, {}],
  };
  return {
    schemaVersion: 2,
    onboarded: true,
    customRecipes: [],
    foods,
    plan,
    groceryChecked: [],
    disclaimerAcknowledged: true,
    pantry: [],
    onHand: [],
    madeLog: [],
    onHandDays: {},
    dismissed: {},
  };
}

/** A produce ingredient with the given name (category is irrelevant to keys). */
function ing(name: string, extra: Partial<Ingredient> = {}): Ingredient {
  return { name, category: 'produce', ...extra };
}

describe('foodKeyFor — allergen mapping', () => {
  it('maps a single-group allergen (egg -> allergen:egg)', () => {
    expect(foodKeyFor(ing('egg'))).toEqual(['allergen:egg']);
  });

  it('maps milk to the dairy group', () => {
    expect(foodKeyFor(ing('milk'))).toEqual(['allergen:dairy']);
  });

  it('maps peanut to the peanut group', () => {
    expect(foodKeyFor(ing('peanut butter'))).toEqual(['allergen:peanut']);
  });

  it('maps a multi-group ingredient to every firing group, sorted', () => {
    // "egg noodles": egg (egg) + noodle (wheat).
    expect(foodKeyFor(ing('egg noodles'))).toEqual([
      'allergen:egg',
      'allergen:wheat',
    ]);
  });

  it('honors an allergen rule except list (almond milk is tree nut, not dairy)', () => {
    const keys = foodKeyFor(ing('almond milk'));
    expect(keys).toContain('allergen:tree nuts');
    expect(keys).not.toContain('allergen:dairy');
  });

  it('does not map breast milk to dairy (except: breast)', () => {
    expect(foodKeyFor(ing('breast milk'))).not.toContain('allergen:dairy');
  });
});

describe('foodKeyFor — ingredient.food override vs allergen precedence', () => {
  it('uses ingredient.food when no allergen rule fires (override wins over name)', () => {
    expect(foodKeyFor(ing('golden delicious apple', { food: 'apple' }))).toEqual([
      'apple',
    ]);
  });

  it('trims and lowercases the override to a stable key', () => {
    expect(foodKeyFor(ing('x', { food: '  Sweet Potato  ' }))).toEqual([
      'sweet potato',
    ]);
  });

  it('allergen check is FIRST: an allergen still keys to allergen even if .food is set', () => {
    // "egg" fires the egg allergen rule; the .food override is ignored.
    expect(foodKeyFor(ing('egg', { food: 'breakfast thing' }))).toEqual([
      'allergen:egg',
    ]);
  });
});

describe('foodKeyFor — descriptor stripping (one per descriptor word)', () => {
  const cases: Array<[string, string]> = [
    ['fresh spinach', 'spinach'],
    ['frozen pea', 'pea'],
    ['ripe banana', 'banana'],
    ['cooked quinoa', 'quinoa'],
    ['raw zucchini', 'zucchini'],
    ['chopped broccoli', 'broccoli'],
    ['diced mango', 'mango'],
    ['mashed avocado', 'avocado'],
    ['pureed pumpkin', 'pumpkin'],
    ['grated beetroot', 'beetroot'],
    ['ground lentil', 'lentil'],
    ['organic pear', 'pear'],
    ['plain quinoa', 'quinoa'],
    ['whole barley', 'barley'],
    ['unsalted broth', 'broth'],
    ['canned pumpkin', 'pumpkin'],
    ['small zucchini', 'zucchini'],
    ['medium parsnip', 'parsnip'],
    ['large plantain', 'plantain'],
    ['baby carrot', 'carrot'],
  ];

  it('strips every single-word descriptor in DESCRIPTOR_WORDS', () => {
    // Guard: the table above covers each descriptor word exactly once.
    expect(cases).toHaveLength(DESCRIPTOR_WORDS.length);
  });

  for (const [input, expected] of cases) {
    it(`"${input}" -> "${expected}"`, () => {
      expect(foodKeyFor(ing(input))).toEqual([expected]);
    });
  }

  it('strips the two-word "low sodium" phrase', () => {
    expect(foodKeyFor(ing('low sodium broth'))).toEqual(['broth']);
  });
});

describe('foodKeyFor — quantity / number and name derivation', () => {
  it('drops pure number tokens', () => {
    expect(foodKeyFor(ing('2 zucchini'))).toEqual(['zucchini']);
  });

  it('keeps only text before the first comma (preparation notes dropped)', () => {
    expect(foodKeyFor(ing('medium apple, peeled, cored and quartered'))).toEqual([
      'apple',
    ]);
  });

  it('singularizes a plural head word (carrots -> carrot)', () => {
    expect(foodKeyFor(ing('carrots, peeled and sliced'))).toEqual(['carrot']);
  });

  it('derives the same key for small and pureed sweet potato', () => {
    expect(foodKeyFor(ing('small sweet potato'))).toEqual(['sweet potato']);
    expect(foodKeyFor(ing('pureed sweet potato'))).toEqual(['sweet potato']);
  });
});

describe('ignored foods', () => {
  it('flags water, breast milk, breastmilk, formula and ice', () => {
    for (const key of ['water', 'breast milk', 'breastmilk', 'formula', 'ice']) {
      expect(isIgnoredFood(key)).toBe(true);
    }
  });

  it('does not flag a normal food', () => {
    expect(isIgnoredFood('apple')).toBe(false);
  });

  it("excludes the recipe's 'breastmilk, water or prepared formula' and 'water' from collectFoods", () => {
    const recipe: Recipe = {
      id: 'test',
      origin: 'custom',
      title: 'Test',
      stages: ['6-8'],
      mealTypes: ['lunch'],
      ingredients: [
        ing('breastmilk, water or prepared formula', { category: 'other' }),
        ing('water', { category: 'other' }),
        ing('carrots, peeled and sliced'),
      ],
      steps: [],
      texture: 'puree',
      servings: 1,
    };
    const keys = collectFoods([recipe]);
    expect(keys).not.toContain('water');
    expect(keys).not.toContain('breastmilk');
    expect(keys).not.toContain('breast milk');
    expect(keys).not.toContain('formula');
    expect(keys).toContain('carrot');
  });
});

describe('collectFoods over the built-in recipes', () => {
  const keys = collectFoods(BUILTIN_RECIPES);

  it('includes expected plain and allergen keys', () => {
    expect(keys).toContain('carrot');
    expect(keys).toContain('apple');
    expect(keys).toContain('sweet potato');
    expect(keys).toContain('allergen:egg');
    expect(keys).toContain('allergen:dairy');
    expect(keys).toContain('allergen:wheat');
  });

  it('excludes ignored foods', () => {
    for (const key of ['water', 'breastmilk', 'breast milk', 'formula', 'ice']) {
      expect(keys).not.toContain(key);
    }
  });

  it('deduplicates (sweet potato appears in multiple recipes but once in the set)', () => {
    expect(keys.filter((k) => k === 'sweet potato')).toHaveLength(1);
  });
});

describe('allFoodKeys — recipe set unioned with recorded foods', () => {
  it('adds a recorded food that no recipe uses', () => {
    const state = makeState({
      banana: { status: 'tried', date: '2026-01-01' },
    });
    const keys = allFoodKeys(BUILTIN_RECIPES, state);
    expect(keys).toContain('banana');
  });

  it('never surfaces an ignored recorded key', () => {
    const state = makeState({
      water: { status: 'tried', date: '2026-01-01' },
    });
    expect(allFoodKeys([], state)).not.toContain('water');
  });
});

describe('reconciliation with Task 7 onboarding keys', () => {
  // Each onboarding food must resolve to the SAME key foodKeyFor derives from
  // the matching recipe ingredient so the tried food lines up with its door.
  it('sweet potato: recipe ingredient derives the onboarding key', () => {
    expect(foodKeyFor(ing('small sweet potato'))).toEqual(['sweet potato']);
  });
  it('carrot: recipe ingredient derives the onboarding key', () => {
    expect(foodKeyFor(ing('carrots, peeled and sliced'))).toEqual(['carrot']);
  });
  it('apple: recipe ingredient derives the onboarding key', () => {
    expect(
      foodKeyFor(ing('medium apple, peeled, cored and quartered')),
    ).toEqual(['apple']);
  });
  it('allergen keys match allergenKey helper', () => {
    expect(allergenKey('egg')).toBe('allergen:egg');
  });
});

describe('foodStatus', () => {
  it('ghosts a block-covered food (honey under 12 months)', () => {
    expect(foodStatus('honey', makeState(), 6)).toBe('ghost');
  });

  it('does not ghost honey once the block lifts at 12 months', () => {
    // honey has underMonths: 12, so it is block-covered at 11 but not at 12.
    expect(isBlockCovered('honey', 11)).toBe(true);
    expect(isBlockCovered('honey', 12)).toBe(false);
    expect(foodStatus('honey', makeState(), 12)).toBe('door');
  });

  it('ghosts a food with a recorded reaction', () => {
    const state = makeState({ apple: { status: 'reaction', date: '2026-01-01' } });
    expect(foodStatus('apple', state, 9)).toBe('ghost');
  });

  it('shows a tried food as a monster', () => {
    const state = makeState({ apple: { status: 'tried', date: '2026-01-01' } });
    expect(foodStatus('apple', state, 9)).toBe('monster');
  });

  it('shows an untried, unblocked food as a door', () => {
    expect(foodStatus('apple', makeState(), 9)).toBe('door');
  });

  it('a reaction takes precedence over a tried record (ghost wins over monster)', () => {
    const state = makeState({ apple: { status: 'reaction', date: '2026-01-02' } });
    expect(foodStatus('apple', state, 9)).toBe('ghost');
  });

  it('allergen keys are never block-covered', () => {
    expect(isBlockCovered('allergen:peanut', 6)).toBe(false);
    expect(foodStatus('allergen:peanut', makeState(), 6)).toBe('door');
  });
});

describe('block coverage survives key derivation (every block term is a ghost, never a door)', () => {
  // Item 2 regression guard: deriving a food key from a block term must leave
  // the key block-covered, so no block term is ever shown as a "New food" door
  // with a "Tried, no reaction" button. Molasses is the term that originally
  // broke (singularizeToken turned it into "molass"); the test covers EVERY
  // block term so no future over-singularization can regress coverage.
  const blockRules = RULES.filter((r) => r.kind === 'block');

  for (const rule of blockRules) {
    for (const term of rule.terms) {
      it(`block term "${term}" (${rule.id}) never derives a plain new-food door`, () => {
        // Age 0 is under every block rule's underMonths, so a plain derived key
        // for a block term must be block-covered (a ghost), never a door. A few
        // block terms are ALSO allergens ("soy sauce", "fish sauce", "king
        // mackerel", "bigeye tuna", "raw milk"); allergen-first precedence keys
        // those to `allergen:<group>`, which is an allergen door (never a plain
        // new-food door) and is acceptable. What must NOT happen is a block term
        // deriving to a plain key that screens clean (the molasses bug).
        const keys = foodKeyFor(ing(term));
        for (const key of keys) {
          if (key.startsWith('allergen:')) continue; // allergen door is fine
          expect(isBlockCovered(key, 0)).toBe(true);
          expect(foodStatus(key, makeState(), 0)).toBe('ghost');
        }
      });
    }
  }

  it('molasses specifically stays "molasses" (not "molass") and is block-covered', () => {
    expect(foodKeyFor(ing('molasses'))).toEqual(['molasses']);
    expect(isBlockCovered('molasses', 0)).toBe(true);
    // A custom recipe with molasses shows it as a ghost, never a door.
    expect(foodStatus('molasses', makeState(), 10)).toBe('ghost');
  });
});

describe('built-in recipes derive clean food keys (Item 3)', () => {
  // Pin the FULL set of food keys collected from the built-in recipes so the
  // earlier nonsense keys ("of infant banana", "cereal rice or oatmeal",
  // "cinnamon optional", "of food vegetable", "of spice such as pepper",
  // "cubed beef", "lean beef") can never come back.
  it('pins the collected key set', () => {
    expect(collectFoods(BUILTIN_RECIPES)).toEqual([
      'carrot',
      'apple',
      'sweet potato',
      'chicken',
      'brown rice',
      'beef',
      'potato',
      'pea',
      'rice',
      'broccoli',
      // "cooked macaroni" now derives allergen:wheat (RULESET_VERSION 2 added
      // "macaroni" to the wheat allergen rule), taking the slot where the plain
      // "macaroni" key used to sit; the flour-derived allergen:wheat later in
      // the batch now dedups into this same key.
      'allergen:wheat',
      'squash',
      'oat',
      'banana',
      'allergen:dairy',
      'allergen:egg',
      'cinnamon',
      'vanilla extract',
      'rice cereal',
      'applesauce',
      'vegetable',
      'spice',
      'spinach',
      'baking powder',
      // Simple ideas (batch 1) add these; mozzarella, bread and egg dedup into
      // the allergen keys above.
      'peach',
      'green bean',
      'cauliflower',
      'bean',
      // Batch 2 (task 14.3) recipes add these; keys that already sit above dedup.
      'allergen:peanut',
      'pear',
      'allergen:tree nuts',
      'vanilla',
      'allergen:soy',
      'onion',
      'bell pepper',
      'vegetable oil',
      'garlic powder',
      'black pepper',
      'nonstick cooking spray',
      'hoisin sauce',
      'cornmeal',
      'dry mustard',
      'allergen:fish',
      'mayonnaise',
      'lemon juice',
      'celery',
      'thyme',
      'onion powder',
      'paprika',
      'corn',
      'olive oil',
      'allergen:shellfish',
      'garlic',
      'cabbage',
      'jicama',
      'chicken broth',
      'salt',
      'brown sugar',
      'cornstarch',
      'spring roll wrapper',
      'red leaf lettuce',
      'chickpea',
      'allergen:sesame',
      'coriander',
      'vinegar',
      'sugar',
      'red pepper flake',
      'cumin',
      'baking soda',
      'margarine',
      'canola oil',
      'orange juice',
      'black bean',
      'tomato',
      'cilantro',
      // Batch 3 (task 14.3) recipes add these; keys that already sit above dedup.
      'seasoning',
      'turnip',
      'chili powder',
      'pineapple',
      'berry',
      'strawberry',
      'broth',
      'green onion',
      'split pea',
      'ginger',
      'curry powder',
      'nutmeg',
      'pumpkin',
      'white bean',
      'italian seasoning',
      'kale',
      'oregano',
      'mixed vegetable',
      'mustard',
      'dill',
      'zucchini',
      'lentil',
      'ground beef',
      'basil',
      'tomato soup',
      'parsley',
      'mushroom',
      'noodle',
      'leek',
      'tomato paste',
      'ketchup',
      'barbecue sauce',
      'summer squash',
      'apple pie spice',
      'quinoa',
      'turmeric',
      'herbs de provence',
      'croissant',
      'seafood seasoning',
      'lettuce',
      'lime',
      'lime juice',
      'cayenne',
      'salsa',
      'corn tortilla',
      'teriyaki sauce',
      'greens',
      'orange',
      'bulgur',
      'baking mix',
      'blueberry',
      'asparagus',
      'cranberry',
      'italian dressing',
      'cucumber',
      'raisin',
      'cherry',
      'honey',
      'pinto bean',
      'jalapeno',
      'hot sauce',
      'beet',
      'rosemary',
      'parsnip',
      'barley',
      'winter squash',
      'vegetable broth',
      'chive',
      'gochujang',
      'manicotti',
      'pumpkin pie spice',
      'bok choy',
      'sugar snap pea',
      // Batch 5 (task 14.3) recipes add these.
      'english muffin',
      'granola',
      'raspberry',
      'mint',
      'watermelon',
      'melon',
      'turkey',
      'pickle relish',
      'radish',
      'fruit',
      'salad dressing',
      'pork',
      'mandarin orange',
      'snow pea',
      'water chestnut',
      'turkey ham',
      'cooking spray',
      'seaweed',
      'horseradish',
      'white pepper',
      'kidney bean',
      'tomato sauce',
      'corn flakes',
      'green chile',
      'taco seasoning',
      'roll',
      'sweet sour sauce',
    ]);
  });

  it('produces no nonsense keys', () => {
    const keys = collectFoods(BUILTIN_RECIPES);
    for (const bad of [
      'of infant banana',
      'cereal rice or oatmeal',
      'cinnamon optional',
      'of food vegetable',
      'of spice such as pepper',
      'cubed beef',
      'lean beef',
    ]) {
      expect(keys).not.toContain(bad);
    }
    // No key starts with a stray "of".
    expect(keys.some((k) => k.startsWith('of '))).toBe(false);
  });

  it('an onboarding-tried banana lines up with the recipe banana (one card, not two)', () => {
    const keys = collectFoods(BUILTIN_RECIPES);
    // The cereal-pancakes recipe's "(4 oz) jar of infant bananas" derives the
    // SAME key onboarding records for "Banana".
    expect(keys).toContain('banana');
    const state = makeState({ banana: { status: 'tried', date: '2026-01-01' } });
    const all = allFoodKeys(BUILTIN_RECIPES, state);
    // banana appears exactly once (no duplicate door + monster).
    expect(all.filter((k) => k === 'banana')).toHaveLength(1);
  });

  it("an onboarding-tried oat lines up with the recipe's oat key", () => {
    const keys = collectFoods(BUILTIN_RECIPES);
    expect(keys).toContain('oat');
    const state = makeState({ oat: { status: 'tried', date: '2026-01-01' } });
    const all = allFoodKeys(BUILTIN_RECIPES, state);
    expect(all.filter((k) => k === 'oat')).toHaveLength(1);
  });
});

describe('blockFoodKeys — representative blocked foods for an age (Req 5.7)', () => {
  it('includes honey under 12 months and drops it at 12', () => {
    expect(blockFoodKeys(6)).toContain('honey');
    expect(blockFoodKeys(12)).not.toContain('honey');
  });

  it('includes the other block foods while their rules apply', () => {
    const keys = blockFoodKeys(6);
    // first term of each age-limited block rule applicable at 6 months
    for (const key of ['honey', 'juice', 'sugar', 'stevia', 'salt', 'popcorn']) {
      expect(keys).toContain(key);
    }
    // rules with no age limit always apply
    expect(keys).toContain('shark');
    expect(keys).toContain('raw milk');
  });

  it('never includes an allergen key (allergens are doors, not blocks)', () => {
    expect(blockFoodKeys(6).some((k) => k.startsWith('allergen:'))).toBe(false);
  });

  it('every returned key is block-covered at that age', () => {
    for (const key of blockFoodKeys(6)) {
      expect(isBlockCovered(key, 6)).toBe(true);
    }
  });
});

describe('allergen-door guidance (Req 7.7)', () => {
  it('generic guidance is the Req 7.7 substance and cites the allergen sources', () => {
    const g = allergenGuidance('egg');
    expect(g.generic).toBe(ALLERGEN_GENERIC_GUIDANCE);
    expect(g.peanutNote).toBeUndefined();
    expect(g.sources).toContain('AAP-allergens');
    expect(g.sources).toContain('NIAID-peanut');
  });

  it('the peanut door adds the eczema / egg-allergy note', () => {
    const g = allergenGuidance('peanut');
    expect(g.peanutNote).toBe(ALLERGEN_PEANUT_NOTE);
    expect(g.peanutNote).toMatch(/pediatrician/);
    expect(g.peanutNote).toMatch(/eczema/);
  });
});

describe('foodKeyFromName', () => {
  it('turns typed names into plain singular keys', () => {
    expect(foodKeyFromName('Sweet potatoes')).toBe('sweet potato');
    expect(foodKeyFromName('  Ripe Bananas ')).toBe('banana');
    expect(foodKeyFromName('Blueberries')).toBe('blueberry');
  });

  it('matches the key groceryFoodKey derives for the same name', () => {
    for (const name of ['Sweet potatoes', 'carrots, peeled', 'molasses']) {
      expect(foodKeyFromName(name)).toBe(groceryFoodKey({ name, category: 'produce' }));
    }
  });
});
