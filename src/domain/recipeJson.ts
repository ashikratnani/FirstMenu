// Recipe JSON reader (active spec design.md "Recipe JSON flow"; Requirements
// 18.2, 18.4 - 18.6, 18.9 - 18.11, 19.3, 19.4). Turns an AI chat reply that
// holds one JSON object into the same `ParsedRecipe` the paste parser makes, so
// the preview, the ingredient screen and `screenTextMentions` apply unchanged.
// Pure TS, no React, no network. Nothing inside the object is dropped
// unscreened: every string anywhere in it becomes recipe text, or the reply is
// rejected. Text outside the object is never recipe content.

import { z } from 'zod';
import { MAX_PASTE_CHARS, type ParsedIngredient, type ParsedLine, type ParsedRecipe } from './importText';
import { textMentionsBlockFood } from './safety/screen';

export const RECIPE_JSON_VERSION = 1;

/**
 * The reply template. One constant feeds the wrapped prompt, the reel prompt,
 * the fix-up prompt and the parser tests, so they cannot drift. Placeholder
 * values are generic on purpose: no real food names to nudge the AI.
 */
export const RECIPE_JSON_TEMPLATE = `{
  "firstmenu_recipe": 1,
  "title": "Recipe name",
  "total_minutes": 15,
  "servings": 2,
  "ingredients": [
    { "quantity": 1, "unit": "cup", "name": "ingredient name", "optional": false },
    { "quantity": null, "unit": null, "name": "another ingredient", "optional": true }
  ],
  "steps": ["First step.", "Second step."],
  "notes": ["A short tip."]
}`;

/** What the AI should reply when it cannot open a reel (Requirement 19.3). */
export const RECIPE_JSON_ERROR_TEMPLATE =
  '{ "firstmenu_recipe": 1, "error": "cannot_access", "message": "<why>" }';

// Limits (design step 5).
export const MAX_TITLE_CHARS = 120;
export const MAX_NAME_CHARS = 120;
export const MAX_INGREDIENTS = 60;
export const MAX_STEPS = 40;
export const MAX_NOTES = 20;
export const MAX_DEPTH = 6;
export const MAX_EXTRA_STRINGS = 50;
export const MAX_EXTRA_STRING_CHARS = 500;
const MAX_SCAN_STARTS = 200;

export interface JsonIssue {
  path: string;
  message: string;
}

export type JsonParseResult =
  | {
      kind: 'recipe';
      parsed: ParsedRecipe;
      /** Paths whose text was added to the notes (unknown keys, odd units). */
      extras: string[];
      /** True when text outside the object is long (over 200 chars) or has a second `{`. */
      outsideNotable: boolean;
    }
  | { kind: 'invalid'; errors: JsonIssue[] }
  | { kind: 'ai-error'; message: string }
  | { kind: 'no-json' };

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ingredientSchema = z.looseObject({
  name: z.string().min(1).max(MAX_NAME_CHARS),
  quantity: z.number().gt(0).nullable().optional(),
  unit: z.string().nullable().optional(),
  optional: z.boolean().optional(),
});

const recipeSchema = z.looseObject({
  firstmenu_recipe: z.literal(RECIPE_JSON_VERSION),
  title: z.string().min(1).max(MAX_TITLE_CHARS),
  total_minutes: z.number().min(1).max(1440).nullable().optional(),
  servings: z.number().min(1).max(50).nullable().optional(),
  ingredients: z.array(ingredientSchema).min(1).max(MAX_INGREDIENTS),
  steps: z.array(z.string().min(1)).min(1).max(MAX_STEPS),
  notes: z.array(z.string()).max(MAX_NOTES).optional(),
});

// ---------------------------------------------------------------------------
// Plain-language messages
// ---------------------------------------------------------------------------

function pathText(path: ReadonlyArray<PropertyKey>): string {
  let out = '';
  for (const part of path) {
    if (typeof part === 'number') out += `[${part}]`;
    else out += out === '' ? String(part) : `.${String(part)}`;
  }
  return out;
}

function valueAt(root: unknown, path: ReadonlyArray<PropertyKey>): unknown {
  let cur: unknown = root;
  for (const part of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[part];
  }
  return cur;
}

/** Last field name of a path, ignoring list indexes ("ingredients[2].quantity" -> "quantity"). */
function fieldOf(path: ReadonlyArray<PropertyKey>): string {
  for (let i = path.length - 1; i >= 0; i--) {
    if (typeof path[i] !== 'number') return String(path[i]);
  }
  return '';
}

const EXPECTED: Record<string, string> = {
  title: 'text',
  name: 'text',
  unit: 'text or null',
  quantity: 'a number such as 0.5',
  total_minutes: 'a number of minutes, or null',
  servings: 'a number, or null',
  optional: 'true or false',
  ingredients: 'a list of ingredients',
  steps: 'a list of text steps',
  notes: 'a list of text notes',
};

function describeValue(v: unknown): string {
  if (v === undefined) return 'it is missing';
  const json = JSON.stringify(v) ?? String(v);
  return `not ${json.length > 40 ? `${json.slice(0, 40)}...` : json}`;
}

function messageFor(issue: z.core.$ZodIssue, root: unknown): JsonIssue {
  const path = issue.path;
  const p = pathText(path) || 'the reply';
  const field = fieldOf(path);
  const value = valueAt(root, path);

  if (path.length === 1 && path[0] === 'firstmenu_recipe') {
    return {
      path: p,
      message: `firstmenu_recipe must be ${RECIPE_JSON_VERSION} (this is not a FirstMenu recipe, or it is another version)`,
    };
  }
  if (issue.code === 'invalid_type') {
    const expected = typeof path[path.length - 1] === 'number' ? 'text' : (EXPECTED[field] ?? 'a different type');
    const tail = value === undefined ? ' (it is missing)' : `, ${describeValue(value)}`;
    return { path: p, message: `${p} must be ${expected}${tail}` };
  }
  if (issue.code === 'too_small') {
    if (issue.origin === 'string') return { path: p, message: `${p} must not be empty` };
    if (issue.origin === 'array') {
      return { path: p, message: `${p} needs at least ${String(issue.minimum)} item${issue.minimum === 1 ? '' : 's'}` };
    }
    return {
      path: p,
      message: `${p} must be ${field === 'quantity' ? 'more than 0' : `at least ${String(issue.minimum)}`}, ${describeValue(value)}`,
    };
  }
  if (issue.code === 'too_big') {
    if (issue.origin === 'string') return { path: p, message: `${p} must be at most ${String(issue.maximum)} characters` };
    if (issue.origin === 'array') return { path: p, message: `${p} can have at most ${String(issue.maximum)} items` };
    return { path: p, message: `${p} must be at most ${String(issue.maximum)}, ${describeValue(value)}` };
  }
  return { path: p, message: `${p} is not valid` };
}

// ---------------------------------------------------------------------------
// Cleaning
// ---------------------------------------------------------------------------

/**
 * Trim, turn line breaks and tabs into spaces (so words never glue together
 * and hide from the screen) and remove other control and invisible format
 * characters (so a hidden character cannot split a food word). Markdown is
 * left as it is.
 */
export function cleanString(s: string): string {
  return s
    .replace(/[\t\r\n\u2028\u2029]+/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

class LimitError extends Error {}

class DuplicateKeyError extends Error {
  constructor(readonly path: string) {
    super(path);
  }
}

/** Key identity for the duplicate check: cleaned, then Unicode-normalised. */
function keyId(k: string): string {
  return cleanString(k).normalize('NFKC');
}

function duplicateIssue(path: string): JsonIssue {
  return { path, message: `\`${path}\` appears twice, so it is not clear which one to use. Keep one.` };
}

/** Deep copy with every string cleaned (keys too). Throws when nesting passes the depth limit. */
function cleanDeep(value: unknown, depth: number, parts: Array<string | number> = []): unknown {
  if (typeof value === 'string') return cleanString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) throw new LimitError();
  if (Array.isArray(value)) return value.map((v, i) => cleanDeep(v, depth + 1, [...parts, i]));
  const out: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const [k, v] of Object.entries(value)) {
    const id = keyId(k);
    const cleaned = cleanString(k);
    if (seen.has(id) || Object.prototype.hasOwnProperty.call(out, cleaned)) {
      throw new DuplicateKeyError(pathText([...parts, cleaned]));
    }
    seen.add(id);
    Object.defineProperty(out, cleaned, {
      value: cleanDeep(v, depth + 1, [...parts, cleaned]),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Finding the object
// ---------------------------------------------------------------------------

interface Candidate {
  value: Record<string, unknown>;
  start: number;
  end: number;
}

function tryObject(text: string, start: number, end: number): Candidate | null {
  try {
    const value: unknown = JSON.parse(text.slice(start, end));
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return { value: value as Record<string, unknown>, start, end };
    }
  } catch {
    // not JSON: the caller tries the next candidate
  }
  return null;
}

/**
 * Path of the first key that appears twice in one object of `json`, or null.
 * JSON.parse hides repeated keys (the last wins), so this scans the raw text
 * itself. `json` must already be valid JSON. Keys are compared after decoding
 * escapes, cleaning and Unicode normalisation.
 */
function findDuplicateKey(json: string): string | null {
  let i = 0;
  const ws = (): void => {
    while (i < json.length && /\s/.test(json[i])) i++;
  };
  const readString = (): string => {
    const begin = i++;
    while (json[i] !== '"') i += json[i] === '\\' ? 2 : 1;
    i++;
    return JSON.parse(json.slice(begin, i)) as string;
  };
  const value = (parts: Array<string | number>): string | null => {
    ws();
    const c = json[i];
    if (c === '{') {
      i++;
      const seen = new Set<string>();
      ws();
      if (json[i] === '}') {
        i++;
        return null;
      }
      for (;;) {
        ws();
        const key = readString();
        const here = [...parts, cleanString(key)];
        const id = keyId(key);
        if (seen.has(id)) return pathText(here);
        seen.add(id);
        ws();
        i++; // :
        const dup = value(here);
        if (dup) return dup;
        ws();
        if (json[i++] === '}') return null;
      }
    }
    if (c === '[') {
      i++;
      ws();
      if (json[i] === ']') {
        i++;
        return null;
      }
      for (let n = 0; ; n++) {
        const dup = value([...parts, n]);
        if (dup) return dup;
        ws();
        if (json[i++] === ']') return null;
      }
    }
    if (c === '"') {
      readString();
      return null;
    }
    while (i < json.length && !/[,\]}\s]/.test(json[i])) i++;
    return null;
  };
  return value([]);
}

/** End index (exclusive) of the balanced object starting at `start`, string-aware; -1 if none. */
function balancedEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function findObject(text: string): Candidate | null {
  // 1. The whole trimmed text.
  const lead = text.length - text.trimStart().length;
  const whole = tryObject(text, lead, lead + text.trim().length);
  if (whole) return whole;

  // 2. The first markdown code fence.
  const fence = /```[^\n`]*\n?([\s\S]*?)```/.exec(text);
  if (fence) {
    const inner = fence[1];
    const innerStart = fence.index + fence[0].indexOf(inner, 3);
    const innerLead = inner.length - inner.trimStart().length;
    const found = tryObject(text, innerStart + innerLead, innerStart + innerLead + inner.trim().length);
    if (found) return found;
  }

  // 3. Balanced objects found by a scan, first that parses wins.
  // A `{` that never closes (a stray brace in the chat text) is skipped; the
  // number of starts tried is capped so a wall of braces stays cheap.
  // After an unclosed `{`, a candidate must carry the `firstmenu_recipe` key:
  // otherwise an inner piece of a cut-off reply (one ingredient object) would
  // be taken for the whole reply.
  let skippedUnclosed = false;
  let from = text.indexOf('{');
  for (let tries = 0; from !== -1 && tries < MAX_SCAN_STARTS; tries++) {
    const end = balancedEnd(text, from);
    if (end === -1) {
      skippedUnclosed = true;
      from = text.indexOf('{', from + 1);
      continue;
    }
    const found = tryObject(text, from, end);
    if (found && (!skippedUnclosed || 'firstmenu_recipe' in found.value)) return found;
    from = text.indexOf('{', end);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Extra text (Requirement 18.9)
// ---------------------------------------------------------------------------

interface Extras {
  notes: string[];
  paths: string[];
}

const TOO_MUCH_EXTRA = 'The reply has too much extra text';

/** True when `path` is a defined field whose text is already read as recipe content. */
function isDefinedPath(parts: ReadonlyArray<string | number>): boolean {
  const [a, b, c] = parts;
  if (parts.length === 1) return a === 'firstmenu_recipe' || a === 'title' || a === 'total_minutes' || a === 'servings';
  if (parts.length === 2) return (a === 'steps' || a === 'notes') && typeof b === 'number';
  if (parts.length === 3 && a === 'ingredients' && typeof b === 'number') {
    return c === 'name' || c === 'quantity' || c === 'unit' || c === 'optional';
  }
  return false;
}

function collectExtras(root: Record<string, unknown>): Extras | null {
  const notes: string[] = [];
  const paths: string[] = [];
  let tooMuch = false;

  const visit = (value: unknown, parts: Array<string | number>): void => {
    if (tooMuch) return;
    if (isDefinedPath(parts)) return;
    if (typeof value === 'string') {
      if (value === '') {
        // No text to read, but the key may name a food ("honey": ""): screen it.
        const emptyPath = pathText(parts);
        if (textMentionsBlockFood(emptyPath)) {
          if (notes.length >= MAX_EXTRA_STRINGS) {
            tooMuch = true;
            return;
          }
          notes.push(`${emptyPath}: ""`);
          paths.push(emptyPath);
        }
        return;
      }
      if (value.length > MAX_EXTRA_STRING_CHARS || notes.length >= MAX_EXTRA_STRINGS) {
        tooMuch = true;
        return;
      }
      const path = pathText(parts);
      notes.push(`${path}: ${value}`);
      paths.push(path);
      return;
    }
    const isContainer = value !== null && typeof value === 'object';
    const entries = !isContainer
      ? []
      : Array.isArray(value)
        ? value.map((v, i): [string | number, unknown] => [i, v])
        : Object.entries(value as Record<string, unknown>);
    if (entries.length > 0) {
      for (const [k, v] of entries) visit(v, [...parts, k]);
      return;
    }
    // A number, boolean, null or empty container carries no text, except that
    // its key may name a food ("honey": true): screen the key then.
    const path = pathText(parts);
    if (textMentionsBlockFood(path)) {
      if (notes.length >= MAX_EXTRA_STRINGS) {
        tooMuch = true;
        return;
      }
      notes.push(`${path}: ${JSON.stringify(value)}`);
      paths.push(path);
    }
  };

  for (const [k, v] of Object.entries(root)) visit(v, [k]);
  return tooMuch ? null : { notes, paths };
}

// ---------------------------------------------------------------------------
// parseRecipeReply
// ---------------------------------------------------------------------------

const UNREADABLE =
  "The JSON couldn't be read (check for a cut-off reply or curly quotes). Curly quotes are not repaired.";

function invalid(...errors: JsonIssue[]): JsonParseResult {
  return { kind: 'invalid', errors };
}

function outsideNotable(text: string, c: Candidate): boolean {
  const outside = (text.slice(0, c.start) + ' ' + text.slice(c.end)).replace(/```[^\n`]*/g, '').trim();
  return outside.length > 200 || outside.includes('{');
}

export function parseRecipeReply(text: string): JsonParseResult {
  if (text.trim() === '') return { kind: 'no-json' };
  if (text.length > MAX_PASTE_CHARS) {
    return invalid({ path: '', message: 'The text is too long to read (over 20,000 characters).' });
  }

  const found = findObject(text);
  if (!found) {
    if (!text.includes('{')) return { kind: 'no-json' };
    return invalid({ path: '', message: UNREADABLE });
  }

  const duplicate = findDuplicateKey(text.slice(found.start, found.end));
  if (duplicate !== null) return invalid(duplicateIssue(duplicate));

  let data: Record<string, unknown>;
  try {
    data = cleanDeep(found.value, 0) as Record<string, unknown>;
  } catch (e) {
    if (e instanceof DuplicateKeyError) return invalid(duplicateIssue(e.path));
    return invalid({ path: '', message: TOO_MUCH_EXTRA });
  }

  // Failure to open a reel (Requirement 19.7).
  if (data.firstmenu_recipe === RECIPE_JSON_VERSION && typeof data.error === 'string' && !('ingredients' in data)) {
    const why = typeof data.message === 'string' && data.message !== '' ? data.message : '';
    return { kind: 'ai-error', message: why.slice(0, MAX_EXTRA_STRING_CHARS) };
  }

  const checked = recipeSchema.safeParse(data);
  if (!checked.success) {
    return invalid(...checked.error.issues.map((issue) => messageFor(issue, data)));
  }
  const r = checked.data;

  const extras = collectExtras(data);
  if (!extras) return invalid({ path: '', message: TOO_MUCH_EXTRA });

  let line = 0;
  const ingredients: ParsedIngredient[] = [];
  const unitNotes: string[] = [];
  const unitPaths: string[] = [];
  let unitTooLong = false;
  r.ingredients.forEach((ing, i) => {
    const out: ParsedIngredient = { name: ing.name, optional: ing.optional === true, line: ++line };
    if (typeof ing.quantity === 'number') out.quantity = Math.round(ing.quantity * 1000) / 1000;
    const unit = ing.unit ?? '';
    if (unit !== '') {
      if (unit.length > MAX_EXTRA_STRING_CHARS) unitTooLong = true;
      out.unit = unit;
      if (/\p{L}/u.test(unit)) {
        // The ingredient screen reads names only, so the unit goes through the
        // text-mention path as a note (Requirement 18.9).
        const path = `ingredients[${i}].unit`;
        unitNotes.push(`${path}: ${unit}`);
        if (!/^\p{L}+$/u.test(unit) || textMentionsBlockFood(unit)) unitPaths.push(path);
      }
    }
    ingredients.push(out);
  });
  if (unitTooLong) return invalid({ path: '', message: TOO_MUCH_EXTRA });

  const steps: ParsedLine[] = r.steps.map((t) => ({ text: t, line: ++line }));
  const noteTexts = [...(r.notes ?? []).filter((n) => n !== ''), ...extras.notes, ...unitNotes];
  const notes: ParsedLine[] = noteTexts.map((t) => ({ text: t, line: ++line }));

  const parsed: ParsedRecipe = { title: r.title, ingredients, steps, notes, warnings: [] };
  if (typeof r.total_minutes === 'number') parsed.statedMinutes = Math.round(r.total_minutes);
  if (typeof r.servings === 'number') parsed.servings = Math.round(r.servings);

  return {
    kind: 'recipe',
    parsed,
    extras: [...extras.paths, ...unitPaths],
    outsideNotable: outsideNotable(text, found),
  };
}
