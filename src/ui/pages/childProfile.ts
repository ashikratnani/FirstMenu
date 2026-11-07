// Shared helpers and wording for the onboarding flow (Onboarding.tsx) and the
// Settings page (Settings.tsx), kept in a non-component module so both pages
// (and their tests) import the SAME constants and derivations.
//
// ===========================================================================
// !!! PENDING MAINTAINER CONFIRMATION — DO NOT SHIP AS FINAL COPY !!!
//
// HEALTH/SAFETY wording note (autonomy.md "Stop and ask"): the under-6
// (Req 1.4) and 12+ (Req 1.5) notices below are health/safety wording. The
// requirements describe the CONDITION but give no verbatim string, so
// UNDER_6_NOTICE / OVER_12_NOTICE are an agent-authored CLOSE PARAPHRASE of the
// requirement text — kept deliberately minimal and factual, with NO extra
// guidance invented beyond Req 1.4 / 1.5.
//
// autonomy.md requires NEW health/safety wording to be routed through a
// maintainer "Decision needed:" issue before merge. This agent cannot open
// GitHub issues, so the orchestrator/maintainer MUST open:
//
//   "Decision needed: under-6 / 12+ notice wording"
//
// confirming or replacing the exact two strings below against Req 1.4 / 1.5.
// Until then treat this copy as PROVISIONAL. See the task findings for the
// quoted strings and requirement text. Do not add new health guidance here.
// ===========================================================================

import { ageInMonths } from '../../domain/age';
import { RULES } from '../../domain/safety/rules';
import type { AllergenGroup } from '../../domain/types';

// --- Health-adjacent notice wording (paraphrases Req 1.4 / 1.5) ------------

/**
 * Req 1.4 (paraphrase, pending maintainer confirmation): shown when the entered
 * birth date implies an age below 6 months. Onboarding/planning is still
 * allowed; this is a factual notice, not a block.
 */
export const UNDER_6_NOTICE =
  'Most babies start solids around 6 months. Talk to your pediatrician before starting solids.';

/**
 * Req 1.5 (paraphrase, pending maintainer confirmation): shown when the entered
 * birth date implies an age of 12 months or more. The safety rules still apply
 * for the child's actual age.
 */
export const OVER_12_NOTICE =
  'FirstMenu is designed for babies 6 to 12 months old.';

// --- Allergen checklist order (Req 7.2: the nine allergens listed first) ----

/**
 * The nine allergen groups, in the order the allergen rules declare them
 * (src/domain/safety/rules.ts). Derived from RULES rather than hardcoded so the
 * onboarding/Settings checklist can never drift from the rule table. Req 7.2
 * requires these nine to be listed FIRST in the tried-foods checklist.
 */
export const ALLERGEN_GROUPS: AllergenGroup[] = RULES.filter(
  (rule) => rule.kind === 'allergen' && rule.allergenGroup !== undefined,
).map((rule) => rule.allergenGroup as AllergenGroup);

/**
 * The food key under which a tried allergen is recorded (design "Foods and
 * first tastes": an allergen ingredient maps to `allergen:<group>`). Recording
 * a checked allergen here keeps Task 8's Foods page and the safety screen
 * reasoning about it consistently.
 */
export function allergenFoodKey(group: AllergenGroup): string {
  return `allergen:${group}`;
}

// --- Age helpers ------------------------------------------------------------

/** Today as YYYY-MM-DD in local time (matches storage.ts todayYmd seed). */
export function todayYmd(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Which age notice (if any) applies for a whole-month age. Returns null when
 * the age is in the designed 6-to-12-month range or when there is no age yet.
 */
export function noticeForAgeMonths(
  months: number | null,
): typeof UNDER_6_NOTICE | typeof OVER_12_NOTICE | null {
  if (months === null) return null;
  if (months < 6) return UNDER_6_NOTICE;
  if (months >= 12) return OVER_12_NOTICE;
  return null;
}

/**
 * Whole-month age for a YYYY-MM-DD birth date as of today (local time), or null
 * when the date is empty. Used by the live notice in the forms; the persisted,
 * plan-relative age shown elsewhere comes from selectAgeMonths.
 */
export function ageMonthsForBirthDate(
  birthDate: string,
  today: string = todayYmd(),
): number | null {
  if (!birthDate) return null;
  return ageInMonths(birthDate, today);
}
