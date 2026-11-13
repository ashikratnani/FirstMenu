// Share page (Task 13.2, Req 11.1/11.2/11.3/11.6). The owner builds a read-only
// share link from the current plan. The payload is privacy-stripped in
// domain/share.ts (no child name/birth date, no food notes — Req 11.3); this
// page only presents the resulting URL and the ways to copy it.
//
// Copying: the primary control uses navigator.clipboard.writeText, but that API
// is unavailable in some contexts (no secure origin, older browsers), so a
// read-only text field always exposes the full URL for manual copy and
// selects its contents on focus. A short 'Copied' confirmation (role=status)
// is announced on a successful clipboard write.
//
// Length warning (Req 11.6): when isShareLinkLong(url) is true (url longer than
// SHARE_WARN_LENGTH), we warn that some messaging apps may cut the link off and
// suggest the print view instead. The link is STILL created and copyable.
//
// No health/safety wording is written here (autonomy.md): the privacy note and
// the length warning are plain UI copy, not health guidance.

import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useApp } from '../../state/AppProvider';
import { encodeSharePayload, isShareLinkLong } from '../../domain/share';
import styles from './Share.module.css';

export default function Share() {
  const { state } = useApp();
  const { url } = encodeSharePayload(state);
  const tooLong = isShareLinkLong(url);
  // Only the active slots count, as in the shared view: a meal left in a
  // deselected slot is not part of the shared week.
  const planIsEmpty = state.plan.days.every((day) =>
    state.plan.activeSlots.every((meal) => day[meal] === undefined),
  );

  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        return;
      }
    } catch {
      // Fall through to the manual field below.
    }
    // Fallback: select the field so the user can copy manually.
    const field = inputRef.current;
    if (field) {
      field.focus();
      field.select();
    }
    setCopied(false);
  };

  return (
    <>
      <h1>Share</h1>

      <p className={styles.intro}>
        Copy this link to share a read-only view of this week&rsquo;s plan,
        prep list, grocery list and recipes. Whoever opens it sees the plan
        only, with the safety screen run again on their device.
      </p>

      {planIsEmpty && (
        <p className={styles.emptyNote}>
          Nothing is planned yet, so the link would show an empty week.
        </p>
      )}
      {planIsEmpty && (
        <Link to="/plan" className={`fm-link ${styles.nextStep}`}>
          Plan your week
        </Link>
      )}

      <section className={styles.linkBlock} aria-labelledby="share-link-heading">
        <h2 id="share-link-heading" className={styles.sectionHeading}>
          Share link
        </h2>

        <div className={styles.copyRow}>
          <Button label="Copy link" onClick={() => void copy()} />
          <span className={styles.copied} role="status">
            {copied ? 'Copied' : ''}
          </span>
        </div>

        <TextInput
          label="Or copy it by hand:"
          ref={inputRef}
          isReadOnly
          value={url}
          onFocus={(e) => (e.currentTarget as HTMLInputElement).select()}
        />
      </section>

      {tooLong && (
        <section className={styles.warning} role="status">
          <p className={styles.warningText}>
            This link is long, and some messaging apps may cut it off so it
            won&rsquo;t open. If that happens, use the{' '}
            <Link to="/print">print view</Link> instead.
          </p>
        </section>
      )}

      <section className={styles.privacy} aria-labelledby="share-privacy-heading">
        <h2 id="share-privacy-heading" className={styles.sectionHeading}>
          What the link includes
        </h2>
        <p className={styles.privacyNote}>
          The link does not include your child&rsquo;s name or birth date. It
          carries only the age in months, the plan, the recipes it uses, which
          foods have been tried and which ones caused a reaction.
        </p>
      </section>
    </>
  );
}
