// Persistence boundary for the single AppState store (design.md "Storage").
// Pure TS, no React. Everything that leaves or enters localStorage passes
// through here: a zod schema validates untrusted/loaded data, corrupt data is
// backed up and replaced with a fresh default, and saves are debounced so
// rapid edits coalesce into one write.

import { z } from 'zod';
import type { AppState, WeekPlan } from './types';

export const STORAGE_KEY = 'firstmenu';
export const SCHEMA_VERSION = 1 as const;
export const SAVE_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// zod schema — mirrors src/domain/types.ts AppState EXACTLY.
// Keep in sync with types.ts; this is the authoritative runtime validator for
// any data we did not produce in-memory (loaded or imported).
// ---------------------------------------------------------------------------

const stageIdSchema = z.enum(['6-8', '9-12']);
const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
const groceryCategorySchema = z.enum([
  'produce',
  'dairy-eggs',
  'protein',
  'grains',
  'pantry',
  'frozen',
  'other',
]);

// A well-formed YYYY-MM-DD string that is also a real calendar date. Rejects
// '', '2026-13-01', '2026-02-30', etc. A malformed/empty birthDate must never
// reach age logic: ageInMonths('') -> NaN and stageFor(NaN) -> '9-12' (the LESS
// strict stage), so we reject bad dates here at the storage boundary.
export const ymdDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')
  .refine((value) => isRealCalendarDate(value), {
    message: 'must be a real calendar date',
  });

/** True only for a syntactically valid YYYY-MM-DD that is a real date. */
function isRealCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  // Round-trip through a UTC date to catch overflow (e.g. Feb 30).
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const recipeSourceSchema = z.object({
  title: z.string(),
  publisher: z.string(),
  url: z.string(),
  retrieved: z.string(),
  adaptations: z.array(z.string()),
  storageSource: z.string().optional(),
});

const ingredientSchema = z.object({
  name: z.string(),
  food: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  category: groceryCategorySchema,
});

const recipeSchema = z.object({
  id: z.string(),
  origin: z.enum(['builtin', 'custom']),
  source: recipeSourceSchema.optional(),
  title: z.string(),
  stages: z.array(stageIdSchema),
  mealTypes: z.array(mealTypeSchema),
  ingredients: z.array(ingredientSchema),
  steps: z.array(z.string()),
  texture: z.string(),
  servings: z.number(),
  storage: z
    .object({
      fridgeDays: z.number().optional(),
      freezerMonths: z.number().optional(),
    })
    .optional(),
  makeAheadNote: z.string().optional(),
});

const childProfileSchema = z.object({
  name: z.string().optional(),
  birthDate: ymdDateSchema,
});

const foodRecordSchema = z.object({
  status: z.enum(['tried', 'reaction']),
  date: z.string(),
  note: z.string().optional(),
});

const weekPlanSchema = z.object({
  startDate: z.string(),
  prepDate: z.string(),
  activeSlots: z.array(mealTypeSchema),
  // A day is a Partial<Record<MealType, recipeId>>; exactly 7 of them.
  // partialRecord (not record) so a day may omit meal keys.
  days: z
    .array(z.partialRecord(mealTypeSchema, z.string()))
    .length(7),
});

export const appStateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  child: childProfileSchema.optional(),
  onboarded: z.boolean(),
  customRecipes: z.array(recipeSchema),
  foods: z.record(z.string(), foodRecordSchema),
  plan: weekPlanSchema,
  groceryChecked: z.array(z.string()),
  disclaimerAcknowledged: z.boolean(),
});

// zod's inferred type must be assignable to the hand-written AppState; this
// line fails to compile if the schema drifts from types.ts.
type SchemaState = z.infer<typeof appStateSchema>;
const _schemaMatchesType: AppState extends SchemaState
  ? SchemaState extends AppState
    ? true
    : never
  : never = true;
void _schemaMatchesType;

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

/** Shift a YYYY-MM-DD string by `days`, timezone-safe (no `new Date(str)`). */
function shiftYmd(date: string, days: number): string {
  const [year, month, day] = date.split('-').map((part) => Number(part));
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today as YYYY-MM-DD in local time (used only as a default seed). */
function todayYmd(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** An empty 7-day plan whose prep date defaults to the day before startDate. */
export function defaultPlan(startDate: string): WeekPlan {
  const days: WeekPlan['days'] = Array.from({ length: 7 }, () => ({}));
  return {
    startDate,
    prepDate: shiftYmd(startDate, -1),
    activeSlots: [],
    days,
  };
}

/**
 * A valid, fresh AppState. `now` is injectable so tests control the default
 * plan dates deterministically.
 */
export function defaultState(now: Date = new Date()): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    onboarded: false,
    customRecipes: [],
    foods: {},
    plan: defaultPlan(todayYmd(now)),
    groceryChecked: [],
    disclaimerAcknowledged: false,
  };
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/**
 * Upgrade a parsed-but-unvalidated stored object from `fromVersion` to the
 * current SCHEMA_VERSION shape, before zod validation. v1 is an identity
 * passthrough; future versions add a case per step. load() runs
 * parse -> migrate(fromVersion) -> zod validate.
 */
// Registry of one-step upgrades, keyed by the version they upgrade FROM. A
// future schema bump adds an entry (e.g. `1: migrateV1toV2`) that returns the
// object in the next version's shape. Empty today because SCHEMA_VERSION === 1.
const MIGRATIONS: Record<number, (raw: unknown) => unknown> = {};

export function migrate(raw: unknown, fromVersion: number): unknown {
  let current = raw;
  let version = fromVersion;

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      // An older version we do not know how to upgrade: leave it unchanged and
      // let zod reject it, which triggers the corrupt-data backup path.
      return current;
    }
    current = step(current);
    version += 1;
  }

  return current;
}

// ---------------------------------------------------------------------------
// Storage availability
// ---------------------------------------------------------------------------

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Accessing localStorage can throw (disabled storage).
    return null;
  }
}

/**
 * Probe a Storage by writing and removing a test key. A throw means storage is
 * unavailable (Safari private mode, disabled storage) — Req 12.7.
 */
export function isStorageAvailable(storage?: Storage): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;
  const probeKey = `${STORAGE_KEY}:__probe__`;
  try {
    target.setItem(probeKey, '1');
    target.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

export interface LoadResult {
  state: AppState;
  /** Corrupt data was found; it was backed up and replaced with a default. */
  corrupt: boolean;
  /** The backup key the corrupt raw string was copied to, if any. */
  backupKey?: string;
  /** localStorage is unavailable (disabled / private mode). */
  storageUnavailable: boolean;
}

/**
 * Read and validate the stored AppState. On parse/migrate/zod failure the raw
 * string is copied to `firstmenu:backup-<timestamp>`, a fresh default is
 * returned, and `corrupt` is set so the UI can offer an export-backup option.
 * If storage is unavailable, a default state is returned with
 * `storageUnavailable` set. `now` seeds the default plan deterministically.
 */
export function loadState(storage?: Storage, now: Date = new Date()): LoadResult {
  const target = resolveStorage(storage);
  if (!target) {
    return {
      state: defaultState(now),
      corrupt: false,
      storageUnavailable: true,
    };
  }

  let rawString: string | null;
  try {
    rawString = target.getItem(STORAGE_KEY);
  } catch {
    return {
      state: defaultState(now),
      corrupt: false,
      storageUnavailable: true,
    };
  }

  if (rawString === null) {
    return {
      state: defaultState(now),
      corrupt: false,
      storageUnavailable: false,
    };
  }

  try {
    const parsed: unknown = JSON.parse(rawString);
    const fromVersion =
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { schemaVersion?: unknown }).schemaVersion === 'number'
        ? (parsed as { schemaVersion: number }).schemaVersion
        : 0;
    const migrated = migrate(parsed, fromVersion);
    const state = appStateSchema.parse(migrated);
    return { state, corrupt: false, storageUnavailable: false };
  } catch {
    const backupKey = backupCorruptData(target, rawString);
    return {
      state: defaultState(now),
      corrupt: true,
      backupKey,
      storageUnavailable: false,
    };
  }
}

/** Copy the corrupt raw string to a timestamped backup key. */
function backupCorruptData(storage: Storage, rawString: string): string | undefined {
  const backupKey = `${STORAGE_KEY}:backup-${Date.now()}`;
  try {
    storage.setItem(backupKey, rawString);
    return backupKey;
  } catch {
    // If even the backup write fails (quota), do not crash; the default state
    // still loads. No backup key to report.
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

/**
 * Serialize and write the AppState. Returns true on success. If setItem throws
 * (quota exceeded, Safari private mode) or storage is unavailable, returns
 * false WITHOUT throwing — the app keeps working in memory (Req 12.7).
 */
export function saveState(state: AppState, storage?: Storage): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Debounced save
// ---------------------------------------------------------------------------

export interface DebouncedSaver {
  /** Schedule a save `delayMs` after this call, cancelling any pending save. */
  (state: AppState): void;
  /** Cancel any pending save without writing. */
  cancel(): void;
  /** Immediately write any pending state (and cancel the timer). */
  flush(): void;
}

/**
 * A factory returning a debounced saver. Rapid calls coalesce: only the last
 * state is written, `delayMs` after the final call. `onResult` (if given) is
 * invoked with the saveState boolean so the caller can raise a storage banner.
 */
export function createDebouncedSaver(
  options: {
    delayMs?: number;
    storage?: Storage;
    onResult?: (ok: boolean) => void;
  } = {},
): DebouncedSaver {
  const { delayMs = SAVE_DEBOUNCE_MS, storage, onResult } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: AppState | null = null;

  const run = () => {
    timer = null;
    if (pending === null) return;
    const state = pending;
    pending = null;
    const ok = saveState(state, storage);
    onResult?.(ok);
  };

  const saver = ((state: AppState) => {
    pending = state;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(run, delayMs);
  }) as DebouncedSaver;

  saver.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pending = null;
  };

  saver.flush = () => {
    if (timer !== null) clearTimeout(timer);
    run();
  };

  return saver;
}
