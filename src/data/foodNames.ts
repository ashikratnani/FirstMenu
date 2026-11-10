// Other English names for foods (design.md, "Type what you have", Requirement
// 16.3). Pure data. Names are stored in the normalized form the search uses
// (lowercase, no accents, no hyphens or apostrophes). Targets are food keys
// exactly as `groceryFoodKey` stores them ("beef", not "ground beef"), which a
// test checks. The list is extended as recipes are added.

/** Typed name -> known food key. */
export const OTHER_NAMES: Readonly<Record<string, string>> = {
  mince: 'beef',
  'minced beef': 'beef',
  'ground meat': 'beef',
  'hamburger meat': 'beef',
  'minced chicken': 'chicken',
  courgette: 'zucchini',
  aubergine: 'eggplant',
  brinjal: 'eggplant',
  garbanzo: 'chickpea',
  'garbanzo bean': 'chickpea',
  chana: 'chickpea',
  yoghurt: 'yogurt',
  dahi: 'yogurt',
  // "bean curd" and "lemon curd" are longer entries, so they win over "curd".
  curd: 'yogurt',
  capsicum: 'bell pepper',
  pepper: 'bell pepper',
  // Keeps "black pepper" from reading as "pepper" (longest match wins).
  'black pepper': 'black pepper',
  'coriander leaf': 'cilantro',
  'coriander leaves': 'cilantro',
  rocket: 'arugula',
  swede: 'rutabaga',
  bhindi: 'okra',
  'bean curd': 'tofu',
  'porridge oats': 'oat',
  'rolled oats': 'oat',
  'quick oats': 'oat',
  'quick cooking oats': 'oat',
  'old fashioned oats': 'oat',
  'iron fortified cereal': 'cereal',
  'iron fortified infant cereal': 'cereal',
  'baby cereal': 'cereal',
  'whole grain bread': 'bread',
  'whole wheat bread': 'bread',
  'smooth peanut butter': 'peanut butter',
  'creamy peanut butter': 'peanut butter',
  maize: 'corn',
  sweetcorn: 'corn',
  'spring onion': 'green onion',
  scallion: 'green onion',
  beetroot: 'beet',
  prawn: 'shrimp',
  // "cottage cheese" is deliberately not mapped: in Indian English it can mean
  // paneer, so it is shown as "cottage cheese".
};

/**
 * Stop phrases consume their words without adding a food. They are listed under
 * "Not recognized" so the user sees they were not counted.
 */
export const STOP_PHRASES: readonly string[] = ['lemon curd', 'ladyfinger', 'lady finger'];

/**
 * Names of the suggested pantry list (design.md "Suggested pantry list"):
 * household staples. Each passes through `foodKeyFromName` for its food key.
 * The Make screen adds common built-in recipe ingredients to this list.
 */
export const SUGGESTED_PANTRY_NAMES: readonly string[] = [
  'oats',
  'rice',
  'infant cereal',
  'flour',
  'egg',
  'butter',
  'plain yogurt',
  'milk',
  'olive oil',
  'cinnamon',
  'frozen peas',
  'banana',
];
