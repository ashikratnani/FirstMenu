// MysteryDoor: an untried food shown as a plain "mystery door" card (design
// "Theme mapping": text equivalent "New food: egg"). The SVG is decorative;
// the state is carried by the visible label and the card's accessible name
// (Req 14.3). Children hold the per-food controls and any guidance.

import type { ReactNode } from 'react';
import { DoorArt } from './foodArt';
import styles from './foodCard.module.css';

export interface MysteryDoorProps {
  /** Visible + accessible state label, e.g. "New food: egg". */
  label: string;
  /** Optional control shown at the end of the head row (e.g. a disclosure button). */
  action?: ReactNode;
  children?: ReactNode;
}

export default function MysteryDoor({ label, action, children }: MysteryDoorProps) {
  return (
    <li className={styles.card} aria-label={label}>
      <div className={styles.head}>
        <DoorArt />
        <span className={styles.label}>{label}</span>
        {action}
      </div>
      {children}
    </li>
  );
}
