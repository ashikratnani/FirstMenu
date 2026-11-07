import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';
import { AppProvider } from './state/AppProvider';
import { STORAGE_KEY, defaultState } from './domain/storage';
import type { AppState } from './domain/types';

// Trivial smoke test proving the Vitest + React Testing Library harness works
// and that HashRouter-style routing renders the Home route (Task 1 deliverable).
// The shell now reads context (useApp), so App is rendered inside an
// AppProvider with an in-memory Storage, mirroring the real root composition.

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

/** An in-memory Storage already seeded with an onboarded profile, so the
 * onboarding gate (Task 7.1) lets normal routes render. */
function makeOnboardedStorage(): Storage {
  const storage = makeStorage();
  const seeded: AppState = {
    ...defaultState(),
    onboarded: true,
    child: { name: 'Baby', birthDate: '2026-01-15' },
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return storage;
}

function renderApp(initialPath = '/') {
  return render(
    <AppProvider storage={makeOnboardedStorage()}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </AppProvider>,
  );
}

describe('App', () => {
  it('renders the home page heading', () => {
    renderApp();
    // Home renders the week grid under the heading "This week"; the shared
    // header's "FirstMenu" h1 is a different heading, so target Home's own.
    expect(
      screen.getByRole('heading', { name: /this week/i }),
    ).toBeInTheDocument();
  });

  it('shows the not-medical-advice disclaimer', () => {
    renderApp();
    // The footer disclaimer renders on every page (Req 13.1).
    expect(
      screen.getAllByText(/not medical advice/i).length,
    ).toBeGreaterThan(0);
  });

  it('routes an un-onboarded user to onboarding (Task 7.1 gate)', () => {
    // A fresh (un-onboarded) storage: the gate redirects '/' to /onboarding.
    render(
      <AppProvider storage={makeStorage()}>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </AppProvider>,
    );
    expect(
      screen.getByRole('heading', { name: /welcome to firstmenu/i }),
    ).toBeInTheDocument();
    // The week home heading is NOT shown while un-onboarded.
    expect(
      screen.queryByRole('heading', { name: /this week/i }),
    ).not.toBeInTheDocument();
  });

  it('renders normal routes once onboarded', () => {
    renderApp();
    expect(
      screen.getByRole('heading', { name: /this week/i }),
    ).toBeInTheDocument();
  });
});
