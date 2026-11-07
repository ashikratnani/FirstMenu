// Grocery list (design.md "Grocery list (grocery.ts)"). Pure TS, no React: it
// lives beside prep.ts/foods.ts and is unit-tested without rendering.
//
// The grocery list is DERIVED (never stored) from the prep cook sessions, so it
// reuses prep.ts's ghosting/session logic rather than re-walking the plan:
//
//   1. computePrepList(plan, recipes, state, ageMonths) gives the cook
//      sessions (ghosted slots already excluded). For each session, resolve its
//      recipe by recipeId and add each ingredient's quantity * session.batches
//      (when a quantity is set).
//   2. Line key = foodKey + '|' + normalizedUnit. foodKeyFor(ingredient) can
//      return MORE THAN ONE food key (an ingredient may map to several allergen
//      groups, e.g. "egg noodles" -> egg AND wheat); the ingredient's quantity
//      is added to EACH returned key's line, so a multi-allergen ingredient
//      shows under every group it counts as. normalizedUnit trims+lowercases
//      the unit ('cup' and 'Cup' merge) with a single no-unit token for
//      missing/empty units. There is NO unit conversion: "1 cup" and "200 g" of
//      the same food stay two lines (Req 10.2).
//   3. Merge quantities across sessions/recipes/ingredients that share a line
//      key. A line with no known quantity is "as needed" (asNeeded, no
//      quantity). A line that mixes known-quantity and no-quantity
//      contributions keeps the known sum AND is flagged asNeeded so the UI can
//      render "<sum> <unit> and more as needed".
//   4. Prep reminders come from the safety screen (screenRecipe), never invented
//      here, and are attached (de-duplicated) to the lines their ingredient
//      contributes to.
//   5. Groups are emitted in the design's FIXED category order, only the
//      non-empty ones, with lines ordered deterministically.
//
// reconcileGroceryChecks keeps only the checked line keys that still exist in a
// freshly computed list (Req 10.5).

import { foodKeyFor, foodLabel } from './foods';
import { computePrepList } from './prep';
import { screenRecipe } from './safety/screen';
import type { AppState, GroceryCategory, Ingredient, Recipe, WeekPlan } from './types';

/**
 * One merged grocery line: all contributions sharing the same food key + unit.
 *
 * Quantity / "as needed" contract (so the page can render exactly three cases):
 *   - no contribution had a quantity  -> quantity undefined, asNeeded true
 *     ("as needed");
 *   - every contribution had a quantity -> quantity set, asNeeded false
 *     ("<quantity> <unit>");
 *   - mixed (some had a quantity, some did not) -> quantity set (the known sum)
 *     AND asNeeded true ("<quantity> <unit> and more as needed").
 * So asNeeded && quantity !== undefined is the "mixed" indicator.
 */
export interface GroceryLine {
  /** foodKey + '|' + normalizedUnit; the stable key persisted in groceryChecked. */
  key: string;
  /** The food part of the key (e.g. 'allergen:egg' or a plain derived key). */
  foodKey: string;
  /** Human-readable food label (foodLabel(foodKey), e.g. 'egg'). */
  label: string;
  /** The display unit (original casing of the first contribution), or undefined. */
  unit?: string;
  /** Summed known quantity, or undefined when nothing contributed a quantity. */
  quantity?: number;
  /** True when the line has no known quantity, or mixes known and unknown. */
  asNeeded: boolean;
  /** The ingredient's grocery category. */
  category: GroceryCategory;
  /** De-duplicated prep reminder messages from the safety screen. */
  reminders: string[];
}

/** A category group of grocery lines. */
export interface GroceryGroup {
  category: GroceryCategory;
  lines: GroceryLine[];
}

/**
 * The design's FIXED grocery display order (design.md "Grocery list"). NOTE:
 * this differs from the GroceryCategory type's declaration order; the design
 * order is authoritative.
 */
export const GROCERY_CATEGORY_ORDER: readonly GroceryCategory[] = [
  'produce',
  'protein',
  'dairy-eggs',
  'grains',
  'pantry',
  'frozen',
  'other',
];

/**
 * A single consistent token standing in for "no unit", so empty/undefined units
 * all merge together while never colliding with a real unit. The pipe is the
 * key separator, so this token contains no pipe.
 */
const NO_UNIT_TOKEN = '';

/**
 * Normalize an ingredient unit for keying: trim + lowercase, mapping
 * empty/undefined to NO_UNIT_TOKEN. So 'cup' and 'Cup' merge, but 'cup' and 'g'
 * do not (no unit conversion, Req 10.2).
 */
function normalizedUnit(unit: string | undefined): string {
  if (unit === undefined) return NO_UNIT_TOKEN;
  const trimmed = unit.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : NO_UNIT_TOKEN;
}

/** Build the line key from a food key and an ingredient unit. */
function lineKey(foodKey: string, unit: string | undefined): string {
  return `${foodKey}|${normalizedUnit(unit)}`;
}

/** Mutable accumulator for one line while merging. */
interface LineAccumulator {
  key: string;
  foodKey: string;
  unit?: string; // display unit (first non-empty casing seen)
  quantitySum: number;
  hasQuantity: boolean; // at least one contribution had a quantity
  hasNoQuantity: boolean; // at least one contribution had no quantity
  category: GroceryCategory;
  reminders: Set<string>;
}

/**
 * Resolve a plan recipe id to a Recipe from the passed list (prep already
 * skipped unknown ids, but sessions carry only the id).
 */
function recipeById(recipes: Recipe[], id: string): Recipe | undefined {
  return recipes.find((r) => r.id === id);
}

/**
 * Collect, per ingredient index of a recipe, the de-duplicated reminder
 * messages the safety screen reports for that recipe at this age. Reminders are
 * the only source of prep wording (never invented here).
 */
function remindersByIngredientIndex(
  recipe: Recipe,
  ageMonths: number,
): Map<number, string[]> {
  const byIndex = new Map<number, string[]>();
  for (const finding of screenRecipe(recipe, ageMonths).reminders) {
    const list = byIndex.get(finding.ingredientIndex);
    if (list === undefined) {
      byIndex.set(finding.ingredientIndex, [finding.message]);
    } else if (!list.includes(finding.message)) {
      list.push(finding.message);
    }
  }
  return byIndex;
}

/**
 * Add one ingredient's contribution (scaled by `batches`) to the accumulators.
 * The ingredient is added to EVERY food key foodKeyFor returns (a multi-allergen
 * ingredient counts under each group).
 */
function addIngredient(
  acc: Map<string, LineAccumulator>,
  ingredient: Ingredient,
  batches: number,
  reminders: string[],
): void {
  const foodKeys = foodKeyFor(ingredient);
  const hasQuantity = ingredient.quantity !== undefined;
  const scaledQuantity = hasQuantity ? (ingredient.quantity as number) * batches : 0;

  for (const foodKey of foodKeys) {
    if (foodKey.length === 0) continue;
    const key = lineKey(foodKey, ingredient.unit);

    let entry = acc.get(key);
    if (entry === undefined) {
      entry = {
        key,
        foodKey,
        unit: undefined,
        quantitySum: 0,
        hasQuantity: false,
        hasNoQuantity: false,
        category: ingredient.category,
        reminders: new Set<string>(),
      };
      acc.set(key, entry);
    }

    // Keep the first non-empty display unit casing we see.
    if (entry.unit === undefined && ingredient.unit !== undefined) {
      const trimmed = ingredient.unit.trim();
      if (trimmed.length > 0) entry.unit = trimmed;
    }

    if (hasQuantity) {
      entry.quantitySum += scaledQuantity;
      entry.hasQuantity = true;
    } else {
      entry.hasNoQuantity = true;
    }

    for (const message of reminders) entry.reminders.add(message);
  }
}

/** Finalize an accumulator into an immutable GroceryLine. */
function toLine(acc: LineAccumulator): GroceryLine {
  const asNeeded = !acc.hasQuantity || acc.hasNoQuantity;
  const line: GroceryLine = {
    key: acc.key,
    foodKey: acc.foodKey,
    label: foodLabel(acc.foodKey),
    asNeeded,
    category: acc.category,
    reminders: Array.from(acc.reminders),
  };
  if (acc.unit !== undefined) line.unit = acc.unit;
  // Keep the known sum whenever any contribution had a quantity (mixed lines
  // keep it too, flagged asNeeded).
  if (acc.hasQuantity) line.quantity = acc.quantitySum;
  return line;
}

/**
 * The derived grocery list for a week plan, grouped by the design's fixed
 * category order (design.md "Grocery list (grocery.ts)").
 *
 * Built on computePrepList so ghosted slots never contribute and quantities
 * scale by each cook session's batch count. Only non-empty groups are returned,
 * in GROCERY_CATEGORY_ORDER; lines within a group are ordered by label then
 * unit for determinism.
 */
export function computeGroceryList(
  plan: WeekPlan,
  recipes: Recipe[],
  state: AppState,
  ageMonths: number,
): GroceryGroup[] {
  const { sessions } = computePrepList(plan, recipes, state, ageMonths);

  const acc = new Map<string, LineAccumulator>();

  for (const session of sessions) {
    const recipe = recipeById(recipes, session.recipeId);
    if (recipe === undefined) continue;
    const reminderIndex = remindersByIngredientIndex(recipe, ageMonths);

    recipe.ingredients.forEach((ingredient, index) => {
      addIngredient(acc, ingredient, session.batches, reminderIndex.get(index) ?? []);
    });
  }

  const lines = Array.from(acc.values()).map(toLine);

  const byCategory = new Map<GroceryCategory, GroceryLine[]>();
  for (const line of lines) {
    const list = byCategory.get(line.category);
    if (list === undefined) {
      byCategory.set(line.category, [line]);
    } else {
      list.push(line);
    }
  }

  const groups: GroceryGroup[] = [];
  for (const category of GROCERY_CATEGORY_ORDER) {
    const categoryLines = byCategory.get(category);
    if (categoryLines === undefined || categoryLines.length === 0) continue;
    categoryLines.sort((a, b) =>
      a.label !== b.label ? a.label.localeCompare(b.label) : a.key.localeCompare(b.key),
    );
    groups.push({ category, lines: categoryLines });
  }

  return groups;
}

/**
 * Flatten grouped grocery lines back into a single list (helper for callers and
 * reconciliation). Preserves group + within-group order.
 */
export function flattenGroceryGroups(groups: GroceryGroup[]): GroceryLine[] {
  return groups.flatMap((group) => group.lines);
}

/**
 * Keep only the checked line keys that still exist in `list` (Req 10.5). `list`
 * may be grouped (GroceryGroup[]) or a flat GroceryLine[]. Pure: returns a new
 * array in the input `checked` order, dropping stale keys and de-duplicating.
 */
export function reconcileGroceryChecks(
  checked: string[],
  list: GroceryGroup[] | GroceryLine[],
): string[] {
  const lines: GroceryLine[] = Array.isArray(list) && isGroupArray(list)
    ? flattenGroceryGroups(list)
    : (list as GroceryLine[]);
  const present = new Set(lines.map((line) => line.key));

  const seen = new Set<string>();
  const kept: string[] = [];
  for (const key of checked) {
    if (!present.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(key);
  }
  return kept;
}

/** Narrow a list to GroceryGroup[] (vs flat GroceryLine[]). */
function isGroupArray(list: GroceryGroup[] | GroceryLine[]): list is GroceryGroup[] {
  return list.length > 0 && 'lines' in list[0];
}
