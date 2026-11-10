import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AddRecipe, { INSTAGRAM_HELP, PASTE_FALLBACK } from './AddRecipe';
import { PROMPT_NOTICE } from '../../domain/prompt';
import { AppProvider, useApp } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState } from '../../domain/types';

function makeStorage(seed: AppState): Storage {
  const map = new Map<string, string>([[STORAGE_KEY, JSON.stringify(seed)]]);
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

function birthDateMonthsAgo(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seed(): AppState {
  return {
    ...defaultState(new Date()),
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(8) },
    onboarded: true,
    disclaimerAcknowledged: true,
  };
}

function renderAdd(path = '/add') {
  let latest: ReturnType<typeof useApp> | null = null;
  function Probe() {
    latest = useApp();
    return null;
  }
  render(
    <AppProvider storage={makeStorage(seed())}>
      <MemoryRouter initialEntries={[path]}>
        <Probe />
        <Routes>
          <Route path="/add" element={<AddRecipe />} />
          <Route path="/recipes/:id" element={<p>recipe page</p>} />
          <Route path="/recipes/new" element={<p>typed editor</p>} />
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
  return { getState: () => latest!.state };
}

const REPLY = [
  'Title: Banana oat mash',
  'Total time: 10 minutes',
  'Serves: 2',
  'Ingredients:',
  '- 1 banana',
  '- 2 tbsp oats',
  'Steps:',
  '1. Mash the banana.',
  '2. Stir in the oats.',
].join('\n');

const WITH_HONEY = `${REPLY}\n3. Drizzle a little honey on top.`;

/** Replace navigator.clipboard (userEvent installs its own on setup). */
function mockClipboard(readText: () => Promise<string>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { readText, writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

async function pasteAndRead(user: ReturnType<typeof userEvent.setup>, text: string) {
  const box = screen.getByRole('textbox', { name: 'Recipe text' });
  await user.click(box);
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: 'Read recipe' }));
}

describe('Add recipe: paste, preview, save (Req 6.1, 6.4, 6.7, 6.8)', () => {
  it('pastes, previews and saves with no typing into the preview', async () => {
    const user = userEvent.setup();
    const { getState } = renderAdd();
    await pasteAndRead(user, REPLY);

    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(within(preview).getByRole('textbox', { name: 'Title' })).toHaveValue('Banana oat mash');
    expect(within(preview).getByText('1 banana')).toBeInTheDocument();
    expect(within(preview).getByText('Stir in the oats.')).toBeInTheDocument();
    // Time, effort and tags show in the preview (Req 6.4).
    expect(within(preview).getByText(/10 min · Easy/)).toBeInTheDocument();
    expect(within(preview).getByText(/Nothing on FirstMenu's list was found/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    const saved = getState().customRecipes;
    expect(saved).toHaveLength(1);
    const recipe = saved[0];
    expect(recipe.title).toBe('Banana oat mash');
    expect(recipe.origin).toBe('custom');
    expect(recipe.stages).toEqual(['6-8']);
    expect(recipe.mealTypes).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    expect(recipe.ingredients.map((i) => i.name)).toEqual(['banana', 'oats']);
    expect(recipe.ingredients.every((i) => typeof i.category === 'string')).toBe(true);
    expect(recipe.steps).toEqual(['Mash the banana.', 'Stir in the oats.']);
    expect(recipe.statedMinutes).toBe(10);
    expect(recipe.servings).toBe(2);
    expect(recipe.texture).toMatch(/^As described in the recipe\./);
    expect(recipe.imported?.text).toBe(REPLY);
    expect(recipe.imported?.from).toBe('other');
    expect(screen.getByText('recipe page')).toBeInTheDocument();
  });

  it('records the source and link, and never fetches the link', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { getState } = renderAdd();
    await user.click(screen.getByRole('radio', { name: 'Instagram' }));
    expect(screen.getByRole('radio', { name: 'Instagram' })).toBeChecked();
    await user.type(screen.getByRole('textbox', { name: /Link/ }), 'https://example.com/reel');
    expect(screen.getByRole('radio', { name: 'Instagram' })).toBeChecked();
    await pasteAndRead(user, REPLY);
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(getState().customRecipes[0].imported).toMatchObject({
      from: 'instagram',
      url: 'https://example.com/reel',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a link that is not a web address', async () => {
    const user = userEvent.setup();
    renderAdd();
    await user.type(screen.getByRole('textbox', { name: /Link/ }), 'javascript:alert(1)');
    await pasteAndRead(user, REPLY);
    expect(screen.getByText(/must start with http/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Preview' })).not.toBeInTheDocument();
  });

  it('asks for text when the box is empty', async () => {
    const user = userEvent.setup();
    renderAdd();
    await user.click(screen.getByRole('button', { name: 'Read recipe' }));
    expect(screen.getByText(/paste a recipe first/i)).toBeInTheDocument();
  });

  it('preselects ChatGPT when opened from "Paste the answer" (?from=chatgpt)', () => {
    renderAdd('/add?from=chatgpt');
    expect(screen.getByRole('radio', { name: 'ChatGPT' })).toBeChecked();
  });

  it('shows the Instagram help, the typed editor link and the fixed-list note', async () => {
    const user = userEvent.setup();
    renderAdd();
    expect(screen.getByText(INSTAGRAM_HELP)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /type a recipe instead/i })).toHaveAttribute(
      'href',
      '/recipes/new',
    );
    await pasteAndRead(user, REPLY);
    expect(screen.getByText(/fixed list of foods/i)).toBeInTheDocument();
    expect(screen.getByText(/can miss foods, amounts and preparations/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /type a recipe instead/i })).toBeInTheDocument();
  });
});

describe('Add recipe: line editing and moving (Req 6.5)', () => {
  it('edits a step, deletes an ingredient and moves a step to notes', async () => {
    const user = userEvent.setup();
    const { getState } = renderAdd();
    await pasteAndRead(user, REPLY);

    await user.click(screen.getByRole('button', { name: 'Edit step: Mash the banana.' }));
    const input = screen.getByRole('textbox', { name: 'Edit step' });
    await user.clear(input);
    await user.type(input, 'Mash the banana well.');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Mash the banana well.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete ingredient: 2 tbsp oats' }));
    expect(screen.queryByText('2 tbsp oats')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Move step to notes: Stir in the oats.' }));
    expect(within(screen.getByRole('region', { name: 'Notes' })).getByText('Stir in the oats.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    const recipe = getState().customRecipes[0];
    expect(recipe.steps).toEqual(['Mash the banana well.']);
    expect(recipe.ingredients.map((i) => i.name)).toEqual(['banana']);
    expect(recipe.notes).toEqual(['Stir in the oats.']);
  });

  it('moves a note to the ingredients', async () => {
    const user = userEvent.setup();
    const { getState } = renderAdd();
    await pasteAndRead(user, REPLY);
    await user.click(screen.getByRole('button', { name: 'Move step to notes: Stir in the oats.' }));
    await user.click(screen.getByRole('button', { name: 'Move note to ingredients: Stir in the oats.' }));
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(getState().customRecipes[0].ingredients).toHaveLength(3);
  });
});

describe('Add recipe: no ingredients found (Req 6.6)', () => {
  it('says so and lets the user mark which lines are ingredients', async () => {
    const user = userEvent.setup();
    const { getState } = renderAdd();
    await pasteAndRead(user, 'Mashed banana\nMash a ripe banana with a fork.\nServe it on a spoon.');
    expect(screen.getByText(/No ingredients found/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark lines as ingredients' }));
    const mode = screen.getByRole('region', { name: 'Mark lines as ingredients' });
    await user.click(within(mode).getByRole('checkbox', { name: 'Mash a ripe banana with a fork.' }));
    await user.click(within(mode).getByRole('button', { name: 'Add marked lines to ingredients' }));
    expect(screen.queryByText(/No ingredients found/)).not.toBeInTheDocument();
    expect(screen.getByText('Mash a ripe banana with a fork.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(getState().customRecipes[0].ingredients).toHaveLength(1);
  });
});

describe('Add recipe: safety results (Req 7.3, 7.4, 7.5)', () => {
  it('shows a text mention with its sentence and clears it with "Not used in this recipe"', async () => {
    const user = userEvent.setup();
    const { getState } = renderAdd();
    await pasteAndRead(user, WITH_HONEY);

    const results = screen.getByRole('region', { name: 'Safety results' });
    expect(within(results).getByText('Drizzle a little honey on top.')).toBeInTheDocument();
    expect(within(results).getByText(/Not safe yet for your child/)).toBeInTheDocument();

    await user.click(
      within(results).getByRole('button', {
        name: 'Not used in this recipe: Drizzle a little honey on top.',
      }),
    );
    expect(within(results).queryByText('Drizzle a little honey on top.')).not.toBeInTheDocument();
    expect(within(results).queryByText(/Not safe yet for your child/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(getState().customRecipes[0].clearedMentions).toEqual([
      { ruleId: expect.any(String), sentence: 'Drizzle a little honey on top.' },
    ]);
  });

  it('brings the mention back when the sentence is edited', async () => {
    const user = userEvent.setup();
    renderAdd();
    await pasteAndRead(user, WITH_HONEY);
    await user.click(
      screen.getByRole('button', { name: 'Not used in this recipe: Drizzle a little honey on top.' }),
    );
    await user.click(screen.getByRole('button', { name: 'Edit step: Drizzle a little honey on top.' }));
    const input = screen.getByRole('textbox', { name: 'Edit step' });
    await user.clear(input);
    await user.type(input, 'Drizzle some honey on top.');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(
      screen.getByRole('button', { name: 'Not used in this recipe: Drizzle some honey on top.' }),
    ).toBeInTheDocument();
  });

  it('shows an ingredient block with no clear button and lets the user delete the line', async () => {
    const user = userEvent.setup();
    renderAdd();
    await pasteAndRead(user, 'Honey toast\nIngredients:\n- 1 slice bread\n- 1 tbsp honey\nSteps:\n1. Spread it.');
    const results = screen.getByRole('region', { name: 'Safety results' });
    expect(within(results).getByText(/Delete the ingredient line to fix this/)).toBeInTheDocument();
    expect(within(results).queryByRole('button', { name: /Not used in this recipe/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete ingredient: 1 tbsp honey' }));
    expect(within(results).queryByText(/Delete the ingredient line to fix this/)).not.toBeInTheDocument();
  });
});

describe('Add recipe: Paste button (Req 17.7)', () => {
  it('does not read the clipboard until Paste is tapped', () => {
    const readText = vi.fn().mockResolvedValue(REPLY);
    renderAdd();
    mockClipboard(readText);
    expect(readText).not.toHaveBeenCalled();
  });

  it('fills the box and reads the recipe on success', async () => {
    const user = userEvent.setup();
    renderAdd();
    const readText = vi.fn().mockResolvedValue(REPLY);
    mockClipboard(readText);
    await user.click(screen.getByRole('button', { name: 'Paste' }));
    expect(readText).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Banana oat mash');
  });

  it('shows the fallback and focuses the text box when the clipboard is refused', async () => {
    const user = userEvent.setup();
    renderAdd();
    mockClipboard(() => Promise.reject(new Error('denied')));
    await user.click(screen.getByRole('button', { name: 'Paste' }));
    expect(screen.getByText(PASTE_FALLBACK)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Recipe text' })).toHaveFocus();
    expect(screen.queryByRole('region', { name: 'Preview' })).not.toBeInTheDocument();
  });

  it('shows the fallback when the browser has no clipboard read', async () => {
    const user = userEvent.setup();
    renderAdd();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Paste' }));
    expect(screen.getByText(PASTE_FALLBACK)).toBeInTheDocument();
  });

  it('has Paste as the only primary before a preview, and Save recipe only during one', async () => {
    const user = userEvent.setup();
    renderAdd();
    const primaries = () =>
      Array.from(document.querySelectorAll('[data-variant="primary"]')).map(
        (el) => el.getAttribute('aria-label') ?? el.textContent?.trim(),
      );
    expect(primaries()).toEqual(['Paste']);
    expect(screen.getByRole('button', { name: 'Read recipe' })).toHaveAttribute('data-variant', 'secondary');

    await pasteAndRead(user, REPLY);
    expect(primaries()).toEqual(['Save recipe']);
    expect(screen.queryByRole('button', { name: 'Paste' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start over' }));
    expect(primaries()).toEqual(['Paste']);
  });
});

describe('Add recipe: prompt helper (Req 8.1, 8.6 to 8.9)', () => {
  it('copies the question, then "Paste the answer" selects ChatGPT and moves to the paste box', async () => {
    const user = userEvent.setup();
    renderAdd();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText, readText: vi.fn() },
      configurable: true,
    });
    await user.click(screen.getByRole('button', { name: 'Ask ChatGPT' }));
    expect(screen.getByText(PROMPT_NOTICE)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open ChatGPT' })).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('button', { name: 'Paste the answer' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy question' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).not.toMatch(/Baby/);

    await user.click(screen.getByRole('button', { name: 'Paste the answer' }));
    expect(screen.getByRole('radio', { name: 'ChatGPT' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Recipe text' })).toHaveFocus();
  });
});
