import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Print from './Print';
import printCss from './Print.module.css?raw';
import { ruleBody } from '../../test/cssRule';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type {
  AppState,
  GroceryCategory,
  Ingredient,
  MealType,
  Recipe,
} from '../../domain/types';

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
  activeSlots: MealType[] = ['breakfast'],
): AppState {
  const s = defaultState(new Date());
  return {
    ...s,
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(ageMonths) },
    onboarded: true,
    customRecipes,
    plan: {
      ...s.plan,
      startDate: START_DATE,
      prepDate: '2026-03-01',
      activeSlots,
      days: days ?? s.plan.days,
    },
  };
}

/** 7 empty days with one recipe planned at the given day index for breakfast. */
function daysWithBreakfast(
  entries: Array<{ day: number; recipeId: string }>,
): AppState['plan']['days'] {
  const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
  for (const { day, recipeId } of entries) days[day] = { breakfast: recipeId };
  return days;
}

function renderPrint(seed?: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={['/print']}>
        <Print />
      </MemoryRouter>
    </AppProvider>,
  );
}

describe('Print page', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the week grid recipe title, a cook session and a grocery line', () => {
    const recipe = makeRecipe('r-a', [ing('pear', 'produce', 50, 'g')]);
    renderPrint(
      seedState(8, [recipe], daysWithBreakfast([{ day: 0, recipeId: 'r-a' }])),
    );

    // Week grid shows the planned recipe title (appears in the grid at least).
    expect(screen.getAllByText('r-a dish').length).toBeGreaterThan(0);

    // Prep section shows a cook session with its logistics text.
    expect(screen.getByText('1 serving')).toBeInTheDocument();
    expect(screen.getByText('1 batch')).toBeInTheDocument();
    expect(screen.getByText('Keep in the fridge')).toBeInTheDocument();

    // Grocery section shows the merged line + amount.
    expect(screen.getByText('pear')).toBeInTheDocument();
    expect(screen.getByText('50 g')).toBeInTheDocument();
  });

  it('shows a ghosted slot with its text reason', () => {
    // Honey is blocked under 12 months, so a recipe using it is ghosted and
    // excluded from prep/grocery but still shown in the week grid with the
    // block reason as text (no new wording invented here).
    const recipe = makeRecipe('r-ghost', [ing('honey', 'pantry', 1, 'tsp')]);
    renderPrint(
      seedState(8, [recipe], daysWithBreakfast([{ day: 0, recipeId: 'r-ghost' }])),
    );

    // The title is still shown in the week grid.
    expect(screen.getByText('r-ghost dish')).toBeInTheDocument();
    // The ghost reason text (from ghostReason/recipeView) appears verbatim.
    expect(screen.getByText(/Not yet: honey\./)).toBeInTheDocument();
    // Ghosted slots do not contribute to prep/grocery.
    expect(screen.getByText('No cook sessions this week.')).toBeInTheDocument();
    expect(screen.getByText('Nothing to buy this week.')).toBeInTheDocument();
  });

  it('shows a prep reminder on the grocery line', () => {
    // Grapes trigger a reminder under 48 months (default seed age is 8 months).
    // Make the grape the quantified ingredient so it produces a grocery line
    // and the reminder is attached to that line (Req 6.1/11.7).
    const recipe = makeRecipe('r-grape', [ing('grapes', 'produce', 50, 'g')]);
    renderPrint(
      seedState(8, [recipe], daysWithBreakfast([{ day: 0, recipeId: 'r-grape' }])),
    );

    // The grocery line for the grape is present (label is singularized).
    const grocery = screen.getByRole('region', { name: 'Grocery' });
    expect(grocery).toHaveTextContent('grape');
    // The reminder message renders verbatim on the printed grocery line.
    expect(
      screen.getByText('Quarter lengthwise before serving.'),
    ).toBeInTheDocument();
  });

  describe('Print button', () => {
    // vi.restoreAllMocks() restores spies but not a plain property assignment,
    // so capture and restore the original window.print to avoid leaking a fake
    // into later tests.
    const original = window.print;
    afterEach(() => {
      window.print = original;
    });

    it('calls window.print() once when present', () => {
      // jsdom leaves window.print undefined, so define it before spying.
      window.print = () => {};
      const spy = vi.spyOn(window, 'print').mockImplementation(() => {});

      renderPrint(seedState(8, []));

      fireEvent.click(screen.getByRole('button', { name: 'Print' }));

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not throw when window.print is undefined', () => {
      // Exercise the printNow() guard: when the browser has no print(), the
      // click must be a no-op rather than throwing.
      (window as unknown as { print?: () => void }).print = undefined;

      renderPrint(seedState(8, []));

      expect(() =>
        fireEvent.click(screen.getByRole('button', { name: 'Print' })),
      ).not.toThrow();
    });
  });

  it('renders the shared disclaimer on the printout', () => {
    renderPrint(seedState(8, []));
    expect(
      screen.getByText(
        'FirstMenu is not medical advice. Check with your pediatrician.',
      ),
    ).toBeInTheDocument();
  });

  it('keeps the single Print button inside the print-hide wrapper', () => {
    renderPrint(seedState(8, []));
    const button = screen.getByRole('button', { name: 'Print' });
    expect(button.closest('.print-hide')).not.toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(ruleBody(printCss, '.toolbar button')).toContain(
      'min-height: 44px',
    );
  });
});
