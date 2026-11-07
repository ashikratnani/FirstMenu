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

/** `< 9 -> '6-8'`, otherwise `'9-12'` (Requirement 1.3). */
export function stageFor(months: number): StageId {
  return months < 9 ? '6-8' : '9-12';
}

/**
 * Starting default meal slots for a stage (Requirement 8.2). The user can
 * change them; these are only the defaults.
 */
export function defaultSlots(stage: StageId): MealType[] {
  return stage === '6-8'
    ? ['breakfast', 'dinner']
    : ['breakfast', 'lunch', 'dinner', 'snack'];
}
