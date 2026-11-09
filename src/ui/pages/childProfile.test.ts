import { describe, expect, it } from 'vitest';
import {
  OVER_36_NOTICE,
  UNDER_6_NOTICE,
  noticeForAgeMonths,
} from './childProfile';

describe('noticeForAgeMonths (Req 13.3)', () => {
  it('has no notice with no age or inside 6 to 36 months', () => {
    expect(noticeForAgeMonths(null)).toBeNull();
    for (const months of [6, 11, 12, 13, 24, 35, 36]) {
      expect(noticeForAgeMonths(months)).toBeNull();
    }
  });

  it('shows the under-6 notice below 6 months', () => {
    expect(noticeForAgeMonths(5)).toBe(UNDER_6_NOTICE);
  });

  it('shows the over-36 notice above 36 months, not at 12 months', () => {
    expect(noticeForAgeMonths(37)).toBe(OVER_36_NOTICE);
    expect(noticeForAgeMonths(60)).toBe(OVER_36_NOTICE);
    expect(OVER_36_NOTICE).toBe(
      'FirstMenu is designed for 6 months to 3 years. Safety rules still use your child\'s actual age.',
    );
  });
});
