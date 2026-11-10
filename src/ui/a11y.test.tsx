// Accessibility pass (Task 16.1, Req 14.3/14.4/14.6/15.3). This file runs
// vitest-axe over every main page with meaningful seeded state and adds
// keyboard-affordance tests for the app shell (skip link, primary nav,
// reachable controls). It is the AUTOMATABLE portion of Task 16; the manual
// iOS-Safari + VoiceOver device pass and a real-device 360px pixel check are a
// remaining maintainer action (jsdom cannot drive a real browser or measure
// layout), noted in tasks.md.
//
// axe is run with color-contrast DISABLED: axe-core's color-contrast check
// relies on real layout/paint and its ligature/text handling throws in jsdom.
// The theme's AA contrast is instead documented and reviewed in theme.css. All
// other rules (names, roles, landmarks, heading order, duplicate ids, aria
// validity) run normally, and those are what we can meaningfully assert here.
//
// Pages behind the OnboardingGate are rendered through the full <App/> shell so
// the real landmarks (header/nav/<main>/footer), skip link and single routed
// page markup are exercised exactly as shipped. SharedView renders on its own
// from an encoded fragment with NO AppProvider (Req 11.4), matching App.tsx.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
// vitest-axe's /matchers subpath re-exports `toHaveNoViolations` through an
// aliased chunk .d.ts, which TS (under `isolatedModules` + bundler resolution)
// cannot see as a value: a named import trips a false TS1362 and the
// namespace type omits the property. Import it as a namespace and read the
// real runtime function through a locally-typed view of the module.
import * as axeMatchers from 'vitest-axe/matchers';

type AxeMatcherFn = (results: unknown) => {
  pass: boolean;
  message: () => string;
};
type AxeMatchersModule = { toHaveNoViolations: AxeMatcherFn };
const { toHaveNoViolations } =
  axeMatchers as unknown as AxeMatchersModule;

import App from '../App';
import SharedView from './pages/SharedView';
import { AppProvider } from '../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../domain/storage';
import { encodeSharePayload } from '../domain/share';
import type { AppState, Recipe } from '../domain/types';

expect.extend({ toHaveNoViolations });

// Augment Vitest's matcher types so `expect(results).toHaveNoViolations()`
// type-checks under `tsc -b`. vitest-axe only ships this global augmentation
// in its 'extend-expect' entry (whose runtime auto-register does not work in
// this environment), so we declare it here alongside the runtime extend above.
// The type-param shape must mirror Vitest's own `Assertion<T = any>`.
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): unknown;
  }
}

/**
 * Two axe rules cannot be evaluated in jsdom and are disabled:
 *  - 'color-contrast' relies on real paint/layout; axe-core's text handling
 *    throws in jsdom. The theme's AA contrast is documented + reviewed in
 *    theme.css instead.
 *  - 'label-content-name-mismatch' detects icon ligatures via a <canvas> 2D
 *    context, which jsdom does not implement (HTMLCanvasElement.getContext),
 *    so the rule cannot run and only emits noise. Our controls use plain text
 *    labels (no icon fonts), so this rule has nothing to catch here anyway.
 * Every other rule (names, roles, landmarks, heading order, duplicate ids,
 * aria validity) runs normally, and those are what we can meaningfully assert.
 */
const AXE_OPTIONS = {
  rules: {
    'color-contrast': { enabled: false },
    'label-content-name-mismatch': { enabled: false },
  },
} as const;

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

/** A birth date string `months` whole months before today (local time). */
function birthDateMonthsAgo(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const BUILTIN_RECIPE_ID = 'b-carrots-and-apples';

/** A custom recipe so the recipe library, foods, prep and grocery are all
 *  non-empty where relevant. Peas fire no safety reminders at 8 months. */
function peaRecipe(): Recipe {
  return {
    id: 'custom-sweet-pea-mash',
    origin: 'custom',
    title: 'Sweet Pea Mash',
    stages: ['6-8', '9-12'],
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { name: 'peas', quantity: 1, unit: 'cup', category: 'produce' },
      { name: 'water', quantity: 0.25, unit: 'cup', category: 'other' },
    ],
    steps: ['Steam the peas until soft.', 'Mash with a little water.'],
    texture: 'smooth puree',
    servings: 4,
    storage: { fridgeDays: 3 },
  };
}

/**
 * A seeded onboarded state with a planned built-in recipe and a planned custom
 * recipe so every page has real content: the week grid has filled slots, the
 * recipe library lists a custom recipe, Foods shows tried foods, Prep has a
 * cook session and Grocery has merged lines.
 */
function seededState(overrides: Partial<AppState> = {}): AppState {
  const base = defaultState(new Date());
  const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
  days[0] = { lunch: BUILTIN_RECIPE_ID };
  days[2] = { dinner: 'custom-sweet-pea-mash' };

  return {
    ...base,
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(8) },
    onboarded: true,
    customRecipes: [peaRecipe()],
    foods: {
      'allergen:egg': { status: 'tried', date: birthDateMonthsAgo(1) },
      pea: { status: 'tried', date: birthDateMonthsAgo(1) },
    },
    plan: {
      ...base.plan,
      startDate: '2026-01-15',
      prepDate: '2026-01-14',
      activeSlots: ['breakfast', 'lunch', 'dinner', 'snack'],
      days,
    },
    disclaimerAcknowledged: true,
    ...overrides,
  };
}

/** Render the full app shell at `path` with the given seed. Using <App/> gives
 *  the real header/nav/<main>/footer landmarks + skip link for every page. */
function renderApp(path: string, seed: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AppProvider>,
  );
}

describe('Accessibility: axe on every main page (color-contrast disabled)', () => {
  // Each entry is [label, path, heading]; all render through the shell with the
  // same onboarded seed so the OnboardingGate lets the page render. `heading`
  // is the page's real, unique level-1 heading text (the exact h1 each page
  // component renders). It is asserted BEFORE axe so a gate redirect or broken
  // route can't let axe silently pass on the wrong page's markup — axe only
  // runs once the intended page has actually rendered.
  const pages: ReadonlyArray<[string, string, RegExp]> = [
    ['Make', '/', /^what can i make\?$/i],
    ['Plan (week)', '/plan', /^this week$/i],
    ['Recipes', '/recipes', /^recipes$/i],
    // RecipeDetail's h1 is the recipe title, not a generic page title.
    ['RecipeDetail', `/recipes/${BUILTIN_RECIPE_ID}`, /^carrots and apples$/i],
    ['New recipe (editor)', '/recipes/new', /^new recipe$/i],
    [
      'Edit recipe (editor)',
      '/recipes/custom-sweet-pea-mash/edit',
      /^edit recipe$/i,
    ],
    ['Foods', '/foods', /^foods$/i],
    ['Prep', '/prep', /^prep$/i],
    ['Grocery', '/grocery', /^grocery$/i],
    ['Share', '/share', /^share$/i],
    ['Print', '/print', /^print your week$/i],
    ['Settings', '/settings', /^settings$/i],
    ['Sources', '/sources', /^sources$/i],
  ];

  it.each(pages)(
    '%s has no axe violations',
    async (_label, path, heading) => {
      const { container } = renderApp(path, seededState());
      // Confirm the intended page actually rendered (its unique h1 is present)
      // before running axe, so axe can't pass on a redirect/error page.
      expect(
        screen.getByRole('heading', { level: 1, name: heading }),
      ).toBeInTheDocument();
      const results = await axe(container, AXE_OPTIONS);
      expect(results).toHaveNoViolations();
    },
  );

  describe('Make with a populated pantry and on-hand foods (Req 15.5)', () => {
    /** A local YYYY-MM-DD `days` days before today. */
    function daysAgo(days: number): string {
      const d = new Date();
      d.setDate(d.getDate() - days);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${m}-${day}`;
    }

    function makeRecipe(id: string, title: string, foods: string[]): Recipe {
      return {
        id,
        origin: 'custom',
        title,
        stages: ['6-8', '9-12'],
        mealTypes: ['lunch', 'dinner'],
        ingredients: foods.map((name) => ({ name, category: 'other' as const })),
        steps: ['Mix.'],
        texture: 'soft',
        servings: 2,
        statedMinutes: 10,
      };
    }

    /** Ready now, Missing one, More ideas (iron filter) and a ghosted recipe,
     *  plus on-hand chips, a made recipe and a dismissed pantry offer. */
    function populated(overrides: Partial<AppState> = {}): AppState {
      return seededState({
        pantry: ['blorp', 'flib', 'lentil'],
        // Tried foods make Ready now recipes eligible for Try this; the
        // untried wumble in Missing one feeds the new-food banner.
        foods: {
          blorp: { status: 'tried', date: daysAgo(40) },
          flib: { status: 'tried', date: daysAgo(40) },
          lentil: { status: 'tried', date: daysAgo(40) },
        },
        onHand: ['flib', 'zonk'],
        onHandUpdated: daysAgo(8),
        onHandDays: {
          carrot: [daysAgo(1), daysAgo(2), daysAgo(3)],
        },
        madeLog: [{ recipeId: 'c-ready', date: daysAgo(2) }],
        dismissed: { 'pantry-setup': new Date().toISOString() },
        customRecipes: [
          makeRecipe('c-ready', 'Blorp Mash', ['blorp', 'flib']),
          makeRecipe('c-one', 'Blorp Zonk Bowl', ['blorp', 'wumble']),
          makeRecipe('c-iron', 'Lentil Blorp', ['lentil', 'blorp']),
          makeRecipe('c-more', 'Lentil Wumble Stew', ['lentil', 'wumble', 'snarf']),
          makeRecipe('c-honey', 'Honey Blorp Bites', ['honey', 'blorp']),
        ],
        ...overrides,
      });
    }

    async function expectNoViolations(container: HTMLElement) {
      const results = await axe(container, AXE_OPTIONS);
      expect(results).toHaveNoViolations();
    }

    it('cards, chips, Try this, banners and Make again have no violations', async () => {
      const { container } = renderApp('/', populated());
      expect(screen.getByRole('heading', { level: 2, name: /Ready now/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /Missing one/ })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'On hand today' })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Tap what you have' })).toBeInTheDocument();
      expect(screen.getByText('Try this')).toBeInTheDocument();
      expect(screen.getByText('Ready for a new food?')).toBeInTheDocument();
      expect(screen.getByText('Still have these?')).toBeInTheDocument();
      expect(screen.getByText('Make again')).toBeInTheDocument();
      await expectNoViolations(container);
    });

    it('the pantry suggestion banner has no violations', async () => {
      // A fresh on-hand list leaves room for the third banner.
      const { container } = renderApp('/', populated({ onHandUpdated: daysAgo(0) }));
      expect(screen.getByText('Add to pantry?')).toBeInTheDocument();
      await expectNoViolations(container);
    });

    it('the ghosted list has no violations', async () => {
      const user = userEvent.setup();
      const { container } = renderApp('/', populated());
      await user.click(screen.getByRole('button', { name: 'Show left-out recipes' }));
      expect(screen.getByRole('link', { name: /Open Honey Blorp Bites/ })).toBeInTheDocument();
      await expectNoViolations(container);
    });

    it('More ideas has no violations with the iron-rich filter on', async () => {
      const user = userEvent.setup();
      const { container } = renderApp('/', populated());
      await user.click(screen.getByRole('button', { name: 'Iron-rich only' }));
      expect(screen.getByRole('heading', { level: 2, name: /More ideas/ })).toBeInTheDocument();
      await expectNoViolations(container);
    });

    it('"Recipes named" has no violations', async () => {
      const user = userEvent.setup();
      const { container } = renderApp('/', populated());
      await user.type(screen.getByRole('textbox', { name: 'What do you have?' }), 'stew');
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 2, name: /Recipes named/ })).toBeInTheDocument(),
      );
      await expectNoViolations(container);
    });

    it('the pantry dialog has no violations', async () => {
      const user = userEvent.setup();
      renderApp('/', populated());
      await user.click(screen.getByRole('button', { name: 'Edit pantry' }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();
      await expectNoViolations(document.body);
    });

    it('the empty state with the Ask ChatGPT panel open has no violations', async () => {
      const user = userEvent.setup();
      const { container } = renderApp(
        '/',
        populated({ pantry: [], onHand: [], onHandUpdated: undefined, madeLog: [] }),
      );
      // Iron-rich plus breakfast leaves nothing ready or missing one food.
      await user.click(screen.getByRole('button', { name: 'Iron-rich only' }));
      await user.type(
        screen.getByRole('textbox', { name: 'What do you have?' }),
        'something for breakfast',
      );
      expect(
        await screen.findByRole('heading', { name: 'Nothing fits yet' }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Ask ChatGPT' }));
      expect(screen.getByText(/AI recipes can be wrong/)).toBeInTheDocument();
      await expectNoViolations(container);
    });
  });

  it('Onboarding (not onboarded) has no axe violations', async () => {
    // Render with onboarded:false so the onboarding form shows instead of the
    // gate redirecting. The gate exempts /onboarding, so the form renders.
    const seed = seededState({ onboarded: false });
    const { container } = renderApp('/onboarding', seed);
    // Sanity: the onboarding form is what's on screen.
    expect(
      screen.getByRole('heading', { level: 1, name: /welcome to firstmenu/i }),
    ).toBeInTheDocument();
    const results = await axe(container, AXE_OPTIONS);
    expect(results).toHaveNoViolations();
  });

  it('SharedView (read-only link, no AppProvider) has no axe violations', async () => {
    // SharedView renders entirely from the encoded fragment and touches no
    // store/storage (Req 11.4), so it is rendered WITHOUT an AppProvider,
    // exactly as App.tsx mounts it as a top-level route outside Layout.
    const { encoded } = encodeSharePayload(seededState());
    const { container } = render(
      <MemoryRouter initialEntries={[`/shared/${encoded}`]}>
        <Routes>
          <Route path="/shared/:data" element={<SharedView />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: /shared plan/i }),
    ).toBeInTheDocument();
    const results = await axe(container, AXE_OPTIONS);
    expect(results).toHaveNoViolations();
  });
});

describe('Accessibility: keyboard affordances (app shell)', () => {
  it('exposes a "Skip to content" link whose target is the <main> landmark', () => {
    renderApp('/', seededState());

    const skip = screen.getByRole('link', { name: /skip to content/i });

    // The main landmark exists (Astryx AppShell renders it with its own id)
    // and the skip link targets it.
    const main = screen.getByRole('main');
    expect(main.id).not.toBe('');
    expect(skip).toHaveAttribute('href', `#${main.id}`);
  });

  it('moves focus to <main> when the skip link is activated', () => {
    renderApp('/', seededState());

    const skip = screen.getByRole('link', { name: /skip to content/i });
    const main = screen.getByRole('main');
    expect(document.activeElement).not.toBe(main);

    // Activate the skip link (its onClick preventDefaults and focuses main,
    // because under a hash router a raw #main jump would blank the page).
    skip.click();

    expect(document.activeElement).toBe(main);
  });

  it('renders the primary nav as real, in-tab-order links for every item', () => {
    renderApp('/', seededState());

    const nav = screen.getByRole('navigation', { name: /primary/i });
    const links = screen.getAllByRole('link').filter((a) => nav.contains(a));

    // Expect the seven primary nav entries (Req 1.2) as anchors.
    const expectedLabels = [
      'Make',
      'My recipes',
      'Add recipe',
      'Foods',
      'Plan',
      'Sources',
      'Settings',
    ];
    for (const label of expectedLabels) {
      const link = links.find((a) => a.textContent?.trim() === label);
      expect(link, `nav link "${label}" missing`).toBeDefined();
      // A real anchor with an href, reachable by keyboard: not removed from the
      // tab order and not hidden from assistive tech.
      expect(link).toHaveAttribute('href');
      expect(link).not.toHaveAttribute('tabindex', '-1');
      expect(link).not.toHaveAttribute('aria-hidden', 'true');
    }

    // The active route is marked for screen readers (Req 14.4).
    const current = links.find(
      (a) => a.getAttribute('aria-current') === 'page',
    );
    expect(current).toBeDefined();
  });

  it('exposes Grocery check-off controls as reachable, focusable checkboxes', () => {
    renderApp('/grocery', seededState());

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    for (const box of checkboxes) {
      // Reachable: a real checkbox that is not disabled out of focus.
      expect(box).not.toBeDisabled();
      expect(box).not.toHaveAttribute('tabindex', '-1');
      // It has an accessible name (the food + amount + any reminder text).
      expect(box).toHaveAccessibleName();
    }
  });

  it('exposes the Plan sub-navigation as real links in one landmark', () => {
    renderApp('/plan', seededState());

    const sub = screen.getByRole('navigation', { name: 'Plan' });
    const links = screen.getAllByRole('link').filter((a) => sub.contains(a));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/plan',
      '/prep',
      '/grocery',
      '/share',
      '/print',
    ]);
    // Roving focus: the current link is a tab stop and the rest are reached
    // with the arrow keys, so exactly one is in the tab order.
    expect(links.filter((a) => a.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('exposes the Plan add-slot control as a reachable, named button', () => {
    // An empty breakfast slot (Day 1) renders an "Add" button with an
    // accessible name naming the meal and day.
    renderApp('/plan', seededState());

    const add = screen.getByRole('button', {
      name: /add a breakfast for day 1/i,
    });
    expect(add).not.toBeDisabled();
    expect(add).toHaveAttribute('type', 'button');
  });
});
