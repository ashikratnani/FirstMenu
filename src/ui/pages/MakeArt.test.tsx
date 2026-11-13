// Pictures on the Make screen (Requirement 21, task 19.4): a plate on every
// card type, a greyed plate with the hourglass on left-out cards, the new-food
// and empty-state monsters, and nothing that changes a name or a label.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import Make from './Make';
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
    stages: ['9-12'],
    mealTypes: ['dinner'],
    ingredients: foods.map((name) => ({ name, category: 'other' as const })),
    steps: ['Mix.'],
    texture: 'soft',
    servings: 2,
    statedMinutes: 10,
    ...extra,
  };
}

const READY = recipe('a-ready', 'Chicken Rice Plate', ['chicken', 'rice']);
const ONE = recipe('a-one', 'Carrot Rice Bowl', ['carrot', 'rice']);
const MORE = recipe('a-more', 'Pea Oat Porridge', ['pea', 'oat'], { mealTypes: ['breakfast'] });
const PANCAKES = recipe('a-pan', 'Banana Pancakes', ['banana', 'flour'], { mealTypes: ['breakfast'] });
const HONEY_BANANA = recipe('a-honey', 'Honey Banana Bites', ['honey', 'banana']);
const HONEY_PANCAKE = recipe('a-hp', 'Honey Pancake', ['honey', 'banana']);
const MASHED = recipe('a-mashed', 'Mashed banana', ['banana']);
const GRAPE_BITES = recipe('a-grape', 'Grape Rice', ['grapes', 'rice']);
const NEW_FOOD = recipe('a-new', 'Salmon Rice', ['salmon', 'rice']);

const OLD = '2026-01-01';
function seedState(extra: Partial<AppState> = {}, ageMonths = 10): AppState {
  return {
    ...defaultState(new Date()),
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(ageMonths) },
    onboarded: true,
    pantry: ['chicken', 'rice'],
    customRecipes: [READY, ONE, MORE, PANCAKES, HONEY_BANANA, HONEY_PANCAKE, MASHED, GRAPE_BITES, NEW_FOOD],
    foods: Object.fromEntries(
      ['chicken', 'rice', 'carrot', 'pea', 'oat', 'banana', 'flour', 'grapes'].map((key) => [
        key,
        { status: 'tried' as const, date: OLD },
      ]),
    ),
    madeLog: [{ recipeId: 'a-ready', date: '2026-03-10' }],
    dismissed: { 'pantry-setup': new Date().toISOString() },
    ...extra,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 11, 22, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

function renderMake(seed: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={['/']}>
        <Make />
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
const cardOf = (region: HTMLElement, name: RegExp) =>
  within(region).getByRole('link', { name }).closest('li') as HTMLElement;

describe('Make cards show plates (Requirement 21.1)', () => {
  it('puts a plate on a food-group band on Ready now, Missing one and More ideas cards', async () => {
    const user = userEvent.setup();
    renderMake(seedState());
    const ready = cardOf(screen.getByRole('region', { name: /Ready now/ }), /Chicken Rice Plate/);
    expect(band(ready)).toHaveAttribute('data-band', 'protein');
    expect(imgs(ready).some((s) => s.includes('/poultry_leg.webp'))).toBe(true);
    expect(hasHourglass(ready)).toBe(false);
    const one = cardOf(screen.getByRole('region', { name: /Missing one/ }), /Carrot Rice Bowl/);
    expect(band(one)).toHaveAttribute('data-band', 'vegetable');

    await user.type(screen.getByRole('textbox', { name: 'What do you have?' }), 'something for breakfast');
    const more = cardOf(await screen.findByRole('region', { name: /More ideas/ }), /Pea Oat Porridge/);
    expect(band(more)).not.toBeNull();
    expect(imgs(more).length).toBeGreaterThan(0);
  });

  it('puts a plate on Recipes named cards, Try this and Make again', async () => {
    const user = userEvent.setup();
    renderMake(seedState());
    await user.type(screen.getByRole('textbox', { name: 'What do you have?' }), 'chicken');
    const tryThis = screen.getByRole('region', { name: 'Try this' });
    expect(band(tryThis)).not.toBeNull();
    expect(imgs(tryThis).length).toBeGreaterThan(0);
    const again = screen.getByRole('region', { name: 'Make again' });
    expect(imgs(again).some((s) => s.includes('/poultry_leg.webp'))).toBe(true);
    await user.clear(screen.getByRole('textbox', { name: 'What do you have?' }));
    await user.type(screen.getByRole('textbox', { name: 'What do you have?' }), 'pancakes');
    const named = await screen.findByRole('region', { name: /Recipes named/ });
    expect(imgs(cardOf(named, /Banana Pancakes/)).some((s) => s.includes('/banana.webp'))).toBe(true);
  });

  it('keeps one filled primary button, in Try this', () => {
    renderMake(seedState());
    const primaries = document.querySelectorAll('[data-variant="primary"]');
    expect(primaries).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: 'Try this' })).getByRole('link', { name: 'Open recipe' })).toBeInTheDocument();
  });

  it('shows the new-food monster before the unchanged text and keeps the link name', () => {
    renderMake(seedState({ pantry: ['salmon', 'rice'] }));
    const card = cardOf(screen.getByRole('region', { name: /Ready now/ }), /Salmon Rice/);
    const line = within(card).getByText('New food: fish');
    expect(line.querySelector('svg, img')).not.toBeNull();
    expect(within(card).getByRole('link', { name: /Salmon Rice/ })).toHaveAccessibleName(/\. New food: fish$/);
  });

  it.each([10, 60])('never draws a choking-shape food on any card at %i months', async (months) => {
    const user = userEvent.setup();
    renderMake(seedState({ pantry: ['grapes', 'rice'] }, months));
    const show = screen.queryByRole('button', { name: 'Show left-out recipes' });
    if (show) await user.click(show);
    expect(screen.getAllByText(/Grape Rice/).length).toBeGreaterThan(0);
    expect(imgs(document.body).length).toBeGreaterThan(0);
    expect(imgs(document.body).some((s) => s.includes('grapes'))).toBe(false);
  });
});

describe('Left-out cards (Not yet)', () => {
  it('grey the plate, keep the foods and show the hourglass, with the reason text unchanged', async () => {
    const user = userEvent.setup();
    renderMake(seedState());
    await user.click(screen.getByRole('button', { name: 'Show left-out recipes' }));
    const ghost = screen.getByLabelText(/Honey Banana Bites\. Not yet: honey\. Available at 12 months\./);
    expect(band(ghost)).toHaveAttribute('data-band', 'not-yet');
    expect(hasHourglass(ghost)).toBe(true);
    const banana = [...ghost.querySelectorAll('img')].find((i) => i.getAttribute('src')?.includes('/banana.webp'));
    expect(banana).toBeDefined();
    expect(banana!.className).toMatch(/greyed/);
  });

  it('a recipe with a recorded reaction keeps its food, greyed, never the generic bowl', async () => {
    const user = userEvent.setup();
    renderMake(
      seedState({ foods: { banana: { status: 'reaction', date: '2026-03-01' } } }),
    );
    await user.click(screen.getByRole('button', { name: 'Show left-out recipes' }));
    const ghost = screen.getByLabelText(/^Mashed banana\. Not yet/);
    const sources = imgs(ghost);
    expect(sources.some((s) => s.includes('/banana.webp'))).toBe(true);
    expect(sources.some((s) => s.includes('bowl_with_spoon'))).toBe(false);
    expect(hasHourglass(ghost)).toBe(true);
    expect(ghost.querySelector('[data-band]')).toHaveAttribute('data-band', 'not-yet');
  });

  it('use a plate in Recipes named, and no GhostCard drawing', async () => {
    const user = userEvent.setup();
    renderMake(seedState());
    await user.type(screen.getByRole('textbox', { name: 'What do you have?' }), 'pancakes');
    const named = await screen.findByRole('region', { name: /Recipes named/ });
    const ghost = within(named).getByLabelText(/Honey Pancake\. Not yet/);
    expect(hasHourglass(ghost)).toBe(true);
    expect(ghost.querySelector('svg')).toBeNull();
  });
});

describe('Empty state and wording', () => {
  it('shows the friendly monster beside "Nothing fits yet", decorative', () => {
    renderMake(seedState({ pantry: [], customRecipes: [HONEY_BANANA] }));
    const panel = screen.getByRole('region', { name: 'Nothing fits yet' });
    const art = panel.querySelector('svg');
    expect(art).not.toBeNull();
    expect(art).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses no ghost, door or pumpkin words in its own text or labels', async () => {
    const user = userEvent.setup();
    renderMake(seedState());
    await user.click(screen.getByRole('button', { name: 'Show left-out recipes' }));
    const labels = [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label'));
    expect(`${document.body.textContent} ${labels.join(' ')}`).not.toMatch(/ghost|door|pumpkin/i);
  });

  it('has no axe violations with results, left-out expanded, and no network calls', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    const { container } = renderMake(seedState());
    await user.click(screen.getByRole('button', { name: 'Show left-out recipes' }));
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
    network.expectNoNetwork();
  });

  it('has no axe violations in the empty state', async () => {
    const { container } = renderMake(seedState({ pantry: [], customRecipes: [HONEY_BANANA] }));
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
  });
});
