// Memoized, React-free selectors for DERIVED data that is never stored
// (design.md: age, stage, combined recipe set, per-recipe screen results are
// computed, not persisted). Pure TS so they unit-test without rendering.

import { ageInMonths, stageFor } from '../domain/age';
import { screenRecipe, type ScreenResult } from '../domain/safety/screen';
import {
  allFoodKeys,
  blockFoodKeys,
  foodStatus,
  ALLERGEN_KEY_PREFIX,
  type FoodStatus,
} from '../domain/foods';
import type {
  AllergenGroup,
  AppState,
  FoodRecord,
  Recipe,
  StageId,
} from '../domain/types';
import { BUILTIN_RECIPES } from '../data/recipes';

/**
 * Memoize a one-argument selector by reference identity of its input. The
 * cache holds only the last input/output pair, so repeated calls with the same
 * state object return the SAME output reference (letting React skip work), and
 * a new state object recomputes. A tiny helper to avoid a new dependency.
 */
function memoizeByInput<I, O>(fn: (input: I) => O): (input: I) => O {
  let lastInput: I | undefined;
  let lastOutput: O;
  let hasValue = false;
  return (input: I): O => {
    if (hasValue && input === lastInput) return lastOutput;
    lastInput = input;
    lastOutput = fn(input);
    hasValue = true;
    return lastOutput;
  };
}

/**
 * Child age in whole months as of the plan's startDate, or null when there is
 * no child yet. Not memoized itself (cheap); used by the memoized selectors.
 */
export function selectAgeMonths(state: AppState): number | null {
  if (!state.child) return null;
  return ageInMonths(state.child.birthDate, state.plan.startDate);
}

/** Current stage for the child, or null when there is no child. */
export function selectStage(state: AppState): StageId | null {
  const months = selectAgeMonths(state);
  if (months === null) return null;
  return stageFor(months);
}

/**
 * The app's full recipe set: built-ins plus the user's custom recipes. Memoized
 * on the whole state; a new result is produced only when the state object
 * changes (and in practice only customRecipes matters here).
 */
export const selectAllRecipes: (state: AppState) => Recipe[] = memoizeByInput(
  (state: AppState) => [...BUILTIN_RECIPES, ...state.customRecipes],
);

export interface RecipeScreen {
  recipe: Recipe;
  result: ScreenResult;
}

/**
 * Screen every recipe at the child's current age so a birthDate or recipe
 * change updates every view (Req 1.6, 5.4). With no child yet, each recipe is
 * screened at age 0 (the strictest interpretation; screen.ts clamps NaN/neg to
 * 0 anyway). Memoized on the state reference.
 */
export const selectRecipeScreenResults: (state: AppState) => RecipeScreen[] =
  memoizeByInput((state: AppState) => {
    const ageMonths = selectAgeMonths(state) ?? 0;
    return selectAllRecipes(state).map((recipe) => ({
      recipe,
      result: screenRecipe(recipe, ageMonths),
    }));
  });

/** One food's view-model entry for the Foods page. */
export interface FoodView {
  /** The food key, e.g. 'apple' or 'allergen:peanut'. */
  key: string;
  /** door (untried), monster (tried, no reaction) or ghost (blocked/reaction). */
  status: FoodStatus;
  /** True when the key is an allergen group (`allergen:<group>`). */
  isAllergen: boolean;
  /** The allergen group when isAllergen, else null. */
  allergenGroup: AllergenGroup | null;
  /** The recorded FoodRecord (tried/reaction + date), when present. */
  record: FoodRecord | null;
}

/**
 * The Foods-page view model (Req 7.1, 7.4, 14.3): every non-ignored food the
 * app knows about (collectFoods over the full recipe set UNIONed with recorded
 * keys, per foods.ts allFoodKeys), each annotated with its foodStatus at the
 * child's current age (selectAgeMonths(state) ?? 0, matching the recipe
 * screen), whether it is an allergen group, and its FoodRecord when present.
 * Pure and memoized on the state reference.
 */
export const selectFoodViews: (state: AppState) => FoodView[] = memoizeByInput(
  (state: AppState) => {
    const ageMonths = selectAgeMonths(state) ?? 0;
    // Union the recipe + recorded keys with the representative blocked foods
    // for this age (Req 5.7), so blocked foods (honey, juice, added sugar,
    // salt, high-mercury fish, unpasteurized, choking hazards) always show as
    // ghosts even when no recipe uses them. Dedupe, preserving first-seen
    // order (recipe/recorded keys first, then any new blocked-food keys).
    const baseKeys = allFoodKeys(selectAllRecipes(state), state);
    const seen = new Set(baseKeys);
    const blockKeys = blockFoodKeys(ageMonths).filter((k) => !seen.has(k));
    const keys = [...baseKeys, ...blockKeys];
    return keys.map((key) => {
      const isAllergen = key.startsWith(ALLERGEN_KEY_PREFIX);
      const allergenGroup = isAllergen
        ? (key.slice(ALLERGEN_KEY_PREFIX.length) as AllergenGroup)
        : null;
      return {
        key,
        status: foodStatus(key, state, ageMonths),
        isAllergen,
        allergenGroup,
        record: state.foods[key] ?? null,
      };
    });
  },
);
