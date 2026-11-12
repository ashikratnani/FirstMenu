// "From an Instagram reel" prompt helper on Add recipe (Requirement 19). The
// parent types a reel URL; the app builds a prompt on the device (the URL and
// nothing about the child), which the user copies or takes to Meta AI in a new
// tab. The app never fetches, embeds or previews the URL.

import { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { buildReelPrompt, PROMPT_NOTICE } from '../../domain/prompt';
import { checkReelUrl } from '../../domain/reelUrl';
import styles from './AskChatGpt.module.css';

export const META_AI_URL = 'https://www.meta.ai/';

export const REEL_URL_ERRORS = {
  'not-https': 'Enter a link that starts with https://',
  'too-long': 'The link is too long (500 characters at most).',
  empty: 'Paste the reel link first.',
} as const;

export const REEL_HOST_WARNING =
  "This doesn't look like an Instagram link. You can still make the prompt.";

export const REEL_MISREAD_NOTICE = 'AI apps can misread a reel. Check the ingredients.';

export interface ReelPromptProps {
  /** Called with the checked URL when the user moves on to pasting the reply. */
  onPasteAnswer: (url: string) => void;
  /** Add recipe controls which helper is open, so only one panel shows at a time. */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function ReelPrompt({ onPasteAnswer, isOpen, onOpenChange }: ReelPromptProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = isOpen ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  const [reelUrl, setReelUrl] = useState('');
  const [message, setMessage] = useState('');
  // The paste step only follows a valid reel link.
  const [asked, setAsked] = useState(false);
  const [manual, setManual] = useState(false);
  const manualBox = useRef<HTMLTextAreaElement>(null);

  const check = checkReelUrl(reelUrl);
  const prompt = check.ok ? buildReelPrompt({ url: check.url }) : '';
  const showError = reelUrl.trim() !== '' && !check.ok;

  useEffect(() => {
    if (!manual) return;
    manualBox.current?.focus();
    manualBox.current?.select();
  }, [manual]);

  async function copy() {
    if (!check.ok) {
      setMessage(REEL_URL_ERRORS[check.reason]);
      return;
    }
    setAsked(true);
    try {
      await navigator.clipboard.writeText(prompt);
      setManual(false);
      setMessage('Copied. Paste it into Meta AI or another AI chat app.');
    } catch {
      setManual(true);
      setMessage(
        'Copying did not work here. Select the text below and copy it, then paste it into the chat.',
      );
    }
  }

  return (
    <section className={styles.helper} aria-label="From an Instagram reel">
      <Button
        label={open ? 'Hide the reel prompt' : 'From an Instagram reel'}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className={styles.panel}>
          <label className={styles.label} htmlFor="reel-url">
            Reel link
          </label>
          <input
            id="reel-url"
            className={styles.text}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.instagram.com/reel/..."
            value={reelUrl}
            onChange={(event) => {
              setReelUrl(event.target.value);
              setMessage('');
            }}
          />
          {showError && (
            <p className={styles.status} role="alert">
              {REEL_URL_ERRORS[check.reason]}
            </p>
          )}
          {check.ok && check.warning && <p className={styles.warning}>{REEL_HOST_WARNING}</p>}
          <p className={styles.notice}>
            FirstMenu never opens this link. Meta AI, or any AI chat app that can open your
            Instagram, reads the reel for you.
          </p>
          <p className={styles.notice}>{PROMPT_NOTICE}</p>
          <p className={styles.notice}>{REEL_MISREAD_NOTICE}</p>
          <div className={styles.row}>
            <Button label="Copy reel prompt" onClick={() => void copy()} />
            <a
              className={`fm-link ${styles.link}`}
              href={META_AI_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (check.ok) setAsked(true);
                else setMessage(REEL_URL_ERRORS[check.reason]);
              }}
            >
              Open Meta AI
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
          {asked && check.ok && (
            <div className={styles.pasteStep}>
              <p className={styles.status}>
                When the AI app answers, copy its whole reply, then come back here.
              </p>
              <Button
                label="Paste the answer"
                onClick={() => onPasteAnswer(check.url)}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
