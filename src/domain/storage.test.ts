import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from './types';
import {
  appStateSchema,
  createDebouncedSaver,
  defaultState,
  exportState,
  importState,
  isStorageAvailable,
  loadState,
  migrate,
  SAVE_DEBOUNCE_MS,
  saveState,
  SCHEMA_VERSION,
  STORAGE_KEY,
} from './storage';

const FIXED_NOW = new Date(2026, 0, 15); // 2026-01-15 local

/** A fully-valid AppState for round-trip tests. */
function validState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    child: { name: 'Baby', birthDate: '2025-06-01' },
    onboarded: true,
    customRecipes: [],
    foods: { carrot: { status: 'tried', date: '2026-01-10' } },
    plan: {
      startDate: '2026-01-15',
      prepDate: '2026-01-14',
      activeSlots: ['breakfast', 'dinner'],
      days: Array.from({ length: 7 }, () => ({})),
    },
    groceryChecked: ['milk'],
    disclaimerAcknowledged: true,
  };
}

/** A Storage stub backed by a Map, with optional throwing hooks. */
function makeStorage(
  opts: {
    throwOnGet?: boolean;
    throwOnSet?: boolean;
  } = {},
): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => {
      if (opts.throwOnGet) throw new Error('getItem blocked');
      return map.has(k) ? map.get(k)! : null;
    },
    setItem: (k: string, v: string) => {
      if (opts.throwOnSet) throw new DOMException('quota', 'QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  } satisfies Storage;
}

describe('migrate', () => {
  it('is an identity passthrough for the current version', () => {
    const obj = validState();
    expect(migrate(obj, SCHEMA_VERSION)).toBe(obj);
  });

  it('round-trips a v1 object unchanged through migrate + schema', () => {
    const obj = validState();
    const migrated = migrate(obj, 1);
    expect(() => appStateSchema.parse(migrated)).not.toThrow();
    expect(migrated).toEqual(obj);
  });

  it('leaves an unknown older version unchanged (so zod rejects it)', () => {
    const weird = { schemaVersion: 0 };
    expect(migrate(weird, 0)).toBe(weird);
  });
});

describe('defaultState', () => {
  it('is a valid fresh state seeded from `now`', () => {
    const state = defaultState(FIXED_NOW);
    expect(() => appStateSchema.parse(state)).not.toThrow();
    expect(state.onboarded).toBe(false);
    expect(state.disclaimerAcknowledged).toBe(false);
    expect(state.customRecipes).toEqual([]);
    expect(state.foods).toEqual({});
    expect(state.groceryChecked).toEqual([]);
    expect(state.plan.days).toHaveLength(7);
    expect(state.plan.startDate).toBe('2026-01-15');
    expect(state.plan.prepDate).toBe('2026-01-14'); // day before start
  });
});

describe('appStateSchema birthDate validation (Task 2 forward note)', () => {
  it('rejects an empty birthDate', () => {
    const bad = { ...validState(), child: { birthDate: '' } };
    expect(appStateSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a malformed birthDate', () => {
    const bad = { ...validState(), child: { birthDate: '2026-1-5' } };
    expect(appStateSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an impossible calendar date', () => {
    const bad = { ...validState(), child: { birthDate: '2026-02-30' } };
    expect(appStateSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a real YYYY-MM-DD birthDate', () => {
    const ok = { ...validState(), child: { birthDate: '2025-06-01' } };
    expect(appStateSchema.safeParse(ok).success).toBe(true);
  });
});

describe('loadState', () => {
  it('returns a default state (no notice) when nothing is stored', () => {
    const storage = makeStorage();
    const result = loadState(storage, FIXED_NOW);
    expect(result.corrupt).toBe(false);
    expect(result.storageUnavailable).toBe(false);
    expect(result.state).toEqual(defaultState(FIXED_NOW));
  });

  it('loads and validates a valid stored value', () => {
    const storage = makeStorage();
    const state = validState();
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    const result = loadState(storage, FIXED_NOW);
    expect(result.corrupt).toBe(false);
    expect(result.state).toEqual(state);
  });

  it('backs up non-JSON corrupt data and returns a fresh default with a notice', () => {
    const storage = makeStorage();
    storage.setItem(STORAGE_KEY, 'this is not json {');
    const result = loadState(storage, FIXED_NOW);

    expect(result.corrupt).toBe(true);
    expect(result.state).toEqual(defaultState(FIXED_NOW));
    expect(result.backupKey).toMatch(/^firstmenu:backup-\d+$/);
    expect(storage.getItem(result.backupKey!)).toBe('this is not json {');
  });

  it('backs up JSON that fails zod (bad birthDate) and returns a default', () => {
    const storage = makeStorage();
    const bad = { ...validState(), child: { birthDate: '' } };
    const raw = JSON.stringify(bad);
    storage.setItem(STORAGE_KEY, raw);

    const result = loadState(storage, FIXED_NOW);
    expect(result.corrupt).toBe(true);
    expect(result.state).toEqual(defaultState(FIXED_NOW));
    expect(result.backupKey).toBeDefined();
    expect(storage.getItem(result.backupKey!)).toBe(raw);
  });

  it('treats missing required fields as corrupt', () => {
    const storage = makeStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1 }));
    const result = loadState(storage, FIXED_NOW);
    expect(result.corrupt).toBe(true);
  });

  it('reports storageUnavailable without crashing when access throws', () => {
    const storage = makeStorage({ throwOnGet: true });
    const result = loadState(storage, FIXED_NOW);
    expect(result.storageUnavailable).toBe(true);
    expect(result.corrupt).toBe(false);
    expect(result.state).toEqual(defaultState(FIXED_NOW));
  });
});

describe('isStorageAvailable', () => {
  it('is true for a working Storage', () => {
    expect(isStorageAvailable(makeStorage())).toBe(true);
  });

  it('is false when setItem throws', () => {
    expect(isStorageAvailable(makeStorage({ throwOnSet: true }))).toBe(false);
  });
});

describe('saveState', () => {
  it('writes the serialized state under STORAGE_KEY', () => {
    const storage = makeStorage();
    const state = validState();
    expect(saveState(state, storage)).toBe(true);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(state);
  });

  it('reports failure without throwing when setItem throws (quota)', () => {
    const storage = makeStorage({ throwOnSet: true });
    expect(() => saveState(validState(), storage)).not.toThrow();
    expect(saveState(validState(), storage)).toBe(false);
  });
});

describe('createDebouncedSaver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid calls into a single setItem after the delay', () => {
    const storage = makeStorage();
    const spy = vi.spyOn(storage, 'setItem');
    const save = createDebouncedSaver({ storage });

    const a = validState();
    const b = { ...validState(), groceryChecked: ['eggs'] };
    save(a);
    save(a);
    save(b);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(spy).toHaveBeenCalledTimes(1);
    // The LAST state wins.
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(b);
  });

  it('does not save before the delay elapses', () => {
    const storage = makeStorage();
    const spy = vi.spyOn(storage, 'setItem');
    const save = createDebouncedSaver({ storage, delayMs: 300 });
    save(validState());
    vi.advanceTimersByTime(299);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('reports the save result via onResult (failure on quota)', () => {
    const storage = makeStorage({ throwOnSet: true });
    const onResult = vi.fn();
    const save = createDebouncedSaver({ storage, onResult });
    save(validState());
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it('cancel() discards a pending save', () => {
    const storage = makeStorage();
    const spy = vi.spyOn(storage, 'setItem');
    const save = createDebouncedSaver({ storage });
    save(validState());
    save.cancel();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(spy).not.toHaveBeenCalled();
  });

  it('flush() writes the pending state immediately', () => {
    const storage = makeStorage();
    const spy = vi.spyOn(storage, 'setItem');
    const save = createDebouncedSaver({ storage });
    save(validState());
    save.flush();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('exportState / importState (Req 12.5)', () => {
  it('exportState produces a dated filename and valid AppState JSON', () => {
    const state = validState();
    const { filename, json } = exportState(state, FIXED_NOW);

    expect(filename).toBe('firstmenu-backup-2026-01-15.json');
    // The JSON parses back to the same AppState.
    expect(JSON.parse(json)).toEqual(state);
    // And is itself accepted by the schema.
    expect(appStateSchema.safeParse(JSON.parse(json)).success).toBe(true);
  });

  it('exportState does not use DOM/Blob — it only returns strings', () => {
    const { filename, json } = exportState(validState(), FIXED_NOW);
    expect(typeof filename).toBe('string');
    expect(typeof json).toBe('string');
  });

  it('round-trips export -> import to an equal AppState', () => {
    const state = validState();
    const { json } = exportState(state, FIXED_NOW);
    const result = importState(json);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toEqual(state);
    }
  });

  it('imports a valid file to ok:true with the parsed AppState', () => {
    const state = validState();
    const result = importState(JSON.stringify(state));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toEqual(state);
    }
  });

  it('rejects non-JSON text with ok:false and a reason', () => {
    const result = importState('this is not json {');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/json/i);
    }
  });

  it('rejects JSON missing required fields with ok:false and a reason', () => {
    const result = importState(JSON.stringify({ schemaVersion: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it('rejects a bad enum value with ok:false and a reason', () => {
    const bad = { ...validState(), plan: { ...validState().plan, activeSlots: ['brunch'] } };
    const result = importState(JSON.stringify(bad));
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed/empty birthDate with ok:false and a reason', () => {
    const emptyBirth = { ...validState(), child: { name: 'Baby', birthDate: '' } };
    const malformedBirth = {
      ...validState(),
      child: { name: 'Baby', birthDate: '2026-13-40' },
    };

    const emptyResult = importState(JSON.stringify(emptyBirth));
    const malformedResult = importState(JSON.stringify(malformedBirth));

    expect(emptyResult.ok).toBe(false);
    expect(malformedResult.ok).toBe(false);
  });

  it('importState never writes to storage (pure)', () => {
    const storage = makeStorage();
    const spy = vi.spyOn(storage, 'setItem');
    importState('not json');
    importState(JSON.stringify(validState()));
    expect(spy).not.toHaveBeenCalled();
  });
});
