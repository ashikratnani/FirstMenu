// The editable preview behind the Add recipe page (Requirements 6.4 to 6.7).
// Pure functions: turn parser output into lines the user can edit, delete and
// move between ingredients, steps and notes, and build the saved Recipe from
// them. Every line is kept as plain text; an ingredient line is read back into
// quantity, unit, name and optional flag only when the recipe is built, so
// editing a line is just editing text.

import { STAGE_TEXTURE_HINTS } from '../../domain/safety/rules';
import { guessCategory } from '../../domain/category';
import {
  parseRecipeText,
  DEFAULT_TITLE,
  type ParsedIngredient,
  type ParsedRecipe,
} from '../../domain/importText';
import type {
  ClearedMention,
  ImportedInfo,
  Ingredient,
  MealType,
  Recipe,
  StageId,
} from '../../domain/types';

export type LineList = 'ingredients' | 'steps' | 'notes';

export interface DraftLine {
  id: number;
  text: string;
  /**
   * A note the preview does not list (a plain one-word ingredient unit that
   * matched no rule). It still counts for the safety screen, but is left out
   * of the saved recipe.
   */
  hidden?: boolean;
}

export interface Draft {
  title: string;
  ingredients: DraftLine[];
  steps: DraftLine[];
  notes: DraftLine[];
  statedMinutes?: number;
  servings?: number;
  warnings: string[];
  nextId: number;
}

const ALL_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function formatQuantity(quantity: number): string {
  return String(Math.round(quantity * 100) / 100);
}

/** An ingredient shown as one editable line: "2 cup oats", "salt (optional)". */
export function ingredientText(ing: ParsedIngredient): string {
  const parts = [
    ing.quantity !== undefined ? formatQuantity(ing.quantity) : '',
    ing.unit ?? '',
    ing.name,
  ].filter((part) => part !== '');
  const text = parts.join(' ');
  return ing.optional ? `${text} (optional)` : text;
}

/** Read one line of text back into an ingredient, using the paste parser. */
export function ingredientFromText(text: string): Ingredient {
  const trimmed = text.trim();
  const parsed = parseRecipeText(`Ingredients:\n${trimmed}`).ingredients[0];
  const name = parsed && parsed.name !== '' ? parsed.name : trimmed;
  const ingredient: Ingredient = { name, category: guessCategory(name) };
  if (parsed?.quantity !== undefined) ingredient.quantity = parsed.quantity;
  if (parsed?.unit !== undefined) ingredient.unit = parsed.unit;
  if (parsed?.optional) ingredient.optional = true;
  return ingredient;
}

/**
 * Which of the last notes of a Recipe JSON result are `ingredients[n].unit`
 * notes to hide: the unit is one plain word and its path is not in `extras`
 * (the parser lists a unit path there when it is odd or matched a rule).
 */
function hiddenUnitNotes(parsed: ParsedRecipe, extras: readonly string[]): Set<number> {
  const unitIndexes: number[] = [];
  parsed.ingredients.forEach((ing, i) => {
    if (ing.unit !== undefined && /\p{L}/u.test(ing.unit)) unitIndexes.push(i);
  });
  const hidden = new Set<number>();
  const first = parsed.notes.length - unitIndexes.length;
  unitIndexes.forEach((ingIndex, n) => {
    const unit = parsed.ingredients[ingIndex].unit ?? '';
    const path = `ingredients[${ingIndex}].unit`;
    const noteIndex = first + n;
    if (
      first >= 0 &&
      parsed.notes[noteIndex].text === `${path}: ${unit}` &&
      /^\p{L}+$/u.test(unit) &&
      !extras.includes(path)
    ) {
      hidden.add(noteIndex);
    }
  });
  return hidden;
}

/**
 * `jsonExtras` is given for a Recipe JSON result (the parser's `extras`); it
 * turns on hiding of plain ingredient-unit notes.
 */
export function draftFromParsed(parsed: ParsedRecipe, jsonExtras?: readonly string[]): Draft {
  let nextId = 1;
  const hiddenNotes = jsonExtras ? hiddenUnitNotes(parsed, jsonExtras) : new Set<number>();
  const lines = (texts: string[]): DraftLine[] => texts.map((text) => ({ id: nextId++, text }));
  const draft: Draft = {
    title: parsed.title,
    ingredients: lines(parsed.ingredients.map(ingredientText)),
    steps: lines(parsed.steps.map((s) => s.text)),
    notes: lines(parsed.notes.map((n) => n.text)).map((l, i) =>
      hiddenNotes.has(i) ? { ...l, hidden: true } : l,
    ),
    warnings: parsed.warnings,
    nextId: 0,
  };
  if (parsed.statedMinutes !== undefined) draft.statedMinutes = parsed.statedMinutes;
  if (parsed.servings !== undefined) draft.servings = parsed.servings;
  draft.nextId = nextId;
  return draft;
}

/** Replace the text of one line. */
export function editLine(draft: Draft, list: LineList, id: number, text: string): Draft {
  return {
    ...draft,
    [list]: draft[list].map((l) => (l.id === id ? { ...l, text } : l)),
  };
}

export function removeLine(draft: Draft, list: LineList, id: number): Draft {
  return { ...draft, [list]: draft[list].filter((l) => l.id !== id) };
}

/** Move a line to the end of another list (Requirement 6.5). */
export function moveLine(draft: Draft, from: LineList, id: number, to: LineList): Draft {
  const line = draft[from].find((l) => l.id === id);
  if (!line || from === to) return draft;
  return {
    ...draft,
    [from]: draft[from].filter((l) => l.id !== id),
    [to]: [...draft[to], line],
  };
}

/** Move many step and note lines to the ingredients (Requirement 6.6). */
export function markAsIngredients(draft: Draft, ids: ReadonlySet<number>): Draft {
  const picked = [...draft.steps, ...draft.notes].filter((l) => ids.has(l.id));
  return {
    ...draft,
    ingredients: [...draft.ingredients, ...picked],
    steps: draft.steps.filter((l) => !ids.has(l.id)),
    notes: draft.notes.filter((l) => !ids.has(l.id)),
  };
}

export interface BuildContext {
  id: string;
  stage: StageId;
  from: ImportedInfo['from'];
  url: string;
  originalText: string;
  today: string;
  cleared: ClearedMention[];
  /** Leave out hidden notes (for Save). The safety screen builds with them. */
  omitHidden?: boolean;
}

/**
 * The Recipe the preview stands for (Requirements 6.7, 6.8, 6.9): the child's
 * stage, all four meal types, a guessed grocery category per ingredient and a
 * texture note for the stage. Used both for the live safety screen and for
 * Save, so what the user sees checked is what gets saved.
 */
export function buildRecipe(draft: Draft, ctx: BuildContext): Recipe {
  const imported: ImportedInfo = {
    from: ctx.from,
    text: ctx.originalText,
    date: ctx.today,
  };
  if (ctx.url.trim() !== '') imported.url = ctx.url.trim();
  const recipe: Recipe = {
    id: ctx.id,
    origin: 'custom',
    title: draft.title.trim() === '' ? DEFAULT_TITLE : draft.title.trim(),
    stages: [ctx.stage],
    mealTypes: [...ALL_MEAL_TYPES],
    ingredients: draft.ingredients
      .filter((l) => l.text.trim() !== '')
      .map((l) => ingredientFromText(l.text)),
    steps: draft.steps.map((l) => l.text.trim()).filter((t) => t !== ''),
    texture: `As described in the recipe. ${STAGE_TEXTURE_HINTS[ctx.stage].hint}`,
    servings: draft.servings ?? 1,
    imported,
  };
  const notes = draft.notes
    .filter((l) => !(ctx.omitHidden && l.hidden))
    .map((l) => l.text.trim())
    .filter((t) => t !== '');
  if (notes.length > 0) recipe.notes = notes;
  if (draft.statedMinutes !== undefined) recipe.statedMinutes = draft.statedMinutes;
  if (ctx.cleared.length > 0) recipe.clearedMentions = ctx.cleared;
  return recipe;
}

/** A link is kept only if it is a plain web address; it is never fetched. */
export function isWebLink(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url.trim());
}
