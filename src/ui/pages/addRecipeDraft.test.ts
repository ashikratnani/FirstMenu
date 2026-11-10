import { describe, expect, it } from 'vitest';
import { parseRecipeReply } from '../../domain/recipeJson';
import { buildRecipe, draftFromParsed, type BuildContext } from './addRecipeDraft';

const ctx: BuildContext = {
  id: 'r1',
  stage: '6-8',
  from: 'chatgpt',
  url: '',
  originalText: '',
  today: '2026-01-15',
  cleared: [],
};

function draftFor(unit: string, notes: string[] = []) {
  const reply = JSON.stringify({
    firstmenu_recipe: 1,
    title: 'Test',
    ingredients: [{ quantity: 1, unit, name: 'rolled oats' }],
    steps: ['Cook the oats.'],
    notes,
  });
  const result = parseRecipeReply(reply);
  if (result.kind !== 'recipe') throw new Error('expected a recipe');
  return draftFromParsed(result.parsed, result.extras);
}

describe('hidden ingredient-unit notes', () => {
  it('hides the note of a plain unit, keeps it for the screen and drops it for Save', () => {
    const draft = draftFor('cup');
    const unitNote = draft.notes.find((l) => l.text === 'ingredients[0].unit: cup');
    expect(unitNote?.hidden).toBe(true);
    expect(buildRecipe(draft, ctx).notes).toContain('ingredients[0].unit: cup');
    expect(buildRecipe(draft, { ...ctx, omitHidden: true }).notes).toBeUndefined();
  });

  it('does not hide a single-word unit that matches a rule', () => {
    const draft = draftFor('honey');
    const unitNote = draft.notes.find((l) => l.text === 'ingredients[0].unit: honey');
    expect(unitNote).toBeDefined();
    expect(unitNote?.hidden).toBeUndefined();
    expect(buildRecipe(draft, { ...ctx, omitHidden: true }).notes).toContain(
      'ingredients[0].unit: honey',
    );
  });

  it('does not hide a multi-word or odd unit', () => {
    for (const unit of ['tbsp honey', 'big pinch', '2x']) {
      const draft = draftFor(unit);
      const unitNote = draft.notes.find((l) => l.text === `ingredients[0].unit: ${unit}`);
      expect(unitNote, unit).toBeDefined();
      expect(unitNote?.hidden, unit).toBeUndefined();
    }
  });

  it('never hides a user-written note with the same text', () => {
    const draft = draftFor('cup', ['ingredients[0].unit: cup']);
    const same = draft.notes.filter((l) => l.text === 'ingredients[0].unit: cup');
    expect(same).toHaveLength(2);
    expect(same.filter((l) => l.hidden)).toHaveLength(1);
    expect(same[0].hidden).toBeUndefined();
    expect(buildRecipe(draft, { ...ctx, omitHidden: true }).notes).toEqual([
      'ingredients[0].unit: cup',
    ]);
  });
});
