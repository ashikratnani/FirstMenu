import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../../state/AppProvider';
import Layout from './Layout';

// Render the shell with a trivial routed child so <Outlet/> has something to
// show. Uses an in-memory Storage so AppProvider does not touch real
// localStorage (matching the component-test pattern in App.test.tsx).
function renderShell(initialPath = '/') {
  const storage = (() => {
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
  })();

  return render(
    <AppProvider storage={storage}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<p>home content</p>} />
            <Route path="/recipes" element={<p>recipes content</p>} />
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
    expect(skip).toHaveAttribute('href', '#main');
  });

  it('renders a main landmark containing the routed page', () => {
    renderShell();
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(within(main).getByText(/home content/i)).toBeInTheDocument();
  });

  it('marks the active route with aria-current', () => {
    renderShell('/recipes');
    const nav = screen.getByRole('navigation', { name: /primary/i });
    const recipesLink = within(nav).getByRole('link', { name: /recipes/i });
    expect(recipesLink).toHaveAttribute('aria-current', 'page');
  });
});
