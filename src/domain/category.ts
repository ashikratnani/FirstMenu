// Grocery category guess for pasted recipes (design.md, "Grocery category guess").
// First match wins. Matching reuses the safety helpers, so terms are whole-token
// phrases with plural-aware equality ("peas" matches "pea", "butternut" does not
// match "butter", "eggplant" does not match "egg"). Pure TS, no React.

import { termMatchesTokens, tokenize } from './safety/normalize';
import type { GroceryCategory } from './types';

const FROZEN = ['frozen'];

// Nutrition Dairy terms (design.md) plus `egg`, `butter`, and `buttermilk`
// (one token in recipes, so it needs its own entry).
const MILK_TERMS = ['milk', 'buttermilk'];
const DAIRY_TERMS = ['yogurt', 'cheese', 'cottage cheese', 'ricotta', ...MILK_TERMS, 'butter', 'egg'];
// Same list as the Dairy tag's "Except" column: these make a name a plant
// alternative or infant milk, not dairy.
const PLANT_QUALIFIERS = ['peanut', 'almond', 'oat', 'soy', 'coconut', 'rice'];
const INFANT_QUALIFIERS = ['breast', 'formula'];

const PROTEIN_TERMS = [
  'beef', 'lamb', 'pork', 'chicken', 'turkey', 'liver', 'ham', 'bacon', 'sausage',
  'fish', 'salmon', 'tuna', 'sardine', 'cod', 'shrimp', 'crab', 'tofu',
  'lentil', 'bean', 'chickpea', 'steak',
];
// Names containing "bean" that are not protein: green bean is a vegetable
// (produce), vanilla bean is a spice (pantry, via `vanilla`), jelly bean is candy.
const PROTEIN_EXCEPTIONS = ['green bean', 'vanilla bean', 'jelly bean'];

const GRAIN_TERMS = [
  'rice', 'oat', 'flour', 'pasta', 'noodle', 'bread', 'oatmeal', 'cereal', 'quinoa', 'barley', 'cracker',
];

// Nutrition Vegetable and Fruit terms (design.md), with their exceptions.
const PRODUCE_TERMS = [
  'sweet potato', 'carrot', 'pea', 'broccoli', 'squash', 'spinach', 'zucchini', 'cauliflower',
  'green bean', 'potato', 'corn', 'tomato', 'kale', 'beet', 'bell pepper',
  'apple', 'banana', 'pear', 'peach', 'mango', 'avocado', 'blueberry', 'strawberry',
  'raspberry', 'plum', 'papaya', 'kiwi', 'prune', 'applesauce',
];
const PRODUCE_EXCEPTIONS = ['sweet potato puff', 'apple juice'];

const PANTRY_TERMS = [
  'oil', 'cinnamon', 'cumin', 'nutmeg', 'ginger', 'garlic powder', 'paprika', 'oregano',
  'baking powder', 'baking soda', 'vanilla',
];

function has(tokens: string[], term: string): boolean {
  return termMatchesTokens(tokens, tokenize(term));
}

function hasAny(tokens: string[], terms: string[]): boolean {
  return terms.some((t) => has(tokens, t));
}

// "egg-free noodles" is not an egg: drop each "<word> free" pair before matching.
// "dairy free" is reported separately: such a name is a dairy alternative, not dairy.
function withoutFreeFrom(tokens: string[]): { tokens: string[]; dairyFree: boolean } {
  const out: string[] = [];
  let dairyFree = false;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i + 1] === 'free') {
      if (tokens[i] === 'dairy') dairyFree = true;
      i++;
      continue;
    }
    out.push(tokens[i]);
  }
  return { tokens: out, dairyFree };
}

// Remove each occurrence of the given phrases (whole-token, plural-aware).
function withoutPhrases(tokens: string[], phrases: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const hit = phrases.map(tokenize).find((p) => termMatchesTokens(tokens.slice(i, i + p.length), p));
    if (hit) {
      i += hit.length - 1;
      continue;
    }
    out.push(tokens[i]);
  }
  return out;
}

export function guessCategory(name: string): GroceryCategory {
  const { tokens, dairyFree } = withoutFreeFrom(tokenize(name));
  if (tokens.length === 0) return 'other';

  // 1. frozen
  if (hasAny(tokens, FROZEN)) return 'frozen';

  // 2. dairy and eggs
  if (hasAny(tokens, DAIRY_TERMS)) {
    if (hasAny(tokens, INFANT_QUALIFIERS)) return 'other';
    // "dairy-free milk" is a plant alternative: same treatment as plant milks.
    if (dairyFree) return hasAny(tokens, [...MILK_TERMS, 'butter']) ? 'pantry' : 'other';
    if (hasAny(tokens, PLANT_QUALIFIERS)) {
      // Plant milks and nut/seed butters are shelf-stable. Return now so the
      // grain and produce rules do not claim "oat milk" or "rice milk".
      return hasAny(tokens, [...MILK_TERMS, 'butter']) ? 'pantry' : 'other';
    }
    return 'dairy-eggs';
  }

  // 3. protein
  // Only the exception phrase is ignored, so "chicken and green beans" is still protein.
  if (hasAny(withoutPhrases(tokens, PROTEIN_EXCEPTIONS), PROTEIN_TERMS)) return 'protein';

  // 4. grains
  if (hasAny(tokens, GRAIN_TERMS)) return 'grains';

  // 5. produce
  if (hasAny(tokens, PRODUCE_TERMS) && !hasAny(tokens, PRODUCE_EXCEPTIONS)) return 'produce';

  // 6. pantry
  if (hasAny(tokens, PANTRY_TERMS)) return 'pantry';

  // 7. otherwise
  return 'other';
}
