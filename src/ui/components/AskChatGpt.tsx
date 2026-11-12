// "Ask ChatGPT" prompt helper for the Make screen's empty state and Add recipe
// (Req 3.10, 8.1, 8.6, 18.1 to 18.3, 18.12). The question box is pre-filled
// from the foods on hand and stays editable (at most 1,000 characters). The
// wrapped prompt is built on the device from that question; the user copies it
// or opens ChatGPT in a new tab, with the Requirement 8.9 notice beside those
// controls. The app never calls an AI service itself. After the user copies
// the question or opens ChatGPT, a "Paste the answer" step appears (Req 8.7):
// on Make it links to Add recipe with ChatGPT preselected; on Add recipe the
// page passes `onPasteAnswer` to move to its own paste box.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { buildWrappedPrompt, MAX_QUESTION_CHARS, PROMPT_NOTICE } from '../../domain/prompt';
import type { StageId } from '../../domain/types';
import styles from './AskChatGpt.module.css';

export interface AskChatGptProps {
  ageMonths: number;
  stage: StageId;
  /** Labels of the pantry and on-hand foods. */
  have: string[];
  /** Labels of foods to leave out (leaveOutFor). */
  leaveOut: string[];
  /** Add recipe passes this to use its own paste box instead of linking there. */
  onPasteAnswer?: () => void;
  /** Add recipe controls which helper is open, so only one panel shows at a time. */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Add recipe with ChatGPT preselected as the source (design "Prompt helper"). */
export const PASTE_ANSWER_PATH = '/add?from=chatgpt';

export const CHATGPT_URL = 'https://chatgpt.com/';

export default function AskChatGpt({
  ageMonths,
  stage,
  have,
  leaveOut,
  onPasteAnswer,
  isOpen,
  onOpenChange,
}: AskChatGptProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = isOpen ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  const [message, setMessage] = useState('');
  const [asked, setAsked] = useState(false);
  // Until the user edits the box, it follows the foods on hand.
  const [edited, setEdited] = useState<string | null>(null);
  const suggestion = `Suggest one quick and easy recipe using: ${
    have.length > 0 ? have.join(', ') : 'common kitchen foods'
  }. If you can, include an iron-rich food.`;
  const question = edited ?? suggestion;
  const prompt = buildWrappedPrompt({ question, ageMonths, stage, leaveOut });

  const [manual, setManual] = useState(false);
  const manualBox = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!manual) return;
    manualBox.current?.focus();
    manualBox.current?.select();
  }, [manual]);

  async function copy() {
    setAsked(true);
    try {
      await navigator.clipboard.writeText(prompt);
      setManual(false);
      setMessage('Copied. Paste it into ChatGPT.');
    } catch {
      // Clipboard API unavailable: show the full text to select and copy.
      setManual(true);
      setMessage(
        'Copying did not work here. Select the text below and copy it, then paste it into ChatGPT.',
      );
    }
  }

  return (
    <section className={styles.helper} aria-label="Ask ChatGPT">
      <Button
        label={open ? 'Hide the question' : 'Ask ChatGPT'}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className={styles.panel}>
          <label className={styles.label} htmlFor="chatgpt-question">
            Your question for ChatGPT
          </label>
          <textarea
            id="chatgpt-question"
            className={styles.text}
            rows={5}
            maxLength={MAX_QUESTION_CHARS}
            value={question}
            onChange={(event) => setEdited(event.target.value)}
          />
          <p className={styles.notice}>{PROMPT_NOTICE}</p>
          <div className={styles.row}>
            <Button label="Copy question" onClick={() => void copy()} />
            <a
              className={`fm-link ${styles.link}`}
              href={CHATGPT_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setAsked(true)}
            >
              Open ChatGPT
            </a>
          </div>
          {message && (
            <p className={styles.status} role="status">
              {message}
            </p>
          )}
          {manual && (
            <textarea
              ref={manualBox}
              className={styles.text}
              aria-label="Full text to copy"
              readOnly
              rows={8}
              value={prompt}
            />
          )}
          {asked && (
            <div className={styles.pasteStep}>
              <p className={styles.status}>
                When ChatGPT answers, copy its whole reply, then come back here.
              </p>
              {onPasteAnswer ? (
                <Button label="Paste the answer" onClick={onPasteAnswer} />
              ) : (
                <Link className={`fm-link ${styles.link}`} to={PASTE_ANSWER_PATH}>
                  Paste the answer
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
