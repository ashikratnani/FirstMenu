import { describe, expect, it } from 'vitest';
import { monsterStyleFor, type MonsterVariant } from './monsterArt';
import type { AllergenGroup } from '../../domain/types';

// The nine allergen groups from the AllergenGroup union (domain/types.ts).
const GROUPS: AllergenGroup[] = [
  'peanut',
  'egg',
  'dairy',
  'tree nuts',
  'soy',
  'wheat',
  'fish',
  'shellfish',
  'sesame',
];

describe('monsterStyleFor (pure allergen-group -> monster mapping)', () => {
  it('returns one distinct variant for each of the nine allergen groups', () => {
    for (const group of GROUPS) {
      const style = monsterStyleFor(group);
      expect(style.variant).toBe(group);
    }
  });

  it('maps each group to a unique variant id (no two groups collide)', () => {
    const variants = new Set<MonsterVariant>(
      GROUPS.map((g) => monsterStyleFor(g).variant),
    );
    expect(variants.size).toBe(GROUPS.length);
  });

  it('falls back to the generic monster when no group is given', () => {
    expect(monsterStyleFor().variant).toBe('generic');
    expect(monsterStyleFor(undefined).variant).toBe('generic');
  });

  it('every variant uses a plain colour and a friendly eye count (1-3)', () => {
    for (const group of [...GROUPS, undefined]) {
      const style = monsterStyleFor(group);
      expect(style.body).toMatch(/^#[0-9a-f]{3,6}$/i);
      expect(style.belly).toMatch(/^#[0-9a-f]{3,6}$/i);
      expect([1, 2, 3]).toContain(style.eyes);
      expect(typeof style.antenna).toBe('boolean');
    }
  });
});
