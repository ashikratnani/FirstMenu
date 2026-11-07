// GhostCard: a food that is blocked by the safety screen for this age OR has a
// recorded reaction (design "Theme mapping": a translucent ghost card with a
// "Not yet" label, e.g. "Not yet: honey. Available at 12 months."). The SVG is
// decorative; the state is carried by the visible label and the card's
// accessible name (Req 14.3). Children hold the reason, any safety messaging,
// and (for reaction ghosts only) a clear-reaction control.

import type { ReactNode } from 'react';
import { GhostArt } from './foodArt';
import styles from './foodCard.module.css';

export interface GhostCardProps {
  /** Visible + accessible state label, e.g. "Not yet: honey...". */
  label: string;
  children?: ReactNode;
}

export default function GhostCard({ label, children }: GhostCardProps) {
  return (
    <li className={`${styles.card} ${styles.ghost}`} aria-label={label}>
      <div className={styles.head}>
        <GhostArt />
        <span className={styles.label}>{label}</span>
      </div>
      {children}
    </li>
  );
}
