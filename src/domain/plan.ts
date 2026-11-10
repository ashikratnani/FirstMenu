// Week-plan date math and the new-food spacing warning (design.md "Plan
// (plan.ts)" and "New-food spacing warning (plan.ts)"). Pure TS, no React: it
// lives beside age.ts/foods.ts and is unit-tested without rendering.
//
// What this module owns:
//   - defaultStartDate(today): the plan's default Monday anchor.
//   - defaultPrepDate(startDate): startDate - 1 day.
//   - computeNextWeekPlan(plan, mode): the WeekPlan date/day math for "new
//     week" (keep | empty), mirroring the AppProvider `newWeek` reducer action.
//   - newFoodSpacingWarning(...): one warning when two untried foods are
//     introduced closer than NEW_FOOD_SPACING_DAYS apart, else null.
//
// All date math uses the SAME timezone-safe YYYY-MM-DD approach as
// AppProvider.tsx `shiftYmd` and age.ts `parseYMD` (parse via Date.UTC, format
// back with getUTC*), so results are DST-safe and match the reducer exactly.
// The 3-day spacing value is NEVER hardcoded here; it is imported from
// safety/rules.ts (NEW_FOOD_SPACING_DAYS) so the number and its published
// source live together with the rules.

import type { AppState, Recipe, WeekPlan } from './types';
import {
  NEW_FOOD_SPACING_DAYS,
  NEW_FOOD_SPACING_SOURCES,
  type SourceId,
} from './safety/rules';
import { foodKeyFor, foodLabel, foodStatus, isIgnoredFood } from './foods';
import { screenRecipe, screenTextMentions } from './safety/screen';

// ---------------------------------------------------------------------------
// Timezone-safe YYYY-MM-DD helpers (mirror AppProvider.shiftYmd / age.parseYMD)
// ---------------------------------------------------------------------------

/** Format a UTC Date back to a zero-padded YYYY-MM-DD string. */
function formatYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD string into a UTC Date at midnight (no local-zone drift). */
function parseYmd(date: string): Date {
  const [year, month, day] = date.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
}

/** Shift a YYYY-MM-DD date by `days`, timezone-safe. Identical to the reducer. */
export function shiftYmd(date: string, days: number): string {
  const [year, month, day] = date.split('-').map((part) => Number(part));
  return formatYmd(new Date(Date.UTC(year, month - 1, day + days)));
}

/**
 * Normalize a Date or YYYY-MM-DD string to a YYYY-MM-DD string. A Date is read
 * in LOCAL time (its calendar day on the user's device), so "today" as a Date
 * becomes the local calendar date; a string is parsed via UTC and reformatted
 * so an already-YMD input round-trips unchanged.
 */
function toYmd(input: string | Date): string {
  if (typeof input === 'string') {
    return formatYmd(parseYmd(input));
  }
  const y = input.getFullYear();
  const m = String(input.getMonth() + 1).padStart(2, '0');
  const d = String(input.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Plan dates
// ---------------------------------------------------------------------------

/**
 * The default plan start date (design "Plan (plan.ts)": "today if Monday, else
 * the next Monday"). Monday is the week anchor. Accepts a Date (read in local
 * time) or a YYYY-MM-DD string (parsed in UTC); returns a YYYY-MM-DD string.
 *
 * JS getUTCDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday. The number of days
 * to add to reach the next Monday is `(8 - weekday) % 7`, which is 0 when the
 * day is already Monday (so a Monday is returned unchanged).
 */
export function defaultStartDate(today: string | Date): string {
  const ymd = toYmd(today);
  const weekday = parseYmd(ymd).getUTCDay();
  const daysUntilMonday = (8 - weekday) % 7;
  return shiftYmd(ymd, daysUntilMonday);
}

/** The default prep date: the day before the plan's start (design "Plan"). */
export function defaultPrepDate(startDate: string): string {
  return shiftYmd(startDate, -1);
}

/**
 * Compute the next-week WeekPlan for a "new week" (design Req 8.5). Mirrors the
 * AppProvider `newWeek` reducer action's PLAN math exactly:
 *   - 'keep':  shift startDate and prepDate by +7 days and keep `days`.
 *   - 'empty': clear `days` to 7 empty objects, keep startDate/prepDate.
 * `activeSlots` is preserved in both modes.
 *
 * NOTE: clearing the grocery checks is NOT done here. `groceryChecked` lives on
 * AppState, not on WeekPlan, so the reducer clears it in BOTH modes (see the
 * `newWeek` case in AppProvider.tsx). This module stays the single source of
 * the plan date/day math so the reducer and tests can rely on it; the reducer
 * owns the groceryChecked reset.
 */
export function computeNextWeekPlan(
  plan: WeekPlan,
  mode: 'keep' | 'empty',
): WeekPlan {
  if (mode === 'keep') {
    return {
      ...plan,
      startDate: shiftYmd(plan.startDate, 7),
      prepDate: shiftYmd(plan.prepDate, 7),
    };
  }
  return {
    ...plan,
    days: Array.from({ length: 7 }, () => ({})),
  };
}

// ---------------------------------------------------------------------------
// New-food spacing warning
// ---------------------------------------------------------------------------

/**
 * A single new-food spacing warning (design "New-food spacing warning"). Lists
 * the untried foods introduced too close together, and carries the spacing
 * value and its published sources so the UI can show the number and cite the
 * source WITHOUT hardcoding either.
 */
export interface NewFoodSpacingWarning {
  /** The distinct too-close untried food keys, sorted by first day then key. */
  foods: string[];
  /** Human labels for `foods`, in the same order (via foodLabel). */
  foodLabels: string[];
  /**
   * The plan day INDEX (0..6) each food in `foods` is first introduced on, in
   * the same order as `foods`. Req 7.8: the warning names the foods AND the
   * days. The UI maps the index to a human day label (dayLabel).
   */
  firstDays: number[];
  /** The required gap between new foods (NEW_FOOD_SPACING_DAYS from rules.ts). */
  spacingDays: number;
  /** Published sources for the spacing value (NEW_FOOD_SPACING_SOURCES). */
  sources: SourceId[];
}

/** Resolve a plan recipe id to a Recipe from the passed list (built-ins + custom). */
function recipeById(recipes: Recipe[], id: string): Recipe | undefined {
  return recipes.find((r) => r.id === id);
}

/**
 * Whether a planned recipe is GHOSTED for the current state, using the SAME
 * honest rule the recipe view uses (recipeView.ts): a recipe is ghosted when
 * the safety screen reports any block finding, a pasted recipe's text mentions
 * a block-rule food (screenTextMentions), OR one of its ingredient foods
 * has a recorded 'reaction'. A ghosted recipe is not going to be served, so its
 * foods are not really being introduced — the spacing calc skips it. This is a
 * pure, domain-only check (no UI import), so plan.ts stays React-free.
 *
 * Exported so other pure domain modules (e.g. prep.ts) reuse the SAME ghost
 * rule instead of copying it. recipeView.ts encodes the same rule for the UI;
 * the domain uses this one. Keep the two in sync if the rule ever changes.
 */
export function isRecipeGhosted(
  recipe: Recipe,
  state: AppState,
  ageMonths: number,
): boolean {
  if (screenRecipe(recipe, ageMonths).blocks.length > 0) return true;
  // Pasted recipes: a block-rule food named in the title, steps or notes.
  if (screenTextMentions(recipe, ageMonths).length > 0) return true;
  for (const ingredient of recipe.ingredients) {
    for (const key of foodKeyFor(ingredient)) {
      if (
        foodStatus(key, state, ageMonths) === 'ghost' &&
        state.foods[key]?.status === 'reaction'
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * The earliest day index (0..6) each DISTINCT untried food appears in the plan.
 *
 * An "untried food" is a food key whose foodStatus(key, state, ageMonths) ===
 * 'door': a food not yet tried and not blocked. Already-tried 'monster' foods
 * and blocked/reaction 'ghost' foods are excluded, so only genuinely new foods
 * count toward the spacing rule. Only the plan's active slots are considered,
 * and GHOSTED planned recipes are skipped entirely (they will not be served).
 * Ignored foods (water, breast milk, formula, ice) and empty keys never derive
 * a door; foodKeyFor already handles that, and we guard defensively too.
 */
function firstDayByUntriedFood(
  plan: WeekPlan,
  recipes: Recipe[],
  state: AppState,
  ageMonths: number,
): Map<string, number> {
  const firstDay = new Map<string, number>();

  plan.days.forEach((day, dayIndex) => {
    for (const meal of plan.activeSlots) {
      const recipeId = day[meal];
      if (recipeId === undefined) continue;
      const recipe = recipeById(recipes, recipeId);
      if (recipe === undefined) continue;
      // A ghosted planned recipe will not be served, so its foods are not
      // actually being introduced — exclude them from the spacing calc.
      if (isRecipeGhosted(recipe, state, ageMonths)) continue;

      for (const ingredient of recipe.ingredients) {
        for (const key of foodKeyFor(ingredient)) {
          if (key.length === 0 || isIgnoredFood(key)) continue;
          if (foodStatus(key, state, ageMonths) !== 'door') continue;
          const existing = firstDay.get(key);
          if (existing === undefined || dayIndex < existing) {
            firstDay.set(key, dayIndex);
          }
        }
      }
    }
  });

  return firstDay;
}

/**
 * One new-food spacing warning, or null (design "New-food spacing warning"):
 * for each untried food introduced by the plan, take the first day it appears;
 * if any two DISTINCT untried foods have first days less than
 * NEW_FOOD_SPACING_DAYS apart, return one warning listing EVERY food involved
 * in at least one too-close pair, else null.
 */
export function newFoodSpacingWarning(
  plan: WeekPlan,
  recipes: Recipe[],
  state: AppState,
  ageMonths: number,
): NewFoodSpacingWarning | null {
  const firstDay = firstDayByUntriedFood(plan, recipes, state, ageMonths);

  // Order foods by first day, then by key for a deterministic result.
  const ordered = [...firstDay.entries()].sort((a, b) =>
    a[1] !== b[1] ? a[1] - b[1] : a[0].localeCompare(b[0]),
  );

  // Collect every food in at least one pair introduced < spacingDays apart.
  const tooClose = new Set<string>();
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const gap = Math.abs(ordered[i][1] - ordered[j][1]);
      if (gap < NEW_FOOD_SPACING_DAYS) {
        tooClose.add(ordered[i][0]);
        tooClose.add(ordered[j][0]);
      }
    }
  }

  if (tooClose.size === 0) return null;

  const involved = ordered.filter(([key]) => tooClose.has(key));
  const foods = involved.map(([key]) => key);

  return {
    foods,
    foodLabels: foods.map((key) => foodLabel(key)),
    firstDays: involved.map(([, dayIndex]) => dayIndex),
    spacingDays: NEW_FOOD_SPACING_DAYS,
    sources: NEW_FOOD_SPACING_SOURCES,
  };
}
