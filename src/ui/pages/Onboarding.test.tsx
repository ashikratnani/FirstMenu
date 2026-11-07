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
  OVER_12_NOTICE,
} from './childProfile';
import { AppProvider, useApp } from '../../state/AppProvider';
import type { AppState } from '../../domain/types';

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

function renderOnboarding() {
  return render(
    <AppProvider storage={makeStorage()}>
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
    expect(screen.queryByText(OVER_12_NOTICE)).not.toBeInTheDocument();
  });

  it('shows the 12+ notice for a birth date 12 months or more ago', () => {
    renderOnboarding();
    const birth = screen.getByLabelText(/birth date/i);
    fireEvent.change(birth, { target: { value: birthDateMonthsAgo(14) } });
    expect(screen.getByText(OVER_12_NOTICE)).toBeInTheDocument();
    expect(screen.queryByText(UNDER_6_NOTICE)).not.toBeInTheDocument();
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
