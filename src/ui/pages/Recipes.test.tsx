import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Recipes from './Recipes';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import { BUILTIN_RECIPES } from '../../data/recipes';
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

/** A custom recipe containing honey -> blocks under 12 months -> ghosted. */
const HONEY_RECIPE: Recipe = {
  id: 'custom-honey',
  origin: 'custom',
  title: 'Honey Oat Mash',
  stages: ['6-8', '9-12'],
  mealTypes: ['breakfast'],
  ingredients: [
    { name: 'honey', category: 'pantry' },
    { name: 'oats', category: 'grains' },
  ],
  steps: ['Mix.'],
  texture: 'smooth',
  servings: 1,
};

/** A custom recipe whose only allergen-food ingredient can carry a reaction. */
const EGG_RECIPE: Recipe = {
  id: 'custom-egg',
  origin: 'custom',
  title: 'Egg Scramble',
  stages: ['9-12'],
  mealTypes: ['lunch'],
  ingredients: [{ name: 'egg, beaten', category: 'dairy-eggs' }],
  steps: ['Cook.'],
  texture: 'soft',
  servings: 1,
};

function seedState(
  ageMonths = 8,
  customRecipes: Recipe[] = [],
  foods: AppState['foods'] = {},
): AppState {
  const s = defaultState(new Date());
  return {
    ...s,
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(ageMonths) },
    onboarded: true,
    customRecipes,
    foods,
  };
}

function renderRecipes(seed?: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={['/recipes']}>
        <Recipes />
      </MemoryRouter>
    </AppProvider>,
  );
}

describe('Recipes library page', () => {
  it('lists built-in and custom recipes, each linking to /recipes/:id', () => {
    renderRecipes(seedState(8, [HONEY_RECIPE]));

    // All built-ins plus the custom recipe appear (default stage filter is the
    // child's stage 6-8; HONEY_RECIPE and the purees are tagged 6-8).
    const carrots = screen.getByRole('link', { name: /Carrots and Apples/ });
    expect(carrots).toHaveAttribute('href', '/recipes/b-carrots-and-apples');

    const honey = screen.getByRole('link', { name: /Honey Oat Mash/ });
    expect(honey).toHaveAttribute('href', '/recipes/custom-honey');
  });

  it('has a prominent "New recipe" link to /recipes/new', () => {
    renderRecipes(seedState(8));
    expect(
      screen.getByRole('link', { name: 'New recipe' }),
    ).toHaveAttribute('href', '/recipes/new');
  });

  it('defaults the stage filter to the child\'s current stage', () => {
    // 8 months -> stage '6-8'.
    renderRecipes(seedState(8));
    expect(
      (screen.getByLabelText('Stage') as HTMLSelectElement).value,
    ).toBe('6-8');
    // A 9-12-only recipe (Cereal Pancakes) is hidden at the 6-8 default.
    expect(
      screen.queryByRole('link', { name: /Cereal Pancakes/ }),
    ).not.toBeInTheDocument();
  });

  it('showing all stages reveals every built-in recipe', async () => {
    const user = userEvent.setup();
    renderRecipes(seedState(8));

    await user.selectOptions(screen.getByLabelText('Stage'), 'all');
    for (const recipe of BUILTIN_RECIPES) {
      expect(
        screen.getByRole('link', { name: new RegExp(recipe.title) }),
      ).toBeInTheDocument();
    }
  });

  it('the stage filter narrows to recipes tagged that stage', async () => {
    const user = userEvent.setup();
    renderRecipes(seedState(8));

    await user.selectOptions(screen.getByLabelText('Stage'), '9-12');
    // Cereal Pancakes is tagged 9-12 only, so it now shows.
    expect(
      screen.getByRole('link', { name: /Cereal Pancakes/ }),
    ).toBeInTheDocument();
  });

  it('the meal-type filter narrows the list by meal', async () => {
    const user = userEvent.setup();
    renderRecipes(seedState(8, [], {}));

    await user.selectOptions(screen.getByLabelText('Stage'), 'all');
    await user.selectOptions(screen.getByLabelText('Meal type'), 'breakfast');

    // Breakfast recipe shows; a lunch/dinner-only puree does not.
    expect(
      screen.getByRole('link', { name: /Cereal Pancakes/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Carrots and Apples/ }),
    ).not.toBeInTheDocument();
  });

  it('shows a ghost state for a recipe blocked at the child\'s age', () => {
    renderRecipes(seedState(8, [HONEY_RECIPE]));

    const honey = screen.getByRole('link', {
      name: /Honey Oat Mash\. Not yet: honey\. Available at 12 months\./,
    });
    expect(honey).toBeInTheDocument();
    expect(
      within(honey).getByText(/Not yet: honey\. Available at 12 months\./),
    ).toBeInTheDocument();
  });

  it('shows a ghost state for a recipe whose food has a recorded reaction', () => {
    renderRecipes(
      seedState(10, [EGG_RECIPE], {
        'allergen:egg': { status: 'reaction', date: '2026-11-10' },
      }),
    );

    const egg = screen.getByRole('link', {
      name: /Egg Scramble\. Not yet: egg\. Reaction recorded\./,
    });
    expect(egg).toBeInTheDocument();
  });

  it('shows a door badge for a recipe using an untried food', () => {
    // No foods tried, so a built-in puree uses untried foods -> door badge.
    renderRecipes(seedState(8));
    const carrots = screen.getByRole('link', { name: /Carrots and Apples/ });
    expect(within(carrots).getByText('New food')).toBeInTheDocument();
  });

  it('shows a pumpkin badge "Freezes for N months" for a freezer-friendly recipe', () => {
    renderRecipes(seedState(8));
    const carrots = screen.getByRole('link', { name: /Carrots and Apples/ });
    // b-carrots-and-apples sets storage.freezerMonths: 1.
    expect(
      within(carrots).getByText('Freezes for 1 month'),
    ).toBeInTheDocument();
  });
});
