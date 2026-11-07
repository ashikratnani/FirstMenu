import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../../state/AppProvider';
import Disclaimer, {
  FirstRunDisclaimer,
  NOT_MEDICAL_ADVICE,
  SCREEN_LIMITS,
} from './Disclaimer';

/** In-memory Storage so AppProvider never touches real localStorage. */
function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } satisfies Storage;
}

describe('Disclaimer (footer)', () => {
  it('renders the verbatim not-medical-advice and screen-limit wording', () => {
    render(<Disclaimer />);
    expect(screen.getByText(NOT_MEDICAL_ADVICE)).toBeInTheDocument();
    expect(screen.getByText(SCREEN_LIMITS)).toBeInTheDocument();
    // Wording is taken verbatim from Req 13.1/13.2; guard against drift.
    expect(NOT_MEDICAL_ADVICE).toBe(
      'FirstMenu is not medical advice. Check with your pediatrician.',
    );
    expect(SCREEN_LIMITS).toBe(
      'The safety screen checks ingredient names against a fixed list and can miss foods or preparations that are not on it.',
    );
  });
});

describe('FirstRunDisclaimer', () => {
  it('appears when the disclaimer has not been acknowledged', () => {
    render(
      <AppProvider storage={makeStorage()}>
        <FirstRunDisclaimer />
      </AppProvider>,
    );
    expect(
      screen.getByRole('alertdialog', { name: /before you start/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(NOT_MEDICAL_ADVICE)).toBeInTheDocument();
  });

  it('disappears after the user acknowledges it', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider storage={makeStorage()}>
        <FirstRunDisclaimer />
      </AppProvider>,
    );
    await user.click(screen.getByRole('button', { name: /i understand/i }));
    expect(
      screen.queryByRole('alertdialog', { name: /before you start/i }),
    ).not.toBeInTheDocument();
  });
});
