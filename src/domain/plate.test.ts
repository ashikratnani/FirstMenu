import { describe, expect, it } from 'vitest';
import {
  PLATE_HIDDEN_RULE_IDS,
  mainFoods,
  plateFoods,
  plateGroup,
} from './plate';
import { BUILTIN_RECIPES } from '../data/recipes';
import { CHOKING_SHAPE_PICTURES, pictureFor, type FoodPictureEntry } from '../data/foodPictures';
import { RULES } from './safety/rules';
import { screenIngredient } from './safety/screen';
import { groceryFoodKey } from './foods';
import type { Ingredient, Recipe } from './types';

const never: (key: string) => boolean = () => false;

function ing(name: string, extra: Partial<Ingredient> = {}): Ingredient {
  return { name, category: 'produce', ...extra };
}

function recipe(ingredients: Ingredient[]): Recipe {
  return {
    id: 'r1',
    origin: 'custom',
    title: 'Test',
    stages: ['9-12'],
    mealTypes: ['lunch'],
    ingredients,
    steps: ['Mix.'],
    texture: 'soft',
    servings: 1,
  };
}

const keysOf = (r: Recipe, isNotYet = never, map?: Record<string, FoodPictureEntry>) =>
  plateFoods(r, isNotYet, map).map((f) => f.key);

describe('mainFoods', () => {
  it('keeps ingredient order and each food once', () => {
    const r = recipe([ing('carrot'), ing('pear'), ing('carrots, sliced')]);
    expect(mainFoods(r)).toEqual(['carrot', 'pear']);
  });

  it('skips optional ingredients and ignored foods', () => {
    const r = recipe([ing('water'), ing('breast milk'), ing('formula'), ing('pear', { optional: true }), ing('carrot')]);
    expect(mainFoods(r)).toEqual(['carrot']);
  });

  it('skips staples', () => {
    const r = recipe([
      ing('olive oil'), ing('salt'), ing('garlic'), ing('chicken broth'), ing('cinnamon'),
      ing('tomato sauce'), ing('butter'), ing('lemon juice'), ing('honey'), ing('black pepper'),
      ing('cooking spray'), ing('all-purpose flour'), ing('carrot'),
    ]);
    expect(mainFoods(r)).toEqual(['carrot']);
  });

  it('keeps butter a staple but nut and seed butters main foods', () => {
    expect(mainFoods(recipe([ing('butter')]))).toEqual([]);
    expect(mainFoods(recipe([ing('unsalted butter')]))).toEqual([]);
    expect(mainFoods(recipe([ing('peanut butter')]))).toEqual(['peanut butter']);
    expect(mainFoods(recipe([ing('almond butter')]))).toEqual(['almond butter']);
    expect(mainFoods(recipe([ing('sunflower seed butter')]))).toEqual(['sunflower seed butter']);
    expect(mainFoods(recipe([ing('apple butter')]))).toEqual(['apple butter']);
  });

  it('compares the last words of the key, so vanilla yogurt is a main food', () => {
    expect(mainFoods(recipe([ing('vanilla yogurt')]))).toEqual(['vanilla yogurt']);
    expect(mainFoods(recipe([ing('cinnamon applesauce')]))).toEqual(['cinnamon applesauce']);
    expect(mainFoods(recipe([ing('vanilla extract')]))).toEqual([]);
  });

  it('matches staple terms with plurals', () => {
    expect(mainFoods(recipe([ing('herbs de provence'), ing('bay leaf, dried'), ing('onions')]))).toEqual([]);
  });

  it('uses the "counts as" key', () => {
    expect(mainFoods(recipe([ing('white fish', { food: 'cod' })]))).toEqual(['cod']);
  });
});

describe('plate-hidden rules', () => {
  it('names rules that exist and apply from age 0', () => {
    for (const id of PLATE_HIDDEN_RULE_IDS) {
      const rule = RULES.find((r) => r.id === id);
      expect(rule, id).toBeDefined();
      expect(rule!.fromMonths, id).toBeUndefined();
    }
  });
});

describe('plateFoods: art safety', () => {
  it('leaves off red grapes, halved, and shows the next main food', () => {
    expect(keysOf(recipe([ing('red grapes, halved'), ing('pear')]))).toEqual(['pear']);
  });

  it('leaves off cherry tomatoes that count as tomato', () => {
    const r = recipe([ing('cherry tomatoes', { food: 'tomato' }), ing('carrot')]);
    expect(keysOf(r)).toEqual(['carrot']);
    // The plain tomato is fine.
    expect(keysOf(recipe([ing('tomato'), ing('carrot')]))).toEqual(['tomato', 'carrot']);
  });

  it('leaves off hot dog, whole almonds, popcorn and blueberries', () => {
    for (const name of ['hot dog', 'whole almonds', 'popcorn', 'blueberries']) {
      expect(keysOf(recipe([ing(name), ing('pear')])), name).toEqual(['pear']);
    }
  });

  it('leaves off a food whose picture is a choking shape, whatever the food', () => {
    expect(CHOKING_SHAPE_PICTURES.has('peanuts')).toBe(true);
    const map = { 'peanut butter': { group: 'protein', picture: 'peanuts' } } as const;
    const r = recipe([ing('peanut butter'), ing('pear')]);
    expect(keysOf(r, never, map)).toEqual(['pear']);
    expect(keysOf(r)).toEqual(['peanut butter', 'pear']);
  });

  it('keeps almond milk on the plate', () => {
    expect(keysOf(recipe([ing('almond milk'), ing('banana')]))).toEqual(['almond milk', 'banana']);
  });

  it('checks the food key as well as the name', () => {
    // The name alone does not match a rule; the "counts as" key does.
    const r = recipe([ing('little round snack', { food: 'popcorn' }), ing('pear')]);
    expect(keysOf(r)).toEqual(['pear']);
  });

  it('returns an empty plate when the only main food is hidden', () => {
    const r = recipe([ing('grapes'), ing('olive oil')]);
    expect(plateFoods(r, never)).toEqual([]);
    expect(plateGroup(r, never)).toBe('other');
  });

  it('never has a plate food a hidden rule or a choking picture matches, over every built-in recipe', () => {
    const hidden = new Set<string>(PLATE_HIDDEN_RULE_IDS);
    for (const r of BUILTIN_RECIPES) {
      const byKey = new Map<string, string[]>();
      for (const i of r.ingredients) byKey.set(groceryFoodKey(i), [...(byKey.get(groceryFoodKey(i)) ?? []), i.name]);
      for (const food of plateFoods(r, never)) {
        for (const text of [food.key, ...(byKey.get(food.key) ?? [])]) {
          const hits = screenIngredient(text, 0).filter((f) => hidden.has(f.ruleId));
          expect(hits, `${r.id}: ${text}`).toEqual([]);
        }
        expect(CHOKING_SHAPE_PICTURES.has(food.picture), `${r.id}: ${food.key}`).toBe(false);
      }
    }
  });
});

describe('plateFoods: picking', () => {
  it('shows at most 3 foods', () => {
    const r = recipe([ing('carrot'), ing('pear'), ing('banana'), ing('mango')]);
    expect(keysOf(r)).toEqual(['carrot', 'pear', 'banana']);
  });

  it('shows a picture once per plate and tries the next main food', () => {
    const r = recipe([ing('chicken'), ing('turkey'), ing('carrot')]);
    expect(plateFoods(r, never).map((f) => f.picture)).toEqual(['poultry_leg', 'carrot']);
    // Two foods that share the generic bowl show it once.
    const bowls = recipe([ing('tofu'), ing('tempeh'), ing('carrot')]);
    expect(plateFoods(bowls, never).map((f) => f.key)).toEqual(['tofu', 'carrot']);
  });

  it('gives a food with no own picture its group picture and group', () => {
    const [food] = plateFoods(recipe([ing('tofu')]), never);
    expect(food).toEqual({ key: 'tofu', picture: pictureFor('tofu').picture, group: 'protein' });
  });

  it('leaves off a Not yet food and tries the next one', () => {
    const r = recipe([ing('mako', { food: 'shark' }), ing('white fish', { food: 'shark' }), ing('carrot')]);
    expect(keysOf(r, (key) => key === 'shark')).toEqual(['carrot']);
    expect(keysOf(r)).toEqual(['shark', 'carrot']);
  });

  it('follows the first plate food for the band color', () => {
    expect(plateGroup(recipe([ing('carrot'), ing('chicken')]), never)).toBe('vegetable');
    expect(plateGroup(recipe([ing('chicken'), ing('carrot')]), never)).toBe('protein');
    expect(plateGroup(recipe([ing('grapes'), ing('cheese')]), never)).toBe('dairy');
    expect(plateGroup(recipe([ing('olive oil')]), never)).toBe('other');
  });

  it('gives a typed food that is not in the map the generic bowl in the other group', () => {
    expect(plateFoods(recipe([ing('dragon fruit')]), never)).toEqual([
      { key: 'dragon fruit', picture: 'bowl_with_spoon', group: 'other' },
    ]);
  });

  it('gives almost every built-in recipe a plate', () => {
    const empty = BUILTIN_RECIPES.filter((r) => plateFoods(r, never).length === 0);
    expect(empty.length).toBeLessThan(BUILTIN_RECIPES.length / 20);
  });
});
