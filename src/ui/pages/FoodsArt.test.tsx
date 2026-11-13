// Pictures on the Foods screen (Requirement 21, task 19.4): a picture and a
// state badge on every tile, the rule message with a hidden food's picture,
// the group picture for a choking-shape picture, greyed Not yet tiles, the
// empty-state monsters, the first-taste class, and no change to any label.

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import Foods from './Foods';
import { foodTilePicture } from './foodsPicture';
import { FOOD_PICTURES } from '../../data/foodPictures';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState, Recipe } from '../../domain/types';
import { spyOnNetwork } from '../../test/networkSpy';
import tileCss from '../components/foodTile.module.css?raw';

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
// A test map: "zucchini" has the chestnut picture, which no safety rule hides.
vi.mock('../../data/foodPictures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/foodPictures')>();
  return {
    ...actual,
    FOOD_PICTURES: { ...actual.FOOD_PICTURES, zucchini: { group: 'vegetable', picture: 'chestnut' } },
  };
});

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

function recipe(foods: string[]): Recipe {
  return {
    id: 'custom-foods',
    origin: 'custom',
    title: 'Foods',
    stages: ['9-12'],
    mealTypes: ['dinner'],
    ingredients: foods.map((name) => ({ name, category: 'other' as const })),
    steps: ['Mix.'],
    texture: 'smooth',
    servings: 1,
  };
}

function seed(foods: string[], records: AppState['foods'] = {}, ageMonths = 8): AppState {
  return {
    ...defaultState(new Date()),
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(ageMonths) },
    onboarded: true,
    customRecipes: foods.length > 0 ? [recipe(foods)] : [],
    foods: records,
  };
}

function renderFoods(state: AppState) {
  return render(
    <AppProvider storage={makeStorage(state)}>
      <MemoryRouter initialEntries={['/foods']}>
        <Foods />
      </MemoryRouter>
    </AppProvider>,
  );
}

function pictureNames(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('img')).map((img) => /\/([a-z_]+)\.webp$/.exec(img.getAttribute('src') ?? '')![1]);
}

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  );
}

describe('Foods pictures', () => {
  beforeEach(() => mockReducedMotion(false));
  afterEach(() => vi.unstubAllGlobals());

  it('puts a picture on a group-colored circle with a state badge on a new food and a tried food', () => {
    renderFoods(seed(['carrot', 'apple'], { apple: { status: 'tried', date: '2026-11-12' } }));
    const fresh = screen.getByRole('listitem', { name: 'New food: carrot' });
    expect(pictureNames(fresh)).toEqual(['carrot']);
    expect(fresh.querySelector('[data-group="vegetable"]')).not.toBeNull();
    expect(fresh.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
    expect(fresh.querySelector('img')).toHaveAttribute('alt', '');
    const tried = screen.getByRole('listitem', { name: /apple — tried on Nov 12/ });
    expect(tried.querySelector('svg[data-monster]')).not.toBeNull();
    expect(tried.querySelector('[data-group="fruit"]')).not.toBeNull();
  });

  it('uses the allergen entry picture and colors the monster by allergen group', () => {
    renderFoods(seed(['egg'], { 'allergen:egg': { status: 'tried', date: '2026-11-12' } }));
    const tile = screen.getByRole('listitem', { name: /egg — tried on Nov 12/ });
    expect(pictureNames(tile)).toEqual(['egg']);
    expect(tile.querySelector('svg')).toHaveAttribute('data-monster', 'egg');
  });

  it('shows a hidden food with its own picture and the rule message first under the picture and name', () => {
    renderFoods(seed(['grape']));
    const tile = screen.getByRole('listitem', { name: 'New food: grape' });
    expect(pictureNames(tile)).toEqual(['grapes']);
    const message = foodTilePicture('grape', 'grape').hiddenMessage!;
    expect(message).toBeTruthy();
    const head = tile.firstElementChild!;
    expect(head.nextElementSibling).toHaveTextContent(message);
  });

  it('shows the group picture for a choking-shape picture that no rule matches', () => {
    renderFoods(seed(['zucchini']));
    const tile = screen.getByRole('listitem', { name: 'New food: zucchini' });
    expect(pictureNames(tile)).toEqual(['bowl_with_spoon']);
    const map = { chestnut: { group: 'grain' as const, picture: 'chestnut' } };
    expect(foodTilePicture('chestnut', 'chestnut', map)).toEqual({ group: 'grain', picture: 'bowl_with_spoon', hiddenMessage: null });
  });

  it('keeps the control and state labels as they were', async () => {
    const user = userEvent.setup();
    renderFoods(seed(['egg', 'honey', 'carrot'], { carrot: { status: 'tried', date: '2026-11-12' } }));
    expect(screen.getByRole('listitem', { name: 'New food: egg' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'carrot — tried on Nov 12' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Not yet: honey. Available at 12 months.' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log a try: egg' }));
    expect(screen.getByRole('button', { name: 'Tried, no reaction' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change record: carrot' })).toBeInTheDocument();
  });

  it('greys the picture and shows the hourglass on Not yet tiles, block and reaction', () => {
    renderFoods(seed(['honey', 'carrot'], { carrot: { status: 'reaction', date: '2026-11-12' } }));
    for (const name of ['Not yet: honey. Available at 12 months.', 'Not yet: carrot. Reaction recorded.']) {
      const tile = screen.getByRole('listitem', { name });
      const [food, state] = Array.from(tile.querySelectorAll('img'));
      expect(food.className).toMatch(/greyed/);
      expect(state.getAttribute('src')).toMatch(/hourglass_not_done\.webp$/);
      expect(tile.querySelector('[data-group="not-yet"]')).not.toBeNull();
    }
    const block = screen.getByRole('listitem', { name: /Not yet: honey/ });
    expect(block.querySelectorAll('p')).toHaveLength(1);
  });

  it('shows the generic monster beside the empty-state lines ("No foods on hold." never shows with the built-in block rules) and the peekaboo monster for nothing tried', async () => {
    const user = userEvent.setup();
    const { unmount } = renderFoods(seed([], {}, 60));
    const nothing = screen.getByText('Nothing tried yet.').parentElement!;
    expect(nothing.querySelector('svg')).toHaveAttribute('width', '96');
    expect(nothing.querySelector('svg')).not.toHaveAttribute('data-monster');
    unmount();
    const tried: AppState['foods'] = {};
    for (const key of Object.keys(FOOD_PICTURES)) tried[key] = { status: 'tried', date: '2026-11-12' };
    const second = renderFoods(seed([], tried, 60));
    const none = screen.getByText('No new foods right now.').parentElement!.querySelector('svg')!;
    expect(none).toHaveAttribute('width', '96');
    expect(none).toHaveAttribute('data-monster', 'generic');
    second.unmount();
    renderFoods(seed([], {}, 60));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    const noMatch = screen.getByText('No foods match your search.').parentElement!;
    expect(noMatch.querySelector('svg')).toHaveAttribute('data-monster', 'generic');
    expect(screen.queryByText('Nothing tried yet.')).toBeNull();
  });

  it('has no ghost, door or pumpkin in its own wording', () => {
    const { container } = renderFoods(seed(['egg', 'honey']));
    expect(container.textContent).toContain('Tap "Log a try" when your child tries something new.');
    expect(container.textContent).toContain('Allergen foods show guidance from published sources.');
    const own = Array.from(container.querySelectorAll('h1, h2, p, li > div > span')).map((n) => n.textContent).join(' ');
    expect(own).not.toMatch(/ghost|door|pumpkin/i);
  });

  it('has no accessibility violations and makes no network calls', async () => {
    const network = spyOnNetwork();
    const { container } = renderFoods(seed(['egg', 'honey', 'carrot', 'grape'], { carrot: { status: 'tried', date: '2026-11-12' } }));
    expect(await axe(container)).toHaveNoViolations();
    network.expectNoNetwork();
  });
});

describe('Foods first-taste moment', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function logTry() {
    const user = userEvent.setup();
    renderFoods(seed(['carrot']));
    expect(document.querySelector('[class*="pop"]')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Log a try: carrot' }));
    await user.click(screen.getByRole('button', { name: 'Tried, no reaction' }));
  }

  it('sets a class on that one tile after Tried, no reaction and removes it when the animation ends', async () => {
    mockReducedMotion(false);
    await logTry();
    const tile = screen.getByRole('listitem', { name: /carrot — tried/ });
    expect(tile.className).toMatch(/pop/);
    expect(document.activeElement).toBe(within(tile).getByRole('button', { name: /Change record: carrot/ }));
    act(() => {
      fireEvent.animationEnd(tile);
    });
    expect(tile.className).not.toMatch(/pop/);
  });

  it('adds no class under reduced motion, and the CSS guards the animation too', async () => {
    mockReducedMotion(true);
    await logTry();
    expect(screen.getByRole('listitem', { name: /carrot — tried/ }).className).not.toMatch(/pop/);
    expect(tileCss).toMatch(/animation:\s*monster-rise 500ms/);
    expect(tileCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.pop \.badge > svg\s*\{\s*animation:\s*none/);
  });

  it('does not animate a food that was already tried when the page loads', () => {
    mockReducedMotion(false);
    renderFoods(seed(['carrot'], { carrot: { status: 'tried', date: '2026-11-12' } }));
    expect(screen.getByRole('listitem', { name: /carrot — tried/ }).className).not.toMatch(/pop/);
  });
});
