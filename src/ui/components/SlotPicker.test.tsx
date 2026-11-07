import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import SlotPicker from './SlotPicker';
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

let captured: AppState | null = null;
function StateProbe() {
  captured = useApp().state;
  return null;
}

function birthDateMonthsAgo(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const OATS_RECIPE: Recipe = {
  id: 'custom-oats',
  origin: 'custom',
  title: 'Oat Porridge',
  stages: ['6-8', '9-12'],
  mealTypes: ['breakfast'],
  ingredients: [{ name: 'oats', category: 'grains' }],
  steps: ['Cook.'],
  texture: 'smooth',
  servings: 1,
};

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

function seedState(customRecipes: Recipe[], ageMonths = 8): AppState {
  const s = defaultState(new Date());
  return {
    ...s,
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(ageMonths) },
    onboarded: true,
    customRecipes,
    plan: { ...s.plan, activeSlots: ['breakfast'] },
  };
}

function renderPicker(seed: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <StateProbe />
      <SlotPicker slot={{ day: 0, meal: 'breakfast' }} />
    </AppProvider>,
  );
}

describe('SlotPicker', () => {
  beforeEach(() => {
    captured = null;
  });

  it('lists eligible recipes before ghosted ones', () => {
    renderPicker(seedState([HONEY_RECIPE, OATS_RECIPE]));
    const options = screen.getAllByRole('button', {
      name: /Oat Porridge|Honey Oat Mash/,
    });
    expect(options[0]).toHaveAccessibleName(/Oat Porridge/);
    expect(options[options.length - 1]).toHaveAccessibleName(/Honey Oat Mash/);
  });

  it('renders a ghosted recipe DISABLED with its reason so it cannot be selected (Req 5.2)', async () => {
    const user = userEvent.setup();
    renderPicker(seedState([HONEY_RECIPE]));

    const honey = screen.getByRole('button', {
      name: /Honey Oat Mash\. Not yet: honey\. Available at 12 months\./,
    });
    expect(honey).toBeDisabled();

    // Clicking a disabled control is a no-op: no slot is planned.
    await user.click(honey);
    expect(captured!.plan.days[0].breakfast).toBeUndefined();
  });

  it('marks a recipe using an untried food with a door marker (Req 7.3/8.3)', () => {
    renderPicker(seedState([OATS_RECIPE]));
    const oats = screen.getByRole('button', { name: /Oat Porridge/ });
    expect(within(oats).getByText('New food: oat')).toBeInTheDocument();
  });

  it('selecting an eligible recipe dispatches setSlot', async () => {
    const user = userEvent.setup();
    renderPicker(seedState([OATS_RECIPE]));
    await user.click(screen.getByRole('button', { name: /Oat Porridge/ }));
    expect(captured!.plan.days[0].breakfast).toBe('custom-oats');
  });
});
