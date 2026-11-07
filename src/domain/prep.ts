// Prep list (design.md "Prep list (prep.ts)"). Pure TS, no React: it lives
// beside plan.ts/foods.ts and is unit-tested without rendering.
//
// For each recipe used in the plan's NON-GHOSTED active slots this module turns
// the week into a short list of cook sessions plus thaw reminders:
//
//   1. servingsNeeded = number of active slots that use the recipe.
//   2. useDays = the day offsets of those uses from prepDate (prep day = 0;
//      because prepDate defaults to startDate - 1, plan day 0 is usually
//      offset 1). One entry per slot occurrence, sorted ascending, so a recipe
//      used N times contributes N servings (repeats are kept).
//   3. Schedule, exactly per design.md:
//      (a) fridge-only: storage.fridgeDays is set AND every use offset <=
//          fridgeDays -> ONE cook session on the prep day covering all
//          servings, store 'fridge'.
//      (b) freezer: else storage.freezerMonths is set -> ONE cook session on
//          the prep day covering all servings; uses whose offset <= fridgeDays
//          (missing fridgeDays treated as 0) stay in the fridge, the rest are
//          frozen in single portions, and for EACH frozen use a ThawReminder is
//          emitted on the day BEFORE that use. The session store is 'freezer'
//          when any portion is frozen, else 'fridge'.
//      (c) cook-fresh: else group uses greedily -> start a session on the first
//          remaining use day, cover every remaining use within fridgeDays of
//          that start (or only the same day when fridgeDays is unset), repeat
//          until all uses are scheduled; each session store is 'serve' with its
//          date set to the YYYY-MM-DD of that session's start use day.
//   4. batches per session = ceil(servingsInSession / recipe.servings), with
//      recipe.servings <= 0 guarded to 1 so batches is never 0 or negative.
//
// GHOSTED slots are excluded: a recipe is ghosted when the safety screen
// reports a block OR an ingredient food has a recorded 'reaction'. That rule is
// NOT duplicated here — it is the shared isRecipeGhosted helper exported from
// plan.ts (the same rule recipeView.ts uses for the UI).
//
// All date math uses shiftYmd / UTC parsing from plan.ts, so there is no
// local-timezone drift. Output is sorted deterministically (by date then
// recipeId) so the same plan always yields the same list.

import type { AppState, Recipe, WeekPlan } from './types';
import { isRecipeGhosted, shiftYmd } from './plan';

/** One batch-cook session on a single day for one recipe. */
export interface CookSession {
  /** YYYY-MM-DD the session is cooked on. */
  date: string;
  /** The recipe cooked. */
  recipeId: string;
  /** Number of batches to cook (ceil(servingsInSession / recipe.servings)). */
  batches: number;
  /** Where the cooked food is kept until served. */
  store: 'fridge' | 'freezer' | 'serve';
}

/** A reminder to thaw a frozen portion, on the day before it is used. */
export interface ThawReminder {
  /** YYYY-MM-DD, the day before a frozen-portion use. */
  date: string;
  /** The recipe whose portion to thaw. */
  recipeId: string;
}

/** The derived prep list for a week plan. Never stored; always computed. */
export interface PrepList {
  sessions: CookSession[];
  thawReminders: ThawReminder[];
}

// ---------------------------------------------------------------------------
// Date math (mirrors plan.ts: parse via Date.UTC, no local-timezone drift)
// ---------------------------------------------------------------------------

/** Parse a YYYY-MM-DD string into UTC epoch milliseconds at midnight. */
function utcMillis(date: string): number {
  const [year, month, day] = date.split('-').map((part) => Number(part));
  return Date.UTC(year, month - 1, day);
}

/** Whole-day difference `a - b` for two YYYY-MM-DD strings (UTC, DST-safe). */
function dayDiff(a: string, b: string): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((utcMillis(a) - utcMillis(b)) / MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// Use collection
// ---------------------------------------------------------------------------

/** A single planned use of a recipe: its plan day index and offset from prep. */
interface RecipeUse {
  /** Plan day index 0..6. */
  dayIndex: number;
  /** YYYY-MM-DD of the use day (shiftYmd(startDate, dayIndex)). */
  date: string;
  /** Whole-day offset of the use from prepDate (prep day = 0). */
  offset: number;
}

/** Resolve a plan recipe id to a Recipe from the passed list. */
function recipeById(recipes: Recipe[], id: string): Recipe | undefined {
  return recipes.find((r) => r.id === id);
}

/**
 * Collect, per recipe id, every non-ghosted active-slot use with its day index,
 * date and offset-from-prep. One entry per slot occurrence so servings counts
 * repeats. Each recipe's uses are returned sorted by offset ascending (then
 * dayIndex) for a deterministic greedy grouping.
 */
function collectUses(
  plan: WeekPlan,
  recipes: Recipe[],
  state: AppState,
  ageMonths: number,
): Map<string, RecipeUse[]> {
  const uses = new Map<string, RecipeUse[]>();

  plan.days.forEach((day, dayIndex) => {
    for (const meal of plan.activeSlots) {
      const recipeId = day[meal];
      if (recipeId === undefined) continue;
      const recipe = recipeById(recipes, recipeId);
      if (recipe === undefined) continue; // skip unknown ids
      if (isRecipeGhosted(recipe, state, ageMonths)) continue; // skip ghosted

      const date = shiftYmd(plan.startDate, dayIndex);
      const offset = dayDiff(date, plan.prepDate);
      const list = uses.get(recipeId);
      const use: RecipeUse = { dayIndex, date, offset };
      if (list === undefined) {
        uses.set(recipeId, [use]);
      } else {
        list.push(use);
      }
    }
  });

  for (const list of uses.values()) {
    list.sort((a, b) => (a.offset !== b.offset ? a.offset - b.offset : a.dayIndex - b.dayIndex));
  }

  return uses;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

/** Batches to cook for `servings` servings of `recipe` (guard servings <= 0). */
function batchesFor(recipe: Recipe, servings: number): number {
  const perBatch = recipe.servings > 0 ? recipe.servings : 1;
  return Math.ceil(servings / perBatch);
}

/**
 * Schedule one recipe's uses into cook sessions (+ thaw reminders), appending
 * into the shared output arrays. Implements design.md cases (a) fridge-only,
 * (b) freezer with per-use thaw reminders, (c) cook-fresh greedy grouping.
 */
function scheduleRecipe(
  recipe: Recipe,
  plan: WeekPlan,
  uses: RecipeUse[],
  sessions: CookSession[],
  thawReminders: ThawReminder[],
): void {
  const servingsNeeded = uses.length;
  if (servingsNeeded === 0) return;

  const fridgeDays = recipe.storage?.fridgeDays;
  const freezerMonths = recipe.storage?.freezerMonths;

  // (a) fridge-only: fridgeDays set and every use within it -> one prep-day
  // session holding everything in the fridge.
  if (fridgeDays !== undefined && uses.every((u) => u.offset <= fridgeDays)) {
    sessions.push({
      date: plan.prepDate,
      recipeId: recipe.id,
      batches: batchesFor(recipe, servingsNeeded),
      store: 'fridge',
    });
    return;
  }

  // (b) freezer: one prep-day session; uses within fridgeDays stay in the
  // fridge, the rest are frozen single portions with a day-before thaw.
  if (freezerMonths !== undefined) {
    const fridgeWindow = fridgeDays ?? 0;
    let anyFrozen = false;
    for (const use of uses) {
      if (use.offset > fridgeWindow) {
        anyFrozen = true;
        thawReminders.push({ date: shiftYmd(use.date, -1), recipeId: recipe.id });
      }
    }
    sessions.push({
      date: plan.prepDate,
      recipeId: recipe.id,
      batches: batchesFor(recipe, servingsNeeded),
      store: anyFrozen ? 'freezer' : 'fridge',
    });
    return;
  }

  // (c) cook-fresh: greedily group uses. Start a session on the first remaining
  // use day and cover every remaining use within fridgeDays of that start (or
  // only the same day when fridgeDays is unset). The session is cooked and
  // served from the fridge over its window, so store is 'serve'.
  let index = 0;
  while (index < uses.length) {
    const start = uses[index];
    const window = fridgeDays ?? 0;
    let servingsInSession = 0;
    while (index < uses.length && uses[index].offset - start.offset <= window) {
      servingsInSession += 1;
      index += 1;
    }
    sessions.push({
      date: start.date,
      recipeId: recipe.id,
      batches: batchesFor(recipe, servingsInSession),
      store: 'serve',
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The derived prep list for a week plan (design.md "Prep list (prep.ts)").
 * Considers only `plan.activeSlots`, resolves recipe ids via `recipes`
 * (unknown ids skipped), and EXCLUDES any slot whose recipe is ghosted via the
 * shared isRecipeGhosted(recipe, state, ageMonths) helper from plan.ts.
 *
 * Returns cook sessions and thaw reminders sorted by date ascending then
 * recipeId, so the same inputs always produce the same output.
 */
export function computePrepList(
  plan: WeekPlan,
  recipes: Recipe[],
  state: AppState,
  ageMonths: number,
): PrepList {
  const usesByRecipe = collectUses(plan, recipes, state, ageMonths);

  const sessions: CookSession[] = [];
  const thawReminders: ThawReminder[] = [];

  for (const [recipeId, uses] of usesByRecipe) {
    const recipe = recipeById(recipes, recipeId);
    if (recipe === undefined) continue;
    scheduleRecipe(recipe, plan, uses, sessions, thawReminders);
  }

  const byDateThenRecipe = (
    a: { date: string; recipeId: string },
    b: { date: string; recipeId: string },
  ): number =>
    a.date !== b.date ? a.date.localeCompare(b.date) : a.recipeId.localeCompare(b.recipeId);

  sessions.sort(byDateThenRecipe);
  thawReminders.sort(byDateThenRecipe);

  return { sessions, thawReminders };
}
