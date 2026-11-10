import { describe, expect, it } from 'vitest';
import type { Recipe } from '../types';
import { RULES } from './rules';
import { screenIngredient, screenRecipe, screenTextMentions, splitSentences } from './screen';
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
    // macaroni and penne now surface the wheat allergen door. "spaghetti" was
    // dropped (issue #23, Option B) because it matched "spaghetti squash", a
    // common wheat-free baby vegetable; see the guard test below.
    ['cooked macaroni', ['allergen-wheat'], []],
    ['macaroni cheese', ['allergen-wheat', 'allergen-dairy'], []],
    ['penne', ['allergen-wheat'], []],
    // Guard against reintroducing the "spaghetti" false positive: spaghetti
    // squash is a vegetable, not wheat, so it must NOT fire the wheat door.
    ['spaghetti squash', [], ['allergen-wheat']],
    ['roasted spaghetti squash', [], ['allergen-wheat']],
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

describe('screenTextMentions (pasted recipes, active spec Requirement 7)', () => {
  function pasted(over: Partial<Recipe> = {}): Recipe {
    return {
      id: 'p1',
      origin: 'custom',
      title: 'Banana oats',
      stages: ['6-8'],
      mealTypes: ['lunch'],
      ingredients: [{ name: 'banana', category: 'produce' }],
      steps: ['Mash the banana.'],
      notes: [],
      texture: 'smooth',
      servings: 1,
      imported: { from: 'chatgpt', text: 'x', date: '2026-01-05' },
      ...over,
    };
  }
  const ids = (r: Recipe, age = YOUNG) => screenTextMentions(r, age).map((m) => m.ruleId);

  it('does not run for a recipe without `imported` (typed recipes stay ingredient-only)', () => {
    const r = pasted({ steps: ['Add honey.'], imported: undefined });
    expect(screenTextMentions(r, YOUNG)).toEqual([]);
  });

  it('fires in steps, the title and notes, with the sentence and where', () => {
    const r = pasted({
      title: 'Honey banana oats',
      steps: ['Mash the banana. Drizzle with honey.'],
      notes: ['Keeps well. No honey for babies.'],
    });
    const mentions = screenTextMentions(r, YOUNG);
    expect(mentions.map((m) => [m.ruleId, m.where, m.sentence])).toEqual([
      ['honey', 'title', 'Honey banana oats'],
      ['honey', 'step', 'Drizzle with honey.'],
      ['honey', 'note', 'No honey for babies.'],
    ]);
    expect(mentions[0].label).toBe('Honey');
    expect(mentions[0].message).toMatch(/botulism/);
  });

  it('checks every block rule in a step, one mention per rule', () => {
    const r = pasted({
      steps: ['Add a pinch of salt.', 'Top with popcorn.', 'Serve with swordfish.', 'Use raw milk.', 'Add apple juice.'],
    });
    expect(ids(r, 6).sort()).toEqual(
      ['added-salt', 'choking-no-safe-form', 'high-mercury-fish', 'juice', 'unpasteurized'].sort(),
    );
  });

  it('covers the sugar and sweetener block rules', () => {
    expect(ids(pasted({ steps: ['Stir in brown sugar.'] }))).toEqual(['added-sugar']);
    expect(ids(pasted({ steps: ['Add a little stevia.'] }))).toEqual(['sweeteners']);
  });

  it('never reports reminder or allergen rules', () => {
    const r = pasted({ steps: ['Add grapes, peanut butter, milk and a whole nut.'] });
    expect(screenTextMentions(r, YOUNG)).toEqual([]);
  });

  it('has no negation handling: "no salt" and "without honey" still fire', () => {
    expect(ids(pasted({ steps: ['Do not add salt.'] }))).toEqual(['added-salt']);
    expect(ids(pasted({ steps: ['Make it without honey.'] }))).toEqual(['honey']);
    expect(ids(pasted({ steps: ["Don't forget the honey."] }))).toEqual(['honey']);
  });

  it('matches whole words only, plural-aware', () => {
    expect(ids(pasted({ steps: ['Add honeydew melon.'] }))).toEqual([]);
    expect(ids(pasted({ steps: ['Add sugar snap peas.'] }))).toEqual([]);
    expect(ids(pasted({ steps: ['Add two juices.'] }))).toEqual(['juice']);
    expect(ids(pasted({ steps: ['ADD HONEY!'] }))).toEqual(['honey']);
  });

  it('keeps exceptions local to the matched word', () => {
    expect(ids(pasted({ steps: ['Add a squeeze of lemon juice.'] }))).toEqual([]);
    expect(ids(pasted({ steps: ['Add lime juice.'] }))).toEqual([]);
    expect(ids(pasted({ steps: ['Add xanthan gum.'] }), 12)).toEqual([]);
    // An exception word elsewhere in the sentence must not hide another match.
    expect(ids(pasted({ steps: ['Squeeze a lemon and add apple juice.'] }))).toEqual(['juice']);
    expect(ids(pasted({ steps: ['Use lemon juice or apple juice.'] }))).toEqual(['juice']);
  });

  it('respects age limits at limit - 1 and limit', () => {
    const honey = pasted({ steps: ['Add honey.'] });
    expect(ids(honey, 11)).toEqual(['honey']);
    expect(ids(honey, 12)).toEqual([]);
    const salt = pasted({ steps: ['Add salt.'] });
    expect(ids(salt, 23)).toEqual(['added-salt']);
    expect(ids(salt, 24)).toEqual([]);
    const popcorn = pasted({ steps: ['Add popcorn.'] });
    expect(ids(popcorn, 47)).toEqual(['choking-no-safe-form']);
    expect(ids(popcorn, 48)).toEqual([]);
    // No age limit: fires at any age.
    expect(ids(pasted({ steps: ['Serve swordfish.'] }), 60)).toEqual(['high-mercury-fish']);
  });

  it('treats a bad age as the strictest', () => {
    expect(ids(pasted({ steps: ['Add honey.'] }), Number.NaN)).toEqual(['honey']);
    expect(ids(pasted({ steps: ['Add honey.'] }), -3)).toEqual(['honey']);
  });

  it('skips a rule that already has a block finding from the ingredient list', () => {
    const r = pasted({
      ingredients: [{ name: 'honey', category: 'other' }],
      steps: ['Drizzle with honey.', 'Add a pinch of salt.'],
    });
    expect(ids(r)).toEqual(['added-salt']);
  });

  it('drops a cleared mention for that exact rule and sentence only', () => {
    const r = pasted({
      steps: ['Do not add salt.', 'Add salt to taste.'],
      clearedMentions: [{ ruleId: 'added-salt', sentence: 'Do not add salt.' }],
    });
    expect(screenTextMentions(r, YOUNG).map((m) => m.sentence)).toEqual(['Add salt to taste.']);
    // The same sentence cleared for a different rule does not clear this one.
    const other = pasted({
      steps: ['Do not add salt.'],
      clearedMentions: [{ ruleId: 'honey', sentence: 'Do not add salt.' }],
    });
    expect(ids(other)).toEqual(['added-salt']);
  });

  it('brings a cleared mention back when its sentence changes (Requirement 7.6)', () => {
    const cleared = [{ ruleId: 'added-salt', sentence: 'Do not add salt.' }];
    expect(ids(pasted({ steps: ['Do not add salt.'], clearedMentions: cleared }))).toEqual([]);
    expect(ids(pasted({ steps: ['Do not add any salt.'], clearedMentions: cleared }))).toEqual(['added-salt']);
    expect(ids(pasted({ steps: ['Do not add salt'], clearedMentions: cleared }))).toEqual(['added-salt']);
  });

  it('does not let a cleared mention hide an ingredient block (Requirement 7.5)', () => {
    const r = pasted({
      ingredients: [{ name: 'honey', category: 'other' }],
      steps: ['Add honey.'],
      clearedMentions: [{ ruleId: 'honey', sentence: 'Add honey.' }],
    });
    expect(screenRecipe(r, YOUNG).blocks.map((b) => b.ruleId)).toEqual(['honey']);
  });

  it('every block rule fires on each of its terms in text', () => {
    for (const rule of RULES.filter((x) => x.kind === 'block')) {
      for (const term of rule.terms) {
        const r = pasted({ steps: [`Then add ${term} here.`] });
        expect(ids(r, 6), `${rule.id}: ${term}`).toContain(rule.id);
      }
    }
  });
});

describe('splitSentences', () => {
  it('splits at . ! ? and line breaks, not inside numbers', () => {
    expect(splitSentences('Add 1.5 cups. Stir! Done?\nNext line')).toEqual([
      'Add 1.5 cups.',
      'Stir!',
      'Done?',
      'Next line',
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(splitSentences('  ')).toEqual([]);
  });
});
