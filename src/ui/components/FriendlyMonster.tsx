// FriendlyMonster: a food marked tried with no reaction (design "Theme
// mapping": text equivalent "Tried on Nov 12"). The SVG is decorative; the
// state is carried by the visible label and the card's accessible name
// (Req 14.3). Children hold the per-food controls.

import type { ReactNode } from 'react';
import { MonsterArt } from './foodArt';
import styles from './foodCard.module.css';

export interface FriendlyMonsterProps {
  /** Visible + accessible state label, e.g. "egg — tried on Nov 12". */
  label: string;
  children?: ReactNode;
}

export default function FriendlyMonster({
  label,
  children,
}: FriendlyMonsterProps) {
  return (
    <li className={styles.card} aria-label={label}>
      <div className={styles.head}>
        <MonsterArt />
        <span className={styles.label}>{label}</span>
      </div>
      {children}
    </li>
  );
}
