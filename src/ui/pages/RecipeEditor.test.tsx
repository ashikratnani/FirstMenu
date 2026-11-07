import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import RecipeEditor from './RecipeEditor';
import Recipes from './Recipes';
import { AppProvider, useApp } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState, Recipe } from '../../domain/types';

/** An in-memory Storage so tests never touch real localStorage. */
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

/** A birth date string `months` whole months before today (local time). */
function birthDateMonthsAgo(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function seedState(
  ageMonths = 8,
  customRecipes: Recipe[] = [],
  patch: Partial<AppState> = {},
): AppState {
  const s = defaultState(new Date());
  return {
    ...s,
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(ageMonths) },
    onboarded: true,
    customRecipes,
    ...patch,
  };
}

/**
 * Render the editor and the library behind a small router so a save/delete
 * navigation lands on /recipes. A `probe` captures the live state for
 * assertions that need to read customRecipes/plan directly.
 */
function renderApp(seed: AppState, startPath: string) {
  let latest: ReturnType<typeof useApp> | null = null;
  function Probe() {
    latest = useApp();
    return null;
  }
  render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={[startPath]}>
        <Probe />
        <Routes>
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/recipes/new" element={<RecipeEditor />} />
          <Route path="/recipes/:id/edit" element={<RecipeEditor />} />
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
  return { getState: () => latest!.state, getEmptied: () => latest!.emptiedSlots };
}

const CUSTOM_MASH: Recipe = {
  id: 'custom-mash',
  origin: 'custom',
  title: 'Banana Mash',
  stages: ['6-8'],
  mealTypes: ['breakfast'],
  ingredients: [{ name: 'banana', category: 'produce' }],
  steps: ['Mash the banana.'],
  texture: 'smooth',
  servings: 2,
};

describe('RecipeEditor', () => {
  it('fills the form and saves a new custom recipe into state', async () => {
    const user = userEvent.setup();
    const { getState } = renderApp(seedState(8), '/recipes/new');

    await user.type(screen.getByLabelText('Title'), 'Sweet Potato Puree');
    await user.click(screen.getByLabelText('6-8 months'));
    await user.click(screen.getByLabelText('Breakfast'));
    await user.type(
      screen.getByLabelText('Ingredient 1 name'),
      'sweet potato',
    );
    await user.type(screen.getByLabelText('Step 1'), 'Steam and mash.');
    await user.type(screen.getByLabelText('Texture'), 'smooth puree');

    await user.click(screen.getByRole('button', { name: 'Save recipe' }));

    const custom = getState().customRecipes;
    expect(custom).toHaveLength(1);
    expect(custom[0]).toMatchObject({
      title: 'Sweet Potato Puree',
      origin: 'custom',
      stages: ['6-8'],
      mealTypes: ['breakfast'],
      texture: 'smooth puree',
    });
    expect(custom[0].ingredients[0].name).toBe('sweet potato');
    // A real uuid id (not a built-in 'b-' id).
    expect(custom[0].id).not.toMatch(/^b-/);
  });

  it('runs the safety screen on save and shows a block for a honey ingredient', async () => {
    const user = userEvent.setup();
    renderApp(seedState(8), '/recipes/new');

    await user.type(screen.getByLabelText('Title'), 'Honey Oats');
    await user.type(screen.getByLabelText('Ingredient 1 name'), 'honey');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));

    const findings = screen.getByRole('region', {
      name: 'Safety screen results',
    });
    expect(within(findings).getByText(/Honey:/)).toBeInTheDocument();
    expect(
      within(findings).getByText(/infant botulism/),
    ).toBeInTheDocument();
    expect(
      within(findings).getByText(/Available at 12 months\./),
    ).toBeInTheDocument();
  });

  it('persists the per-ingredient "counts as" food override', async () => {
    const user = userEvent.setup();
    const { getState } = renderApp(seedState(8), '/recipes/new');

    await user.type(screen.getByLabelText('Title'), 'Yogurt Bowl');
    await user.type(
      screen.getByLabelText('Ingredient 1 name'),
      'plain whole-milk yogurt',
    );
    await user.type(
      screen.getByLabelText('Counts as (food override)'),
      'yogurt',
    );
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));

    const saved = getState().customRecipes[0];
    expect(saved.ingredients[0].food).toBe('yogurt');
  });

  it('prefills and updates an existing custom recipe without duplicating it', async () => {
    const user = userEvent.setup();
    const { getState } = renderApp(
      seedState(8, [CUSTOM_MASH]),
      '/recipes/custom-mash/edit',
    );

    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
    expect(titleInput.value).toBe('Banana Mash');

    await user.clear(titleInput);
    await user.type(titleInput, 'Banana Avocado Mash');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));

    const custom = getState().customRecipes;
    expect(custom).toHaveLength(1);
    expect(custom[0].id).toBe('custom-mash');
    expect(custom[0].title).toBe('Banana Avocado Mash');
  });

  it('deleting a custom recipe empties its plan slot and surfaces the notice', async () => {
    const user = userEvent.setup();
    const seed = seedState(8, [CUSTOM_MASH]);
    // The custom recipe occupies a plan slot.
    seed.plan.days[1] = { breakfast: 'custom-mash' };

    const { getState, getEmptied } = renderApp(
      seed,
      '/recipes/custom-mash/edit',
    );

    await user.click(screen.getByRole('button', { name: 'Delete recipe' }));

    // Reducer emptied the slot and removed the recipe.
    expect(getState().customRecipes).toHaveLength(0);
    expect(getState().plan.days[1].breakfast).toBeUndefined();

    // The emptied-slot context notice lists the slot...
    expect(getEmptied()).toEqual([
      { day: 1, meal: 'breakfast', recipeId: 'custom-mash' },
    ]);

    // ...and the library (navigated to) renders the human-readable notice.
    const notice = screen.getByRole('status');
    expect(within(notice).getByText('Day 2, Breakfast')).toBeInTheDocument();
  });

  it('redirects to a not-found view when editing a built-in id', () => {
    renderApp(seedState(8), '/recipes/b-carrots-and-apples/edit');
    expect(
      screen.getByRole('heading', { name: 'Recipe not found' }),
    ).toBeInTheDocument();
  });
});
