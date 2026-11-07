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
  isStorageAvailable,
  loadState,
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
  | { type: 'setSlot'; slot: SlotRef; recipeId: string }
  | { type: 'clearSlot'; slot: SlotRef }
  | { type: 'setActiveSlots'; activeSlots: MealType[] }
  | { type: 'newWeek'; mode: 'keep' | 'empty' }
  | { type: 'setPrepDate'; prepDate: string }
  | { type: 'toggleGroceryItem'; key: string };

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

export interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  /** True when changes cannot be persisted (storage unavailable or save failed). */
  storageBanner: boolean;
  /** Set on load when corrupt data was found and backed up. */
  corruptNotice: boolean;
  /** Slots emptied on load because they referenced an unknown recipe (Req 3.5). */
  emptiedSlots: ReconcileResult['emptiedSlots'];
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
  emptiedSlots: ReconcileResult['emptiedSlots'];
} {
  const loaded = loadState(storage);
  const reconciled = reconcilePlanRecipes(loaded.state);
  return {
    state: reconciled.state,
    storageUnavailable: loaded.storageUnavailable,
    corrupt: loaded.corrupt,
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

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      dispatch,
      storageBanner,
      corruptNotice: initial.corrupt,
      emptiedSlots: initial.emptiedSlots,
    }),
    [state, storageBanner, initial.corrupt, initial.emptiedSlots],
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
