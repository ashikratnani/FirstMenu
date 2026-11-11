import { compressToEncodedURIComponent } from 'lz-string';
import { describe, expect, it } from 'vitest';
import {
  MAX_RECIPE_SHARE_FRAGMENT,
  RECIPE_SHARE_BASE_URL,
  RECIPE_SHARE_FOOTER,
  buildRecipeSharePayload,
  decodeRecipeShare,
  encodeRecipeShare,
  recipeFromShare,
  recipeShareText,
} from './recipeShare';
import { screenTextMentions } from './safety/screen';
import { BUILTIN_RECIPES } from '../data/recipes';
import type { Recipe } from './types';

const PASTED_TEXT = 'ORIGINAL-PASTE-MARKER Grandma secret oats with a long caption';

/** A pasted recipe with everything the link must leave out. */
function pasted(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'custom-secret-id-123',
    origin: 'custom',
    title: 'Oat Mash',
    stages: ['6-8', '9-12'],
    mealTypes: ['breakfast'],
    ingredients: [
      { name: 'rolled oats', quantity: 0.5, unit: 'cup', category: 'pantry' },
      { name: 'whole grapes', quantity: 4, category: 'produce', optional: true },
    ],
    steps: ['Cook the oats.', 'Mash well.'],
    texture: 'smooth',
    servings: 2,
    notes: ['NOTE-LINE-MARKER caption text'],
    imported: {
      from: 'instagram',
      url: 'https://example.com/saved-link-marker',
      text: PASTED_TEXT,
      date: '2026-01-10',
    },
    clearedMentions: [{ ruleId: 'honey', sentence: 'CLEARED-MARKER no honey.' }],
    ...overrides,
  };
}

function decodeOk(fragment: string) {
  const result = decodeRecipeShare(fragment);
  if (!result.ok) throw new Error('expected a readable link');
  return result.payload;
}

describe('recipeShare payload and link (Req 9.4, 9.5)', () => {
  it('uses the #/r/ base and round-trips a recipe', () => {
    const recipe = pasted();
    const { url, encoded } = encodeRecipeShare(recipe);
    expect(url).toBe(RECIPE_SHARE_BASE_URL + encoded);
    expect(RECIPE_SHARE_BASE_URL.endsWith('#/r/')).toBe(true);
    const payload = decodeOk(encoded);
    expect(payload).toEqual(buildRecipeSharePayload(recipe));
    expect(payload.recipe.title).toBe('Oat Mash');
    expect(payload.recipe.ingredients).toEqual(recipe.ingredients);
    expect(payload.recipe.steps).toEqual(recipe.steps);
  });

  it('round-trips a built-in recipe, dropping its source on decode', () => {
    const builtin = BUILTIN_RECIPES[0];
    const payload = decodeOk(encodeRecipeShare(builtin).encoded);
    expect(payload.recipe.source).toBeUndefined();
    expect(JSON.parse(JSON.stringify(buildRecipeSharePayload(builtin))).recipe.source).toEqual(builtin.source);
    expect(payload.recipe.title).toBe(builtin.title);
  });

  it('round-trips unicode, emoji and quotes', () => {
    const recipe = pasted({
      title: 'Crème brûlée 🍮 "doux"',
      steps: ['Mélanger les œufs 🥚', 'レシピ — 完了', "It's \\ fine"],
      ingredients: [{ name: 'jaja żółte', category: 'other' }],
      imported: undefined,
    });
    const payload = decodeOk(encodeRecipeShare(recipe).encoded);
    expect(payload.recipe.title).toBe(recipe.title);
    expect(payload.recipe.steps).toEqual(recipe.steps);
    expect(payload.recipe.ingredients[0].name).toBe('jaja żółte');
  });

  it('carries no pasted text, link, notes, cleared mentions or id', () => {
    const { encoded } = encodeRecipeShare(pasted());
    const payload = decodeOk(encoded);
    const json = JSON.stringify(payload);
    for (const marker of [
      'ORIGINAL-PASTE-MARKER',
      'NOTE-LINE-MARKER',
      'CLEARED-MARKER',
      'saved-link-marker',
      'custom-secret-id-123',
    ]) {
      expect(json).not.toContain(marker);
    }
    expect(payload.recipe).not.toHaveProperty('imported');
    expect(payload.recipe).not.toHaveProperty('notes');
    expect(payload.recipe).not.toHaveProperty('clearedMentions');
    expect(payload.recipe).not.toHaveProperty('id');
    expect(payload.recipe).not.toHaveProperty('origin');
  });

  it('has no child fields, whatever the recipe object holds', () => {
    // A recipe object that somehow carries extra child-like fields.
    const sneaky = {
      ...pasted(),
      child: { name: 'Zed', birthDate: '2025-01-02' },
      ageMonths: 8,
      foods: { egg: { status: 'tried', date: '2026-01-01' } },
    } as unknown as Recipe;
    const json = JSON.stringify(buildRecipeSharePayload(sneaky));
    expect(json).not.toMatch(/Zed|2025-01-02|ageMonths|birthDate|foods|child/);
  });

  it('keeps the hosted URL free of the data except in the fragment', () => {
    const { url } = encodeRecipeShare(pasted());
    expect(url.startsWith('https://')).toBe(true);
    expect(url.indexOf('#')).toBe(url.indexOf('/#/r/') + 1);
  });
});

describe('decodeRecipeShare rejects bad links (Req 9.4)', () => {
  const valid = encodeRecipeShare(pasted()).encoded;

  it.each([
    ['empty', ''],
    ['garbage', 'not-a-link!!'],
    ['truncated', valid.slice(0, Math.floor(valid.length / 2))],
    ['plan share link payload', compressToEncodedURIComponent(JSON.stringify({ v: 1, plan: {} }))],
    ['not json', compressToEncodedURIComponent('hello')],
    ['wrong version', compressToEncodedURIComponent(JSON.stringify({ v: 2, recipe: {} }))],
    ['array', compressToEncodedURIComponent('[]')],
    ['null', compressToEncodedURIComponent('null')],
  ])('%s', (_label, fragment) => {
    expect(decodeRecipeShare(fragment)).toEqual({ ok: false });
  });

  function withRecipe(change: (r: Record<string, unknown>) => void): string {
    const payload = JSON.parse(JSON.stringify(buildRecipeSharePayload(pasted())));
    change(payload.recipe);
    return compressToEncodedURIComponent(JSON.stringify(payload));
  }

  it('rejects extra keys, so a link cannot smuggle pasted text or child data', () => {
    expect(decodeRecipeShare(withRecipe((r) => (r.imported = { text: 'x' })))).toEqual({ ok: false });
    expect(decodeRecipeShare(withRecipe((r) => (r.child = { name: 'x' })))).toEqual({ ok: false });
    expect(decodeRecipeShare(withRecipe((r) => (r.id = 'b-fake')))).toEqual({ ok: false });
    expect(
      decodeRecipeShare(
        withRecipe((r) => (r.ingredients = [{ name: 'a', category: 'other', extra: 1 }])),
      ),
    ).toEqual({ ok: false });
  });

  it('rejects extra keys that would pre-clear mentions or add notes', () => {
    for (const key of ['clearedMentions', 'notes', 'imported', 'id']) {
      expect(decodeRecipeShare(withRecipe((r) => (r[key] = key === 'id' ? 'x' : [])))).toEqual({
        ok: false,
      });
    }
    expect(
      decodeRecipeShare(
        withRecipe((r) => (r.clearedMentions = [{ ruleId: 'honey', sentence: 'Add honey.' }])),
      ),
    ).toEqual({ ok: false });
  });

  it('drops a crafted source (javascript:, data:, vbscript:, fake publisher)', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x']) {
      const fragment = withRecipe(
        (r) =>
          (r.source = {
            title: 'Official',
            publisher: 'CDC',
            url,
            retrieved: '2026-01-01',
            adaptations: [],
            storageSource: url,
          }),
      );
      const shared = decodeOk(fragment).recipe;
      expect(shared.source).toBeUndefined();
      expect(JSON.stringify(recipeFromShare(shared, 'n', '2026-01-01'))).not.toContain('CDC');
    }
  });

  it('rejects a food override on an ingredient', () => {
    expect(
      decodeRecipeShare(
        withRecipe((r) => (r.ingredients = [{ name: 'a', category: 'other', food: 'zzz' }])),
      ),
    ).toEqual({ ok: false });
  });

  it('rejects an empty title, stages, ingredients or steps', () => {
    expect(decodeRecipeShare(withRecipe((r) => (r.title = '  ')))).toEqual({ ok: false });
    expect(decodeRecipeShare(withRecipe((r) => (r.stages = [])))).toEqual({ ok: false });
    expect(decodeRecipeShare(withRecipe((r) => (r.ingredients = [])))).toEqual({ ok: false });
    expect(decodeRecipeShare(withRecipe((r) => (r.steps = [])))).toEqual({ ok: false });
  });

  it('rejects wrong shapes', () => {
    expect(decodeRecipeShare(withRecipe((r) => (r.title = 5)))).toEqual({ ok: false });
    expect(decodeRecipeShare(withRecipe((r) => (r.stages = ['1-2'])))).toEqual({ ok: false });
    expect(decodeRecipeShare(withRecipe((r) => delete r.steps))).toEqual({ ok: false });
    expect(decodeRecipeShare(withRecipe((r) => (r.servings = -1)))).toEqual({ ok: false });
  });

  it('rejects oversized strings and lists', () => {
    expect(decodeRecipeShare(withRecipe((r) => (r.title = 'a'.repeat(201))))).toEqual({ ok: false });
    expect(decodeRecipeShare(withRecipe((r) => (r.steps = Array(61).fill('Stir.'))))).toEqual({
      ok: false,
    });
    expect(
      decodeRecipeShare(
        withRecipe((r) => (r.ingredients = Array(61).fill({ name: 'a', category: 'other' }))),
      ),
    ).toEqual({ ok: false });
  });

  it('rejects an over-long fragment without decoding it', () => {
    expect(decodeRecipeShare('A'.repeat(MAX_RECIPE_SHARE_FRAGMENT + 1))).toEqual({ ok: false });
  });

  it('rejects a payload whose JSON is too big', () => {
    const big = JSON.stringify({ v: 1, recipe: pasted(), pad: 'x'.repeat(50000) });
    expect(decodeRecipeShare(compressToEncodedURIComponent(big))).toEqual({ ok: false });
  });
});

describe('recipeShareText (Req 9.3, 9.5)', () => {
  it('has title, ingredients, steps, prep reminders and the closing line', () => {
    const text = recipeShareText(pasted());
    expect(text.startsWith('Oat Mash\n')).toBe(true);
    expect(text).toContain('- 0.5 cup rolled oats');
    expect(text).toContain('- 4 whole grapes (optional)');
    expect(text).toContain('1. Cook the oats.');
    expect(text).toContain('2. Mash well.');
    expect(text).toContain('Prep reminders');
    expect(text).toMatch(/whole grapes: .*(quarter|cut)/i);
    expect(text.endsWith(RECIPE_SHARE_FOOTER)).toBe(true);
    expect(RECIPE_SHARE_FOOTER).toBe(
      'Shared from FirstMenu. Not medical advice; check with your pediatrician.',
    );
  });

  it('includes the source for a built-in recipe only', () => {
    const builtin = BUILTIN_RECIPES[0];
    const text = recipeShareText(builtin);
    expect(text).toContain(`Source: ${builtin.source!.title}`);
    expect(text).toContain(builtin.source!.publisher);
    expect(recipeShareText(pasted())).not.toContain('Source:');
    const customWithSource = pasted({ source: builtin.source });
    expect(recipeShareText(customWithSource)).not.toContain('Source:');
  });

  it('carries no pasted text, link, notes, cleared mentions, id or child data', () => {
    const sneaky = { ...pasted(), child: { name: 'Zed' } } as unknown as Recipe;
    const text = recipeShareText(sneaky);
    for (const marker of [
      'ORIGINAL-PASTE-MARKER',
      'NOTE-LINE-MARKER',
      'CLEARED-MARKER',
      'saved-link-marker',
      'custom-secret-id-123',
      'Zed',
    ]) {
      expect(text).not.toContain(marker);
    }
  });

  it('gives the same text whatever the sender or child (no age input)', () => {
    expect(recipeShareText(pasted())).toBe(recipeShareText(pasted({ id: 'other' })));
  });
});

describe('recipeFromShare (Req 9.6)', () => {
  it('makes a custom recipe marked imported, with the share text as original text, and no source', () => {
    const shared = decodeOk(encodeRecipeShare(pasted()).encoded).recipe;
    const recipe = recipeFromShare(shared, 'new-id', '2026-02-03');
    expect(recipe.id).toBe('new-id');
    expect(recipe.origin).toBe('custom');
    expect(recipe.imported?.from).toBe('shared');
    expect(recipe.imported?.text).toContain('Oat Mash');
    expect(recipe.imported?.text).toContain(RECIPE_SHARE_FOOTER);
    expect(recipe.imported?.text).not.toContain('ORIGINAL-PASTE-MARKER');
    expect(recipe.clearedMentions).toBeUndefined();
  });

  it('never carries a source, even from a built-in link', () => {
    const builtin = BUILTIN_RECIPES[0];
    const shared = decodeOk(encodeRecipeShare(builtin).encoded).recipe;
    expect(shared.source).toBeUndefined();
    expect(recipeFromShare(shared, 'new-id', '2026-02-03').source).toBeUndefined();
  });

  it('is screened for text mentions, which are not pre-cleared', () => {
    const shared = decodeOk(
      encodeRecipeShare(
        pasted({
          steps: ['Stir in a spoon of honey.'],
          clearedMentions: [{ ruleId: 'honey', sentence: 'Stir in a spoon of honey.' }],
        }),
      ).encoded,
    ).recipe;
    const recipe = recipeFromShare(shared, 'new-id', '2026-02-03');
    const mentions = screenTextMentions(recipe, 8);
    expect(mentions.length).toBeGreaterThan(0);
    expect(mentions[0].sentence).toBe('Stir in a spoon of honey.');
  });
});
