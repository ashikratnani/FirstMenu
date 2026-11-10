// "Ask ChatGPT" prompt helper for the Make screen's empty state (Req 3.10,
// 8.1, 8.6). Builds the question on the device and lets the user copy it or
// open ChatGPT in a new tab. The app never calls an AI service itself. Task
// 11.2 adds the "Paste the answer" step and the helper notice.

import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { buildPrompt } from '../../domain/prompt';
import type { StageId } from '../../domain/types';
import styles from './AskChatGpt.module.css';

export interface AskChatGptProps {
  ageMonths: number;
  stage: StageId;
  /** Labels of the pantry and on-hand foods. */
  have: string[];
  /** Labels of foods to leave out (leaveOutFor). */
  leaveOut: string[];
}

export const CHATGPT_URL = 'https://chatgpt.com/';

export default function AskChatGpt({ ageMonths, stage, have, leaveOut }: AskChatGptProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const prompt = buildPrompt({
    ageMonths,
    stage,
    have: have.length > 0 ? have : ['common kitchen foods'],
    leaveOut,
  });

  async function copy(textarea: HTMLTextAreaElement | null) {
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
            >
              Open ChatGPT
            </a>
          </div>
          {message && (
            <p className={styles.status} role="status">
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
