// The safety screen: run the rule list against ingredient names and bucket the
// findings (design.md "Screen API"). Pure TS, no React.

import type { Recipe } from '../types';
import { matchesTerm, termMatchesTokens, tokenize } from './normalize';
import { RULES, type RuleKind, type SafetyRule } from './rules';

export interface Finding {
  ruleId: string;
  kind: RuleKind;
  ingredientIndex: number;
  ingredientName: string;
  label: string;
  message: string;
  availableAtMonths?: number;
}

export interface ScreenResult {
  blocks: Finding[];
  reminders: Finding[];
  allergens: Finding[];
}

/**
 * Normalize a possibly-bad age to the strictest interpretation. A NaN or
 * negative age is treated as 0 (youngest), so a bad value can never silently
 * disable an age-limited rule. Allowed-stricter, never looser.
 */
function safeAge(ageMonths: number): number {
  if (!Number.isFinite(ageMonths) || ageMonths < 0) return 0;
  return ageMonths;
}

/** Does any of `terms` match the ingredient name? */
function anyTermMatches(name: string, terms: string[] | undefined): boolean {
  if (!terms) return false;
  return terms.some((term) => matchesTerm(name, term));
}

/** Does this rule fire for `name` at `ageMonths`? */
function ruleFires(rule: SafetyRule, name: string, ageMonths: number): boolean {
  // Age window: the rule applies while fromMonths <= age < underMonths.
  if (rule.fromMonths !== undefined && ageMonths < rule.fromMonths) {
    return false;
  }
  if (rule.underMonths !== undefined && ageMonths >= rule.underMonths) {
    return false;
  }
  // Exceptions suppress the rule.
  if (anyTermMatches(name, rule.except)) {
    return false;
  }
  return anyTermMatches(name, rule.terms);
}

/**
 * Screen a single ingredient name at an age. Returns one Finding per rule that
 * fires. `ingredientIndex` is 0 here; `screenRecipe` sets the real index.
 */
export function screenIngredient(name: string, ageMonths: number): Finding[] {
  const age = safeAge(ageMonths);
  const findings: Finding[] = [];

  for (const rule of RULES) {
    if (!ruleFires(rule, name, age)) continue;

    const finding: Finding = {
      ruleId: rule.id,
      kind: rule.kind,
      ingredientIndex: 0,
      ingredientName: name,
      label: rule.label,
      message: rule.message,
    };
    // Block and reminder rules with an age limit tell the user when the food
    // becomes available. Allergen rules have no age limit.
    if (rule.underMonths !== undefined && rule.kind !== 'allergen') {
      finding.availableAtMonths = rule.underMonths;
    }
    findings.push(finding);
  }

  return findings;
}

/**
 * Screen every ingredient in a recipe and bucket findings by kind. Reminders
 * are de-duplicated by message per ingredient (the same ingredient producing
 * the same reminder message appears once). The ghosting decision (blocks > 0,
 * or a food with a reaction) belongs to callers.
 */
export function screenRecipe(recipe: Recipe, ageMonths: number): ScreenResult {
  const age = safeAge(ageMonths);
  const result: ScreenResult = { blocks: [], reminders: [], allergens: [] };

  recipe.ingredients.forEach((ingredient, index) => {
    const seenReminderMessages = new Set<string>();

    for (const finding of screenIngredient(ingredient.name, age)) {
      const withIndex: Finding = { ...finding, ingredientIndex: index };

      switch (withIndex.kind) {
        case 'block':
          result.blocks.push(withIndex);
          break;
        case 'reminder':
          if (seenReminderMessages.has(withIndex.message)) break;
          seenReminderMessages.add(withIndex.message);
          result.reminders.push(withIndex);
          break;
        case 'allergen':
          result.allergens.push(withIndex);
          break;
      }
    }
  });

  return result;
}

// ---------------------------------------------------------------------------
// Text mentions in pasted recipes (active spec design.md "Safety screen for
// pasted recipes"; Requirement 7). Block rules only, read against the title,
// steps and notes of a recipe with `imported` set. There is deliberately NO
// negation handling ("no salt", "without honey" still fire): the user clears a
// false alarm with a tap, which is recorded in `recipe.clearedMentions`.
// ---------------------------------------------------------------------------

export interface TextMention {
  ruleId: string;
  label: string;
  message: string;
  sentence: string;
  where: 'title' | 'step' | 'note';
}

/**
 * Split text into sentences. A sentence ends at ".", "!" or "?" followed by
 * whitespace or the end (so "1.5 cups" stays whole), or at a line break. The
 * sentence text is the trimmed slice, which is the key stored when a mention
 * is cleared, so it must be deterministic.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '');
}

/**
 * Does the block rule fire in `sentence`? An exception word suppresses a match
 * only when it sits right next to that match ("lemon juice", "sugar snap",
 * "xanthan gum"). A sentence-wide exception would let "squeeze a lemon, add
 * apple juice" through, so exceptions are local here: stricter than ingredient
 * names, never looser.
 */
function sentenceFires(rule: SafetyRule, sentenceTokens: string[]): boolean {
  const exceptions = (rule.except ?? []).map((e) => tokenize(e));
  for (const term of rule.terms ?? []) {
    const termTokens = tokenize(term);
    if (termTokens.length === 0) continue;
    for (let start = 0; start + termTokens.length <= sentenceTokens.length; start++) {
      const end = start + termTokens.length;
      if (!termMatchesTokens(sentenceTokens.slice(start, end), termTokens)) continue;
      const excepted = exceptions.some(
        (ex) =>
          ex.length > 0 &&
          ((start - ex.length >= 0 &&
            termMatchesTokens(sentenceTokens.slice(start - ex.length, start), ex)) ||
            (end + ex.length <= sentenceTokens.length &&
              termMatchesTokens(sentenceTokens.slice(end, end + ex.length), ex))),
      );
      if (!excepted) return true;
    }
  }
  return false;
}

/** Is the child's age inside the rule's window (fromMonths <= age < underMonths)? */
function inAgeWindow(rule: SafetyRule, age: number): boolean {
  if (rule.fromMonths !== undefined && age < rule.fromMonths) return false;
  if (rule.underMonths !== undefined && age >= rule.underMonths) return false;
  return true;
}

/**
 * Does any block rule fire in `text`, whatever the child's age? The paste
 * parser uses this to keep caption filler lines that mention a block food.
 * Age-agnostic is the strictest reading, so it can only keep more lines.
 */
export function textMentionsBlockFood(text: string): boolean {
  return splitSentences(text).some((sentence) => {
    const tokens = tokenize(sentence);
    return RULES.some((rule) => rule.kind === 'block' && sentenceFires(rule, tokens));
  });
}

/**
 * Block rules found in the title, steps and notes of a pasted recipe. Returns
 * nothing for a recipe without `imported`. A rule that already has a block
 * finding from the ingredient list is skipped (that finding is the one to fix,
 * and it can't be cleared). Mentions in `recipe.clearedMentions` (same rule and
 * exact same sentence) are dropped, so editing a sentence brings it back.
 */
export function screenTextMentions(recipe: Recipe, ageMonths: number): TextMention[] {
  if (!recipe.imported) return [];
  const age = safeAge(ageMonths);
  const blockedByIngredient = new Set(screenRecipe(recipe, age).blocks.map((b) => b.ruleId));
  const cleared = recipe.clearedMentions ?? [];

  const sources: Array<{ text: string; where: TextMention['where'] }> = [
    { text: recipe.title, where: 'title' },
    ...recipe.steps.map((text) => ({ text, where: 'step' as const })),
    ...(recipe.notes ?? []).map((text) => ({ text, where: 'note' as const })),
  ];

  const mentions: TextMention[] = [];
  for (const rule of RULES) {
    if (rule.kind !== 'block') continue;
    if (!inAgeWindow(rule, age)) continue;
    if (blockedByIngredient.has(rule.id)) continue;
    for (const source of sources) {
      for (const sentence of splitSentences(source.text)) {
        if (!sentenceFires(rule, tokenize(sentence))) continue;
        if (cleared.some((c) => c.ruleId === rule.id && c.sentence === sentence)) continue;
        mentions.push({
          ruleId: rule.id,
          label: rule.label,
          message: rule.message,
          sentence,
          where: source.where,
        });
      }
    }
  }
  return mentions;
}
