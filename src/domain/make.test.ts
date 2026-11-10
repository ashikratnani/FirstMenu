import { describe, expect, it } from 'vitest';
import { makeResults, requiredKeys, suggestedChips } from './make';
import { foodKeyFromName } from './foods';
import type { AppState, Ingredient, Recipe, StageId } from './types';

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
    expect(out).toEqual({ readyNow: [], missingOne: [], ghosted: [] });
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
