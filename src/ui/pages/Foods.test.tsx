import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach } from 'vitest';
import Foods, { REACTION_ADVICE } from './Foods';
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

/** Capture the latest app state for assertions after interactions. */
let captured: AppState | null = null;
function StateProbe() {
  captured = useApp().state;
  return null;
}

/** A custom recipe that pulls honey and peanut butter into the food set. */
const EXTRA_FOODS_RECIPE: Recipe = {
  id: 'custom-extra',
  origin: 'custom',
  title: 'Extra foods',
  stages: ['9-12'],
  mealTypes: ['snack'],
  ingredients: [
    { name: 'honey', category: 'pantry' },
    { name: 'peanut butter', category: 'pantry' },
    { name: 'egg, beaten', category: 'dairy-eggs' },
  ],
  steps: ['Mix.'],
  texture: 'smooth',
  servings: 1,
};

/** A birth date string `months` whole months before today (local time). */
function birthDateMonthsAgo(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** A seed state with a child aged `ageMonths` and the extra-foods recipe. */
function seedState(ageMonths = 8): AppState {
  const s = defaultState(new Date());
  return {
    ...s,
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(ageMonths) },
    onboarded: true,
    customRecipes: [EXTRA_FOODS_RECIPE],
  };
}

function renderFoods(seed?: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={['/foods']}>
        <StateProbe />
        <Foods />
      </MemoryRouter>
    </AppProvider>,
  );
}

describe('Foods page', () => {
  beforeEach(() => {
    captured = null;
  });

  it('renders doors, monsters and ghosts with visible text labels / accessible names', () => {
    const seed = seedState(8);
    // A tried food (monster) and a reaction food (ghost).
    seed.foods = {
      carrot: { status: 'tried', date: '2026-11-12' },
      'allergen:dairy': { status: 'reaction', date: '2026-11-10' },
    };
    renderFoods(seed);

    // Door: egg is an untried allergen food from the recipe set.
    expect(
      screen.getByRole('listitem', { name: 'New food: egg' }),
    ).toBeInTheDocument();
    // Monster: carrot tried on Nov 12.
    expect(
      screen.getByRole('listitem', { name: /carrot — tried on Nov 12/ }),
    ).toBeInTheDocument();
    // Ghost: dairy has a reaction recorded.
    expect(
      screen.getByRole('listitem', {
        name: /Not yet: dairy\. Reaction recorded\./,
      }),
    ).toBeInTheDocument();
  });

  it('marking a door "tried, no reaction" moves it to a monster and records a tried date', async () => {
    const user = userEvent.setup();
    renderFoods(seedState(8));

    const eggDoor = screen.getByRole('listitem', { name: 'New food: egg' });
    await user.click(
      within(eggDoor).getByRole('button', { name: /tried, no reaction/i }),
    );

    expect(captured!.foods['allergen:egg']?.status).toBe('tried');
    expect(captured!.foods['allergen:egg']?.date).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
    // It now renders as a monster (tried), no longer a door.
    expect(
      screen.queryByRole('listitem', { name: 'New food: egg' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('listitem', { name: /egg — tried on/ }),
    ).toBeInTheDocument();
  });

  it('"noticed a reaction" records a reaction, ghosts the food, and shows the Req 7.6 messaging', async () => {
    const user = userEvent.setup();
    renderFoods(seedState(8));

    const eggDoor = screen.getByRole('listitem', { name: 'New food: egg' });
    await user.click(
      within(eggDoor).getByRole('button', { name: /noticed a reaction/i }),
    );

    expect(captured!.foods['allergen:egg']?.status).toBe('reaction');
    const ghost = screen.getByRole('listitem', {
      name: /Not yet: egg\. Reaction recorded\./,
    });
    expect(ghost).toBeInTheDocument();
    // The pediatrician + emergency-services messaging (Req 7.6).
    expect(within(ghost).getByText(REACTION_ADVICE)).toBeInTheDocument();
    expect(REACTION_ADVICE).toMatch(/pediatrician/i);
    expect(REACTION_ADVICE).toMatch(/trouble breathing/i);
    expect(REACTION_ADVICE).toMatch(/emergency services/i);
  });

  it('clearing a reaction removes the record and returns the food to a door', async () => {
    const user = userEvent.setup();
    const seed = seedState(8);
    seed.foods = { 'allergen:egg': { status: 'reaction', date: '2026-11-10' } };
    renderFoods(seed);

    const ghost = screen.getByRole('listitem', {
      name: /Not yet: egg\. Reaction recorded\./,
    });
    await user.click(
      within(ghost).getByRole('button', { name: /clear reaction/i }),
    );

    expect(captured!.foods['allergen:egg']).toBeUndefined();
    // Back to a door.
    expect(
      screen.getByRole('listitem', { name: 'New food: egg' }),
    ).toBeInTheDocument();
  });

  it('a block-covered food (honey under 12 months) is a ghost with reason + available-at age and no clear control', () => {
    renderFoods(seedState(8));

    const honeyGhost = screen.getByRole('listitem', {
      name: /Not yet: honey\. Available at 12 months\./,
    });
    expect(honeyGhost).toBeInTheDocument();
    // The block rule's own reason is shown.
    expect(
      within(honeyGhost).getByText(/infant botulism/i),
    ).toBeInTheDocument();
    // Block ghosts are not user-clearable.
    expect(
      within(honeyGhost).queryByRole('button', { name: /clear reaction/i }),
    ).not.toBeInTheDocument();
  });

  it('allergen doors show the generic guidance and the peanut door shows the peanut note', () => {
    renderFoods(seedState(8));

    const eggDoor = screen.getByRole('listitem', { name: 'New food: egg' });
    expect(
      within(eggDoor).getByText(/introduce one at a time/i),
    ).toBeInTheDocument();
    // Egg is not peanut, so no peanut note on it.
    expect(
      within(eggDoor).queryByText(/severe eczema/i),
    ).not.toBeInTheDocument();

    const peanutDoor = screen.getByRole('listitem', {
      name: 'New food: peanut',
    });
    expect(
      within(peanutDoor).getByText(/introduce one at a time/i),
    ).toBeInTheDocument();
    expect(
      within(peanutDoor).getByText(/severe eczema or an egg allergy/i),
    ).toBeInTheDocument();
    // Guidance cites AAP-allergens and NIAID-peanut.
    const links = within(peanutDoor).getAllByRole('link');
    const titles = links.map((l) => l.textContent);
    expect(titles.join(' ')).toMatch(/AAP/i);
    expect(titles.join(' ')).toMatch(/NIAID/i);
  });
});
