import { describe, expect, it } from 'vitest';
import {
  CHOKING_SHAPE_PICTURES,
  FOOD_PICTURES,
  GROUP_PICTURES,
  pictureFor,
} from './foodPictures';
import { BUILTIN_RECIPES } from './recipes';
import { ALLERGEN_KEY_PREFIX, collectFoods, foodKeyFromName, groceryFoodKey } from '../domain/foods';
import { blockRuleFoods } from '../domain/safety/rules';


const plainKeys = new Set(
  BUILTIN_RECIPES.flatMap((r) => r.ingredients.map(groceryFoodKey)).filter((k) => k !== ''),
);
const foodsPageKeys = new Set(collectFoods(BUILTIN_RECIPES));
const blockKeys = new Set(blockRuleFoods().map((f) => f.key));

describe('food picture map: coverage', () => {
  it('has an entry for every plain food key a built-in recipe uses', () => {
    const missing = [...plainKeys].filter((k) => !(k in FOOD_PICTURES));
    expect(missing).toEqual([]);
  });

  it('has an entry for every Foods page key, including the allergen keys', () => {
    const missing = [...foodsPageKeys].filter((k) => !(k in FOOD_PICTURES));
    expect(missing).toEqual([]);
    expect([...foodsPageKeys].some((k) => k.startsWith(ALLERGEN_KEY_PREFIX))).toBe(true);
  });

  it('has an entry for every block-rule food', () => {
    expect(blockKeys.size).toBeGreaterThanOrEqual(8);
    const missing = [...blockKeys].filter((k) => !(k in FOOD_PICTURES));
    expect(missing).toEqual([]);
  });

  it('has an entry for all nine allergen groups', () => {
    for (const group of ['egg', 'dairy', 'wheat', 'peanut', 'fish', 'shellfish', 'soy', 'sesame', 'tree nuts']) {
      expect(FOOD_PICTURES[`${ALLERGEN_KEY_PREFIX}${group}`], group).toBeDefined();
    }
  });

  it('lists the form foodKeyFromName makes for each built-in "Counts as" override', () => {
    const overrides = new Set(
      BUILTIN_RECIPES.flatMap((r) => r.ingredients)
        .filter((i) => i.food !== undefined && i.food.trim() !== '')
        .map((i) => i.food!.trim().toLowerCase()),
    );
    expect(overrides.size).toBeGreaterThan(0);
    const missing = [...overrides].map(foodKeyFromName).filter((k) => k !== '' && !(k in FOOD_PICTURES));
    expect(missing).toEqual([]);
    expect(FOOD_PICTURES['asparagu']).toEqual(FOOD_PICTURES['asparagus']);
    expect(FOOD_PICTURES['couscou']).toEqual(FOOD_PICTURES['couscous']);
  });

  it('can reach every key in the map', () => {
    const unreachable = Object.keys(FOOD_PICTURES).filter(
      (k) =>
        !plainKeys.has(k) &&
        !foodsPageKeys.has(k) &&
        !blockKeys.has(k) &&
        !k.startsWith(ALLERGEN_KEY_PREFIX) &&
        foodKeyFromName(k) !== k,
    );
    expect(unreachable).toEqual([]);
  });
});

describe('food picture map: lookup', () => {
  it('uses exact keys only: egg noodle does not borrow the egg picture', () => {
    expect(FOOD_PICTURES['egg']?.picture).toBe('egg');
    expect(pictureFor('egg noodle').picture).toBe('bowl_with_spoon');
    expect(pictureFor('chicken broth').picture).toBe('jar');
  });

  it('gives a food that is not in the map the other group and the generic bowl', () => {
    expect(pictureFor('dragon fruit')).toEqual({ group: 'other', picture: 'bowl_with_spoon', own: false });
    expect(pictureFor('constructor')).toEqual({ group: 'other', picture: 'bowl_with_spoon', own: false });
  });

  it('gives a food with no own picture its group picture', () => {
    expect(pictureFor('tofu')).toEqual({ group: 'protein', picture: 'bowl_with_spoon', own: false });
    expect(pictureFor('black pepper')).toEqual({ group: 'pantry', picture: 'jar', own: false });
  });

  it('shares a picture between keys that are the same food', () => {
    expect(pictureFor('ground beef').picture).toBe(pictureFor('beef').picture);
    expect(pictureFor('brown rice').picture).toBe(pictureFor('rice').picture);
    expect(pictureFor('sweet potato').picture).toBe('roasted_sweet_potato');
  });

  it('does not give a related but different food the picture', () => {
    expect(pictureFor('peanut butter').own).toBe(false);
    expect(pictureFor('yogurt').own).toBe(false);
    expect(pictureFor('allergen:soy').own).toBe(false);
    expect(pictureFor('allergen:tree nuts').own).toBe(false);
    expect(pictureFor('allergen:sesame').own).toBe(false);
  });

  it('maps the allergen keys to a common food in the group', () => {
    expect(pictureFor('allergen:egg').picture).toBe('egg');
    expect(pictureFor('allergen:dairy').picture).toBe('glass_of_milk');
    expect(pictureFor('allergen:wheat').picture).toBe('bread');
    expect(pictureFor('allergen:peanut').picture).toBe('peanuts');
    expect(pictureFor('allergen:fish').picture).toBe('fish');
    expect(pictureFor('allergen:shellfish').picture).toBe('shrimp');
  });

  it('puts the group pictures on the jar and the bowl', () => {
    expect(GROUP_PICTURES.pantry).toBe('jar');
    expect(Object.values(GROUP_PICTURES).filter((p) => p === 'bowl_with_spoon')).toHaveLength(6);
  });

  it('has exactly the ten choking-shape pictures', () => {
    expect([...CHOKING_SHAPE_PICTURES].sort()).toEqual(
      ['blueberries', 'candy', 'cherries', 'chestnut', 'grapes', 'hot_dog', 'lollipop', 'olive', 'peanuts', 'popcorn'],
    );
  });
});
