// Main foods, plates and art safety (design.md "Food art (Requirement 21)",
// "Main foods and plates"). Pure TS, no React. A recipe's plate is the first
// three of its main foods that are safe to draw. The safety code is reused
// unchanged: this module only asks the screen which rules match.

import {
  CHOKING_SHAPE_PICTURES,
  FOOD_PICTURES,
  pictureFor,
  type FoodGroup,
  type FoodPictureEntry,
} from '../data/foodPictures';
import { groceryFoodKey, isIgnoredFood } from './foods';
import { tokenMatches, tokenize } from './safety/normalize';
import { screenIngredient } from './safety/screen';
import type { Recipe } from './types';

/**
 * Rules whose matching foods are never drawn on a plate (Requirement 21.6).
 * Each applies from age 0 (none has `fromMonths`), so art safety never changes
 * as the child grows.
 */
export const PLATE_HIDDEN_RULE_IDS = [
  'choking-no-safe-form',
  'grapes',
  'cherry-tomato',
  'cherries',
  'small-round-fruit',
  'sausages',
  'whole-nuts',
] as const;

/** Most foods on one plate. */
export const PLATE_MAX_FOODS = 3;

/**
 * Terms for staples: a food key whose last words are one of these is left off
 * plates (it stays on the Foods page). Compared word by word with the safety
 * matcher's plural-aware `tokenMatches`.
 */
export const PLATE_STAPLES: readonly string[] = [
  // cooking fats ('butter' has an exception below)
  'oil', 'cooking spray', 'margarine', 'butter',
  'salt',
  // sweeteners
  'sugar', 'honey', 'syrup', 'molasses',
  // herbs and spices
  'spice', 'seasoning', 'herb', 'herbs de provence', 'herb de provence', 'black pepper',
  'white pepper', 'pepper flake', 'cayenne', 'cinnamon', 'nutmeg', 'cumin', 'paprika',
  'oregano', 'garlic powder', 'onion powder', 'ginger', 'ginger root', 'basil', 'thyme',
  'dill', 'parsley', 'cilantro', 'mint', 'rosemary', 'sage', 'bay leaf', 'turmeric',
  'chili powder', 'curry powder', 'coriander', 'clove', 'allspice', 'mustard seed',
  // aromatics
  'onion', 'garlic',
  // baking items
  'flour', 'baking powder', 'baking soda', 'vanilla', 'extract', 'cornstarch',
  // cooking liquids
  'broth', 'stock', 'soup', 'soup mix', 'bouillon', 'vinegar', 'lemon juice', 'lime juice',
  // condiments
  'sauce', 'salsa', 'ketchup', 'mustard', 'mayonnaise', 'dressing', 'relish', 'paste',
];

/** A word before "butter" that makes it a main food (peanut butter, apple butter). */
const BUTTER_MAIN_WORDS: readonly string[] = [
  'peanut', 'almond', 'cashew', 'sunflower', 'seed', 'nut', 'apple',
];

export interface PlateFood {
  key: string;
  /** File name in public/art/foods/ without ".webp". */
  picture: string;
  group: FoodGroup;
}

/** True when the key's last words are a staple term (design step 2). */
function isStaple(key: string): boolean {
  const words = tokenize(key);
  return PLATE_STAPLES.some((term) => {
    const termWords = tokenize(term);
    if (termWords.length === 0 || termWords.length > words.length) return false;
    const tail = words.slice(words.length - termWords.length);
    if (!termWords.every((w, i) => tokenMatches(tail[i], w))) return false;
    if (term === 'butter') {
      const before = words.slice(0, words.length - 1);
      return !before.some((w) => BUTTER_MAIN_WORDS.some((m) => tokenMatches(w, m)));
    }
    return true;
  });
}

interface MainFood {
  key: string;
  /** Every ingredient name that gave this key, as written. */
  names: string[];
}

function mainFoodEntries(recipe: Recipe): MainFood[] {
  const entries: MainFood[] = [];
  const byKey = new Map<string, MainFood>();
  for (const ingredient of recipe.ingredients) {
    if (ingredient.optional) continue;
    const key = groceryFoodKey(ingredient);
    if (key === '' || isIgnoredFood(key) || isStaple(key)) continue;
    const existing = byKey.get(key);
    if (existing) {
      existing.names.push(ingredient.name);
      continue;
    }
    const entry = { key, names: [ingredient.name] };
    byKey.set(key, entry);
    entries.push(entry);
  }
  return entries;
}

/** Plain food keys of a recipe's main foods, in ingredient order, each once. */
export function mainFoods(recipe: Recipe): string[] {
  return mainFoodEntries(recipe).map((entry) => entry.key);
}

/** Does a plate-hidden rule match this text at age 0? */
function hiddenByRule(text: string): boolean {
  return screenIngredient(text, 0).some((finding) =>
    (PLATE_HIDDEN_RULE_IDS as readonly string[]).includes(finding.ruleId),
  );
}

/**
 * The foods drawn on a recipe's plate: at most 3; an empty list means the
 * generic bowl alone. `isNotYet(key)` leaves a Not yet food off the plate; a
 * Not yet recipe passes `() => false` and greys its whole plate instead.
 * `map` is the picture map (tests pass their own).
 */
export function plateFoods(
  recipe: Recipe,
  isNotYet: (key: string) => boolean,
  map: Record<string, FoodPictureEntry> = FOOD_PICTURES,
): PlateFood[] {
  const plate: PlateFood[] = [];
  const shown = new Set<string>();
  for (const { key, names } of mainFoodEntries(recipe)) {
    if (plate.length >= PLATE_MAX_FOODS) break;
    if ([...names, key].some(hiddenByRule)) continue;
    const { picture, group } = pictureFor(key, map);
    if (CHOKING_SHAPE_PICTURES.has(picture)) continue;
    if (shown.has(picture)) continue;
    if (isNotYet(key)) continue;
    shown.add(picture);
    plate.push({ key, picture, group });
  }
  return plate;
}

/** The band color's group: the first plate food's group, or `other` for an empty plate. */
export function plateGroup(
  recipe: Recipe,
  isNotYet: (key: string) => boolean,
  map: Record<string, FoodPictureEntry> = FOOD_PICTURES,
): FoodGroup {
  return plateFoods(recipe, isNotYet, map)[0]?.group ?? 'other';
}
