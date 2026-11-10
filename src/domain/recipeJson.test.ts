import { describe, expect, it } from 'vitest';
import { MAX_PASTE_CHARS, parseRecipeText, type ParsedRecipe } from './importText';
import {
  RECIPE_JSON_ERROR_TEMPLATE,
  RECIPE_JSON_TEMPLATE,
  parseRecipeReply,
  type JsonParseResult,
} from './recipeJson';
import { screenRecipe, screenTextMentions } from './safety/screen';
import type { Recipe } from './types';
import validJson from './__fixtures__/json/valid.json?raw';
import fenced from './__fixtures__/json/fenced-with-prose.txt?raw';
import broken from './__fixtures__/json/broken.txt?raw';
import wrongVersion from './__fixtures__/json/wrong-version.json?raw';
import fraction from './__fixtures__/json/quantity-fraction.json?raw';
import unknownKeys from './__fixtures__/json/unknown-keys.json?raw';
import unitBlocked from './__fixtures__/json/unit-blocked-food.json?raw';
import errorObject from './__fixtures__/json/error-object.json?raw';
import promptFormat from './__fixtures__/paste/chatgpt-prompt-format.txt?raw';

const AGE = 8;

function recipeOf(text: string) {
  const r = parseRecipeReply(text);
  if (r.kind !== 'recipe') throw new Error(`expected a recipe, got ${r.kind}: ${JSON.stringify(r)}`);
  return r;
}

function invalidOf(text: string) {
  const r = parseRecipeReply(text);
  if (r.kind !== 'invalid') throw new Error(`expected invalid, got ${r.kind}`);
  return r.errors;
}

function messages(text: string): string[] {
  return invalidOf(text).map((e) => e.message);
}

/** Build a Recipe the way Add recipe will, to run the existing safety screens on it. */
function toRecipe(parsed: ParsedRecipe, raw: string): Recipe {
  return {
    id: 'x',
    origin: 'custom',
    title: parsed.title,
    stages: ['6-8'],
    mealTypes: ['lunch'],
    ingredients: parsed.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      optional: i.optional,
      category: 'other' as const,
    })),
    steps: parsed.steps.map((s) => s.text),
    notes: parsed.notes.map((n) => n.text),
    texture: 'As described in the recipe',
    servings: parsed.servings ?? 1,
    imported: { from: 'chatgpt', text: raw, date: '2026-01-01' },
  };
}

function mentionIds(text: string, age = AGE): string[] {
  return screenTextMentions(toRecipe(recipeOf(text).parsed, text), age).map((m) => m.ruleId);
}

/** A valid reply with one thing changed. */
function obj(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    firstmenu_recipe: 1,
    title: 'Rice',
    ingredients: [{ name: 'rice' }],
    steps: ['Cook the rice.'],
    ...over,
  });
}

describe('fixtures', () => {
  it('valid', () => {
    const r = recipeOf(validJson);
    expect(r.parsed).toEqual({
      title: 'Egg and rice bowl',
      statedMinutes: 15,
      servings: 2,
      ingredients: [
        { name: 'cooked rice', quantity: 1, unit: 'cup', optional: false, line: 1 },
        { name: 'egg', quantity: 1, optional: false, line: 2 },
        { name: 'olive oil', optional: true, line: 3 },
      ],
      steps: [
        { text: 'Scramble the egg until fully cooked.', line: 4 },
        { text: 'Stir it into the rice.', line: 5 },
      ],
      notes: [
        { text: 'Keeps 2 days in the fridge.', line: 6 },
        { text: 'ingredients[0].unit: cup', line: 7 },
      ],
      warnings: [],
    });
    expect(r.extras).toEqual([]);
    expect(r.outsideNotable).toBe(false);
  });

  it('fenced with prose: text outside is not recipe content, braces inside strings are fine', () => {
    const r = recipeOf(fenced);
    expect(r.parsed.title).toBe('Banana oat pancakes');
    expect(r.parsed.steps[0].text).toBe('Mash the banana {really well}.');
    const all = JSON.stringify(r.parsed);
    expect(all).not.toContain('Sure!');
    expect(all).not.toContain('Let me know');
    expect(all).not.toContain('yogurt');
    expect(r.outsideNotable).toBe(false);
  });

  it('broken (cut off) is invalid, not a silent fallback', () => {
    expect(messages(broken)).toEqual([expect.stringContaining("couldn't be read")]);
    expect(messages(broken)[0]).toContain('curly quotes');
  });

  it('wrong version', () => {
    expect(invalidOf(wrongVersion)).toEqual([
      { path: 'firstmenu_recipe', message: expect.stringContaining('firstmenu_recipe must be 1') },
    ]);
  });

  it('quantity "1/2" names the field and the value', () => {
    expect(invalidOf(fraction)).toEqual([
      { path: 'ingredients[1].quantity', message: 'ingredients[1].quantity must be a number such as 0.5, not "1/2"' },
    ]);
  });

  it('unknown keys become notes and are screened', () => {
    const r = recipeOf(unknownKeys);
    const notes = r.parsed.notes.map((n) => n.text);
    expect(notes).toContain('ingredients[0].brand: Nutella');
    expect(notes).toContain('source.site: example blog');
    expect(notes).toContain('source.tips[0]: Add a spoon of honey');
    expect(r.extras).toEqual(['ingredients[0].brand', 'source.site', 'source.tips[0]']);
    // Numbers in unknown places carry no text.
    expect(JSON.stringify(r.parsed)).not.toContain('120');
    expect(mentionIds(unknownKeys)).toContain('honey');
  });

  it('unit with a blocked food ghosts through the text-mention path', () => {
    const r = recipeOf(unitBlocked);
    expect(r.parsed.ingredients[1].unit).toBe('tbsp honey');
    expect(r.parsed.notes.map((n) => n.text)).toContain('ingredients[1].unit: tbsp honey');
    expect(r.extras).toEqual(['ingredients[1].unit']);
    const recipe = toRecipe(r.parsed, unitBlocked);
    expect(screenRecipe(recipe, AGE).blocks).toEqual([]); // names only
    expect(mentionIds(unitBlocked)).toEqual(['honey']);
  });

  it('error object is a typed ai-error', () => {
    expect(parseRecipeReply(errorObject)).toEqual({
      kind: 'ai-error',
      message: 'I could not open this reel because it is private.',
    });
  });
});

describe('template', () => {
  it("the template's own example parses", () => {
    const r = recipeOf(RECIPE_JSON_TEMPLATE);
    expect(r.parsed.ingredients).toHaveLength(2);
    expect(r.parsed.statedMinutes).toBe(15);
    expect(r.extras).toEqual([]);
    expect(screenRecipe(toRecipe(r.parsed, RECIPE_JSON_TEMPLATE), 6).blocks).toEqual([]);
    expect(mentionIds(RECIPE_JSON_TEMPLATE, 6)).toEqual([]);
  });

  it('the error template parses to an ai-error', () => {
    expect(parseRecipeReply(RECIPE_JSON_ERROR_TEMPLATE)).toEqual({ kind: 'ai-error', message: '<why>' });
  });
});

describe('finding the object', () => {
  it('accepts the object alone, in a fence (with or without a language) and with text around it', () => {
    expect(recipeOf(obj()).parsed.title).toBe('Rice');
    expect(recipeOf('```json\n' + obj() + '\n```').parsed.title).toBe('Rice');
    expect(recipeOf('```\n' + obj() + '\n```').parsed.title).toBe('Rice');
    expect(recipeOf('Here you go: ' + obj() + ' Enjoy!').parsed.title).toBe('Rice');
  });

  it('finds the object by a string-aware scan when braces are inside strings', () => {
    const text = 'Intro } stray { ' + obj({ steps: ['Use a "}" sign', 'Add { more'] }) + ' bye';
    expect(recipeOf(text).parsed.steps.map((s) => s.text)).toEqual(['Use a "}" sign', 'Add { more']);
  });

  it('skips a first balanced block that is not JSON', () => {
    expect(recipeOf('Note {not json} then ' + obj()).parsed.title).toBe('Rice');
  });

  it('no text, or no { means no-json', () => {
    expect(parseRecipeReply('')).toEqual({ kind: 'no-json' });
    expect(parseRecipeReply('   \n ')).toEqual({ kind: 'no-json' });
    expect(parseRecipeReply(promptFormat)).toEqual({ kind: 'no-json' });
    expect(parseRecipeReply('5')).toEqual({ kind: 'no-json' });
    expect(parseRecipeReply('[1, 2]')).toEqual({ kind: 'no-json' });
  });

  it('a { with nothing that parses is invalid', () => {
    expect(messages('Mix {the rice')[0]).toContain("couldn't be read");
    expect(messages('{"title": “Rice”}')[0]).toContain('curly quotes');
  });

  it('a JSON object that is not a FirstMenu recipe is invalid', () => {
    expect(invalidOf('{"a": 1}').map((e) => e.path)).toContain('firstmenu_recipe');
  });

  it('over 20,000 characters is not parsed', () => {
    const big = obj({ notes: ['x'.repeat(MAX_PASTE_CHARS)] });
    expect(invalidOf(big)).toEqual([
      { path: '', message: 'The text is too long to read (over 20,000 characters).' },
    ]);
    expect(parseRecipeReply(obj() + ' '.repeat(MAX_PASTE_CHARS)).kind).toBe('invalid');
    expect(parseRecipeReply('a'.repeat(MAX_PASTE_CHARS + 1)).kind).toBe('invalid');
  });
});

describe('outside text (Requirement 18.4)', () => {
  it('is flagged when over 200 characters', () => {
    expect(recipeOf('Short intro. ' + obj()).outsideNotable).toBe(false);
    expect(recipeOf('x'.repeat(201) + ' ' + obj()).outsideNotable).toBe(true);
    expect(recipeOf(obj() + ' ' + 'y'.repeat(150) + ' ' + 'z'.repeat(150)).outsideNotable).toBe(true);
  });

  it('is flagged when it has a second {', () => {
    expect(recipeOf(obj() + '\nAlso {"title":"other"}').outsideNotable).toBe(true);
    expect(recipeOf('Maybe {x} ' + obj()).outsideNotable).toBe(true);
  });

  it('a code fence alone is not flagged', () => {
    expect(recipeOf('```json\n' + obj() + '\n```').outsideNotable).toBe(false);
  });

  it('never reaches steps or notes, even when it mentions a blocked food', () => {
    const r = recipeOf('Add honey for sweetness! ' + obj() + ' Serve with juice.');
    expect(JSON.stringify(r.parsed)).not.toMatch(/honey|juice/i);
    expect(mentionIds('Add honey for sweetness! ' + obj())).toEqual([]);
  });
});

describe('validation rules (Requirement 18.5)', () => {
  it('requires version 1', () => {
    expect(messages(obj({ firstmenu_recipe: 2 }))[0]).toContain('firstmenu_recipe must be 1');
    expect(messages(obj({ firstmenu_recipe: '1' }))[0]).toContain('firstmenu_recipe must be 1');
    const noVersion = JSON.parse(obj()) as Record<string, unknown>;
    delete noVersion.firstmenu_recipe;
    expect(messages(JSON.stringify(noVersion))[0]).toContain('firstmenu_recipe must be 1');
  });

  it('title: required, not empty, at most 120 characters', () => {
    expect(messages(obj({ title: undefined }))).toEqual(['title must be text (it is missing)']);
    expect(messages(obj({ title: '   ' }))).toEqual(['title must not be empty']);
    expect(messages(obj({ title: 5 }))).toEqual(['title must be text, not 5']);
    expect(messages(obj({ title: 'a'.repeat(121) }))).toEqual(['title must be at most 120 characters']);
    expect(recipeOf(obj({ title: 'a'.repeat(120) })).parsed.title).toHaveLength(120);
  });

  it('ingredients: 1 to 60 objects, each with a name of at most 120 characters', () => {
    expect(messages(obj({ ingredients: undefined }))[0]).toContain('ingredients must be a list');
    expect(messages(obj({ ingredients: [] }))).toEqual(['ingredients needs at least 1 item']);
    expect(messages(obj({ ingredients: 'rice' }))[0]).toContain('ingredients must be a list');
    expect(messages(obj({ ingredients: ['rice'] }))[0]).toContain('ingredients[0]');
    expect(messages(obj({ ingredients: [{ quantity: 1 }] }))).toEqual([
      'ingredients[0].name must be text (it is missing)',
    ]);
    expect(messages(obj({ ingredients: [{ name: ' ' }] }))).toEqual(['ingredients[0].name must not be empty']);
    expect(messages(obj({ ingredients: [{ name: 'a'.repeat(121) }] }))).toEqual([
      'ingredients[0].name must be at most 120 characters',
    ]);
    const sixty = Array.from({ length: 60 }, (_, i) => ({ name: `food ${i}` }));
    expect(recipeOf(obj({ ingredients: sixty })).parsed.ingredients).toHaveLength(60);
    expect(messages(obj({ ingredients: [...sixty, { name: 'one more' }] }))).toEqual([
      'ingredients can have at most 60 items',
    ]);
  });

  it('steps: 1 to 40 non-empty strings', () => {
    expect(messages(obj({ steps: undefined }))[0]).toContain('steps must be a list');
    expect(messages(obj({ steps: [] }))).toEqual(['steps needs at least 1 item']);
    expect(messages(obj({ steps: ['ok', ''] }))).toEqual(['steps[1] must not be empty']);
    expect(messages(obj({ steps: ['ok', 3] }))).toEqual(['steps[1] must be text, not 3']);
    const forty = Array.from({ length: 40 }, (_, i) => `Step ${i}.`);
    expect(recipeOf(obj({ steps: forty })).parsed.steps).toHaveLength(40);
    expect(messages(obj({ steps: [...forty, 'more'] }))).toEqual(['steps can have at most 40 items']);
  });

  it('total_minutes: number or null, 1 to 1,440', () => {
    expect(recipeOf(obj({ total_minutes: null })).parsed.statedMinutes).toBeUndefined();
    expect(recipeOf(obj({ total_minutes: 1 })).parsed.statedMinutes).toBe(1);
    expect(recipeOf(obj({ total_minutes: 1440 })).parsed.statedMinutes).toBe(1440);
    expect(recipeOf(obj({ total_minutes: 12.6 })).parsed.statedMinutes).toBe(13);
    expect(messages(obj({ total_minutes: 0 }))[0]).toContain('total_minutes must be at least 1');
    expect(messages(obj({ total_minutes: 1441 }))[0]).toContain('total_minutes must be at most 1440');
    expect(messages(obj({ total_minutes: '15' }))).toEqual(['total_minutes must be a number of minutes, or null, not "15"']);
  });

  it('servings: number or null, 1 to 50', () => {
    expect(recipeOf(obj({ servings: null })).parsed.servings).toBeUndefined();
    expect(recipeOf(obj({ servings: 50 })).parsed.servings).toBe(50);
    expect(messages(obj({ servings: 0 }))[0]).toContain('servings must be at least 1');
    expect(messages(obj({ servings: 51 }))[0]).toContain('servings must be at most 50');
    expect(messages(obj({ servings: 'two' }))[0]).toContain('servings must be a number');
  });

  it('notes: strings, at most 20', () => {
    expect(recipeOf(obj({ notes: Array.from({ length: 20 }, () => 'n') })).parsed.notes).toHaveLength(20);
    expect(messages(obj({ notes: Array.from({ length: 21 }, () => 'n') }))).toEqual([
      'notes can have at most 20 items',
    ]);
    expect(messages(obj({ notes: [1] }))[0]).toContain('notes[0]');
    expect(messages(obj({ notes: 'tip' }))[0]).toContain('notes must be a list');
  });

  it('ingredient quantity: number greater than 0, or null', () => {
    const q = (quantity: unknown) => obj({ ingredients: [{ name: 'rice', quantity }] });
    expect(recipeOf(q(0.5)).parsed.ingredients[0].quantity).toBe(0.5);
    expect(recipeOf(q(null)).parsed.ingredients[0].quantity).toBeUndefined();
    expect(messages(q(0))[0]).toBe('ingredients[0].quantity must be more than 0, not 0');
    expect(messages(q(-1))[0]).toContain('more than 0');
    expect(messages(q('1/2'))[0]).toContain('not "1/2"');
    expect(messages(q(true))[0]).toContain('must be a number such as 0.5');
  });

  it('ingredient unit and optional types', () => {
    expect(messages(obj({ ingredients: [{ name: 'rice', unit: 3 }] }))).toEqual([
      'ingredients[0].unit must be text or null, not 3',
    ]);
    expect(messages(obj({ ingredients: [{ name: 'rice', optional: 'yes' }] }))).toEqual([
      'ingredients[0].optional must be true or false, not "yes"',
    ]);
    expect(recipeOf(obj()).parsed.ingredients[0].optional).toBe(false);
  });

  it('reports every problem, not just the first', () => {
    expect(invalidOf(obj({ title: '', steps: [] })).map((e) => e.path).sort()).toEqual(['steps', 'title']);
  });

  it('a rejected reply gives no recipe', () => {
    expect(parseRecipeReply(obj({ title: '' })).kind).toBe('invalid');
  });
});

describe('cleaning', () => {
  it('trims strings and removes control characters; line breaks become spaces', () => {
    const r = recipeOf(
      obj({ title: '  Rice\u0000 bowl  ', steps: ['Add the\nhoney\tnow.\u0007'], ingredients: [{ name: ' ri\u200bce ' }] }),
    );
    expect(r.parsed.title).toBe('Rice bowl');
    expect(r.parsed.steps[0].text).toBe('Add the honey now.');
    expect(r.parsed.ingredients[0].name).toBe('rice');
  });

  it('does not interpret markdown', () => {
    expect(recipeOf(obj({ title: '**Rice** _bowl_' })).parsed.title).toBe('**Rice** _bowl_');
  });

  it('a hidden character cannot hide a blocked food from the text screen', () => {
    expect(mentionIds(obj({ steps: ['Stir in ho\u200bney.'] }))).toEqual(['honey']);
    expect(mentionIds(obj({ steps: ['No\nhoney please.'] }))).toEqual(['honey']);
  });
});

describe('every string is screened or rejected (Requirement 18.9)', () => {
  it('collects strings at any depth, with the key path', () => {
    const r = recipeOf(obj({ a: { b: [{ c: 'deep text' }] }, extra_list: ['one', 'two'] }));
    const notes = r.parsed.notes.map((n) => n.text);
    expect(notes).toEqual(['a.b[0].c: deep text', 'extra_list[0]: one', 'extra_list[1]: two']);
    expect(r.extras).toEqual(['a.b[0].c', 'extra_list[0]', 'extra_list[1]']);
  });

  it('collects ingredient-level extra fields', () => {
    const r = recipeOf(obj({ ingredients: [{ name: 'rice', brand: 'honey bunches' }] }));
    expect(r.parsed.notes.map((n) => n.text)).toEqual(['ingredients[0].brand: honey bunches']);
    expect(mentionIds(obj({ ingredients: [{ name: 'rice', brand: 'honey bunches' }] }))).toEqual(['honey']);
  });

  it('screens a key that names a food, even when the value has no text', () => {
    expect(mentionIds(obj({ honey: true }))).toEqual(['honey']);
    expect(mentionIds(obj({ honey: {} }))).toEqual(['honey']);
    expect(mentionIds(obj({ more: { honey: 1 } }))).toEqual(['honey']);
  });

  it('ignores numbers, booleans and null in unknown places when the key is harmless', () => {
    const r = recipeOf(obj({ rating: 5, vegan: true, source: null, tags: [] }));
    expect(r.parsed.notes).toEqual([]);
    expect(r.extras).toEqual([]);
  });

  it('depth: 6 levels pass, 7 are rejected (a string 6 keys down is the deepest)', () => {
    const nest = (levels: number): unknown => {
      let v: unknown = 'leaf';
      for (let i = 0; i < levels - 1; i++) v = { k: v };
      return v;
    };
    // levels counts keys from the root: x -> k -> k ... -> leaf string
    expect(recipeOf(obj({ x: nest(6) })).parsed.notes[0].text).toBe('x.k.k.k.k.k: leaf');
    expect(messages(obj({ x: nest(7) }))).toEqual(['The reply has too much extra text']);
    expect(messages(obj({ x: nest(40) }))).toEqual(['The reply has too much extra text']);
  });

  it('count: 50 strings pass, 51 are rejected, never truncated', () => {
    const fifty = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, `v${i}`]));
    expect(recipeOf(obj(fifty)).parsed.notes).toHaveLength(50);
    expect(messages(obj({ ...fifty, k50: 'v50' }))).toEqual(['The reply has too much extra text']);
  });

  it('length: 500 characters pass, 501 are rejected', () => {
    expect(recipeOf(obj({ extra: 'x'.repeat(500) })).parsed.notes).toHaveLength(1);
    expect(messages(obj({ extra: 'x'.repeat(501) }))).toEqual(['The reply has too much extra text']);
    expect(messages(obj({ ingredients: [{ name: 'rice', unit: 'u'.repeat(501) }] }))).toEqual([
      'The reply has too much extra text',
    ]);
  });

  it('unit notes do not count toward the 50 extra strings', () => {
    const ings = Array.from({ length: 60 }, (_, i) => ({ name: `food ${i}`, unit: 'cup' }));
    const fifty = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, `v${i}`]));
    expect(recipeOf(obj({ ingredients: ings, ...fifty })).parsed.notes).toHaveLength(110);
  });

  it('the unit is kept in the ingredient and screened as text', () => {
    const r = recipeOf(obj({ ingredients: [{ name: 'oats', quantity: 1, unit: 'cup of juice' }] }));
    expect(r.parsed.ingredients[0].unit).toBe('cup of juice');
    expect(mentionIds(obj({ ingredients: [{ name: 'oats', unit: 'cup of juice' }] }))).toEqual(['juice']);
  });

  it('a plain unit adds a note but no extras entry; numeric-only units add nothing', () => {
    const r = recipeOf(obj({ ingredients: [{ name: 'oats', unit: 'cup' }, { name: 'a', unit: '2' }] }));
    expect(r.parsed.notes.map((n) => n.text)).toEqual(['ingredients[0].unit: cup']);
    expect(r.extras).toEqual([]);
  });

  it('unknown key named __proto__ is data, not a prototype change', () => {
    const text = obj().slice(0, -1) + ',"__proto__":{"polluted":"yes"}}';
    const r = recipeOf(text);
    expect(r.parsed.notes.map((n) => n.text)).toEqual(['__proto__.polluted: yes']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('ai-error', () => {
  it('uses the message, capped, or an empty message', () => {
    expect(parseRecipeReply('{"firstmenu_recipe":1,"error":"cannot_access"}')).toEqual({
      kind: 'ai-error',
      message: '',
    });
    const long = parseRecipeReply(
      JSON.stringify({ firstmenu_recipe: 1, error: 'cannot_access', message: 'm'.repeat(900) }),
    );
    expect(long.kind === 'ai-error' && long.message.length).toBe(500);
  });

  it('works inside a fence and with prose', () => {
    expect(parseRecipeReply('Sorry!\n```json\n' + errorObject + '\n```').kind).toBe('ai-error');
  });

  it('an error object with the wrong version is invalid', () => {
    expect(parseRecipeReply('{"firstmenu_recipe":2,"error":"cannot_access"}').kind).toBe('invalid');
  });

  it('an object with ingredients and an error key is a recipe; the error text is screened', () => {
    const r = recipeOf(obj({ error: 'cannot_access' }));
    expect(r.parsed.notes.map((n) => n.text)).toEqual(['error: cannot_access']);
  });
});

describe('JSON and equivalent plain text give the same safety result (Requirement 18.8)', () => {
  const cases: Array<{ name: string; json: Record<string, unknown>; text: string }> = [
    {
      name: 'honey as an ingredient',
      json: { title: 'Toast', ingredients: [{ name: 'bread' }, { quantity: 1, unit: 'tbsp', name: 'honey' }], steps: ['Toast the bread.'] },
      text: 'Title: Toast\nIngredients:\n- bread\n- 1 tbsp honey\nSteps:\n1. Toast the bread.',
    },
    {
      name: 'juice in a step',
      json: { title: 'Oats', ingredients: [{ name: 'oats' }], steps: ['Cook the oats in apple juice.'] },
      text: 'Title: Oats\nIngredients:\n- oats\nSteps:\n1. Cook the oats in apple juice.',
    },
    {
      name: 'honey in a note',
      json: { title: 'Oats', ingredients: [{ name: 'oats' }], steps: ['Cook the oats.'], notes: ['Skip the honey.'] },
      text: 'Title: Oats\nIngredients:\n- oats\nSteps:\n1. Cook the oats.\nNotes:\n- Skip the honey.',
    },
    {
      name: 'honey in the title',
      json: { title: 'Honey oats', ingredients: [{ name: 'oats' }], steps: ['Cook the oats.'] },
      text: 'Title: Honey oats\nIngredients:\n- oats\nSteps:\n1. Cook the oats.',
    },
    {
      name: 'a clean recipe',
      json: { title: 'Rice', ingredients: [{ name: 'rice' }], steps: ['Cook the rice.'] },
      text: 'Title: Rice\nIngredients:\n- rice\nSteps:\n1. Cook the rice.',
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const json = JSON.stringify({ firstmenu_recipe: 1, ...c.json });
      const fromJson = recipeOf(json).parsed;
      const fromText = parseRecipeText(c.text);
      const screen = (p: ParsedRecipe, raw: string) => {
        const recipe = toRecipe(p, raw);
        const s = screenRecipe(recipe, AGE);
        const ids = (xs: Array<{ ruleId: string }>) => xs.map((x) => x.ruleId).sort();
        return {
          blocks: ids(s.blocks),
          reminders: ids(s.reminders),
          allergens: ids(s.allergens),
          mentions: screenTextMentions(recipe, AGE)
            .map((m) => `${m.ruleId}|${m.where}|${m.sentence}`)
            .sort(),
        };
      };
      expect(screen(fromJson, json)).toEqual(screen(fromText, c.text));
    });
  }

  it('the notes added for plain units never create a mention', () => {
    expect(mentionIds(validJson)).toEqual([]);
  });
});

describe('pure', () => {
  it('makes no network call', () => {
    const calls: unknown[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((...args: unknown[]) => {
      calls.push(args);
      return Promise.reject(new Error('no network'));
    }) as typeof fetch;
    try {
      parseRecipeReply(validJson);
      parseRecipeReply(broken);
    } finally {
      globalThis.fetch = original;
    }
    expect(calls).toEqual([]);
  });

  it('types: every result kind is covered', () => {
    const kinds: JsonParseResult['kind'][] = [
      parseRecipeReply(validJson).kind,
      parseRecipeReply(broken).kind,
      parseRecipeReply(errorObject).kind,
      parseRecipeReply('hello').kind,
    ];
    expect(kinds).toEqual(['recipe', 'invalid', 'ai-error', 'no-json']);
  });
});

describe('stray braces', () => {
  it('a cut-off reply is never read from an inner object', () => {
    const cut = '{"firstmenu_recipe":1,"title":"T","ingredients":[{"name":"rice"}],"steps":["Cook';
    expect(messages(cut)[0]).toContain("couldn't be read");
    expect(messages('{"firstmenu_recipe":1,"ingredients":[{"name":"rice"},')[0]).toContain("couldn't be read");
  });
});
