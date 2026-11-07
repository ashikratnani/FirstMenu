// Pure, non-component helper for the per-allergen-group friendly monster art
// (Task 15 / 15.1, design "Theme mapping"). Each of the nine allergen groups
// gets one distinct-looking but equally FRIENDLY monster variant, plus a
// generic fallback used when no group is given. The mapping is presentation
// ONLY: it carries NO text and NO meaning — the food's state lives entirely in
// the visible label and the card's accessible name (Req 14.3). It lives in a
// plain .ts module (not a component file) so it adds no react-refresh lint
// warning.

import type { AllergenGroup } from '../../domain/types';

/** A monster variant id: one per allergen group, plus a generic fallback. */
export type MonsterVariant = AllergenGroup | 'generic';

/**
 * Visual-only parameters for one friendly monster. These drive fills and a few
 * harmless shape tweaks (number of eyes, a little nub/antenna) so each variant
 * is visually distinct while all stay rounded and smiling. No scary features.
 * Colours lean on the light/welcoming theme palette (soft greens, oranges,
 * lavender); every value is a plain CSS colour, never a token with meaning.
 */
export interface MonsterStyle {
  /** The variant id, also surfaced as the SVG `data-monster` test hook. */
  variant: MonsterVariant;
  /** Body fill (friendly pastel). */
  body: string;
  /** Belly/face patch fill. */
  belly: string;
  /** Number of (round, friendly) eyes: 1, 2 or 3. */
  eyes: 1 | 2 | 3;
  /** Whether to draw a single soft antenna nub on top. */
  antenna: boolean;
}

/**
 * Per-group monster styles. Friendly pastels only; the differences are small
 * and cosmetic so no variant reads as scarier than another. Decorative only.
 */
const MONSTER_STYLES: Record<MonsterVariant, MonsterStyle> = {
  peanut: { variant: 'peanut', body: '#f3c969', belly: '#fbeccb', eyes: 2, antenna: true },
  egg: { variant: 'egg', body: '#ffe08a', belly: '#fff6dd', eyes: 2, antenna: false },
  dairy: { variant: 'dairy', body: '#cfe3f7', belly: '#eef5fd', eyes: 2, antenna: false },
  'tree nuts': { variant: 'tree nuts', body: '#d8b48c', belly: '#f1e3d2', eyes: 3, antenna: true },
  soy: { variant: 'soy', body: '#c9e6a8', belly: '#edf7df', eyes: 2, antenna: false },
  wheat: { variant: 'wheat', body: '#e9cf8f', belly: '#f7eecf', eyes: 1, antenna: true },
  fish: { variant: 'fish', body: '#a9dbe0', belly: '#e3f5f6', eyes: 2, antenna: false },
  shellfish: { variant: 'shellfish', body: '#f3b7a0', belly: '#fbe4da', eyes: 2, antenna: true },
  sesame: { variant: 'sesame', body: '#e7dcc4', belly: '#f5efe2', eyes: 3, antenna: false },
  generic: { variant: 'generic', body: '#d9efd6', belly: '#f0faee', eyes: 2, antenna: false },
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
