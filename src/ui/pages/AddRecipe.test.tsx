import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spyOnNetwork } from '../../test/networkSpy';
import AddRecipe, {
  INSTAGRAM_HELP,
  PASTE_FALLBACK,
  PLAIN_TEXT_NOTICE,
  REEL_ERROR,
  REEL_LINK_KEPT,
} from './AddRecipe';
import validJson from '../../domain/__fixtures__/json/valid.json?raw';
import fencedJson from '../../domain/__fixtures__/json/fenced-with-prose.txt?raw';
import brokenJson from '../../domain/__fixtures__/json/broken.txt?raw';
import fractionJson from '../../domain/__fixtures__/json/quantity-fraction.json?raw';
import unknownKeysJson from '../../domain/__fixtures__/json/unknown-keys.json?raw';
import unitBlockedJson from '../../domain/__fixtures__/json/unit-blocked-food.json?raw';
import errorJson from '../../domain/__fixtures__/json/error-object.json?raw';
import { buildFixupPrompt, buildReelPrompt } from '../../domain/prompt';
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

/** Opens a preview line's actions: the line is the only button until it is tapped. */
async function openLine(user: ReturnType<typeof userEvent.setup>, kind: string, text: string) {
  await user.click(screen.getByRole('button', { name: `Change ${kind}: ${text}` }));
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
    const network = spyOnNetwork();
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
    network.expectNoNetwork();
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

    await openLine(user, 'step', 'Mash the banana.');

    await user.click(screen.getByRole('button', { name: 'Edit step: Mash the banana.' }));
    const input = screen.getByRole('textbox', { name: 'Edit step' });
    await user.clear(input);
    await user.type(input, 'Mash the banana well.');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Mash the banana well.')).toBeInTheDocument();

    await openLine(user, 'ingredient', '2 tbsp oats');

    await user.click(screen.getByRole('button', { name: 'Delete ingredient: 2 tbsp oats' }));
    expect(screen.queryByText('2 tbsp oats')).not.toBeInTheDocument();

    await openLine(user, 'step', 'Stir in the oats.');

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
    await openLine(user, 'step', 'Stir in the oats.');
    await user.click(screen.getByRole('button', { name: 'Move step to notes: Stir in the oats.' }));
    await openLine(user, 'note', 'Stir in the oats.');
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
    await openLine(user, 'step', 'Drizzle a little honey on top.');
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
    await openLine(user, 'ingredient', '1 tbsp honey');
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
    const network = spyOnNetwork();
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
    network.expectNoNetwork();
  });
});

const oats = { quantity: 1, unit: 'cup', name: 'rolled oats' };

function jsonWith(fields: Record<string, unknown>): string {
  return JSON.stringify({
    firstmenu_recipe: 1,
    title: 'Oat bowl',
    ingredients: [oats],
    steps: ['Cook the oats.'],
    ...fields,
  });
}

describe('Add recipe: Recipe JSON intake (Req 18.3 to 18.12, 6.1)', () => {
  it('previews a JSON reply, keeps the raw reply as original text and saves', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    const { getState } = renderAdd('/add?from=chatgpt');
    await pasteAndRead(user, validJson);
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(within(preview).getByRole('textbox', { name: 'Title' })).toHaveValue('Egg and rice bowl');
    expect(within(preview).getByText('1 cup cooked rice')).toBeInTheDocument();
    expect(screen.getByText('Read as a FirstMenu recipe')).toBeInTheDocument();
    expect(screen.queryByText(PLAIN_TEXT_NOTICE)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    const recipe = getState().customRecipes[0];
    expect(recipe.imported).toMatchObject({ from: 'chatgpt', text: validJson });
    expect(recipe.statedMinutes).toBe(15);
    expect(recipe.servings).toBe(2);
    network.expectNoNetwork();
  });

  it('reads a fenced reply, hides plain unit notes and says long outside text was ignored', async () => {
    const user = userEvent.setup();
    renderAdd();
    await pasteAndRead(user, fencedJson);
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(within(preview).getByRole('textbox', { name: 'Title' })).toHaveValue('Banana oat pancakes');
    expect(within(preview).queryByText(/ingredients\[\d+\]\.unit/)).not.toBeInTheDocument();
    expect(within(preview).queryByText(/Here is a recipe/)).not.toBeInTheDocument();
  });

  it('shows the outside-text notice with a Show toggle when a second object is present', async () => {
    const user = userEvent.setup();
    renderAdd();
    const reply = `${validJson}\nAlso {"other": true}`;
    await pasteAndRead(user, reply);
    expect(screen.getByText('Text outside the recipe was ignored.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show the reply' }));
    expect(screen.getByText(/Also \{"other": true\}/)).toBeInTheDocument();
  });

  it('adds extra text to the notes with a notice and screens it', async () => {
    const user = userEvent.setup();
    renderAdd();
    await pasteAndRead(user, unknownKeysJson);
    expect(screen.getByText(/Extra text was added to the notes/)).toBeInTheDocument();
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(within(preview).getByText(/ingredients\[0\]\.brand: Nutella/)).toBeInTheDocument();
    // "honey" inside an unknown key is screened as a text mention.
    expect(within(preview).getByText(/Honey is mentioned in the note/i)).toBeInTheDocument();
  });

  it('screens a blocked food in a multi-word ingredient unit and keeps the note visible', async () => {
    const user = userEvent.setup();
    renderAdd();
    await pasteAndRead(user, unitBlockedJson);
    const preview = screen.getByRole('region', { name: 'Preview' });
    // The unit note stays visible. The ingredient line is a block, so it has no "Not used" button.
    expect(within(preview).getByText(/ingredients\[1\]\.unit: tbsp honey/)).toBeInTheDocument();
    expect(within(preview).getByText(/Delete the ingredient line to fix this/)).toBeInTheDocument();
    expect(
      within(preview).queryByRole('button', { name: /Not used in this recipe/ }),
    ).not.toBeInTheDocument();

    // With the ingredient line deleted, the note is a text mention that only "Not used" clears.
    await openLine(user, 'ingredient', '1 tbsp honey mashed banana');
    await user.click(
      within(preview).getByRole('button', { name: 'Delete ingredient: 1 tbsp honey mashed banana' }),
    );
    expect(within(preview).getByText(/Honey is mentioned in the note/)).toBeInTheDocument();
    await user.click(within(preview).getByRole('textbox', { name: 'Title' }));
    expect(within(preview).getByText(/Honey is mentioned in the note/)).toBeInTheDocument();
    await user.click(
      within(preview).getByRole('button', {
        name: 'Not used in this recipe: ingredients[1].unit: tbsp honey',
      }),
    );
    expect(within(preview).queryByText(/Honey is mentioned/)).not.toBeInTheDocument();
    expect(within(preview).queryByText(/Not safe yet/)).not.toBeInTheDocument();
  });

  it('screens a single-word unit that is a blocked food and only "Not used" clears it', async () => {
    const user = userEvent.setup();
    renderAdd();
    await pasteAndRead(
      user,
      jsonWith({ ingredients: [oats, { quantity: 1, unit: 'honey', name: 'mashed banana' }] }),
    );
    const preview = screen.getByRole('region', { name: 'Preview' });
    // The unit note stays visible. The ingredient line is a block, so it has no "Not used" button.
    expect(within(preview).getByText(/ingredients\[1\]\.unit: honey/)).toBeInTheDocument();
    expect(within(preview).getByText(/Delete the ingredient line to fix this/)).toBeInTheDocument();
    expect(
      within(preview).queryByRole('button', { name: /Not used in this recipe/ }),
    ).not.toBeInTheDocument();

    // With the ingredient line deleted, the note is a text mention that only "Not used" clears.
    await openLine(user, 'ingredient', '1 honey mashed banana');
    await user.click(
      within(preview).getByRole('button', { name: 'Delete ingredient: 1 honey mashed banana' }),
    );
    expect(within(preview).getByText(/Honey is mentioned in the note/)).toBeInTheDocument();
    await user.click(within(preview).getByRole('textbox', { name: 'Title' }));
    expect(within(preview).getByText(/Honey is mentioned in the note/)).toBeInTheDocument();
    await user.click(
      within(preview).getByRole('button', {
        name: 'Not used in this recipe: ingredients[1].unit: honey',
      }),
    );
    expect(within(preview).queryByText(/Honey is mentioned/)).not.toBeInTheDocument();
    expect(within(preview).queryByText(/Not safe yet/)).not.toBeInTheDocument();
  });

  it('ghosts honey in a step and only "Not used" clears it', async () => {
    const user = userEvent.setup();
    renderAdd();
    await pasteAndRead(
      user,
      jsonWith({ steps: ['Cook the oats.', 'Drizzle a little honey on top.'] }),
    );
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(within(preview).getByText(/Honey is mentioned in the step/)).toBeInTheDocument();
    await user.click(within(preview).getByRole('textbox', { name: 'Title' }));
    expect(within(preview).getByText(/Honey is mentioned in the step/)).toBeInTheDocument();
    await user.click(
      within(preview).getByRole('button', {
        name: 'Not used in this recipe: Drizzle a little honey on top.',
      }),
    );
    expect(within(preview).queryByText(/Honey is mentioned/)).not.toBeInTheDocument();
  });

  it('blocks honey in an ingredient name with no "Not used" button', async () => {
    const user = userEvent.setup();
    renderAdd();
    await pasteAndRead(
      user,
      jsonWith({ ingredients: [oats, { quantity: 1, unit: 'tbsp', name: 'honey' }] }),
    );
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(within(preview).getByText(/Delete the ingredient line to fix this/)).toBeInTheDocument();
    expect(
      within(preview).queryByRole('button', { name: /Not used in this recipe/ }),
    ).not.toBeInTheDocument();
  });

  it('ghosts honey in the notes', async () => {
    const user = userEvent.setup();
    renderAdd();
    await pasteAndRead(user, jsonWith({ notes: ['Add honey for older kids.'] }));
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(within(preview).getByText(/Honey is mentioned in the note/)).toBeInTheDocument();
    expect(
      within(preview).getByRole('button', { name: /Not used in this recipe/ }),
    ).toBeInTheDocument();
  });

  it('gives the same findings for the same recipe as JSON and as plain text (Req 18.8)', async () => {
    const user = userEvent.setup();
    const json = jsonWith({
      ingredients: [oats, { quantity: 1, unit: 'tbsp', name: 'banana' }],
      steps: ['Cook the oats.', 'Drizzle a little honey on top.'],
      notes: ['Add honey for older kids.'],
    });
    const plain = [
      'Oat bowl',
      'Ingredients:',
      '1 cup rolled oats',
      '1 tbsp banana',
      'Steps:',
      '1. Cook the oats.',
      '2. Drizzle a little honey on top.',
      'Notes:',
      'Add honey for older kids.',
    ].join('\n');
    const findings = async (text: string) => {
      renderAdd();
      await pasteAndRead(user, text);
      const preview = screen.getByRole('region', { name: 'Preview' });
      const found = within(preview)
        .getAllByText(/Not safe yet:/)
        .map((el) => el.parentElement?.textContent ?? '');
      cleanup();
      return found;
    };
    const fromJson = await findings(json);
    const fromPlain = await findings(plain);
    expect(fromJson).toHaveLength(2);
    expect(fromJson).toEqual(fromPlain);
  });

  it('does not save a plain unit note into the recipe', async () => {
    const user = userEvent.setup();
    const { getState } = renderAdd();
    await pasteAndRead(user, validJson);
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(getState().customRecipes[0].notes).toEqual(['Keeps 2 days in the fridge.']);
  });

  it('shows field-level errors, a fix-up request and a plain-text escape for an invalid reply', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    renderAdd();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText, readText: vi.fn() },
      configurable: true,
    });
    await pasteAndRead(user, fractionJson);
    expect(screen.queryByRole('region', { name: 'Preview' })).not.toBeInTheDocument();
    expect(screen.getByText(/quantity must be a number such as 0\.5/)).toBeInTheDocument();
    expect(primariesOnPage()).toEqual(['Paste']);

    await user.click(screen.getByRole('button', { name: 'Copy a fix-up request' }));
    expect(writeText).toHaveBeenCalledWith(buildFixupPrompt());

    await user.click(screen.getByRole('button', { name: 'Read as plain text instead' }));
    expect(screen.getByRole('region', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.queryByText('Read as a FirstMenu recipe')).not.toBeInTheDocument();
    network.expectNoNetwork();
  });

  it('explains a cut-off reply instead of reading it as plain text', async () => {
    const user = userEvent.setup();
    renderAdd();
    await pasteAndRead(user, brokenJson);
    expect(screen.getByText(/The JSON couldn't be read/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Preview' })).not.toBeInTheDocument();
  });

  it('shows the message of an ai-error reply and saves nothing', async () => {
    const user = userEvent.setup();
    const { getState } = renderAdd();
    await pasteAndRead(user, errorJson);
    expect(screen.getByRole('alert')).toHaveTextContent(/because it is private/);
    expect(screen.queryByRole('region', { name: 'Preview' })).not.toBeInTheDocument();
    expect(getState().customRecipes).toHaveLength(0);
  });

  it('reads a reply with no JSON as plain text and says so', async () => {
    const user = userEvent.setup();
    renderAdd();
    await pasteAndRead(user, REPLY);
    expect(screen.getByText(PLAIN_TEXT_NOTICE)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Banana oat mash');
  });
});

describe('Add recipe: Instagram reel prompt (Req 19.1 to 19.8, 6.9, 6.10)', () => {
  const REEL = 'https://www.instagram.com/reel/abc123/';

  async function openReel(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'From an Instagram reel' }));
  }

  it('rewords the Instagram help to point to the reel option', () => {
    renderAdd();
    expect(INSTAGRAM_HELP).toMatch(/From an Instagram reel/);
    expect(screen.getByText(INSTAGRAM_HELP)).toBeInTheDocument();
  });

  it('validates the URL: https only, at most 500 characters, other hosts only warn', async () => {
    const user = userEvent.setup();
    renderAdd();
    await openReel(user);
    const box = screen.getByRole('textbox', { name: 'Reel link' });
    await user.click(box);
    await user.paste('http://www.instagram.com/reel/abc/');
    expect(screen.getByRole('alert')).toHaveTextContent('https://');
    await user.clear(box);
    await user.paste('https://example.com/video');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/doesn't look like an Instagram link/)).toBeInTheDocument();
    await user.clear(box);
    await user.paste(REEL);
    expect(screen.queryByText(/doesn't look like an Instagram link/)).not.toBeInTheDocument();
    await user.clear(box);
    await user.paste(`https://www.instagram.com/${'a'.repeat(500)}`);
    expect(screen.getByRole('alert')).toHaveTextContent(/too long/);
  });

  it('copies the reel prompt with no child data and offers Meta AI as a plain link', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(async () => '');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderAdd();
    await openReel(user);
    await user.click(screen.getByRole('button', { name: 'Copy reel prompt' }));
    expect(writeText).not.toHaveBeenCalled();
    await user.click(screen.getByRole('textbox', { name: 'Reel link' }));
    await user.paste(REEL);
    await user.click(screen.getByRole('button', { name: 'Copy reel prompt' }));
    const prompt = writeText.mock.calls[0][0] as string;
    expect(prompt).toBe(buildReelPrompt({ url: REEL }));
    expect(prompt).toContain(REEL);
    expect(prompt).not.toMatch(/Baby|month/i);
    expect(prompt).not.toContain(birthDateMonthsAgo(8));
    const meta = screen.getByRole('link', { name: 'Open Meta AI' });
    expect(meta).toHaveAttribute('href', 'https://www.meta.ai/');
    expect(meta).toHaveAttribute('target', '_blank');
    expect(screen.getByText(/any AI chat app that can open your\s+Instagram/)).toBeInTheDocument();
    network.expectNoNetwork();
  });

  it('presets Instagram, saves the URL only as the link and never fetches it', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    mockClipboard(async () => '');
    const { getState } = renderAdd();
    await openReel(user);
    await user.click(screen.getByRole('textbox', { name: 'Reel link' }));
    await user.paste(REEL);
    await user.click(screen.getByRole('button', { name: 'Copy reel prompt' }));
    await user.click(screen.getByRole('button', { name: 'Paste the answer' }));
    expect(screen.getByRole('radio', { name: 'Instagram' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: /Link/ })).toHaveValue(REEL);
    await pasteAndRead(user, validJson);
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    const saved = getState().customRecipes[0];
    expect(saved.imported?.from).toBe('instagram');
    expect(saved.imported?.url).toBe(REEL);
    expect(JSON.stringify(saved.steps)).not.toContain(REEL);
    network.expectNoNetwork();
  });

  it('shows the reel error and the caption tip for the cannot_access error object', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    mockClipboard(async () => '');
    const { getState } = renderAdd();
    await openReel(user);
    await user.click(screen.getByRole('textbox', { name: 'Reel link' }));
    await user.paste(REEL);
    await user.click(screen.getByRole('button', { name: 'Copy reel prompt' }));
    await user.click(screen.getByRole('button', { name: 'Paste the answer' }));
    await pasteAndRead(user, errorJson);
    expect(screen.getByRole('alert')).toHaveTextContent(REEL_ERROR);
    expect(screen.getByRole('alert')).toHaveTextContent(/pasting the caption instead/i);
    expect(screen.queryByRole('region', { name: 'Preview' })).not.toBeInTheDocument();
    expect(getState().customRecipes).toHaveLength(0);
    network.expectNoNetwork();
  });

  async function toReelPasteStep(user: ReturnType<typeof userEvent.setup>) {
    mockClipboard(async () => '');
    await openReel(user);
    await user.click(screen.getByRole('textbox', { name: 'Reel link' }));
    await user.paste(REEL);
    await user.click(screen.getByRole('button', { name: 'Copy reel prompt' }));
    await user.click(screen.getByRole('button', { name: 'Paste the answer' }));
  }

  it('shows the misread warning on the reel screen', async () => {
    const user = userEvent.setup();
    renderAdd();
    await openReel(user);
    expect(screen.getByText('AI apps can misread a reel. Check the ingredients.')).toBeInTheDocument();
  });

  it('shows no paste step for an empty or invalid link, even after Open Meta AI', async () => {
    const user = userEvent.setup();
    renderAdd();
    await openReel(user);
    const meta = screen.getByRole('link', { name: 'Open Meta AI' });
    meta.addEventListener('click', (event) => event.preventDefault());
    await user.click(meta);
    expect(screen.queryByRole('button', { name: 'Paste the answer' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('textbox', { name: 'Reel link' }));
    await user.paste('http://www.instagram.com/reel/abc/');
    await user.click(meta);
    await user.click(screen.getByRole('button', { name: 'Copy reel prompt' }));
    expect(screen.queryByRole('button', { name: 'Paste the answer' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Instagram' })).not.toBeChecked();
  });

  it('shows the paste step after Open Meta AI with a valid link', async () => {
    const user = userEvent.setup();
    renderAdd();
    await openReel(user);
    await user.click(screen.getByRole('textbox', { name: 'Reel link' }));
    await user.paste(REEL);
    const meta = screen.getByRole('link', { name: 'Open Meta AI' });
    meta.addEventListener('click', (event) => event.preventDefault());
    await user.click(meta);
    expect(screen.getByRole('button', { name: 'Paste the answer' })).toBeInTheDocument();
  });

  it('reel replies get the same intake and safety screen', async () => {
    const user = userEvent.setup();
    renderAdd();
    await toReelPasteStep(user);
    expect(screen.getByRole('radio', { name: 'Instagram' })).toBeChecked();

    // Invalid reply: field-level errors, no preview.
    await pasteAndRead(user, fractionJson);
    expect(screen.getByText(/quantity must be a number such as 0\.5/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Preview' })).not.toBeInTheDocument();

    // No-JSON reply: plain-text fallback.
    const box = screen.getByRole('textbox', { name: 'Recipe text' });
    await user.clear(box);
    await user.paste(REPLY);
    await user.click(screen.getByRole('button', { name: 'Read recipe' }));
    expect(screen.getByText(PLAIN_TEXT_NOTICE)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start over' }));

    // Valid reply with honey in a step: ghosted until "Not used".
    await pasteAndRead(user, jsonWith({ steps: ['Cook the oats.', 'Drizzle a little honey on top.'] }));
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(within(preview).getByText(/Honey is mentioned in the step/)).toBeInTheDocument();
  });

  it('keeps a link the user already typed and shows a note; replaces an earlier reel link', async () => {
    const user = userEvent.setup();
    renderAdd();
    await user.type(screen.getByRole('textbox', { name: /Link/ }), 'https://example.com/mine');
    await toReelPasteStep(user);
    expect(screen.getByRole('textbox', { name: /Link/ })).toHaveValue('https://example.com/mine');
    expect(screen.getByText(REEL_LINK_KEPT)).toBeInTheDocument();
  });

  it('replaces the link when it came from an earlier reel', async () => {
    const user = userEvent.setup();
    renderAdd();
    await toReelPasteStep(user);
    expect(screen.getByRole('textbox', { name: /Link/ })).toHaveValue(REEL);
    const box = screen.getByRole('textbox', { name: 'Reel link' });
    await user.clear(box);
    await user.paste('https://www.instagram.com/reel/second/');
    await user.click(screen.getByRole('button', { name: 'Copy reel prompt' }));
    await user.click(screen.getByRole('button', { name: 'Paste the answer' }));
    expect(screen.getByRole('textbox', { name: /Link/ })).toHaveValue('https://www.instagram.com/reel/second/');
    expect(screen.queryByText(REEL_LINK_KEPT)).not.toBeInTheDocument();
  });

  it('has one filled primary button with the reel panel open, and none added by it', async () => {
    const user = userEvent.setup();
    renderAdd();
    await openReel(user);
    expect(primariesOnPage()).toEqual(['Paste']);
  });
});

function primariesOnPage(): string[] {
  return Array.from(document.querySelectorAll('[data-variant="primary"]')).map(
    (el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
  );
}
