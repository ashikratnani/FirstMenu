// Pictures on the recipe page (Requirement 21, task 19.4): the plate at the
// top, a greyed plate and hourglass on a Not yet recipe, the snowflake on the
// freezer line, and nothing that changes a name or a label.

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import RecipeDetail from './RecipeDetail';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState, Recipe } from '../../domain/types';
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

const CHICKEN = recipe('c-chicken', 'Chicken Rice Plate', ['chicken', 'rice']);
const HONEY_BANANA = recipe('c-honey', 'Honey Banana Bites', ['honey', 'banana']);
const MASHED = recipe('c-mashed', 'Mashed banana', ['banana']);
const GRAPE = recipe('c-grape', 'Grape Rice', ['grapes', 'rice']);
const SALMON = recipe('c-salmon', 'Salmon Rice', ['salmon', 'rice']);
const FROZEN = recipe('c-frozen', 'Freezer Chicken', ['chicken'], { storage: { freezerMonths: 3 } } as Partial<Recipe>);

const OLD = '2026-01-01';
function seedState(extra: Partial<AppState> = {}, ageMonths = 10, customRecipes: Recipe[] = []): AppState {
  return {
    ...defaultState(new Date()),
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(ageMonths) },
    onboarded: true,
    customRecipes: customRecipes.length
      ? customRecipes
      : [CHICKEN, HONEY_BANANA, MASHED, GRAPE, SALMON, FROZEN],
    foods: Object.fromEntries(
      ['chicken', 'rice', 'banana', 'grapes'].map((key) => [key, { status: 'tried' as const, date: OLD }]),
    ),
    ...extra,
  };
}

function renderDetail(seed: AppState, id: string) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={[`/recipes/${id}`]}>
        <Routes>
          <Route path="/recipes/:id" element={<RecipeDetail />} />
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

describe('Recipe page plate (Requirement 21.5)', () => {
  it('shows the plate on a food-group band, ungreyed, with no hourglass on a ready recipe', () => {
    renderDetail(seedState(), 'c-chicken');
    expect(band()).toHaveAttribute('data-band', 'protein');
    expect(imgs(document.body).some((s) => s.includes('/poultry_leg.webp'))).toBe(true);
    expect(hasHourglass(document.body)).toBe(false);
    expect([...document.querySelectorAll('img')].some((i) => /greyed/.test(i.className))).toBe(false);
    expect(screen.queryByRole('note', { name: /^Not yet/ })).toBeNull();
  });

  it('puts the plate after the title and keeps every picture decorative', () => {
    renderDetail(seedState(), 'c-chicken');
    const title = screen.getByRole('heading', { level: 1, name: 'Chicken Rice Plate' });
    expect(title.compareDocumentPosition(band()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const img of document.querySelectorAll('img')) expect(img).toHaveAttribute('alt', '');
  });

  it.each([10, 30])('never draws a choking-shape food on the plate at %i months', (months) => {
    renderDetail(seedState({}, months, [GRAPE]), 'c-grape');
    expect(imgs(document.body).length).toBeGreaterThan(0);
    expect(imgs(document.body).some((s) => s.includes('grapes'))).toBe(false);
  });

  it('leaves a Not yet food off a ready recipe plate', () => {
    // "mako" is typed as shark: a Not yet food the text screen does not name, so the recipe stays ready.
    const mako = recipe('c-mako', 'Mako Carrot', ['carrot'], {
      ingredients: [
        { name: 'mako', food: 'shark', category: 'other' },
        { name: 'carrot', category: 'produce' },
      ],
    });
    renderDetail(seedState({}, 10, [mako]), 'c-mako');
    expect(screen.queryByRole('note', { name: /^Not yet/ })).toBeNull();
    expect(imgs(document.body).some((s) => s.includes('/carrot.webp'))).toBe(true);
    expect(imgs(document.body).some((s) => /shark/.test(s))).toBe(false);
  });
});

describe('Not yet recipe page', () => {
  it('greys the plate, keeps its foods and shows the hourglass by the unchanged Not yet note', () => {
    renderDetail(seedState(), 'c-honey');
    expect(band()).toHaveAttribute('data-band', 'not-yet');
    const banana = [...document.querySelectorAll('img')].find((i) => i.getAttribute('src')?.includes('/banana.webp'));
    expect(banana).toBeDefined();
    expect(banana!.className).toMatch(/greyed/);
    const note = screen.getByRole('note', { name: /^Not yet\. / });
    expect(within(note).getByRole('heading', { level: 2, name: 'Not yet' })).toBeInTheDocument();
    expect(hasHourglass(note)).toBe(true);
  });

  it('a recorded reaction keeps the food on the plate, greyed, never the generic bowl', () => {
    renderDetail(seedState({ foods: { banana: { status: 'reaction', date: '2026-03-01' } } }), 'c-mashed');
    const sources = imgs(document.body);
    expect(sources.some((s) => s.includes('/banana.webp'))).toBe(true);
    expect(sources.some((s) => s.includes('bowl_with_spoon'))).toBe(false);
    expect(band()).toHaveAttribute('data-band', 'not-yet');
    expect(hasHourglass(document.body)).toBe(true);
  });
});

describe('Freezer line', () => {
  it('shows the snowflake before the unchanged "Freezes for N months" text', () => {
    renderDetail(seedState(), 'c-frozen');
    const line = screen.getByText('Freezes for 3 months');
    expect(line.parentElement?.querySelector('img')?.getAttribute('src')).toContain('snowflake');
  });

  it('shows no snowflake without freezer information', () => {
    renderDetail(seedState(), 'c-chicken');
    expect(imgs(document.body).some((s) => s.includes('snowflake'))).toBe(false);
  });
});

describe('Wording and accessibility', () => {
  it('uses no ghost, door or pumpkin words in its own text or labels', () => {
    renderDetail(seedState(), 'c-honey');
    const labels = [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label'));
    expect(`${document.body.textContent} ${labels.join(' ')}`).not.toMatch(/ghost|door|pumpkin/i);
  });

  it('has no axe violations (ready, Not yet, freezer) and makes no network calls', async () => {
    const network = spyOnNetwork();
    for (const id of ['c-frozen', 'c-honey']) {
      const { container, unmount } = renderDetail(seedState(), id);
      expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
      unmount();
    }
    network.expectNoNetwork();
  });
});
