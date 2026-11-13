// Design pass on Sources and Settings (task 19.2, last PR): a jump list and
// publisher groups on Sources, grouped cards, a 44 px Quick tour link and a
// sticky pill Save on Settings, with axe on each changed state. The source
// content is pinned by Sources.test.tsx and the fields by Settings.test.tsx.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import App from '../../App';
import { spyOnNetwork } from '../../test/networkSpy';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState } from '../../domain/types';
import { BUILTIN_RECIPES } from '../../data/recipes';
import { RULES } from '../../domain/safety/rules';
import { NOT_MEDICAL_ADVICE } from '../components/Disclaimer';

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
    disclaimerAcknowledged: true,
    dismissed: { 'pantry-setup': new Date().toISOString() },
  };
}

function renderAt(path: string, state: AppState = seed()) {
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
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AppProvider>,
  );
}


async function noViolations(container: HTMLElement) {
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
}

const primaries = () =>
  Array.from(document.querySelectorAll('[data-variant="primary"]')).map((e) => e.textContent);

const distinctRecipeSources = () => new Set(BUILTIN_RECIPES.flatMap((r) => (r.source ? [r.source.url] : [])));

describe('Sources: jump list and grouping', () => {
  it('opens with an "On this page" list of the five sections, with counts', () => {
    renderAt('/sources');
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    const names = within(nav).getAllByRole('link').map((a) => a.textContent);
    expect(names).toHaveLength(5);
    expect(names[0]).toBe(`Safety rules (${RULES.length})`);
    expect(names[2]).toBe('New food spacing');
    expect(names[4]).toBe(`Recipe sources (${distinctRecipeSources().size})`);
    // Each jump link goes to a heading that exists.
    for (const name of ['Safety rules', 'Nutrition tags', 'New food spacing', 'References', 'Recipe sources']) {
      expect(screen.getByRole('heading', { name, level: 2 })).toHaveAttribute('id');
    }
  });

  it('moves focus to the section heading instead of changing the route', () => {
    renderAt('/sources');
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    fireEvent.click(within(nav).getByRole('link', { name: /^References/ }));
    expect(screen.getByRole('heading', { name: 'References', level: 2 })).toHaveFocus();
    fireEvent.click(screen.getAllByRole('link', { name: 'Back to top' })[0]);
    expect(screen.getByRole('heading', { name: 'Sources', level: 1 })).toHaveFocus();
  });

  it('groups recipe sources by publisher with a jump link and a count each', () => {
    renderAt('/sources');
    const section = screen.getByRole('heading', { name: 'Recipe sources', level: 2 }).closest('section') as HTMLElement;
    const groups = within(section).getAllByRole('heading', { level: 3 });
    expect(groups.length).toBeGreaterThan(1);
    let total = 0;
    for (const group of groups) {
      const items = group.nextElementSibling?.querySelectorAll(':scope > li') ?? [];
      expect(items.length).toBeGreaterThan(0);
      total += items.length;
      const jump = within(section).getByRole('link', { name: new RegExp(`^${group.textContent?.replace(/[()]/g, '\\$&')} \\(${items.length}\\)$`) });
      fireEvent.click(jump);
      expect(group).toHaveFocus();
    }
    expect(total).toBe(distinctRecipeSources().size);
    // The retrieved date stays on every entry.
    expect(within(section).getAllByText(/^\(retrieved \d{4}-\d{2}-\d{2}\)$/)).toHaveLength(total);
  });

  it('gives every source link its own full-size row and the shared link style', () => {
    renderAt('/sources');
    const external = screen.getAllByRole('link').filter((a) => a.getAttribute('target') === '_blank');
    expect(external.length).toBeGreaterThan(400);
    for (const a of external) {
      expect(a).toHaveClass('fm-link');
      expect(getComputedStyle(a).display).toBe('flex');
      expect(getComputedStyle(a).minHeight).toBe('44px');
    }
    // Two sources are two rows, with no stray comma text between them.
    const rule = screen.getByRole('heading', { name: 'peanut' }).closest('li') as HTMLElement;
    const rows = rule.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rule.querySelector('ul')?.textContent).toBe([...rows].map((r) => r.textContent).join(''));
  });

  it('puts each section on a band with its own way back to the top', () => {
    renderAt('/sources');
    const band = screen.getByRole('heading', { name: 'Safety rules', level: 2 }).closest('section') as HTMLElement;
    expect(band.className).toMatch(/band/);
    expect(within(band).getByRole('link', { name: 'Back to top' })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderAt('/sources');
    await noViolations(container);
  });
});

describe('Sources and Settings network use', () => {
  it('make no network request while jumping around or saving', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    renderAt('/sources');
    fireEvent.click(screen.getByRole('link', { name: /^Recipe sources/ }));
    cleanup();
    renderAt('/settings');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    network.expectNoNetwork();
  });
});

describe('Settings: grouping, Quick tour and Save', () => {
  it('styles Quick tour as a 44 px fm-link', () => {
    renderAt('/settings');
    const link = screen.getByRole('link', { name: 'Quick tour' });
    expect(link).toHaveClass('fm-link');
    expect(getComputedStyle(link).minHeight).toBe('44px');
  });

  it('groups the page into Pantry, Child profile and Foods already tried', () => {
    renderAt('/settings');
    const pantry = screen.getByRole('region', { name: 'Pantry' });
    const profile = screen.getByRole('region', { name: 'Child profile' });
    expect(within(profile).getByRole('textbox', { name: /First name/ })).toBeInTheDocument();
    expect(profile.querySelector('#settings-birthdate')).not.toBeNull();
    expect(within(pantry).getByRole('checkbox', { name: 'rice' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Foods already tried' })).toBeInTheDocument();
  });

  it('keeps Save as the only filled primary, 48 px tall in a sticky pill', () => {
    renderAt('/settings');
    expect(primaries()).toEqual(['Save']);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(getComputedStyle(save).minHeight).toBe('48px');
    expect(getComputedStyle(save).borderRadius).toBe('999px');
    const bar = save.parentElement as HTMLElement;
    expect(getComputedStyle(bar).position).toBe('sticky');
    // The bar is click-through so the field beside the pill stays usable.
    expect(getComputedStyle(bar).pointerEvents).toBe('none');
    expect(getComputedStyle(save).pointerEvents).toBe('auto');
  });

  it('gives the birth date a 44 px target', () => {
    renderAt('/settings');
    expect(getComputedStyle(screen.getByLabelText('Birth date')).minHeight).toBe('44px');
  });

  it('keeps the disclaimer wording on the page', async () => {
    renderAt('/settings');
    expect(screen.getByText(NOT_MEDICAL_ADVICE, { exact: false })).toBeInTheDocument();
  });

  it('has no axe violations at the top, with a future date, and after saving', async () => {
    const user = userEvent.setup();
    const { container } = renderAt('/settings');
    await noViolations(container);
    const date = screen.getByLabelText('Birth date');
    await user.clear(date);
    await user.type(date, '2999-01-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Birth date can’t be in the future.')).toBeInTheDocument();
    await noViolations(container);
    await user.clear(date);
    await user.type(date, '2026-03-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    await noViolations(container);
  });
});
