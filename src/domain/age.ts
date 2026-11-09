import type { StageId, MealType } from './types';

interface YMD {
  year: number;
  month: number;
  day: number;
}

// Parse a YYYY-MM-DD string into integer parts, avoiding any timezone drift
// that would come from constructing a Date in the local zone.
function parseYMD(date: string): YMD {
  const [year, month, day] = date.split('-').map((part) => Number(part));
  return { year, month, day };
}

/**
 * Whole calendar months between two YYYY-MM-DD dates. A baby born 2026-01-15
 * is 9 months old on 2026-10-15 and 8 months old on 2026-10-14.
 */
export function ageInMonths(birthDate: string, onDate: string): number {
  const birth = parseYMD(birthDate);
  const on = parseYMD(onDate);

  let months = (on.year - birth.year) * 12 + (on.month - birth.month);
  if (on.day < birth.day) {
    months -= 1;
  }
  return months;
}

/**
 * Age to stage (active spec Requirement 13.2): under 9 months `6-8`, 9 to 11
 * `9-12` (kept as the id for v1 data), 12 to 23 `12-23`, 24 and over `24-36`.
 */
export function stageFor(months: number): StageId {
  if (months < 9) return '6-8';
  if (months < 12) return '9-12';
  if (months < 24) return '12-23';
  return '24-36';
}

/** All stages, youngest first. */
export const STAGE_IDS: readonly StageId[] = ['6-8', '9-12', '12-23', '24-36'];

/** The youngest age in whole months at which each stage applies. */
export const STAGE_MIN_MONTHS: Record<StageId, number> = {
  '6-8': 6,
  '9-12': 9,
  '12-23': 12,
  '24-36': 24,
};

/** Stage labels (Requirement 13.2). `9-12` is labeled "9–11 months". */
export const STAGE_LABELS: Record<StageId, string> = {
  '6-8': '6–8 months',
  '9-12': '9–11 months',
  '12-23': '12–23 months',
  '24-36': '2–3 years',
};

/**
 * Texture hint per stage (Requirement 13.5), shown on recipe pages and used by
 * the prompt helper. Sources: CDC "When, what and how to introduce solid foods"
 * (CDC-solids) for the infant stages and CDC "Foods and drinks to encourage"
 * (CDC-encourage) for the toddler stages, as listed in the design.
 */
export const STAGE_TEXTURE_HINTS: Record<StageId, { hint: string; sourceUrl: string }> = {
  '6-8': {
    hint: 'smooth or well-mashed',
    sourceUrl:
      'https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/when-what-and-how-to-introduce-solid-foods.html',
  },
  '9-12': {
    hint: 'mashed, or soft small pieces to pick up',
    sourceUrl:
      'https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/when-what-and-how-to-introduce-solid-foods.html',
  },
  '12-23': {
    hint: 'soft, small, bite-sized pieces',
    sourceUrl:
      'https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/foods-and-drinks-to-encourage.html',
  },
  '24-36': {
    hint: 'small, bite-sized pieces',
    sourceUrl:
      'https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/foods-and-drinks-to-encourage.html',
  },
};

/**
 * Starting default meal slots for a stage (Requirements 8.2, 13.9). The user
 * can change them; these are only the defaults.
 */
export function defaultSlots(stage: StageId): MealType[] {
  return stage === '6-8'
    ? ['breakfast', 'dinner']
    : ['breakfast', 'lunch', 'dinner', 'snack'];
}
