// Shared, React-free helpers for the week view (Plan.tsx) and the SlotPicker
// component (Task 10.2). Kept in a non-component module (like recipeView.ts) so
// the page, the picker and their tests import the SAME derivations with no
// react-refresh lint warning.
//
// No new ghosting/door rule is invented here: candidate ordering and the
// per-recipe view all go through recipeView() (which itself reuses screen.ts /
// foods.ts), so the week view stays identical to the recipe library.

import type { AppState, MealType, Recipe, StageId } from '../../domain/types';
import { shiftYmd } from '../../domain/plan';
import { recipeView, type RecipeView } from './recipeView';

/** Month abbreviations for a friendly, timezone-safe "Mon Nov 10" date label. */
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const WEEKDAYS_SHORT = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

/**
 * The YYYY-MM-DD date for day index `dayIndex` (0..6) of a plan starting on
 * `startDate`, using the SAME UTC date math as plan.ts/AppProvider (shiftYmd)
 * so it never drifts from the reducer.
 */
export function dayDateYmd(startDate: string, dayIndex: number): string {
  return shiftYmd(startDate, dayIndex);
}

/**
 * A friendly, timezone-safe label for a plan day's date ("Mon Nov 10"). Parses
 * the YYYY-MM-DD parts directly (UTC-safe, like Foods.tsx formatTriedDate) so
 * there is no local-zone drift. Falls back to the raw string if malformed.
 */
export function dayDateLabel(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const monthName = MONTHS_SHORT[month - 1];
  const weekdayName = WEEKDAYS_SHORT[weekday];
  if (monthName === undefined || weekdayName === undefined) return ymd;
  return `${weekdayName} ${monthName} ${day}`;
}

/**
 * Candidate recipes for a slot, ordered ELIGIBLE (non-ghosted) FIRST, then
 * ghosted, each as a RecipeView derived from recipeView() so ghost/door state
 * matches the library (Req 8.3). Candidates are narrowed to the slot's meal
 * type and the child's stage (when known) to mirror the library filters;
 * `stage === null` (no child) keeps every recipe. Ordering within each group
 * preserves the input recipe order (stable sort) for a predictable list.
 */
export function slotCandidates(
  recipes: Recipe[],
  state: AppState,
  meal: MealType,
  stage: StageId | null,
): RecipeView[] {
  const views = recipes
    .filter((r) => r.mealTypes.includes(meal))
    .filter((r) => (stage === null ? true : r.stages.includes(stage)))
    .map((recipe) => recipeView(recipe, state));

  // Stable partition: eligible (non-ghosted) first, ghosted last.
  const eligible = views.filter((v) => !v.isGhosted);
  const ghosted = views.filter((v) => v.isGhosted);
  return [...eligible, ...ghosted];
}
