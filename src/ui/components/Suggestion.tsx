// A smart suggestion on the Make screen (Requirement 17): a titled box with a
// short "Why this?" reason (17.8), its actions, and a one-tap dismiss (17.9).
// Every button inside is secondary except the Try this card's one primary
// button, which the caller passes in `actions` (17.10).

import type { ReactNode } from 'react';
import { Button } from '@astryxdesign/core/Button';
import styles from './Suggestion.module.css';

export interface SuggestionProps {
  /** Unique within the page; labels the region. */
  id: string;
  title: string;
  /** The "Why this?" text. */
  reason: string;
  children?: ReactNode;
  actions?: ReactNode;
  onDismiss: () => void;
  dismissLabel?: string;
}

export default function Suggestion({
  id,
  title,
  reason,
  children,
  actions,
  onDismiss,
  dismissLabel = 'Not now',
}: SuggestionProps) {
  const headingId = `suggestion-${id}`;
  return (
    <section className={styles.box} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        <Button label={dismissLabel} size="sm" onClick={onDismiss} />
      </div>
      {children && <div className={styles.body}>{children}</div>}
      <p className={styles.reason}>
        <strong>Why this?</strong> {reason}
      </p>
      {actions && <div className={styles.actions}>{actions}</div>}
    </section>
  );
}
