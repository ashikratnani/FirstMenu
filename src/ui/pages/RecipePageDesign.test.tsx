// Design pass on the recipe page and the shared recipe view (task 19.2):
// fact row under the title, actions near the top, quieter page-footer
// disclaimer, shared fm-link, and axe on each changed state.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import App from '../../App';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import { encodeRecipeShare } from '../../domain/recipeShare';
import type { AppState, Recipe } from '../../domain/types';
import { NOT_MEDICAL_ADVICE, SCREEN_LIMITS } from '../components/Disclaimer';

type AxeMatcherFn = (results: unknown) => { pass: boolean; message: () => string };
expect.extend({
  toHaveNoViolations: (axeMatchers as unknown as { toHaveNoViolations: AxeMatcherFn })
    .toHaveNoViolations,
});
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
}
const AXE_OPTIONS = { rules: { 'color-contrast': { enabled: false } } };

function birthDateMonthsAgo(months: number): string {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth() - months, n.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const HONEY: Recipe = {
  id: 'custom-honey',
  origin: 'custom',
  title: 'Honey Toast',
  stages: ['6-8', '9-12'],
  mealTypes: ['breakfast'],
  ingredients: [
    { name: 'honey', category: 'pantry' },
    { name: 'bread', category: 'grains' },
  ],
  steps: ['Toast.'],
  texture: 'soft',
  servings: 1,
};

function seed(recipes: Recipe[] = [], child = true): AppState {
  return {
    ...defaultState(new Date()),
    child: child ? { name: 'Zed', birthDate: birthDateMonthsAgo(8) } : undefined,
    onboarded: true,
    disclaimerAcknowledged: true,
    customRecipes: recipes,
    dismissed: { 'pantry-setup': new Date().toISOString() },
  };
}

function renderAt(path: string, state: AppState) {
  const map = new Map([[STORAGE_KEY, JSON.stringify(state)]]);
  const storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } satisfies Storage;
  return render(
    <AppProvider storage={storage}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AppProvider>,
  );
}

const before = (a: HTMLElement, b: HTMLElement) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('recipe page design', () => {
  it('shows stage, time, effort, texture and servings as a fact row under the title', () => {
    renderAt('/recipes/b-carrots-and-apples', seed());
    const facts = screen.getByRole('list', { name: 'Recipe facts' });
    const items = within(facts).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      expect.stringMatching(/^(6|9|12|2).*(months|years)/),
      expect.stringMatching(/^(about )?\d+ min$|^\d+(\.\d+)? ?h/),
      expect.stringMatching(/^(Easy|Medium|Involved|Hard)$/),
      expect.stringMatching(/^Texture: .+/),
      expect.stringMatching(/^Serves \d+ portions?$/),
    ]);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(before(h1, facts)).toBe(true);
  });

  it('puts Add to plan, I made this and Share above the ingredients', () => {
    renderAt('/recipes/b-carrots-and-apples', seed());
    const ingredients = screen.getByRole('heading', { name: 'Ingredients' });
    for (const name of ['Add to plan', 'I made this', 'Share recipe']) {
      expect(before(screen.getByRole('button', { name }), ingredients)).toBe(true);
    }
  });

  it('uses the shared link style for Back to recipes', () => {
    renderAt('/recipes/b-carrots-and-apples', seed());
    expect(screen.getByRole('link', { name: /Back to recipes/ })).toHaveClass('fm-link');
  });

  it('shows "Time not given" in the fact row of a simple idea', () => {
    renderAt('/recipes/b-idea-mashed-banana', seed());
    const items = within(screen.getByRole('list', { name: 'Recipe facts' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(items).toEqual([
      expect.stringMatching(/months|years/),
      'Time not given',
      expect.stringMatching(/^[A-Z][a-z]+$/),
      expect.stringMatching(/^Texture: /),
      'Serves 1 portion',
    ]);
  });

  it('keeps both disclaimers, the page one last in the article and the shell copy after it', () => {
    renderAt('/recipes/b-carrots-and-apples', seed());
    const notMedical = screen.getAllByText(NOT_MEDICAL_ADVICE);
    const limits = screen.getAllByText(SCREEN_LIMITS);
    expect(notMedical).toHaveLength(2);
    expect(limits).toHaveLength(2);
    const article = screen.getByRole('article');
    const [pageNote, shellNote] = notMedical;
    const [pageLimits, shellLimits] = limits;
    expect(article).toContainElement(pageNote);
    expect(article).toContainElement(pageLimits);
    expect(article).not.toContainElement(shellNote);
    expect(article).not.toContainElement(shellLimits);
    // Page footer is the last child of the article, and its text is the last content.
    const footer = article.lastElementChild as HTMLElement;
    expect(footer.tagName).toBe('FOOTER');
    expect(footer).toContainElement(pageNote);
    expect(footer).toContainElement(pageLimits);
    expect(before(pageNote, pageLimits)).toBe(true);
    // Everything else in the article comes before the page footer.
    expect(before(screen.getByRole('heading', { name: 'Steps' }), pageNote)).toBe(true);
    // The shell copy follows the article, in the same order.
    expect(before(article, shellNote)).toBe(true);
    expect(before(pageLimits, shellNote)).toBe(true);
    expect(before(shellNote, shellLimits)).toBe(true);
  });

  it('has no axe violations for a ghosted recipe and a simple idea', async () => {
    const ghost = renderAt('/recipes/custom-honey', seed([HONEY]));
    expect(screen.getByRole('heading', { name: 'Not yet' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to plan' })).not.toBeInTheDocument();
    expect(await axe(ghost.container, AXE_OPTIONS)).toHaveNoViolations();
    ghost.unmount();
    const idea = renderAt('/recipes/b-idea-mashed-banana', seed());
    expect(screen.getByText('Simple idea')).toBeInTheDocument();
    expect(await axe(idea.container, AXE_OPTIONS)).toHaveNoViolations();
  });
});

describe('shared recipe view design', () => {
  const link = (r: Recipe) => `/r/${encodeRecipeShare(r).encoded}`;

  it('has a fact row and the one primary action above the ingredients', () => {
    renderAt(link(HONEY), seed());
    expect(screen.getByRole('list', { name: 'Recipe facts' })).toHaveTextContent(/Serves 1 portion/);
    const add = screen.getByRole('button', { name: 'Add to my recipes' });
    expect(before(add, screen.getByRole('heading', { name: 'Ingredients' }))).toBe(true);
    expect(screen.getByRole('heading', { name: 'Not yet' })).toBeInTheDocument();
    expect(screen.getByText(NOT_MEDICAL_ADVICE)).toBeInTheDocument();
  });

  it('has no axe violations with findings, without a child, and on a bad link', async () => {
    const a = renderAt(link(HONEY), seed());
    expect(await axe(a.container, AXE_OPTIONS)).toHaveNoViolations();
    a.unmount();
    const b = renderAt(link(HONEY), seed([], false));
    expect(screen.getByText('Set up your child to check this recipe.')).toBeInTheDocument();
    expect(await axe(b.container, AXE_OPTIONS)).toHaveNoViolations();
    b.unmount();
    const c = renderAt('/r/garbage', seed());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(await axe(c.container, AXE_OPTIONS)).toHaveNoViolations();
  });
});
