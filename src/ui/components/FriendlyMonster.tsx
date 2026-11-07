// FriendlyMonster: a food marked tried with no reaction (design "Theme
// mapping": text equivalent "Tried on Nov 12"). The SVG is decorative; the
// state is carried by the visible label and the card's accessible name
// (Req 14.3). Children hold the per-food controls.

import type { ReactNode } from 'react';
import type { AllergenGroup } from '../../domain/types';
import { MonsterArt } from './foodArt';
import styles from './foodCard.module.css';

export interface FriendlyMonsterProps {
  /** Visible + accessible state label, e.g. "egg — tried on Nov 12". */
  label: string;
  /**
   * Optional allergen group selecting the per-group monster variant. Purely
   * decorative — it changes the SVG art only (via a non-text `data-monster`
   * hook) and adds NO visible or accessible text (Req 14.3). Omit for the
   * generic friendly monster.
   */
  group?: AllergenGroup;
  children?: ReactNode;
}

export default function FriendlyMonster({
  label,
  group,
  children,
}: FriendlyMonsterProps) {
  return (
    <li className={styles.card} aria-label={label}>
      <div className={styles.head}>
        <MonsterArt group={group} />
        <span className={styles.label}>{label}</span>
      </div>
      {children}
    </li>
  );
}
