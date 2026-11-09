import { describe, expect, it } from 'vitest';
import { BUILTIN_RECIPES } from '../data/recipes';
import { recipeEffort, recipeMinutes } from './effort';
import type { Ingredient, Recipe } from './types';

function byTitle(title: string): Recipe {
  const r = BUILTIN_RECIPES.find((x) => x.title === title);
  if (!r) throw new Error(`missing built-in ${title}`);
  return r;
}

function make(over: Partial<Recipe> = {}): Recipe {
  return {
    id: 'c-1',
    origin: 'custom',
    title: 'Test',
    stages: ['9-12'],
    mealTypes: ['lunch'],
    ingredients: [{ name: 'banana', category: 'produce' }],
    steps: ['Mash.'],
    texture: 'smooth',
    servings: 2,
    ...over,
  };
}

function ings(n: number, extra: Partial<Ingredient> = {}): Ingredient[] {
  return Array.from({ length: n }, (_, i) => ({ name: `food${i}`, category: 'produce' as const, ...extra }));
}

describe('recipeMinutes', () => {
  it('uses stated minutes first', () => {
    expect(recipeMinutes(make({ statedMinutes: 40, steps: ['Bake 90 minutes.'] }))).toEqual({
      minutes: 40,
      kind: 'stated',
    });
  });

  it('returns undefined when no duration is found', () => {
    expect(recipeMinutes(make({ steps: ['Mash the banana.', 'Serve.'] }))).toBeUndefined();
    expect(recipeMinutes(make({ steps: [] }))).toBeUndefined();
  });

  it('carrots and apples: 45 or 8 minutes uses the smaller, about 15', () => {
    expect(recipeMinutes(byTitle('Carrots and Apples'))).toEqual({ minutes: 15, kind: 'estimated' });
  });

  it('sweet potato chicken: 50 or 5 minutes, about 10', () => {
    expect(recipeMinutes(byTitle('Sweet Potato Chicken'))).toEqual({ minutes: 10, kind: 'estimated' });
  });

  it('cereal pancakes: 2 to 3 minutes on the other side counts twice, about 15', () => {
    expect(recipeMinutes(byTitle('Cereal Pancakes'))).toEqual({ minutes: 15, kind: 'estimated' });
  });

  it('meat balls: 20 to 25 minutes uses the upper bound, about 30', () => {
    expect(recipeMinutes(byTitle('Meat Balls'))).toEqual({ minutes: 30, kind: 'estimated' });
  });

  it('adds durations across steps and within a step', () => {
    expect(recipeMinutes(byTitle('Spinach & Apple Puffs'))).toEqual({ minutes: 35, kind: 'estimated' });
  });

  it('gives no time to built-ins with no durations in their steps', () => {
    expect(recipeMinutes(byTitle('Beef, Peas and Potatoes'))).toBeUndefined();
  });

  it('converts hours and hrs, and accepts min/mins', () => {
    expect(recipeMinutes(make({ steps: ['Simmer 2 hours.'] }))?.minutes).toBe(125);
    expect(recipeMinutes(make({ steps: ['Chill 1 hr.'] }))?.minutes).toBe(65);
    expect(recipeMinutes(make({ steps: ['Cook 10 mins.'] }))?.minutes).toBe(15);
    expect(recipeMinutes(make({ steps: ['Cook 10 min.'] }))?.minutes).toBe(15);
    expect(recipeMinutes(make({ steps: ['Chill 1 to 2 hours.'] }))?.minutes).toBe(125);
  });

  it('rounds up to the next 5 after adding 5', () => {
    expect(recipeMinutes(make({ steps: ['Cook 1 minute.'] }))?.minutes).toBe(10);
    expect(recipeMinutes(make({ steps: ['Cook 5 minutes.'] }))?.minutes).toBe(10);
    expect(recipeMinutes(make({ steps: ['Cook 6 minutes.'] }))?.minutes).toBe(15);
  });

  it('counts per side and each side twice', () => {
    expect(recipeMinutes(make({ steps: ['Cook 3 minutes per side.'] }))?.minutes).toBe(15);
    expect(recipeMinutes(make({ steps: ['Cook each side 4 minutes.'] }))?.minutes).toBe(15);
  });

  it('does not double the other duration when only one clause says per side', () => {
    expect(recipeMinutes(make({ steps: ['Heat 2 minutes, then cook 3 minutes per side.'] }))?.minutes).toBe(15);
  });

  it('treats durations joined by "or" as alternatives, even three', () => {
    expect(recipeMinutes(make({ steps: ['Cook 30 minutes, or 12 minutes, or 20 minutes.'] }))?.minutes).toBe(20);
  });

  it('adds durations that are not joined by "or"', () => {
    expect(recipeMinutes(make({ steps: ['Boil 10 minutes, then rest 5 minutes.'] }))?.minutes).toBe(20);
  });

  it('ignores numbers that are not durations', () => {
    expect(recipeMinutes(make({ steps: ['Bake at 350 degrees.', 'Cut into 2 inch pieces.'] }))).toBeUndefined();
  });
});

describe('recipeEffort', () => {
  it('is easy at 5 ingredients, 4 steps and no oven', () => {
    expect(recipeEffort(make({ ingredients: ings(5), steps: ['a', 'b', 'c', 'd'] }))).toBe('easy');
  });

  it('is medium at 6 ingredients', () => {
    expect(recipeEffort(make({ ingredients: ings(6) }))).toBe('medium');
  });

  it('is medium at 5 steps', () => {
    expect(recipeEffort(make({ steps: ['a', 'b', 'c', 'd', 'e'] }))).toBe('medium');
  });

  it.each(['Preheat the oven.', 'Bake 10 minutes.', 'Roast the squash.'])('is medium when a step says "%s"', (s) => {
    expect(recipeEffort(make({ steps: [s] }))).toBe('medium');
  });

  it('is medium at 8 ingredients and 7 steps', () => {
    expect(recipeEffort(make({ ingredients: ings(8), steps: Array(7).fill('x') }))).toBe('medium');
  });

  it('is more above 8 ingredients or above 7 steps', () => {
    expect(recipeEffort(make({ ingredients: ings(9) }))).toBe('more');
    expect(recipeEffort(make({ steps: Array(8).fill('x') }))).toBe('more');
  });

  it('skips optional ingredients, by flag or by "(optional)" in the name', () => {
    const flagged = [...ings(5), { name: 'cinnamon', category: 'pantry' as const, optional: true }];
    expect(recipeEffort(make({ ingredients: flagged }))).toBe('easy');
    const named = [...ings(5), { name: 'cinnamon (optional)', category: 'pantry' as const }];
    expect(recipeEffort(make({ ingredients: named }))).toBe('easy');
    expect(recipeEffort(make({ ingredients: [...ings(8), ...ings(3, { optional: true })] }))).toBe('medium');
  });

  it('does not treat words like "baker" or "ovenproof" differently from the oven rule', () => {
    expect(recipeEffort(make({ steps: ['Use a bakery roll.'] }))).toBe('easy');
  });

  it('rates the built-in recipes', () => {
    expect(recipeEffort(byTitle('Beef, Peas and Potatoes'))).toBe('easy');
    expect(recipeEffort(byTitle('Cereal Pancakes'))).toBe('medium');
    expect(recipeEffort(byTitle('Meat Balls'))).toBe('medium');
  });
});
