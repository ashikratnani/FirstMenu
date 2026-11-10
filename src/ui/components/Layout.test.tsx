import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  HashRouter,
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../../state/AppProvider';
import Layout from './Layout';
import { usePagePrimaryAction } from './primaryActionContext';

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
/** The shell's "Add recipe" button. The main nav also has an "Add recipe"
 * item with the same destination, so pick the one that is a Button. */
function addRecipeButton(): HTMLElement | undefined {
  return screen
    .queryAllByRole('link', { name: 'Add recipe' })
    .find((a) => a.hasAttribute('data-variant'));
}

/** A placeholder page that reports whether it shows its own primary button. */
function Page({ primary, label }: { primary: boolean; label: string }) {
  usePagePrimaryAction(primary);
  return <p>{label}</p>;
}

function renderShell(initialPath = '/') {
  const storage = makeStorage();

  return render(
    <AppProvider storage={storage}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<p>home content</p>} />
            <Route path="/plan" element={<p>plan content</p>} />
            <Route path="/prep" element={<p>prep content</p>} />
            <Route path="/recipes" element={<p>recipes content</p>} />
            {/* Placeholder pages report their own primary button the way the
                real Settings, Print, edit and Make pages do. */}
            <Route path="/settings" element={<Page primary label="settings content" />} />
            <Route path="/print" element={<Page primary label="print content" />} />
            <Route path="/recipes/:id/edit" element={<Page primary label="edit content" />} />
            <Route path="/recipes/new" element={<Page primary label="editor content" />} />
            <Route path="/add" element={<Page primary label="add content" />} />
            <Route path="/onboarding" element={<Page primary label="onboarding content" />} />
            <Route path="/quiet" element={<Page primary={false} label="quiet content" />} />
            <Route path="*" element={<p>other content</p>} />
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
      [/^make$/i, '/'],
      [/^my recipes$/i, '/recipes'],
      [/^add recipe$/i, '/add'],
      [/^foods$/i, '/foods'],
      [/^plan$/i, '/plan'],
      [/^sources$/i, '/sources'],
      [/^settings$/i, '/settings'],
    ];
    for (const [name, href] of expected) {
      const links = within(nav).getAllByRole('link', { name });
      expect(links[0]).toHaveAttribute('href', href);
    }
  });

  it('lists the main navigation in the required order (Req 1.2)', () => {
    renderShell();
    const nav = screen.getByRole('navigation', { name: /primary/i });
    const labels = within(nav)
      .getAllByRole('link')
      .map((a) => a.textContent?.trim())
      // The shell's own "FirstMenu" heading link is not a nav item.
      .filter((t) => t !== 'FirstMenu');
    expect(labels.slice(0, 7)).toEqual([
      'Make',
      'My recipes',
      'Add recipe',
      'Foods',
      'Plan',
      'Sources',
      'Settings',
    ]);
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

  it.each(['/recipes/new', '/add', '/onboarding'])(
    'hides the "Add recipe" action on %s, even though the page has its own primary button',
    (path) => {
      renderShell(path);
      expect(addRecipeButton()).toBeUndefined();
    },
  );

  it.each(['/settings', '/print', '/recipes/r1/edit'])(
    'shows "Add recipe" as secondary on %s because the page reports its own primary button',
    (path) => {
      renderShell(path);
      expect(addRecipeButton()).toHaveAttribute('data-variant', 'secondary');
    },
  );

  it.each(['/plan', '/quiet'])(
    'shows "Add recipe" as the primary button on %s, where the page reports none',
    (path) => {
      renderShell(path);
      expect(addRecipeButton()).toHaveAttribute('data-variant', 'primary');
    },
  );

  it('follows the page: primary again once the page stops reporting its own', () => {
    function Toggle() {
      const [own, setOwn] = useState(true);
      usePagePrimaryAction(own);
      return (
        <button type="button" onClick={() => setOwn(false)}>
          drop my primary
        </button>
      );
    }
    render(
      <AppProvider storage={makeStorage()}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Toggle />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppProvider>,
    );
    expect(addRecipeButton()).toHaveAttribute('data-variant', 'secondary');
    fireEvent.click(screen.getByRole('button', { name: 'drop my primary' }));
    expect(addRecipeButton()).toHaveAttribute('data-variant', 'primary');
  });

  it('is primary again after leaving a page that had its own primary button', () => {
    function Go() {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => navigate('/plan')}>
          go to plan
        </button>
      );
    }
    render(
      <AppProvider storage={makeStorage()}>
        <MemoryRouter initialEntries={['/settings']}>
          <Routes>
            <Route element={<Layout />}>
              <Route
                path="/settings"
                element={
                  <>
                    <Page primary label="settings content" />
                    <Go />
                  </>
                }
              />
              <Route path="/plan" element={<p>plan content</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppProvider>,
    );
    expect(addRecipeButton()).toHaveAttribute('data-variant', 'secondary');
    fireEvent.click(screen.getByRole('button', { name: 'go to plan' }));
    expect(screen.getByText('plan content')).toBeInTheDocument();
    expect(addRecipeButton()).toHaveAttribute('data-variant', 'primary');
  });

  it('a page rendered without the shell can report a primary action safely', () => {
    render(<Page primary label="alone" />);
    expect(screen.getByText('alone')).toBeInTheDocument();
  });

  it('shows one primary "Add recipe" action linking to the Add recipe page', () => {
    renderShell();
    expect(addRecipeButton()).toHaveAttribute('href', '/add');
  });

  it('marks the active route with aria-current', () => {
    renderShell('/recipes');
    const nav = screen.getByRole('navigation', { name: /primary/i });
    const recipesLink = within(nav).getByRole('link', { name: 'My recipes' });
    expect(recipesLink).toHaveAttribute('aria-current', 'page');
  });

  it('marks Plan as current on every Plan route, and shows its sub-nav', () => {
    for (const path of ['/plan', '/prep', '/grocery', '/share', '/print']) {
      const { unmount } = renderShell(path);
      const nav = screen.getByRole('navigation', { name: /primary/i });
      expect(within(nav).getByRole('link', { name: 'Plan' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(
        screen.getByRole('navigation', { name: 'Plan' }),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it('marks Add recipe (not My recipes) as current on the typed editor', () => {
    renderShell('/recipes/new');
    const nav = screen.getByRole('navigation', { name: /primary/i });
    expect(
      within(nav).getByRole('link', { name: 'My recipes' }),
    ).not.toHaveAttribute('aria-current');
    expect(
      within(nav).getAllByRole('link', { name: 'Add recipe' })[0],
    ).toHaveAttribute('aria-current', 'page');
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
