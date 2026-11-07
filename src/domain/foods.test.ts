import { describe, expect, it } from 'vitest';
import {
  ALLERGEN_GENERIC_GUIDANCE,
  ALLERGEN_PEANUT_NOTE,
  allergenGuidance,
  allergenKey,
  collectFoods,
  allFoodKeys,
  DESCRIPTOR_WORDS,
  foodKeyFor,
  foodStatus,
  isBlockCovered,
  isIgnoredFood,
} from './foods';
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
    schemaVersion: 1,
    onboarded: true,
    customRecipes: [],
    foods,
    plan,
    groceryChecked: [],
    disclaimerAcknowledged: true,
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
