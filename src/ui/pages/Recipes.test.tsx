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

/**
 * The visible content of a recipe card. Astryx ClickableCard renders an
 * overlay link (carrying the accessible name) next to the visible content, so
 * visible text is looked up in the card's list item, not inside the link.
 */
function cardFor(name: RegExp): HTMLElement {
  const link = screen.getByRole('link', { name });
  const item = link.closest('li');
  if (!item) throw new Error('recipe card list item not found');
  return item;
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

  it('defaults the stage filter to the child\'s current stage', () => {
    // 8 months -> stage '6-8'.
    renderRecipes(seedState(8));
    const stage = screen.getByRole('radiogroup', { name: 'Stage' });
    expect(
      within(stage).getByRole('radio', { name: '6-8 months' }),
    ).toBeChecked();
    // A 9-12-only recipe (Cereal Pancakes) is hidden at the 6-8 default.
    expect(
      screen.queryByRole('link', { name: /Cereal Pancakes/ }),
    ).not.toBeInTheDocument();
  });

  it('showing all stages reveals every built-in recipe', async () => {
    const user = userEvent.setup();
    renderRecipes(seedState(8));

    await user.click(within(screen.getByRole('radiogroup', { name: 'Stage' })).getByRole('radio', { name: 'All' }));
    for (const recipe of BUILTIN_RECIPES) {
      expect(
        screen.getByRole('link', { name: new RegExp(recipe.title) }),
      ).toBeInTheDocument();
    }
  });

  it('the stage filter narrows to recipes tagged that stage', async () => {
    const user = userEvent.setup();
    renderRecipes(seedState(8));

    await user.click(screen.getByRole('radio', { name: '9-12 months' }));
    // Cereal Pancakes is tagged 9-12 only, so it now shows.
    expect(
      screen.getByRole('link', { name: /Cereal Pancakes/ }),
    ).toBeInTheDocument();
  });

  it('the meal-type filter narrows the list by meal', async () => {
    const user = userEvent.setup();
    renderRecipes(seedState(8, [], {}));

    await user.click(within(screen.getByRole('radiogroup', { name: 'Stage' })).getByRole('radio', { name: 'All' }));
    await user.click(screen.getByRole('radio', { name: 'Breakfast' }));

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
      within(cardFor(/Honey Oat Mash/)).getByText(
        /Not yet: honey\. Available at 12 months\./,
      ),
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

  it('shows a door badge NAMING each untried food the recipe uses', () => {
    // No foods tried, so a built-in puree uses untried foods -> door badge that
    // names them (Req 7.3), not a bare "New food".
    renderRecipes(seedState(8));
    const badge = within(cardFor(/Carrots and Apples/)).getByText(/^New food:/);
    expect(badge).toHaveTextContent('New food: carrot, apple');
  });

  it('never lists water, breast milk or formula as a new food in a door badge', () => {
    renderRecipes(seedState(8));
    // Carrots and Apples uses water; Sweet Potato Chicken uses breastmilk.
    expect(
      within(cardFor(/Carrots and Apples/)).getByText(/^New food:/),
    ).toHaveTextContent(/^New food: carrot, apple$/);
    const chicken = within(cardFor(/Sweet Potato Chicken/)).getByText(
      /^New food:/,
    );
    expect(chicken.textContent).not.toMatch(/breast ?milk|water|formula/i);
  });

  it('still ghosts a recipe when a reaction is recorded under an ignored food', () => {
    // The app never records this itself, but an imported backup or share
    // link can; the badge skip must not hide it.
    renderRecipes(
      seedState(8, [], { water: { status: 'reaction', date: '2026-11-01' } }),
    );
    const carrots = screen.getByRole('link', { name: /Carrots and Apples/ });
    expect(carrots.getAttribute('aria-label') ?? '').toMatch(/Not yet/);
  });

  it('names an allergen untried food by its group label in the door badge', () => {
    // Egg (10 months, untried, no reaction) -> door badge "New food: egg", not
    // the raw "allergen:egg" key.
    renderRecipes(seedState(10, [EGG_RECIPE]));
    expect(
      within(cardFor(/Egg Scramble/)).getByText('New food: egg'),
    ).toBeInTheDocument();
  });

  it('includes the door and freezer badge text in the card accessible name', () => {
    // The aria-label overrides the content, so screen readers must still hear
    // the badge state (Req 14.3): door naming the food and freezer months.
    renderRecipes(seedState(8));
    const carrots = screen.getByRole('link', { name: /Carrots and Apples/ });
    const name = carrots.getAttribute('aria-label') ?? '';
    expect(name).toContain('New food: carrot, apple');
    expect(name).toContain('Freezes for 1 month');
  });

  it('lists ALL blocking ingredients in a ghost reason', () => {
    // A recipe with two blocked ingredients (honey + raw egg under-age is not a
    // block, so use two block foods: honey and added salt) shows each.
    const multiBlock: Recipe = {
      id: 'custom-multi-block',
      origin: 'custom',
      title: 'Honey Salt Mash',
      stages: ['6-8', '9-12'],
      mealTypes: ['breakfast'],
      ingredients: [
        { name: 'honey', category: 'pantry' },
        { name: 'salt', category: 'pantry' },
      ],
      steps: ['Mix.'],
      texture: 'smooth',
      servings: 1,
    };
    renderRecipes(seedState(8, [multiBlock]));
    const card = screen.getByRole('link', { name: /Honey Salt Mash/ });
    const name = card.getAttribute('aria-label') ?? '';
    expect(name).toContain('Not yet: honey.');
    expect(name).toContain('Not yet: salt.');
  });

  it('shows a pumpkin badge "Freezes for N months" for a freezer-friendly recipe', () => {
    renderRecipes(seedState(8));
    // b-carrots-and-apples sets storage.freezerMonths: 1.
    expect(
      within(cardFor(/Carrots and Apples/)).getByText('Freezes for 1 month'),
    ).toBeInTheDocument();
  });
});
