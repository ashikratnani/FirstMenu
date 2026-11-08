import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  HashRouter,
  MemoryRouter,
  Route,
  Routes,
} from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../../state/AppProvider';
import Layout from './Layout';

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

// Render the shell with a trivial routed child so <Outlet/> has something to
// show. Uses an in-memory Storage so AppProvider does not touch real
// localStorage (matching the component-test pattern in App.test.tsx).
function renderShell(initialPath = '/') {
  const storage = makeStorage();

  return render(
    <AppProvider storage={storage}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<p>home content</p>} />
            <Route path="/recipes" element={<p>recipes content</p>} />
            <Route path="/recipes/new" element={<p>editor content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
}

describe('Layout (app shell)', () => {
  it('renders a navigation landmark', () => {
    renderShell();
    expect(
      screen.getByRole('navigation', { name: /primary/i }),
    ).toBeInTheDocument();
  });

  it('renders the expected nav links pointing to the right routes', () => {
    renderShell();
    const nav = screen.getByRole('navigation', { name: /primary/i });
    const expected: Array<[RegExp, string]> = [
      [/week/i, '/'],
      [/recipes/i, '/recipes'],
      [/foods/i, '/foods'],
      [/prep/i, '/prep'],
      [/grocery/i, '/grocery'],
      [/share/i, '/share'],
      [/sources/i, '/sources'],
      [/settings/i, '/settings'],
    ];
    for (const [name, href] of expected) {
      const link = within(nav).getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
    }
  });

  it('renders a skip-to-content link targeting the main region', () => {
    renderShell();
    const skip = screen.getByRole('link', { name: /skip to content/i });
    const main = screen.getByRole('main');
    // Astryx AppShell owns the skip link and the main landmark; the link must
    // point at whatever id the main landmark has.
    expect(main.id).not.toBe('');
    expect(skip).toHaveAttribute('href', `#${main.id}`);
  });

  it('renders a main landmark containing the routed page', () => {
    renderShell();
    const main = screen.getByRole('main');
    expect(within(main).getByText(/home content/i)).toBeInTheDocument();
  });

  it('hides the "Add recipe" action on the recipe editor itself', () => {
    renderShell('/recipes/new');
    expect(
      screen.queryByRole('link', { name: 'Add recipe' }),
    ).not.toBeInTheDocument();
  });

  it('shows one primary "Add recipe" action linking to the recipe editor', () => {
    renderShell();
    const add = screen.getByRole('link', { name: 'Add recipe' });
    expect(add).toHaveAttribute('href', '/recipes/new');
  });

  it('marks the active route with aria-current', () => {
    renderShell('/recipes');
    const nav = screen.getByRole('navigation', { name: /primary/i });
    const recipesLink = within(nav).getByRole('link', { name: /recipes/i });
    expect(recipesLink).toHaveAttribute('aria-current', 'page');
  });

  // Regression test for the HashRouter skip-link bug: a plain href="#main"
  // under HashRouter is read as a route change to /main, which matches nothing
  // and blanks the page. The skip link must preventDefault and move focus to
  // <main> instead (Req 14.4), so the page content stays and focus lands on
  // the main region. Rendered under a REAL HashRouter (not MemoryRouter).
  it('skip link keeps the page content and focuses main under HashRouter', () => {
    render(
      <AppProvider storage={makeStorage()}>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<p>home content</p>} />
            </Route>
          </Routes>
        </HashRouter>
      </AppProvider>,
    );

    const skip = screen.getByRole('link', { name: /skip to content/i });
    fireEvent.click(skip);

    // The routed page content is still present (the page did not blank).
    expect(screen.getByText(/home content/i)).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: /primary/i }),
    ).toBeInTheDocument();

    // Focus moved to the main landmark.
    const main = screen.getByRole('main');
    expect(document.activeElement).toBe(main);
  });
});
