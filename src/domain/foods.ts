// Foods and first tastes (design.md "Foods and first tastes (foods.ts)").
// Pure TS, no React. Derives the "food" an ingredient counts as (allergens are
// grouped), collects the set of foods across recipes, and reports each food's
// status (mystery door / friendly monster / friendly ghost) for the child.
//
// Food keys:
//   - allergen foods are keyed `allergen:<group>` (an ingredient can map to
//     MORE THAN ONE group, e.g. "egg noodles" -> egg AND wheat);
//   - every other food gets a plain lowercase key derived from its name.
// All matching reuses the same normalize/matchesTerm the safety screen uses so
// a food lines up with the rules (and with Task 7's onboarding keys).

import type { AllergenGroup, AppState, Ingredient, Recipe } from './types';
import { matchesTerm, normalize } from './safety/normalize';
import { RULES, type SafetyRule } from './safety/rules';
import { screenIngredient } from './safety/screen';

// Re-export the allergen-door guidance that lives next to the rules
// (design.md: the Requirement 7.7 text "lives next to the rules"), so the
// Foods page imports everything food-related from this module.
export {
  allergenGuidance,
  ALLERGEN_GENERIC_GUIDANCE,
  ALLERGEN_PEANUT_NOTE,
  type AllergenGuidance,
} from './safety/rules';

/** Prefix for allergen food keys, e.g. `allergen:peanut`. */
export const ALLERGEN_KEY_PREFIX = 'allergen:';

/** Build the food key for an allergen group (`allergen:<group>`). */
export function allergenKey(group: AllergenGroup): string {
  return `${ALLERGEN_KEY_PREFIX}${group}`;
}

/** The allergen rules from the shared rule table (kind === 'allergen'). */
const ALLERGEN_RULES: SafetyRule[] = RULES.filter(
  (rule): rule is SafetyRule & { allergenGroup: AllergenGroup } =>
    rule.kind === 'allergen' && rule.allergenGroup !== undefined,
);

/**
 * Descriptor words dropped when deriving a food key from a name (design.md
 * "Foods and first tastes"). "low sodium" is a two-word phrase handled before
 * the single-word list. Kept here as the single source of truth.
 */
export const DESCRIPTOR_WORDS: readonly string[] = [
  'fresh',
  'frozen',
  'ripe',
  'cooked',
  'raw',
  'chopped',
  'diced',
  'mashed',
  'pureed',
  'grated',
  'ground',
  'organic',
  'plain',
  'whole',
  'unsalted',
  'canned',
  'small',
  'medium',
  'large',
  'baby',
];

/** The two-word descriptor phrase, stripped before single-word descriptors. */
const DESCRIPTOR_PHRASES: readonly string[] = ['low sodium'];

/** Unit-like tokens dropped from derived keys (Ingredient.unit vocabulary). */
const UNIT_WORDS: ReadonlySet<string> = new Set([
  'g',
  'kg',
  'mg',
  'ml',
  'l',
  'oz',
  'lb',
  'lbs',
  'tbsp',
  'tsp',
  'cup',
  'cups',
  'piece',
  'pieces',
  'pinch',
  'jar',
  'jars',
  'can',
  'cans',
]);

/**
 * Foods that are never shown as a mystery door (design.md: water, breast milk,
 * formula, ice). Detection runs on the SAME derived key path, so both
 * "breast milk" and the single-token "breastmilk" that the recipe name
 * "breastmilk, water or prepared formula" derives to are ignored.
 */
const IGNORED_FOODS: ReadonlySet<string> = new Set([
  'water',
  'breast milk',
  'breastmilk',
  'formula',
  'ice',
]);

/** True when `key` is an ignored food that must never appear as a door. */
export function isIgnoredFood(key: string): boolean {
  return IGNORED_FOODS.has(key);
}

/** Does `rule` fire on `name` by terms, honoring its `except` list (as the
 * screen's ruleFires does)? Age and rule kind are not considered here. */
function allergenRuleFires(rule: SafetyRule, name: string): boolean {
  if (rule.except && rule.except.some((term) => matchesTerm(name, term))) {
    return false;
  }
  return rule.terms.some((term) => matchesTerm(name, term));
}

/**
 * Reverse the plural-aware matching in normalize.ts to get a stable singular
 * key token: "carrots" -> "carrot", "potatoes" -> "potato", "berries" ->
 * "berry". Mirrors tokenMatches' `s` / `es` / `ies` forms. Short tokens and
 * "ss" endings (e.g. "grass") are left alone.
 */
function singularizeToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith('ies')) return token.slice(0, -3) + 'y';
  if (/(oes|xes|ches|shes|sses|zes)$/.test(token)) return token.slice(0, -2);
  if (token.endsWith('ss')) return token;
  if (token.endsWith('s')) return token.slice(0, -1);
  return token;
}

/** A token made only of digits / decimal numbers (a quantity)? */
function isNumberToken(token: string): boolean {
  return /^[0-9]+(?:\.[0-9]+)?$/.test(token);
}

/**
 * Derive a plain food key from a free-text ingredient name. Normalizes, keeps
 * only the part before the first comma (recipe names append preparation notes
 * after a comma, e.g. "carrots, peeled and sliced"), drops the "low sodium"
 * phrase, then drops descriptor words, quantity/number tokens and unit tokens,
 * singularizes the remaining tokens and collapses whitespace.
 */
function deriveKeyFromName(name: string): string {
  // Keep text before the first comma so "medium apple, peeled, cored and
  // quartered" -> "medium apple" before descriptor stripping.
  const beforeComma = name.split(',')[0] ?? name;
  let text = normalize(beforeComma);

  // Strip two-word descriptor phrases first (normalized, space-collapsed).
  for (const phrase of DESCRIPTOR_PHRASES) {
    const n = normalize(phrase);
    text = text.replace(new RegExp(`(^| )${n}( |$)`, 'g'), ' ');
  }

  const descriptors = new Set(DESCRIPTOR_WORDS.map((w) => normalize(w)));
  const tokens = text
    .split(' ')
    .filter((t) => t.length > 0)
    .filter((t) => !descriptors.has(t))
    .filter((t) => !isNumberToken(t))
    .filter((t) => !UNIT_WORDS.has(t))
    .map((t) => singularizeToken(t));

  return tokens.join(' ').trim();
}

/**
 * The food(s) an ingredient counts as for first tastes.
 *
 * Return contract: ALWAYS an array of keys (possibly length 1), because an
 * ingredient can map to more than one allergen group ("egg noodles" ->
 * ["allergen:egg", "allergen:wheat"]). Non-allergen foods return a single-key
 * array.
 *
 * Precedence (design.md "Foods and first tastes"):
 *   1. If ANY allergen rule fires on the name (terms honoring `except`, exactly
 *      as the screen matches), the keys are `allergen:<group>` for EACH firing
 *      group, sorted for determinism. The allergen check is FIRST, so it wins
 *      even when `ingredient.food` is set.
 *   2. Else if `ingredient.food` is set, use it as an authoritative "counts as"
 *      override (trimmed + lowercased for a stable key; not otherwise
 *      normalized so a deliberate override reads back as written).
 *   3. Else derive from `ingredient.name` (see deriveKeyFromName).
 */
export function foodKeyFor(ingredient: Ingredient): string[] {
  const name = ingredient.name;

  // 1. Allergen rules first (can match multiple groups).
  const groups = ALLERGEN_RULES.filter((rule) => allergenRuleFires(rule, name))
    .map((rule) => rule.allergenGroup as AllergenGroup);
  if (groups.length > 0) {
    const keys = Array.from(new Set(groups.map((g) => allergenKey(g))));
    keys.sort();
    return keys;
  }

  // 2. Explicit "counts as" override.
  if (ingredient.food !== undefined && ingredient.food.trim().length > 0) {
    return [ingredient.food.trim().toLowerCase()];
  }

  // 3. Derive from the name.
  return [deriveKeyFromName(name)];
}

/**
 * The set of foods shown on the Foods page: every ingredient of every passed
 * recipe, mapped through foodKeyFor, flattened over multi-group results, with
 * ignored foods and empty keys removed, deduplicated. Returns keys in
 * first-seen order (stable across runs for a fixed recipe set).
 *
 * Req 7.1 scope: pass BUILTIN_RECIPES plus state.customRecipes. The caller
 * (Foods page) then UNIONs the result with any keys already recorded in
 * state.foods (see {@link allFoodKeys}) so an onboarding-tried food with no
 * recipe still shows its door.
 */
export function collectFoods(recipes: Recipe[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      for (const key of foodKeyFor(ingredient)) {
        if (key.length === 0) continue;
        if (isIgnoredFood(key)) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        ordered.push(key);
      }
    }
  }

  return ordered;
}

/**
 * All food keys the Foods page shows: collectFoods(recipes) UNIONed with every
 * key already recorded in state.foods (ignored foods still excluded). This
 * keeps an onboarding-tried food visible even if no recipe uses it. Recipe
 * keys come first (in first-seen order); extra recorded keys follow (sorted).
 */
export function allFoodKeys(recipes: Recipe[], state: AppState): string[] {
  const fromRecipes = collectFoods(recipes);
  const seen = new Set(fromRecipes);
  const extra = Object.keys(state.foods)
    .filter((key) => !seen.has(key) && !isIgnoredFood(key))
    .sort();
  return [...fromRecipes, ...extra];
}

/** A food's status for the child (design.md "Foods and first tastes"). */
export type FoodStatus = 'ghost' | 'monster' | 'door';

/**
 * Turn a food key back into a representative name the safety screen can read.
 * Allergen keys (`allergen:<group>`) are never block-covered (allergen rules
 * never block), so they screen as an empty name; plain keys screen by their
 * derived name directly.
 */
function screenableName(key: string): string {
  if (key.startsWith(ALLERGEN_KEY_PREFIX)) return '';
  return key;
}

/**
 * True when a BLOCK rule covers this food at `ageMonths`, computed off the real
 * screen (not a hardcoded food list): screening the food's representative name
 * yields at least one block finding.
 */
export function isBlockCovered(key: string, ageMonths: number): boolean {
  const name = screenableName(key);
  if (name.length === 0) return false;
  return screenIngredient(name, ageMonths).some((f) => f.kind === 'block');
}

/**
 * Status of a food for the child at an age (design.md "Foods and first
 * tastes"):
 *   - `ghost` if a block rule covers it for this age OR a `reaction` is
 *     recorded in state.foods[key];
 *   - `monster` if state.foods[key].status === 'tried';
 *   - otherwise `door`.
 *
 * Precedence: a block or a recorded reaction makes it a ghost, which takes
 * priority over a tried/monster record (a food tried earlier that later gets a
 * reaction shows as a ghost).
 */
export function foodStatus(
  key: string,
  state: AppState,
  ageMonths: number,
): FoodStatus {
  const record = state.foods[key];
  if (isBlockCovered(key, ageMonths) || record?.status === 'reaction') {
    return 'ghost';
  }
  if (record?.status === 'tried') return 'monster';
  return 'door';
}
