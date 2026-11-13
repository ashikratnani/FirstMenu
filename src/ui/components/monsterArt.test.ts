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

  it('every variant is colors only: a 3-stop body, an arm and a horn gradient', () => {
    for (const group of [...GROUPS, undefined]) {
      const style = monsterStyleFor(group);
      expect(style.body).toHaveLength(3);
      expect(style.arm).toHaveLength(2);
      expect(style.horn).toHaveLength(2);
      for (const color of [...style.body, ...style.arm, ...style.horn]) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
      // The shape is the same for every monster, so no shape fields exist.
      expect(Object.keys(style).sort()).toEqual(['arm', 'body', 'horn', 'variant']);
    }
  });

  it('uses the reference colors: generic is green with cream horns, egg is yellow with lavender horns', () => {
    expect(monsterStyleFor().body).toEqual(['#dcf7d4', '#a3df96', '#58a865']);
    expect(monsterStyleFor().horn).toEqual(['#fff4d6', '#f0b45e']);
    expect(monsterStyleFor('egg').body).toEqual(['#fff8dc', '#ffdc78', '#e0a338']);
    expect(monsterStyleFor('egg').horn).toEqual(['#f4eeff', '#b9a4ee']);
  });

  it('gives each group its own main body color', () => {
    const mains = new Set([...GROUPS, undefined].map((g) => monsterStyleFor(g).body[1]));
    expect(mains.size).toBe(GROUPS.length + 1);
  });
});
