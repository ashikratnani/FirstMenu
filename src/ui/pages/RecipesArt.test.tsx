// Pictures on the My recipes screen (Requirement 21, task 19.4): a plate on
// every card, a greyed plate with the hourglass on Not yet cards, the new-food
// and freezer lines, the empty-state monster, and nothing that changes a name
// or a label.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import Recipes from './Recipes';
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

function renderRecipes(seed: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={['/recipes']}>
        <Recipes />
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
const band = (el: HTMLElement) => el.querySelector('[data-band]');
const hasHourglass = (el: HTMLElement) => imgs(el).some((s) => s.includes('hourglass_not_done'));
const cardOf = (name: RegExp) => screen.getByRole('link', { name }).closest('li') as HTMLElement;

describe('My recipes cards show plates (Requirement 21.1)', () => {
  it('puts a plate on a food-group band on every card, with no hourglass on a ready one', () => {
    renderRecipes(seedState());
    const cards = within(screen.getByRole('list', { name: 'Recipes' })).getAllByRole('listitem');
    expect(cards.length).toBeGreaterThan(3);
    for (const card of cards) {
      expect(band(card)).not.toBeNull();
      expect(imgs(card).length).toBeGreaterThan(0);
    }
    const chicken = cardOf(/Chicken Rice Plate/);
    expect(band(chicken)).toHaveAttribute('data-band', 'protein');
    expect(imgs(chicken).some((s) => s.includes('/poultry_leg.webp'))).toBe(true);
    expect(hasHourglass(chicken)).toBe(false);
  });

  it.each([10, 30])('never draws a choking-shape food on a plate at %i months', (months) => {
    renderRecipes(seedState({}, months, [GRAPE, CHICKEN]));
    expect(screen.getByText('Grape Rice')).toBeInTheDocument();
    expect(imgs(document.body).length).toBeGreaterThan(0);
    expect(imgs(document.body).some((s) => s.includes('grapes'))).toBe(false);
  });

  it('shows the new-food monster before the unchanged text and keeps the link name', () => {
    renderRecipes(seedState());
    const card = cardOf(/Salmon Rice/);
    const line = within(card).getByText('New food: fish');
    expect(line.parentElement?.querySelector('svg, img')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Salmon Rice/ })).toHaveAccessibleName(/\. New food: fish\./);
  });

  it('shows the snowflake before the unchanged "Freezes for N months" text', () => {
    renderRecipes(seedState());
    const card = cardOf(/Freezer Chicken/);
    const line = within(card).getByText('Freezes for 3 months');
    expect(line.parentElement?.querySelector('img')?.getAttribute('src')).toContain('snowflake');
    expect(screen.getByRole('link', { name: /Freezer Chicken/ })).toHaveAccessibleName(/Freezes for 3 months/);
  });
});

describe('Not yet cards', () => {
  it('grey the plate, keep the foods and show the hourglass before the unchanged reason', () => {
    renderRecipes(seedState());
    const card = cardOf(/Honey Banana Bites/);
    expect(band(card)).toHaveAttribute('data-band', 'not-yet');
    const reason = within(card).getByText(/^Not yet: honey\./);
    expect(reason.parentElement?.querySelector('img')?.getAttribute('src')).toContain('hourglass_not_done');
    const banana = [...card.querySelectorAll('img')].find((i) => i.getAttribute('src')?.includes('/banana.webp'));
    expect(banana).toBeDefined();
    expect(banana!.className).toMatch(/greyed/);
    expect(screen.getByRole('link', { name: /Honey Banana Bites/ })).toHaveAccessibleName(
      /^Honey Banana Bites\. Not yet: honey\. Available at 12 months\./,
    );
  });

  it('a recorded reaction keeps the food on the plate, greyed, never the generic bowl', () => {
    renderRecipes(seedState({ foods: { banana: { status: 'reaction', date: '2026-03-01' } } }));
    const card = cardOf(/^Mashed banana\. Not yet/);
    const sources = imgs(card);
    expect(sources.some((s) => s.includes('/banana.webp'))).toBe(true);
    expect(sources.some((s) => s.includes('bowl_with_spoon'))).toBe(false);
    expect(hasHourglass(card)).toBe(true);
    expect(band(card)).toHaveAttribute('data-band', 'not-yet');
  });

  it('a ready card is never greyed', () => {
    renderRecipes(seedState());
    expect(hasHourglass(cardOf(/Chicken Rice Plate/))).toBe(false);
    expect([...cardOf(/Chicken Rice Plate/).querySelectorAll('img')].some((i) => /greyed/.test(i.className))).toBe(false);
  });
});

describe('Empty state and wording', () => {
  it('shows the friendly monster beside "No recipes match your search or filters.", decorative', async () => {
    const user = userEvent.setup();
    renderRecipes(seedState());
    await user.type(screen.getByRole('searchbox', { name: 'Search recipes' }), 'zzzzqx');
    const message = screen.getByText('No recipes match your search or filters.');
    const art = message.parentElement!.querySelector('svg');
    expect(art).not.toBeNull();
    expect(art).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses no ghost, door or pumpkin words in its own text or labels', () => {
    renderRecipes(seedState());
    const labels = [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label'));
    expect(`${document.body.textContent} ${labels.join(' ')}`).not.toMatch(/ghost|door|pumpkin/i);
  });

  it('has no axe violations with cards and in the empty state, and makes no network calls', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    const { container } = renderRecipes(seedState());
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
    await user.type(screen.getByRole('searchbox', { name: 'Search recipes' }), 'zzzzqx');
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
    network.expectNoNetwork();
  });
});
