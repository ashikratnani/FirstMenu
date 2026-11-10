import { describe, expect, it } from 'vitest';
import { FILTER_LABELS, SEARCH_PHRASES } from '../data/searchPhrases';
import { OTHER_NAMES, STOP_PHRASES, SUGGESTED_PANTRY_NAMES } from '../data/foodNames';
import { BUILTIN_RECIPES } from '../data/recipes';
import { buildVocabulary, editDistance, sameTokens, searchHave, type Vocabulary } from './foodSearch';
import { foodKeyFromName, groceryFoodKey, isIgnoredFood } from './foods';
import { normalize, tokenize } from './safety/normalize';
import type { Recipe } from './types';

const vocab = buildVocabulary(BUILTIN_RECIPES, []);
const search = (text: string, v: Vocabulary = vocab) => searchHave(text, v);

function recipeWith(title: string, names: string[]): Recipe {
  return {
    id: `t-${title}`,
    origin: 'custom',
    title,
    stages: ['9-12'],
    mealTypes: ['dinner'],
    ingredients: names.map((name) => ({ name, category: 'other' as const })),
    steps: [],
    texture: 'soft',
    servings: 1,
  };
}

describe('worked examples (design.md table)', () => {
  const rows: Array<[string, string[], string[]]> = [
    ['leftover chicken, rice and frozen peas', ['chicken', 'rice', 'pea'], []],
    ['something for breakfast', [], ['meal:breakfast']],
    ['finger food with chicken', ['chicken'], ['form:finger-food']],
    ['quick oats and banana', ['oat', 'banana'], []],
    ['something quick with eggs', ['egg'], ['quick']],
    ['mashed banana', ['banana'], []],
    ['mashed ripe banana', ['banana'], []],
    ['quick cooked rice', ['rice'], []],
    ['quick mashed banana', ['banana'], []],
    ['eggs something quick', ['egg'], ['quick']],
    ['sweet potato puree for dinner', ['sweet potato'], ['meal:dinner']],
    ['iron fortified cereal', ['cereal'], []],
    ['mince', ['beef'], []],
    ['iron rich lunch', [], ['tag:iron-rich', 'meal:lunch']],
    ['smooth peanut butter', ['peanut butter'], []],
  ];
  it.each(rows)('%s', (typed, foods, filters) => {
    const r = search(typed);
    expect(r.foods).toEqual(foods);
    expect(r.filters).toEqual(filters);
    expect(r.unrecognized).toEqual([]);
    expect(r.didYouMean).toEqual([]);
  });

  it('bean curd, lemon curd: tofu, and "lemon curd" is Not recognized', () => {
    const r = search('bean curd, lemon curd');
    expect(r.foods).toEqual(['tofu']);
    expect(r.filters).toEqual([]);
    expect(r.unrecognized).toEqual(['lemon curd']);
  });

  it('brocoli: no food, "Did you mean broccoli?"', () => {
    const r = search('brocoli');
    expect(r.foods).toEqual([]);
    expect(r.didYouMean).toEqual([{ typed: 'brocoli', food: 'broccoli' }]);
    expect(r.filters).toEqual([]);
    expect(r.unrecognized).toEqual([]);
  });
});

describe('separators and unseparated text (Req 16.1)', () => {
  const expected = ['chicken', 'rice', 'pea'];
  it.each([
    ['commas', 'chicken, rice, peas'],
    ['semicolons', 'chicken; rice; peas'],
    ['new lines', 'chicken\nrice\npeas'],
    ['and', 'chicken and rice and peas'],
    ['with', 'chicken with rice with peas'],
    ['plus', 'chicken + rice + peas'],
    ['ampersand', 'chicken & rice & peas'],
    ['plus without spaces', 'chicken+rice+peas'],
    ['unseparated', 'chicken rice peas'],
    ['upper case and extra spaces', '  Chicken   RICE ,, Peas  '],
  ])('%s', (_name, typed) => {
    expect(search(typed).foods).toEqual(expected);
  });

  it('returns nothing for empty text', () => {
    expect(search('')).toEqual({ foods: [], didYouMean: [], filters: [], titleWords: [], unrecognized: [] });
    expect(search('  ,  ; ').foods).toEqual([]);
  });

  it('does not repeat a food typed twice', () => {
    expect(search('rice, rice and Rice').foods).toEqual(['rice']);
  });

  it('understands plurals and accents', () => {
    expect(search('carrots, tomatoes').didYouMean).toEqual([]);
    expect(search('sweet potatoes, apples').foods).toEqual(['sweet potato', 'apple']);
    expect(search('purée').filters).toEqual(['form:puree']);
  });
});

describe('filler words, request words and quantities (Req 16.2)', () => {
  it.each([
    ['some rice', ['rice']],
    ['a bit of rice', ['rice']],
    ['half a banana', ['banana']],
    ['a little fresh raw carrot', ['carrot']],
    ['leftover rice', ['rice']],
    ['leftovers: chicken', ['chicken']],
    ['what can I make with chicken', ['chicken']],
    ['recipes for toddler food with beef', ['beef']],
    ['ideas for baby with rice', ['rice']],
    ['anything with eggs', ['egg']],
  ])('%s', (typed, foods) => {
    const r = search(typed);
    expect(r.foods).toEqual(foods);
    expect(r.unrecognized).toEqual([]);
    expect(r.filters).toEqual([]);
  });

  it('drops quantities and units', () => {
    const r = search('2 cups diced sweet potatoes, 1/2 cup rice, 3 tbsp butter, 200 g beef, 1.5 oz peas');
    expect(r.foods).toEqual(['sweet potato', 'rice', 'butter', 'beef', 'pea']);
    expect(r.unrecognized).toEqual([]);
  });

  it('never turns filler or request words into foods or leftovers', () => {
    const r = search('some any a an the bit of little few half leftover cooked raw something for make can i what to recipe meal baby toddler kid kids');
    expect(r).toEqual({ foods: [], didYouMean: [], filters: [], titleWords: [], unrecognized: [] });
  });

  it('keeps "food" as a request word unless part of "finger food"', () => {
    expect(search('food').unrecognized).toEqual([]);
    expect(search('food').filters).toEqual([]);
    expect(search('finger food').filters).toEqual(['form:finger-food']);
  });

  it('lets filler words be part of a name ("baby cereal", "ground meat", "whole grain bread")', () => {
    expect(search('baby cereal').foods).toEqual(['cereal']);
    expect(search('ground meat').foods).toEqual(['beef']);
    expect(search('whole grain bread').foods).toEqual(['bread']);
  });
});

describe('single longest-match pass', () => {
  it('prefers "sweet potato" over "potato"', () => {
    expect(search('sweet potato').foods).toEqual(['sweet potato']);
    expect(search('potato').foods).toEqual(['potato']);
    expect(search('sweet potato and potato').foods).toEqual(['sweet potato', 'potato']);
  });

  it('prefers "quick oats" over "quick"', () => {
    const r = search('quick oats');
    expect(r.foods).toEqual(['oat']);
    expect(r.filters).toEqual([]);
    expect(search('quick').filters).toEqual(['quick']);
  });

  it('prefers "iron fortified cereal" over "iron", "smooth peanut butter" over "smooth"', () => {
    expect(search('iron fortified infant cereal').foods).toEqual(['cereal']);
    expect(search('iron fortified infant cereal').filters).toEqual([]);
    expect(search('smooth peanut butter').filters).toEqual([]);
    expect(search('creamy peanut butter').foods).toEqual(['peanut butter']);
  });

  it('on a tie in length a food beats a phrase', () => {
    const v = buildVocabulary([recipeWith('Snack pack', ['bites'])], []);
    const r = searchHave('bites', v);
    expect(r.foods).toEqual(['bite']);
    expect(r.filters).toEqual([]);
  });

  it('on a tie in length an other name beats a known food spelled the same way', () => {
    const v = buildVocabulary([recipeWith('Pepper dish', ['pepper'])], []);
    expect(searchHave('pepper', v).foods).toEqual(['bell pepper']);
  });

  it('keeps "black pepper" from reading as "pepper"', () => {
    expect(search('black pepper').foods).toEqual(['black pepper']);
    expect(search('pepper').foods).toEqual(['bell pepper']);
    expect(search('capsicum').foods).toEqual(['bell pepper']);
  });

  it('lists a stop phrase as typed, once, without adding a food', () => {
    const r = search('lemon curd');
    expect(r.foods).toEqual([]);
    expect(r.unrecognized).toEqual(['lemon curd']);
  });
});

describe('descriptor or filter (step 4)', () => {
  it.each([
    ['mashed banana', ['banana'], []],
    ['banana mashed', ['banana'], []],
    ['sweet potato puree', ['sweet potato'], []],
    ['mashed ripe banana', ['banana'], []],
    ['quick cooked rice', ['rice'], []],
    ['quick mashed banana', ['banana'], []],
    ['easy mashed banana', ['banana'], []],
    ['banana quick mashed', ['banana'], []],
    ['iron rich beef', ['beef'], []],
    ['something mashed for dinner', [], ['form:mashed', 'meal:dinner']],
    ['eggs something quick', ['egg'], ['quick']],
    ['eggs for easy', ['egg'], ['easy']],
    ['mashed, banana', ['banana'], ['form:mashed']],
    ['mashed and banana', ['banana'], ['form:mashed']],
    ['quick and easy', [], ['quick', 'easy']],
    ['finger food', [], ['form:finger-food']],
    ['iron rich', [], ['tag:iron-rich']],
    ['2 cups mashed banana', ['banana'], []],
  ])('%s', (typed, foods, filters) => {
    const r = search(typed);
    expect(r.foods).toEqual(foods);
    expect(r.filters).toEqual(filters);
  });

  it('a request word keeps the phrase a filter even with a food on the other side', () => {
    expect(search('eggs something quick').filters).toEqual(['quick']);
    expect(search('make quick rice').filters).toEqual([]);
    expect(search('quick for rice').filters).toEqual(['quick']);
  });

  it('meal and freezer phrases are always filters', () => {
    expect(search('breakfast banana').filters).toEqual(['meal:breakfast']);
    expect(search('banana snack').filters).toEqual(['meal:snack']);
    expect(search('freezer banana').filters).toEqual(['freezer']);
    expect(search('lunch rice').foods).toEqual(['rice']);
  });

  it('a meal phrase breaks adjacency between a descriptor and a food', () => {
    expect(search('mashed dinner banana').filters).toEqual(['form:mashed', 'meal:dinner']);
  });

  it('does not repeat a filter', () => {
    expect(search('quick, fast and in a hurry').filters).toEqual(['quick']);
  });
});

describe('other names and stop phrases (Req 16.3)', () => {
  it.each([
    ['minced beef', 'beef'],
    ['hamburger meat', 'beef'],
    ['minced chicken', 'chicken'],
    ['courgette', 'zucchini'],
    ['aubergine', 'eggplant'],
    ['brinjal', 'eggplant'],
    ['garbanzo', 'chickpea'],
    ['garbanzo beans', 'chickpea'],
    ['chana', 'chickpea'],
    ['yoghurt', 'yogurt'],
    ['dahi', 'yogurt'],
    ['curd', 'yogurt'],
    ['coriander leaves', 'cilantro'],
    ['coriander leaf', 'cilantro'],
    ['rocket', 'arugula'],
    ['swede', 'rutabaga'],
    ['bhindi', 'okra'],
    ['bean curd', 'tofu'],
    ['porridge oats', 'oat'],
    ['rolled oats', 'oat'],
    ['quick cooking oats', 'oat'],
    ['old-fashioned oats', 'oat'],
    ['iron-fortified cereal', 'cereal'],
    ['whole wheat bread', 'bread'],
    ['maize', 'corn'],
    ['sweetcorn', 'corn'],
    ['spring onions', 'green onion'],
    ['scallion', 'green onion'],
    ['beetroot', 'beet'],
    ['prawns', 'shrimp'],
  ])('%s -> %s', (typed, food) => {
    const r = search(typed);
    expect(r.foods).toEqual([food]);
    expect(r.filters).toEqual([]);
    expect(r.unrecognized).toEqual([]);
  });

  it('"ladyfinger" and "lady finger" give no food and are listed under Not recognized', () => {
    for (const typed of ['ladyfinger', 'lady fingers', 'Lady Finger']) {
      const r = search(typed);
      expect(r.foods).toEqual([]);
      expect(r.unrecognized).toHaveLength(1);
    }
    expect(search('ladyfinger').unrecognized).toEqual(['ladyfinger']);
  });

  it('"curd" on its own is yogurt, "lemon curd" is not', () => {
    expect(search('curd').foods).toEqual(['yogurt']);
    expect(search('lemon curd').foods).toEqual([]);
    expect(search('bean curd, curd').foods).toEqual(['tofu', 'yogurt']);
  });

  it('does not map cottage cheese; it stays its own word', () => {
    expect(Object.keys(OTHER_NAMES)).not.toContain('cottage cheese');
    expect(search('cottage cheese').foods).not.toContain('yogurt');
  });

  it('recognizes the suggested pantry foods', () => {
    for (const name of SUGGESTED_PANTRY_NAMES) {
      expect(search(name).foods).toEqual([foodKeyFromName(name)]);
    }
  });

  it('recognizes the user pantry and custom recipe foods', () => {
    const v = buildVocabulary([recipeWith('Custom', ['kohlrabi'])], ['star fruit']);
    expect(searchHave('kohlrabi and star fruit', v).foods).toEqual(['kohlrabi', 'star fruit']);
  });

  it('does not count ignored foods as known', () => {
    const v = buildVocabulary([recipeWith('Soup', ['water', 'carrot'])], []);
    expect(searchHave('water', v).foods).toEqual([]);
  });
});

describe('typo matching (Req 16.4)', () => {
  it('suggests a food for a typo and does not count it', () => {
    const r = search('carot');
    expect(r.foods).toEqual([]);
    expect(r.didYouMean).toEqual([{ typed: 'carot', food: 'carrot' }]);
    expect(r.unrecognized).toEqual([]);
  });

  it('handles a transposition as one edit', () => {
    expect(editDistance('bnaana', 'banana')).toBe(1);
    expect(editDistance('banana', 'banana')).toBe(0);
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(search('bnaana').didYouMean).toEqual([{ typed: 'bnaana', food: 'banana' }]);
  });

  it('allows distance 0 under 4 letters', () => {
    expect(search('pee').didYouMean).toEqual([]);
    expect(search('pee').unrecognized).toEqual(['pee']);
    expect(search('ric').unrecognized).toEqual(['ric']);
  });

  it('allows distance 1 for 4 to 7 letters, not 2', () => {
    expect(search('rise').didYouMean).toEqual([{ typed: 'rise', food: 'rice' }]);
    expect(search('rcie').didYouMean).toEqual([{ typed: 'rcie', food: 'rice' }]);
    expect(search('spinch').didYouMean).toEqual([{ typed: 'spinch', food: 'spinach' }]);
    expect(search('brocli').didYouMean).toEqual([]);
    expect(search('brocli').unrecognized).toEqual(['brocli']);
  });

  it('allows distance 2 for 8 letters or more', () => {
    expect(search('brocolli').didYouMean).toEqual([{ typed: 'brocolli', food: 'broccoli' }]);
    expect(search('sweetpotato').unrecognized).toEqual(['sweetpotato']);
    expect(search('applesauze').didYouMean).toEqual([{ typed: 'applesauze', food: 'applesauce' }]);
    expect(search('zuchinni').didYouMean).toEqual([{ typed: 'zuchinni', food: 'zucchini' }]);
    expect(search('xxxxxxxxxx').unrecognized).toEqual(['xxxxxxxxxx']);
  });

  it('suggests the unique closest food when others are also within range', () => {
    const v = buildVocabulary([recipeWith('Greens', ['broccoli', 'broccolini'])], []);
    // distance 1 to broccolini, 2 or more to broccoli
    expect(searchHave('brocolini', v).didYouMean).toEqual([{ typed: 'brocolini', food: 'broccolini' }]);
  });

  it('lists the word as not recognized when two foods tie for closest', () => {
    const v = buildVocabulary([recipeWith('Beans', ['bean', 'beat'])], []);
    const r = searchHave('beam', v);
    expect(r.didYouMean).toEqual([]);
    expect(r.unrecognized).toEqual(['beam']);
  });

  it('counts two spellings of one food as one candidate', () => {
    expect(search('yoghrt').didYouMean).toEqual([{ typed: 'yoghrt', food: 'yogurt' }]);
  });

  it('matches typos of other names and suggests the food they map to', () => {
    expect(search('courgete').didYouMean).toEqual([{ typed: 'courgete', food: 'zucchini' }]);
  });

  it('never matches multi-word foods by typo', () => {
    expect(search('sweetpotato').didYouMean).toEqual([]);
  });

  it('never typo-matches stop phrases', () => {
    for (const typed of ['ladyfingr', 'ladyfingers', 'lady fingr']) {
      expect(search(typed).didYouMean).toEqual([]);
    }
    expect(search('ladyfingr').unrecognized).toEqual(['ladyfingr']);
  });

  it('never typo-matches dish-kind phrases', () => {
    for (const typed of ['brekfast', 'dinnr', 'snak', 'finger fod', 'puure', 'mashd']) {
      const r = search(typed);
      expect(r.filters).toEqual([]);
      expect(r.didYouMean).toEqual([]);
    }
    expect(search('brekfast').unrecognized).toEqual(['brekfast']);
  });

  it('does not count a typo match as a food', () => {
    expect(search('brocoli and rice').foods).toEqual(['rice']);
  });

  it('lists the same typo once', () => {
    expect(search('brocoli, brocoli').didYouMean).toHaveLength(1);
  });
});

describe('dish-kind phrases (Req 16.9)', () => {
  const cases: Array<[string, string]> = SEARCH_PHRASES.flatMap((g) =>
    g.phrases.map((p): [string, string] => [p, g.filter]),
  );

  it.each(cases)('"%s" -> %s', (phrase, filter) => {
    const r = search(phrase);
    expect(r.filters).toEqual([filter]);
    expect(r.foods).toEqual([]);
    expect(r.unrecognized).toEqual([]);
  });

  it.each([
    ['something for breakfast', 'meal:breakfast'],
    ['lunch ideas', 'meal:lunch'],
    ['supper', 'meal:dinner'],
    ['snacks', 'meal:snack'],
    ['finger food', 'form:finger-food'],
    ['self-feeding', 'form:finger-food'],
    ['baby-led', 'form:finger-food'],
    ['BLW', 'form:finger-food'],
    ['purée', 'form:puree'],
    ['mashed', 'form:mashed'],
    ['in a hurry', 'quick'],
    ['under 15 minutes', 'quick'],
    ['no fuss', 'easy'],
    ['iron-rich', 'tag:iron-rich'],
    ['veggies', 'tag:vegetable'],
    ['whole grain', 'tag:whole-grain'],
    ['make-ahead', 'freezer'],
    ['batch cook', 'freezer'],
  ])('%s', (typed, filter) => {
    expect(search(typed).filters).toEqual([filter]);
  });

  it('"quick" and "iron rich" alone are filters', () => {
    expect(search('quick').filters).toEqual(['quick']);
    expect(search('iron rich').filters).toEqual(['tag:iron-rich']);
    expect(search('make ahead').filters).toEqual(['freezer']);
  });

  it('several filters in one search, each once, in order', () => {
    expect(search('quick easy iron rich breakfast').filters).toEqual([
      'quick',
      'easy',
      'tag:iron-rich',
      'meal:breakfast',
    ]);
  });

  it('has a chip label for every filter', () => {
    for (const g of SEARCH_PHRASES) expect(FILTER_LABELS[g.filter]).toBeTruthy();
  });
});

describe('title words', () => {
  it('matches words of recipe titles, whole word and plural-aware', () => {
    const r = search('pancakes, pudding');
    expect(r.titleWords).toEqual(['pancakes', 'pudding']);
    expect(r.foods).toEqual([]);
    expect(r.unrecognized).toEqual([]);
    expect(search('pancake').titleWords).toEqual(['pancake']);
  });

  it('combines with foods', () => {
    const r = search('banana pancakes');
    expect(r.foods).toEqual(['banana']);
    expect(r.titleWords).toEqual(['pancakes']);
  });

  it('ignores words under 4 letters', () => {
    const v = buildVocabulary([recipeWith('Big Egg Pie', ['flour'])], []);
    expect(searchHave('pie big', v).titleWords).toEqual([]);
    expect(searchHave('pie big', v).unrecognized).toEqual(['pie', 'big']);
  });

  it('does not match part of a word', () => {
    expect(search('cake').titleWords).toEqual([]);
    expect(search('cake').unrecognized).toEqual(['cake']);
  });

  it('is checked before typo matching', () => {
    const v = buildVocabulary([recipeWith('Rise and Shine', ['flour'])], []);
    expect(searchHave('rise', v).titleWords).toEqual(['rise']);
    expect(searchHave('rise', v).didYouMean).toEqual([]);
  });
});

describe('unrecognized words (Req 16.7)', () => {
  it('lists words it cannot place, and does not count them as foods', () => {
    const r = search('rice and xyzzy plugh');
    expect(r.foods).toEqual(['rice']);
    expect(r.unrecognized).toEqual(['xyzzy', 'plugh']);
  });

  it('lists a word once', () => {
    expect(search('xyzzy, xyzzy').unrecognized).toEqual(['xyzzy']);
  });
});

describe('vocabulary list checks', () => {
  const names = Object.keys(OTHER_NAMES);
  const targets = Array.from(new Set(Object.values(OTHER_NAMES)));
  const knownFoods = vocab.entries.filter((e) => e.kind === 'food').map((e) => e.tokens);
  const phrases = SEARCH_PHRASES.flatMap((g) => g.phrases);

  it('every target equals groceryFoodKey({ name: target })', () => {
    for (const target of targets) {
      expect(groceryFoodKey({ name: target, category: 'other' })).toBe(target);
    }
  });

  it('every suggested pantry name derives a non-empty key', () => {
    for (const name of SUGGESTED_PANTRY_NAMES) expect(foodKeyFromName(name)).not.toBe('');
  });

  it('stores names, stop phrases and phrases in normalized form', () => {
    for (const name of [...names, ...STOP_PHRASES, ...phrases, ...targets]) {
      expect(normalize(name)).toBe(name);
    }
  });

  it('has no name mapped to two foods (plural-aware) and no repeated name', () => {
    const seen: Array<{ tokens: string[]; food: string }> = [];
    for (const [name, food] of Object.entries(OTHER_NAMES)) {
      const tokens = tokenize(name);
      const clash = seen.find((s) => sameTokens(s.tokens, tokens));
      expect(clash, name).toBeUndefined();
      seen.push({ tokens, food });
    }
  });

  it('does not map a name to a different food than the same-spelled built-in food', () => {
    const builtinKeys = new Set(
      BUILTIN_RECIPES.flatMap((r) => r.ingredients.map((i) => groceryFoodKey(i))),
    );
    for (const [name, food] of Object.entries(OTHER_NAMES)) {
      if (builtinKeys.has(name)) expect(food, name).toBe(name);
    }
  });

  it('has no stop phrase that is also a name or a food', () => {
    for (const stop of STOP_PHRASES) {
      const t = tokenize(stop);
      expect(names.some((n) => sameTokens(tokenize(n), t)), stop).toBe(false);
      expect(knownFoods.some((k) => sameTokens(k, t)), stop).toBe(false);
    }
  });

  it('has no phrase that is also a known food, other name or stop phrase (plural-aware)', () => {
    const others = [...names, ...STOP_PHRASES].map((n) => tokenize(n));
    for (const phrase of phrases) {
      const t = tokenize(phrase);
      expect(knownFoods.some((k) => sameTokens(k, t)), phrase).toBe(false);
      expect(others.some((k) => sameTokens(k, t)), phrase).toBe(false);
    }
  });

  it('has no phrase listed under two different filters (plural-aware)', () => {
    const seen: Array<{ tokens: string[]; filter: string }> = [];
    for (const group of SEARCH_PHRASES) {
      for (const phrase of group.phrases) {
        const tokens = tokenize(phrase);
        const clash = seen.find((s) => s.filter !== group.filter && sameTokens(s.tokens, tokens));
        expect(clash, phrase).toBeUndefined();
        seen.push({ tokens, filter: group.filter });
      }
    }
  });

  it('keeps "vegetable" and "fruit" out of the phrases', () => {
    for (const word of ['vegetable', 'fruit']) {
      expect(phrases.some((p) => sameTokens(tokenize(p), [word]))).toBe(false);
    }
  });

  it('knows every ingredient food of the built-in recipes', () => {
    for (const recipe of BUILTIN_RECIPES) {
      for (const ingredient of recipe.ingredients) {
        const key = groceryFoodKey(ingredient);
        if (key === '' || isIgnoredFood(key)) continue;
        expect(searchHave(key, vocab).foods, key).toContain(key);
      }
    }
  });
});
