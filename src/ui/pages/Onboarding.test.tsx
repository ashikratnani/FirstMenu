import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import Onboarding from './Onboarding';
import {
  ALLERGEN_GROUPS,
  allergenFoodKey,
  todayYmd,
  UNDER_6_NOTICE,
  OVER_36_NOTICE,
} from './childProfile';
import { AppProvider, useApp } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState } from '../../domain/types';

/** An in-memory Storage so tests never touch real localStorage. */
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

/** Capture the latest app state for assertions after interactions. */
let captured: AppState | null = null;
function StateProbe() {
  captured = useApp().state;
  return null;
}

/** A target page so we can assert navigation to '/' after completing. */
function HomeStub() {
  return <h1>Home stub</h1>;
}

function renderOnboarding(seed?: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={['/onboarding']}>
        <StateProbe />
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<HomeStub />} />
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
}

/** A birth date string `months` whole months before today (local time). */
function birthDateMonthsAgo(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('Onboarding', () => {
  beforeEach(() => {
    captured = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a required birth date input and an optional name input', () => {
    renderOnboarding();
    const birth = screen.getByLabelText(/birth date/i) as HTMLInputElement;
    expect(birth).toBeRequired();
    expect(birth.type).toBe('date');
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
  });

  it('caps the birth-date input at today so a future date cannot be picked', () => {
    renderOnboarding();
    const birth = screen.getByLabelText(/birth date/i) as HTMLInputElement;
    expect(birth.max).toBe(todayYmd());
  });

  it('shows the under-6 notice for a birth date under 6 months', () => {
    renderOnboarding();
    const birth = screen.getByLabelText(/birth date/i);
    fireEvent.change(birth, { target: { value: birthDateMonthsAgo(3) } });
    expect(screen.getByText(UNDER_6_NOTICE)).toBeInTheDocument();
    expect(screen.queryByText(OVER_36_NOTICE)).not.toBeInTheDocument();
  });

  it('shows the over-36 notice for a birth date more than 36 months ago', () => {
    renderOnboarding();
    const birth = screen.getByLabelText(/birth date/i);
    fireEvent.change(birth, { target: { value: birthDateMonthsAgo(40) } });
    expect(screen.getByText(OVER_36_NOTICE)).toBeInTheDocument();
    expect(screen.queryByText(UNDER_6_NOTICE)).not.toBeInTheDocument();
  });

  it('computes the age notice from plan.startDate, not today (Req 1.2)', () => {
    // The clock is faked so the entered birth date gives DIFFERENT whole-month
    // ages when measured from today vs. from plan.startDate, landing on
    // opposite sides of the under-6 boundary. This is the only setup that can
    // tell the two apart:
    //   seeded plan.startDate = 2026-11-01
    //   entered birthDate     = 2026-07-01 -> 4 whole months on 2026-11-01
    //                           -> under 6, UNDER_6_NOTICE
    //   today (faked)         = 2027-06-01 -> 11 whole months
    //                           -> NOT under 6, no notice
    // Onboarding computes the live notice as
    // ageMonthsForBirthDate(birthDate, state.plan.startDate), so it must show
    // UNDER_6_NOTICE. If it regressed to measuring against today the age would
    // be 11 months and no under-6 notice would appear, failing this test.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 5, 1)); // 2027-06-01 local

    // Seed state so plan.startDate is a fixed 2026-11-01 (not the faked today).
    const seed: AppState = (() => {
      const s = defaultState(new Date(2026, 10, 1));
      return { ...s, plan: { ...s.plan, startDate: '2026-11-01' } };
    })();
    renderOnboarding(seed);

    fireEvent.change(screen.getByLabelText(/birth date/i), {
      target: { value: '2026-07-01' },
    });

    // The notice follows the plan.startDate age (4 months, under 6), NOT the
    // 11-month age "today" would give.
    expect(screen.getByText(UNDER_6_NOTICE)).toBeInTheDocument();
    expect(screen.queryByText(OVER_36_NOTICE)).not.toBeInTheDocument();
  });

  it('lists the nine allergen groups first, in rule order', () => {
    renderOnboarding();
    const allergenList = screen
      .getByText(/common allergens/i)
      .parentElement!.querySelector('ul')!;
    const labels = within(allergenList)
      .getAllByText(/.+/)
      .filter((el) => el.tagName === 'LABEL')
      .map((el) => el.textContent);
    expect(labels).toEqual(ALLERGEN_GROUPS);
    expect(ALLERGEN_GROUPS).toHaveLength(9);
  });

  it('sets the child + onboarded and writes tried records under allergen keys', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.type(screen.getByLabelText(/first name/i), 'Ada');
    fireEvent.change(screen.getByLabelText(/birth date/i), {
      target: { value: birthDateMonthsAgo(8) },
    });

    // Check the peanut allergen and leave others unchecked.
    const peanutKey = allergenFoodKey('peanut');
    await user.click(screen.getByLabelText('peanut'));

    await user.click(screen.getByRole('button', { name: /start planning/i }));

    // Navigated to the home stub.
    expect(screen.getByText('Home stub')).toBeInTheDocument();

    expect(captured).not.toBeNull();
    expect(captured!.onboarded).toBe(true);
    expect(captured!.child?.name).toBe('Ada');
    expect(captured!.child?.birthDate).toBe(birthDateMonthsAgo(8));

    // The checked allergen is recorded as tried under `allergen:<group>`.
    expect(captured!.foods[peanutKey]).toMatchObject({ status: 'tried' });
    expect(captured!.foods[peanutKey]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // An unchecked allergen is not recorded.
    expect(captured!.foods[allergenFoodKey('egg')]).toBeUndefined();
  });

  it('omits the name when left blank', async () => {
    const user = userEvent.setup();
    renderOnboarding();
    fireEvent.change(screen.getByLabelText(/birth date/i), {
      target: { value: birthDateMonthsAgo(8) },
    });
    await user.click(screen.getByRole('button', { name: /start planning/i }));
    expect(captured!.child).toEqual({ birthDate: birthDateMonthsAgo(8) });
  });
});
