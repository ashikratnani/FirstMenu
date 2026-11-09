import { describe, expect, it } from 'vitest';
import {
  STAGE_IDS,
  STAGE_LABELS,
  STAGE_MIN_MONTHS,
  STAGE_TEXTURE_HINTS,
  ageInMonths,
  defaultSlots,
  stageFor,
} from './age';

describe('ageInMonths', () => {
  it('matches the design boundary example (born 2026-01-15)', () => {
    // 8 months the day before the 15th, 9 months on the 15th.
    expect(ageInMonths('2026-01-15', '2026-10-14')).toBe(8);
    expect(ageInMonths('2026-01-15', '2026-10-15')).toBe(9);
  });

  it('counts an exact month on the same day-of-month', () => {
    expect(ageInMonths('2026-01-15', '2026-02-15')).toBe(1);
    expect(ageInMonths('2026-01-15', '2027-01-15')).toBe(12);
  });

  it('returns 0 on the birth date itself', () => {
    expect(ageInMonths('2026-01-15', '2026-01-15')).toBe(0);
  });

  it('handles end-of-month birthdays (born Jan 31)', () => {
    // Feb has no 31st, so the baby is not a full month old until Mar 1.
    expect(ageInMonths('2026-01-31', '2026-02-28')).toBe(0);
    expect(ageInMonths('2026-01-31', '2026-03-01')).toBe(1);
    expect(ageInMonths('2026-01-31', '2026-03-31')).toBe(2);
  });

  it('handles leap-year birthdays (born 2024-02-29)', () => {
    // 2025 is not a leap year, so Feb 28 is still short of a full year.
    expect(ageInMonths('2024-02-29', '2025-02-28')).toBe(11);
    expect(ageInMonths('2024-02-29', '2025-03-01')).toBe(12);
    // Same day-of-month within a leap year.
    expect(ageInMonths('2024-02-29', '2024-08-29')).toBe(6);
  });
});

describe('stageFor', () => {
  it('returns 6-8 below 9 months and 9-12 from 9 months', () => {
    expect(stageFor(6)).toBe('6-8');
    expect(stageFor(8)).toBe('6-8');
    expect(stageFor(9)).toBe('9-12');
    expect(stageFor(10)).toBe('9-12');
  });

  it('maps the toddler boundaries at 11/12 and 23/24 months', () => {
    expect(stageFor(11)).toBe('9-12');
    expect(stageFor(12)).toBe('12-23');
    expect(stageFor(23)).toBe('12-23');
    expect(stageFor(24)).toBe('24-36');
    expect(stageFor(36)).toBe('24-36');
    expect(stageFor(50)).toBe('24-36');
  });

  it('agrees with STAGE_MIN_MONTHS for every stage', () => {
    for (const stage of STAGE_IDS) {
      expect(stageFor(STAGE_MIN_MONTHS[stage])).toBe(stage);
    }
  });
});

describe('stage labels and texture hints', () => {
  it('labels 9-12 as "9–11 months" and the toddler stages per Req 13.2', () => {
    expect(STAGE_LABELS['6-8']).toBe('6–8 months');
    expect(STAGE_LABELS['9-12']).toBe('9–11 months');
    expect(STAGE_LABELS['12-23']).toBe('12–23 months');
    expect(STAGE_LABELS['24-36']).toBe('2–3 years');
  });

  it('gives every stage a texture hint with a CDC source URL', () => {
    for (const stage of STAGE_IDS) {
      expect(STAGE_TEXTURE_HINTS[stage].hint.length).toBeGreaterThan(0);
      expect(STAGE_TEXTURE_HINTS[stage].sourceUrl).toMatch(
        /^https:\/\/www\.cdc\.gov\//,
      );
    }
  });
});

describe('defaultSlots', () => {
  it('returns all four slots for both toddler stages', () => {
    const four = ['breakfast', 'lunch', 'dinner', 'snack'];
    expect(defaultSlots('12-23')).toEqual(four);
    expect(defaultSlots('24-36')).toEqual(four);
  });

  it('returns breakfast and dinner for the 6-8 stage', () => {
    expect(defaultSlots('6-8')).toEqual(['breakfast', 'dinner']);
  });

  it('returns all four slots for the 9-12 stage', () => {
    expect(defaultSlots('9-12')).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'snack',
    ]);
  });
});
