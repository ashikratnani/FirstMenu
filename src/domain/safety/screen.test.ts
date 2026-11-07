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
    ['Swordfish', ['high-mercury-fish'], []],
    ['grated cheeses', ['allergen-dairy', 'cheese'], []],
    ['hot dogs', ['sausages'], []],
    ['egg noodles', ['allergen-egg', 'allergen-wheat'], []],
    ['rice noodles', [], ['allergen-wheat']],
    // Wheat terms added in RULESET_VERSION 2 (maintainer-approved macaroni gap fix):
    // macaroni, spaghetti and penne now surface the wheat allergen door.
    ['cooked macaroni', ['allergen-wheat'], []],
    ['macaroni cheese', ['allergen-wheat', 'allergen-dairy'], []],
    ['spaghetti', ['allergen-wheat'], []],
    ['penne', ['allergen-wheat'], []],
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
    ['cherries', 'cherries', 48],
    ['blueberries', 'small-round-fruit', 48],
    ['hot dog', 'sausages', 48],
    ['walnuts', 'whole-nuts', 48],
    ['peanut butter', 'nut-seed-butter', 48],
    ['carrot', 'hard-produce', 48],
    ['raisins', 'dried-fruit', 48],
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
    // "grape and cherry tomatoes" matches two DIFFERENT reminder rules that emit
    // the SAME message ("Quarter lengthwise before serving."): `grapes` and
    // `cherry-tomato`. Per-ingredient message de-dup must collapse them into a
    // single reminder. This fails if the de-dup is removed (two reminders).
    const result = screenRecipe(recipe(['grape and cherry tomatoes']), YOUNG);
    const quarterReminders = result.reminders.filter(
      (f) => f.message === 'Quarter lengthwise before serving.',
    );
    expect(quarterReminders).toHaveLength(1);
  });

  it('keeps the same reminder message once PER ingredient (no recipe-wide collapse)', () => {
    // Complementary to the per-ingredient de-dup above: the SAME message
    // ("Quarter lengthwise before serving.") on TWO DIFFERENT ingredients must
    // appear once PER ingredient. 'red grapes' fires the `grapes` rule and
    // 'cherry tomatoes' fires the `cherry-tomato` rule; both emit that message.
    // De-dup is per-ingredient (design.md ~221), so this must NOT collapse
    // across the whole recipe. This fails if the seen-messages Set is hoisted
    // to recipe scope (only one reminder would survive).
    const result = screenRecipe(recipe(['red grapes', 'cherry tomatoes']), YOUNG);
    const quarterReminders = result.reminders.filter(
      (f) => f.message === 'Quarter lengthwise before serving.',
    );
    expect(quarterReminders).toHaveLength(2);
    expect(quarterReminders.map((f) => f.ingredientIndex).sort()).toEqual([0, 1]);
  });
});
