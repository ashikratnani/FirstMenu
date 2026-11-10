// "What can I make?" matching (design.md "Matching (make.ts)", Requirements
// 3.3 to 3.9, 13.8). Pure TS, no React. Derived data: never stored.
//
// Matching is exact on PLAIN food keys (groceryFoodKey for recipe ingredients,
// foodKeyFromName for typed foods). Allergen group keys are not used, so
// having yogurt does not cover butter. Fuzzy text search lives in
// foodSearch.ts and only turns words into foods.
//
// Also here: serving-form derivation for custom recipes (Req 16.13), search
// filters (Req 16.9), the "Iron-rich only" filter (Req 3.9) and "More ideas"
// (Req 16.12). Nutrition tags (Req 3.8) come from nutrition.ts.

import type { SearchFilter } from '../data/searchPhrases';
import { STAGE_IDS, stageFor } from './age';
import { isOptional, recipeEffort, recipeMinutes, type Effort } from './effort';
import { groceryFoodKey, isIgnoredFood } from './foods';
import { recipeNutritionTags, type NutritionTag } from './nutrition';
import { isRecipeGhosted } from './plan';
import { matchesTerm, tokenMatches, tokenize } from './safety/normalize';
import type { AppState, Recipe, ServeAs, StageId } from './types';

export interface MakeResult {
  recipe: Recipe;
  /** Plain keys of uncovered required ingredients, de-duplicated. */
  missing: string[];
  minutes?: number;
  minutesKind?: 'stated' | 'estimated';
  effort: Effort;
  /** Nutrition tags from the required ingredients (Req 3.8). */
  tags: NutritionTag[];
  /** True for a toddler's results tagged only for younger stages (Req 13.8). */
  youngerStage: boolean;
}

export interface MakeGroups {
  readyNow: MakeResult[];
  missingOne: MakeResult[];
  ghosted: MakeResult[];
  /**
   * Recipes matching every filter that miss two or more foods, fewest missing
   * first, at most MORE_IDEAS_LIMIT. Empty unless a filter is active (Req 16.12).
   */
  moreIdeas: MakeResult[];
}

export interface MakeOptions {
  /** Show every stage instead of only the child's stage (Req 3.6). */
  allStages?: boolean;
  /** Search filters from the typed text (Req 16.9). All must match (AND). */
  filters?: SearchFilter[];
  /**
   * The "Iron-rich only" toggle (Req 3.9). It is the same filter as
   * `tag:iron-rich`, so having both on is one filter, not two.
   */
  ironRichOnly?: boolean;
}

export const MORE_IDEAS_LIMIT = 10;
const IRON_RICH_FILTER: SearchFilter = 'tag:iron-rich';
const QUICK_MINUTES = 15;

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

// Serving-form keywords for recipes with no `serveAs` (design "Serving form").
// Whole words, plural-aware, matched against title, texture and steps.
const SERVE_AS_KEYWORDS: Array<{ form: ServeAs; words: string[] }> = [
  {
    form: 'finger-food',
    words: [
      'finger', 'strips', 'sticks', 'bites', 'puffs', 'pancake', 'muffin',
      'fritter', 'ball', 'nugget', 'fries', 'toast', 'wedge',
    ],
  },
  { form: 'puree', words: ['puree', 'blend', 'blender', 'smooth'] },
  { form: 'mashed', words: ['mash', 'mashed', 'fork'] },
  { form: 'pieces', words: ['chop', 'chopped', 'dice', 'diced', 'pieces', 'cubes'] },
];

function stageDefaultForm(stages: StageId[]): ServeAs {
  // The youngest stage the recipe is tagged with. No stages: treat as 9-12.
  const youngest = STAGE_IDS.find((s) => stages.includes(s)) ?? '9-12';
  if (youngest === '6-8') return 'puree';
  if (youngest === '9-12') return 'mashed';
  return 'pieces';
}

/**
 * A recipe's serving forms (Req 16.13). Uses `serveAs` when set. Otherwise
 * derives it from the title, texture and steps (first match per form), and
 * falls back to the stage default when nothing matches. `guessed` is true
 * whenever the forms were derived, so the recipe page can say "(guessed)".
 */
export function recipeServeAs(recipe: Recipe): { forms: ServeAs[]; guessed: boolean } {
  if (recipe.serveAs !== undefined && recipe.serveAs.length > 0) {
    return { forms: recipe.serveAs, guessed: false };
  }
  const text = [recipe.title, recipe.texture, ...recipe.steps].join(' ');
  const forms = SERVE_AS_KEYWORDS.filter(({ words }) =>
    words.some((w) => matchesTerm(text, w)),
  ).map(({ form }) => form);
  if (forms.length > 0) return { forms, guessed: true };
  return { forms: [stageDefaultForm(recipe.stages)], guessed: true };
}

/** The filters in force: typed filters plus the toggle, de-duplicated (Req 3.9). */
export function activeFilters(options: MakeOptions = {}): SearchFilter[] {
  const list = [...(options.filters ?? [])];
  if (options.ironRichOnly === true) list.push(IRON_RICH_FILTER);
  return list.filter((f, i) => list.indexOf(f) === i);
}

/**
 * Turn the "Iron-rich only" toggle on or off in a filter list. Typing "iron
 * rich" and tapping the toggle are one filter, so turning it off also removes
 * the typed phrase's filter (Req 3.9).
 */
export function setIronRichFilter(filters: SearchFilter[], on: boolean): SearchFilter[] {
  const rest = filters.filter((f) => f !== IRON_RICH_FILTER);
  return on ? [...rest, IRON_RICH_FILTER] : rest;
}

function matchesFilter(recipe: Recipe, result: MakeResult, filter: SearchFilter): boolean {
  if (filter.startsWith('meal:')) {
    return (recipe.mealTypes as string[]).includes(filter.slice(5));
  }
  if (filter.startsWith('form:')) {
    return (recipeServeAs(recipe).forms as string[]).includes(filter.slice(5));
  }
  if (filter.startsWith('tag:')) return (result.tags as string[]).includes(filter.slice(4));
  if (filter === 'quick') return result.minutes !== undefined && result.minutes <= QUICK_MINUTES;
  if (filter === 'easy') return result.effort === 'easy';
  if (filter === 'freezer') return recipe.storage?.freezerMonths !== undefined;
  return false;
}

/** True when the result matches every filter (AND). No filters matches all. */
export function matchesFilters(result: MakeResult, filters: SearchFilter[]): boolean {
  return filters.every((f) => matchesFilter(result.recipe, result, f));
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

function buildResult(recipe: Recipe, have: Set<string>, youngerStage: boolean): MakeResult {
  const time = recipeMinutes(recipe);
  return {
    recipe,
    missing: requiredKeys(recipe).filter((key) => !have.has(key)),
    minutes: time?.minutes,
    minutesKind: time?.kind,
    effort: recipeEffort(recipe),
    tags: recipeNutritionTags(recipe),
    youngerStage,
  };
}

/**
 * Recipes whose title contains any of `titleWords` ("Recipes named ...",
 * Req 16.8). Whole word, plural-aware. Same stage rule and filters as the
 * other groups, but no cut on missing foods. Ghosted recipes come back
 * separately so the screen can show them as ghosts. Sorted like the groups.
 */
export function recipesNamed(
  recipes: Recipe[],
  titleWords: string[],
  have: Set<string>,
  ageMonths: number,
  foods: AppState['foods'],
  options: MakeOptions = {},
): { results: MakeResult[]; ghosted: MakeResult[] } {
  const out = { results: [] as MakeResult[], ghosted: [] as MakeResult[] };
  if (titleWords.length === 0) return out;
  const filters = activeFilters(options);
  const ghostState = { foods } as AppState;
  for (const recipe of recipes) {
    const titleTokens = tokenize(recipe.title);
    const named = titleWords.some((word) =>
      titleTokens.some((t) => tokenMatches(t, word) || tokenMatches(word, t)),
    );
    if (!named) continue;
    const fit = options.allStages === true ? 'primary' : stageFit(recipe, ageMonths);
    if (fit === 'none') continue;
    const result = buildResult(recipe, have, fit === 'younger');
    if (!matchesFilters(result, filters)) continue;
    if (isRecipeGhosted(recipe, ghostState, ageMonths)) out.ghosted.push(result);
    else out.results.push(result);
  }
  out.results.sort(compareResults);
  out.ghosted.sort(compareResults);
  return out;
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
  const groups: MakeGroups = { readyNow: [], missingOne: [], ghosted: [], moreIdeas: [] };
  const filters = activeFilters(options);
  // isRecipeGhosted only reads state.foods.
  const ghostState = { foods } as AppState;

  for (const recipe of recipes) {
    const fit = options.allStages === true ? 'primary' : stageFit(recipe, ageMonths);
    if (fit === 'none') continue;

    const result = buildResult(recipe, have, fit === 'younger');
    const missing = result.missing;

    if (!matchesFilters(result, filters)) continue;

    if (isRecipeGhosted(recipe, ghostState, ageMonths)) groups.ghosted.push(result);
    else if (missing.length === 0) groups.readyNow.push(result);
    else if (missing.length === 1) groups.missingOne.push(result);
    else if (filters.length > 0) groups.moreIdeas.push(result);
  }

  groups.readyNow.sort(compareResults);
  groups.missingOne.sort(compareResults);
  groups.ghosted.sort(compareResults);
  groups.moreIdeas.sort((a, b) => a.missing.length - b.missing.length || compareResults(a, b));
  groups.moreIdeas.length = Math.min(groups.moreIdeas.length, MORE_IDEAS_LIMIT);
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
