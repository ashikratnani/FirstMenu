// Recipe share links (active spec Requirement 9). Pure TS, no React. A link
// carries ONE recipe in the URL fragment (`#/r/<data>`), so it never reaches
// the host.
//
// Privacy (Req 9.5): the payload is built from an allow-list of recipe fields.
// It has no child fields at all (no name, birth date, age, food records), and
// it drops the original pasted text (`imported`), the user's pasted link,
// cleared mentions, the pasted "notes" lines and the recipe id. The share text
// is built from the same stripped recipe. Prep reminders in the text are read
// at the youngest age of the recipe's stages, so they do not depend on the
// sender's child.
//
// Untrusted boundary: decodeRecipeShare checks the length of the fragment,
// decompresses, checks the size of the JSON, then validates it with zod
// (strict objects, bounded strings and lists). Anything else returns
// { ok: false } and never partial data.

import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';
import { z } from 'zod';

import { STAGE_MIN_MONTHS } from './age';
import { screenRecipe } from './safety/screen';
import { recipeSchema } from './storage';
import type { Ingredient, Recipe, RecipeSource } from './types';

/** Base of the shared-recipe URL; the encoded fragment is appended. */
export const RECIPE_SHARE_BASE_URL = 'https://ashikratnani.github.io/FirstMenu/#/r/';

/** Longest fragment decodeRecipeShare will try to read. */
export const MAX_RECIPE_SHARE_FRAGMENT = 8000;

/** Longest decompressed JSON decodeRecipeShare will parse. */
export const MAX_RECIPE_SHARE_JSON = 40000;

/** The closing line of the share text (Req 9.3). */
export const RECIPE_SHARE_FOOTER =
  'Shared from FirstMenu. Not medical advice; check with your pediatrician.';

/** The recipe fields a link carries. No id, no `imported`, no notes. */
export type SharedRecipe = Pick<
  Recipe,
  | 'title'
  | 'stages'
  | 'mealTypes'
  | 'ingredients'
  | 'steps'
  | 'texture'
  | 'servings'
  | 'storage'
  | 'makeAheadNote'
  | 'statedMinutes'
  | 'kind'
  | 'serveAs'
  | 'source'
>;

export interface RecipeSharePayload {
  v: 1;
  recipe: SharedRecipe;
}

/** Copy only the allow-listed fields (and only those that are set). */
export function buildRecipeSharePayload(recipe: Recipe): RecipeSharePayload {
  const shared: SharedRecipe = {
    title: recipe.title,
    stages: [...recipe.stages],
    mealTypes: [...recipe.mealTypes],
    ingredients: recipe.ingredients.map((i) => ({ ...i })),
    steps: [...recipe.steps],
    texture: recipe.texture,
    servings: recipe.servings,
  };
  if (recipe.storage) shared.storage = { ...recipe.storage };
  if (recipe.makeAheadNote !== undefined) shared.makeAheadNote = recipe.makeAheadNote;
  if (recipe.statedMinutes !== undefined) shared.statedMinutes = recipe.statedMinutes;
  if (recipe.kind !== undefined) shared.kind = recipe.kind;
  if (recipe.serveAs) shared.serveAs = [...recipe.serveAs];
  if (recipe.origin === 'builtin' && recipe.source) {
    shared.source = { ...recipe.source, adaptations: [...recipe.source.adaptations] };
  }
  return { v: 1, recipe: shared };
}

export interface EncodedRecipeShare {
  url: string;
  encoded: string;
}

/** JSON -> lz-string -> RECIPE_SHARE_BASE_URL + fragment. */
export function encodeRecipeShare(recipe: Recipe): EncodedRecipeShare {
  const encoded = compressToEncodedURIComponent(JSON.stringify(buildRecipeSharePayload(recipe)));
  return { url: RECIPE_SHARE_BASE_URL + encoded, encoded };
}

// Bounds for a link from outside. Generous for real recipes, small enough that
// a crafted link cannot make the page render something huge.
const text = (max: number) => z.string().max(max);

const base = recipeSchema.shape;

const sharedRecipeSchema = z
  .object({
    title: text(200).refine((t) => t.trim().length > 0),
    stages: base.stages.min(1).max(4),
    mealTypes: base.mealTypes.max(4),
    ingredients: z
      .array(base.ingredients.element.omit({ food: true }).extend({ name: text(200) }).strict())
      .min(1)
      .max(60),
    steps: z.array(text(2000)).min(1).max(60),
    texture: text(200),
    servings: z.number().min(0).max(1000),
    storage: z
      .object({
        fridgeDays: z.number().min(0).max(1000).optional(),
        freezerMonths: z.number().min(0).max(1000).optional(),
      })
      .strict()
      .optional(),
    makeAheadNote: text(1000).optional(),
    statedMinutes: z.number().min(0).max(100000).optional(),
    kind: base.kind,
    serveAs: base.serveAs.unwrap().max(4).optional(),
    // Accepted so links from built-in recipes still open, but never kept:
    // decodeRecipeShare drops it, so a link cannot show a publisher or URL.
    source: z.unknown().optional(),
  })
  .strict();

const recipeSharePayloadSchema = z
  .object({ v: z.literal(1), recipe: sharedRecipeSchema })
  .strict();

// Fails to compile if the schema and the hand-written types drift apart.
type SchemaPayload = z.infer<typeof recipeSharePayloadSchema>;
const _schemaMatchesType: RecipeSharePayload extends SchemaPayload ? true : never = true;
void _schemaMatchesType;

export type DecodeRecipeShareResult =
  | { ok: true; payload: RecipeSharePayload }
  | { ok: false };

/** Decode and validate a fragment. Any problem returns { ok: false }. */
export function decodeRecipeShare(fragment: string): DecodeRecipeShareResult {
  if (!fragment || fragment.length > MAX_RECIPE_SHARE_FRAGMENT) return { ok: false };

  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(fragment);
  } catch {
    return { ok: false };
  }
  if (!json || json.length > MAX_RECIPE_SHARE_JSON) return { ok: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false };
  }

  const result = recipeSharePayloadSchema.safeParse(parsed);
  if (!result.success) return { ok: false };
  const { source: _dropped, ...recipe } = result.data.recipe;
  void _dropped;
  return { ok: true, payload: { v: 1, recipe: recipe as SharedRecipe } };
}

/**
 * The recipe a recipient saves. It is a custom recipe (never a source or
 * publisher) marked as pasted (`imported`, from 'shared', original text = the
 * share text), so the screen reads its
 * title, steps and notes for the recipient's child and the user must clear any
 * mention with a tap (Req 9.6).
 */
export function recipeFromShare(shared: SharedRecipe, id: string, today: string): Recipe {
  const { source: _source, ...rest } = shared;
  void _source;
  const recipe: Recipe = {
    ...rest,
    id,
    origin: 'custom',
    imported: { from: 'shared', text: '', date: today },
  };
  recipe.imported = { from: 'shared', text: recipeShareText(recipe), date: today };
  return recipe;
}

function ingredientLine(ingredient: Ingredient): string {
  const qty =
    ingredient.quantity === undefined
      ? ''
      : ingredient.unit
        ? `${ingredient.quantity} ${ingredient.unit} `
        : `${ingredient.quantity} `;
  return `- ${qty}${ingredient.name}${ingredient.optional ? ' (optional)' : ''}`;
}

function sourceLine(source: RecipeSource): string {
  return `Source: ${source.title}, ${source.publisher} ${source.url}`;
}

/** Youngest age (in months) of the recipe's stages; 6 when it has none. */
function reminderAge(recipe: SharedRecipe): number {
  const ages = recipe.stages.map((s) => STAGE_MIN_MONTHS[s]);
  return ages.length > 0 ? Math.min(...ages) : 6;
}

/**
 * The share text: title, ingredients, steps, prep reminders, the source (for
 * built-in recipes) and the closing line (Req 9.3). Built from the stripped
 * payload, so it cannot carry anything the link does not.
 */
export function recipeShareText(recipe: Recipe): string {
  const { recipe: shared } = buildRecipeSharePayload(recipe);
  const reminders = screenRecipe(
    { ...shared, id: '', origin: 'custom' },
    reminderAge(shared),
  ).reminders.map((r) => `- ${r.ingredientName}: ${r.message}`);

  const lines: string[] = [shared.title, '', 'Ingredients', ...shared.ingredients.map(ingredientLine)];
  lines.push('', 'Steps', ...shared.steps.map((s, i) => `${i + 1}. ${s}`));
  if (reminders.length > 0) lines.push('', 'Prep reminders', ...reminders);
  if (recipe.origin === 'builtin' && shared.source) lines.push('', sourceLine(shared.source));
  lines.push('', RECIPE_SHARE_FOOTER);
  return lines.join('\n');
}
