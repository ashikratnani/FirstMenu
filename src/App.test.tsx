import { render, screen, within } from '@testing-library/react';
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
  it('renders the Make screen at / (the week plan moved to /plan)', () => {
    renderApp();
    expect(
      screen.getByRole('heading', { name: /what can i make/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /this week/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the week grid at /plan with the Plan sub-navigation', () => {
    renderApp('/plan');
    expect(
      screen.getByRole('heading', { name: /this week/i }),
    ).toBeInTheDocument();
    const sub = screen.getByRole('navigation', { name: 'Plan' });
    const expected = [
      ['Week', '/plan'],
      ['Prep', '/prep'],
      ['Grocery', '/grocery'],
      ['Share', '/share'],
      ['Print', '/print'],
    ];
    const links = within(sub).getAllByRole('link');
    expect(links).toHaveLength(expected.length);
    expected.forEach(([name, href], i) => {
      expect(links[i]).toHaveAccessibleName(name);
      expect(links[i]).toHaveAttribute('href', href);
    });
    // Astryx Tab marks the current link with aria-current="true".
    expect(within(sub).getByRole('link', { name: 'Week' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  // Requirement 1.4: old links keep working, and each shows the sub-nav with
  // its own item current.
  it.each([
    ['/prep', 'Prep', /^prep$/i],
    ['/grocery', 'Grocery', /^grocery$/i],
    ['/share', 'Share', /^share$/i],
    ['/print', 'Print', /^print your week$/i],
  ])('keeps %s working under the Plan sub-navigation', (path, label, h1) => {
    renderApp(path);
    expect(screen.getByRole('heading', { level: 1, name: h1 })).toBeInTheDocument();
    const sub = screen.getByRole('navigation', { name: 'Plan' });
    expect(within(sub).getByRole('link', { name: label })).toHaveAttribute(
      'aria-current',
      'true',
    );
    // The main nav marks Plan as current too.
    const main = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(main).getByRole('link', { name: 'Plan' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('does not show the Plan sub-navigation on other pages', () => {
    renderApp('/recipes');
    expect(
      screen.queryByRole('navigation', { name: 'Plan' }),
    ).not.toBeInTheDocument();
  });

  it('opens the typed editor from /add until the Add recipe page exists', () => {
    renderApp('/add');
    expect(
      screen.getByRole('heading', { name: /^new recipe$/i }),
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
    renderApp('/plan');
    expect(
      screen.getByRole('heading', { name: /this week/i }),
    ).toBeInTheDocument();
  });

  it('lets an un-onboarded user open a /shared/* link (gate exemption)', () => {
    // A fresh (un-onboarded) storage: a /shared/... route must stay reachable
    // so a share link opens without a local profile (Task 7.1 gate exemption).
    render(
      <AppProvider storage={makeStorage()}>
        <MemoryRouter initialEntries={['/shared/some-encoded-data']}>
          <App />
        </MemoryRouter>
      </AppProvider>,
    );
    // 'some-encoded-data' is not a valid link, so the shared view renders its
    // "can't be read" error (Req 11.5) — but it DID render, proving the gate
    // did NOT redirect this un-onboarded user to /onboarding.
    expect(screen.getByText(/can.?t be read/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/welcome to firstmenu/i),
    ).not.toBeInTheDocument();
  });

  it('redirects an un-onboarded user on a normal route to /onboarding', () => {
    // Contrast with the /shared/* exemption: a normal route DOES redirect.
    render(
      <AppProvider storage={makeStorage()}>
        <MemoryRouter initialEntries={['/recipes']}>
          <App />
        </MemoryRouter>
      </AppProvider>,
    );
    expect(
      screen.getByRole('heading', { name: /welcome to firstmenu/i }),
    ).toBeInTheDocument();
  });
});
