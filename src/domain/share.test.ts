import { describe, expect, it } from 'vitest';
import { compressToEncodedURIComponent } from 'lz-string';

import type { AppState, Recipe } from './types';
import {
  buildSharePayload,
  decodeShareData,
  encodeSharePayload,
  isShareLinkLong,
  SHARE_BASE_URL,
  SHARE_WARN_LENGTH,
} from './share';
import { RULESET_VERSION } from './safety/rules';

const CHILD_NAME = 'Wednesday';
const CHILD_BIRTHDATE = '2025-06-01';

// A built-in recipe id that actually exists in the bundled recipe data, so the
// plan references both a built-in and a custom recipe.
const BUILTIN_RECIPE_ID = 'b-carrots-and-apples';

/** A representative custom recipe the plan uses (so it must be included). */
function customRecipe(): Recipe {
  return {
    id: 'custom-sweet-pea-mash',
    origin: 'custom',
    title: 'Sweet Pea Mash',
    stages: ['6-8', '9-12'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'peas', quantity: 1, unit: 'cup', category: 'produce' },
      { name: 'water', quantity: 0.25, unit: 'cup', category: 'other' },
    ],
    steps: ['Steam the peas until soft.', 'Mash with a little water.'],
    texture: 'smooth puree',
    servings: 4,
  };
}

/** A custom recipe the plan does NOT use (must be excluded from the payload). */
function unusedCustomRecipe(): Recipe {
  return {
    id: 'custom-unused',
    origin: 'custom',
    title: 'Unused Recipe',
    stages: ['9-12'],
    mealTypes: ['snack'],
    ingredients: [{ name: 'banana', category: 'produce' }],
    steps: ['Mash.'],
    texture: 'mash',
    servings: 2,
  };
}

/**
 * A representative AppState with a named child (name + birthDate), a custom
 * recipe, a plan that uses both the built-in and the custom recipe across
 * several days, and a food log whose records include notes.
 */
function sampleState(): AppState {
  const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
  days[0] = { lunch: BUILTIN_RECIPE_ID };
  days[2] = { dinner: 'custom-sweet-pea-mash' };
  days[4] = { lunch: BUILTIN_RECIPE_ID, dinner: 'custom-sweet-pea-mash' };

  return {
    schemaVersion: 2,
    child: { name: CHILD_NAME, birthDate: CHILD_BIRTHDATE },
    onboarded: true,
    customRecipes: [customRecipe(), unusedCustomRecipe()],
    foods: {
      carrot: { status: 'tried', date: '2026-01-10', note: 'loved it, secret note' },
      'allergen:peanut': { status: 'reaction', date: '2026-01-12', note: 'rash appeared' },
    },
    plan: {
      startDate: '2026-01-15',
      prepDate: '2026-01-14',
      activeSlots: ['lunch', 'dinner'],
      days,
    },
    groceryChecked: [],
    disclaimerAcknowledged: true,
    pantry: [],
    onHand: [],
    madeLog: [],
    onHandDays: {},
    dismissed: {},
  };
}

describe('buildSharePayload', () => {
  it('carries ageMonths, plan, ruleset version and v=1', () => {
    const payload = buildSharePayload(sampleState());
    expect(payload.v).toBe(1);
    expect(payload.rulesetVersion).toBe(RULESET_VERSION);
    expect(typeof payload.ageMonths).toBe('number');
    // child born 2025-06-01, plan start 2026-01-15 -> 7 whole months.
    expect(payload.ageMonths).toBe(7);
    expect(payload.plan).toEqual(sampleState().plan);
  });

  it('defaults ageMonths to 0 when there is no child', () => {
    const state = sampleState();
    delete state.child;
    expect(buildSharePayload(state).ageMonths).toBe(0);
  });

  it('includes only the recipes used in the plan, built-in AND custom', () => {
    const payload = buildSharePayload(sampleState());
    const ids = payload.recipes.map((r) => r.id).sort();
    expect(ids).toEqual([BUILTIN_RECIPE_ID, 'custom-sweet-pea-mash'].sort());
    // the unused custom recipe is excluded
    expect(ids).not.toContain('custom-unused');
    // the custom recipe is carried in full so the viewer can render it
    const custom = payload.recipes.find((r) => r.id === 'custom-sweet-pea-mash');
    expect(custom).toEqual(customRecipe());
  });

  it('strips every food note but keeps status and date', () => {
    const payload = buildSharePayload(sampleState());
    for (const record of Object.values(payload.foods)) {
      expect(record).not.toHaveProperty('note');
    }
    expect(payload.foods.carrot).toEqual({ status: 'tried', date: '2026-01-10' });
    expect(payload.foods['allergen:peanut']).toEqual({
      status: 'reaction',
      date: '2026-01-12',
    });
  });

  it('contains no child field at all', () => {
    const payload = buildSharePayload(sampleState());
    expect(payload).not.toHaveProperty('child');
  });
});

describe('privacy (Requirement 11.3)', () => {
  it('encoded string and payload JSON contain no name, birth date or notes', () => {
    const state = sampleState();
    const { encoded } = encodeSharePayload(state);
    const payloadJson = JSON.stringify(buildSharePayload(state));

    for (const secret of [
      CHILD_NAME,
      CHILD_BIRTHDATE,
      'loved it, secret note',
      'rash appeared',
    ]) {
      expect(payloadJson).not.toContain(secret);
      expect(encoded).not.toContain(secret);
    }
  });
});

describe('encode / decode round-trip', () => {
  it('decodes a freshly encoded link back to the built payload', () => {
    const state = sampleState();
    const { encoded, url, length } = encodeSharePayload(state);

    expect(url.startsWith(SHARE_BASE_URL)).toBe(true);
    expect(url).toBe(SHARE_BASE_URL + encoded);
    expect(length).toBe(url.length);

    const result = decodeShareData(encoded);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual(buildSharePayload(state));
    }
  });
});

describe('decode rejection (Requirement 11.5)', () => {
  it('rejects plain garbage', () => {
    expect(decodeShareData('not-a-real-link').ok).toBe(false);
    expect(decodeShareData('').ok).toBe(false);
    expect(decodeShareData('!!!!').ok).toBe(false);
  });

  it('rejects a tampered (character-flipped) link', () => {
    const { encoded } = encodeSharePayload(sampleState());
    const chars = encoded.split('');
    // Flip a character near the middle to corrupt the compressed stream.
    const mid = Math.floor(chars.length / 2);
    chars[mid] = chars[mid] === 'A' ? 'B' : 'A';
    const tampered = chars.join('');
    expect(decodeShareData(tampered).ok).toBe(false);
  });

  it('rejects a truncated link', () => {
    const { encoded } = encodeSharePayload(sampleState());
    const truncated = encoded.slice(0, Math.floor(encoded.length / 2));
    expect(decodeShareData(truncated).ok).toBe(false);
  });

  it('rejects an unknown version (v !== 1)', () => {
    const payload = buildSharePayload(sampleState());
    const tampered = { ...payload, v: 2 };
    const encoded = compressToEncodedURIComponent(JSON.stringify(tampered));
    expect(decodeShareData(encoded).ok).toBe(false);
  });

  it('never returns partial data on failure', () => {
    const result = decodeShareData('garbage');
    expect(result).toEqual({ ok: false });
  });
});

describe('length warning (Requirement 11.6)', () => {
  it('reports a short link as not long', () => {
    const { url, length } = encodeSharePayload(sampleState());
    expect(length).toBeLessThanOrEqual(SHARE_WARN_LENGTH);
    expect(isShareLinkLong(url)).toBe(false);
    expect(isShareLinkLong(length)).toBe(false);
  });

  it('reports an oversized link as long but still creates the link', () => {
    const state = sampleState();
    const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
    const longSteps = Array.from({ length: 30 }, (_, i) =>
      `Step ${i}: ${'cook the vegetables very thoroughly until completely soft '.repeat(4)}`,
    );
    // Many bulky custom recipes, all referenced by the plan, to push the URL
    // past SHARE_WARN_LENGTH.
    const bulky: Recipe[] = Array.from({ length: 40 }, (_, i) => ({
      id: `custom-bulk-${i}`,
      origin: 'custom',
      title: `Bulky Recipe Number ${i} With A Fairly Long Descriptive Title`,
      stages: ['6-8', '9-12'],
      mealTypes: ['lunch', 'dinner'],
      ingredients: [
        { name: `ingredient-${i}-carrot`, quantity: 1, unit: 'cup', category: 'produce' },
        { name: `ingredient-${i}-sweet-potato`, quantity: 2, unit: 'cup', category: 'produce' },
      ],
      steps: longSteps,
      texture: 'smooth puree or soft mash for older infants',
      servings: 6,
    }));
    bulky.forEach((recipe, i) => {
      days[i % 7] = { ...days[i % 7], [i % 2 === 0 ? 'lunch' : 'dinner']: recipe.id };
    });
    // Note: a day can only hold one recipe per slot, so also reference the rest
    // by spreading ids across snack/breakfast slots.
    bulky.forEach((recipe, i) => {
      const slot = (['breakfast', 'lunch', 'dinner', 'snack'] as const)[i % 4];
      days[i % 7] = { ...days[i % 7], [slot]: recipe.id };
    });

    state.customRecipes = bulky;
    state.plan = { ...state.plan, days };

    const { url, length } = encodeSharePayload(state);
    expect(length).toBeGreaterThan(SHARE_WARN_LENGTH);
    expect(isShareLinkLong(url)).toBe(true);
    // The link is STILL created even when long.
    expect(url.startsWith(SHARE_BASE_URL)).toBe(true);
    expect(url.length).toBeGreaterThan(SHARE_BASE_URL.length);
  });
});

describe('pasted-recipe fields stripped from the plan share (Req 10.2)', () => {
  function pastedState(): AppState {
    const state = sampleState();
    const pasted: Recipe = {
      ...customRecipe(),
      imported: {
        from: 'chatgpt',
        text: 'ORIGINAL PASTED TEXT with a secret',
        date: '2026-01-10',
      },
      clearedMentions: [{ ruleId: 'honey', sentence: 'No honey here.' }],
      notes: ['kept note'],
    };
    return { ...state, customRecipes: [pasted, unusedCustomRecipe()] };
  }

  it('removes imported.text and clearedMentions, keeping the rest', () => {
    const payload = buildSharePayload(pastedState());
    const recipe = payload.recipes.find((r) => r.id === 'custom-sweet-pea-mash');
    expect(recipe?.imported).toEqual({ from: 'chatgpt', text: '', date: '2026-01-10' });
    expect(recipe?.clearedMentions).toBeUndefined();
    expect(recipe?.notes).toEqual(['kept note']);
  });

  it('the encoded link contains neither the pasted text nor the cleared sentence and still decodes', () => {
    const { encoded } = encodeSharePayload(pastedState());
    const decoded = decodeShareData(encoded);
    expect(decoded.ok).toBe(true);
    expect(JSON.stringify(decoded.ok ? decoded.payload : {})).not.toContain('secret');
    expect(JSON.stringify(decoded.ok ? decoded.payload : {})).not.toContain('No honey here');
  });

  it('never includes the v2 pantry and suggestion fields', () => {
    const state = {
      ...pastedState(),
      pantry: ['oat'],
      onHand: ['banana'],
      madeLog: [{ recipeId: 'x', date: '2026-01-10' }],
    };
    const payload = buildSharePayload(state);
    expect(Object.keys(payload).sort()).toEqual(
      ['ageMonths', 'foods', 'plan', 'recipes', 'rulesetVersion', 'v'],
    );
  });
});

describe('a plan share link made before schema v2 still decodes (Req 10.4)', () => {
  it('decodes a v1-era payload (v 1, ruleset 2, two-stage recipes)', () => {
    const v1Payload = {
      v: 1,
      rulesetVersion: 2,
      ageMonths: 9,
      plan: sampleState().plan,
      recipes: [customRecipe()],
      foods: { carrot: { status: 'tried', date: '2026-01-10' } },
    };
    const link = compressToEncodedURIComponent(JSON.stringify(v1Payload));
    const decoded = decodeShareData(link);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.payload.v).toBe(1);
      expect(decoded.payload.recipes[0].id).toBe('custom-sweet-pea-mash');
      expect(decoded.payload.recipes[0].imported).toBeUndefined();
    }
  });
});
