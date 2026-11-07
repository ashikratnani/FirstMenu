import { describe, expect, it } from 'vitest';
import {
  computeGroceryList,
  flattenGroceryGroups,
  reconcileGroceryChecks,
  type GroceryGroup,
  type GroceryLine,
} from './grocery';
import { defaultState } from './storage';
import type { AppState, FoodRecord, GroceryCategory, Ingredient, Recipe, WeekPlan } from './types';

// ---------------------------------------------------------------------------
// Fixtures (mirrors prep.test.ts: build a WeekPlan, seed AppState via
// defaultState, helper recipes with explicit ingredients/servings/storage).
// ---------------------------------------------------------------------------

interface RecipeOpts {
  servings?: number;
  storage?: { fridgeDays?: number; freezerMonths?: number };
  ingredients: Ingredient[];
}

function makeRecipe(id: string, opts: RecipeOpts): Recipe {
  return {
    id,
    origin: 'custom',
    title: `${id} dish`,
    stages: ['6-8', '9-12'],
    mealTypes: ['breakfast'],
    ingredients: opts.ingredients,
    steps: ['Cook.'],
    texture: 'smooth',
    servings: opts.servings ?? 1,
    storage: opts.storage,
  };
}

function ing(
  name: string,
  category: GroceryCategory,
  quantity?: number,
  unit?: string,
): Ingredient {
  const i: Ingredient = { name, category };
  if (quantity !== undefined) i.quantity = quantity;
  if (unit !== undefined) i.unit = unit;
  return i;
}

/** A fresh plan, all 7 days empty, breakfast the only active slot. */
function emptyPlan(): WeekPlan {
  return {
    startDate: '2026-01-05', // a Monday
    prepDate: '2026-01-04', // startDate - 1
    activeSlots: ['breakfast'],
    days: Array.from({ length: 7 }, () => ({})),
  };
}

function withBreakfast(plan: WeekPlan, day: number, recipeId: string): WeekPlan {
  const days = plan.days.map((d, i) => (i === day ? { ...d, breakfast: recipeId } : d));
  return { ...plan, days };
}

function stateWithFoods(foods: Record<string, FoodRecord> = {}): AppState {
  return { ...defaultState(new Date('2026-01-05')), foods };
}

const AGE = 8;

/** Find a single line by food key + unit across all groups. */
function findLine(groups: GroceryGroup[], foodKey: string, unit?: string): GroceryLine | undefined {
  return flattenGroceryGroups(groups).find(
    (line) => line.foodKey === foodKey && line.unit === unit,
  );
}

// ---------------------------------------------------------------------------
// (a) merge same food + unit across sessions/recipes, scaled by batches
// ---------------------------------------------------------------------------

describe('computeGroceryList: merging by food + unit', () => {
  it('merges the same food + unit across recipes and scales by session batches', () => {
    // r-a: 1 serving/batch, used twice -> fridge-only session batches=2.
    // Each ingredient quantity is multiplied by batches (2).
    const rA = makeRecipe('r-a', {
      servings: 1,
      storage: { fridgeDays: 7 },
      ingredients: [ing('pear', 'produce', 50, 'g')],
    });
    // r-b: separate recipe, same food + unit, used once -> batches=1.
    const rB = makeRecipe('r-b', {
      servings: 1,
      storage: { fridgeDays: 7 },
      ingredients: [ing('pear', 'produce', 30, 'g')],
    });

    let plan = withBreakfast(emptyPlan(), 0, 'r-a');
    plan = withBreakfast(plan, 1, 'r-a');
    plan = withBreakfast(plan, 2, 'r-b');

    const groups = computeGroceryList(plan, [rA, rB], stateWithFoods(), AGE);
    const line = findLine(groups, 'pear', 'g');
    expect(line).toBeDefined();
    // r-a: 50 * 2 batches = 100; r-b: 30 * 1 = 30 -> 130.
    expect(line?.quantity).toBe(130);
    expect(line?.unit).toBe('g');
    expect(line?.asNeeded).toBe(false);
  });

  it("merges 'cup' and 'Cup' (case/whitespace) into one line", () => {
    const rA = makeRecipe('r-a', {
      storage: { fridgeDays: 7 },
      ingredients: [ing('oat', 'grains', 1, 'cup')],
    });
    const rB = makeRecipe('r-b', {
      storage: { fridgeDays: 7 },
      ingredients: [ing('oat', 'grains', 2, ' Cup ')],
    });
    let plan = withBreakfast(emptyPlan(), 0, 'r-a');
    plan = withBreakfast(plan, 1, 'r-b');

    const groups = computeGroceryList(plan, [rA, rB], stateWithFoods(), AGE);
    const lines = flattenGroceryGroups(groups).filter((l) => l.foodKey === 'oat');
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// (b) same food, different unit -> two lines (no conversion, Req 10.2)
// ---------------------------------------------------------------------------

describe('computeGroceryList: no unit conversion', () => {
  it('keeps the same food in different units as two separate lines', () => {
    const recipe = makeRecipe('r-a', {
      storage: { fridgeDays: 7 },
      ingredients: [ing('pear', 'produce', 1, 'cup'), ing('pear', 'produce', 200, 'g')],
    });
    const plan = withBreakfast(emptyPlan(), 0, 'r-a');

    const groups = computeGroceryList(plan, [recipe], stateWithFoods(), AGE);
    const lines = flattenGroceryGroups(groups).filter((l) => l.foodKey === 'pear');
    expect(lines).toHaveLength(2);
    expect(findLine(groups, 'pear', 'cup')?.quantity).toBe(1);
    expect(findLine(groups, 'pear', 'g')?.quantity).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// (c) no quantity -> asNeeded
// ---------------------------------------------------------------------------

describe('computeGroceryList: as needed', () => {
  it('marks a line with no quantity as asNeeded with no quantity', () => {
    const recipe = makeRecipe('r-a', {
      storage: { fridgeDays: 7 },
      ingredients: [ing('water', 'other')], // no quantity, no unit
    });
    const plan = withBreakfast(emptyPlan(), 0, 'r-a');

    const groups = computeGroceryList(plan, [recipe], stateWithFoods(), AGE);
    const line = findLine(groups, 'water', undefined);
    expect(line).toBeDefined();
    expect(line?.asNeeded).toBe(true);
    expect(line?.quantity).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// (d) mixed: some contributions with quantity, some without
// ---------------------------------------------------------------------------

describe('computeGroceryList: mixed quantity', () => {
  it('keeps the known sum AND flags asNeeded when some contributions lack a quantity', () => {
    // Same food + unit: one contribution has a quantity, one does not.
    const rA = makeRecipe('r-a', {
      storage: { fridgeDays: 7 },
      ingredients: [ing('spinach', 'produce', 40, 'g')],
    });
    const rB = makeRecipe('r-b', {
      storage: { fridgeDays: 7 },
      ingredients: [ing('spinach', 'produce', undefined, 'g')], // no quantity
    });
    let plan = withBreakfast(emptyPlan(), 0, 'r-a');
    plan = withBreakfast(plan, 1, 'r-b');

    const groups = computeGroceryList(plan, [rA, rB], stateWithFoods(), AGE);
    const line = findLine(groups, 'spinach', 'g');
    expect(line).toBeDefined();
    expect(line?.quantity).toBe(40); // known sum retained
    expect(line?.asNeeded).toBe(true); // flagged -> "40 g and more as needed"
  });
});

// ---------------------------------------------------------------------------
// (e) grouping emits categories in the fixed design order
// ---------------------------------------------------------------------------

describe('computeGroceryList: category order', () => {
  it('emits only non-empty groups in the fixed design order', () => {
    // Deliberately out of order; design order is
    // produce, protein, dairy-eggs, grains, pantry, frozen, other.
    const recipe = makeRecipe('r-a', {
      storage: { fridgeDays: 7 },
      ingredients: [
        ing('peas', 'frozen', 1, 'cup'),
        ing('rice', 'grains', 1, 'cup'),
        ing('chicken', 'protein', 1, 'piece'),
        ing('pear', 'produce', 1, 'piece'),
      ],
    });
    const plan = withBreakfast(emptyPlan(), 0, 'r-a');

    const groups = computeGroceryList(plan, [recipe], stateWithFoods(), AGE);
    expect(groups.map((g) => g.category)).toEqual(['produce', 'protein', 'grains', 'frozen']);
  });
});

// ---------------------------------------------------------------------------
// (f) reminders from the safety screen attached to the right line, de-duped
// ---------------------------------------------------------------------------

describe('computeGroceryList: prep reminders', () => {
  it('attaches the safety-screen reminder to the line and de-duplicates it', () => {
    // "grape" fires the grapes reminder rule (underMonths 48) at age 8:
    // message "Quarter lengthwise before serving." It is a reminder, not a
    // block, so the recipe is not ghosted.
    const rA = makeRecipe('r-a', {
      storage: { fridgeDays: 7 },
      ingredients: [ing('grape', 'produce', 5, 'piece')],
    });
    const rB = makeRecipe('r-b', {
      storage: { fridgeDays: 7 },
      ingredients: [ing('grape', 'produce', 3, 'piece')],
    });
    let plan = withBreakfast(emptyPlan(), 0, 'r-a');
    plan = withBreakfast(plan, 1, 'r-b');

    const groups = computeGroceryList(plan, [rA, rB], stateWithFoods(), AGE);
    const line = findLine(groups, 'grape', 'piece');
    expect(line).toBeDefined();
    expect(line?.reminders).toEqual(['Quarter lengthwise before serving.']);
  });
});

// ---------------------------------------------------------------------------
// (g) ghosted slots excluded (follows from building on computePrepList)
// ---------------------------------------------------------------------------

describe('computeGroceryList: ghosted slots', () => {
  it('excludes a recipe blocked by the safety screen at a young age', () => {
    // Honey blocks under 12 months -> the recipe is ghosted at age 8, so it
    // contributes nothing to the grocery list.
    const recipe = makeRecipe('r-honey', {
      storage: { fridgeDays: 7 },
      ingredients: [ing('honey', 'pantry', 1, 'tbsp'), ing('pear', 'produce', 1, 'piece')],
    });
    const plan = withBreakfast(emptyPlan(), 0, 'r-honey');

    const groups = computeGroceryList(plan, [recipe], stateWithFoods(), AGE);
    expect(groups).toEqual([]);
  });

  it('includes the same recipe once the block rule no longer applies', () => {
    const recipe = makeRecipe('r-honey', {
      storage: { fridgeDays: 7 },
      ingredients: [ing('honey', 'pantry', 1, 'tbsp')],
    });
    const plan = withBreakfast(emptyPlan(), 0, 'r-honey');

    // At 13 months honey no longer blocks (underMonths 12).
    const groups = computeGroceryList(plan, [recipe], stateWithFoods(), 13);
    expect(findLine(groups, 'honey', 'tbsp')?.quantity).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// grocery lines key by FOOD NAME, not allergen group (issue #26 / Req 10.2)
// ---------------------------------------------------------------------------

describe('computeGroceryList: merges by food name, not allergen group', () => {
  it('keeps distinct dairy foods as separate food-name lines', () => {
    // All dairy (allergen:dairy under the old keying), but each is its own
    // real food: yogurt, cheese, butter, milk must NOT collapse to one line.
    const recipe = makeRecipe('r-a', {
      storage: { fridgeDays: 7 },
      ingredients: [
        ing('plain yogurt', 'dairy-eggs', 100, 'g'),
        ing('cheddar cheese', 'dairy-eggs', 50, 'g'),
        ing('unsalted butter', 'dairy-eggs', 20, 'g'),
        ing('whole milk', 'dairy-eggs', 200, 'g'),
      ],
    });
    const plan = withBreakfast(emptyPlan(), 0, 'r-a');

    const groups = computeGroceryList(plan, [recipe], stateWithFoods(), AGE);
    // No allergen-group line exists anymore.
    expect(findLine(groups, 'allergen:dairy', 'g')).toBeUndefined();
    expect(findLine(groups, 'yogurt', 'g')?.quantity).toBe(100);
    expect(findLine(groups, 'cheddar cheese', 'g')?.quantity).toBe(50);
    expect(findLine(groups, 'butter', 'g')?.quantity).toBe(20);
    expect(findLine(groups, 'milk', 'g')?.quantity).toBe(200);
    // Labels are the readable food names, not an allergen group label.
    expect(findLine(groups, 'cheddar cheese', 'g')?.label).toBe('cheddar cheese');
  });

  it('keeps distinct grain foods (flour vs macaroni) as separate lines', () => {
    const recipe = makeRecipe('r-a', {
      storage: { fridgeDays: 7 },
      ingredients: [
        ing('flour', 'grains', 100, 'g'),
        ing('macaroni', 'grains', 80, 'g'),
      ],
    });
    const plan = withBreakfast(emptyPlan(), 0, 'r-a');

    const groups = computeGroceryList(plan, [recipe], stateWithFoods(), AGE);
    expect(findLine(groups, 'allergen:wheat', 'g')).toBeUndefined();
    expect(findLine(groups, 'flour', 'g')?.quantity).toBe(100);
    expect(findLine(groups, 'macaroni', 'g')?.quantity).toBe(80);
  });

  it('counts a multi-allergen ingredient once, as a single food line', () => {
    // "egg noodles" maps to both allergen:egg AND allergen:wheat under
    // foodKeyFor, but the grocery list keys by the derived food name so it is
    // ONE line counted once (no double-counting).
    const recipe = makeRecipe('r-a', {
      storage: { fridgeDays: 7 },
      ingredients: [ing('egg noodles', 'grains', 100, 'g')],
    });
    const plan = withBreakfast(emptyPlan(), 0, 'r-a');

    const groups = computeGroceryList(plan, [recipe], stateWithFoods(), AGE);
    expect(findLine(groups, 'allergen:egg', 'g')).toBeUndefined();
    expect(findLine(groups, 'allergen:wheat', 'g')).toBeUndefined();
    const lines = flattenGroceryGroups(groups);
    expect(lines).toHaveLength(1);
    expect(lines[0].foodKey).toBe('egg noodle');
    expect(lines[0].quantity).toBe(100);
  });

  it('keys by the ingredient `food` override when set', () => {
    const recipe = makeRecipe('r-a', {
      storage: { fridgeDays: 7 },
      ingredients: [{ name: 'cheddar cheese', category: 'dairy-eggs', food: 'Cheese', quantity: 30, unit: 'g' }],
    });
    const plan = withBreakfast(emptyPlan(), 0, 'r-a');

    const groups = computeGroceryList(plan, [recipe], stateWithFoods(), AGE);
    expect(findLine(groups, 'cheese', 'g')?.quantity).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// summed quantities are rounded (no float noise)
// ---------------------------------------------------------------------------

describe('computeGroceryList: rounds summed quantities', () => {
  it('rounds 0.1 + 0.1 + 0.1 to 0.3 (not 0.30000000000000004)', () => {
    const recipe = makeRecipe('r-a', {
      storage: { fridgeDays: 7 },
      ingredients: [
        ing('oil', 'pantry', 0.1, 'cup'),
        ing('oil', 'pantry', 0.1, 'cup'),
        ing('oil', 'pantry', 0.1, 'cup'),
      ],
    });
    const plan = withBreakfast(emptyPlan(), 0, 'r-a');

    const groups = computeGroceryList(plan, [recipe], stateWithFoods(), AGE);
    expect(findLine(groups, 'oil', 'cup')?.quantity).toBe(0.3);
  });

  it('keeps whole-number sums as integers', () => {
    const recipe = makeRecipe('r-a', {
      storage: { fridgeDays: 7 },
      ingredients: [ing('apple', 'produce', 1, 'piece'), ing('apple', 'produce', 1, 'piece')],
    });
    const plan = withBreakfast(emptyPlan(), 0, 'r-a');

    const groups = computeGroceryList(plan, [recipe], stateWithFoods(), AGE);
    expect(findLine(groups, 'apple', 'piece')?.quantity).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// (h) reconcileGroceryChecks drops stale keys, keeps present keys
// ---------------------------------------------------------------------------

describe('reconcileGroceryChecks', () => {
  it('keeps only checked keys still present in the list and de-duplicates', () => {
    const recipe = makeRecipe('r-a', {
      storage: { fridgeDays: 7 },
      ingredients: [ing('pear', 'produce', 1, 'g')],
    });
    const plan = withBreakfast(emptyPlan(), 0, 'r-a');
    const groups = computeGroceryList(plan, [recipe], stateWithFoods(), AGE);
    const presentKey = flattenGroceryGroups(groups)[0].key;

    const result = reconcileGroceryChecks(
      [presentKey, 'stale|g', presentKey],
      groups,
    );
    expect(result).toEqual([presentKey]);
  });

  it('works on a flat line array and returns [] for an empty list', () => {
    const lines: GroceryLine[] = [
      { key: 'pear|g', foodKey: 'pear', label: 'pear', unit: 'g', quantity: 1, asNeeded: false, category: 'produce', reminders: [] },
    ];
    expect(reconcileGroceryChecks(['pear|g', 'gone|'], lines)).toEqual(['pear|g']);
    expect(reconcileGroceryChecks(['anything'], [])).toEqual([]);
  });
});
