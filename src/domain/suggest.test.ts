import { describe, expect, it } from 'vitest';
import { makeResults, type MakeResult } from './make';
import { defaultState, exportState, importState } from './storage';
import { buildSharePayload } from './share';
import { reducer } from '../state/AppProvider';
import {
  addMadeEntry,
  daysBetween,
  isDismissed,
  localYmd,
  makeAgainList,
  mealHint,
  mealHintFor,
  newFoodStatus,
  pantrySuggestions,
  pickNewFood,
  pickTryThis,
  staleOnHandDays,
  tryThisId,
  untriedFoods,
  type TryThisContext,
} from './suggest';
import type { AppState, Ingredient, MadeLogEntry, Recipe } from './types';

// Fixed clock: Thursday 15 January 2026, 09:00 local.
const NOW = new Date(2026, 0, 15, 9, 0);
const at = (h: number, m: number, d = 15) => new Date(2026, 0, d, h, m);

let counter = 0;
function recipe(title: string, names: string[], extra: Partial<Recipe> = {}): Recipe {
  counter += 1;
  const ingredients: Ingredient[] = names.map((name) => ({ name, category: 'other' }));
  return {
    id: `r-${counter}`,
    origin: 'custom',
    title,
    stages: ['9-12'],
    mealTypes: ['dinner'],
    ingredients,
    steps: ['Mix.'],
    texture: 'soft',
    servings: 2,
    ...extra,
  };
}

const ALL_HAVE = new Set(['banana', 'rice', 'pea', 'pear', 'oat', 'carrot', 'apple', 'mango']);
const tried = (...keys: string[]): AppState['foods'] =>
  Object.fromEntries(keys.map((k) => [k, { status: 'tried' as const, date: '2026-01-01' }]));

function ready(recipes: Recipe[], foods: AppState['foods'] = {}): MakeResult[] {
  return makeResults(recipes, ALL_HAVE, 10, foods).readyNow;
}

function ctx(extra: Partial<TryThisContext> = {}): TryThisContext {
  return { now: NOW, madeLog: [], foods: {}, ...extra };
}

const titles = (picks: Array<{ result: MakeResult }>) => picks.map((p) => p.result.recipe.title);
const ALL_TRIED = tried('banana', 'rice', 'pea', 'pear', 'oat', 'carrot', 'apple', 'mango');

describe('Try this scoring (each rule, fixed now)', () => {
  // Plain recipes: Easy effort, no time -> 1 point each, so a tie goes to title.
  it('matches the meal hint: +3', () => {
    const a = recipe('A dinner', ['rice'], { mealTypes: ['dinner'] });
    const b = recipe('B breakfast', ['rice'], { mealTypes: ['breakfast'] });
    const picks = pickTryThis(ready([a, b], ALL_TRIED), ctx({ foods: ALL_TRIED, mealHint: 'breakfast' }));
    expect(titles(picks)).toEqual(['B breakfast', 'A dinner']);
    expect(picks[0].score - picks[1].score).toBe(3);
    expect(picks[0].reason).toBe('Ready now · Breakfast · Easy');
  });

  it('time of 15 minutes or less: +2, 16 minutes: 0', () => {
    const quick = recipe('Z quick', ['rice'], { statedMinutes: 15 });
    const slow = recipe('A slow', ['rice'], { statedMinutes: 16 });
    const picks = pickTryThis(ready([quick, slow], ALL_TRIED), ctx({ foods: ALL_TRIED }));
    expect(titles(picks)).toEqual(['Z quick', 'A slow']);
    expect(picks[0].score - picks[1].score).toBe(2);
    expect(picks[0].reason).toContain('15 min');
    expect(picks[1].reason).not.toContain('16 min');
  });

  it('estimated time counts for the +2', () => {
    const est = recipe('Z est', ['rice'], { steps: ['Simmer 5 minutes.'] }); // 5 + 5 = 10
    const none = recipe('A none', ['rice']);
    const picks = pickTryThis(ready([est, none], ALL_TRIED), ctx({ foods: ALL_TRIED }));
    expect(titles(picks)).toEqual(['Z est', 'A none']);
    expect(picks[0].reason).toContain('10 min');
  });

  it('effort Easy: +1', () => {
    const easy = recipe('Z easy', ['rice']);
    const medium = recipe('A medium', ['rice'], { steps: ['Bake it.'] }); // oven word
    const picks = pickTryThis(ready([easy, medium], ALL_TRIED), ctx({ foods: ALL_TRIED }));
    expect(titles(picks)).toEqual(['Z easy', 'A medium']);
    expect(picks[0].score - picks[1].score).toBe(1);
  });

  it('Iron-rich tag: +1, and the reason lists it', () => {
    const iron = recipe('Z iron', ['rice']);
    const plain = recipe('A plain', ['rice']);
    const ironRich = (r: Recipe) => r.id === iron.id;
    const picks = pickTryThis(ready([iron, plain], ALL_TRIED), ctx({ foods: ALL_TRIED, ironRich }));
    expect(titles(picks)).toEqual(['Z iron', 'A plain']);
    expect(picks[0].score - picks[1].score).toBe(1);
    expect(picks[0].reason).toBe('Ready now · Easy · Iron-rich');
  });

  it('no Iron-rich points without the predicate', () => {
    const picks = pickTryThis(ready([recipe('R', ['rice'])], ALL_TRIED), ctx({ foods: ALL_TRIED }));
    expect(picks[0].reason).not.toContain('Iron-rich');
  });

  it('made in the last 2 days: -3 (today, 2 days ago), not 3 days ago', () => {
    const r = recipe('A repeat', ['rice']);
    const other = recipe('B other', ['rice']);
    const score = (date: string) => {
      const madeLog: MadeLogEntry[] = [{ recipeId: r.id, date }];
      const picks = pickTryThis(ready([r, other], ALL_TRIED), ctx({ foods: ALL_TRIED, madeLog }));
      return picks.find((p) => p.result.recipe.id === r.id)!.score;
    };
    const base = score('2025-12-01');
    expect(score('2026-01-15')).toBe(base - 3);
    expect(score('2026-01-13')).toBe(base - 3);
    expect(score('2026-01-12')).toBe(base);
  });

  it('the example reason: Ready now · 10 min · Breakfast · Iron-rich', () => {
    const r = recipe('R', ['rice'], { statedMinutes: 10, mealTypes: ['breakfast'], steps: ['a', 'b', 'c', 'd', 'e'] });
    // 5 steps -> not Easy, so the Easy point is absent as in the design example.
    const picks = pickTryThis(
      ready([r], ALL_TRIED),
      ctx({ foods: ALL_TRIED, mealHint: 'breakfast', ironRich: () => true }),
    );
    expect(picks[0].reason).toBe('Ready now · Breakfast · 10 min · Iron-rich');
  });

  it('ties go to title order', () => {
    const picks = pickTryThis(
      ready([recipe('Banana', ['rice']), recipe('Apple', ['rice'])], ALL_TRIED),
      ctx({ foods: ALL_TRIED }),
    );
    expect(titles(picks)).toEqual(['Apple', 'Banana']);
  });
});

describe('Try this: ghosted and dismissed', () => {
  it('a ghosted recipe is never picked (it is not in Ready now)', () => {
    const ghost = recipe('Ghost', ['rice']);
    const fine = recipe('Fine', ['oat']);
    const foods = { ...ALL_TRIED, rice: { status: 'reaction' as const, date: '2026-01-01' } };
    const groups = makeResults([ghost, fine], ALL_HAVE, 10, foods);
    expect(titles(groups.ghosted.map((r) => ({ result: r })))).toEqual(['Ghost']);
    const picks = pickTryThis(groups.readyNow, ctx({ foods }));
    expect(titles(picks)).toEqual(['Fine']);
  });

  it('a dismissed pick is skipped for 24 hours, then comes back', () => {
    const a = recipe('A', ['rice']);
    const b = recipe('B', ['rice']);
    const dismissed = { [tryThisId(a.id)]: NOW.toISOString() };
    const results = ready([a, b], ALL_TRIED);
    const soon = pickTryThis(results, { ...ctx({ foods: ALL_TRIED }), dismissed });
    expect(titles(soon)).toEqual(['B']);
    const later = pickTryThis(results, {
      ...ctx({ foods: ALL_TRIED, now: new Date(NOW.getTime() + 24 * 3600_000) }),
      dismissed,
    });
    expect(titles(later)).toEqual(['A', 'B']);
  });

  it('no Ready now recipes gives no pick', () => {
    expect(pickTryThis([], ctx())).toEqual([]);
  });
});

describe('Try this: untried-food rules', () => {
  const tried2 = tried('rice', 'pea', 'oat');

  it('a recipe with two or more untried foods is never picked', () => {
    const two = recipe('Two', ['banana', 'pear']);
    const full = recipe('Full', ['rice']);
    expect(titles(pickTryThis(ready([two, full], tried2), ctx({ foods: tried2 })))).toEqual(['Full']);
    // Even when it is the only recipe, and even with a new food banner food.
    expect(pickTryThis(ready([two], tried2), ctx({ foods: tried2 }))).toEqual([]);
    expect(pickTryThis(ready([two], tried2), ctx({ foods: tried2, newFoodKey: 'banana' }))).toEqual([]);
  });

  it('no new food due: one untried food is allowed only as the sole Ready now recipe', () => {
    const one = recipe('One', ['rice', 'banana']);
    const picks = pickTryThis(ready([one], tried2), ctx({ foods: tried2 }));
    expect(titles(picks)).toEqual(['One']);
    expect(picks[0].reason.startsWith('Has a new food: banana')).toBe(true);
    expect(picks[0].newFood).toBe('banana');
  });

  it('one-untried plus two-untried recipes gives no card (counted before filtering)', () => {
    const one = recipe('One', ['rice', 'banana']);
    const two = recipe('Two', ['pear', 'banana']);
    expect(pickTryThis(ready([one, two], tried2), ctx({ foods: tried2 }))).toEqual([]);
  });

  it('one-untried plus a fully tried recipe: only the tried one is picked', () => {
    const one = recipe('One', ['rice', 'banana']);
    const full = recipe('Full', ['rice']);
    expect(titles(pickTryThis(ready([one, full], tried2), ctx({ foods: tried2 })))).toEqual(['Full']);
  });

  it('dismissing the only fully tried recipe gives no card (the untried one stays out)', () => {
    const one = recipe('One', ['rice', 'banana']);
    const full = recipe('Full', ['rice']);
    const dismissed = { [tryThisId(full.id)]: NOW.toISOString() };
    expect(pickTryThis(ready([one, full], tried2), { ...ctx({ foods: tried2 }), dismissed })).toEqual([]);
  });

  it('new food due: only the recipe with the banner food is allowed', () => {
    const banana = recipe('Banana', ['rice', 'banana']);
    const pear = recipe('Pear', ['rice', 'pear']);
    const full = recipe('Full', ['rice']);
    const picks = pickTryThis(
      ready([banana, pear, full], tried2),
      ctx({ foods: tried2, newFoodKey: 'banana' }),
    );
    expect(titles(picks).sort()).toEqual(['Banana', 'Full']);
    expect(picks.find((p) => p.result.recipe.title === 'Banana')!.reason).toMatch(
      /^Has a new food: banana/,
    );
  });

  it('new food due: the sole-recipe exception does not apply', () => {
    const pear = recipe('Pear', ['rice', 'pear']);
    expect(pickTryThis(ready([pear], tried2), ctx({ foods: tried2, newFoodKey: 'banana' }))).toEqual([]);
  });

  it('banner dismissed means a new food counts as not due (sole rule applies)', () => {
    // The caller passes newFoodKey undefined once pickNewFood returns undefined.
    const pear = recipe('Pear', ['rice', 'pear']);
    const dismissed = { 'new-food': NOW.toISOString() };
    expect(pickNewFood(ready([pear], tried2), dismissed, ctx({ foods: {} }))).toBeUndefined();
    expect(titles(pickTryThis(ready([pear], tried2), ctx({ foods: tried2 })))).toEqual(['Pear']);
  });

  it('the day after a reaction: no untried-food pick while others exist', () => {
    const foods = { ...tried2, peanut: { status: 'reaction' as const, date: '2026-01-14' } };
    const one = recipe('One', ['rice', 'banana']);
    const full = recipe('Full', ['rice']);
    const status = newFoodStatus(foods, NOW);
    expect(status.due).toBe(false);
    expect(titles(pickTryThis(ready([one, full], foods), ctx({ foods })))).toEqual(['Full']);
  });

  it('no allowed pick hides the card', () => {
    const one = recipe('One', ['rice', 'banana']);
    const two = recipe('Two', ['pear', 'banana']);
    expect(pickTryThis(ready([one, two], tried2), ctx({ foods: tried2 }))).toHaveLength(0);
  });

  it('untriedFoods ignores optional, ignored and tried foods', () => {
    const r = recipe('R', ['rice', 'water', 'banana (optional)', 'pear']);
    expect(untriedFoods(r, tried('rice'))).toEqual(['pear']);
  });
});

describe('meal hint boundaries', () => {
  it.each([
    [4, 59, undefined],
    [5, 0, 'breakfast'],
    [10, 29, 'breakfast'],
    [10, 30, 'lunch'],
    [13, 59, 'lunch'],
    [14, 0, 'snack'],
    [16, 59, 'snack'],
    [17, 0, 'dinner'],
    [20, 59, 'dinner'],
    [21, 0, undefined],
    [23, 30, undefined],
    [0, 0, undefined],
    [3, 15, undefined],
  ] as const)('%i:%i is %s', (h, m, expected) => {
    expect(mealHintFor(at(h, m))).toBe(expected);
  });

  it('no meal hint from 21:00 to 04:59', () => {
    for (let minutes = 21 * 60; minutes < 29 * 60; minutes += 1) {
      const m = minutes % (24 * 60);
      expect(mealHintFor(at(Math.floor(m / 60), m % 60))).toBeUndefined();
    }
  });

  it('dismissing the chip hides it for 4 hours, not 4 hours and a bit less', () => {
    const dismissed = { 'meal-hint': at(9, 0).toISOString() };
    expect(mealHint(dismissed, at(9, 0))).toBeUndefined();
    expect(mealHint(dismissed, at(12, 59))).toBeUndefined();
    expect(mealHint(dismissed, at(13, 0))).toBe('lunch');
    expect(mealHint({}, at(9, 0))).toBe('breakfast');
  });
});

describe('isDismissed for each row of the dismissal table', () => {
  const h = (n: number) => new Date(NOW.getTime() + n * 3600_000);
  const dismissedAt = NOW.toISOString();

  it.each([
    ['try-this:abc', 24],
    ['new-food', 24],
    ['stale-on-hand', 24],
    ['make-again', 24],
    ['meal-hint', 4],
  ])('%s is hidden for %i hours', (id, hours) => {
    const dismissed = { [id]: dismissedAt };
    expect(isDismissed(dismissed, id, h(0))).toBe(true);
    expect(isDismissed(dismissed, id, h(hours - 0.01))).toBe(true);
    expect(isDismissed(dismissed, id, h(hours))).toBe(false);
  });

  it('the first-use pantry offer stays skipped once skipped', () => {
    const dismissed = { 'pantry-setup': dismissedAt };
    expect(isDismissed(dismissed, 'pantry-setup', h(24 * 365))).toBe(true);
  });

  it('pantry:<food> is permanent', () => {
    const dismissed = { 'pantry:rice': dismissedAt };
    expect(isDismissed(dismissed, 'pantry:rice', h(24 * 365 * 5))).toBe(true);
    expect(isDismissed(dismissed, 'pantry:peas', h(0))).toBe(false);
  });

  it('stale-on-hand also returns once on-hand has changed since', () => {
    const dismissed = { 'stale-on-hand': dismissedAt };
    expect(isDismissed(dismissed, 'stale-on-hand', h(1), '2026-01-15')).toBe(true);
    expect(isDismissed(dismissed, 'stale-on-hand', h(1), '2026-01-16')).toBe(false);
  });

  it('a missing or unparseable time is not dismissed', () => {
    expect(isDismissed({}, 'new-food', NOW)).toBe(false);
    expect(isDismissed({ 'new-food': 'nope' }, 'new-food', NOW)).toBe(false);
  });
});

describe('stale on-hand', () => {
  const state = (updated: string | undefined, onHand = ['rice', 'pea']) => ({
    onHand,
    onHandUpdated: updated,
    dismissed: {} as AppState['dismissed'],
  });

  it('is stale only when more than 3 days old', () => {
    expect(staleOnHandDays(state('2026-01-12'), NOW)).toBeUndefined(); // 3 days
    expect(staleOnHandDays(state('2026-01-11'), NOW)).toBe(4);
  });

  it('is not stale with an empty list or no date', () => {
    expect(staleOnHandDays(state('2026-01-01', []), NOW)).toBeUndefined();
    expect(staleOnHandDays(state(undefined), NOW)).toBeUndefined();
  });

  it('a 24 hour dismissal hides it', () => {
    const s = { ...state('2026-01-01'), dismissed: { 'stale-on-hand': NOW.toISOString() } };
    expect(staleOnHandDays(s, NOW)).toBeUndefined();
    expect(staleOnHandDays(s, new Date(NOW.getTime() + 25 * 3600_000))).toBe(15);
  });
});

describe('new food due', () => {
  const rec = (date: string, status: 'tried' | 'reaction' = 'tried') => ({ status, date });

  it('spacing at 2 and 3 days', () => {
    expect(newFoodStatus({ a: rec('2026-01-13') }, NOW).due).toBe(false); // 2 days
    expect(newFoodStatus({ a: rec('2026-01-12') }, NOW).due).toBe(true); // 3 days
    expect(newFoodStatus({ a: rec('2026-01-12') }, NOW).reason).toBe('3+ days since the last new food');
  });

  it('uses the newest record among all foods', () => {
    expect(newFoodStatus({ a: rec('2026-01-01'), b: rec('2026-01-14') }, NOW).due).toBe(false);
  });

  it('a reaction record restarts the wait', () => {
    const foods = { a: rec('2026-01-01'), b: rec('2026-01-14', 'reaction') };
    expect(newFoodStatus(foods, NOW).due).toBe(false);
    expect(newFoodStatus(foods, at(9, 0, 17)).due).toBe(true);
  });

  it('no food recorded yet is due, with its own reason', () => {
    const s = newFoodStatus({}, NOW);
    expect(s.due).toBe(true);
    expect(s.reason).toBe('No new foods recorded yet');
  });

  it('picks the best-scoring recipe with exactly one untried food, Ready now or Missing one', () => {
    const foods = tried('rice');
    const slow = recipe('A slow', ['rice', 'banana']);
    const quick = recipe('Z quick', ['rice', 'pear'], { statedMinutes: 5 });
    const two = recipe('Two', ['rice', 'apple', 'mango'], { statedMinutes: 5 });
    const none = recipe('None', ['rice'], { statedMinutes: 5 });
    const groups = makeResults([slow, quick, two, none], ALL_HAVE, 10, foods);
    const pick = pickNewFood(
      [...groups.readyNow, ...groups.missingOne],
      {},
      ctx({ foods: { ...foods, x: { status: 'tried', date: '2026-01-01' } } }),
    );
    expect(pick?.result.recipe.title).toBe('Z quick');
    expect(pick?.food).toBe('pear');
  });

  it('a Missing one recipe can be the banner recipe', () => {
    const foods = tried('rice');
    const r = recipe('Needs kiwi', ['rice', 'kiwi']);
    const groups = makeResults([r], ALL_HAVE, 10, foods);
    expect(groups.missingOne).toHaveLength(1);
    const pick = pickNewFood(groups.missingOne, {}, ctx({ foods }));
    expect(pick?.food).toBe('kiwi');
    expect(pick?.reason).toBe('3+ days since the last new food');
  });

  it('with no food recorded the banner reason is "No new foods recorded yet"', () => {
    const r = recipe('One new', ['banana']);
    const pick = pickNewFood(ready([r]), {}, ctx());
    expect(pick?.reason).toBe('No new foods recorded yet');
  });

  it('allergen foods are allowed', () => {
    const r = recipe('Eggy', ['rice', 'egg']);
    const groups = makeResults([r], new Set([...ALL_HAVE, 'egg']), 10, tried('rice'));
    const pick = pickNewFood(groups.readyNow, {}, ctx({ foods: tried('rice') }));
    expect(pick?.food).toBe('allergen:egg');
  });

  it('is hidden when not due, when dismissed for 24 hours, and when no recipe qualifies', () => {
    const r = recipe('One new', ['banana']);
    const results = ready([r]);
    const recent = { a: { status: 'tried' as const, date: '2026-01-14' } };
    expect(pickNewFood(results, {}, ctx({ foods: recent }))).toBeUndefined();
    const dismissed = { 'new-food': NOW.toISOString() };
    expect(pickNewFood(results, dismissed, ctx())).toBeUndefined();
    expect(pickNewFood(results, dismissed, ctx({ now: new Date(NOW.getTime() + 24 * 3600_000) }))).toBeDefined();
    expect(pickNewFood(ready([recipe('Tried', ['rice'])], tried('rice')), {}, ctx({ foods: tried('rice') }))).toBeUndefined();
  });
});

describe('Make again', () => {
  const recipes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((t) => recipe(t, ['rice']));
  const log = (...pairs: Array<[Recipe, string]>): MadeLogEntry[] =>
    pairs.map(([r, date]) => ({ recipeId: r.id, date }));

  it('lists up to 5 distinct recipes, newest first', () => {
    const madeLog = log(
      [recipes[0], '2026-01-15'],
      [recipes[1], '2026-01-14'],
      [recipes[0], '2026-01-13'],
      [recipes[2], '2026-01-12'],
      [recipes[3], '2026-01-11'],
      [recipes[4], '2026-01-10'],
      [recipes[5], '2026-01-09'],
      [recipes[6], '2026-01-08'],
    );
    const items = makeAgainList(madeLog, recipes, () => false, {}, NOW);
    expect(items.map((i) => i.recipe.title)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(items[0].reason).toBe('Made on 2026-01-15');
  });

  it('skips ghosted and deleted recipes without counting them', () => {
    const madeLog = log(
      [recipes[0], '2026-01-15'],
      [recipes[1], '2026-01-14'],
      [{ ...recipes[2], id: 'gone' }, '2026-01-13'],
    );
    const items = makeAgainList(madeLog, recipes, (r) => r.id === recipes[0].id, {}, NOW);
    expect(items.map((i) => i.recipe.title)).toEqual(['B']);
  });

  it('the row is hidden for 24 hours after a dismissal', () => {
    const madeLog = log([recipes[0], '2026-01-15']);
    const dismissed = { 'make-again': NOW.toISOString() };
    expect(makeAgainList(madeLog, recipes, () => false, dismissed, NOW)).toEqual([]);
    const later = new Date(NOW.getTime() + 24 * 3600_000);
    expect(makeAgainList(madeLog, recipes, () => false, dismissed, later)).toHaveLength(1);
  });
});

describe('pantry learning', () => {
  const state = (over: Partial<Pick<AppState, 'onHandDays' | 'pantry' | 'dismissed'>> = {}) => ({
    onHandDays: { rice: ['2026-01-01', '2026-01-02', '2026-01-03'], pea: ['2026-01-01', '2026-01-02'] },
    pantry: [] as string[],
    dismissed: {} as AppState['dismissed'],
    ...over,
  });

  it('offers a food added on 3 or more different days, not 2', () => {
    expect(pantrySuggestions(state())).toEqual([{ food: 'rice', reason: 'Added on 3 different days' }]);
  });

  it('skips foods already in the pantry', () => {
    expect(pantrySuggestions(state({ pantry: ['rice'] }))).toEqual([]);
  });

  it('"No thanks" is permanent', () => {
    expect(pantrySuggestions(state({ dismissed: { 'pantry:rice': '2020-01-01T00:00:00.000Z' } }))).toEqual([]);
  });
});

describe('made log helper', () => {
  it('dedupes per recipe per day, newest first, capped at 100', () => {
    let log: MadeLogEntry[] = [];
    log = addMadeEntry(log, 'a', '2026-01-15');
    expect(addMadeEntry(log, 'a', '2026-01-15')).toBe(log);
    log = addMadeEntry(log, 'b', '2026-01-15');
    log = addMadeEntry(log, 'a', '2026-01-16');
    expect(log.map((e) => e.recipeId + e.date)).toEqual(['a2026-01-16', 'b2026-01-15', 'a2026-01-15']);
    for (let i = 0; i < 120; i++) log = addMadeEntry(log, `r${i}`, '2026-02-01');
    expect(log).toHaveLength(100);
    expect(log[0].recipeId).toBe('r119');
  });
});

describe('date helpers', () => {
  it('localYmd and daysBetween', () => {
    expect(localYmd(NOW)).toBe('2026-01-15');
    expect(daysBetween('2025-12-31', '2026-01-02')).toBe(2);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2); // across US DST
  });
});

describe('reducer actions for suggestions', () => {
  const base = () => defaultState(NOW);

  it('markMade records the day once per recipe, caps at 100, ignores unknown ids and bad dates', () => {
    const custom = recipe('Mine', ['rice']);
    let s = reducer(base(), { type: 'saveCustomRecipe', recipe: custom });
    s = reducer(s, { type: 'markMade', recipeId: custom.id, today: '2026-01-15' });
    expect(s.madeLog).toEqual([{ recipeId: custom.id, date: '2026-01-15' }]);
    expect(reducer(s, { type: 'markMade', recipeId: custom.id, today: '2026-01-15' })).toBe(s);
    expect(reducer(s, { type: 'markMade', recipeId: 'nope', today: '2026-01-15' })).toBe(s);
    expect(reducer(s, { type: 'markMade', recipeId: custom.id, today: 'bad' })).toBe(s);
    for (let d = 1; d <= 28; d++) {
      for (let m = 1; m <= 4; m++) {
        const today = `2025-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        s = reducer(s, { type: 'markMade', recipeId: custom.id, today });
      }
    }
    expect(s.madeLog).toHaveLength(100);
  });

  it('a deleted custom recipe is removed from the made log', () => {
    const custom = recipe('Mine', ['rice']);
    let s = reducer(base(), { type: 'saveCustomRecipe', recipe: custom });
    s = reducer(s, { type: 'markMade', recipeId: custom.id, today: '2026-01-15' });
    s = reducer(s, { type: 'deleteCustomRecipe', id: custom.id });
    expect(s.madeLog).toEqual([]);
  });

  it('recordOnHandDay counts a day without touching the list, distinct, last 10', () => {
    let s = reducer(base(), { type: 'recordOnHandDay', food: 'Rice', today: '2026-01-15' });
    expect(s.onHand).toEqual([]);
    expect(s.onHandUpdated).toBeUndefined();
    expect(s.onHandDays).toEqual({ rice: ['2026-01-15'] });
    expect(reducer(s, { type: 'recordOnHandDay', food: 'rice', today: '2026-01-15' })).toBe(s);
    for (let d = 1; d <= 12; d++) {
      s = reducer(s, { type: 'recordOnHandDay', food: 'rice', today: `2026-02-${String(d).padStart(2, '0')}` });
    }
    expect(s.onHandDays.rice).toHaveLength(10);
    expect(reducer(s, { type: 'recordOnHandDay', food: ' ', today: '2026-01-15' })).toBe(s);
  });

  it('dismissSuggestion stores the ISO time; a bad time is a no-op', () => {
    const s = reducer(base(), { type: 'dismissSuggestion', id: 'new-food', at: NOW.toISOString() });
    expect(s.dismissed['new-food']).toBe(NOW.toISOString());
    expect(reducer(s, { type: 'dismissSuggestion', id: 'x', at: 'nope' })).toBe(s);
    expect(isDismissed(s.dismissed, 'new-food', NOW)).toBe(true);
  });

  it('keepOnHand refreshes the date and leaves the list unchanged', () => {
    let s = reducer(base(), { type: 'addOnHand', food: 'rice', today: '2026-01-01' });
    s = reducer(s, { type: 'keepOnHand', today: '2026-01-15' });
    expect(s.onHand).toEqual(['rice']);
    expect(s.onHandUpdated).toBe('2026-01-15');
    const empty = base();
    expect(reducer(empty, { type: 'keepOnHand', today: '2026-01-15' })).toBe(empty);
  });

  it('the stale prompt goes away after "Yes, keep"', () => {
    let s = reducer(base(), { type: 'addOnHand', food: 'rice', today: '2026-01-01' });
    expect(staleOnHandDays(s, NOW)).toBe(14);
    s = reducer(s, { type: 'keepOnHand', today: '2026-01-15' });
    expect(staleOnHandDays(s, NOW)).toBeUndefined();
  });
});

describe('suggestion state storage and sharing (Requirement 17.11)', () => {
  const custom = recipe('Mine', ['rice']);
  const withState = (): AppState => {
    let s = reducer(defaultState(NOW), { type: 'saveCustomRecipe', recipe: custom });
    s = reducer(s, { type: 'markMade', recipeId: custom.id, today: '2026-01-15' });
    s = reducer(s, { type: 'addOnHand', food: 'rice', today: '2026-01-15' });
    s = reducer(s, { type: 'dismissSuggestion', id: 'meal-hint', at: NOW.toISOString() });
    return s;
  };

  it('export then import keeps the made log, on-hand days and dismissals', () => {
    const state = withState();
    const out = exportState(state, NOW);
    const back = importState(out.json);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.state.madeLog).toEqual(state.madeLog);
      expect(back.state.onHandDays).toEqual(state.onHandDays);
      expect(back.state.dismissed).toEqual(state.dismissed);
      expect(back.state.onHandUpdated).toBe('2026-01-15');
    }
  });

  it('share payloads carry no suggestion state', () => {
    const json = JSON.stringify(buildSharePayload(withState()));
    for (const field of ['madeLog', 'onHandDays', 'dismissed', 'onHandUpdated', 'meal-hint']) {
      expect(json).not.toContain(field);
    }
  });
});
