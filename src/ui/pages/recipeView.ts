// Shared, React-free helpers for the Recipe library page (Recipes.tsx, Task
// 9.1). Kept in a non-component module (like childProfile.ts) so the page and
// its test import the SAME derivations with no react-refresh lint warning.
//
// These derive the per-recipe VIEW badges the library shows, reusing the real
// safety screen (screen.ts) and food status (foods.ts); no new ghosting rule is
// invented here (design.md / Req 5.1).

import { STAGE_IDS, STAGE_LABELS } from '../../domain/age';
import { screenRecipe, type Finding } from '../../domain/safety/screen';
import {
  foodKeyFor,
  foodLabel,
  foodStatus,
  isIgnoredFood,
} from '../../domain/foods';
import { selectAgeMonths } from '../../state/selectors';
import type { AppState, MealType, Recipe, StageId } from '../../domain/types';

/** Stage filter value: a specific stage, or 'all' to show every stage. */
export type StageFilter = StageId | 'all';
/** Meal-type filter value: a specific meal, or 'all'. */
export type MealFilter = MealType | 'all';

/** The four meal types, in menu order, for the meal-type filter. */
export const MEAL_TYPES: readonly MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
];

/** The stages, in order, for the stage filter. */
export const STAGES: readonly StageId[] = STAGE_IDS;

/** Human label for a meal type (capitalized). */
export function mealTypeLabel(meal: MealType): string {
  return meal.charAt(0).toUpperCase() + meal.slice(1);
}

/** Human label for a stage ("9–11 months"). */
export function stageLabel(stage: StageId): string {
  return STAGE_LABELS[stage];
}

/** Day labels for the 7-day plan (index 0..6), for the emptied-slot notice. */
const DAY_LABELS: readonly string[] = [
  'Day 1',
  'Day 2',
  'Day 3',
  'Day 4',
  'Day 5',
  'Day 6',
  'Day 7',
];

/** Human label for a plan day index ("Day 1"); falls back for out-of-range. */
export function dayLabel(day: number): string {
  return DAY_LABELS[day] ?? `Day ${day + 1}`;
}

/** Human one-line label for an emptied plan slot ("Day 1, Lunch"). */
export function emptiedSlotLabel(slot: {
  day: number;
  meal: MealType;
}): string {
  return `${dayLabel(slot.day)}, ${mealTypeLabel(slot.meal)}`;
}

/** The per-recipe view model the library card renders from. */
export interface RecipeView {
  recipe: Recipe;
  /** True when any block finding applies OR an ingredient food has a reaction. */
  isGhosted: boolean;
  /** Every block finding, in screen order (drives the ghost reason text). */
  blocks: Finding[];
  /** The food key (plain name) whose reaction ghosts the recipe, if any. */
  reactionFoodKey: string | null;
  /** True when any ingredient food is still an untried mystery door. */
  usesUntriedFood: boolean;
  /**
   * Labels of the untried foods the recipe uses (deduped, first-seen order),
   * so the door badge can NAME each untried food (Req 7.3). Empty when none.
   */
  untriedFoodLabels: string[];
  /** Positive freezer months when the recipe is freezer-friendly, else null. */
  freezerMonths: number | null;
}

/**
 * Derive the library view model for one recipe at the child's current age.
 *
 * Ghosting (Req 5.1) stays honest and aligned with screen.ts/foods.ts:
 *   - any block finding from the screen (this already covers block-covered
 *     foods such as honey under 12 months), OR
 *   - an ingredient whose foodKeyFor key has a RECORDED reaction
 *     (foodStatus === 'ghost' while no block applies means a reaction).
 * A door badge means an ingredient food is still a mystery door (untried).
 * A pumpkin badge means recipe.storage.freezerMonths is a positive number.
 */
export function recipeView(
  recipe: Recipe,
  state: AppState,
  ageMonthsOverride?: number,
): RecipeView {
  // Most callers (Recipes/Home) derive age from the child via the state. The
  // shared view has NO child, so it passes payload.ageMonths explicitly as the
  // override; when omitted behavior is unchanged (selectAgeMonths(state) ?? 0).
  const ageMonths = ageMonthsOverride ?? selectAgeMonths(state) ?? 0;
  const result = screenRecipe(recipe, ageMonths);

  let reactionFoodKey: string | null = null;
  const untriedLabels: string[] = [];
  const seenUntried = new Set<string>();

  for (const ingredient of recipe.ingredients) {
    for (const key of foodKeyFor(ingredient)) {
      const status = foodStatus(key, state, ageMonths);
      // Water, breast milk, formula and ice are never first-taste doors (the
      // Foods page skips them too), so they never appear in a door badge.
      // Only the badge skips them: a reaction recorded under one of these
      // keys (possible via an imported backup or share link) must still ghost
      // the recipe, as isRecipeGhosted() in plan.ts does.
      if (status === 'door' && !isIgnoredFood(key) && !seenUntried.has(key)) {
        seenUntried.add(key);
        untriedLabels.push(foodLabel(key));
      }
      // A ghost status with a recorded reaction (not a block) ghosts the
      // recipe even when the screen found no block (e.g. an allergen reaction).
      if (status === 'ghost' && state.foods[key]?.status === 'reaction') {
        reactionFoodKey ??= key;
      }
    }
  }

  const isGhosted = result.blocks.length > 0 || reactionFoodKey !== null;
  const freezer = recipe.storage?.freezerMonths;
  const freezerMonths =
    typeof freezer === 'number' && freezer > 0 ? freezer : null;

  return {
    recipe,
    isGhosted,
    blocks: result.blocks,
    reactionFoodKey,
    usesUntriedFood: untriedLabels.length > 0,
    untriedFoodLabels: untriedLabels,
    freezerMonths,
  };
}

/** The "Not yet: <food>. Available at N months." phrase for one block. */
function blockReason(block: Finding): string {
  const food = block.ingredientName;
  if (block.availableAtMonths !== undefined) {
    return `Not yet: ${food}. Available at ${block.availableAtMonths} months.`;
  }
  return `Not yet: ${food}.`;
}

/**
 * The visible + accessible "ghost state" reason for a ghosted recipe. Mirrors
 * the Foods page wording: EACH block becomes "Not yet: <food>. Available at N
 * months." (Req 5.3 — a ghosted recipe shows every blocking ingredient), joined
 * by a space; a reaction uses "Not yet: <food>. Reaction recorded."; otherwise
 * a bare "Not yet."
 */
export function ghostReason(view: RecipeView): string {
  if (view.blocks.length > 0) {
    return view.blocks.map(blockReason).join(' ');
  }
  if (view.reactionFoodKey) {
    return `Not yet: ${foodLabel(view.reactionFoodKey)}. Reaction recorded.`;
  }
  return 'Not yet.';
}

/**
 * Door-badge text for a recipe using untried foods, NAMING each untried food
 * (Req 7.3 / design Theme mapping): "New food: egg" for one, "New food: egg,
 * wheat" for several. Falls back to a bare "New food" if the labels are empty.
 */
export function doorBadgeText(labels: string[]): string {
  if (labels.length === 0) return 'New food';
  return `New food: ${labels.join(', ')}`;
}

/** Freezer badge text for a freezer-friendly recipe ("Freezes for N months"). */
export function freezerBadgeText(months: number): string {
  const unit = months === 1 ? 'month' : 'months';
  return `Freezes for ${months} ${unit}`;
}
