import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { defaultState, STORAGE_KEY } from '../domain/storage';
import type { AppState, Recipe } from '../domain/types';
import {
  AppProvider,
  reconcilePlanRecipes,
  reducer,
  useApp,
  type AppAction,
} from './AppProvider';

const NOW = new Date(2026, 0, 15);

const customRecipe: Recipe = {
  id: 'custom-1',
  origin: 'custom',
  title: 'My Mash',
  stages: ['6-8'],
  mealTypes: ['lunch'],
  ingredients: [{ name: 'banana', category: 'produce' }],
  steps: ['Mash it.'],
  texture: 'smooth',
  servings: 2,
};

function base(): AppState {
  return defaultState(NOW);
}

/** Apply a sequence of actions to a start state via the pure reducer. */
function run(start: AppState, actions: AppAction[]): AppState {
  return actions.reduce(reducer, start);
}

/** A Storage stub backed by a Map, with an optional throwing setItem. */
function makeStorage(opts: { throwOnSet?: boolean } = {}): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (opts.throwOnSet) throw new DOMException('quota', 'QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  } satisfies Storage;
}

describe('reducer actions', () => {
  it('setChild sets the profile and marks onboarded', () => {
    const next = reducer(base(), {
      type: 'setChild',
      child: { name: 'Baby', birthDate: '2025-06-01' },
    });
    expect(next.child).toEqual({ name: 'Baby', birthDate: '2025-06-01' });
    expect(next.onboarded).toBe(true);
  });

  it('saveCustomRecipe adds then replaces by id', () => {
    const added = reducer(base(), {
      type: 'saveCustomRecipe',
      recipe: customRecipe,
    });
    expect(added.customRecipes).toHaveLength(1);

    const replaced = reducer(added, {
      type: 'saveCustomRecipe',
      recipe: { ...customRecipe, title: 'Renamed' },
    });
    expect(replaced.customRecipes).toHaveLength(1);
    expect(replaced.customRecipes[0].title).toBe('Renamed');
  });

  it('deleteCustomRecipe removes the recipe and empties slots using it (Req 3.5)', () => {
    let state = run(base(), [
      { type: 'saveCustomRecipe', recipe: customRecipe },
      { type: 'setSlot', slot: { day: 0, meal: 'lunch' }, recipeId: 'custom-1' },
      { type: 'setSlot', slot: { day: 2, meal: 'dinner' }, recipeId: 'custom-1' },
      { type: 'setSlot', slot: { day: 1, meal: 'lunch' }, recipeId: 'b-carrots-and-apples' },
    ]);

    state = reducer(state, { type: 'deleteCustomRecipe', id: 'custom-1' });

    expect(state.customRecipes).toHaveLength(0);
    expect(state.plan.days[0].lunch).toBeUndefined();
    expect(state.plan.days[2].dinner).toBeUndefined();
    // An unrelated slot is untouched.
    expect(state.plan.days[1].lunch).toBe('b-carrots-and-apples');
  });

  it('setFoodRecord then clearFoodRecord adds and removes a tried record', () => {
    let state = reducer(base(), {
      type: 'setFoodRecord',
      key: 'allergen:egg',
      record: { status: 'tried', date: '2026-01-10' },
    });
    expect(state.foods['allergen:egg']).toEqual({
      status: 'tried',
      date: '2026-01-10',
    });

    state = reducer(state, { type: 'clearFoodRecord', key: 'allergen:egg' });
    expect(state.foods['allergen:egg']).toBeUndefined();
  });

  it('clearFoodRecord never removes a logged reaction', () => {
    const state = run(base(), [
      {
        type: 'setFoodRecord',
        key: 'allergen:peanut',
        record: { status: 'reaction', date: '2026-01-05', note: 'hives' },
      },
    ]);
    const after = reducer(state, {
      type: 'clearFoodRecord',
      key: 'allergen:peanut',
    });
    // A reaction is a safety signal: clearFoodRecord leaves it intact.
    expect(after.foods['allergen:peanut']).toEqual({
      status: 'reaction',
      date: '2026-01-05',
      note: 'hives',
    });
    // Same object identity: the reducer short-circuits to a no-op.
    expect(after).toBe(state);
  });

  it('clearFoodRecord is a no-op for an unknown key', () => {
    const state = base();
    expect(reducer(state, { type: 'clearFoodRecord', key: 'nope' })).toBe(state);
  });

  it('setSlot and clearSlot assign and remove a recipe at day+meal', () => {
    let state = reducer(base(), {
      type: 'setSlot',
      slot: { day: 3, meal: 'breakfast' },
      recipeId: 'b-carrots-and-apples',
    });
    expect(state.plan.days[3].breakfast).toBe('b-carrots-and-apples');

    state = reducer(state, {
      type: 'clearSlot',
      slot: { day: 3, meal: 'breakfast' },
    });
    expect(state.plan.days[3].breakfast).toBeUndefined();
  });

  it('setActiveSlots replaces the active slot list', () => {
    const next = reducer(base(), {
      type: 'setActiveSlots',
      activeSlots: ['breakfast', 'dinner'],
    });
    expect(next.plan.activeSlots).toEqual(['breakfast', 'dinner']);
  });

  it('newWeek keep shifts startDate+prepDate +7, keeps days, clears grocery (Req 8.5)', () => {
    let state = run(base(), [
      { type: 'setSlot', slot: { day: 0, meal: 'lunch' }, recipeId: 'b-carrots-and-apples' },
      { type: 'toggleGroceryItem', key: 'milk' },
    ]);
    const startBefore = state.plan.startDate; // 2026-01-15
    const prepBefore = state.plan.prepDate; // 2026-01-14

    state = reducer(state, { type: 'newWeek', mode: 'keep' });

    expect(state.plan.startDate).toBe('2026-01-22');
    expect(state.plan.prepDate).toBe('2026-01-21');
    expect(startBefore).toBe('2026-01-15');
    expect(prepBefore).toBe('2026-01-14');
    // Days kept.
    expect(state.plan.days[0].lunch).toBe('b-carrots-and-apples');
    // Grocery cleared.
    expect(state.groceryChecked).toEqual([]);
  });

  it('newWeek empty clears days and grocery (Req 8.5)', () => {
    let state = run(base(), [
      { type: 'setSlot', slot: { day: 0, meal: 'lunch' }, recipeId: 'b-carrots-and-apples' },
      { type: 'toggleGroceryItem', key: 'milk' },
    ]);
    state = reducer(state, { type: 'newWeek', mode: 'empty' });

    expect(state.plan.days).toHaveLength(7);
    expect(state.plan.days.every((d) => Object.keys(d).length === 0)).toBe(true);
    expect(state.groceryChecked).toEqual([]);
  });

  it('setPrepDate sets the prep date', () => {
    const next = reducer(base(), { type: 'setPrepDate', prepDate: '2026-01-10' });
    expect(next.plan.prepDate).toBe('2026-01-10');
  });

  it('toggleGroceryItem adds then removes a key', () => {
    let state = reducer(base(), { type: 'toggleGroceryItem', key: 'eggs' });
    expect(state.groceryChecked).toContain('eggs');
    state = reducer(state, { type: 'toggleGroceryItem', key: 'eggs' });
    expect(state.groceryChecked).not.toContain('eggs');
  });

  it('setFoodRecord upserts a food record by key', () => {
    let state = reducer(base(), {
      type: 'setFoodRecord',
      key: 'carrot',
      record: { status: 'tried', date: '2026-01-10' },
    });
    expect(state.foods.carrot).toEqual({ status: 'tried', date: '2026-01-10' });

    state = reducer(state, {
      type: 'setFoodRecord',
      key: 'carrot',
      record: { status: 'reaction', date: '2026-01-12', note: 'rash' },
    });
    expect(state.foods.carrot.status).toBe('reaction');
    expect(state.foods.carrot.note).toBe('rash');
  });

  it('acknowledgeDisclaimer sets disclaimerAcknowledged true and is idempotent (Req 13.1)', () => {
    expect(base().disclaimerAcknowledged).toBe(false);
    const once = reducer(base(), { type: 'acknowledgeDisclaimer' });
    expect(once.disclaimerAcknowledged).toBe(true);
    const twice = reducer(once, { type: 'acknowledgeDisclaimer' });
    expect(twice.disclaimerAcknowledged).toBe(true);
  });

  it('is immutable: the input state is not mutated', () => {
    const start = base();
    const snapshot = JSON.stringify(start);
    reducer(start, { type: 'toggleGroceryItem', key: 'x' });
    expect(JSON.stringify(start)).toBe(snapshot);
  });
});

describe('reconcilePlanRecipes (Req 3.5 load reconciliation)', () => {
  it('empties slots referencing an unknown recipe and reports them', () => {
    const start = base();
    start.plan.days[0] = { lunch: 'ghost-recipe', dinner: 'b-carrots-and-apples' };
    const { state, emptiedSlots } = reconcilePlanRecipes(start);

    expect(state.plan.days[0].lunch).toBeUndefined();
    expect(state.plan.days[0].dinner).toBe('b-carrots-and-apples');
    expect(emptiedSlots).toEqual([
      { day: 0, meal: 'lunch', recipeId: 'ghost-recipe' },
    ]);
  });

  it('keeps slots referencing a known custom recipe', () => {
    const start: AppState = { ...base(), customRecipes: [customRecipe] };
    start.plan.days[1] = { lunch: 'custom-1' };
    const { state, emptiedSlots } = reconcilePlanRecipes(start);
    expect(state.plan.days[1].lunch).toBe('custom-1');
    expect(emptiedSlots).toHaveLength(0);
    // Returns the same reference when nothing changed.
    expect(state).toBe(start);
  });
});

describe('AppProvider persistence and context', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function wrapper(storage: Storage) {
    return ({ children }: { children: ReactNode }) => (
      <AppProvider storage={storage}>{children}</AppProvider>
    );
  }

  it('persists state to storage 300 ms after a dispatch', () => {
    const storage = makeStorage();
    const spy = vi.spyOn(storage, 'setItem');
    const { result } = renderHook(() => useApp(), {
      wrapper: wrapper(storage),
    });

    spy.mockClear(); // ignore the initial mount save
    act(() => {
      result.current.dispatch({ type: 'toggleGroceryItem', key: 'milk' });
    });
    expect(spy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(spy).toHaveBeenCalled();
    const saved = JSON.parse(storage.getItem(STORAGE_KEY)!) as AppState;
    expect(saved.groceryChecked).toContain('milk');
  });

  it('raises the storage banner when a save fails (quota)', () => {
    const storage = makeStorage({ throwOnSet: true });
    const { result } = renderHook(() => useApp(), {
      wrapper: wrapper(storage),
    });

    act(() => {
      result.current.dispatch({ type: 'toggleGroceryItem', key: 'milk' });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.storageBanner).toBe(true);
  });

  it('surfaces emptied slots on load when the plan references a missing recipe', () => {
    const storage = makeStorage();
    const stored = base();
    stored.plan.days[0] = { lunch: 'ghost-recipe' };
    storage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useApp(), {
      wrapper: wrapper(storage),
    });

    expect(result.current.emptiedSlots).toEqual([
      { day: 0, meal: 'lunch', recipeId: 'ghost-recipe' },
    ]);
    expect(result.current.state.plan.days[0].lunch).toBeUndefined();
  });

  it('renders children', () => {
    const storage = makeStorage();
    const { container } = render(
      <AppProvider storage={storage}>
        <span>hello</span>
      </AppProvider>,
    );
    expect(container.textContent).toContain('hello');
  });
});

describe('AppProvider corrupt-data load notice (design Error Handling)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function wrapper(storage: Storage) {
    return ({ children }: { children: ReactNode }) => (
      <AppProvider storage={storage}>{children}</AppProvider>
    );
  }

  it('on corrupt stored data: sets corruptNotice and backs the raw value up under corruptBackupKey', () => {
    const storage = makeStorage();
    // Seed a corrupt raw value (non-JSON) under the app key BEFORE rendering,
    // so loadState hits its parse-failure/backup path at mount.
    const rawCorrupt = 'not json {';
    storage.setItem(STORAGE_KEY, rawCorrupt);

    const { result } = renderHook(() => useApp(), {
      wrapper: wrapper(storage),
    });

    expect(result.current.corruptNotice).toBe(true);
    // The backup key has the firstmenu:backup-<timestamp> shape.
    expect(result.current.corruptBackupKey).toMatch(/^firstmenu:backup-\d+$/);
    // The backup preserves the ORIGINAL raw corrupt value, byte-for-byte.
    const backupKey = result.current.corruptBackupKey!;
    expect(storage.getItem(backupKey)).toBe(rawCorrupt);
  });

  it('on corrupt JSON that fails the schema: still backs up the exact raw value', () => {
    const storage = makeStorage();
    // Valid JSON, but not a valid AppState (fails the zod schema).
    const rawCorrupt = JSON.stringify({ schemaVersion: 1, not: 'a real state' });
    storage.setItem(STORAGE_KEY, rawCorrupt);

    const { result } = renderHook(() => useApp(), {
      wrapper: wrapper(storage),
    });

    expect(result.current.corruptNotice).toBe(true);
    expect(result.current.corruptBackupKey).toMatch(/^firstmenu:backup-\d+$/);
    expect(storage.getItem(result.current.corruptBackupKey!)).toBe(rawCorrupt);
  });

  it('on valid stored data: corruptNotice is false and corruptBackupKey is null', () => {
    const storage = makeStorage();
    const good = base();
    good.groceryChecked = ['stored-item'];
    storage.setItem(STORAGE_KEY, JSON.stringify(good));

    const { result } = renderHook(() => useApp(), {
      wrapper: wrapper(storage),
    });

    expect(result.current.corruptNotice).toBe(false);
    expect(result.current.corruptBackupKey).toBeNull();
    // The valid stored state loaded as-is.
    expect(result.current.state.groceryChecked).toContain('stored-item');
  });

  it('with no stored data: corruptNotice is false and corruptBackupKey is null', () => {
    const storage = makeStorage();

    const { result } = renderHook(() => useApp(), {
      wrapper: wrapper(storage),
    });

    expect(result.current.corruptNotice).toBe(false);
    expect(result.current.corruptBackupKey).toBeNull();
  });
});

describe('AppProvider import/export (Req 12.5)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function wrapper(storage: Storage) {
    return ({ children }: { children: ReactNode }) => (
      <AppProvider storage={storage}>{children}</AppProvider>
    );
  }

  /** A known-good imported state that differs from the default. */
  function goodImport(): AppState {
    const state = base();
    state.child = { name: 'Imported', birthDate: '2025-03-01' };
    state.onboarded = true;
    state.groceryChecked = ['imported-item'];
    return state;
  }

  it('a BAD import leaves state and localStorage unchanged (Req 12.5)', () => {
    const storage = makeStorage();
    const { result } = renderHook(() => useApp(), {
      wrapper: wrapper(storage),
    });

    // Seed a known-good state via a dispatch and let it persist.
    act(() => {
      result.current.dispatch({ type: 'toggleGroceryItem', key: 'milk' });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const stateBefore = result.current.state;
    const stateSnapshot = JSON.stringify(stateBefore);
    const storageSnapshot = storage.getItem(STORAGE_KEY);

    // Import an invalid file.
    let outcome: { ok: boolean } = { ok: true };
    act(() => {
      outcome = result.current.importData('not valid json {');
    });

    expect(outcome.ok).toBe(false);
    expect(result.current.importError).toBeTruthy();
    // State object identity AND contents are unchanged (no replacement).
    expect(result.current.state).toBe(stateBefore);
    expect(JSON.stringify(result.current.state)).toBe(stateSnapshot);
    // localStorage was not touched by the failed import.
    expect(storage.getItem(STORAGE_KEY)).toBe(storageSnapshot);
  });

  it('a GOOD import replaces the whole state and clears any prior error', () => {
    const storage = makeStorage();
    const { result } = renderHook(() => useApp(), {
      wrapper: wrapper(storage),
    });

    // First a bad import to set an error.
    act(() => {
      result.current.importData('nope');
    });
    expect(result.current.importError).toBeTruthy();

    const imported = goodImport();
    let outcome: { ok: boolean } = { ok: false };
    act(() => {
      outcome = result.current.importData(JSON.stringify(imported));
    });

    expect(outcome.ok).toBe(true);
    expect(result.current.importError).toBeNull();
    expect(result.current.state).toEqual(imported);

    // The replacement is persisted after the debounce.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const saved = JSON.parse(storage.getItem(STORAGE_KEY)!) as AppState;
    expect(saved).toEqual(imported);
  });

  it('a GOOD import reconciles stale recipe refs and surfaces emptied slots (Req 3.5)', () => {
    const storage = makeStorage();
    const { result } = renderHook(() => useApp(), {
      wrapper: wrapper(storage),
    });

    // No emptied slots initially (fresh default load).
    expect(result.current.emptiedSlots).toEqual([]);

    // A valid backup whose plan references a recipe id absent from both
    // BUILTIN_RECIPES and the imported customRecipes.
    const imported = goodImport();
    imported.plan.days[0] = {
      lunch: 'ghost-recipe',
      dinner: 'b-carrots-and-apples',
    };

    let outcome: { ok: boolean } = { ok: false };
    act(() => {
      outcome = result.current.importData(JSON.stringify(imported));
    });

    expect(outcome.ok).toBe(true);
    // The dangling slot is emptied, the known one kept.
    expect(result.current.state.plan.days[0].lunch).toBeUndefined();
    expect(result.current.state.plan.days[0].dinner).toBe(
      'b-carrots-and-apples',
    );
    // The emptied-slot notice is surfaced through context, mirroring load.
    expect(result.current.emptiedSlots).toEqual([
      { day: 0, meal: 'lunch', recipeId: 'ghost-recipe' },
    ]);
  });

  it('exportData serializes the current state', () => {
    const storage = makeStorage();
    const { result } = renderHook(() => useApp(), {
      wrapper: wrapper(storage),
    });

    act(() => {
      result.current.dispatch({ type: 'toggleGroceryItem', key: 'eggs' });
    });

    const { filename, json } = result.current.exportData();
    expect(filename).toMatch(/^firstmenu-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = JSON.parse(json) as AppState;
    expect(parsed.groceryChecked).toContain('eggs');
  });
});
