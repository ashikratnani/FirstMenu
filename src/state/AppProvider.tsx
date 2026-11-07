// The single app store: a React context + useReducer over AppState, with a
// debounced persistence effect wired to domain/storage.ts (design.md
// "AppProvider"). The reducer is a pure, exported function so action behaviour
// is unit-tested without rendering; the provider wires in load, persistence,
// and the storage banner.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppState,
  ChildProfile,
  FoodRecord,
  MealType,
  Recipe,
} from '../domain/types';
import { BUILTIN_RECIPES } from '../data/recipes';
import {
  createDebouncedSaver,
  exportState,
  importState,
  isStorageAvailable,
  loadState,
  type ExportResult,
} from '../domain/storage';

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** A single day+meal location in the plan. */
export interface SlotRef {
  day: number; // 0..6
  meal: MealType;
}

export type AppAction =
  | { type: 'setChild'; child: ChildProfile }
  | { type: 'saveCustomRecipe'; recipe: Recipe }
  | { type: 'deleteCustomRecipe'; id: string }
  | { type: 'setFoodRecord'; key: string; record: FoodRecord }
  | { type: 'clearFoodRecord'; key: string }
  | { type: 'clearReaction'; key: string }
  | { type: 'setSlot'; slot: SlotRef; recipeId: string }
  | { type: 'clearSlot'; slot: SlotRef }
  | { type: 'setActiveSlots'; activeSlots: MealType[] }
  | { type: 'newWeek'; mode: 'keep' | 'empty' }
  | { type: 'setPrepDate'; prepDate: string }
  | { type: 'toggleGroceryItem'; key: string }
  | { type: 'acknowledgeDisclaimer' }
  | { type: 'replaceState'; state: AppState };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shift a YYYY-MM-DD date by `days`, timezone-safe (mirrors age.ts parseYMD). */
function shiftYmd(date: string, days: number): string {
  const [year, month, day] = date.split('-').map((part) => Number(part));
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Known recipe ids = built-ins plus the given custom recipes. */
function knownRecipeIds(customRecipes: Recipe[]): Set<string> {
  const ids = new Set<string>();
  for (const r of BUILTIN_RECIPES) ids.add(r.id);
  for (const r of customRecipes) ids.add(r.id);
  return ids;
}

// ---------------------------------------------------------------------------
// Reducer (pure)
// ---------------------------------------------------------------------------

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'setChild': {
      // Setting the child completes onboarding (Req 1.6 flow).
      return { ...state, child: action.child, onboarded: true };
    }

    case 'saveCustomRecipe': {
      const existingIndex = state.customRecipes.findIndex(
        (r) => r.id === action.recipe.id,
      );
      const customRecipes =
        existingIndex >= 0
          ? state.customRecipes.map((r, i) =>
              i === existingIndex ? action.recipe : r,
            )
          : [...state.customRecipes, action.recipe];
      return { ...state, customRecipes };
    }

    case 'deleteCustomRecipe': {
      const customRecipes = state.customRecipes.filter(
        (r) => r.id !== action.id,
      );
      // Req 3.5: empty any plan slot that referenced the deleted recipe.
      const days = state.plan.days.map((day) => {
        let changed = false;
        const next: typeof day = { ...day };
        for (const meal of Object.keys(next) as MealType[]) {
          if (next[meal] === action.id) {
            delete next[meal];
            changed = true;
          }
        }
        return changed ? next : day;
      });
      return {
        ...state,
        customRecipes,
        plan: { ...state.plan, days },
      };
    }

    case 'setFoodRecord': {
      return {
        ...state,
        foods: { ...state.foods, [action.key]: action.record },
      };
    }

    case 'clearFoodRecord': {
      // Remove a food record so a mistakenly-checked "tried" food can be
      // undone from Settings. Only a 'tried' record is cleared: a logged
      // 'reaction' is a safety signal and must never be silently dropped
      // here (callers gate on status before dispatching, and this guard is a
      // second line of defence). No-op when the key is absent or a reaction.
      const existing = state.foods[action.key];
      if (!existing || existing.status !== 'tried') return state;
      const foods = { ...state.foods };
      delete foods[action.key];
      return { ...state, foods };
    }

    case 'clearReaction': {
      // Remove a food record ONLY when it is a logged 'reaction', so the Foods
      // page can let the user clear a safety flag they recorded (Req 7.6/8.2).
      // This is the explicit counterpart to clearFoodRecord (which clears only
      // a mistaken 'tried'): neither path silently drops the other's record.
      // No-op when the key is absent or the record is not a reaction.
      const existing = state.foods[action.key];
      if (!existing || existing.status !== 'reaction') return state;
      const foods = { ...state.foods };
      delete foods[action.key];
      return { ...state, foods };
    }

    case 'setSlot': {
      const days = state.plan.days.map((day, i) =>
        i === action.slot.day
          ? { ...day, [action.slot.meal]: action.recipeId }
          : day,
      );
      return { ...state, plan: { ...state.plan, days } };
    }

    case 'clearSlot': {
      const days = state.plan.days.map((day, i) => {
        if (i !== action.slot.day) return day;
        const next = { ...day };
        delete next[action.slot.meal];
        return next;
      });
      return { ...state, plan: { ...state.plan, days } };
    }

    case 'setActiveSlots': {
      return {
        ...state,
        plan: { ...state.plan, activeSlots: [...action.activeSlots] },
      };
    }

    case 'newWeek': {
      // Req 8.5: BOTH modes clear groceryChecked. 'keep' shifts dates +7 and
      // keeps the day plans; 'empty' clears the days to 7 empty objects.
      if (action.mode === 'keep') {
        return {
          ...state,
          plan: {
            ...state.plan,
            startDate: shiftYmd(state.plan.startDate, 7),
            prepDate: shiftYmd(state.plan.prepDate, 7),
          },
          groceryChecked: [],
        };
      }
      return {
        ...state,
        plan: { ...state.plan, days: Array.from({ length: 7 }, () => ({})) },
        groceryChecked: [],
      };
    }

    case 'setPrepDate': {
      return { ...state, plan: { ...state.plan, prepDate: action.prepDate } };
    }

    case 'toggleGroceryItem': {
      const checked = state.groceryChecked.includes(action.key)
        ? state.groceryChecked.filter((k) => k !== action.key)
        : [...state.groceryChecked, action.key];
      return { ...state, groceryChecked: checked };
    }

    case 'acknowledgeDisclaimer': {
      // Req 13.1: the first-run disclaimer has been acknowledged; record it so
      // it does not reappear. Idempotent.
      return { ...state, disclaimerAcknowledged: true };
    }

    case 'replaceState': {
      // Wholesale replacement after a validated import (Req 12.5). The caller
      // (importData) only dispatches this with an already-validated AppState.
      return action.state;
    }

    default: {
      // Exhaustiveness: a new action type without a case is a compile error.
      const _never: never = action;
      return _never;
    }
  }
}

// ---------------------------------------------------------------------------
// Load-time reconciliation (Req 3.5)
// ---------------------------------------------------------------------------

export interface ReconcileResult {
  state: AppState;
  /** Human-readable labels of the plan slots that were emptied on load. */
  emptiedSlots: Array<{ day: number; meal: MealType; recipeId: string }>;
}

/**
 * Empty any plan slot that references a recipe id present in neither
 * BUILTIN_RECIPES nor state.customRecipes (design Error Handling: "Plan
 * references a deleted recipe -> slot emptied on load, notice listing emptied
 * slots"). Pure, so it is testable without rendering.
 */
export function reconcilePlanRecipes(state: AppState): ReconcileResult {
  const known = knownRecipeIds(state.customRecipes);
  const emptiedSlots: ReconcileResult['emptiedSlots'] = [];

  const days = state.plan.days.map((day, dayIndex) => {
    let changed = false;
    const next = { ...day };
    for (const meal of Object.keys(next) as MealType[]) {
      const recipeId = next[meal];
      if (recipeId !== undefined && !known.has(recipeId)) {
        emptiedSlots.push({ day: dayIndex, meal, recipeId });
        delete next[meal];
        changed = true;
      }
    }
    return changed ? next : day;
  });

  if (emptiedSlots.length === 0) {
    return { state, emptiedSlots };
  }
  return {
    state: { ...state, plan: { ...state.plan, days } },
    emptiedSlots,
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/** Outcome of an importData() call, for the UI to react to. */
export type ImportOutcome = { ok: true } | { ok: false; reason: string };

export interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  /** True when changes cannot be persisted (storage unavailable or save failed). */
  storageBanner: boolean;
  /** Set on load when corrupt data was found and backed up. */
  corruptNotice: boolean;
  /**
   * The `firstmenu:backup-<timestamp>` key the corrupt raw data was copied to
   * on load, if any. Lets a later UI offer to export the backup (design Error
   * Handling). Null when no corrupt data was backed up. Derived UI state only;
   * never persisted into AppState.
   */
  corruptBackupKey: string | null;
  /** Slots emptied on load because they referenced an unknown recipe (Req 3.5). */
  emptiedSlots: ReconcileResult['emptiedSlots'];
  /**
   * Delete a custom recipe AND surface the plan slots it occupied through
   * `emptiedSlots` (Req 3.5 for an in-session delete). The pure reducer already
   * empties those slots; this helper additionally computes which slots
   * referenced the id (same {day, meal, recipeId} shape reconcilePlanRecipes
   * produces) and publishes them to the emptied-slot notice before dispatching
   * the reducer's `deleteCustomRecipe` action.
   */
  deleteCustomRecipe: (id: string) => void;
  /** Clear the emptied-slot notice once the user has seen/dismissed it. */
  dismissEmptiedSlots: () => void;
  /** Serialize the current state for download (filename + JSON). */
  exportData: () => ExportResult;
  /**
   * Validate and import a JSON string. On success the whole state is replaced;
   * on failure the existing state is left completely unchanged and the reason
   * is returned (and exposed via `importError`). Req 12.5.
   */
  importData: (rawJson: string) => ImportOutcome;
  /** The reason of the most recent failed import, if any. */
  importError: string | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps {
  children: ReactNode;
  /** Inject a Storage for tests; defaults to localStorage. */
  storage?: Storage;
}

/** Build the initial state: load, then reconcile unknown recipe references. */
function buildInitial(storage?: Storage): {
  state: AppState;
  storageUnavailable: boolean;
  corrupt: boolean;
  corruptBackupKey: string | null;
  emptiedSlots: ReconcileResult['emptiedSlots'];
} {
  const loaded = loadState(storage);
  const reconciled = reconcilePlanRecipes(loaded.state);
  return {
    state: reconciled.state,
    storageUnavailable: loaded.storageUnavailable,
    corrupt: loaded.corrupt,
    corruptBackupKey: loaded.backupKey ?? null,
    emptiedSlots: reconciled.emptiedSlots,
  };
}

export function AppProvider({ children, storage }: AppProviderProps) {
  // Compute the initial load exactly once.
  const initialRef = useRef<ReturnType<typeof buildInitial> | null>(null);
  if (initialRef.current === null) {
    initialRef.current = buildInitial(storage);
  }
  const initial = initialRef.current;

  const [state, dispatch] = useReducer(reducer, initial.state);

  // Load-time/import notices live in React state (not a frozen ref) so an
  // import that reconciles stale recipe references surfaces the same
  // emptied-slot notice a load does (Req 3.5). Seeded from the initial load.
  const [corruptNotice] = useState(initial.corrupt);
  const [corruptBackupKey] = useState(initial.corruptBackupKey);
  const [emptiedSlots, setEmptiedSlots] = useState(initial.emptiedSlots);

  // Probe storage availability exactly once (not on every render), combined
  // with whether load already detected storage unavailable (Req 12.7).
  const storageUnavailableRef = useRef<boolean | null>(null);
  if (storageUnavailableRef.current === null) {
    storageUnavailableRef.current =
      initial.storageUnavailable || !isStorageAvailable(storage);
  }
  const storageUnavailable = storageUnavailableRef.current;

  // Storage banner starts true if storage is unavailable at load (Req 12.7),
  // and flips true if a later save reports failure.
  const [saveFailed, setSaveFailed] = useState(false);
  const storageBanner = storageUnavailable || saveFailed;

  // One debounced saver for the provider's lifetime.
  const saverRef = useRef(
    createDebouncedSaver({
      storage,
      onResult: (ok) => setSaveFailed((prev) => (ok ? prev : true)),
    }),
  );

  // Persist on every state change (300 ms debounced). Saving on mount is fine.
  useEffect(() => {
    if (storageUnavailable) return;
    saverRef.current(state);
  }, [state, storageUnavailable]);

  // Flush any pending write when the provider unmounts so nothing is lost.
  // Kept in its own mount-only effect so a state change does not flush (and
  // thereby defeat) the debounce.
  useEffect(() => {
    const saver = saverRef.current;
    return () => {
      saver.flush();
    };
  }, []);

  // Reason of the most recent failed import (Req 12.5). Cleared on success.
  const [importError, setImportError] = useState<string | null>(null);

  // Keep a ref to the latest state so exportData always serializes current
  // state without being recreated on every render.
  const stateRef = useRef(state);
  stateRef.current = state;

  const exportData = useRef<() => ExportResult>(() =>
    exportState(stateRef.current),
  ).current;

  const importData = useRef<(rawJson: string) => ImportOutcome>(
    (rawJson: string) => {
      const result = importState(rawJson);
      if (!result.ok) {
        // Failure: leave existing state (and storage) untouched (Req 12.5).
        setImportError(result.reason);
        return { ok: false, reason: result.reason };
      }
      // Reconcile stale recipe references on the validated import the same
      // way the load path does, so a dangling plan slot is emptied and the
      // emptied-slot notice is surfaced through context (Req 3.5).
      const reconciled = reconcilePlanRecipes(result.state);
      setImportError(null);
      setEmptiedSlots(reconciled.emptiedSlots);
      dispatch({ type: 'replaceState', state: reconciled.state });
      return { ok: true };
    },
  ).current;

  // Delete a custom recipe and surface the slots it occupied (Req 3.5). The
  // reducer is pure and already empties those slots; this helper computes the
  // emptied-slot list from the CURRENT state (via stateRef so the callback is
  // stable) and publishes it to the notice before dispatching. Mirrors the
  // {day, meal, recipeId} shape reconcilePlanRecipes produces.
  const deleteCustomRecipe = useRef<(id: string) => void>((id: string) => {
    const current = stateRef.current;
    const slots: ReconcileResult['emptiedSlots'] = [];
    current.plan.days.forEach((day, dayIndex) => {
      for (const meal of Object.keys(day) as MealType[]) {
        if (day[meal] === id) {
          slots.push({ day: dayIndex, meal, recipeId: id });
        }
      }
    });
    setEmptiedSlots(slots);
    dispatch({ type: 'deleteCustomRecipe', id });
  }).current;

  const dismissEmptiedSlots = useRef<() => void>(() => {
    setEmptiedSlots([]);
  }).current;

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      dispatch,
      storageBanner,
      corruptNotice,
      corruptBackupKey,
      emptiedSlots,
      deleteCustomRecipe,
      dismissEmptiedSlots,
      exportData,
      importData,
      importError,
    }),
    [
      state,
      storageBanner,
      corruptNotice,
      corruptBackupKey,
      emptiedSlots,
      deleteCustomRecipe,
      dismissEmptiedSlots,
      exportData,
      importData,
      importError,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Access the full app context. Throws if used outside an AppProvider. */
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (ctx === null) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}

/** Convenience: just the state. */
export function useAppState(): AppState {
  return useApp().state;
}

/** Convenience: just the dispatch. */
export function useAppDispatch(): React.Dispatch<AppAction> {
  return useApp().dispatch;
}
