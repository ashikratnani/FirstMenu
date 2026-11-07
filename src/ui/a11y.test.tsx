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

import { render, screen } from '@testing-library/react';
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
  // Each entry is [label, path]; all render through the shell with the same
  // onboarded seed so the OnboardingGate lets the page render.
  const pages: ReadonlyArray<[string, string]> = [
    ['Home (week)', '/'],
    ['Recipes', '/recipes'],
    ['RecipeDetail', `/recipes/${BUILTIN_RECIPE_ID}`],
    ['Foods', '/foods'],
    ['Prep', '/prep'],
    ['Grocery', '/grocery'],
    ['Share', '/share'],
    ['Print', '/print'],
    ['Settings', '/settings'],
    ['Sources', '/sources'],
  ];

  it.each(pages)('%s has no axe violations', async (_label, path) => {
    const { container } = renderApp(path, seededState());
    const results = await axe(container, AXE_OPTIONS);
    expect(results).toHaveNoViolations();
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
    expect(skip).toHaveAttribute('href', '#main');

    // The <main> landmark exists, has id="main" and is programmatically
    // focusable (tabIndex=-1) so activating the skip link can move focus to it.
    const main = document.querySelector('main#main') as HTMLElement | null;
    expect(main).not.toBeNull();
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus to <main> when the skip link is activated', () => {
    renderApp('/', seededState());

    const skip = screen.getByRole('link', { name: /skip to content/i });
    const main = document.querySelector('main#main') as HTMLElement;
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

    // Expect at least the eight primary nav entries (Week..Settings) as anchors.
    const expectedLabels = [
      'Week',
      'Recipes',
      'Foods',
      'Prep',
      'Grocery',
      'Share',
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

  it('exposes the Home add-slot control as a reachable, named button', () => {
    // An empty breakfast slot (Day 1) renders an "Add" button with an
    // accessible name naming the meal and day.
    renderApp('/', seededState());

    const add = screen.getByRole('button', {
      name: /add a breakfast for day 1/i,
    });
    expect(add).not.toBeDisabled();
    expect(add).toHaveAttribute('type', 'button');
  });
});
