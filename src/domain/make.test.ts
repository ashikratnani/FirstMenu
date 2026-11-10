import { describe, expect, it } from 'vitest';
import {
  MORE_IDEAS_LIMIT,
  activeFilters,
  makeResults,
  recipeServeAs,
  recipesNamed,
  requiredKeys,
  setIronRichFilter,
  suggestedChips,
} from './make';
import { foodKeyFromName } from './foods';
import type { AppState, Ingredient, Recipe, ServeAs, StageId } from './types';

function ing(name: string, extra: Partial<Ingredient> = {}): Ingredient {
  return { name, category: 'other', ...extra };
}

let counter = 0;
function recipe(title: string, names: Array<string | Ingredient>, extra: Partial<Recipe> = {}): Recipe {
  counter += 1;
  return {
    id: `r-${counter}`,
    origin: 'custom',
    title,
    stages: ['9-12'],
    mealTypes: ['dinner'],
    ingredients: names.map((n) => (typeof n === 'string' ? ing(n) : n)),
    steps: ['Mix.'],
    texture: 'soft',
    servings: 2,
    ...extra,
  };
}

const NO_FOODS: AppState['foods'] = {};
const AGE_10 = 10; // stage 9-12
const have = (...keys: string[]) => new Set(keys);
const titles = (list: Array<{ recipe: Recipe }>) => list.map((r) => r.recipe.title);

describe('makeResults groups', () => {
  it('puts a recipe with nothing missing in readyNow', () => {
    const r = recipe('Rice and Peas', ['rice', 'peas']);
    const out = makeResults([r], have('rice', 'pea'), AGE_10, NO_FOODS);
    expect(titles(out.readyNow)).toEqual(['Rice and Peas']);
    expect(out.readyNow[0].missing).toEqual([]);
    expect(out.missingOne).toEqual([]);
  });

  it('puts a recipe missing exactly one food in missingOne and names it', () => {
    const r = recipe('Rice and Peas', ['rice', 'peas']);
    const out = makeResults([r], have('rice'), AGE_10, NO_FOODS);
    expect(out.readyNow).toEqual([]);
    expect(out.missingOne[0].missing).toEqual(['pea']);
  });

  it('drops a recipe missing two or more foods', () => {
    const r = recipe('Rice and Peas', ['rice', 'peas']);
    const out = makeResults([r], have(), AGE_10, NO_FOODS);
    expect(out).toEqual({ readyNow: [], missingOne: [], ghosted: [], moreIdeas: [] });
  });

  it('matches by plain key: "2 cups diced sweet potatoes" counts as sweet potato (Req 3.3)', () => {
    const r = recipe('Sweet Potato Mash', [ing('sweet potatoes, diced', { quantity: 2, unit: 'cup' })]);
    const out = makeResults([r], have(foodKeyFromName('Sweet potatoes')), AGE_10, NO_FOODS);
    expect(titles(out.readyNow)).toEqual(['Sweet Potato Mash']);
  });

  it('honors the "counts as" override', () => {
    const r = recipe('Bowl', [ing('Mystery mince', { food: 'beef' })]);
    expect(makeResults([r], have('beef'), AGE_10, NO_FOODS).readyNow).toHaveLength(1);
  });

  it('does not use allergen group keys: yogurt does not cover butter', () => {
    const r = recipe('Buttery Rice', ['rice', 'butter']);
    const out = makeResults([r], have('rice', 'yogurt', 'allergen:dairy'), AGE_10, NO_FOODS);
    expect(out.readyNow).toEqual([]);
    expect(out.missingOne[0].missing).toEqual(['butter']);
  });

  it('always covers ignored foods (water, breast milk, formula, ice)', () => {
    const r = recipe('Thin Puree', ['carrot', 'water', 'breast milk', 'formula', 'ice']);
    expect(makeResults([r], have('carrot'), AGE_10, NO_FOODS).readyNow).toHaveLength(1);
  });

  it('skips optional ingredients (flag and "(optional)" in the name)', () => {
    const r = recipe('Oats', ['oats', ing('cinnamon', { optional: true }), 'raisins (optional)']);
    const out = makeResults([r], have('oat'), AGE_10, NO_FOODS);
    expect(out.readyNow[0].missing).toEqual([]);
  });

  it('de-duplicates missing foods', () => {
    const r = recipe('Eggy', ['egg', 'eggs', 'rice']);
    const out = makeResults([r], have('rice'), AGE_10, NO_FOODS);
    expect(out.missingOne[0].missing).toEqual(['egg']);
  });

  it('reports time (stated or estimated) and effort', () => {
    const stated = recipe('A', ['rice'], { statedMinutes: 20 });
    const est = recipe('B', ['rice'], { steps: ['Simmer 10 minutes.'] });
    const none = recipe('C', ['rice']);
    const out = makeResults([stated, est, none], have('rice'), AGE_10, NO_FOODS).readyNow;
    const byTitle = Object.fromEntries(out.map((r) => [r.recipe.title, r]));
    expect(byTitle.A).toMatchObject({ minutes: 20, minutesKind: 'stated', effort: 'easy' });
    expect(byTitle.B).toMatchObject({ minutes: 15, minutesKind: 'estimated' });
    expect(byTitle.C.minutes).toBeUndefined();
    expect(byTitle.C.minutesKind).toBeUndefined();
  });
});

describe('makeResults ghosting (Req 3.5)', () => {
  it('ghosts a recipe with a block finding, regardless of missing foods', () => {
    const r = recipe('Honey Oats', ['honey', 'oats', 'milk', 'banana']);
    const covered = makeResults([r], have('honey', 'oat', 'milk', 'banana'), AGE_10, NO_FOODS);
    expect(titles(covered.ghosted)).toEqual(['Honey Oats']);
    expect(covered.readyNow).toEqual([]);
    const bare = makeResults([r], have(), AGE_10, NO_FOODS);
    expect(titles(bare.ghosted)).toEqual(['Honey Oats']);
    expect(bare.ghosted[0].missing.length).toBeGreaterThan(1);
  });

  it('ghosts a recipe with a recorded reaction', () => {
    const r = recipe('Carrots', ['carrot']);
    const foods: AppState['foods'] = { carrot: { status: 'reaction', date: '2026-01-01' } };
    const out = makeResults([r], have('carrot'), AGE_10, foods);
    expect(titles(out.ghosted)).toEqual(['Carrots']);
    expect(out.readyNow).toEqual([]);
  });

  it('ghosts a pasted recipe whose steps mention a block food, until cleared', () => {
    const imported = { from: 'other' as const, text: 'x', date: '2026-01-01' };
    const r = recipe('Pasted', ['oats'], { imported, steps: ['Stir in a spoon of honey.'] });
    expect(titles(makeResults([r], have('oat'), AGE_10, NO_FOODS).ghosted)).toEqual(['Pasted']);
    const cleared = {
      ...r,
      clearedMentions: [{ ruleId: 'honey', sentence: 'Stir in a spoon of honey.' }],
    };
    const out = makeResults([cleared], have('oat'), AGE_10, NO_FOODS);
    expect(out.ghosted).toEqual([]);
    expect(titles(out.readyNow)).toEqual(['Pasted']);
  });

  it('does not ghost a block that stops applying at an older age', () => {
    const r = recipe('Honey Oats', ['honey', 'oats'], { stages: ['12-23'] });
    expect(makeResults([r], have('honey', 'oat'), 14, NO_FOODS).readyNow).toHaveLength(1);
  });
});

describe('makeResults stage filter', () => {
  const young = recipe('Young', ['rice'], { stages: ['6-8'] });
  const mid = recipe('Mid', ['rice'], { stages: ['9-12'] });
  const both = recipe('Both', ['rice'], { stages: ['9-12', '12-23'] });
  const toddler = recipe('Toddler', ['rice'], { stages: ['12-23'] });
  const old = recipe('Old', ['rice'], { stages: ['24-36'] });
  const all = [young, mid, both, toddler, old];

  it('keeps only recipes tagged for the infant stage by default', () => {
    const out = makeResults(all, have('rice'), 7, NO_FOODS).readyNow;
    expect(titles(out)).toEqual(['Young']);
    expect(titles(makeResults(all, have('rice'), 10, NO_FOODS).readyNow)).toEqual(['Both', 'Mid']);
  });

  it('shows all stages when asked (Req 3.6)', () => {
    const out = makeResults(all, have('rice'), 7, NO_FOODS, { allStages: true }).readyNow;
    expect(out).toHaveLength(5);
  });

  it('for toddlers also keeps recipes tagged only for younger stages, after the stage recipes (Req 13.8)', () => {
    const out = makeResults(all, have('rice'), 15, NO_FOODS).readyNow;
    expect(titles(out)).toEqual(['Both', 'Toddler', 'Mid', 'Young']);
    expect(out.map((r) => r.youngerStage)).toEqual([false, false, true, true]);
  });

  it('for the oldest stage keeps every younger-only recipe after its own', () => {
    const out = makeResults(all, have('rice'), 30, NO_FOODS).readyNow;
    expect(titles(out)).toEqual(['Old', 'Both', 'Mid', 'Toddler', 'Young']);
  });

  it('does not keep recipes tagged for older stages, even for toddlers', () => {
    const out = makeResults(all, have('rice'), 13, NO_FOODS).readyNow;
    expect(titles(out)).not.toContain('Old');
  });

  it('puts younger-stage recipes after the child stage in each group, even if quicker', () => {
    const quickYoung = recipe('Quick young', ['rice'], { stages: ['9-12'], statedMinutes: 5 });
    const slowOwn = recipe('Slow own', ['rice'], { stages: ['12-23'], statedMinutes: 60 });
    const out = makeResults([quickYoung, slowOwn], have('rice'), 15, NO_FOODS).readyNow;
    expect(titles(out)).toEqual(['Slow own', 'Quick young']);
    const one = makeResults(
      [recipe('Y', ['rice', 'peas'], { stages: ['9-12'], statedMinutes: 5 }), recipe('O', ['rice', 'peas'], { stages: ['12-23'], statedMinutes: 60 })],
      have('rice'),
      15,
      NO_FOODS,
    ).missingOne;
    expect(titles(one)).toEqual(['O', 'Y']);
  });

  it('applies the stage filter to ghosted recipes too', () => {
    const r = recipe('Honey', ['honey'], { stages: ['12-23'] });
    expect(makeResults([r], have(), 7, NO_FOODS).ghosted).toEqual([]);
    expect(makeResults([r], have(), 7, NO_FOODS, { allStages: true }).ghosted).toHaveLength(1);
  });
});

describe('makeResults sort order (Req 3.7)', () => {
  it('sorts by minutes ascending (unknown last), then effort, then title', () => {
    const stages: StageId[] = ['9-12'];
    const manySteps = ['a', 'b', 'c', 'd', 'e'];
    const list = [
      recipe('Unknown', ['rice'], { stages }),
      recipe('Slow', ['rice'], { stages, statedMinutes: 30 }),
      recipe('Fast Zed', ['rice'], { stages, statedMinutes: 10 }),
      recipe('Fast Alpha', ['rice'], { stages, statedMinutes: 10 }),
      recipe('Fast Medium', ['rice'], { stages, statedMinutes: 10, steps: manySteps }),
      recipe('Unknown Easy A', ['rice'], { stages }),
    ];
    const out = makeResults(list, have('rice'), AGE_10, NO_FOODS).readyNow;
    expect(titles(out)).toEqual([
      'Fast Alpha',
      'Fast Zed',
      'Fast Medium',
      'Slow',
      'Unknown',
      'Unknown Easy A',
    ]);
  });

  it('sorts missingOne and ghosted the same way', () => {
    const a = recipe('B', ['rice', 'peas'], { statedMinutes: 20 });
    const b = recipe('A', ['rice', 'peas'], { statedMinutes: 40 });
    expect(titles(makeResults([b, a], have('rice'), AGE_10, NO_FOODS).missingOne)).toEqual(['B', 'A']);
    const g1 = recipe('G2', ['honey'], { statedMinutes: 20 });
    const g2 = recipe('G1', ['honey'], { statedMinutes: 5 });
    expect(titles(makeResults([g1, g2], have(), AGE_10, NO_FOODS).ghosted)).toEqual(['G1', 'G2']);
  });
});

describe('requiredKeys', () => {
  it('returns plain, de-duplicated keys without optional or ignored foods', () => {
    const r = recipe('X', ['2 cups sweet potatoes', 'sweet potato', 'water', ing('salt', { optional: true }), '']);
    expect(requiredKeys(r)).toEqual(['sweet potato']);
  });
});

describe('suggestedChips', () => {
  const recipes = [
    recipe('A', ['rice', 'peas', 'water']),
    recipe('B', ['rice', 'carrot']),
    recipe('C', ['rice', 'carrot', 'beef', ing('salt', { optional: true })]),
  ];

  it('orders by how many recipes use each food, then name, without ignored or optional foods', () => {
    expect(suggestedChips(recipes, [])).toEqual(['rice', 'carrot', 'beef', 'pea']);
  });

  it('removes pantry foods', () => {
    expect(suggestedChips(recipes, ['rice'])).toEqual(['carrot', 'beef', 'pea']);
  });

  it('puts recent picks first in the given order, without duplicates', () => {
    expect(suggestedChips(recipes, [], ['pea', 'beef', 'pea'])).toEqual(['pea', 'beef', 'rice', 'carrot']);
  });

  it('ignores recent picks that are in the pantry or used by no recipe', () => {
    expect(suggestedChips(recipes, ['rice'], ['rice', 'kale'])).toEqual(['carrot', 'beef', 'pea']);
  });

  it('counts a food once per recipe', () => {
    const r = [recipe('D', ['egg', 'eggs', 'egg yolk']), recipe('E', ['egg yolk'])];
    expect(suggestedChips(r, [])).toEqual(['egg yolk', 'egg']);
  });
});

describe('tags on results (Req 3.8)', () => {
  it('carries nutrition tags from required ingredients only', () => {
    const r = recipe('Beef Bowl', ['beef', 'rice', ing('banana', { optional: true })]);
    const out = makeResults([r], have('beef', 'rice'), AGE_10, NO_FOODS);
    expect(out.readyNow[0].tags).toContain('iron-rich');
    expect(out.readyNow[0].tags).not.toContain('fruit');
  });

  it('gives an empty list when nothing matches', () => {
    const r = recipe('Plain', ['rice']);
    const out = makeResults([r], have('rice'), AGE_10, NO_FOODS);
    expect(out.readyNow[0].tags).toEqual([]);
  });
});

describe('recipeServeAs (Req 16.13)', () => {
  const base = (extra: Partial<Recipe>) => recipe('Plain dish', ['rice'], { steps: ['Cook.'], texture: 'soft', ...extra });

  it('uses serveAs as set and does not call it guessed', () => {
    expect(recipeServeAs(base({ serveAs: ['pieces'], title: 'Smooth puree' }))).toEqual({
      forms: ['pieces'],
      guessed: false,
    });
  });

  it.each([
    ['finger-food', { title: 'Banana pancakes' }],
    ['finger-food', { steps: ['Cut into strips.'] }],
    ['finger-food', { texture: 'soft finger bites' }],
    ['puree', { steps: ['Blend until smooth.'] }],
    ['puree', { title: 'Pea purée' }],
    ['mashed', { steps: ['Mash with a fork.'] }],
    ['pieces', { steps: ['Chop the carrots.'] }],
    ['pieces', { steps: ['Cut into small cubes.'] }],
  ] as Array<[ServeAs, Partial<Recipe>]>)('derives %s from keywords', (form, extra) => {
    const out = recipeServeAs(base(extra));
    expect(out.forms).toContain(form);
    expect(out.guessed).toBe(true);
  });

  it('matches whole words, plural-aware', () => {
    expect(recipeServeAs(base({ steps: ['Shape into balls.'] })).forms).toContain('finger-food');
    // whole words only: "basketball" is not "ball"
    expect(recipeServeAs(base({ steps: ['Serve after basketball.'], stages: ['9-12'] })).forms).toEqual(['mashed']);
  });

  it('can derive several forms', () => {
    const out = recipeServeAs(base({ steps: ['Blend until smooth.', 'Chop the pears.'] }));
    expect(out.forms).toEqual(['puree', 'pieces']);
  });

  it.each([
    [['6-8'], 'puree'],
    [['9-12'], 'mashed'],
    [['12-23'], 'pieces'],
    [['24-36'], 'pieces'],
    [['9-12', '12-23'], 'mashed'],
    [['24-36', '12-23'], 'pieces'],
    [['6-8', '9-12'], 'puree'],
    [[], 'mashed'],
  ] as const)('falls back to the youngest stage default for %j', (stages, form) => {
    const out = recipeServeAs(base({ stages: [...stages] }));
    expect(out).toEqual({ forms: [form], guessed: true });
  });

  it('treats an empty serveAs as unset', () => {
    expect(recipeServeAs(base({ serveAs: [] })).guessed).toBe(true);
  });
});

describe('filters (Req 16.9)', () => {
  const quickEgg = recipe('Egg Toast', ['egg'], { mealTypes: ['breakfast'], statedMinutes: 10 });
  const slowBeef = recipe('Beef Stew', ['beef'], {
    mealTypes: ['dinner'],
    statedMinutes: 60,
    serveAs: ['mashed'],
    storage: { freezerMonths: 3 },
  });
  const all = [quickEgg, slowBeef];
  const stocked = have('egg', 'beef');
  const run = (options = {}) => makeResults(all, stocked, AGE_10, NO_FOODS, options);

  it('applies no filter by default', () => {
    expect(titles(run().readyNow).sort()).toEqual(['Beef Stew', 'Egg Toast']);
  });

  it.each([
    [['meal:breakfast'], ['Egg Toast']],
    [['meal:dinner'], ['Beef Stew']],
    [['form:finger-food'], ['Egg Toast']],
    [['form:mashed'], ['Beef Stew']],
    [['quick'], ['Egg Toast']],
    [['freezer'], ['Beef Stew']],
    [['tag:protein'], ['Beef Stew', 'Egg Toast']],
    [['tag:fruit'], []],
  ] as const)('filter %j keeps %j', (filters, expected) => {
    const out = run({ filters: [...filters] });
    expect(titles(out.readyNow).sort()).toEqual([...expected]);
  });

  it('keeps only easy recipes for the easy filter', () => {
    const easy = recipe('Easy One', ['egg'], { statedMinutes: 5 });
    const hard = recipe('Hard One', ['egg'], {
      steps: Array.from({ length: 12 }, (_, i) => `Step ${i}.`),
    });
    const out = makeResults([easy, hard], have('egg'), AGE_10, NO_FOODS, { filters: ['easy'] });
    expect(titles(out.readyNow)).toEqual(['Easy One']);
  });

  it('requires every filter (AND)', () => {
    expect(titles(run({ filters: ['meal:breakfast', 'quick'] }).readyNow)).toEqual(['Egg Toast']);
    expect(run({ filters: ['meal:breakfast', 'meal:dinner'] }).readyNow).toEqual([]);
    expect(run({ filters: ['quick', 'freezer'] }).readyNow).toEqual([]);
  });

  it('applies to Missing one as well', () => {
    const out = makeResults(all, have('egg'), AGE_10, NO_FOODS, { filters: ['meal:dinner'] });
    expect(titles(out.missingOne)).toEqual(['Beef Stew']);
    expect(out.readyNow).toEqual([]);
  });

  it('applies filters to the ghosted group: a ghosted recipe that does not match is dropped', () => {
    const match = recipe('Honey Breakfast', ['honey'], { mealTypes: ['breakfast'] });
    const other = recipe('Honey Dinner', ['honey'], { mealTypes: ['dinner'] });
    const none = makeResults([match, other], have(), AGE_10, NO_FOODS);
    expect(titles(none.ghosted).sort()).toEqual(['Honey Breakfast', 'Honey Dinner']);
    const out = makeResults([match, other], have(), AGE_10, NO_FOODS, { filters: ['meal:breakfast'] });
    expect(titles(out.ghosted)).toEqual(['Honey Breakfast']);
  });

  describe('quick', () => {
    const quick = (r: Recipe) =>
      titles(makeResults([r], have('egg'), AGE_10, NO_FOODS, { filters: ['quick'] }).readyNow);

    it('excludes a recipe with no time', () => {
      expect(quick(recipe('No time', ['egg']))).toEqual([]);
    });

    it('includes exactly 15 minutes and excludes 16', () => {
      expect(quick(recipe('Fifteen', ['egg'], { statedMinutes: 15 }))).toEqual(['Fifteen']);
      expect(quick(recipe('Sixteen', ['egg'], { statedMinutes: 16 }))).toEqual([]);
    });

    it('uses an estimated time', () => {
      const fast = recipe('Est 15', ['egg'], { steps: ['Simmer 10 minutes.'] });
      const slow = recipe('Est 20', ['egg'], { steps: ['Simmer 15 minutes.'] });
      expect(makeResults([fast], have('egg'), AGE_10, NO_FOODS).readyNow[0]).toMatchObject({
        minutes: 15,
        minutesKind: 'estimated',
      });
      expect(quick(fast)).toEqual(['Est 15']);
      expect(quick(slow)).toEqual([]);
    });
  });

  describe('freezer', () => {
    const freezer = (r: Recipe) =>
      titles(makeResults([r], have('egg'), AGE_10, NO_FOODS, { filters: ['freezer'] }).readyNow);

    it('excludes storage set without freezerMonths, and no storage', () => {
      expect(freezer(recipe('Fridge only', ['egg'], { storage: { fridgeDays: 3 } }))).toEqual([]);
      expect(freezer(recipe('No storage', ['egg']))).toEqual([]);
    });

    it('includes a recipe with freezerMonths', () => {
      expect(freezer(recipe('Frozen', ['egg'], { storage: { freezerMonths: 2 } }))).toEqual(['Frozen']);
    });
  });

  it('applies filters to results with no foods typed, using the pantry', () => {
    const out = makeResults(all, have('egg'), AGE_10, NO_FOODS, { filters: ['meal:breakfast'] });
    expect(titles(out.readyNow)).toEqual(['Egg Toast']);
  });
});

describe('Iron-rich only (Req 3.9)', () => {
  const beef = recipe('Beef Mash', ['beef']);
  const apple = recipe('Apple Mash', ['apple']);
  const run = (options = {}) =>
    makeResults([beef, apple], have('beef', 'apple'), AGE_10, NO_FOODS, options);

  it('keeps only Iron-rich recipes when the toggle is on', () => {
    expect(titles(run({ ironRichOnly: true }).readyNow)).toEqual(['Beef Mash']);
  });

  it('is the same filter as the "iron rich" phrase', () => {
    const viaToggle = run({ ironRichOnly: true });
    const viaPhrase = run({ filters: ['tag:iron-rich'] });
    expect(titles(viaToggle.readyNow)).toEqual(titles(viaPhrase.readyNow));
    expect(activeFilters({ ironRichOnly: true, filters: ['tag:iron-rich'] })).toEqual(['tag:iron-rich']);
  });

  it('turning the toggle off removes the phrase filter; on adds it once', () => {
    expect(setIronRichFilter(['meal:lunch', 'tag:iron-rich'], false)).toEqual(['meal:lunch']);
    expect(setIronRichFilter(['meal:lunch'], true)).toEqual(['meal:lunch', 'tag:iron-rich']);
    expect(setIronRichFilter(['tag:iron-rich'], true)).toEqual(['tag:iron-rich']);
  });

  it('combines with other filters by AND', () => {
    const out = run({ ironRichOnly: true, filters: ['meal:breakfast'] });
    expect(out.readyNow).toEqual([]);
  });
});

describe('More ideas (Req 16.12)', () => {
  const none = have();

  it('is empty when no filter is active', () => {
    const r = recipe('Far', ['a1', 'b1']);
    expect(makeResults([r], none, AGE_10, NO_FOODS).moreIdeas).toEqual([]);
  });

  it('lists matching recipes missing two or more, fewest missing first, then time, effort, title', () => {
    const three = recipe('Three', ['a', 'b', 'c'], { statedMinutes: 5 });
    const twoSlow = recipe('Two slow', ['a', 'b'], { statedMinutes: 40 });
    const twoFastB = recipe('Two fast B', ['a', 'b'], { statedMinutes: 10 });
    const twoFastA = recipe('Two fast A', ['a', 'b'], { statedMinutes: 10 });
    const out = makeResults([three, twoSlow, twoFastB, twoFastA], none, AGE_10, NO_FOODS, {
      filters: ['meal:dinner'],
    });
    expect(titles(out.moreIdeas)).toEqual(['Two fast A', 'Two fast B', 'Two slow', 'Three']);
    expect(out.moreIdeas[0].missing).toEqual(['a', 'b']);
  });

  it('only includes recipes that match every filter', () => {
    const lunch = recipe('Lunch', ['a', 'b'], { mealTypes: ['lunch'] });
    const dinner = recipe('Dinner', ['a', 'b'], { mealTypes: ['dinner'] });
    const out = makeResults([lunch, dinner], none, AGE_10, NO_FOODS, { filters: ['meal:lunch'] });
    expect(titles(out.moreIdeas)).toEqual(['Lunch']);
  });

  it('does not repeat Ready now or Missing one recipes', () => {
    const ready = recipe('Ready', ['a']);
    const one = recipe('One', ['a', 'b']);
    const two = recipe('Two', ['a', 'b', 'c']);
    const out = makeResults([ready, one, two], have('a'), AGE_10, NO_FOODS, { filters: ['meal:dinner'] });
    expect(titles(out.readyNow)).toEqual(['Ready']);
    expect(titles(out.missingOne)).toEqual(['One']);
    expect(titles(out.moreIdeas)).toEqual(['Two']);
  });

  it(`caps the list at ${MORE_IDEAS_LIMIT}`, () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      recipe(`Idea ${String(i).padStart(2, '0')}`, ['a', 'b']),
    );
    const out = makeResults(many, none, AGE_10, NO_FOODS, { filters: ['meal:dinner'] });
    expect(out.moreIdeas).toHaveLength(MORE_IDEAS_LIMIT);
    expect(titles(out.moreIdeas)[0]).toBe('Idea 00');
  });

  it('excludes ghosted recipes (they stay in ghosted)', () => {
    const honey = recipe('Honey Oats', ['honey', 'oats', 'milk']);
    const fine = recipe('Fine', ['oats', 'milk']);
    const out = makeResults([honey, fine], none, AGE_10, NO_FOODS, { filters: ['meal:dinner'] });
    expect(titles(out.moreIdeas)).toEqual(['Fine']);
    expect(titles(out.ghosted)).toEqual(['Honey Oats']);
  });

  it('puts younger-stage recipes after the child stage for a toddler when missing counts tie, even if quicker', () => {
    const ownTwo = recipe('Own two', ['a', 'b'], { stages: ['12-23'], statedMinutes: 60 });
    const youngTwo = recipe('Young two', ['a', 'b'], { stages: ['9-12'], statedMinutes: 5 });
    const ownThree = recipe('Own three', ['a', 'b', 'c'], { stages: ['12-23'], statedMinutes: 5 });
    const out = makeResults([youngTwo, ownThree, ownTwo], none, 15, NO_FOODS, {
      filters: ['meal:dinner'],
    });
    expect(titles(out.moreIdeas)).toEqual(['Own two', 'Young two', 'Own three']);
    expect(out.moreIdeas.map((r) => r.youngerStage)).toEqual([false, true, false]);
  });

  it('respects the stage rule', () => {
    const other = recipe('Other stage', ['a', 'b'], { stages: ['6-8'] });
    const out = makeResults([other], none, AGE_10, NO_FOODS, { filters: ['meal:dinner'] });
    expect(out.moreIdeas).toEqual([]);
  });

  it('appears with only the Iron-rich toggle on', () => {
    const beefy = recipe('Beef Pot', ['beef', 'carrot']);
    const apple = recipe('Apple Pot', ['apple', 'pear']);
    const out = makeResults([beefy, apple], none, AGE_10, NO_FOODS, { ironRichOnly: true });
    expect(titles(out.moreIdeas)).toEqual(['Beef Pot']);
  });

  it('works with filters and no foods typed (pantry only)', () => {
    const r = recipe('Breakfast', ['oats', 'banana'], { mealTypes: ['breakfast'] });
    const out = makeResults([r], have('oat'), AGE_10, NO_FOODS, { filters: ['meal:breakfast'] });
    expect(titles(out.missingOne)).toEqual(['Breakfast']);
    const empty = makeResults([r], have(), AGE_10, NO_FOODS, { filters: ['meal:breakfast'] });
    expect(titles(empty.moreIdeas)).toEqual(['Breakfast']);
  });
});

describe('recipesNamed (Req 16.8)', () => {
  const pancakes = recipe('Banana Pancakes', ['banana', 'egg', 'flour']);
  const pudding = recipe('Rice Pudding', ['rice', 'milk']);
  const honeyPancake = recipe('Honey Pancake', ['honey', 'flour'], { stages: ['9-12'] });

  it('finds recipes by whole title word, plural-aware, whatever is missing', () => {
    const out = recipesNamed([pancakes, pudding], ['pancake'], have(), AGE_10, NO_FOODS);
    expect(titles(out.results)).toEqual(['Banana Pancakes']);
    expect(out.results[0].missing.length).toBe(3);
  });

  it('returns ghosted recipes separately', () => {
    const out = recipesNamed([pancakes, honeyPancake], ['pancakes'], have(), AGE_10, NO_FOODS);
    expect(titles(out.results)).toEqual(['Banana Pancakes']);
    expect(titles(out.ghosted)).toEqual(['Honey Pancake']);
  });

  it('applies the stage rule and filters, and does nothing without words', () => {
    const young = recipe('Pancake Puree', ['banana'], { stages: ['6-8'] });
    expect(titles(recipesNamed([young], ['pancake'], have(), AGE_10, NO_FOODS).results)).toEqual([]);
    expect(
      titles(recipesNamed([young], ['pancake'], have(), AGE_10, NO_FOODS, { allStages: true }).results),
    ).toEqual(['Pancake Puree']);
    expect(
      recipesNamed([pancakes], ['pancake'], have(), AGE_10, NO_FOODS, { filters: ['meal:breakfast'] })
        .results,
    ).toEqual([]);
    expect(recipesNamed([pancakes], [], have(), AGE_10, NO_FOODS).results).toEqual([]);
  });
});
