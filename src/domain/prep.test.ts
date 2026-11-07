import { describe, expect, it } from 'vitest';
import { computePrepList } from './prep';
import { defaultState } from './storage';
import type { AppState, FoodRecord, Recipe, WeekPlan } from './types';

// ---------------------------------------------------------------------------
// Fixtures (mirrors plan.test.ts: build a WeekPlan, seed AppState via
// defaultState(new Date(...)), helper recipes with explicit servings/storage).
// ---------------------------------------------------------------------------

interface RecipeOpts {
  servings?: number;
  storage?: { fridgeDays?: number; freezerMonths?: number };
  ingredients?: Recipe['ingredients'];
}

/** A simple single-ingredient recipe with explicit servings/storage. */
function makeRecipe(id: string, name: string, opts: RecipeOpts = {}): Recipe {
  return {
    id,
    origin: 'custom',
    title: `${name} dish`,
    stages: ['6-8', '9-12'],
    mealTypes: ['breakfast'],
    ingredients: opts.ingredients ?? [{ name, category: 'produce' }],
    steps: ['Cook.'],
    texture: 'smooth',
    servings: opts.servings ?? 1,
    storage: opts.storage,
  };
}

/** A fresh plan, all 7 days empty, breakfast the only active slot.
 * startDate is a Monday; prepDate defaults to startDate - 1, so plan day 0 is
 * offset 1 from the prep day. */
function emptyPlan(): WeekPlan {
  return {
    startDate: '2026-01-05', // a Monday
    prepDate: '2026-01-04', // startDate - 1
    activeSlots: ['breakfast'],
    days: Array.from({ length: 7 }, () => ({})),
  };
}

/** Put a recipe id into a given day's breakfast slot. */
function withBreakfast(plan: WeekPlan, day: number, recipeId: string): WeekPlan {
  const days = plan.days.map((d, i) =>
    i === day ? { ...d, breakfast: recipeId } : d,
  );
  return { ...plan, days };
}

function stateWithFoods(foods: Record<string, FoodRecord> = {}): AppState {
  return { ...defaultState(new Date('2026-01-05')), foods };
}

const AGE = 8;

// ---------------------------------------------------------------------------
// Empty plan
// ---------------------------------------------------------------------------

describe('computePrepList: empty plan', () => {
  it('returns no sessions and no thaw reminders for an all-empty plan', () => {
    const result = computePrepList(emptyPlan(), [], stateWithFoods(), AGE);
    expect(result).toEqual({ sessions: [], thawReminders: [] });
  });

  it('returns nothing when the only slot is in an inactive meal', () => {
    const recipe = makeRecipe('r-pear', 'pear', { storage: { fridgeDays: 3 } });
    // Put it in a LUNCH slot while only breakfast is active.
    let plan = emptyPlan();
    plan = {
      ...plan,
      days: plan.days.map((d, i) => (i === 1 ? { ...d, lunch: 'r-pear' } : d)),
    };
    const result = computePrepList(plan, [recipe], stateWithFoods(), AGE);
    expect(result).toEqual({ sessions: [], thawReminders: [] });
  });

  it('skips unknown recipe ids', () => {
    const plan = withBreakfast(emptyPlan(), 0, 'does-not-exist');
    const result = computePrepList(plan, [], stateWithFoods(), AGE);
    expect(result).toEqual({ sessions: [], thawReminders: [] });
  });
});

// ---------------------------------------------------------------------------
// (a) fridge-only
// ---------------------------------------------------------------------------

describe('computePrepList: fridge-only', () => {
  it('cooks ONE prep-day session storing in the fridge when all uses fit fridgeDays', () => {
    // Uses on plan days 0,1,2 -> offsets 1,2,3 from prepDate; fridgeDays 3
    // covers all, so one prep-day session.
    const recipe = makeRecipe('r-pear', 'pear', {
      servings: 2,
      storage: { fridgeDays: 3, freezerMonths: 1 },
    });
    let plan = withBreakfast(emptyPlan(), 0, 'r-pear');
    plan = withBreakfast(plan, 1, 'r-pear');
    plan = withBreakfast(plan, 2, 'r-pear');

    const result = computePrepList(plan, [recipe], stateWithFoods(), AGE);
    expect(result.thawReminders).toEqual([]);
    expect(result.sessions).toEqual([
      // servingsNeeded = 3, servings=2 -> ceil(3/2)=2 batches.
      { date: '2026-01-04', recipeId: 'r-pear', batches: 2, store: 'fridge' },
    ]);
  });

  it('batches = ceil(servingsNeeded / servings)', () => {
    // servings=4 needed 5 times -> 2 batches.
    const recipe = makeRecipe('r-stew', 'stew', {
      servings: 4,
      storage: { fridgeDays: 7 },
    });
    let plan = emptyPlan();
    for (let d = 0; d < 5; d += 1) plan = withBreakfast(plan, d, 'r-stew');

    const result = computePrepList(plan, [recipe], stateWithFoods(), AGE);
    expect(result.sessions).toEqual([
      { date: '2026-01-04', recipeId: 'r-stew', batches: 2, store: 'fridge' },
    ]);
    expect(result.thawReminders).toEqual([]);
  });

  it('guards servings <= 0 by treating one batch per serving', () => {
    const recipe = makeRecipe('r-zero', 'zero', {
      servings: 0,
      storage: { fridgeDays: 7 },
    });
    let plan = withBreakfast(emptyPlan(), 0, 'r-zero');
    plan = withBreakfast(plan, 1, 'r-zero');

    const result = computePrepList(plan, [recipe], stateWithFoods(), AGE);
    // servings guarded to 1 -> ceil(2/1)=2 batches.
    expect(result.sessions).toEqual([
      { date: '2026-01-04', recipeId: 'r-zero', batches: 2, store: 'fridge' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// (b) freezer with per-use thaw reminders
// ---------------------------------------------------------------------------

describe('computePrepList: freezer', () => {
  it('freezes uses beyond fridgeDays with a thaw reminder the day BEFORE each', () => {
    // fridgeDays 2, freezerMonths 1. Uses on days 0,1,5 -> offsets 1,2,6.
    // offsets 1,2 stay in the fridge; offset 6 (day 5, 2026-01-10) is frozen.
    const recipe = makeRecipe('r-chicken', 'chicken', {
      servings: 1,
      storage: { fridgeDays: 2, freezerMonths: 1 },
    });
    let plan = withBreakfast(emptyPlan(), 0, 'r-chicken');
    plan = withBreakfast(plan, 1, 'r-chicken');
    plan = withBreakfast(plan, 5, 'r-chicken');

    const result = computePrepList(plan, [recipe], stateWithFoods(), AGE);
    expect(result.sessions).toEqual([
      // One prep-day session, all 3 servings, store 'freezer' (a portion frozen).
      { date: '2026-01-04', recipeId: 'r-chicken', batches: 3, store: 'freezer' },
    ]);
    // Day 5 is 2026-01-10; thaw the day before -> 2026-01-09.
    expect(result.thawReminders).toEqual([
      { date: '2026-01-09', recipeId: 'r-chicken' },
    ]);
  });

  it('emits one thaw reminder per frozen use', () => {
    // fridgeDays 1 (only offset 1 / day 0 stays fresh); days 0,2,4 -> offsets 1,3,5.
    const recipe = makeRecipe('r-fish', 'cod', {
      servings: 1,
      storage: { fridgeDays: 1, freezerMonths: 1 },
    });
    let plan = withBreakfast(emptyPlan(), 0, 'r-fish');
    plan = withBreakfast(plan, 2, 'r-fish');
    plan = withBreakfast(plan, 4, 'r-fish');

    const result = computePrepList(plan, [recipe], stateWithFoods(), AGE);
    expect(result.sessions).toEqual([
      { date: '2026-01-04', recipeId: 'r-fish', batches: 3, store: 'freezer' },
    ]);
    // Day 2 = 2026-01-07 -> thaw 2026-01-06; day 4 = 2026-01-09 -> thaw 2026-01-08.
    expect(result.thawReminders).toEqual([
      { date: '2026-01-06', recipeId: 'r-fish' },
      { date: '2026-01-08', recipeId: 'r-fish' },
    ]);
  });

  it('treats missing fridgeDays as 0 so every freezer use is frozen', () => {
    // No fridgeDays: nothing stays fresh past the prep day, so all uses frozen.
    const recipe = makeRecipe('r-stew', 'stew', {
      servings: 2,
      storage: { freezerMonths: 2 },
    });
    let plan = withBreakfast(emptyPlan(), 0, 'r-stew');
    plan = withBreakfast(plan, 3, 'r-stew');

    const result = computePrepList(plan, [recipe], stateWithFoods(), AGE);
    expect(result.sessions).toEqual([
      { date: '2026-01-04', recipeId: 'r-stew', batches: 1, store: 'freezer' },
    ]);
    // Day 0 = 2026-01-05 -> thaw 2026-01-04; day 3 = 2026-01-08 -> thaw 2026-01-07.
    expect(result.thawReminders).toEqual([
      { date: '2026-01-04', recipeId: 'r-stew' },
      { date: '2026-01-07', recipeId: 'r-stew' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// (c) cook-fresh greedy grouping
// ---------------------------------------------------------------------------

describe('computePrepList: cook-fresh', () => {
  it('cooks one fresh session per use day when fridgeDays is unset', () => {
    // No storage at all -> cook fresh, each use its own session on its day.
    const recipe = makeRecipe('r-fresh', 'fresh', { servings: 1 });
    let plan = withBreakfast(emptyPlan(), 0, 'r-fresh');
    plan = withBreakfast(plan, 2, 'r-fresh');

    const result = computePrepList(plan, [recipe], stateWithFoods(), AGE);
    expect(result.thawReminders).toEqual([]);
    expect(result.sessions).toEqual([
      // Day 0 = 2026-01-05, day 2 = 2026-01-07; sessions on the use day itself.
      { date: '2026-01-05', recipeId: 'r-fresh', batches: 1, store: 'serve' },
      { date: '2026-01-07', recipeId: 'r-fresh', batches: 1, store: 'serve' },
    ]);
  });

  it('greedily groups uses within fridgeDays of each session start', () => {
    // fridgeDays 2, NO freezer. Uses on days 0,1,2,5,6 -> offsets 1,2,3,6,7.
    // Start at offset 1: covers offsets <= 3 (days 0,1,2) = 3 servings.
    // Next start at offset 6: covers offsets <= 8 (days 5,6) = 2 servings.
    const recipe = makeRecipe('r-group', 'group', {
      servings: 2,
      storage: { fridgeDays: 2 },
    });
    let plan = emptyPlan();
    for (const d of [0, 1, 2, 5, 6]) plan = withBreakfast(plan, d, 'r-group');

    const result = computePrepList(plan, [recipe], stateWithFoods(), AGE);
    expect(result.thawReminders).toEqual([]);
    expect(result.sessions).toEqual([
      // First session starts day 0 (2026-01-05), 3 servings -> ceil(3/2)=2 batches.
      { date: '2026-01-05', recipeId: 'r-group', batches: 2, store: 'serve' },
      // Second session starts day 5 (2026-01-10), 2 servings -> 1 batch.
      { date: '2026-01-10', recipeId: 'r-group', batches: 1, store: 'serve' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Ghosted-slot exclusion
// ---------------------------------------------------------------------------

describe('computePrepList: ghosted slots excluded', () => {
  it('excludes a recipe blocked by the safety screen (honey under 12 months)', () => {
    const honey = makeRecipe('r-honey', 'honey', {
      storage: { fridgeDays: 3 },
      ingredients: [{ name: 'honey', category: 'pantry' }],
    });
    const pear = makeRecipe('r-pear', 'pear', { storage: { fridgeDays: 3 } });
    let plan = withBreakfast(emptyPlan(), 0, 'r-honey');
    plan = withBreakfast(plan, 1, 'r-pear');

    const result = computePrepList(plan, [honey, pear], stateWithFoods(), AGE);
    // Honey is ghosted at 8 months -> only pear is scheduled.
    expect(result.sessions).toEqual([
      { date: '2026-01-04', recipeId: 'r-pear', batches: 1, store: 'fridge' },
    ]);
    expect(result.thawReminders).toEqual([]);
  });

  it('excludes a recipe whose ingredient food has a recorded reaction', () => {
    const reacted = makeRecipe('r-reacted', 'squash', {
      storage: { fridgeDays: 3 },
      ingredients: [{ name: 'squash', category: 'produce' }],
    });
    const pear = makeRecipe('r-pear', 'pear', { storage: { fridgeDays: 3 } });
    let plan = withBreakfast(emptyPlan(), 0, 'r-reacted');
    plan = withBreakfast(plan, 1, 'r-pear');

    const foods: Record<string, FoodRecord> = {
      squash: { status: 'reaction', date: '2025-12-01' },
    };
    const result = computePrepList(plan, [reacted, pear], stateWithFoods(foods), AGE);
    expect(result.sessions).toEqual([
      { date: '2026-01-04', recipeId: 'r-pear', batches: 1, store: 'fridge' },
    ]);
  });

  it('includes a honey recipe once the child is 12 months or older', () => {
    const honey = makeRecipe('r-honey', 'honey', {
      storage: { fridgeDays: 3 },
      ingredients: [{ name: 'honey', category: 'pantry' }],
    });
    const plan = withBreakfast(emptyPlan(), 0, 'r-honey');
    const result = computePrepList(plan, [honey], stateWithFoods(), 12);
    expect(result.sessions).toEqual([
      { date: '2026-01-04', recipeId: 'r-honey', batches: 1, store: 'fridge' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// prepDate change recomputes (can flip fridge vs freezer/fresh)
// ---------------------------------------------------------------------------

describe('computePrepList: prepDate change', () => {
  it('flips fridge-only to freezer when the prep day moves earlier', () => {
    // fridgeDays 2, freezerMonths 1. Use on day 1 only.
    const recipe = makeRecipe('r-chicken', 'chicken', {
      servings: 1,
      storage: { fridgeDays: 2, freezerMonths: 1 },
    });
    const base = withBreakfast(emptyPlan(), 1, 'r-chicken');

    // Default prepDate 2026-01-04: day 1 = 2026-01-06 -> offset 2 <= fridgeDays
    // -> fridge-only, no thaw reminder.
    const near = computePrepList(base, [recipe], stateWithFoods(), AGE);
    expect(near.sessions[0].store).toBe('fridge');
    expect(near.thawReminders).toEqual([]);

    // Move prepDate 3 days earlier: day 1 offset becomes 5 > fridgeDays -> frozen.
    const farPlan: WeekPlan = { ...base, prepDate: '2026-01-01' };
    const far = computePrepList(farPlan, [recipe], stateWithFoods(), AGE);
    expect(far.sessions).toEqual([
      { date: '2026-01-01', recipeId: 'r-chicken', batches: 1, store: 'freezer' },
    ]);
    // Day 1 = 2026-01-06 -> thaw the day before -> 2026-01-05.
    expect(far.thawReminders).toEqual([
      { date: '2026-01-05', recipeId: 'r-chicken' },
    ]);
  });

  it('moving the prep day later keeps everything in the fridge', () => {
    const recipe = makeRecipe('r-chicken', 'chicken', {
      servings: 1,
      storage: { fridgeDays: 2, freezerMonths: 1 },
    });
    // Use on day 3 (2026-01-08). With a later prepDate on 2026-01-07, offset 1.
    const plan: WeekPlan = {
      ...withBreakfast(emptyPlan(), 3, 'r-chicken'),
      prepDate: '2026-01-07',
    };
    const result = computePrepList(plan, [recipe], stateWithFoods(), AGE);
    expect(result.sessions).toEqual([
      { date: '2026-01-07', recipeId: 'r-chicken', batches: 1, store: 'fridge' },
    ]);
    expect(result.thawReminders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Determinism / multiple recipes
// ---------------------------------------------------------------------------

describe('computePrepList: ordering', () => {
  it('sorts sessions and thaw reminders by date then recipeId', () => {
    const a = makeRecipe('r-a', 'apple', { storage: { freezerMonths: 1 } });
    const b = makeRecipe('r-b', 'banana', { storage: { freezerMonths: 1 } });
    // Both frozen, both cooked on the prep day (same date); recipeId breaks tie.
    let plan = withBreakfast(emptyPlan(), 0, 'r-b');
    plan = {
      ...plan,
      days: plan.days.map((d, i) => (i === 0 ? { ...d, breakfast: 'r-b' } : d)),
    };
    plan = { ...plan, activeSlots: ['breakfast', 'lunch'] };
    plan = {
      ...plan,
      days: plan.days.map((d, i) => (i === 0 ? { ...d, lunch: 'r-a' } : d)),
    };

    const result = computePrepList(plan, [a, b], stateWithFoods(), AGE);
    expect(result.sessions.map((s) => s.recipeId)).toEqual(['r-a', 'r-b']);
    // Both used on day 0 (2026-01-05) -> thaw 2026-01-04, sorted by recipeId.
    expect(result.thawReminders).toEqual([
      { date: '2026-01-04', recipeId: 'r-a' },
      { date: '2026-01-04', recipeId: 'r-b' },
    ]);
  });
});
