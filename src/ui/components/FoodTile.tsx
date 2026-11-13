// One tile on the Foods page (design "Food art", "Screens": Foods tiles): the
// food's picture on a circle in its food group's color, the state picture as a
// small badge at the circle's edge, then the name and status label, and the
// per-food controls. Everything drawn is decorative; the label is the visible
// text and the tile's accessible name (Req 14.3).

import type { ReactNode } from 'react';
import type { AllergenGroup } from '../../domain/types';
import type { FoodGroup } from '../../data/foodPictures';
import FoodPicture from './FoodPicture';
import StatePicture from './StatePicture';
import styles from './foodTile.module.css';

export interface FoodTileProps {
  /** Visible + accessible state label, e.g. "New food: egg". */
  label: string;
  /** File name of the food picture (see foodTilePicture). */
  picture: string;
  /** The food group, or 'not-yet' for the lavender circle of a Not yet tile. */
  group: FoodGroup | 'not-yet';
  state: 'new' | 'tried' | 'not-yet';
  /** Allergen group for the tried monster's colors. */
  monsterGroup?: AllergenGroup;
  /** Not yet look: greyed picture. */
  greyed?: boolean;
  /** First-taste moment: the monster rises out of a dark hole once. */
  popping?: boolean;
  onPopEnd?: () => void;
  /** Control shown at the end of the head row (the disclosure button). */
  action?: ReactNode;
  children?: ReactNode;
}

export default function FoodTile({
  label,
  picture,
  group,
  state,
  monsterGroup,
  greyed = false,
  popping = false,
  onPopEnd,
  action,
  children,
}: FoodTileProps) {
  return (
    <li
      className={popping ? `${styles.tile} ${styles.pop}` : styles.tile}
      aria-label={label}
      onAnimationEnd={popping ? onPopEnd : undefined}
    >
      <div className={styles.head}>
        <div className={styles.art}>
          <span className={styles.circle} style={{ backgroundColor: `var(--fm-color-group-${group})` }} data-group={group}>
            <FoodPicture name={picture} size={36} greyed={greyed} />
          </span>
          <span className={styles.badge}>
            <StatePicture state={state} size={32} group={monsterGroup} />
          </span>
        </div>
        <span className={styles.label}>{label}</span>
        {action}
      </div>
      {children}
    </li>
  );
}
