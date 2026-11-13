import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RouterLinkProvider from '../theme/RouterLinkProvider';
import { describe, expect, it, beforeEach } from 'vitest';
import Prep from './Prep';
import prepCss from './Prep.module.css?raw';
import { ruleBody } from '../../test/cssRule';
import { AppProvider, useApp } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState, MealType, Recipe } from '../../domain/types';

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

// A freezer-friendly recipe: fridgeDays 1, freezerMonths 1. Used far from the
// prep day it is frozen (with a thaw reminder); used within fridgeDays it stays
// in the fridge.
const FREEZER_RECIPE: Recipe = {
  id: 'custom-stew',
  origin: 'custom',
  title: 'Veggie Stew',
  stages: ['6-8', '9-12'],
  mealTypes: ['dinner'],
  ingredients: [{ name: 'carrot', category: 'produce' }],
  steps: ['Cook.'],
  texture: 'smooth',
  servings: 1,
  storage: { fridgeDays: 1, freezerMonths: 1 },
  makeAheadNote: 'Cool fully before freezing.',
};

// A honey recipe: blocked under 12 months -> ghosted and excluded from prep.
const HONEY_RECIPE: Recipe = {
  id: 'custom-honey',
  origin: 'custom',
  title: 'Honey Oat Mash',
  stages: ['6-8', '9-12'],
  mealTypes: ['dinner'],
  ingredients: [
    { name: 'honey', category: 'pantry' },
    { name: 'oats', category: 'grains' },
  ],
  steps: ['Mix.'],
  texture: 'smooth',
  servings: 1,
  storage: { fridgeDays: 2, freezerMonths: 1 },
};

/** Fixed start date so prep-day offsets are deterministic. */
const START_DATE = '2026-03-02'; // prepDate defaults to 2026-03-01.

function seedState(
  ageMonths = 8,
  customRecipes: Recipe[] = [],
  activeSlots: MealType[] = ['dinner'],
  days?: AppState['plan']['days'],
  foods: AppState['foods'] = {},
): AppState {
  const s = defaultState(new Date());
  return {
    ...s,
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(ageMonths) },
    onboarded: true,
    customRecipes,
    foods,
    plan: {
      ...s.plan,
      startDate: START_DATE,
      prepDate: '2026-03-01',
      activeSlots,
      days: days ?? s.plan.days,
    },
  };
}

function renderPrep(seed?: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={['/prep']}>
        <RouterLinkProvider>
          <StateProbe />
          <Prep />
        </RouterLinkProvider>
      </MemoryRouter>
    </AppProvider>,
  );
}

/** 7 empty days with one recipe planned at the given day index for dinner. */
function daysWithDinner(
  entries: Array<{ day: number; recipeId: string }>,
): AppState['plan']['days'] {
  const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
  for (const { day, recipeId } of entries) days[day] = { dinner: recipeId };
  return days;
}

describe('Prep page', () => {
  beforeEach(() => {
    captured = null;
  });

  it('renders cook sessions with date label, recipe title, batches and store state', () => {
    // Stew planned on day 0 (offset 1, within fridgeDays) -> single fridge
    // session on the prep day.
    renderPrep(
      seedState(8, [FREEZER_RECIPE], ['dinner'], daysWithDinner([
        { day: 0, recipeId: 'custom-stew' },
      ])),
    );

    const session = screen.getByRole('group', { name: /Veggie Stew/ });
    expect(session).toHaveAccessibleName(
      /Veggie Stew\. 1 serving\. 1 batch\. Keep in the fridge\./,
    );
    // The recipe title links to its detail page.
    expect(within(session).getByRole('link', { name: 'Veggie Stew' })).toHaveAttribute(
      'href',
      '/recipes/custom-stew',
    );
    // Req 9.2: the servings needed is shown next to the batches.
    expect(within(session).getByText('1 serving')).toBeInTheDocument();
    expect(within(session).getByText('1 batch')).toBeInTheDocument();
    expect(within(session).getByText('Keep in the fridge')).toBeInTheDocument();
    // The prep-day date label ("Sun Mar 1") is shown for the session.
    expect(screen.getByText('Sun Mar 1')).toBeInTheDocument();
    // The freezer-friendly recipe shows a pumpkin badge and make-ahead note.
    expect(within(session).getByText(/Freezes for 1 month/)).toBeInTheDocument();
    expect(
      within(session).getByText('Cool fully before freezing.'),
    ).toBeInTheDocument();
  });

  it('shows the servings-needed count when a recipe is used several times (Req 9.2)', () => {
    // Stew planned on days 0,1,2 (offsets 1,2,3). fridgeDays 1 only covers
    // offset 1, so the fresh-cook fallback does not apply here — but freezer is
    // set, so it is ONE prep-day session covering all 3 servings.
    renderPrep(
      seedState(8, [FREEZER_RECIPE], ['dinner'], daysWithDinner([
        { day: 0, recipeId: 'custom-stew' },
        { day: 1, recipeId: 'custom-stew' },
        { day: 2, recipeId: 'custom-stew' },
      ])),
    );

    const session = screen.getByRole('group', { name: /Veggie Stew/ });
    expect(within(session).getByText('3 servings')).toBeInTheDocument();
    expect(session).toHaveAccessibleName(/Veggie Stew\. 3 servings\./);
  });

  it('freezes far-off uses with a thaw reminder, and editing the prep day recomputes the list', () => {
    // Stew planned on day 5 (date 2026-03-07; offset 6 from prepDate
    // 2026-03-01) -> beyond fridgeDays(1), so it is frozen and a thaw reminder
    // appears the night before the use (2026-03-06 -> "Fri Mar 6").
    renderPrep(
      seedState(8, [FREEZER_RECIPE], ['dinner'], daysWithDinner([
        { day: 5, recipeId: 'custom-stew' },
      ])),
    );

    const session = screen.getByRole('group', { name: /Veggie Stew/ });
    expect(session).toHaveAccessibleName(/Freeze in single portions/);
    expect(screen.getByText(/Thaw Veggie Stew in the fridge the night before\./)).toBeInTheDocument();
    expect(screen.getByText('Fri Mar 6')).toBeInTheDocument();

    // Move the prep day to the day before the use (2026-03-06): offset becomes
    // 1, within fridgeDays, so the session flips to fridge and the thaw
    // reminder disappears -> the list recomputed from the dispatched action.
    const prep = screen.getByLabelText('Prep day');
    fireEvent.change(prep, { target: { value: '2026-03-06' } });
    expect(captured!.plan.prepDate).toBe('2026-03-06');

    expect(
      screen.getByRole('group', { name: /Veggie Stew/ }),
    ).toHaveAccessibleName(/Keep in the fridge/);
    expect(
      screen.queryByText(/Thaw Veggie Stew in the fridge the night before\./),
    ).toBeNull();
  });

  it('excludes a ghosted slot (honey under 12 months) from the prep list', () => {
    // Honey is blocked at 8 months -> ghosted; stew is eligible. Only the stew
    // session should appear.
    renderPrep(
      seedState(8, [FREEZER_RECIPE, HONEY_RECIPE], ['dinner'], daysWithDinner([
        { day: 0, recipeId: 'custom-stew' },
        { day: 1, recipeId: 'custom-honey' },
      ])),
    );

    expect(screen.getByRole('group', { name: /Veggie Stew/ })).toBeInTheDocument();
    expect(screen.queryByText('Honey Oat Mash')).toBeNull();
  });

  it('shows a friendly empty state when the plan has nothing to prep', () => {
    renderPrep(seedState(8, [FREEZER_RECIPE], ['dinner']));
    expect(
      screen.getByText(
        'Nothing to prep yet. Add meals to your week to see a prep plan.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('keeps one live region mounted and offers a next step when empty', () => {
    const { unmount } = renderPrep(seedState(8, [FREEZER_RECIPE], ['dinner']));
    const region = screen.getByRole('status');
    const link = within(region).getByRole('link', { name: 'Plan your week' });
    expect(link).toHaveAttribute('href', '/plan');
    expect(link).toHaveClass('fm-link');
    unmount();

    // With something to prep, the same single region stays mounted, empty.
    renderPrep(
      seedState(8, [FREEZER_RECIPE], ['dinner'], daysWithDinner([{ day: 1, recipeId: FREEZER_RECIPE.id }])),
    );
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('the prep date and next step are 44 px targets (CSS)', () => {
    for (const selector of ['.dateInput', '.nextStep']) {
      expect(ruleBody(prepCss, selector)).toContain('min-height: 44px');
    }
  });
});
