import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Share from './Share';
import shareCss from './Share.module.css?raw';
import { ruleBody } from '../../test/cssRule';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import { SHARE_BASE_URL } from '../../domain/share';
import type { AppState, MealType, Recipe } from '../../domain/types';

// The Share page copies a read-only share link (navigator.clipboard with a
// graceful fallback field), warns when the link is long (Req 11.6) and surfaces
// the privacy note (Req 11.3). It is rendered inside an AppProvider seeded with
// in-memory, onboarded storage (mirroring App.test.tsx).

/** An in-memory Storage so tests never touch real localStorage. */
function makeStorage(): Storage {
  const map = new Map<string, string>();
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

/** Seed an in-memory onboarded storage with the given state. */
function seededStorage(state: AppState): Storage {
  const storage = makeStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
  return storage;
}

/** A small onboarded state whose share link stays well under the warn length. */
function shortState(): AppState {
  return {
    ...defaultState(),
    onboarded: true,
    child: { name: 'Baby', birthDate: '2025-06-01' },
  };
}

/** A big onboarded state whose share link exceeds SHARE_WARN_LENGTH. */
function longState(): AppState {
  const longSteps = Array.from(
    { length: 30 },
    (_, i) =>
      `Step ${i}: ${'cook the vegetables very thoroughly until completely soft '.repeat(4)}`,
  );
  const bulky: Recipe[] = Array.from({ length: 40 }, (_, i) => ({
    id: `custom-bulk-${i}`,
    origin: 'custom',
    title: `Bulky Recipe Number ${i} With A Fairly Long Descriptive Title`,
    stages: ['6-8', '9-12'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: `ingredient-${i}-carrot`, quantity: 1, unit: 'cup', category: 'produce' },
      { name: `ingredient-${i}-sweet-potato`, quantity: 2, unit: 'cup', category: 'produce' },
    ],
    steps: longSteps,
    texture: 'smooth puree or soft mash for older infants',
    servings: 6,
  }));
  const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
  bulky.forEach((recipe, i) => {
    const slot = (['breakfast', 'lunch', 'dinner', 'snack'] as const)[i % 4];
    days[i % 7] = { ...days[i % 7], [slot]: recipe.id };
  });

  const base = shortState();
  return {
    ...base,
    customRecipes: bulky,
    plan: { ...base.plan, activeSlots: ['breakfast', 'lunch', 'dinner', 'snack'], days },
  };
}

function renderShare(state: AppState) {
  return render(
    <AppProvider storage={seededStorage(state)}>
      <MemoryRouter>
        <Share />
      </MemoryRouter>
    </AppProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Share page', () => {
  it('copies the share link to the clipboard and confirms (Req 11.1/11.2)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // Override navigator.clipboard.writeText for this test.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderShare(shortState());

    fireEvent.click(screen.getByRole('button', { name: /copy link/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied.startsWith(SHARE_BASE_URL)).toBe(true);

    // The 'Copied' confirmation appears in a status region.
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });

  it('exposes the URL in a fallback field for manual copy', () => {
    renderShare(shortState());
    const field = screen.getByLabelText(/copy it by hand/i) as HTMLInputElement;
    expect(field.value.startsWith(SHARE_BASE_URL)).toBe(true);
  });

  it('shows the length warning for a long link and still exposes the link (Req 11.6)', () => {
    renderShare(longState());
    expect(screen.getByText(/some messaging apps may cut it off/i)).toBeInTheDocument();
    // The link is still created and copyable.
    const field = screen.getByLabelText(/copy it by hand/i) as HTMLInputElement;
    expect(field.value.startsWith(SHARE_BASE_URL)).toBe(true);
  });

  it('does not show the length warning for a short link', () => {
    renderShare(shortState());
    expect(screen.queryByText(/some messaging apps may cut it off/i)).toBeNull();
  });

  it('surfaces the privacy note about name and birth date (Req 11.3)', () => {
    renderShare(shortState());
    const note = screen.getByText(
      /does not include your child.?s name or birth date/i,
    );
    expect(note).toBeInTheDocument();
    // The note accurately states the link carries which foods were tried AND
    // which caused a reaction (the payload carries reaction records).
    expect(note).toHaveTextContent(/tried/i);
    expect(note).toHaveTextContent(/reaction/i);
  });

  it('points an empty plan to /plan and says nothing for a planned week', () => {
    const { unmount } = renderShare(shortState());
    const link = screen.getByRole('link', { name: 'Plan your week' });
    expect(link).toHaveAttribute('href', '/plan');
    expect(link).toHaveClass('fm-link');
    // The empty note is plain text; it adds no live region of its own.
    expect(link.closest('[role="status"]')).toBeNull();
    unmount();

    renderShare(longState());
    expect(screen.queryByRole('link', { name: 'Plan your week' })).toBeNull();
  });

  it('counts only active slots when deciding the plan is empty', () => {
    const withMeal = (activeSlots: MealType[]): AppState => {
      const base = shortState();
      const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
      days[0] = { dinner: 'b-carrots-and-apples' };
      return { ...base, plan: { ...base.plan, activeSlots, days } };
    };
    // A meal in a deselected slot is not shared, so the empty note shows.
    const { unmount } = renderShare(withMeal(['breakfast']));
    expect(screen.getByRole('link', { name: 'Plan your week' })).toBeInTheDocument();
    unmount();

    // The same meal in an active slot: no note.
    renderShare(withMeal(['breakfast', 'dinner']));
    expect(screen.queryByRole('link', { name: 'Plan your week' })).toBeNull();
  });

  it('the copy button, field and next step are 44 px targets (CSS)', () => {
    expect(ruleBody(shareCss, '.linkBlock button')).toContain('min-height: 44px');
    expect(ruleBody(shareCss, '.nextStep')).toContain('min-height: 44px');
  });
});
