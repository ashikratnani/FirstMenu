import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach } from 'vitest';
import Settings from './Settings';
import {
  ALLERGEN_GROUPS,
  allergenFoodKey,
  todayYmd,
  UNDER_6_NOTICE,
  OVER_12_NOTICE,
} from './childProfile';
import { AppProvider, useApp } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState } from '../../domain/types';

/** An in-memory Storage seeded with the given state. */
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

let captured: AppState | null = null;
function StateProbe() {
  captured = useApp().state;
  return null;
}

/** An onboarded state whose plan.startDate is fixed so derived age is stable. */
function onboardedState(birthDate: string): AppState {
  const s = defaultState(new Date(2026, 10, 1));
  return {
    ...s,
    onboarded: true,
    child: { name: 'Baby', birthDate },
    plan: { ...s.plan, startDate: '2026-11-01' },
  };
}

function renderSettings(seed: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={['/settings']}>
        <StateProbe />
        <Settings />
      </MemoryRouter>
    </AppProvider>,
  );
}

describe('Settings', () => {
  beforeEach(() => {
    captured = null;
  });

  it('prefills name and birth date from state', () => {
    renderSettings(onboardedState('2026-01-15'));
    expect((screen.getByLabelText(/first name/i) as HTMLInputElement).value).toBe(
      'Baby',
    );
    expect((screen.getByLabelText(/birth date/i) as HTMLInputElement).value).toBe(
      '2026-01-15',
    );
  });

  it('shows the current derived age/stage (Req 1.6)', () => {
    // Born 2026-01-15, plan start 2026-11-01 -> 9 whole months, stage 9-12.
    renderSettings(onboardedState('2026-01-15'));
    expect(screen.getByText(/current age: 9 months/i)).toBeInTheDocument();
    expect(screen.getByText(/stage 9-12/i)).toBeInTheDocument();
  });

  it('updates the derived age after saving a new birth date (Req 1.6)', async () => {
    const user = userEvent.setup();
    renderSettings(onboardedState('2026-01-15'));

    // Edit to born 2026-08-01 -> 3 months on 2026-11-01 (under 6).
    fireEvent.change(screen.getByLabelText(/birth date/i), {
      target: { value: '2026-08-01' },
    });
    // The under-6 notice tracks the edited value immediately.
    expect(screen.getByText(UNDER_6_NOTICE)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save/i }));

    // Persisted child changed, so derived age re-computes to 3 months.
    expect(captured!.child?.birthDate).toBe('2026-08-01');
    expect(screen.getByText(/current age: 3 months/i)).toBeInTheDocument();
  });

  it('reflects already-tried allergens and records newly checked ones', async () => {
    const user = userEvent.setup();
    const seed = onboardedState('2026-01-15');
    seed.foods = {
      [allergenFoodKey('egg')]: { status: 'tried', date: '2026-10-01' },
    };
    renderSettings(seed);

    // Egg prefilled as checked; peanut not.
    expect((screen.getByLabelText('egg') as HTMLInputElement).checked).toBe(true);
    const peanut = screen.getByLabelText('peanut') as HTMLInputElement;
    expect(peanut.checked).toBe(false);

    await user.click(peanut);
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(captured!.foods[allergenFoodKey('peanut')]).toMatchObject({
      status: 'tried',
    });
    // The pre-existing egg record is preserved (date unchanged).
    expect(captured!.foods[allergenFoodKey('egg')]?.date).toBe('2026-10-01');
  });

  it('unchecking a previously-tried food removes its record on save', async () => {
    const user = userEvent.setup();
    const seed = onboardedState('2026-01-15');
    seed.foods = {
      [allergenFoodKey('egg')]: { status: 'tried', date: '2026-10-01' },
    };
    renderSettings(seed);

    const egg = screen.getByLabelText('egg') as HTMLInputElement;
    expect(egg.checked).toBe(true);

    await user.click(egg); // uncheck
    expect(egg.checked).toBe(false);
    await user.click(screen.getByRole('button', { name: /save/i }));

    // The tried record is cleared, so the checkbox's undo affordance is honored.
    expect(captured!.foods[allergenFoodKey('egg')]).toBeUndefined();
  });

  it('a logged reaction is never cleared by saving Settings', async () => {
    const user = userEvent.setup();
    const seed = onboardedState('2026-01-15');
    seed.foods = {
      [allergenFoodKey('peanut')]: {
        status: 'reaction',
        date: '2026-09-01',
        note: 'rash',
      },
    };
    renderSettings(seed);

    // A reaction prefills unchecked (it is not "tried"); leaving it and saving
    // must preserve the reaction untouched.
    const peanut = screen.getByLabelText('peanut') as HTMLInputElement;
    expect(peanut.checked).toBe(false);

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(captured!.foods[allergenFoodKey('peanut')]).toEqual({
      status: 'reaction',
      date: '2026-09-01',
      note: 'rash',
    });
  });

  it('caps the birth-date input at today so a future date cannot be picked', () => {
    renderSettings(onboardedState('2026-01-15'));
    const input = screen.getByLabelText(/birth date/i) as HTMLInputElement;
    expect(input.max).toBe(todayYmd());
  });

  it('lists the nine allergen groups', () => {
    renderSettings(onboardedState('2026-01-15'));
    for (const group of ALLERGEN_GROUPS) {
      expect(screen.getByLabelText(group)).toBeInTheDocument();
    }
    expect(ALLERGEN_GROUPS).toHaveLength(9);
  });

  it('shows the 12+ notice for an old enough edited birth date', () => {
    renderSettings(onboardedState('2026-01-15'));
    fireEvent.change(screen.getByLabelText(/birth date/i), {
      target: { value: '2024-01-01' },
    });
    expect(screen.getByText(OVER_12_NOTICE)).toBeInTheDocument();
  });
});
