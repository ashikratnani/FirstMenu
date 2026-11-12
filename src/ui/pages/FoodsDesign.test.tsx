// Design pass on Foods (task 19.2): a search box, one disclosure button per
// door or monster (the two record buttons appear on demand, one food open at a
// time), and axe on each changed state. Safety states and texts are pinned by
// Foods.test.tsx; here we check they all survive the search and the disclosure.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import Foods, { REACTION_ADVICE } from './Foods';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState } from '../../domain/types';

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
const AXE_OPTIONS = { rules: { 'color-contrast': { enabled: false } } };

afterEach(cleanup);

function birthDateMonthsAgo(months: number): string {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth() - months, n.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seed(): AppState {
  return {
    ...defaultState(new Date()),
    child: { name: 'Zed', birthDate: birthDateMonthsAgo(8) },
    onboarded: true,
    foods: {
      carrot: { status: 'tried', date: '2026-11-12' },
      'allergen:dairy': { status: 'reaction', date: '2026-11-10' },
    },
  };
}

function renderFoods(state: AppState = seed()) {
  const map = new Map([[STORAGE_KEY, JSON.stringify(state)]]);
  const storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } satisfies Storage;
  return render(
    <AppProvider storage={storage}>
      <MemoryRouter initialEntries={['/foods']}>
        <Foods />
      </MemoryRouter>
    </AppProvider>,
  );
}

const recordButtons = () =>
  screen.queryAllByRole('button', { name: /^(Tried, no reaction|Noticed a reaction)$/ });

async function noViolations(container: HTMLElement) {
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
}

describe('Foods disclosure', () => {
  it('shows no record buttons until a food is opened, and keeps Clear reaction visible', async () => {
    const user = userEvent.setup();
    const { container } = renderFoods();
    expect(recordButtons()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Clear reaction' })).toBeInTheDocument();
    await noViolations(container);

    const toggle = screen.getByRole('button', { name: 'Log a try: egg' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(recordButtons()).toHaveLength(2);
    await noViolations(container);
  });

  it('opens one food at a time, for doors and tried foods alike', async () => {
    const user = userEvent.setup();
    renderFoods();
    await user.click(screen.getByRole('button', { name: 'Log a try: egg' }));
    await user.click(screen.getByRole('button', { name: 'Change record: carrot' }));
    expect(screen.getByRole('button', { name: 'Log a try: egg' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    const carrot = screen.getByRole('listitem', { name: /carrot — tried on Nov 12/ });
    expect(within(carrot).getAllByRole('button')).toHaveLength(3);
    expect(recordButtons()).toHaveLength(2);
  });

  it('works from the keyboard', async () => {
    const user = userEvent.setup();
    renderFoods();
    screen.getByRole('button', { name: 'Log a try: apple' }).focus();
    await user.keyboard('{Enter}');
    expect(recordButtons()).toHaveLength(2);
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tried, no reaction' }));
  });
});

describe('Foods after logging and filtering', () => {
  it('collapses the card and moves focus to the new card toggle after "Tried, no reaction"', async () => {
    const user = userEvent.setup();
    renderFoods();
    await user.click(screen.getByRole('button', { name: 'Log a try: egg' }));
    await user.click(screen.getByRole('button', { name: 'Tried, no reaction' }));
    const toggle = screen.getByRole('button', { name: 'Change record: egg' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(recordButtons()).toHaveLength(0);
    expect(document.activeElement).toBe(toggle);
  });

  it('collapses an already tried card after changing its record, keeping focus on its toggle', async () => {
    const user = userEvent.setup();
    renderFoods();
    await user.click(screen.getByRole('button', { name: 'Change record: carrot' }));
    await user.click(screen.getByRole('button', { name: 'Tried, no reaction' }));
    const toggle = screen.getByRole('button', { name: 'Change record: carrot' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(toggle);
  });

  it('moves focus to the reaction note after "Noticed a reaction"', async () => {
    const user = userEvent.setup();
    renderFoods();
    await user.click(screen.getByRole('button', { name: 'Log a try: egg' }));
    await user.click(screen.getByRole('button', { name: 'Noticed a reaction' }));
    const ghost = screen.getByRole('listitem', { name: /Not yet: egg\. Reaction recorded\./ });
    expect(document.activeElement).toBe(within(ghost).getByText(REACTION_ADVICE));
    expect(recordButtons()).toHaveLength(0);
  });

  it('does not bring an open food back when the search is cleared', async () => {
    const user = userEvent.setup();
    renderFoods();
    await user.click(screen.getByRole('button', { name: 'Log a try: egg' }));
    const box = screen.getByRole('searchbox', { name: 'Search foods' });
    await user.type(box, 'zzzz');
    await user.clear(box);
    expect(screen.getByRole('button', { name: 'Log a try: egg' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(recordButtons()).toHaveLength(0);
  });
});

describe('Foods search', () => {
  it('filters by food name, announces the count, and keeps ghost text and reaction advice', async () => {
    const user = userEvent.setup();
    const { container } = renderFoods();
    expect(screen.getByText(/^\d+ foods\.$/)).toHaveAttribute('role', 'status');

    await user.type(screen.getByRole('searchbox', { name: 'Search foods' }), 'dairy');
    expect(screen.getByText(/^1 of \d+ foods match\.$/)).toHaveAttribute('role', 'status');
    const ghost = screen.getByRole('listitem', { name: /Not yet: dairy\. Reaction recorded\./ });
    expect(within(ghost).getByText(REACTION_ADVICE)).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'New food: egg' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'New foods to try' })).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('finds a blocked food with its reason and available-at age', async () => {
    const user = userEvent.setup();
    renderFoods();
    await user.type(screen.getByRole('searchbox', { name: 'Search foods' }), 'HONEY');
    const honey = screen.getByRole('listitem', { name: /Not yet: honey\. Available at 12 months\./ });
    expect(within(honey).getByText(/infant botulism/i)).toBeInTheDocument();
  });

  it('announces no match in the same live region and offers Clear search', async () => {
    const user = userEvent.setup();
    const { container } = renderFoods();
    const region = screen.getByText(/^\d+ foods\.$/);
    await user.type(screen.getByRole('searchbox', { name: 'Search foods' }), 'zzzz');
    const none = screen.getByText('No foods match your search.');
    expect(none).toBe(region);
    expect(none).toHaveAttribute('role', 'status');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    await noViolations(container);

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText(/^\d+ foods\.$/)).toHaveAttribute('role', 'status');
    expect(screen.getByRole('listitem', { name: 'New food: egg' })).toBeInTheDocument();
  });
});
