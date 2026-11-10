// Nutrition tags (design.md, "Nutrition tags"; Requirement 5). Tags show which
// food groups a recipe contains, not how much of a nutrient it provides.
// Pure TS, no React. Tags are computed from required ingredient names, never
// stored, and use the safety screen's whole-token, plural-aware matcher.
//
// Task 4.1: every term below is named in at least one cited source, read on
// 2026-11-09 (CDC archive copies are dated 2023-11-24 and 2024-04-01). A term
// no source names is not kept, because a wrong tag is a wrong claim. The CDC
// pages were read from Internet Archive copies (CDC returns HTTP 403 to the
// build sandbox; re-check against the live pages), and the USDA PDF was read
// directly from its canonical fna.usda.gov URL (the old fns.usda.gov URL
// redirects there).
//
//   CDC-iron (Apr 1, 2024). Heme iron: red meat "such as beef, pork, lamb,
//     goat, or venison", "Seafood and fatty fish", "Poultry, such as chicken or
//     turkey", "Eggs". Non-heme: "Iron-fortified infant cereals", "Tofu",
//     "Beans and lentils", "Dark green leafy vegetables". Vitamin C produce:
//     oranges, broccoli, cabbage, berries, papaya, tomatoes, sweet potatoes.
//     CDC-iron lists tomato, papaya, berries, sweet potato etc. only as "vitamin
//     C-rich fruits and vegetables"; the Fruit/Vegetable split below is our own
//     classification, not the source's.
//   CDC-encourage (Nov 24, 2023). Fruits: bananas, strawberries, pears,
//     oranges, melons, avocados. Vegetables: cooked spinach, carrots, beans,
//     peas, lentils, yams, beets. Whole grains: "whole grain breads, crackers,
//     or pastas". Proteins: beef, lamb, chicken, fish, turkey, eggs, tofu.
//     Dairy: "pasteurized cheeses or yogurts, including soy-based yogurt";
//     milk. Soy beverages are listed as a drink, so "soy milk" is excluded.
//   USDA-FNS-iron (FNS 786E, Mar 2019). Iron-fortified infant cereal, fortified
//     ready-to-eat cereals, leafy green vegetables, chicken, beef, fish, beans;
//     vitamin C: strawberries, tomatoes, cooked red peppers, kiwi, oranges,
//     cooked broccoli.
//
// Terms that rest on the USDA PDF alone (no CDC page names them), with the PDF
// page each was read from (PDF page 1 is printed page 76, PDF page 2 is
// printed page 77): `fortified cereal` (iron-rich; "Fortified ready-to-eat
// cereals", PDF page 1), `kiwi` (fruit; PDF page 2) and `red pepper`
// (vegetable; "Cooked red peppers", PDF page 2). Vegetable and fruit also lean
// on the USDA list for tomato, broccoli, strawberry and orange, but CDC names
// those too.
//
// Dropped from the draft because none of the three sources names them: iron-
// rich liver, salmon, tuna, sardine, chickpea, spinach (as iron), egg yolk
// (egg already matches), infant cereal without "fortified"; protein pork,
// salmon, cod, lentil, bean, chickpea, peanut butter, yogurt; vegetable squash,
// zucchini, cauliflower, potato, corn, kale, plain bell pepper (only "red
// peppers" is named, so only `red pepper` is kept); fruit apple, peach,
// mango, blueberry, raspberry, plum, prune, applesauce; whole grain oat,
// oatmeal, brown rice, quinoa, barley, whole wheat; dairy ricotta.
//
// Task 4.3, healthy fat. None of the three sources above names fat-rich foods
// (avocado is a fruit there). AAP healthychildren.org Starting Solid Foods,
// MyPlate, the WHO IYCF fact sheet and the CDC solid-foods page also had no
// list. The one page found is DGA-2020-2025 (Dietary Guidelines for Americans
// 2020-2025, Chapter 2: Infants and Toddlers, printed page 60), read directly
// from the PDF on 2026-11-10: "The long-chain polyunsaturated fatty acids,
// specifically the essential omega-3 and omega-6 fatty acids supplied through
// seafood, nuts, seeds, and oils, influence the infant's fatty acid status ..."
// (diet of age 6 through 23 months). So the rule has exactly four terms:
// seafood, nut, seed, oil. Salmon, avocado, nut butter and olive oil are not
// named there as fat sources; olive oil still matches through "oil", and nut
// butter through "nut" only when the name has the token "nut".
// Exceptions, same PDF, PDF page 48 (printed page 35), "Oils": "The fat in some
// tropical plants, such as coconut oil, palm kernel oil, and palm oil, are not
// included in the oils category because they contain a higher percentage of
// saturated fat than do other oils." So those three are excluded. Seafood
// seasoning is a spice mix, not seafood, so it is excluded too.

import { matchesTerm } from './safety/normalize';
import type { SourceId } from './safety/rules';
import type { Recipe } from './types';

export type NutritionTag =
  | 'iron-rich'
  | 'protein'
  | 'vegetable'
  | 'fruit'
  | 'whole-grain'
  | 'dairy'
  | 'healthy-fat';

export interface NutritionRule {
  tag: NutritionTag;
  terms: string[];
  except?: string[];
  sources: SourceId[];
}

// Bump when a tag list changes.
export const NUTRITION_VERSION = 2;

const BEAN_EXCEPTIONS = ['green bean', 'jelly bean', 'vanilla bean', 'coffee bean', 'cocoa bean'];

export const NUTRITION_RULES: NutritionRule[] = [
  {
    tag: 'iron-rich',
    terms: [
      'beef', 'lamb', 'pork', 'goat', 'venison', 'chicken', 'turkey', 'fish', 'seafood', 'egg',
      'fortified cereal', 'fortified infant cereal', 'tofu', 'bean', 'lentil', 'leafy green',
    ],
    except: BEAN_EXCEPTIONS,
    sources: ['CDC-iron', 'USDA-FNS-iron'],
  },
  {
    tag: 'protein',
    terms: ['beef', 'lamb', 'chicken', 'turkey', 'fish', 'egg', 'tofu'],
    sources: ['CDC-encourage'],
  },
  {
    tag: 'vegetable',
    terms: [
      'spinach', 'carrot', 'bean', 'pea', 'lentil', 'yam', 'beet', 'sweet potato',
      'broccoli', 'cabbage', 'tomato', 'red pepper',
    ],
    except: ['sweet potato puff', 'jelly bean', 'vanilla bean', 'coffee bean', 'cocoa bean'],
    sources: ['CDC-encourage', 'CDC-iron', 'USDA-FNS-iron'],
  },
  {
    tag: 'fruit',
    terms: ['banana', 'strawberry', 'pear', 'orange', 'melon', 'avocado', 'papaya', 'kiwi', 'berry'],
    except: ['orange juice'],
    sources: ['CDC-encourage', 'CDC-iron', 'USDA-FNS-iron'],
  },
  {
    tag: 'whole-grain',
    terms: ['whole grain'],
    sources: ['CDC-encourage'],
  },
  {
    tag: 'dairy',
    terms: ['yogurt', 'cheese', 'milk'],
    except: ['breast', 'formula', 'peanut', 'almond', 'oat', 'coconut', 'rice', 'soy milk', 'milk chocolate'],
    sources: ['CDC-encourage'],
  },
  {
    tag: 'healthy-fat',
    terms: ['seafood', 'nut', 'seed', 'oil'],
    except: ['nut free', 'oil free', 'coconut oil', 'palm oil', 'palm kernel oil', 'seafood seasoning'],
    sources: ['DGA-2020-2025'],
  },
];

// Tags the requirements name but that no cited source supports, so they have
// no rule and are never assigned. Empty since task 4.3 added healthy fat.
export const UNCONFIRMED_TAGS: NutritionTag[] = [];

const TAG_ORDER: NutritionTag[] = NUTRITION_RULES.map((r) => r.tag);

/** The confirmed terms and exceptions for a tag (empty for an unconfirmed tag). */
export function nutritionTerms(tag: NutritionTag): { terms: string[]; except: string[] } {
  const rule = NUTRITION_RULES.find((r) => r.tag === tag);
  return { terms: rule?.terms ?? [], except: rule?.except ?? [] };
}

function ruleMatches(rule: NutritionRule, name: string): boolean {
  if (rule.except?.some((e) => matchesTerm(name, e))) return false;
  return rule.terms.some((t) => matchesTerm(name, t));
}

/** Tags for a list of ingredients. Optional ingredients are ignored. */
export function nutritionTags(ingredients: Array<{ name: string; optional?: boolean }>): NutritionTag[] {
  const required = ingredients.filter((i) => !i.optional);
  return TAG_ORDER.filter((tag) =>
    NUTRITION_RULES.filter((r) => r.tag === tag).some((rule) =>
      required.some((i) => ruleMatches(rule, i.name)),
    ),
  );
}

export function recipeNutritionTags(recipe: Pick<Recipe, 'ingredients'>): NutritionTag[] {
  return nutritionTags(recipe.ingredients);
}
