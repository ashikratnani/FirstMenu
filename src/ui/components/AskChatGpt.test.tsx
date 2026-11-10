import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spyOnNetwork } from '../../test/networkSpy';
import AskChatGpt from './AskChatGpt';
import { buildWrappedPrompt, PROMPT_NOTICE } from '../../domain/prompt';

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(have = ['rice', 'peas']) {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText, readText: vi.fn() },
    configurable: true,
  });
  const network = spyOnNetwork();
  render(
    <MemoryRouter>
      <AskChatGpt ageMonths={10} stage="9-12" have={have} leaveOut={['Honey']} />
    </MemoryRouter>,
  );
  return { user, writeText, network };
}

describe('AskChatGpt question box (Req 18.1 to 18.3, 18.12)', () => {
  it('pre-fills from the foods on hand, is editable and capped at 1,000 characters', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Ask ChatGPT' }));
    const box = screen.getByRole('textbox', { name: 'Your question for ChatGPT' });
    expect(box).toHaveValue(
      'Suggest one quick and easy recipe using: rice, peas. If you can, include an iron-rich food.',
    );
    expect(box).toHaveAttribute('maxlength', '1000');
    await user.clear(box);
    await user.type(box, 'A snack with pears');
    expect(box).toHaveValue('A snack with pears');
  });

  it('copies the wrapped prompt built from the edited question, with no network call', async () => {
    const { user, writeText, network } = setup();
    await user.click(screen.getByRole('button', { name: 'Ask ChatGPT' }));
    const box = screen.getByRole('textbox', { name: 'Your question for ChatGPT' });
    await user.clear(box);
    await user.type(box, 'A snack with pears');
    await user.click(screen.getByRole('button', { name: 'Copy question' }));
    expect(writeText).toHaveBeenCalledWith(
      buildWrappedPrompt({
        question: 'A snack with pears',
        ageMonths: 10,
        stage: '9-12',
        leaveOut: ['Honey'],
      }),
    );
    expect(screen.getByText(PROMPT_NOTICE)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Paste the answer' })).toHaveAttribute(
      'href',
      '/add?from=chatgpt',
    );
    network.expectNoNetwork();
  });

  it('shows the full text to copy by hand when the clipboard fails', async () => {
    const { user } = setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('no')), readText: vi.fn() },
      configurable: true,
    });
    await user.click(screen.getByRole('button', { name: 'Ask ChatGPT' }));
    await user.click(screen.getByRole('button', { name: 'Copy question' }));
    const manual = screen.getByRole('textbox', { name: 'Full text to copy' });
    expect(manual).toHaveAttribute('readonly');
    expect((manual as HTMLTextAreaElement).value).toContain('"firstmenu_recipe": 1');
  });
});
