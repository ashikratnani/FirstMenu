// Pictures on the shared recipe view (Requirements 21.5, 21.8, task 19.4): the
// plate at the top, greyed with the hourglass only when this view's own Not yet
// section shows, so never without a child, and a recorded reaction alone never
// greys the plate.

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import SharedRecipeView from './SharedRecipeView';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState, Recipe } from '../../domain/types';
import { encodeRecipeShare } from '../../domain/recipeShare';
import { spyOnNetwork } from '../../test/networkSpy';

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

function recipe(id: string, title: string, foods: string[], extra: Partial<Recipe> = {}): Recipe {
  return {
    id,
    origin: 'custom',
    title,
    stages: ['9-12', '12-23', '24-36'],
    mealTypes: ['dinner'],
    ingredients: foods.map((name) => ({ name, category: 'other' as const })),
    steps: ['Mix.'],
    texture: 'soft',
    servings: 2,
    statedMinutes: 10,
    ...extra,
  };
}

const HONEY_BANANA = recipe('c-honey', 'Honey Banana Bites', ['honey', 'banana']);
const MASHED = recipe('c-mashed', 'Mashed banana', ['banana']);

function seedState(extra: Partial<AppState> = {}, withChild = true): AppState {
  const child = withChild ? { name: 'Baby', birthDate: birthDateMonthsAgo(10) } : undefined;
  return { ...defaultState(new Date()), child, onboarded: true, ...extra };
}

function renderShared(seed: AppState, shared: Recipe) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={[`/r/${encodeRecipeShare(shared).encoded}`]}>
        <Routes>
          <Route path="/r/:data" element={<SharedRecipeView />} />
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
}

const AXE_OPTIONS = {
  rules: {
    'color-contrast': { enabled: false },
    'label-content-name-mismatch': { enabled: false },
  },
} as const;

const imgs = (el: HTMLElement) => [...el.querySelectorAll('img')].map((i) => i.getAttribute('src') ?? '');
const band = () => document.querySelector('[data-band]');
const hasHourglass = (el: HTMLElement) => imgs(el).some((s) => s.includes('hourglass_not_done'));
const bananaGreyed = () => {
  const banana = [...document.querySelectorAll('img')].find((i) => i.getAttribute('src')?.includes('/banana.webp'));
  expect(banana).toBeDefined();
  return /greyed/.test(banana!.className);
};

describe('Shared recipe view plate', () => {
  it('with no child set up shows the plate, nothing greyed and no hourglass', () => {
    renderShared(seedState({}, false), HONEY_BANANA);
    expect(band()).not.toHaveAttribute('data-band', 'not-yet');
    expect(bananaGreyed()).toBe(false);
    expect(hasHourglass(document.body)).toBe(false);
    expect(screen.queryByRole('heading', { name: 'Not yet' })).toBeNull();
  });

  it('with a block finding greys the plate, keeps the foods and shows the hourglass in the Not yet section', () => {
    renderShared(seedState(), HONEY_BANANA);
    expect(band()).toHaveAttribute('data-band', 'not-yet');
    expect(bananaGreyed()).toBe(true);
    const note = screen.getByRole('note', { name: 'Not yet' });
    expect(hasHourglass(note)).toBe(true);
    const title = screen.getByRole('heading', { level: 1, name: 'Honey Banana Bites' });
    expect(title.compareDocumentPosition(band()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('with only a recorded reaction keeps the reaction food on the plate, not greyed', () => {
    renderShared(seedState({ foods: { banana: { status: 'reaction', date: '2026-03-01' } } }), MASHED);
    expect(band()).not.toHaveAttribute('data-band', 'not-yet');
    expect(bananaGreyed()).toBe(false);
    expect(imgs(document.body).some((s) => s.includes('bowl_with_spoon'))).toBe(false);
    expect(hasHourglass(document.body)).toBe(false);
    expect(screen.queryByRole('heading', { name: 'Not yet' })).toBeNull();
  });
});

describe('Wording and accessibility', () => {
  it('keeps the plate decorative and uses no ghost, door or pumpkin words', () => {
    renderShared(seedState(), HONEY_BANANA);
    for (const img of document.querySelectorAll('img')) expect(img).toHaveAttribute('alt', '');
    const labels = [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label'));
    expect(`${document.body.textContent} ${labels.join(' ')}`).not.toMatch(/ghost|door|pumpkin/i);
  });

  it('has no axe violations (Not yet, no child) and makes no network calls', async () => {
    const network = spyOnNetwork();
    for (const seed of [seedState(), seedState({}, false)]) {
      const { container, unmount } = renderShared(seed, HONEY_BANANA);
      expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
      unmount();
    }
    network.expectNoNetwork();
  });
});
