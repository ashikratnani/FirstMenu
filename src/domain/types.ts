// '9-12' is kept for v1 data and is labeled "9–11 months" (see age.ts).
export type StageId = '6-8' | '9-12' | '12-23' | '24-36';
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
  optional?: boolean;      // "(optional)" in the source; skipped for matching and tags
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
  statedMinutes?: number;  // total time written in the recipe, or set by the user
  notes?: string[];        // pasted lines that are neither ingredients nor steps
  imported?: ImportedInfo; // set only for pasted recipes
  clearedMentions?: ClearedMention[]; // text mentions the user cleared (Req 7.4)
  kind?: 'recipe' | 'simple-idea'; // Req 14.4; default 'recipe'
  serveAs?: ServeAs[];     // Req 16.13
}

export type ServeAs = 'puree' | 'mashed' | 'finger-food' | 'pieces';

export interface ImportedInfo {
  from: 'chatgpt' | 'instagram' | 'shared' | 'other';
  url?: string;            // user-entered, never fetched
  text: string;            // original pasted text (Req 6.8)
  date: string;            // YYYY-MM-DD
}

export interface ClearedMention { ruleId: string; sentence: string }

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
  schemaVersion: 2;
  child?: ChildProfile;
  onboarded: boolean;
  customRecipes: Recipe[];
  foods: Record<string /* food key */, FoodRecord>;
  plan: WeekPlan;
  groceryChecked: string[]; // grocery line keys
  disclaimerAcknowledged: boolean;
  pantry: string[];         // food keys
  onHand: string[];         // food keys
  onHandUpdated?: string;   // YYYY-MM-DD, set whenever onHand changes
  madeLog: MadeLogEntry[];  // newest first, capped at 100
  onHandDays: Record<string /* food key */, string[]>; // distinct YYYY-MM-DD added (last 10)
  dismissed: Record<string /* suggestion id */, string /* ISO time */>;
}

export interface MadeLogEntry { recipeId: string; date: string }
