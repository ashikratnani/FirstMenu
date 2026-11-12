import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach } from 'vitest';
import Grocery from './Grocery';
import groceryCss from './Grocery.module.css?raw';
import { ruleBody } from '../../test/cssRule';
import { AppProvider, useApp } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState, GroceryCategory, Ingredient, MealType, Recipe } from '../../domain/types';

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

/** A birth date string `months` whole months before today (local time). */
function birthDateMonthsAgo(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ing(
  name: string,
  category: GroceryCategory,
  quantity?: number,
  unit?: string,
): Ingredient {
  const i: Ingredient = { name, category };
  if (quantity !== undefined) i.quantity = quantity;
  if (unit !== undefined) i.unit = unit;
  return i;
}

/** A custom recipe that stays as a single fridge session (fridgeDays 7). */
function makeRecipe(id: string, ingredients: Ingredient[]): Recipe {
  return {
    id,
    origin: 'custom',
    title: `${id} dish`,
    stages: ['6-8', '9-12'],
    mealTypes: ['breakfast'],
    ingredients,
    steps: ['Cook.'],
    texture: 'smooth',
    servings: 1,
    storage: { fridgeDays: 7 },
  };
}

const START_DATE = '2026-03-02';

function seedState(
  ageMonths = 8,
  customRecipes: Recipe[] = [],
  days?: AppState['plan']['days'],
  groceryChecked: string[] = [],
  activeSlots: MealType[] = ['breakfast'],
): AppState {
  const s = defaultState(new Date());
  return {
    ...s,
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(ageMonths) },
    onboarded: true,
    customRecipes,
    groceryChecked,
    plan: {
      ...s.plan,
      startDate: START_DATE,
      prepDate: '2026-03-01',
      activeSlots,
      days: days ?? s.plan.days,
    },
  };
}

function renderGrocery(seed?: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={['/grocery']}>
        <StateProbe />
        <Grocery />
      </MemoryRouter>
    </AppProvider>,
  );
}

/** 7 empty days with one recipe planned at the given day index for breakfast. */
function daysWithBreakfast(
  entries: Array<{ day: number; recipeId: string }>,
): AppState['plan']['days'] {
  const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
  for (const { day, recipeId } of entries) days[day] = { breakfast: recipeId };
  return days;
}

describe('Grocery page', () => {
  beforeEach(() => {
    captured = null;
  });

  it('renders grouped lines in the fixed design category order', () => {
    // Deliberately out of category order; design order is
    // produce, protein, dairy-eggs, grains, pantry, frozen, other.
    const recipe = makeRecipe('r-mix', [
      ing('rice', 'grains', 1, 'cup'),
      ing('chicken', 'protein', 1, 'piece'),
      ing('pear', 'produce', 1, 'piece'),
    ]);
    renderGrocery(
      seedState(8, [recipe], daysWithBreakfast([{ day: 0, recipeId: 'r-mix' }])),
    );

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(['Produce', 'Protein', 'Grains']);
  });

  it('shows a line with its quantity and unit', () => {
    const recipe = makeRecipe('r-a', [ing('pear', 'produce', 50, 'g')]);
    renderGrocery(
      seedState(8, [recipe], daysWithBreakfast([{ day: 0, recipeId: 'r-a' }])),
    );

    expect(screen.getByText('50 g')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /pear, 50 g\./ }),
    ).toBeInTheDocument();
  });

  it("shows 'as needed' for a line with no quantity", () => {
    const recipe = makeRecipe('r-a', [ing('water', 'other')]);
    renderGrocery(
      seedState(8, [recipe], daysWithBreakfast([{ day: 0, recipeId: 'r-a' }])),
    );

    expect(screen.getByText('as needed')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /water, as needed\./ }),
    ).toBeInTheDocument();
  });

  it("shows 'and more as needed' for a mixed line", () => {
    // Same food + unit: one recipe gives a quantity, one does not.
    const rA = makeRecipe('r-a', [ing('spinach', 'produce', 40, 'g')]);
    const rB = makeRecipe('r-b', [ing('spinach', 'produce', undefined, 'g')]);
    renderGrocery(
      seedState(8, [rA, rB], daysWithBreakfast([
        { day: 0, recipeId: 'r-a' },
        { day: 1, recipeId: 'r-b' },
      ])),
    );

    expect(screen.getByText('40 g and more as needed')).toBeInTheDocument();
  });

  it('shows a prep reminder from the safety screen as visible text', () => {
    // "grape" fires the grapes reminder at age 8: "Quarter lengthwise before
    // serving." (a reminder, not a block).
    const recipe = makeRecipe('r-a', [ing('grape', 'produce', 5, 'piece')]);
    renderGrocery(
      seedState(8, [recipe], daysWithBreakfast([{ day: 0, recipeId: 'r-a' }])),
    );

    expect(
      screen.getByText('Quarter lengthwise before serving.'),
    ).toBeInTheDocument();
    // The reminder is also part of the checkbox's accessible name.
    expect(
      screen.getByRole('checkbox', {
        name: /grape, 5 piece\. Quarter lengthwise before serving\./,
      }),
    ).toBeInTheDocument();
  });

  it('checking a line persists the key into state.groceryChecked', () => {
    const recipe = makeRecipe('r-a', [ing('pear', 'produce', 50, 'g')]);
    renderGrocery(
      seedState(8, [recipe], daysWithBreakfast([{ day: 0, recipeId: 'r-a' }])),
    );

    const checkbox = screen.getByRole('checkbox', { name: /pear, 50 g\./ });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    expect(captured!.groceryChecked).toContain('pear|g');
    expect(
      screen.getByRole('checkbox', { name: /pear, 50 g\./ }),
    ).toBeChecked();
  });

  it('reconciles a stale checked key away after render (Req 10.5/10.6)', () => {
    const recipe = makeRecipe('r-a', [ing('pear', 'produce', 50, 'g')]);
    // Seed a stale key that is not on the current list plus the real one.
    renderGrocery(
      seedState(
        8,
        [recipe],
        daysWithBreakfast([{ day: 0, recipeId: 'r-a' }]),
        ['pear|g', 'gone|g'],
      ),
    );

    // The effect drops the stale key but keeps the present one.
    expect(captured!.groceryChecked).toEqual(['pear|g']);
    expect(
      screen.getByRole('checkbox', { name: /pear, 50 g\./ }),
    ).toBeChecked();
  });

  it('shows a friendly empty state when the plan has nothing to buy', () => {
    renderGrocery(seedState(8, []));
    expect(
      screen.getByText(
        'Nothing to buy yet. Add meals to your week to see a grocery list.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('renders the shared disclaimer in the footer', () => {
    const recipe = makeRecipe('r-a', [ing('pear', 'produce', 50, 'g')]);
    const { container } = renderGrocery(
      seedState(8, [recipe], daysWithBreakfast([{ day: 0, recipeId: 'r-a' }])),
    );

    expect(
      within(container).getByText(
        'FirstMenu is not medical advice. Check with your pediatrician.',
      ),
    ).toBeInTheDocument();
  });

  it('keeps one live region mounted and offers a next step when empty', () => {
    const { unmount } = renderGrocery(seedState(8, []));
    const region = screen.getByRole('status');
    const link = within(region).getByRole('link', { name: 'Plan your week' });
    expect(link).toHaveAttribute('href', '/plan');
    expect(link).toHaveClass('fm-link');
    unmount();

    const recipe = makeRecipe('r-a', [ing('pear', 'produce', 50, 'g')]);
    renderGrocery(
      seedState(8, [recipe], daysWithBreakfast([{ day: 0, recipeId: 'r-a' }])),
    );
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    // The checkbox name still carries the amount.
    expect(screen.getByRole('checkbox', { name: /pear, 50 g/ })).toBeInTheDocument();
  });

  it('the empty-state next step is a 44 px target (CSS)', () => {
    expect(ruleBody(groceryCss, '.nextStep')).toContain('min-height: 44px');
  });
});
