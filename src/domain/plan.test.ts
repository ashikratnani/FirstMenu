import { describe, expect, it } from 'vitest';
import {
  computeNextWeekPlan,
  defaultPrepDate,
  defaultStartDate,
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
