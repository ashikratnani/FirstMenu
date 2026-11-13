// Pure, non-component helper for the per-allergen-group friendly monster art
// (design "Food art", "State pictures"). Every monster has the same shape; each
// of the nine allergen groups gets its own colors, plus a generic (green)
// fallback used when no group is given. The mapping is presentation
// ONLY: it carries NO text and NO meaning — the food's state lives entirely in
// the visible label and the card's accessible name (Req 14.3). It lives in a
// plain .ts module (not a component file) so it adds no react-refresh lint
// warning.

import type { AllergenGroup } from '../../domain/types';

/** A monster variant id: one per allergen group, plus a generic fallback. */
export type MonsterVariant = AllergenGroup | 'generic';

/**
 * Colors only (design "State pictures", "Monster colors"): every monster has
 * the same shape. Stops run from light to dark; the middle body stop is the
 * group's main color. `generic` and `egg` use the colors of
 * docs/art/reference/monster-egg.svg and monster.svg. Plain CSS colors, never
 * a token with meaning.
 */
export interface MonsterStyle {
  /** The variant id, also surfaced as the SVG `data-monster` test hook. */
  variant: MonsterVariant;
  /** Body gradient: light, main, dark. */
  body: readonly [string, string, string];
  /** Arm gradient: light, dark. */
  arm: readonly [string, string];
  /** Horn gradient: top, bottom (cream, or lavender for egg). */
  horn: readonly [string, string];
}

const CREAM_HORN = ['#fff4d6', '#f0b45e'] as const;
const LAVENDER_HORN = ['#f4eeff', '#b9a4ee'] as const;

const MONSTER_STYLES: Record<MonsterVariant, MonsterStyle> = {
  peanut: { variant: 'peanut', body: ['#fcf2da', '#f3c969', '#ca9b31'], arm: ['#f7dc9e', '#cea037'], horn: CREAM_HORN },
  egg: { variant: 'egg', body: ['#fff8dc', '#ffdc78', '#e0a338'], arm: ['#ffe7a0', '#e2a83f'], horn: LAVENDER_HORN },
  dairy: { variant: 'dairy', body: ['#f3f8fd', '#cfe3f7', '#92a8be'], arm: ['#e0edfa', '#98aec4'], horn: CREAM_HORN },
  'tree nuts': { variant: 'tree nuts', body: ['#f5ece2', '#d8b48c', '#ae8659'], arm: ['#e6ceb4', '#b28b5e'], horn: CREAM_HORN },
  soy: { variant: 'soy', body: ['#f2f9e9', '#c9e6a8', '#95b571'], arm: ['#dcefc6', '#9aba77'], horn: CREAM_HORN },
  wheat: { variant: 'wheat', body: ['#faf3e3', '#e9cf8f', '#bb9e57'], arm: ['#f1e0b6', '#c0a35d'], horn: CREAM_HORN },
  fish: { variant: 'fish', body: ['#eaf6f7', '#a9dbe0', '#70a8ad'], arm: ['#c7e8eb', '#76adb2'], horn: CREAM_HORN },
  shellfish: { variant: 'shellfish', body: ['#fcede7', '#f3b7a0', '#c58369'], arm: ['#f7d0c1', '#ca886f'], horn: CREAM_HORN },
  sesame: { variant: 'sesame', body: ['#f9f6f0', '#e7dcc4', '#b1a48a'], arm: ['#efe8d9', '#b6aa90'], horn: CREAM_HORN },
  generic: { variant: 'generic', body: ['#dcf7d4', '#a3df96', '#58a865'], arm: ['#b8e8aa', '#5fae6a'], horn: CREAM_HORN },
};

/**
 * Pick the friendly-monster style for an allergen group, or the generic monster
 * when no group is given. Pure; adds no text/meaning (Req 14.3).
 */
export function monsterStyleFor(group?: AllergenGroup): MonsterStyle {
  if (group && group in MONSTER_STYLES) {
    return MONSTER_STYLES[group];
  }
  return MONSTER_STYLES.generic;
}
