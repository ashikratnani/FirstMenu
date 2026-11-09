import type { Ingredient, Recipe } from './types';

// Time and effort (design.md, "Time and effort"). Both are computed from the
// recipe, never stored (Requirement 10.3).

export type Effort = 'easy' | 'medium' | 'more';

export interface RecipeTime {
  minutes: number;
  kind: 'stated' | 'estimated';
}

// Numbers: "1 1/2", "1/2", "2.5", "20". Never the tail of a fraction or decimal.
const NUM = '(?<![\\d/.])(\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:\\.\\d+)?)(?![\\d/])';
// "20-25 minutes", "2 to 3 minutes", "1 hour", "30 mins", "2 hrs".
const DURATION = new RegExp(
  `${NUM}(?:\\s*(?:-|\u2013|\u2014|to)\\s*${NUM})?\\s*(minutes?|mins?|hours?|hrs?)\\b`,
  'gi',
);
const EACH_SIDE = /\b(?:per|each|the other) side\b/i;
// An "or" links two durations when it opens the last comma-separated piece
// between them (", or microwave about ") and no sentence ends in between.
// "Bake 20 minutes or until golden, then rest 5 minutes" is not a link.
const CLAUSE_WORD = /\b(?:until|then|and)\b/i;

function joinedByOr(between: string): boolean {
  if (/[.;]/.test(between)) return false;
  const piece = between.slice(between.lastIndexOf(',') + 1);
  return /^\s*\(?\s*or\b/i.test(piece) && !CLAUSE_WORD.test(piece);
}

function parseNum(s: string): number {
  const frac = s.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1] ?? 0) + Number(frac[2]) / Number(frac[3]);
  return Number(s);
}

interface Found {
  start: number;
  end: number;
  minutes: number;
}

function durationsIn(step: string): Found[] {
  const found: Found[] = [];
  for (const m of step.matchAll(DURATION)) {
    const upper = parseNum(m[2] ?? m[1]);
    const perUnit = m[3].toLowerCase().startsWith('h') ? 60 : 1;
    let minutes = upper * perUnit;
    // The clause around the duration decides "per side" (counts twice). A
    // clause runs between sentence ends or commas. "the other side" implies
    // a first side was cooked for the same time.
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const clauseStart = Math.max(
      step.lastIndexOf(',', start),
      step.lastIndexOf('.', start),
      step.lastIndexOf(';', start),
    ) + 1;
    const nextBreak = step.slice(end).search(/[,.;]/);
    const clauseEnd = nextBreak === -1 ? step.length : end + nextBreak;
    if (EACH_SIDE.test(step.slice(clauseStart, clauseEnd))) minutes *= 2;
    found.push({ start, end, minutes });
  }
  return found;
}

/** Time of one step: durations joined by "or" are alternatives (smallest wins), others add up. */
function stepMinutes(step: string): number | undefined {
  const found = durationsIn(step);
  if (found.length === 0) return undefined;
  let total = 0;
  let group: number[] = [found[0].minutes];
  for (let i = 1; i < found.length; i++) {
    const between = step.slice(found[i - 1].end, found[i].start);
    if (joinedByOr(between)) {
      group.push(found[i].minutes);
    } else {
      total += Math.min(...group);
      group = [found[i].minutes];
    }
  }
  total += Math.min(...group);
  return total;
}

/**
 * Stated time if the recipe has one, otherwise 5 minutes of setup plus the
 * durations in the steps, rounded up to the next 5. Undefined when neither.
 */
export function recipeMinutes(recipe: Recipe): RecipeTime | undefined {
  if (recipe.statedMinutes !== undefined && recipe.statedMinutes > 0) {
    return { minutes: recipe.statedMinutes, kind: 'stated' };
  }
  let sum = 0;
  let any = false;
  for (const step of recipe.steps) {
    const m = stepMinutes(step);
    if (m !== undefined) {
      sum += m;
      any = true;
    }
  }
  if (!any) return undefined;
  return { minutes: Math.ceil((5 + sum) / 5) * 5, kind: 'estimated' };
}

function isOptional(ing: Ingredient): boolean {
  return ing.optional === true || /\(\s*optional\s*\)/i.test(ing.name);
}

const OVEN_WORDS = /\b(?:oven|bake|baked|baking|roast|roasted|roasting)\b/i;

/** Easy, Medium or More from required ingredients, step count and oven use. */
export function recipeEffort(recipe: Recipe): Effort {
  const required = recipe.ingredients.filter((i) => !isOptional(i)).length;
  const steps = recipe.steps.length;
  if (required > 8 || steps > 7) return 'more';
  const oven = recipe.steps.some((s) => OVEN_WORDS.test(s));
  if (required <= 5 && steps <= 4 && !oven) return 'easy';
  return 'medium';
}
