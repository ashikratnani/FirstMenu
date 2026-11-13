// The snowflake on the Prep page's freezer badge (Requirement 21, task 19.4):
// the pumpkin drawing is gone, the badge keeps its text and its visibility
// condition, the lantern stays, and nothing else on the page gets a picture.

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import RouterLinkProvider from '../theme/RouterLinkProvider';
import Prep from './Prep';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState, Recipe } from '../../domain/types';
import { spyOnNetwork } from '../../test/networkSpy';
import prepCss from './Prep.module.css?raw';

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

vi.mock('../../data/recipes', () => ({ BUILTIN_RECIPES: [] }));

function makeStorage(seed: AppState): Storage {
  const map = new Map<string, string>([[STORAGE_KEY, JSON.stringify(seed)]]);
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

function stew(id: string, title: string, storage: Recipe['storage']): Recipe {
  return {
    id,
    origin: 'custom',
    title,
    stages: ['6-8', '9-12'],
    mealTypes: ['dinner'],
    ingredients: [{ name: 'carrot', category: 'produce' }],
    steps: ['Cook.'],
    texture: 'smooth',
    servings: 1,
    storage,
  };
}

function renderPrep(recipes: Recipe[]) {
  const s = defaultState(new Date());
  const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
  recipes.forEach((r, i) => {
    days[i] = { dinner: r.id };
  });
  const seed: AppState = {
    ...s,
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(8) },
    onboarded: true,
    customRecipes: recipes,
    plan: { ...s.plan, startDate: '2026-03-02', prepDate: '2026-03-01', activeSlots: ['dinner'], days },
  };
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={['/prep']}>
        <RouterLinkProvider>
          <Prep />
        </RouterLinkProvider>
      </MemoryRouter>
    </AppProvider>,
  );
}

const FREEZES = stew('custom-freezes', 'Freezer Stew', { fridgeDays: 1, freezerMonths: 3 });
const ZERO = stew('custom-zero', 'Zero Stew', { fridgeDays: 1, freezerMonths: 0 });
const NONE = stew('custom-none', 'Fridge Stew', { fridgeDays: 1 });

describe('Prep freezer badge picture', () => {
  it('shows the snowflake, decorative, beside the unchanged text', () => {
    renderPrep([FREEZES]);
    const session = screen.getByRole('group', { name: /Freezer Stew/ });
    const badge = within(session).getByText('Freezes for 3 months');
    const img = badge.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain('art/state/snowflake');
    expect(img).toHaveAttribute('alt', '');
    expect(badge.querySelector('svg')).toBeNull();
    expect(badge.textContent).toBe('Freezes for 3 months');
  });

  it('shows no badge when freezerMonths is 0 or missing', () => {
    renderPrep([ZERO, NONE]);
    expect(screen.getByRole('group', { name: /Zero Stew/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Fridge Stew/ })).toBeInTheDocument();
    expect(screen.queryByText(/Freezes for/)).toBeNull();
    expect(document.querySelector('img[src*="snowflake"]')).toBeNull();
  });

  it('draws no pumpkin and keeps no badge icon style', () => {
    const { container } = renderPrep([FREEZES]);
    expect(container.innerHTML).not.toContain('#e07b2f');
    expect(prepCss).not.toMatch(/badgeIcon|pumpkin/i);
    const own = `${container.textContent} ${Array.from(container.querySelectorAll('[aria-label]'))
      .map((n) => n.getAttribute('aria-label'))
      .join(' ')}`;
    expect(own).not.toMatch(/ghost|door|pumpkin/i);
  });

  it('has no accessibility violations and makes no network calls', async () => {
    const network = spyOnNetwork();
    const { container } = renderPrep([FREEZES, ZERO]);
    expect(await axe(container)).toHaveNoViolations();
    network.expectNoNetwork();
  });
});
