import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';
import { AppProvider } from './state/AppProvider';

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

function renderApp(initialPath = '/') {
  return render(
    <AppProvider storage={makeStorage()}>
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
});
