// "Type what you have" (design.md, Requirement 16). Free-text search without a
// language model. Fuzzy matching only turns her words into foods; deciding what
// she can make stays exact (make.ts), so a near match never puts a recipe in
// "Ready now" by itself. Pure TS, no React, no network.

import { OTHER_NAMES, STOP_PHRASES, SUGGESTED_PANTRY_NAMES } from '../data/foodNames';
import { SEARCH_PHRASES, type SearchFilter } from '../data/searchPhrases';
import {
  DESCRIPTOR_WORDS,
  PREP_WORDS,
  UNIT_WORDS,
  foodKeyFromName,
  groceryFoodKey,
  isIgnoredFood,
} from './foods';
import { normalize, tokenMatches, tokenize } from './safety/normalize';
import type { Recipe } from './types';

export type { SearchFilter } from '../data/searchPhrases';

export interface FoodSearchResult {
  /** Plain food keys, counted as on hand. */
  foods: string[];
  /** Typo matches, not counted until the user taps one. */
  didYouMean: Array<{ typed: string; food: string }>;
  /** From dish-kind phrases. */
  filters: SearchFilter[];
  /** Words matched against recipe titles. */
  titleWords: string[];
  /** Words (and stop phrases) the app could not place, as typed. */
  unrecognized: string[];
}

type VocabEntry = { tokens: string[]; rank: number } & (
  | { kind: 'food'; food: string }
  | { kind: 'stop' }
  | { kind: 'phrase'; filter: SearchFilter }
);

// Tie-break ranks for entries of equal length.
const RANK_PHRASE = 0;
const RANK_KNOWN_FOOD = 1;
const RANK_NAME = 2;

export interface Vocabulary {
  entries: VocabEntry[];
  /** Single-word known foods and other names, for typo matching. */
  typoCandidates: Array<{ word: string; food: string }>;
  /** Normalized words from recipe titles. */
  titleWords: string[];
}

/** Words dropped at step 5 and ignored for adjacency at step 4 (design.md). */
const BASIC_FILLER = [
  'some', 'any', 'a', 'an', 'the', 'bit', 'of', 'little', 'few', 'half',
  'leftover', 'leftovers', 'fresh', 'frozen', 'cooked', 'raw',
];
const FILLER_WORDS: ReadonlySet<string> = new Set([
  ...BASIC_FILLER,
  ...DESCRIPTOR_WORDS.map((w) => normalize(w)),
  ...PREP_WORDS.map((w) => normalize(w)),
  ...UNIT_WORDS,
]);

/** Request words are dropped too, but they break adjacency at step 4. */
const REQUEST_WORDS: ReadonlySet<string> = new Set([
  'something', 'anything', 'ideas', 'idea', 'for', 'make', 'can', 'i', 'what',
  'to', 'recipe', 'recipes', 'food', 'meal', 'baby', 'toddler', 'kid', 'kids',
]);

function isNumberToken(token: string): boolean {
  return /^[0-9]+$/.test(token);
}

function isRequestWord(token: string): boolean {
  return REQUEST_WORDS.has(token);
}

function isFillerWord(token: string): boolean {
  if (isRequestWord(token)) return false;
  return FILLER_WORDS.has(token) || isNumberToken(token);
}

/** Plural-aware equality of two token lists, either side may be the plural. */
export function sameTokens(a: string[], b: string[]): boolean {
  return (
    a.length === b.length &&
    a.every((t, i) => tokenMatches(t, b[i]) || tokenMatches(b[i], t))
  );
}

/**
 * Every known food, other name, stop phrase and dish-kind phrase the search
 * understands, plus the title words of the recipes. `pantry` adds the user's
 * own pantry foods (food keys).
 */
export function buildVocabulary(recipes: Recipe[], pantry: string[]): Vocabulary {
  const entries: VocabEntry[] = [];
  const typoCandidates: Array<{ word: string; food: string }> = [];
  const seenFoods = new Set<string>();

  const addKnownFood = (key: string): void => {
    if (key.length === 0 || isIgnoredFood(key) || seenFoods.has(key)) return;
    seenFoods.add(key);
    const tokens = tokenize(key);
    if (tokens.length === 0) return;
    entries.push({ kind: 'food', tokens, food: key, rank: RANK_KNOWN_FOOD });
    if (tokens.length === 1) typoCandidates.push({ word: tokens[0], food: key });
  };

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) addKnownFood(groceryFoodKey(ingredient));
  }
  for (const name of SUGGESTED_PANTRY_NAMES) addKnownFood(foodKeyFromName(name));
  for (const key of pantry) addKnownFood(key);
  for (const target of Object.values(OTHER_NAMES)) addKnownFood(target);

  // Other names. An explicit mapping beats a known food spelled the same way,
  // so it is added after (equal-length ties go to the later entry below).
  for (const [name, food] of Object.entries(OTHER_NAMES)) {
    const tokens = tokenize(name);
    entries.push({ kind: 'food', tokens, food, rank: RANK_NAME });
    if (tokens.length === 1) typoCandidates.push({ word: tokens[0], food });
  }
  for (const phrase of STOP_PHRASES) {
    entries.push({ kind: 'stop', tokens: tokenize(phrase), rank: RANK_NAME });
  }
  for (const group of SEARCH_PHRASES) {
    for (const phrase of group.phrases) {
      entries.push({
        kind: 'phrase',
        tokens: tokenize(phrase),
        filter: group.filter,
        rank: RANK_PHRASE,
      });
    }
  }

  const titleWords = new Set<string>();
  for (const recipe of recipes) {
    for (const token of tokenize(recipe.title)) titleWords.add(token);
  }

  return { entries, typoCandidates, titleWords: Array.from(titleWords) };
}

/** Damerau-Levenshtein distance (optimal string alignment). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    d.push(new Array<number>(b.length + 1).fill(0));
    d[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[a.length][b.length];
}

/** Allowed typo distance: 0 under 4 letters, 1 for 4 to 7, 2 for 8 or more. */
function allowedDistance(word: string): number {
  if (word.length < 4) return 0;
  return word.length < 8 ? 1 : 2;
}

// What a segment turns into after the longest-match pass (step 3).
type Item =
  | { type: 'food'; food: string }
  | { type: 'stop'; text: string }
  | { type: 'phrase'; filter: SearchFilter }
  | { type: 'token'; token: string };

/** Step 1 and 2: normalize and split into segments of tokens. */
function toSegments(text: string): string[][] {
  const cleaned = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-'\u2019]/g, ' ')
    .replace(/[,;\n\r+&]/g, ' | ')
    .replace(/[^a-z0-9|]+/g, ' ');
  const segments: string[][] = [[]];
  for (const token of cleaned.split(/\s+/)) {
    if (token === '') continue;
    if (token === '|' || token === 'and' || token === 'with') {
      segments.push([]);
    } else {
      segments[segments.length - 1].push(token);
    }
  }
  return segments.filter((s) => s.length > 0);
}

/** Step 3: one longest-match pass over the tokens as typed. */
function longestMatchPass(tokens: string[], vocabulary: Vocabulary): Item[] {
  const items: Item[] = [];
  let i = 0;
  while (i < tokens.length) {
    let best: VocabEntry | undefined;
    for (const entry of vocabulary.entries) {
      const n = entry.tokens.length;
      if (i + n > tokens.length) continue;
      // Longest first. On a tie a food or other name beats a phrase, and an
      // other name (or stop phrase) beats a known food spelled the same way.
      if (best !== undefined) {
        if (n < best.tokens.length) continue;
        if (n === best.tokens.length && entry.rank < best.rank) continue;
      }
      let all = true;
      for (let k = 0; k < n; k++) {
        if (!tokenMatches(tokens[i + k], entry.tokens[k])) {
          all = false;
          break;
        }
      }
      if (all) best = entry;
    }
    if (best === undefined) {
      items.push({ type: 'token', token: tokens[i] });
      i += 1;
      continue;
    }
    const n = best.tokens.length;
    if (best.kind === 'food') items.push({ type: 'food', food: best.food });
    else if (best.kind === 'stop') items.push({ type: 'stop', text: tokens.slice(i, i + n).join(' ') });
    else items.push({ type: 'phrase', filter: best.filter });
    i += n;
  }
  return items;
}

/** Filters that can describe a food next to them ("mashed banana"). */
function isDescriptorFilter(filter: SearchFilter): boolean {
  return filter.startsWith('form:') || filter === 'quick' || filter === 'easy' || filter.startsWith('tag:');
}

/**
 * Step 4: a descriptor phrase next to a food (ignoring only filler words in
 * between) or next to another descriptor that is already dropped describes that
 * food and is not a filter. A request word or anything else breaks adjacency.
 */
function droppedDescriptors(items: Item[]): Set<number> {
  const dropped = new Set<number>();
  const significant = (from: number, step: number): number => {
    for (let k = from; k >= 0 && k < items.length; k += step) {
      const item = items[k];
      if (item.type === 'token' && isFillerWord(item.token)) continue;
      return k;
    }
    return -1;
  };
  let changed = true;
  while (changed) {
    changed = false;
    items.forEach((item, index) => {
      if (item.type !== 'phrase' || !isDescriptorFilter(item.filter) || dropped.has(index)) return;
      for (const neighbor of [significant(index - 1, -1), significant(index + 1, 1)]) {
        if (neighbor < 0) continue;
        if (items[neighbor].type === 'food' || dropped.has(neighbor)) {
          dropped.add(index);
          changed = true;
          return;
        }
      }
    });
  }
  return dropped;
}

function titleWordMatches(token: string, vocabulary: Vocabulary): boolean {
  return vocabulary.titleWords.some((w) => tokenMatches(token, w) || tokenMatches(w, token));
}

/** Step 7: the single closest food within the allowed distance, if unique. */
function typoMatch(token: string, vocabulary: Vocabulary): string | undefined {
  const allowed = allowedDistance(token);
  if (allowed === 0) return undefined;
  const bestByFood = new Map<string, number>();
  for (const { word, food } of vocabulary.typoCandidates) {
    const distance = editDistance(token, word);
    if (distance > allowed) continue;
    const previous = bestByFood.get(food);
    if (previous === undefined || distance < previous) bestByFood.set(food, distance);
  }
  if (bestByFood.size === 0) return undefined;
  const smallest = Math.min(...bestByFood.values());
  const winners = Array.from(bestByFood).filter(([, d]) => d === smallest);
  return winners.length === 1 ? winners[0][0] : undefined;
}

function pushUnique<T>(list: T[], value: T, same: (a: T, b: T) => boolean = (a, b) => a === b): void {
  if (!list.some((existing) => same(existing, value))) list.push(value);
}

/** Turn typed text into foods, filters, title words and leftovers. */
export function searchHave(text: string, vocabulary: Vocabulary): FoodSearchResult {
  const result: FoodSearchResult = {
    foods: [],
    didYouMean: [],
    filters: [],
    titleWords: [],
    unrecognized: [],
  };

  for (const tokens of toSegments(text)) {
    const items = longestMatchPass(tokens, vocabulary);
    const dropped = droppedDescriptors(items);

    items.forEach((item, index) => {
      switch (item.type) {
        case 'food':
          pushUnique(result.foods, item.food);
          return;
        case 'stop':
          pushUnique(result.unrecognized, item.text);
          return;
        case 'phrase':
          if (!dropped.has(index)) pushUnique(result.filters, item.filter);
          return;
        case 'token': {
          const token = item.token;
          // Step 5: filler words, request words and numbers are dropped.
          if (isFillerWord(token) || isRequestWord(token)) return;
          // Step 6: title words.
          if (token.length >= 4 && titleWordMatches(token, vocabulary)) {
            pushUnique(result.titleWords, token);
            return;
          }
          // Step 7: typo matching.
          const food = typoMatch(token, vocabulary);
          if (food !== undefined) {
            pushUnique(result.didYouMean, { typed: token, food }, (a, b) => a.typed === b.typed);
            return;
          }
          // Step 8.
          pushUnique(result.unrecognized, token);
        }
      }
    });
  }

  return result;
}
