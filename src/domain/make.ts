// "What can I make?" matching (design.md "Matching (make.ts)", Requirements
// 3.3 to 3.9, 13.8). Pure TS, no React. Derived data: never stored.
//
// Matching is exact on PLAIN food keys (groceryFoodKey for recipe ingredients,
// foodKeyFromName for typed foods). Allergen group keys are not used, so
// having yogurt does not cover butter. Fuzzy text search lives in
// foodSearch.ts and only turns words into foods.
//
// Not here yet (task 7.3, after nutrition.ts exists): the `tags` field on
// MakeResult (Req 3.8), serving-form derivation, search filters, the
// "Iron-rich only" filter (Req 3.9) and "More ideas".

import { STAGE_IDS, stageFor } from './age';
import { isOptional, recipeEffort, recipeMinutes, type Effort } from './effort';
import { groceryFoodKey, isIgnoredFood } from './foods';
import { isRecipeGhosted } from './plan';
import type { AppState, Recipe } from './types';

export interface MakeResult {
  recipe: Recipe;
  /** Plain keys of uncovered required ingredients, de-duplicated. */
  missing: string[];
  minutes?: number;
  minutesKind?: 'stated' | 'estimated';
  effort: Effort;
  /** True for a toddler's results tagged only for younger stages (Req 13.8). */
  youngerStage: boolean;
}

export interface MakeGroups {
  readyNow: MakeResult[];
  missingOne: MakeResult[];
  ghosted: MakeResult[];
}

export interface MakeOptions {
  /** Show every stage instead of only the child's stage (Req 3.6). */
  allStages?: boolean;
}

const EFFORT_ORDER: Record<Effort, number> = { easy: 0, medium: 1, more: 2 };

/**
 * Plain keys of a recipe's required ingredients: not optional, not an ignored
 * food (water, breast milk, formula, ice), not empty. De-duplicated, in order.
 */
export function requiredKeys(recipe: Recipe): string[] {
  const keys: string[] = [];
  for (const ingredient of recipe.ingredients) {
    if (isOptional(ingredient)) continue;
    const key = groceryFoodKey(ingredient);
    if (key.length === 0 || isIgnoredFood(key)) continue;
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

/**
 * Stage rule (Req 3.6, 13.8): `primary` recipes are tagged for the child's
 * stage; for toddler stages, recipes tagged only for younger stages are also
 * kept, flagged `younger`. Anything else is dropped.
 */
function stageFit(recipe: Recipe, ageMonths: number): 'primary' | 'younger' | 'none' {
  const stage = stageFor(ageMonths);
  if (recipe.stages.includes(stage)) return 'primary';
  const toddler = stage === '12-23' || stage === '24-36';
  const rank = STAGE_IDS.indexOf(stage);
  if (
    toddler &&
    recipe.stages.length > 0 &&
    recipe.stages.every((s) => STAGE_IDS.indexOf(s) < rank)
  ) {
    return 'younger';
  }
  return 'none';
}

function compareResults(a: MakeResult, b: MakeResult): number {
  // The child's stage first, younger-stage recipes after (Req 13.8).
  if (a.youngerStage !== b.youngerStage) return a.youngerStage ? 1 : -1;
  // Time ascending, unknown last (Req 3.7).
  if (a.minutes !== b.minutes) {
    if (a.minutes === undefined) return 1;
    if (b.minutes === undefined) return -1;
    return a.minutes - b.minutes;
  }
  if (a.effort !== b.effort) return EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort];
  return a.recipe.title.localeCompare(b.recipe.title);
}

/**
 * Sort recipes into Ready now (nothing missing), Missing one, and Ghosted.
 * `have` is pantry plus on-hand plain food keys. `foods` is `state.foods`
 * (first-taste records), used for the reaction part of the ghost rule.
 */
export function makeResults(
  recipes: Recipe[],
  have: Set<string>,
  ageMonths: number,
  foods: AppState['foods'],
  options: MakeOptions = {},
): MakeGroups {
  const groups: MakeGroups = { readyNow: [], missingOne: [], ghosted: [] };
  // isRecipeGhosted only reads state.foods.
  const ghostState = { foods } as AppState;

  for (const recipe of recipes) {
    const fit = options.allStages === true ? 'primary' : stageFit(recipe, ageMonths);
    if (fit === 'none') continue;

    const missing = requiredKeys(recipe).filter((key) => !have.has(key));
    const time = recipeMinutes(recipe);
    const result: MakeResult = {
      recipe,
      missing,
      minutes: time?.minutes,
      minutesKind: time?.kind,
      effort: recipeEffort(recipe),
      youngerStage: fit === 'younger',
    };

    if (isRecipeGhosted(recipe, ghostState, ageMonths)) groups.ghosted.push(result);
    else if (missing.length === 0) groups.readyNow.push(result);
    else if (missing.length === 1) groups.missingOne.push(result);
  }

  groups.readyNow.sort(compareResults);
  groups.missingOne.sort(compareResults);
  groups.ghosted.sort(compareResults);
  return groups;
}

/**
 * Suggested on-hand chips: plain keys from required ingredients across all
 * recipes, minus the pantry, ordered by how many recipes use them (ties by
 * name), with the user's recent picks first (newest first). Recent picks that
 * no recipe uses are left out.
 */
export function suggestedChips(
  recipes: Recipe[],
  pantry: string[],
  recent: string[] = [],
): string[] {
  const inPantry = new Set(pantry);
  const counts = new Map<string, number>();
  for (const recipe of recipes) {
    for (const key of requiredKeys(recipe)) {
      if (inPantry.has(key)) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const byCount = Array.from(counts.keys()).sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b),
  );
  const first = recent.filter((key, i) => counts.has(key) && recent.indexOf(key) === i);
  return [...first, ...byCount.filter((key) => !first.includes(key))];
}
