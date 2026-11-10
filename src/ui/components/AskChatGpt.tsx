// "Ask ChatGPT" prompt helper for the Make screen's empty state (Req 3.10,
// 8.1, 8.6). Builds the question on the device and lets the user copy it or
// open ChatGPT in a new tab, with the Requirement 8.9 notice beside those
// controls. The app never calls an AI service itself. After the user copies
// the question or opens ChatGPT, a "Paste the answer" step appears (Req 8.7):
// on Make it links to Add recipe with ChatGPT preselected; on Add recipe the
// page passes `onPasteAnswer` to move to its own paste box.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { buildPrompt, PROMPT_NOTICE } from '../../domain/prompt';
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
}

/** Add recipe with ChatGPT preselected as the source (design "Prompt helper"). */
export const PASTE_ANSWER_PATH = '/add?from=chatgpt';

export const CHATGPT_URL = 'https://chatgpt.com/';

export default function AskChatGpt({ ageMonths, stage, have, leaveOut, onPasteAnswer }: AskChatGptProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [asked, setAsked] = useState(false);
  const prompt = buildPrompt({
    ageMonths,
    stage,
    have: have.length > 0 ? have : ['common kitchen foods'],
    leaveOut,
  });

  async function copy(textarea: HTMLTextAreaElement | null) {
    setAsked(true);
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage('Copied. Paste it into ChatGPT.');
    } catch {
      // Clipboard API unavailable: select the text and ask the user to copy.
      textarea?.focus();
      textarea?.select();
      setMessage('Select the question above and copy it.');
    }
  }

  return (
    <section className={styles.helper} aria-label="Ask ChatGPT">
      <Button
        label={open ? 'Hide the question' : 'Ask ChatGPT'}
        onClick={() => setOpen((value) => !value)}
      />
      {open && (
        <div className={styles.panel}>
          <label className={styles.label} htmlFor="chatgpt-question">
            Your question for ChatGPT
          </label>
          <textarea
            id="chatgpt-question"
            className={styles.text}
            readOnly
            rows={8}
            value={prompt}
          />
          <p className={styles.notice}>{PROMPT_NOTICE}</p>
          <div className={styles.row}>
            <Button
              label="Copy question"
              onClick={() =>
                void copy(document.getElementById('chatgpt-question') as HTMLTextAreaElement | null)
              }
            />
            <a
              className={styles.link}
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
          {asked && (
            <div className={styles.pasteStep}>
              <p className={styles.status}>
                When ChatGPT answers, copy its whole reply, then come back here.
              </p>
              {onPasteAnswer ? (
                <Button label="Paste the answer" onClick={onPasteAnswer} />
              ) : (
                <Link className={styles.link} to={PASTE_ANSWER_PATH}>
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
