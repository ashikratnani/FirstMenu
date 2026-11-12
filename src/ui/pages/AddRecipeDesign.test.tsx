// Design pass on Add recipe and the typed editor (task 19.2): one button per
// preview line with its actions revealed on demand, one prompt helper open at a
// time, the shared link style and axe on each changed state. The safety
// states and texts are pinned by AddRecipe.test.tsx and RecipeEditor.test.tsx.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import App from '../../App';
import { spyOnNetwork } from '../../test/networkSpy';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState, Recipe } from '../../domain/types';
import { PROMPT_NOTICE } from '../../domain/prompt';
import { FIXED_LIST_NOTE } from './makeView';
import { REEL_MISREAD_NOTICE } from '../components/ReelPrompt';
import { NOT_MEDICAL_ADVICE } from '../components/Disclaimer';

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

afterEach(cleanup);

function birthDateMonthsAgo(months: number): string {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth() - months, n.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MINE: Recipe = {
  id: 'custom-mine',
  origin: 'custom',
  title: 'Banana Mash',
  stages: ['6-8'],
  mealTypes: ['breakfast'],
  ingredients: [{ name: 'banana', category: 'produce' }],
  steps: ['Mash.'],
  texture: 'smooth',
  servings: 1,
};

function seed(recipes: Recipe[] = []): AppState {
  return {
    ...defaultState(new Date()),
    child: { name: 'Zed', birthDate: birthDateMonthsAgo(8) },
    onboarded: true,
    disclaimerAcknowledged: true,
    customRecipes: recipes,
    dismissed: { 'pantry-setup': new Date().toISOString() },
  };
}

function renderAt(path: string, state: AppState = seed()) {
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

const REPLY = JSON.stringify({
  firstmenu_recipe: 1,
  title: 'Oat bowl',
  ingredients: [
    { quantity: 1, unit: 'cup', name: 'rolled oats' },
    { quantity: 1, unit: 'tbsp', name: 'honey' },
  ],
  steps: ['Cook the oats.', 'Finish with a splash of juice.'],
});

type User = ReturnType<typeof userEvent.setup>;

async function readReply(user: User, text: string) {
  await user.click(await screen.findByRole('textbox', { name: 'Recipe text' }));
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: 'Read recipe' }));
}

const primaries = () =>
  Array.from(document.querySelectorAll('[data-variant="primary"]')).map((e) => e.textContent);

const before = (a: HTMLElement, b: HTMLElement) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

async function noViolations(container: HTMLElement) {
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
}

describe('Add recipe preview lines', () => {
  it('shows one button per line, not four, until a line is opened', async () => {
    const user = userEvent.setup();
    renderAt('/add');
    await readReply(user, REPLY);
    const preview = screen.getByRole('region', { name: 'Preview' });
    // 2 ingredients + 2 steps, plus Not used in this recipe, Mark lines as ingredients, Save
    // recipe and Start over: 8 buttons in all (it was 4 per line).
    const buttons = within(preview).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(buttons.filter((n) => /^(Edit|Delete|Move) /.test(n ?? ''))).toEqual([]);
    expect(within(preview).getAllByRole('button', { name: /^Change (ingredient|step): / })).toHaveLength(4);
    expect(within(preview).getAllByRole('button')).toHaveLength(8);
  });

  it('reaches Edit, Move and Delete by keyboard after opening a line, one line at a time', async () => {
    const user = userEvent.setup();
    renderAt('/add');
    await readReply(user, REPLY);
    const line = screen.getByRole('button', { name: 'Change step: Cook the oats.' });
    expect(line).toHaveAttribute('aria-expanded', 'false');
    line.focus();
    await user.keyboard('{Enter}');
    expect(line).toHaveAttribute('aria-expanded', 'true');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Edit step: Cook the oats.' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Move step to ingredients: Cook the oats.' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Move step to notes: Cook the oats.' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Delete step: Cook the oats.' })).toHaveFocus();

    // Opening another line closes the first.
    await user.click(screen.getByRole('button', { name: 'Change ingredient: 1 cup rolled oats' }));
    expect(line).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Delete step: Cook the oats.' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete ingredient: 1 cup rolled oats' })).toBeInTheDocument();
    // Tapping the same line again closes it.
    await user.click(screen.getByRole('button', { name: 'Change ingredient: 1 cup rolled oats' }));
    expect(screen.queryByRole('button', { name: 'Delete ingredient: 1 cup rolled oats' })).not.toBeInTheDocument();
  });

  it('keeps the ingredient block, the mention button and the fixed-list note', async () => {
    const user = userEvent.setup();
    renderAt('/add');
    await readReply(user, REPLY);
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(within(preview).getByText(/Delete the ingredient line to fix this/)).toBeInTheDocument();
    expect(within(preview).getByText(FIXED_LIST_NOTE)).toBeInTheDocument();
    // The ingredient block (honey) has no "Not used" button; the juice sentence has one.
    const notUsed = within(preview).getAllByRole('button', { name: /^Not used in this recipe/ });
    expect(notUsed).toHaveLength(1);
    expect(notUsed[0]).toHaveAccessibleName(/Finish with a splash of juice/);
    // Deleting the blocked ingredient still works, through the opened line.
    await user.click(screen.getByRole('button', { name: 'Change ingredient: 1 tbsp honey' }));
    await user.click(screen.getByRole('button', { name: 'Delete ingredient: 1 tbsp honey' }));
    expect(within(preview).queryByText(/Delete the ingredient line to fix this/)).not.toBeInTheDocument();
  });

  it('has Save recipe as the one primary during a preview', async () => {
    const user = userEvent.setup();
    renderAt('/add');
    expect(primaries()).toEqual(['Paste']);
    await readReply(user, REPLY);
    expect(primaries()).toEqual(['Save recipe']);
  });
});

describe('Add recipe prompt helpers', () => {
  it('opens one helper at a time and keeps both notices', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    renderAt('/add');
    await user.click(screen.getByRole('button', { name: 'Ask ChatGPT' }));
    expect(screen.getByRole('textbox', { name: 'Your question for ChatGPT' })).toBeInTheDocument();
    expect(screen.getByText(PROMPT_NOTICE)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'From an Instagram reel' }));
    expect(screen.queryByRole('textbox', { name: 'Your question for ChatGPT' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Reel link' })).toBeInTheDocument();
    expect(screen.getByText(PROMPT_NOTICE)).toBeInTheDocument();
    expect(screen.getByText(REEL_MISREAD_NOTICE)).toBeInTheDocument();
    expect(screen.getAllByText(PROMPT_NOTICE)).toHaveLength(1);

    // The ChatGPT button is back to its closed label, and the reel can be closed.
    expect(screen.getByRole('button', { name: 'Ask ChatGPT' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide the reel prompt' }));
    expect(screen.queryByRole('textbox', { name: 'Reel link' })).not.toBeInTheDocument();
    expect(primaries()).toEqual(['Paste']);
    network.expectNoNetwork();
  });

  it('puts both helpers together, before "Type a recipe instead"', () => {
    renderAt('/add');
    const helpers = screen.getByRole('region', { name: 'Prompt helpers' });
    expect(within(helpers).getByRole('button', { name: 'Ask ChatGPT' })).toBeInTheDocument();
    expect(within(helpers).getByRole('button', { name: 'From an Instagram reel' })).toBeInTheDocument();
    expect(before(helpers, screen.getByRole('link', { name: 'Type a recipe instead' }))).toBe(true);
  });

  it('uses the shared link style for the helper links and "Type a recipe instead"', async () => {
    const user = userEvent.setup();
    renderAt('/add');
    expect(screen.getByRole('link', { name: 'Type a recipe instead' })).toHaveClass('fm-link');
    await user.click(screen.getByRole('button', { name: 'Ask ChatGPT' }));
    expect(screen.getByRole('link', { name: 'Open ChatGPT' })).toHaveClass('fm-link');
    await user.click(screen.getByRole('button', { name: 'From an Instagram reel' }));
    expect(screen.getByRole('link', { name: 'Open Meta AI' })).toHaveClass('fm-link');
  });
});

describe('typed editor', () => {
  it('uses the shared link style for Back to recipes and keeps one primary', () => {
    renderAt('/recipes/new');
    expect(screen.getByRole('link', { name: /Back to recipes/ })).toHaveClass('fm-link');
    expect(primaries()).toEqual(['Save recipe']);
  });
});

describe('axe on the changed states', () => {
  it('empty Add recipe, with the ChatGPT helper open, with the reel helper open', async () => {
    const user = userEvent.setup();
    const { container } = renderAt('/add');
    await noViolations(container);
    await user.click(screen.getByRole('button', { name: 'Ask ChatGPT' }));
    await noViolations(container);
    await user.click(screen.getByRole('button', { name: 'From an Instagram reel' }));
    await noViolations(container);
  });

  it('JSON preview with an opened line, a text mention and an ingredient block', async () => {
    const user = userEvent.setup();
    const { container } = renderAt('/add');
    await readReply(user, REPLY);
    await user.click(screen.getByRole('button', { name: 'Change ingredient: 1 tbsp honey' }));
    await noViolations(container);
  });

  it('no-json fallback preview', async () => {
    const user = userEvent.setup();
    const { container } = renderAt('/add');
    await readReply(user, 'Banana mash\n\nIngredients\n1 banana\n\nSteps\n1. Mash the banana.');
    expect(screen.getByText(/read as plain text/)).toBeInTheDocument();
    await noViolations(container);
  });

  it('typed editor new with errors and edit with errors', async () => {
    const user = userEvent.setup();
    const { container } = renderAt('/recipes/new');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
    await noViolations(container);
    cleanup();
    const edit = renderAt('/recipes/custom-mine/edit', seed([MINE]));
    await user.clear(screen.getByRole('textbox', { name: 'Title' }));
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
    await noViolations(edit.container);
  });
});

describe('disclaimer', () => {
  it('stays in the shell footer on Add recipe with a preview and on the editor', async () => {
    const user = userEvent.setup();
    renderAt('/add');
    await readReply(user, REPLY);
    expect(screen.getAllByText(NOT_MEDICAL_ADVICE).length).toBeGreaterThan(0);
    cleanup();
    renderAt('/recipes/new');
    expect(screen.getAllByText(NOT_MEDICAL_ADVICE).length).toBeGreaterThan(0);
  });
});
