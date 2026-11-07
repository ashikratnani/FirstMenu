// The safety screen: run the rule list against ingredient names and bucket the
// findings (design.md "Screen API"). Pure TS, no React.

import type { Recipe } from '../types';
import { matchesTerm } from './normalize';
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
  // Age limit: the rule applies only while age < underMonths.
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
