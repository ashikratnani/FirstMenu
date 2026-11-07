import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SharedView from './SharedView';
import { encodeSharePayload } from '../../domain/share';
import type { AppState, Recipe } from '../../domain/types';

// SharedView must render ENTIRELY from the decoded link and touch NO store and
// NO storage (Req 11.4). These tests deliberately render it WITHOUT an
// AppProvider — if it read the store it would throw — and additionally spy on
// localStorage.setItem to prove nothing is persisted. An invalid link shows the
// "can't be read" error with no partial data (Req 11.5).

const BUILTIN_RECIPE_ID = 'b-carrots-and-apples';

/** A custom recipe the shared plan uses (so it must render in the shared view). */
function customRecipe(): Recipe {
  return {
    id: 'custom-sweet-pea-mash',
    origin: 'custom',
    title: 'Sweet Pea Mash',
    stages: ['6-8', '9-12'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'peas', quantity: 1, unit: 'cup', category: 'produce' },
      { name: 'water', quantity: 0.25, unit: 'cup', category: 'other' },
    ],
    steps: ['Steam the peas until soft.', 'Mash with a little water.'],
    texture: 'smooth puree',
    servings: 4,
  };
}

/** A plan state used by the owner to build the share link. */
function sampleState(overrides: Partial<AppState> = {}): AppState {
  const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
  days[0] = { lunch: BUILTIN_RECIPE_ID };
  days[2] = { dinner: 'custom-sweet-pea-mash' };

  return {
    schemaVersion: 1,
    child: { name: 'Baby', birthDate: '2025-06-01' },
    onboarded: true,
    customRecipes: [customRecipe()],
    foods: {},
    plan: {
      startDate: '2026-01-15',
      prepDate: '2026-01-14',
      activeSlots: ['lunch', 'dinner'],
      days,
    },
    groceryChecked: [],
    disclaimerAcknowledged: true,
    ...overrides,
  };
}

/** Render the /shared/:data route (NO AppProvider — proves no store use). */
function renderShared(fragment: string) {
  return render(
    <MemoryRouter initialEntries={[`/shared/${fragment}`]}>
      <Routes>
        <Route path="/shared/:data" element={<SharedView />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SharedView (read-only shared link)', () => {
  it('renders the read-only plan content from a valid link', () => {
    const { encoded } = encodeSharePayload(sampleState());
    renderShared(encoded);

    // The read-only heading and intro.
    expect(
      screen.getByRole('heading', { name: /shared plan/i }),
    ).toBeInTheDocument();

    // Planned recipe titles from the payload appear (built-in + custom). The
    // custom recipe title is unique to this plan.
    expect(screen.getAllByText('Sweet Pea Mash').length).toBeGreaterThan(0);

    // A day-date label from the week grid appears (plan starts 2026-01-15).
    expect(screen.getByText(/jan 15/i)).toBeInTheDocument();

    // No edit/mutation controls leak in from the owner pages.
    expect(screen.queryByRole('button', { name: /add/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /change/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
  });

  it('writes NOTHING to storage while rendering (Req 11.4)', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { encoded } = encodeSharePayload(sampleState());
    renderShared(encoded);

    // The view rendered its content...
    expect(
      screen.getByRole('heading', { name: /shared plan/i }),
    ).toBeInTheDocument();
    // ...and never persisted anything.
    expect(setItem).not.toHaveBeenCalled();
  });

  it('shows the error and NO plan content for an invalid link (Req 11.5)', () => {
    renderShared('not-valid-data');

    expect(screen.getByText(/can.?t be read/i)).toBeInTheDocument();

    // No partial data: none of the plan/recipe/grocery sections render.
    expect(
      screen.queryByRole('heading', { name: /recipes/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('heading', { name: /grocery/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('heading', { name: /this week/i }),
    ).toBeNull();
    expect(screen.queryByText('Sweet Pea Mash')).toBeNull();
  });

  it('ghosts a recipe blocked by the current ruleset (viewer re-runs rules)', () => {
    // A plan with a recipe that uses honey, which the current ruleset blocks
    // under 12 months. The payload age is 7 months, so the viewer re-screens
    // it as ghosted.
    const honeyRecipe: Recipe = {
      id: 'custom-honey-toast',
      origin: 'custom',
      title: 'Honey Toast Fingers',
      stages: ['9-12'],
      mealTypes: ['breakfast'],
      ingredients: [
        { name: 'bread', quantity: 1, unit: 'slice', category: 'grains' },
        { name: 'honey', quantity: 1, unit: 'tsp', category: 'pantry' },
      ],
      steps: ['Toast the bread.', 'Spread a little honey.'],
      texture: 'soft fingers',
      servings: 1,
    };
    const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
    days[0] = { breakfast: 'custom-honey-toast' };
    const state = sampleState({
      customRecipes: [honeyRecipe],
      plan: {
        startDate: '2026-01-15',
        prepDate: '2026-01-14',
        activeSlots: ['breakfast'],
        days,
      },
    });

    const { encoded } = encodeSharePayload(state);
    renderShared(encoded);

    // The ghost reason text names honey as not-yet.
    expect(screen.getAllByText(/not yet: honey/i).length).toBeGreaterThan(0);
  });

  it('ghosts a recipe whose food had a recorded reaction (safety consistency)', () => {
    // The payload carries foods with status 'reaction'. The custom recipe
    // "Sweet Pea Mash" uses peas (derived food key 'pea'); recording a reaction
    // on 'pea' must ghost the recipe in the shared week grid + recipe list the
    // same way the owner's views do, consistent with prep/grocery excluding it.
    const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
    days[2] = { dinner: 'custom-sweet-pea-mash' };
    const state = sampleState({
      foods: { pea: { status: 'reaction', date: '2026-01-10' } },
      plan: {
        startDate: '2026-01-15',
        prepDate: '2026-01-14',
        activeSlots: ['dinner'],
        days,
      },
    });

    const { encoded } = encodeSharePayload(state);
    renderShared(encoded);

    // The reaction reason (matching ghostReason) appears on the ghosted recipe.
    expect(
      screen.getAllByText(/not yet: pea\. reaction recorded\./i).length,
    ).toBeGreaterThan(0);

    // And the recipe is excluded from the shared prep + grocery (ghosted), so
    // its "Keep in the fridge"/grocery peas line never renders. The only peas
    // reference is the ghost reason, not a grocery amount line.
    expect(screen.queryByText('Nothing to buy.')).toBeInTheDocument();
  });

  it('shows per-recipe prep reminders from the current safety screen (Req 11.4)', () => {
    // A recipe with grapes fires the grapes reminder under 48 months: "Quarter
    // lengthwise before serving." It must show on the recipe card in the shared
    // view, matching the owner's recipe page and the shared grocery list.
    const grapeRecipe: Recipe = {
      id: 'custom-grape-yogurt',
      origin: 'custom',
      title: 'Grape Yogurt',
      stages: ['9-12'],
      mealTypes: ['snack'],
      ingredients: [
        { name: 'grape', quantity: 5, unit: 'piece', category: 'produce' },
        { name: 'plain yogurt', quantity: 0.5, unit: 'cup', category: 'dairy-eggs' },
      ],
      steps: ['Quarter the grapes.', 'Stir into the yogurt.'],
      texture: 'soft',
      servings: 1,
    };
    const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
    days[0] = { snack: 'custom-grape-yogurt' };
    const state = sampleState({
      customRecipes: [grapeRecipe],
      plan: {
        startDate: '2026-01-15',
        prepDate: '2026-01-14',
        activeSlots: ['snack'],
        days,
      },
    });

    const { encoded } = encodeSharePayload(state);
    renderShared(encoded);

    // The reminder appears at least once (the recipe card; the grocery list may
    // repeat it). The point is it is now on the recipe card too.
    expect(
      screen.getAllByText('Quarter lengthwise before serving.').length,
    ).toBeGreaterThan(0);
  });
});
