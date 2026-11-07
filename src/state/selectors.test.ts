import { describe, expect, it } from 'vitest';
import { ageInMonths, stageFor } from '../domain/age';
import { BUILTIN_RECIPES } from '../data/recipes';
import { defaultState } from '../domain/storage';
import type { AppState, Recipe } from '../domain/types';
import {
  selectAgeMonths,
  selectAllRecipes,
  selectRecipeScreenResults,
  selectStage,
} from './selectors';

const customRecipe: Recipe = {
  id: 'custom-1',
  origin: 'custom',
  title: 'My Mash',
  stages: ['6-8'],
  mealTypes: ['lunch'],
  ingredients: [{ name: 'banana', category: 'produce' }],
  steps: ['Mash it.'],
  texture: 'smooth',
  servings: 2,
};

function stateWith(partial: Partial<AppState>): AppState {
  return { ...defaultState(new Date(2026, 0, 15)), ...partial };
}

describe('selectAgeMonths / selectStage', () => {
  it('return null with no child', () => {
    const state = stateWith({});
    expect(selectAgeMonths(state)).toBeNull();
    expect(selectStage(state)).toBeNull();
  });

  it('match age.ts for a known birthDate as of plan.startDate', () => {
    const state = stateWith({
      child: { birthDate: '2025-06-01' },
      plan: { ...defaultState(new Date(2026, 0, 15)).plan, startDate: '2026-01-15' },
    });
    const months = ageInMonths('2025-06-01', '2026-01-15');
    expect(selectAgeMonths(state)).toBe(months);
    expect(selectStage(state)).toBe(stageFor(months));
  });
});

describe('selectAllRecipes', () => {
  it('combines BUILTIN_RECIPES with customRecipes', () => {
    const state = stateWith({ customRecipes: [customRecipe] });
    const all = selectAllRecipes(state);
    expect(all).toHaveLength(BUILTIN_RECIPES.length + 1);
    expect(all.map((r) => r.id)).toContain('custom-1');
  });

  it('returns a stable reference for the same state and a new one when it changes', () => {
    const state = stateWith({ customRecipes: [customRecipe] });
    const first = selectAllRecipes(state);
    expect(selectAllRecipes(state)).toBe(first);

    const changed = stateWith({ customRecipes: [] });
    expect(selectAllRecipes(changed)).not.toBe(first);
  });
});

describe('selectRecipeScreenResults', () => {
  it('returns a screen result per recipe', () => {
    const state = stateWith({ customRecipes: [customRecipe] });
    const results = selectRecipeScreenResults(state);
    expect(results).toHaveLength(BUILTIN_RECIPES.length + 1);
    for (const r of results) {
      expect(r.result).toHaveProperty('blocks');
      expect(r.result).toHaveProperty('reminders');
      expect(r.result).toHaveProperty('allergens');
    }
  });

  it('memoizes by state reference', () => {
    const state = stateWith({ customRecipes: [customRecipe] });
    const first = selectRecipeScreenResults(state);
    expect(selectRecipeScreenResults(state)).toBe(first);
  });

  it('recomputes with a different age when birthDate changes', () => {
    // A recipe with honey blocks under 12 months but is allowed at/after 12.
    const honeyRecipe: Recipe = {
      ...customRecipe,
      id: 'honey-test',
      ingredients: [{ name: 'honey', category: 'pantry' }],
    };
    const base = defaultState(new Date(2026, 0, 15));

    const youngState: AppState = {
      ...base,
      customRecipes: [honeyRecipe],
      child: { birthDate: '2025-07-01' }, // ~6 months on 2026-01-15
      plan: { ...base.plan, startDate: '2026-01-15' },
    };
    const olderState: AppState = {
      ...base,
      customRecipes: [honeyRecipe],
      child: { birthDate: '2024-01-01' }, // 24 months on 2026-01-15
      plan: { ...base.plan, startDate: '2026-01-15' },
    };

    const young = selectRecipeScreenResults(youngState).find(
      (r) => r.recipe.id === 'honey-test',
    )!;
    const older = selectRecipeScreenResults(olderState).find(
      (r) => r.recipe.id === 'honey-test',
    )!;

    expect(young.result.blocks.length).toBeGreaterThan(0);
    expect(older.result.blocks.length).toBe(0);
  });
});
