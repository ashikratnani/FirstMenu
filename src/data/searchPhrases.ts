// Dish-kind phrases for "Type what you have" (design.md, Requirement 16.9).
// Pure data. Each phrase list turns into one filter. Phrases are stored
// normalized ("iron rich", not "iron-rich"; "puree", not "purée"). "Vegetable"
// and "fruit" are left out on purpose: recipes use them as food names.

import type { MealType } from '../domain/types';

/** A search filter id. `tag:<tag>` uses the NutritionTag ids from nutrition.ts. */
export type SearchFilter =
  | `meal:${MealType}`
  | 'form:finger-food'
  | 'form:puree'
  | 'form:mashed'
  | 'quick'
  | 'easy'
  | `tag:${string}`
  | 'freezer';

export interface SearchPhraseGroup {
  filter: SearchFilter;
  phrases: readonly string[];
}

export const SEARCH_PHRASES: readonly SearchPhraseGroup[] = [
  { filter: 'meal:breakfast', phrases: ['breakfast'] },
  { filter: 'meal:lunch', phrases: ['lunch'] },
  { filter: 'meal:dinner', phrases: ['dinner', 'supper'] },
  { filter: 'meal:snack', phrases: ['snack', 'snacks'] },
  {
    filter: 'form:finger-food',
    phrases: [
      'finger food',
      'finger foods',
      'self feeding',
      'baby led',
      'blw',
      'pick up',
      'bites',
    ],
  },
  { filter: 'form:puree', phrases: ['puree', 'smooth', 'blended'] },
  { filter: 'form:mashed', phrases: ['mash', 'mashed', 'mushy'] },
  { filter: 'quick', phrases: ['quick', 'fast', 'in a hurry', 'under 15 minutes'] },
  { filter: 'easy', phrases: ['easy', 'simple', 'no fuss'] },
  { filter: 'tag:iron-rich', phrases: ['iron', 'iron rich'] },
  { filter: 'tag:protein', phrases: ['protein'] },
  { filter: 'tag:vegetable', phrases: ['veggie', 'veggies'] },
  { filter: 'tag:fruit', phrases: ['fruity'] },
  { filter: 'tag:whole-grain', phrases: ['whole grain'] },
  {
    filter: 'freezer',
    phrases: ['make ahead', 'freeze', 'freezer', 'batch', 'batch cook'],
  },
];

/** Chip labels for filters. */
export const FILTER_LABELS: Readonly<Record<string, string>> = {
  'meal:breakfast': 'Breakfast',
  'meal:lunch': 'Lunch',
  'meal:dinner': 'Dinner',
  'meal:snack': 'Snack',
  'form:finger-food': 'Finger food',
  'form:puree': 'Puree',
  'form:mashed': 'Mashed',
  quick: 'Quick',
  easy: 'Easy',
  'tag:iron-rich': 'Iron-rich',
  'tag:protein': 'Protein',
  'tag:vegetable': 'Veggie',
  'tag:fruit': 'Fruity',
  'tag:whole-grain': 'Whole grain',
  freezer: 'Make ahead',
};
