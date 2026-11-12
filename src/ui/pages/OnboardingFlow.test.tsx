// Problem-first onboarding (Requirement 20, tasks 18.1 to 18.3): the problems
// step, each quick solve, the end screen, the `/onboarding/tour` route and
// Settings "Quick tour". Rendered through the real <App/> shell.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import App from '../../App';
import { AppProvider, useApp } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState } from '../../domain/types';
import { spyOnNetwork } from '../../test/networkSpy';
import { NOT_MEDICAL_ADVICE, SCREEN_LIMITS } from '../components/Disclaimer';

type AxeMatcherFn = (results: unknown) => { pass: boolean; message: () => string };
expect.extend({
  toHaveNoViolations: (axeMatchers as unknown as { toHaveNoViolations: AxeMatcherFn })
    .toHaveNoViolations,
});
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
}

const AXE_OPTIONS = {
  rules: {
    'color-contrast': { enabled: false },
    'label-content-name-mismatch': { enabled: false },
  },
} as const;

function makeStorage(seed?: AppState): Storage {
  const map = new Map<string, string>();
  if (seed) map.set(STORAGE_KEY, JSON.stringify(seed));
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

function birthDateMonthsAgo(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let captured: AppState | null = null;
function StateProbe() {
  captured = useApp().state;
  return null;
}

function onboardedState(months = 8): AppState {
  return {
    ...defaultState(new Date()),
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(months) },
    onboarded: true,
    disclaimerAcknowledged: true,
    dismissed: { 'pantry-setup': new Date().toISOString() },
  };
}

function renderApp(path: string, seed?: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={[path]}>
        <StateProbe />
        <App />
      </MemoryRouter>
    </AppProvider>,
  );
}

const PROBLEMS_HEADING = /what would you like help with/i;

/** Filled primary buttons on screen (Astryx marks them data-variant="primary"). */
function primaries(): string[] {
  return Array.from(document.querySelectorAll('[data-variant="primary"]')).map(
    (el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
  );
}

async function chooseAndShow(user: ReturnType<typeof userEvent.setup>, ...labels: RegExp[]) {
  await screen.findByRole('heading', { name: PROBLEMS_HEADING });
  for (const label of labels) await user.click(screen.getByRole('button', { name: label }));
  await user.click(screen.getByRole('button', { name: 'Show me' }));
}

async function expectNoViolations() {
  expect(await axe(document.body, AXE_OPTIONS)).toHaveNoViolations();
}

async function expectOnMake() {
  expect(await screen.findByRole('heading', { name: 'What can I make?' })).toBeInTheDocument();
}

describe('onboarding problems step', () => {
  it('follows the profile step, and skip lands on Make with the same state', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    renderApp('/onboarding');
    fireEvent.change(screen.getByLabelText(/birth date/i), { target: { value: birthDateMonthsAgo(8) } });
    await user.click(screen.getByRole('button', { name: /start planning/i }));
    await screen.findByRole('heading', { name: PROBLEMS_HEADING });
    const afterProfile = captured;

    // Five chips, a primary "Show me" (disabled with none) and a secondary "Skip".
    for (const label of [
      'What can I make with what I have',
      'Save recipes from ChatGPT or Instagram',
      'Plan the week and make a grocery list',
      "What's safe for my child",
      'Just looking',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Show me' })).toBeDisabled();
    expect(primaries()).toEqual(['Show me']);
    await expectNoViolations();

    await user.click(screen.getByRole('button', { name: 'Skip' }));
    await expectOnMake();
    expect(captured).toEqual(afterProfile);
    network.expectNoNetwork();
  });

  it('treats "Just looking" alone as skip', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding/tour', onboardedState());
    await chooseAndShow(user, /just looking/i);
    await expectOnMake();
  });

  it('never shows the new screens to a user who already finished onboarding', async () => {
    renderApp('/', onboardedState());
    await expectOnMake();
    expect(screen.queryByRole('heading', { name: PROBLEMS_HEADING })).not.toBeInTheDocument();
  });

  it('adds no stored field', async () => {
    const user = userEvent.setup();
    const seed = onboardedState();
    renderApp('/onboarding/tour', seed);
    await chooseAndShow(user, /just looking/i);
    await expectOnMake();
    expect(Object.keys(captured!).sort()).toEqual(Object.keys(seed).sort());
  });
});

describe('quick solve: What can I make', () => {
  it('shows live results, keeps the foods as on-hand and opens Make', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    renderApp('/onboarding/tour', onboardedState());
    await chooseAndShow(user, /what can i make/i);
    await screen.findByRole('heading', { name: 'What can I make?' });
    expect(screen.getByRole('button', { name: 'Keep these foods' })).toBeDisabled();
    await user.type(screen.getByLabelText('What do you have?'), 'banana, oats and egg');
    expect(await screen.findByLabelText('Recognized foods')).toBeInTheDocument();
    const top = screen.queryByLabelText('Top recipes');
    if (top) expect(within(top).getAllByRole('listitem').length).toBeLessThanOrEqual(3);
    expect(primaries()).toEqual(['Keep these foods']);
    await expectNoViolations();

    await user.click(screen.getByRole('button', { name: 'Keep these foods' }));
    await expectOnMake();
    expect(captured!.onHand).toEqual(expect.arrayContaining(['banana']));
    network.expectNoNetwork();
  });
});

describe('quick solve: Save recipes', () => {
  it('shows both boxes and an example with its safety result and disclaimers, without saving', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    renderApp('/onboarding/tour', onboardedState());
    await chooseAndShow(user, /save recipes/i);
    await screen.findByRole('heading', { name: 'Save recipes' });
    expect(screen.getByRole('button', { name: /ask chatgpt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /from an instagram reel/i })).toBeInTheDocument();
    expect(primaries()).toEqual(['Open Add recipe']);

    await user.click(screen.getByRole('button', { name: 'Try an example' }));
    const preview = screen.getByRole('region', { name: 'Example preview' });
    expect(within(preview).getByText('Oat and banana pancakes')).toBeInTheDocument();
    expect(within(preview).getByText(/nothing was saved/i)).toBeInTheDocument();
    const safety = within(preview).getByRole('status', { name: 'Safety results' });
    expect(within(safety).getByText('Allergen:')).toBeInTheDocument();
    expect(within(safety).getByText(NOT_MEDICAL_ADVICE)).toBeInTheDocument();
    expect(within(safety).getByText(SCREEN_LIMITS)).toBeInTheDocument();
    expect(primaries()).toEqual(['Open Add recipe']);
    expect(captured!.customRecipes).toEqual([]);
    await expectNoViolations();

    await user.click(screen.getByRole('button', { name: 'Open Add recipe' }));
    expect(await screen.findByRole('heading', { name: /^add recipe$/i })).toBeInTheDocument();
    expect(captured!.customRecipes).toEqual([]);
    network.expectNoNetwork();
  });
});

describe('quick solve: Plan and grocery', () => {
  it('shows a draft week and grocery list, and keeps it', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    renderApp('/onboarding/tour', onboardedState());
    await chooseAndShow(user, /plan the week/i);
    await screen.findByRole('heading', { name: 'Plan the week' });
    expect(screen.getByLabelText('Draft week')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Grocery list' })).toBeInTheDocument();
    expect(primaries()).toEqual(['Keep this plan']);
    // Nothing is stored before "Keep this plan".
    expect(captured!.plan.days.every((day) => Object.keys(day).length === 0)).toBe(true);
    await expectNoViolations();

    await user.click(screen.getByRole('button', { name: 'Keep this plan' }));
    await expectOnMake();
    expect(captured!.plan.days.some((day) => Object.keys(day).length > 0)).toBe(true);
    network.expectNoNetwork();
  });

  it('discards the draft on "Not now"', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding/tour', onboardedState());
    await chooseAndShow(user, /plan the week/i);
    await screen.findByRole('heading', { name: 'Plan the week' });
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    await expectOnMake();
    expect(captured!.plan.days.every((day) => Object.keys(day).length === 0)).toBe(true);
  });
});

describe('quick solve: what is safe for my child', () => {
  it('lists foods to leave out with sources and the disclaimers', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding/tour', onboardedState(8));
    await chooseAndShow(user, /what's safe for my child/i);
    await screen.findByRole('heading', { name: 'Foods to leave out' });
    const list = screen.getByRole('list', { name: /leave out/i });
    expect(within(list).getByText('Honey')).toBeInTheDocument();
    expect(within(list).getAllByRole('link').length).toBeGreaterThan(0);
    const result = screen.getByRole('status', { name: 'Food check result' });
    expect(within(result).getByText(NOT_MEDICAL_ADVICE)).toBeInTheDocument();
    expect(within(result).getByText(SCREEN_LIMITS)).toBeInTheDocument();
    expect(primaries()).toEqual(['Done']);
    await expectNoViolations();
  });

  it('shows the rule message and sources when a rule fires', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding/tour', onboardedState(8));
    await chooseAndShow(user, /what's safe for my child/i);
    await user.type(await screen.findByLabelText('Check a food'), 'honey');
    await user.click(screen.getByRole('button', { name: 'Check food' }));
    const result = screen.getByRole('status', { name: 'Food check result' });
    expect(within(result).getByText('Honey.')).toBeInTheDocument();
    expect(within(result).getAllByRole('link').length).toBeGreaterThan(0);
    expect(within(result).queryByText(/has no rule for/i)).not.toBeInTheDocument();
    await expectNoViolations();
  });

  it('shows exactly the approved sentence when no rule fires, never "safe", "OK" or green', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    renderApp('/onboarding/tour', onboardedState(8));
    await chooseAndShow(user, /what's safe for my child/i);
    await user.type(await screen.findByLabelText('Check a food'), 'zucchini');
    await user.click(screen.getByRole('button', { name: 'Check food' }));
    const result = screen.getByRole('status', { name: 'Food check result' });
    expect(
      within(result).getByText("FirstMenu's list has no rule for zucchini at this age."),
    ).toBeInTheDocument();
    expect(within(result).getByText(NOT_MEDICAL_ADVICE)).toBeInTheDocument();
    expect(within(result).getByText(SCREEN_LIMITS)).toBeInTheDocument();
    expect(result.textContent).not.toMatch(/\bsafe\b|\bok\b|\bokay\b/i);
    expect(result.querySelector('[class*="green"], [data-variant="green"], [data-color="green"]')).toBeNull();
    await expectNoViolations();
    network.expectNoNetwork();
  });
});

describe('end screen', () => {
  it('links the other chosen features and goes to Make', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding/tour', onboardedState());
    await chooseAndShow(user, /what's safe for my child/i, /plan the week/i);
    // Plan comes first in the fixed order.
    await screen.findByRole('heading', { name: 'Plan the week' });
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    await screen.findByRole('heading', { name: /all set/i });
    const links = screen.getByRole('list', { name: /other things/i });
    expect(within(links).getAllByRole('link')).toHaveLength(1);
    expect(within(links).getByRole('link', { name: /open foods/i })).toHaveAttribute('href', '/foods');
    expect(primaries()).toEqual(['Go to Make']);
    await expectNoViolations();
    await user.click(screen.getByRole('button', { name: 'Go to Make' }));
    await expectOnMake();
  });

  it('skip works at every solve step', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding/tour', onboardedState());
    await chooseAndShow(user, /save recipes/i, /plan the week/i);
    await screen.findByRole('heading', { name: 'Save recipes' });
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    await expectOnMake();
  });
});

describe('/onboarding/tour and Settings "Quick tour"', () => {
  it('opens the problems step for an onboarded user, without the profile step', async () => {
    renderApp('/onboarding/tour', onboardedState());
    expect(await screen.findByRole('heading', { name: PROBLEMS_HEADING })).toBeInTheDocument();
    expect(screen.queryByLabelText(/birth date/i)).not.toBeInTheDocument();
  });

  it('redirects a user who has not finished onboarding to /onboarding', async () => {
    renderApp('/onboarding/tour');
    expect(await screen.findByRole('heading', { name: /welcome to firstmenu/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: PROBLEMS_HEADING })).not.toBeInTheDocument();
  });

  it('is reachable from the Settings "Quick tour" link', async () => {
    const user = userEvent.setup();
    renderApp('/settings', onboardedState());
    await user.click(await screen.findByRole('link', { name: 'Quick tour' }));
    expect(await screen.findByRole('heading', { name: PROBLEMS_HEADING })).toBeInTheDocument();
    await waitFor(() => expect(primaries()).toEqual(['Show me']));
  });
});

describe('design refinement (task 19.2, onboarding)', () => {
  it('opts the problem chips into the shared toggle style and reflects the pressed state', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding/tour', onboardedState());
    await screen.findByRole('heading', { name: PROBLEMS_HEADING });
    const chips = screen
      .getByRole('list', { name: /choose one or more/i })
      .querySelectorAll('button');
    expect(chips).toHaveLength(5);
    for (const chip of Array.from(chips)) {
      expect(chip).toHaveClass('fm-toggle');
      expect(chip).toHaveAttribute('aria-pressed', 'false');
    }
    await user.click(chips[0]);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    expect(chips[0]).toHaveClass('fm-toggle');
    expect(primaries()).toEqual(['Show me']);
    await expectNoViolations();
  });

  it('styles the source links in the safety solve as fm-link', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding/tour', onboardedState(8));
    await chooseAndShow(user, /what's safe for my child/i);
    const list = await screen.findByRole('list', { name: /leave out/i });
    for (const link of within(list).getAllByRole('link')) expect(link).toHaveClass('fm-link');
  });

  it('gives the end-screen links the fm-link style', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding/tour', onboardedState());
    await chooseAndShow(user, /what's safe for my child/i, /plan the week/i);
    await screen.findByRole('heading', { name: 'Plan the week' });
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    await screen.findByRole('heading', { name: /all set/i });
    const link = screen.getByRole('link', { name: /open foods/i });
    expect(link).toHaveClass('fm-link');
    expect(screen.getByRole('list', { name: /other things/i }).className).toMatch(/links/);
  });

  it('shows the first-run disclaimer on onboarding as the lighter box, wording unchanged', async () => {
    renderApp('/onboarding', { ...onboardedState(), onboarded: false, disclaimerAcknowledged: false });
    const box = await screen.findByRole('alertdialog');
    expect(box.className).toMatch(/compact/);
    expect(within(box).getByRole('heading', { name: 'Before you start' })).toBeVisible();
    expect(within(box).getByText(NOT_MEDICAL_ADVICE)).toBeVisible();
    expect(within(box).getByText(SCREEN_LIMITS)).toBeVisible();
    await expectNoViolations();
  });
});
