import { describe, expect, it } from 'vitest';
import {
  computeNextWeekPlan,
  defaultPrepDate,
  defaultStartDate,
  isRecipeGhosted,
  newFoodSpacingWarning,
} from './plan';
import { reducer, type AppAction } from '../state/AppProvider';
import { defaultState } from './storage';
import {
  NEW_FOOD_SPACING_DAYS,
  NEW_FOOD_SPACING_SOURCES,
} from './safety/rules';
import type { AppState, FoodRecord, Recipe, WeekPlan } from './types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A single-food recipe keyed on a plain (non-allergen, non-blocked) name. */
function foodRecipe(id: string, name: string): Recipe {
  return {
    id,
    origin: 'custom',
    title: `${name} dish`,
    stages: ['6-8', '9-12'],
    mealTypes: ['breakfast'],
    ingredients: [{ name, category: 'produce' }],
    steps: ['Cook.'],
    texture: 'smooth',
    servings: 1,
  };
}

/** A fresh plan with all 7 days empty, breakfast as the only active slot. */
function emptyPlan(): WeekPlan {
  return {
    startDate: '2026-01-05', // a Monday
    prepDate: '2026-01-04',
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

// ---------------------------------------------------------------------------
// defaultStartDate
// ---------------------------------------------------------------------------

describe('isRecipeGhosted with text mentions', () => {
  const pasted = (over: Partial<Recipe> = {}): Recipe => ({
    ...foodRecipe('r-pasted', 'pear'),
    imported: { from: 'chatgpt', text: 'x', date: '2026-01-05' },
    ...over,
  });

  it('ghosts a pasted recipe whose step names a blocked food', () => {
    expect(isRecipeGhosted(pasted({ steps: ['Add honey.'] }), stateWithFoods(), 8)).toBe(true);
  });

  it('does not ghost a typed recipe for the same step', () => {
    expect(isRecipeGhosted(pasted({ steps: ['Add honey.'], imported: undefined }), stateWithFoods(), 8)).toBe(false);
  });

  it('stops ghosting once the mention is cleared, and at the age limit', () => {
    const cleared = pasted({
      steps: ['Add honey.'],
      clearedMentions: [{ ruleId: 'honey', sentence: 'Add honey.' }],
    });
    expect(isRecipeGhosted(cleared, stateWithFoods(), 8)).toBe(false);
    expect(isRecipeGhosted(pasted({ steps: ['Add honey.'] }), stateWithFoods(), 12)).toBe(false);
  });
});

describe('defaultStartDate', () => {
  // 2026-01-05 is a Monday; 06 Tue, 07 Wed, 08 Thu, 09 Fri, 10 Sat, 11 Sun.
  it('returns the same date when given a Monday', () => {
    expect(defaultStartDate('2026-01-05')).toBe('2026-01-05');
  });

  it('returns the next Monday for a Tuesday', () => {
    expect(defaultStartDate('2026-01-06')).toBe('2026-01-12');
  });

  it('returns the next Monday for a Wednesday', () => {
    expect(defaultStartDate('2026-01-07')).toBe('2026-01-12');
  });

  it('returns the next Monday for a Thursday', () => {
    expect(defaultStartDate('2026-01-08')).toBe('2026-01-12');
  });

  it('returns the next Monday for a Friday', () => {
    expect(defaultStartDate('2026-01-09')).toBe('2026-01-12');
  });

  it('returns the next Monday for a Saturday', () => {
    expect(defaultStartDate('2026-01-10')).toBe('2026-01-12');
  });

  it('returns the next Monday for a Sunday', () => {
    expect(defaultStartDate('2026-01-11')).toBe('2026-01-12');
  });

  it('accepts a Date (local calendar day) as well as a string', () => {
    // Construct a local-time Monday so toYmd reads the same calendar day.
    const monday = new Date(2026, 0, 5); // 2026-01-05 local
    expect(defaultStartDate(monday)).toBe('2026-01-05');
    const tuesday = new Date(2026, 0, 6);
    expect(defaultStartDate(tuesday)).toBe('2026-01-12');
  });
});

// ---------------------------------------------------------------------------
// defaultPrepDate
// ---------------------------------------------------------------------------

describe('defaultPrepDate', () => {
  it('is the day before the start date', () => {
    expect(defaultPrepDate('2026-01-05')).toBe('2026-01-04');
  });

  it('crosses a month and year boundary', () => {
    expect(defaultPrepDate('2026-01-01')).toBe('2025-12-31');
  });

  it('crosses a leap-day boundary', () => {
    expect(defaultPrepDate('2028-03-01')).toBe('2028-02-29');
  });
});

// ---------------------------------------------------------------------------
// computeNextWeekPlan
// ---------------------------------------------------------------------------

describe('computeNextWeekPlan', () => {
  it("'keep' shifts startDate and prepDate by exactly 7 days and preserves days", () => {
    const plan = withBreakfast(emptyPlan(), 2, 'r1');
    const next = computeNextWeekPlan(plan, 'keep');
    expect(next.startDate).toBe('2026-01-12');
    expect(next.prepDate).toBe('2026-01-11');
    expect(next.days).toEqual(plan.days);
    expect(next.days[2].breakfast).toBe('r1');
    expect(next.activeSlots).toEqual(plan.activeSlots);
  });

  it("'empty' clears days to 7 empty objects and keeps startDate/prepDate", () => {
    const plan = withBreakfast(emptyPlan(), 0, 'r1');
    const next = computeNextWeekPlan(plan, 'empty');
    expect(next.startDate).toBe(plan.startDate);
    expect(next.prepDate).toBe(plan.prepDate);
    expect(next.days).toHaveLength(7);
    expect(next.days).toEqual(Array.from({ length: 7 }, () => ({})));
    expect(next.activeSlots).toEqual(plan.activeSlots);
  });

  it('matches the AppProvider newWeek reducer date/day math in both modes', () => {
    const plan = withBreakfast(emptyPlan(), 3, 'r1');
    const state: AppState = { ...stateWithFoods(), plan, groceryChecked: ['x'] };

    const keepAction: AppAction = { type: 'newWeek', mode: 'keep' };
    const keepReduced = reducer(state, keepAction);
    expect(keepReduced.plan).toEqual(computeNextWeekPlan(plan, 'keep'));
    // The reducer also clears groceryChecked (not plan math, documented in plan.ts).
    expect(keepReduced.groceryChecked).toEqual([]);

    const emptyAction: AppAction = { type: 'newWeek', mode: 'empty' };
    const emptyReduced = reducer(state, emptyAction);
    expect(emptyReduced.plan).toEqual(computeNextWeekPlan(plan, 'empty'));
    expect(emptyReduced.groceryChecked).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// newFoodSpacingWarning
// ---------------------------------------------------------------------------

describe('newFoodSpacingWarning', () => {
  const PEAR = foodRecipe('r-pear', 'pear');
  const SQUASH = foodRecipe('r-squash', 'squash');
  const recipes: Recipe[] = [PEAR, SQUASH];
  const ageMonths = 8;

  it('returns null when two untried foods are introduced >= spacing days apart', () => {
    // pear on day 0, squash on day 3 -> gap of 3 = NEW_FOOD_SPACING_DAYS, not less.
    let plan = withBreakfast(emptyPlan(), 0, 'r-pear');
    plan = withBreakfast(plan, 3, 'r-squash');
    const result = newFoodSpacingWarning(
      plan,
      recipes,
      stateWithFoods(),
      ageMonths,
    );
    expect(result).toBeNull();
  });

  it('returns one warning listing BOTH foods when introduced < spacing days apart', () => {
    // pear on day 0, squash on day 1 -> gap of 1 < 3 -> warning.
    let plan = withBreakfast(emptyPlan(), 0, 'r-pear');
    plan = withBreakfast(plan, 1, 'r-squash');
    const result = newFoodSpacingWarning(
      plan,
      recipes,
      stateWithFoods(),
      ageMonths,
    );
    expect(result).not.toBeNull();
    expect(result!.foods).toEqual(['pear', 'squash']);
    expect(result!.foodLabels).toEqual(['pear', 'squash']);
    // Req 7.8: the warning also names the DAY each food is first introduced,
    // as a 0-based day index aligned with `foods`.
    expect(result!.firstDays).toEqual([0, 1]);
  });

  it('reports each food first day index in the same order as foods (Req 7.8)', () => {
    // squash on day 1, pear on day 2 -> gap 1 < 3; ordered by first day then
    // key, so squash (day 1) precedes pear (day 2).
    let plan = withBreakfast(emptyPlan(), 2, 'r-pear');
    plan = withBreakfast(plan, 1, 'r-squash');
    const result = newFoodSpacingWarning(
      plan,
      recipes,
      stateWithFoods(),
      ageMonths,
    );
    expect(result).not.toBeNull();
    expect(result!.foods).toEqual(['squash', 'pear']);
    expect(result!.firstDays).toEqual([1, 2]);
    expect(result!.firstDays).toHaveLength(result!.foods.length);
  });

  it('uses the EARLIEST day when a food is planned on multiple days (Req 7.8)', () => {
    // pear on days 0 and 4, squash on day 1 -> pear's first day is 0.
    let plan = withBreakfast(emptyPlan(), 0, 'r-pear');
    plan = withBreakfast(plan, 4, 'r-pear');
    plan = withBreakfast(plan, 1, 'r-squash');
    const result = newFoodSpacingWarning(
      plan,
      recipes,
      stateWithFoods(),
      ageMonths,
    );
    expect(result).not.toBeNull();
    expect(result!.foods).toEqual(['pear', 'squash']);
    expect(result!.firstDays).toEqual([0, 1]);
  });

  it('excludes foods from an already-ghosted planned recipe (will not be served)', () => {
    // A recipe with BOTH a new food (squash) and a block-covered food (honey)
    // is ghosted, so neither of its foods counts; pear alone -> no warning.
    const GHOSTED = {
      ...foodRecipe('r-ghosted', 'squash'),
      ingredients: [
        { name: 'squash', category: 'produce' as const },
        { name: 'honey', category: 'pantry' as const },
      ],
    };
    let plan = withBreakfast(emptyPlan(), 0, 'r-pear');
    plan = withBreakfast(plan, 1, 'r-ghosted');
    const result = newFoodSpacingWarning(
      plan,
      [PEAR, GHOSTED],
      stateWithFoods(),
      ageMonths,
    );
    expect(result).toBeNull();
  });

  it('excludes foods from a recipe ghosted by a recorded reaction', () => {
    // A recipe whose ingredient (squash) has a recorded reaction is ghosted, so
    // its other new food (pear-in-same-recipe) is not introduced.
    const REACTED = {
      ...foodRecipe('r-reacted', 'squash'),
      ingredients: [
        { name: 'squash', category: 'produce' as const },
        { name: 'kiwi', category: 'produce' as const },
      ],
    };
    const PLAIN_PEAR = foodRecipe('r-pear2', 'pear');
    let plan = withBreakfast(emptyPlan(), 0, 'r-pear2');
    plan = withBreakfast(plan, 1, 'r-reacted');
    const foods: Record<string, FoodRecord> = {
      squash: { status: 'reaction', date: '2025-12-01' },
    };
    const result = newFoodSpacingWarning(
      plan,
      [PLAIN_PEAR, REACTED],
      stateWithFoods(foods),
      ageMonths,
    );
    // kiwi (the reacted recipe's untried food) is excluded; pear alone -> null.
    expect(result).toBeNull();
  });

  it('does not treat an already-tried (monster) food as new', () => {
    // pear recorded as tried; even planned next to a new squash it is excluded,
    // leaving only one new food, so no pair and no warning.
    let plan = withBreakfast(emptyPlan(), 0, 'r-pear');
    plan = withBreakfast(plan, 1, 'r-squash');
    const foods: Record<string, FoodRecord> = {
      pear: { status: 'tried', date: '2025-12-01' },
    };
    const result = newFoodSpacingWarning(
      plan,
      recipes,
      stateWithFoods(foods),
      ageMonths,
    );
    expect(result).toBeNull();
  });

  it('does not count a reaction (ghost) food as a new-food door', () => {
    // pear has a recorded reaction -> ghost, excluded; squash alone -> no warning.
    let plan = withBreakfast(emptyPlan(), 0, 'r-pear');
    plan = withBreakfast(plan, 1, 'r-squash');
    const foods: Record<string, FoodRecord> = {
      pear: { status: 'reaction', date: '2025-12-01' },
    };
    const result = newFoodSpacingWarning(
      plan,
      recipes,
      stateWithFoods(foods),
      ageMonths,
    );
    expect(result).toBeNull();
  });

  it('does not count a blocked (ghost) food as a new-food door', () => {
    // Honey is block-covered under 12 months, so it is a ghost, not a door.
    const HONEY = foodRecipe('r-honey', 'honey');
    let plan = withBreakfast(emptyPlan(), 0, 'r-honey');
    plan = withBreakfast(plan, 1, 'r-squash');
    const result = newFoodSpacingWarning(
      plan,
      [HONEY, SQUASH],
      stateWithFoods(),
      ageMonths,
    );
    // Only squash is a new-food door; a single food cannot be too-close.
    expect(result).toBeNull();
  });

  it('carries NEW_FOOD_SPACING_DAYS and NEW_FOOD_SPACING_SOURCES from rules.ts', () => {
    let plan = withBreakfast(emptyPlan(), 0, 'r-pear');
    plan = withBreakfast(plan, 1, 'r-squash');
    const result = newFoodSpacingWarning(
      plan,
      recipes,
      stateWithFoods(),
      ageMonths,
    );
    expect(result).not.toBeNull();
    expect(result!.spacingDays).toBe(NEW_FOOD_SPACING_DAYS);
    expect(result!.sources).toEqual(NEW_FOOD_SPACING_SOURCES);
  });

  it('only considers active slots', () => {
    // squash in an inactive lunch slot is ignored, leaving only pear.
    let plan = withBreakfast(emptyPlan(), 0, 'r-pear');
    plan = {
      ...plan,
      days: plan.days.map((d, i) => (i === 1 ? { ...d, lunch: 'r-squash' } : d)),
    };
    const result = newFoodSpacingWarning(
      plan,
      recipes,
      stateWithFoods(),
      ageMonths,
    );
    expect(result).toBeNull();
  });
});

describe('isRecipeGhosted caching', () => {
  const honeyPasted = (extra: Partial<Recipe> = {}): Recipe => ({
    ...foodRecipe('cache-honey', 'oats'),
    steps: ['Stir in honey.'],
    imported: { from: 'other', text: 'x', date: '2026-01-05' },
    ...extra,
  });

  it('changes when a reaction is added and then removed for the same recipe object', () => {
    const recipe = foodRecipe('cache-r', 'squash');
    const clean = defaultState();
    const reacted: AppState = {
      ...clean,
      foods: { squash: { status: 'reaction', date: '2025-12-01' } },
    };
    expect(isRecipeGhosted(recipe, clean, 8)).toBe(false);
    expect(isRecipeGhosted(recipe, reacted, 8)).toBe(true);
    expect(isRecipeGhosted(recipe, clean, 8)).toBe(false);
  });

  it('answers per age for the same recipe (honey at 8, 12, then 8 months)', () => {
    const recipe = honeyPasted();
    const state = defaultState();
    expect(isRecipeGhosted(recipe, state, 8)).toBe(true);
    expect(isRecipeGhosted(recipe, state, 12)).toBe(false);
    expect(isRecipeGhosted(recipe, state, 8)).toBe(true);
  });

  it('a cleared mention is a new recipe object with a different result', () => {
    const recipe = honeyPasted();
    const state = defaultState();
    expect(isRecipeGhosted(recipe, state, 8)).toBe(true);
    const cleared = {
      ...recipe,
      clearedMentions: [{ ruleId: 'honey', sentence: 'Stir in honey.' }],
    };
    expect(isRecipeGhosted(cleared, state, 8)).toBe(false);
    expect(isRecipeGhosted(recipe, state, 8)).toBe(true);
  });
});
