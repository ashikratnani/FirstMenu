// The picture for a food or recipe state (design "Food art", "State pictures"):
// New food is the peekaboo monster, Tried is the friendly monster, Not yet is
// the Fluent hourglass, Freezes well is the Fluent snowflake. Decorative: the
// state's text label stays next to it.

import type { AllergenGroup } from '../../domain/types';
import { artUrl } from './artUrl';
import { MonsterArt, PeekabooArt } from './foodArt';

export interface StatePictureProps {
  state: 'new' | 'tried' | 'not-yet' | 'freezes';
  /** Displayed size in px: about 24 in text lines, 32 as a tile badge, 96 in empty states. */
  size?: number;
  /** Allergen group for the `tried` monster's colors. */
  group?: AllergenGroup;
}

export default function StatePicture({ state, size = 24, group }: StatePictureProps) {
  if (state === 'new') return <PeekabooArt size={size} />;
  if (state === 'tried') return <MonsterArt group={group} size={size} />;
  return (
    <img
      src={artUrl('state', state === 'not-yet' ? 'hourglass_not_done' : 'snowflake')}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{ display: 'block', flex: 'none' }}
    />
  );
}
