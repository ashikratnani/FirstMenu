export type StageId = '6-8' | '9-12';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type GroceryCategory = 'produce' | 'dairy-eggs' | 'protein' | 'grains' | 'pantry' | 'frozen' | 'other';

// The nine allergen groups used by the allergen-rules table (design.md).
export type AllergenGroup =
  | 'peanut'
  | 'egg'
  | 'dairy'
  | 'tree nuts'
  | 'soy'
  | 'wheat'
  | 'fish'
  | 'shellfish'
  | 'sesame';

export interface Ingredient {
  name: string;            // free text, the only input to the safety screen
  food?: string;           // "counts as" food key override; derived if absent
  quantity?: number;
  unit?: string;           // 'g', 'ml', 'tbsp', 'tsp', 'cup', 'piece', ...
  category: GroceryCategory;
}

export interface Recipe {
  id: string;              // 'b-...' for built-in, uuid for custom
  origin: 'builtin' | 'custom';
  source?: RecipeSource;   // required for built-in recipes
  title: string;
  stages: StageId[];
  mealTypes: MealType[];
  ingredients: Ingredient[];
  steps: string[];
  texture: string;         // e.g. "smooth puree", "soft finger strips"
  servings: number;        // servings one batch makes
  storage?: { fridgeDays?: number; freezerMonths?: number };
  makeAheadNote?: string;
}

export interface RecipeSource {
  title: string;           // the recipe's title at the source
  publisher: string;       // e.g. "Minnesota Department of Health, WIC Program"
  url: string;
  retrieved: string;       // YYYY-MM-DD
  adaptations: string[];   // e.g. ["Water instead of apple juice"]; empty if unchanged
  storageSource?: string;  // URL for fridge/freezer times if not from the recipe itself
}

export interface ChildProfile { name?: string; birthDate: string /* YYYY-MM-DD */ }

export interface FoodRecord {
  status: 'tried' | 'reaction';
  date: string;            // YYYY-MM-DD
  note?: string;
}

export interface WeekPlan {
  startDate: string;       // YYYY-MM-DD
  prepDate: string;        // default startDate - 1 day
  activeSlots: MealType[];
  days: Array<Partial<Record<MealType, string /* recipe id */>>>; // length 7
}

export interface AppState {
  schemaVersion: 1;
  child?: ChildProfile;
  onboarded: boolean;
  customRecipes: Recipe[];
  foods: Record<string /* food key */, FoodRecord>;
  plan: WeekPlan;
  groceryChecked: string[]; // grocery line keys
  disclaimerAcknowledged: boolean;
}
