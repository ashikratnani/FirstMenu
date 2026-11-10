// "Each screen has at most one filled primary button" (Requirement 17.10),
// checked on the real pages inside the real shell. Astryx primaries carry
// data-variant="primary". Print and the recipe editor still use their own
// styled buttons until task 13 converts them, so those are counted by name.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { AppProvider } from '../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../domain/storage';
import type { AppState, Recipe } from '../domain/types';

function makeStorage(seed: AppState): Storage {
  const map = new Map<string, string>([[STORAGE_KEY, JSON.stringify(seed)]]);
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

function birthDateMonthsAgo(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SNACK: Recipe = {
  id: 'custom-blorp',
  origin: 'custom',
  title: 'Blorp Snack',
  stages: ['9-12'],
  mealTypes: ['snack'],
  ingredients: [{ name: 'blorp', category: 'other' }],
  steps: ['Mash.'],
  texture: 'soft',
  servings: 1,
  statedMinutes: 5,
};

function seed(extra: Partial<AppState> = {}): AppState {
  return {
    ...defaultState(new Date()),
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(10) },
    onboarded: true,
    disclaimerAcknowledged: true,
    customRecipes: [SNACK],
    dismissed: { 'pantry-setup': new Date().toISOString() },
    ...extra,
  };
}

function renderAt(path: string, state: AppState) {
  return render(
    <AppProvider storage={makeStorage(state)}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AppProvider>,
  );
}

/** Names of every filled primary button on screen. */
function primaries(): string[] {
  const astryx = Array.from(document.querySelectorAll('[data-variant="primary"]')).map(
    (el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
  );
  const native = screen
    .queryAllByRole('button', { name: /^(Print|Save recipe)$/ })
    .filter((el) => !el.hasAttribute('data-variant'))
    .map((el) => el.textContent?.trim() ?? '');
  return [...astryx, ...native];
}

function shellAddRecipe(): HTMLElement | undefined {
  return screen
    .queryAllByRole('link', { name: 'Add recipe' })
    .find((a) => a.hasAttribute('data-variant'));
}

describe('exactly one filled primary button per screen (Req 17.10)', () => {
  it('Make with a Try this card: the card is primary, the shell button is secondary', () => {
    renderAt('/', seed({ pantry: ['blorp'], foods: { blorp: { status: 'tried', date: '2026-01-01' } } }));
    expect(screen.getByRole('region', { name: 'Try this' })).toBeInTheDocument();
    expect(primaries()).toEqual(['Open recipe']);
    expect(shellAddRecipe()).toHaveAttribute('data-variant', 'secondary');
  });

  it('Make with no allowed Try this pick: the card is hidden and the shell "Add recipe" is primary', () => {
    renderAt('/', seed({ customRecipes: [], pantry: [] }));
    expect(screen.queryByRole('region', { name: 'Try this' })).not.toBeInTheDocument();
    expect(primaries()).toEqual(['Add recipe']);
    expect(shellAddRecipe()).toHaveAttribute('data-variant', 'primary');
  });

  it('Settings: Save is primary', () => {
    renderAt('/settings', seed());
    expect(primaries()).toEqual(['Save']);
    expect(shellAddRecipe()).toHaveAttribute('data-variant', 'secondary');
  });

  it('Print: Print is primary', () => {
    renderAt('/print', seed());
    expect(primaries()).toEqual(['Print']);
    expect(shellAddRecipe()).toHaveAttribute('data-variant', 'secondary');
  });

  it('the edit page: Save recipe is primary', () => {
    renderAt('/recipes/custom-blorp/edit', seed());
    expect(primaries()).toEqual(['Save recipe']);
    expect(shellAddRecipe()).toHaveAttribute('data-variant', 'secondary');
  });

  it('/recipes/new: Save recipe is primary and the shell button is hidden', () => {
    renderAt('/recipes/new', seed());
    expect(primaries()).toEqual(['Save recipe']);
    expect(shellAddRecipe()).toBeUndefined();
  });

  it('/add: Paste is the only primary before a preview and the shell button is hidden', () => {
    renderAt('/add', seed());
    expect(primaries()).toEqual(['Paste']);
    expect(shellAddRecipe()).toBeUndefined();
  });

  it('/add during a preview: Save recipe is the only primary and Paste is hidden', async () => {
    const user = userEvent.setup();
    renderAt('/add', seed());
    await user.click(screen.getByRole('textbox', { name: 'Recipe text' }));
    await user.paste('Banana mash\nIngredients:\n- 1 banana\nSteps:\n1. Mash it.');
    await user.click(screen.getByRole('button', { name: 'Read recipe' }));
    expect(primaries()).toEqual(['Save recipe']);
    expect(screen.queryByRole('button', { name: 'Paste' })).not.toBeInTheDocument();
    expect(shellAddRecipe()).toBeUndefined();
  });

  it('the recipe page has one filled primary (the shell "Add recipe"); "Add to plan" and "I made this" are secondary', () => {
    renderAt('/recipes/custom-blorp', seed());
    expect(primaries()).toEqual(['Add recipe']);
    expect(screen.getByRole('button', { name: 'I made this' })).not.toHaveAttribute('data-variant', 'primary');
    expect(screen.getByRole('button', { name: 'Add to plan' })).not.toHaveAttribute('data-variant', 'primary');
  });
});
