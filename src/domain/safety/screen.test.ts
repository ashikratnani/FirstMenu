import { describe, expect, it } from 'vitest';
import type { Recipe } from '../types';
import { screenIngredient, screenRecipe } from './screen';
import type { Finding } from './screen';

// A young age at which every age-limited rule applies.
const YOUNG = 6;

function ruleIds(findings: Finding[]): string[] {
  return findings.map((f) => f.ruleId);
}

function fires(name: string, ruleId: string, ageMonths = YOUNG): boolean {
  return ruleIds(screenIngredient(name, ageMonths)).includes(ruleId);
}

describe('screenIngredient - matching table (must fire / must not fire)', () => {
  // Each entry: [name, mustFire ruleIds, mustNotFire ruleIds].
  const table: Array<[string, string[], string[]]> = [
    ['Honey', ['honey'], []],
    ['honeydew melon', [], ['honey']],
    ['sugar snap peas', [], ['added-sugar']],
    ['brown sugar', ['added-sugar'], []],
    ['peanut butter', ['allergen-peanut', 'nut-seed-butter'], ['allergen-dairy', 'whole-nuts']],
    ['unsalted butter', ['allergen-dairy'], ['added-salt']],
    ['eggplant', [], ['allergen-egg', 'eggs-cooked']],
    ['2 eggs', ['allergen-egg', 'eggs-cooked'], []],
    ['red grapes', ['grapes'], []],
    ['grapefruit', [], ['grapes']],
    ['cherry tomatoes', ['cherry-tomato'], ['cherries']],
    ['lemon juice', [], ['juice']],
    ['apple juice', ['juice'], []],
    ['xanthan gum', [], ['choking-no-safe-form']],
    ['breast milk', [], ['cows-milk', 'allergen-dairy']],
    ['whole milk yogurt', ['allergen-dairy', 'cows-milk'], []],
    ['almond flour', ['allergen-tree-nuts'], ['whole-nuts', 'allergen-wheat']],
    ['Swordfish', ['high-mercury-fish'], ['allergen-fish']],
    ['grated cheeses', ['allergen-dairy', 'cheese'], []],
    ['hot dogs', ['sausages'], []],
    ['egg noodles', ['allergen-egg', 'allergen-wheat'], []],
    ['rice noodles', [], ['allergen-wheat']],
  ];

  for (const [name, mustFire, mustNotFire] of table) {
    it(`"${name}" fires [${mustFire.join(', ')}] and not [${mustNotFire.join(', ')}]`, () => {
      const ids = ruleIds(screenIngredient(name, YOUNG));
      for (const id of mustFire) {
        expect(ids, `${name} should fire ${id}`).toContain(id);
      }
      for (const id of mustNotFire) {
        expect(ids, `${name} should NOT fire ${id}`).not.toContain(id);
      }
    });
  }
});

describe('screenIngredient - age limits (limit-1 fires, limit does not)', () => {
  const ageLimited: Array<[string, string, number]> = [
    ['honey', 'honey', 12],
    ['apple juice', 'juice', 12],
    ['brown sugar', 'added-sugar', 24],
    ['stevia', 'sweeteners', 24],
    ['salt', 'added-salt', 24],
    ['popcorn', 'choking-no-safe-form', 48],
    ['red grapes', 'grapes', 48],
    ['cherry tomatoes', 'cherry-tomato', 48],
    ['cheese', 'cheese', 48],
    ['whole milk', 'cows-milk', 12],
  ];

  for (const [name, ruleId, limit] of ageLimited) {
    it(`${ruleId} fires at ${limit - 1} months and not at ${limit}`, () => {
      expect(fires(name, ruleId, limit - 1)).toBe(true);
      expect(fires(name, ruleId, limit)).toBe(false);
    });
  }
});

describe('screenIngredient - defensive age handling', () => {
  it('treats NaN age as strictest (honey still blocks)', () => {
    expect(fires('Honey', 'honey', Number.NaN)).toBe(true);
  });

  it('treats a negative age as strictest (honey still blocks)', () => {
    expect(fires('Honey', 'honey', -5)).toBe(true);
  });
});

describe('screenRecipe', () => {
  function recipe(names: string[]): Recipe {
    return {
      id: 'test',
      origin: 'custom',
      title: 'Test',
      stages: ['6-8'],
      mealTypes: ['lunch'],
      ingredients: names.map((name) => ({ name, category: 'other' as const })),
      steps: [],
      texture: 'smooth',
      servings: 1,
    };
  }

  it('buckets findings into blocks, reminders and allergens', () => {
    const result = screenRecipe(recipe(['Honey', 'whole milk yogurt']), YOUNG);
    expect(ruleIds(result.blocks)).toContain('honey');
    expect(ruleIds(result.reminders)).toContain('cows-milk');
    expect(ruleIds(result.allergens)).toContain('allergen-dairy');
  });

  it('sets the correct ingredientIndex per finding', () => {
    const result = screenRecipe(recipe(['water', 'Honey']), YOUNG);
    const honey = result.blocks.find((f) => f.ruleId === 'honey');
    expect(honey?.ingredientIndex).toBe(1);
  });

  it('populates availableAtMonths for age-limited block/reminder findings', () => {
    const result = screenRecipe(recipe(['Honey']), YOUNG);
    const honey = result.blocks.find((f) => f.ruleId === 'honey');
    expect(honey?.availableAtMonths).toBe(12);
  });

  it('de-duplicates reminders by message per ingredient', () => {
    // "cheese" produces the "cheese" reminder; a name with the term twice must
    // still yield a single reminder for that ingredient.
    const result = screenRecipe(recipe(['cheese and cheese']), YOUNG);
    const cheeseReminders = result.reminders.filter((f) => f.ruleId === 'cheese');
    expect(cheeseReminders).toHaveLength(1);
  });
});
