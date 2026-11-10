import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import ReelPrompt from './ReelPrompt';

type AxeMatchersModule = { toHaveNoViolations: (r: unknown) => { pass: boolean; message: () => string } };
const { toHaveNoViolations } = axeMatchers as unknown as AxeMatchersModule;

describe('ReelPrompt accessibility', () => {
  it('has no axe violations with the panel open and a warning shown', async () => {
    const user = userEvent.setup();
    const { container } = render(<ReelPrompt onPasteAnswer={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'From an Instagram reel' }));
    await user.click(screen.getByRole('textbox', { name: 'Reel link' }));
    await user.paste('https://example.com/x');
    await user.click(screen.getByRole('button', { name: 'Copy reel prompt' }));
    expect(screen.getByText(/doesn't look like an Instagram link/)).toBeInTheDocument();
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false }, 'label-content-name-mismatch': { enabled: false } },
    });
    const outcome = toHaveNoViolations(results);
    expect(outcome.pass, outcome.message()).toBe(true);
  });
});
