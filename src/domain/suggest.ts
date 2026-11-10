// Smart suggestions (design.md "Smart suggestions", Requirement 17). Pure TS,
// no React. Every rule is a function of state, the recipe list and `now`, so
// tests use a fixed clock. Nothing here writes state: the reducer actions
// (markMade, recordOnHandDay, dismissSuggestion, keepOnHand) do that after a tap.
//
// Not here yet: the "Iron-rich" tag comes from nutrition.ts (open PR), so
// scoring takes an optional `ironRich` predicate instead of importing it.

import type { MakeResult } from './make';
import { foodKeyFor, foodLabel, isIgnoredFood } from './foods';
import { isOptional } from './effort';
import { NEW_FOOD_SPACING_DAYS } from './safety/rules';
import type { AppState, MadeLogEntry, MealType, Recipe } from './types';

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;
export const STALE_ON_HAND_DAYS = 3;
export const MADE_LOG_CAP = 100;
export const MAKE_AGAIN_LIMIT = 5;
export const PANTRY_LEARNING_DAYS = 3;
/** "Made in the last 2 days" counts today, yesterday and the day before. */
export const MADE_RECENTLY_DAYS = 2;

/** The device's local calendar date for `now`, as YYYY-MM-DD. */
export function localYmd(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = from.split('-').map(Number);
  const b = to.split('-').map(Number);
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Dismissals (Requirements 17.2, 17.9)
// ---------------------------------------------------------------------------

export const MEAL_HINT_ID = 'meal-hint';
export const NEW_FOOD_ID = 'new-food';
export const STALE_ON_HAND_ID = 'stale-on-hand';
export const MAKE_AGAIN_ID = 'make-again';
export const tryThisId = (recipeId: string) => `try-this:${recipeId}`;
export const pantryId = (foodKey: string) => `pantry:${foodKey}`;

/** Hours a dismissal hides a suggestion; `Infinity` is permanent ("No thanks"). */
export function dismissalHours(id: string): number {
  if (id === MEAL_HINT_ID) return 4;
  if (id.startsWith('pantry:')) return Infinity;
  return 24;
}

/**
 * True while `dismissed[id]` still hides the suggestion at `now`. A missing or
 * unparseable time is not dismissed. The stale on-hand prompt also comes back
 * once the on-hand list has changed since the dismissal (`onHandUpdated` is a
 * later day than the dismissal).
 */
export function isDismissed(
  dismissed: AppState['dismissed'],
  id: string,
  now: Date,
  onHandUpdated?: string,
): boolean {
  const at = dismissed[id];
  if (at === undefined) return false;
  const when = Date.parse(at);
  if (Number.isNaN(when)) return false;
  if (
    id === STALE_ON_HAND_ID &&
    onHandUpdated !== undefined &&
    onHandUpdated > localYmd(new Date(when))
  ) {
    return false;
  }
  return now.getTime() - when < dismissalHours(id) * HOUR_MS;
}

// ---------------------------------------------------------------------------
// Time-of-day meal hint
// ---------------------------------------------------------------------------

/**
 * Local time: 05:00 to 10:29 breakfast, 10:30 to 13:59 lunch, 14:00 to 16:59
 * snack, 17:00 to 20:59 dinner, otherwise none.
 */
export function mealHintFor(now: Date): MealType | undefined {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes >= 5 * 60 && minutes < 10 * 60 + 30) return 'breakfast';
  if (minutes >= 10 * 60 + 30 && minutes < 14 * 60) return 'lunch';
  if (minutes >= 14 * 60 && minutes < 17 * 60) return 'snack';
  if (minutes >= 17 * 60 && minutes < 21 * 60) return 'dinner';
  return undefined;
}

/** The hint to show: the time-of-day meal unless its chip was dismissed under 4 hours ago. */
export function mealHint(dismissed: AppState['dismissed'], now: Date): MealType | undefined {
  if (isDismissed(dismissed, MEAL_HINT_ID, now)) return undefined;
  return mealHintFor(now);
}

export function mealHintReason(meal: MealType): string {
  return `It's ${meal} time`;
}

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

// ---------------------------------------------------------------------------
// Stale on-hand (Requirement 17.3)
// ---------------------------------------------------------------------------

/** On-hand is not empty and was last changed more than 3 days before today. */
export function staleOnHandDays(
  state: Pick<AppState, 'onHand' | 'onHandUpdated' | 'dismissed'>,
  now: Date,
): number | undefined {
  if (state.onHand.length === 0 || state.onHandUpdated === undefined) return undefined;
  if (isDismissed(state.dismissed, STALE_ON_HAND_ID, now, state.onHandUpdated)) return undefined;
  const days = daysBetween(state.onHandUpdated, localYmd(now));
  return days > STALE_ON_HAND_DAYS ? days : undefined;
}

export function staleOnHandReason(days: number): string {
  return `Last updated ${days} days ago`;
}

// ---------------------------------------------------------------------------
// Untried foods and scoring
// ---------------------------------------------------------------------------

/**
 * Food keys of a recipe's required ingredients that have no food record
 * (untried). De-duplicated, in order. Recorded reactions are not "untried":
 * such a recipe is ghosted and never reaches the suggestions.
 */
export function untriedFoods(recipe: Recipe, foods: AppState['foods']): string[] {
  const keys: string[] = [];
  for (const ingredient of recipe.ingredients) {
    if (isOptional(ingredient)) continue;
    for (const key of foodKeyFor(ingredient)) {
      if (key.length === 0 || isIgnoredFood(key)) continue;
      if (foods[key] !== undefined || keys.includes(key)) continue;
      keys.push(key);
    }
  }
  return keys;
}

export interface SuggestContext {
  now: Date;
  /** The meal hint to rank by; already `undefined` when its chip is dismissed. */
  mealHint?: MealType;
  madeLog: MadeLogEntry[];
  foods: AppState['foods'];
  /** Iron-rich tag (nutrition.ts); absent means no recipe scores it. */
  ironRich?: (recipe: Recipe) => boolean;
}

interface Scored {
  result: MakeResult;
  score: number;
  /** The rules that scored, in table order, e.g. ["10 min", "Breakfast"]. */
  reasons: string[];
}

function madeRecently(recipeId: string, madeLog: MadeLogEntry[], now: Date): boolean {
  const today = localYmd(now);
  return madeLog.some((entry) => {
    if (entry.recipeId !== recipeId) return false;
    const age = daysBetween(entry.date, today);
    return age >= 0 && age <= MADE_RECENTLY_DAYS;
  });
}

function score(result: MakeResult, ctx: SuggestContext): Scored {
  let points = 0;
  const reasons: string[] = [];
  if (ctx.mealHint !== undefined && result.recipe.mealTypes.includes(ctx.mealHint)) {
    points += 3;
    reasons.push(MEAL_LABEL[ctx.mealHint]);
  }
  if (result.minutes !== undefined && result.minutes <= 15) {
    points += 2;
    reasons.push(`${result.minutes} min`);
  }
  if (result.effort === 'easy') {
    points += 1;
    reasons.push('Easy');
  }
  if (ctx.ironRich?.(result.recipe) === true) {
    points += 1;
    reasons.push('Iron-rich');
  }
  if (madeRecently(result.recipe.id, ctx.madeLog, ctx.now)) points -= 3;
  return { result, score: points, reasons };
}

function byScore(a: Scored, b: Scored): number {
  return b.score - a.score || a.result.recipe.title.localeCompare(b.result.recipe.title);
}

// ---------------------------------------------------------------------------
// Try this (Requirement 17.1)
// ---------------------------------------------------------------------------

export interface TryThisPick {
  result: MakeResult;
  score: number;
  /** Set when the recipe has one untried food (food key). */
  newFood?: string;
  /** "Why this?" text, e.g. "Ready now · 10 min · Breakfast · Iron-rich". */
  reason: string;
}

export interface TryThisContext extends SuggestContext {
  /**
   * The food the new-food banner names, or undefined when no new food is due
   * or the banner is dismissed (then a new food counts as not due).
   */
  newFoodKey?: string;
  dismissed?: AppState['dismissed'];
}

/**
 * Allowed Try this picks, best first (ties by title). `results` is every
 * Ready now result (never ghosted). The sole-recipe rule counts all of them
 * before any filtering or dismissal. "Show another" walks down the list.
 */
export function pickTryThis(results: MakeResult[], ctx: TryThisContext): TryThisPick[] {
  const sole = results.length === 1;
  const picks: Array<Scored & { newFood?: string }> = [];

  for (const result of results) {
    const untried = untriedFoods(result.recipe, ctx.foods);
    if (untried.length >= 2) continue;
    let newFood: string | undefined;
    if (untried.length === 1) {
      newFood = untried[0];
      const allowed = ctx.newFoodKey !== undefined ? newFood === ctx.newFoodKey : sole;
      if (!allowed) continue;
    }
    if (
      ctx.dismissed !== undefined &&
      isDismissed(ctx.dismissed, tryThisId(result.recipe.id), ctx.now)
    ) {
      continue;
    }
    picks.push({ ...score(result, ctx), newFood });
  }

  picks.sort(byScore);
  return picks.map((p) => {
    const parts = ['Ready now', ...p.reasons];
    if (p.newFood !== undefined) parts.unshift(`Has a new food: ${foodLabel(p.newFood)}`);
    return { result: p.result, score: p.score, newFood: p.newFood, reason: parts.join(' · ') };
  });
}

// ---------------------------------------------------------------------------
// New food due (Requirement 17.4)
// ---------------------------------------------------------------------------

export interface NewFoodStatus {
  due: boolean;
  /** Days since the newest food record; undefined when none is recorded. */
  daysSince?: number;
  /** "Why this?" text. */
  reason: string;
}

/**
 * Due when the newest record (tried or reaction, so a reaction restarts the
 * wait) is at least NEW_FOOD_SPACING_DAYS before today, or none exists.
 */
export function newFoodStatus(foods: AppState['foods'], now: Date): NewFoodStatus {
  const dates = Object.values(foods).map((r) => r.date).sort();
  if (dates.length === 0) {
    return { due: true, reason: 'No new foods recorded yet' };
  }
  const daysSince = daysBetween(dates[dates.length - 1], localYmd(now));
  return {
    due: daysSince >= NEW_FOOD_SPACING_DAYS,
    daysSince,
    reason: `${NEW_FOOD_SPACING_DAYS}+ days since the last new food`,
  };
}

export interface NewFoodSuggestion {
  result: MakeResult;
  /** The one untried food key. */
  food: string;
  reason: string;
}

/**
 * The "Ready for a new food?" banner: the best-scoring Ready now or Missing
 * one recipe with exactly one untried food (allergen or not). `candidates` is
 * those two groups, never ghosted. Undefined when not due, dismissed, or none.
 */
export function pickNewFood(
  candidates: MakeResult[],
  dismissed: AppState['dismissed'],
  ctx: SuggestContext,
): NewFoodSuggestion | undefined {
  const status = newFoodStatus(ctx.foods, ctx.now);
  if (!status.due || isDismissed(dismissed, NEW_FOOD_ID, ctx.now)) return undefined;
  const options = candidates
    .map((result) => ({ scored: score(result, ctx), untried: untriedFoods(result.recipe, ctx.foods) }))
    .filter((o) => o.untried.length === 1);
  options.sort((a, b) => byScore(a.scored, b.scored));
  const best = options[0];
  if (best === undefined) return undefined;
  return { result: best.scored.result, food: best.untried[0], reason: status.reason };
}

// ---------------------------------------------------------------------------
// Make again (Requirement 17.5)
// ---------------------------------------------------------------------------

export interface MakeAgainItem {
  recipe: Recipe;
  /** Most recent date it was made, YYYY-MM-DD. */
  date: string;
  reason: string;
}

/**
 * Up to 5 distinct recipes from the made log, newest first, skipping recipes
 * that no longer exist and ghosted ones. Hidden for 24 hours once dismissed.
 */
export function makeAgainList(
  madeLog: MadeLogEntry[],
  recipes: Recipe[],
  isGhosted: (recipe: Recipe) => boolean,
  dismissed: AppState['dismissed'] = {},
  now: Date = new Date(),
): MakeAgainItem[] {
  if (isDismissed(dismissed, MAKE_AGAIN_ID, now)) return [];
  const items: MakeAgainItem[] = [];
  const seen = new Set<string>();
  const sorted = [...madeLog].sort((a, b) => b.date.localeCompare(a.date));
  for (const entry of sorted) {
    if (seen.has(entry.recipeId)) continue;
    seen.add(entry.recipeId);
    const recipe = recipes.find((r) => r.id === entry.recipeId);
    if (recipe === undefined || isGhosted(recipe)) continue;
    items.push({ recipe, date: entry.date, reason: `Made on ${entry.date}` });
    if (items.length === MAKE_AGAIN_LIMIT) break;
  }
  return items;
}

// ---------------------------------------------------------------------------
// Pantry learning (Requirement 17.6)
// ---------------------------------------------------------------------------

export interface PantrySuggestion {
  food: string;
  reason: string;
}

/**
 * Foods added to on-hand on 3 or more different days that are not in the
 * pantry and whose "No thanks" is unset. Ordered by most days, then name.
 */
export function pantrySuggestions(
  state: Pick<AppState, 'onHandDays' | 'pantry' | 'dismissed'>,
): PantrySuggestion[] {
  return Object.entries(state.onHandDays)
    .filter(
      ([key, days]) =>
        days.length >= PANTRY_LEARNING_DAYS &&
        !state.pantry.includes(key) &&
        state.dismissed[pantryId(key)] === undefined,
    )
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([food, days]) => ({ food, reason: `Added on ${days.length} different days` }));
}

// ---------------------------------------------------------------------------
// Made log (used by the markMade reducer action)
// ---------------------------------------------------------------------------

/** Prepend `{ recipeId, date }`: one entry per recipe per day, newest first, capped at 100. */
export function addMadeEntry(
  madeLog: MadeLogEntry[],
  recipeId: string,
  date: string,
): MadeLogEntry[] {
  if (madeLog.some((e) => e.recipeId === recipeId && e.date === date)) return madeLog;
  return [{ recipeId, date }, ...madeLog].slice(0, MADE_LOG_CAP);
}
