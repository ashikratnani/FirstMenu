import { describe, expect, it } from 'vitest';
import { ghostReason, recipeView } from './recipeView';
import { defaultState } from '../../domain/storage';
import type { Recipe } from '../../domain/types';

const state = defaultState(new Date('2026-01-05'));

function pasted(over: Partial<Recipe> = {}): Recipe {
  return {
    id: 'p1',
    origin: 'custom',
    title: 'Pear mash',
    stages: ['6-8'],
    mealTypes: ['lunch'],
    ingredients: [{ name: 'pear', category: 'produce' }],
    steps: ['Mash the pear.'],
    texture: 'smooth',
    servings: 1,
    imported: { from: 'chatgpt', text: 'x', date: '2026-01-05' },
    ...over,
  };
}

describe('recipeView with text mentions', () => {
  it('does not ghost a clean pasted recipe', () => {
    const view = recipeView(pasted(), state, 8);
    expect(view.isGhosted).toBe(false);
    expect(view.textMentions).toEqual([]);
  });

  it('ghosts a pasted recipe for a text mention and shows the sentence', () => {
    const view = recipeView(pasted({ steps: ['Stir in honey.'] }), state, 8);
    expect(view.isGhosted).toBe(true);
    expect(view.blocks).toEqual([]);
    expect(ghostReason(view)).toBe(
      'The recipe text mentions Honey: "Stir in honey.". Honey can cause infant botulism, even baked into food.',
    );
  });

  it('un-ghosts once the mention is cleared', () => {
    const view = recipeView(
      pasted({
        steps: ['Stir in honey.'],
        clearedMentions: [{ ruleId: 'honey', sentence: 'Stir in honey.' }],
      }),
      state,
      8,
    );
    expect(view.isGhosted).toBe(false);
  });

  it('lists ingredient blocks and text mentions together', () => {
    const view = recipeView(
      pasted({ ingredients: [{ name: 'honey', category: 'other' }], steps: ['Add salt.'] }),
      state,
      8,
    );
    const reason = ghostReason(view);
    expect(reason).toContain('Not yet: honey.');
    expect(reason).toContain('The recipe text mentions Added salt: "Add salt."');
  });

  it('does not ghost a typed recipe for the same text', () => {
    expect(recipeView(pasted({ steps: ['Stir in honey.'], imported: undefined }), state, 8).isGhosted).toBe(false);
  });
});
