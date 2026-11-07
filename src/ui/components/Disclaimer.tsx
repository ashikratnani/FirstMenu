// Health/safety disclaimer (Task 6.2, Req 13.1 and 13.2). The wording is taken
// verbatim from requirements.md and must not be reworded (autonomy.md: health
// wording comes from the spec, not invented here).
//
// Two surfaces share the same text:
//  - <Disclaimer /> renders the plain text used in the footer of every page.
//  - <FirstRunDisclaimer /> renders a prominent, dismissible banner on first
//    run (when disclaimerAcknowledged is false) with an acknowledge button.

import { useApp } from '../../state/AppProvider';
import styles from './Disclaimer.module.css';

// Req 13.1: not medical advice + check with a pediatrician.
export const NOT_MEDICAL_ADVICE =
  'FirstMenu is not medical advice. Check with your pediatrician.';

// Req 13.2: the screen matches names against a fixed list and can miss things.
export const SCREEN_LIMITS =
  'The safety screen checks ingredient names against a fixed list and can miss foods or preparations that are not on it.';

/** The disclaimer text, used in the footer of every page (Req 13.1, 13.2). */
export default function Disclaimer() {
  return (
    <div className={styles.text}>
      <p>{NOT_MEDICAL_ADVICE}</p>
      <p>{SCREEN_LIMITS}</p>
    </div>
  );
}

/**
 * First-run disclaimer (Req 13.1): shown prominently until acknowledged. Reads
 * disclaimerAcknowledged from context and dispatches `acknowledgeDisclaimer`;
 * it does not reappear once acknowledged.
 */
export function FirstRunDisclaimer() {
  const { state, dispatch } = useApp();
  if (state.disclaimerAcknowledged) return null;

  return (
    <section
      className={styles.firstRun}
      role="alertdialog"
      aria-labelledby="first-run-disclaimer-title"
      aria-describedby="first-run-disclaimer-body"
    >
      <h2 id="first-run-disclaimer-title" className={styles.firstRunTitle}>
        Before you start
      </h2>
      <div id="first-run-disclaimer-body">
        <p>{NOT_MEDICAL_ADVICE}</p>
        <p>{SCREEN_LIMITS}</p>
      </div>
      <button
        type="button"
        className={styles.acknowledge}
        onClick={() => dispatch({ type: 'acknowledgeDisclaimer' })}
      >
        I understand
      </button>
    </section>
  );
}
