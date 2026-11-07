// Shared helpers and wording for the onboarding flow (Onboarding.tsx) and the
// Settings page (Settings.tsx), kept in a non-component module so both pages
// (and their tests) import the SAME constants and derivations.
//
// HEALTH/SAFETY wording note: the UNDER_6_NOTICE (Req 1.4) and OVER_12_NOTICE
// (Req 1.5) strings below are the maintainer-approved final wording, signed off
// in GitHub issue #16. They are health wording, so change them only with
// maintainer sign-off.

import { ageInMonths } from '../../domain/age';
import { RULES } from '../../domain/safety/rules';
import type { AllergenGroup } from '../../domain/types';

// --- Health-adjacent notice wording (maintainer-approved, Req 1.4 / 1.5) ----

/**
 * Req 1.4 maintainer-approved wording: shown when the entered birth date
 * implies an age below 6 months. Onboarding/planning is still allowed; this is
 * a factual notice, not a block.
 */
export const UNDER_6_NOTICE =
  'Most babies start solids around 6 months. Talk to your pediatrician before starting solids.';

/**
 * Req 1.5 maintainer-approved wording: shown when the entered birth date
 * implies an age of 12 months or more. The safety rules still apply for the
 * child's actual age.
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

// --- Tried-foods checklist (shared source of truth) -------------------------

/** A single tried-foods checklist row: its food key and display label. */
export interface ChecklistItem {
  key: string;
  label: string;
}

/**
 * A few common non-allergen first foods offered AFTER the nine allergens. The
 * nine allergens are the firm Req 7.2 requirement; these are a convenience and
 * are keyed by a plain, simple food key (design "Foods and first tastes").
 * Shared between onboarding and Settings so there is one source of truth.
 *
 * NOTE (Task 8 follow-up): these plain keys must eventually line up with
 * whatever foodKeyFor derives from recipe ingredient names so tried foods map
 * to their doors. Kept simple/lowercase here in anticipation of that.
 */
export const OTHER_FIRST_FOODS: ReadonlyArray<ChecklistItem> = [
  { key: 'sweet potato', label: 'Sweet potato' },
  { key: 'carrot', label: 'Carrot' },
  { key: 'apple', label: 'Apple' },
  { key: 'banana', label: 'Banana' },
  { key: 'oat', label: 'Oats' },
  { key: 'avocado', label: 'Avocado' },
];

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
 * Whole-month age for a YYYY-MM-DD birth date relative to the plan's start date
 * (Req 1.2 / design: every age is computed from plan.startDate, NOT today), or
 * null when the birth date is empty. Used by the live notice in the forms so
 * the notice and the displayed "Current age" (from selectAgeMonths, which also
 * uses plan.startDate) always agree.
 */
export function ageMonthsForBirthDate(
  birthDate: string,
  startDate: string,
): number | null {
  if (!birthDate) return null;
  return ageInMonths(birthDate, startDate);
}
