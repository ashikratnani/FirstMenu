import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
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
  afterEach(() => {
    vi.useRealTimers();
  });

  it('prefills name and birth date from state', () => {
    renderSettings(onboardedState('2026-01-15'));
    expect((screen.getByLabelText(/first name/i) as HTMLInputElement).value).toBe(
      'Baby',
    );
    // Astryx DateInput shows the date in words and keeps ISO in state.
    expect((screen.getByLabelText(/birth date/i) as HTMLInputElement).value).toBe(
      'January 15, 2026',
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

    // A reaction renders as a disabled, checked control (not an editable
    // checkbox); leaving it and saving must preserve the reaction untouched.
    const peanut = screen.getByLabelText(/peanut/i) as HTMLInputElement;
    // Astryx keeps disabled controls focusable and marks them aria-disabled.
    expect(peanut).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(captured!.foods[allergenFoodKey('peanut')]).toEqual({
      status: 'reaction',
      date: '2026-09-01',
      note: 'rash',
    });
  });

  it('rejects a future birth date, so it can never be saved', async () => {
    const user = userEvent.setup();
    renderSettings(onboardedState('2026-01-15'));
    const input = screen.getByLabelText(/birth date/i) as HTMLInputElement;
    const tomorrow = new Date(`${todayYmd()}T12:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const future = tomorrow.toISOString().slice(0, 10);

    fireEvent.change(input, { target: { value: future } });
    await user.click(screen.getByRole('button', { name: /save/i }));

    // The saved birth date is never the future date.
    expect(captured?.child?.birthDate).not.toBe(future);
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

  it('computes the age notice from plan.startDate, not today (Req 1.2)', () => {
    // The clock is faked so "today" and plan.startDate land on OPPOSITE sides
    // of the under-6 boundary, which is the only way this test can actually
    // tell the two apart:
    //   birthDate      = 2026-07-01
    //   plan.startDate = 2026-11-01 (see onboardedState) -> 4 whole months
    //                    -> under 6, UNDER_6_NOTICE
    //   today (faked)  = 2027-06-01                       -> 11 whole months
    //                    -> NOT under 6, no notice
    // If the notice (and "Current age") were computed from today it would be
    // 11 months and show no under-6 notice; computing from plan.startDate it
    // is 4 months and shows UNDER_6_NOTICE. Asserting UNDER_6_NOTICE therefore
    // fails if the code regressed to using today instead of plan.startDate.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 5, 1)); // 2027-06-01 local

    const seed = onboardedState('2026-07-01');
    renderSettings(seed);

    // Current age is computed from plan.startDate -> 4 months (under 6), not
    // the 11 months "today" would give.
    expect(screen.getByText(/current age: 4 months/i)).toBeInTheDocument();
    expect(screen.queryByText(/current age: 11 months/i)).not.toBeInTheDocument();
    // And the notice agrees with that start-date age, NOT today's age.
    expect(screen.getByText(UNDER_6_NOTICE)).toBeInTheDocument();
    expect(screen.queryByText(OVER_12_NOTICE)).not.toBeInTheDocument();
  });

  it('shows a reaction food as disabled with a "reaction recorded" note and does not clear it on save', async () => {
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

    // The reaction food renders disabled (not a plain unchecked checkbox) and
    // carries a visible "reaction recorded" indication.
    const peanut = screen.getByLabelText(/peanut/i) as HTMLInputElement;
    // Astryx keeps disabled controls focusable and marks them aria-disabled.
    expect(peanut).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/reaction recorded/i)).toBeInTheDocument();

    // Saving leaves the reaction record exactly as-is (never claims a change).
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(captured!.foods[allergenFoodKey('peanut')]).toEqual({
      status: 'reaction',
      date: '2026-09-01',
      note: 'rash',
    });
  });
});
