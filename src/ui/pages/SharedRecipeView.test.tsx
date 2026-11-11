import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import { encodeRecipeShare } from '../../domain/recipeShare';
import type { AppState, Recipe } from '../../domain/types';
import { spyOnNetwork } from '../../test/networkSpy';

function makeStorage(seed: AppState): Storage & { raw: () => AppState } {
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
    raw: () => JSON.parse(map.get(STORAGE_KEY) ?? 'null') as AppState,
  };
}

function birthDateMonthsAgo(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seed(): AppState {
  return {
    ...defaultState(new Date()),
    child: { name: 'Zed', birthDate: birthDateMonthsAgo(8) },
    onboarded: true,
    disclaimerAcknowledged: true,
    dismissed: { 'pantry-setup': new Date().toISOString() },
  };
}

const SENDER_RECIPE: Recipe = {
  id: 'custom-sender-id',
  origin: 'custom',
  title: 'Oat Bowl',
  stages: ['6-8'],
  mealTypes: ['breakfast'],
  ingredients: [
    { name: 'oats', quantity: 1, unit: 'cup', category: 'grains' },
    { name: 'whole grapes', quantity: 4, category: 'produce' },
  ],
  steps: ['Cook the oats.', 'Add a little honey on top.'],
  texture: 'smooth',
  servings: 2,
  imported: { from: 'chatgpt', text: 'ORIGINAL-PASTE-MARKER', date: '2026-01-01' },
  clearedMentions: [{ ruleId: 'honey', sentence: 'Add a little honey on top.' }],
};

function renderAt(path: string, storage: Storage) {
  return render(
    <AppProvider storage={storage}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AppProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('Shared recipe view (/r/:data)', () => {
  it('shows the recipe read-only with prep reminders and one Add action', () => {
    const storage = makeStorage(seed());
    renderAt(`/r/${encodeRecipeShare(SENDER_RECIPE).encoded}`, storage);
    expect(screen.getByRole('heading', { level: 1, name: 'Oat Bowl' })).toBeInTheDocument();
    expect(screen.getByText(/1 cup oats/)).toBeInTheDocument();
    expect(screen.getByText('Cook the oats.')).toBeInTheDocument();
    expect(screen.getAllByRole('note').length).toBeGreaterThan(0); // grapes prep
    expect(screen.getByRole('button', { name: 'Add to my recipes' })).toBeInTheDocument();
    // No app shell, no edit controls, no original text.
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText(/ORIGINAL-PASTE-MARKER/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit|delete/i })).not.toBeInTheDocument();
    expect(screen.getByText(/not medical advice/i)).toBeInTheDocument();
  });

  it('shows the viewer\'s block and text-mention findings before Add, and saves nothing', () => {
    const storage = makeStorage(seed());
    const setItem = vi.spyOn(storage, 'setItem');
    const blocked: Recipe = {
      ...SENDER_RECIPE,
      ingredients: [...SENDER_RECIPE.ingredients, { name: 'honey', quantity: 1, unit: 'tsp', category: 'pantry' }],
    };
    renderAt(`/r/${encodeRecipeShare(blocked).encoded}`, storage);
    const notYet = screen.getByRole('heading', { name: 'Not yet' }).closest('section')!;
    expect(within(notYet).getByText(/^honey:/i)).toBeInTheDocument();
    expect(within(notYet).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(setItem.mock.calls.filter(([key]) => key === STORAGE_KEY)).toEqual([]);
    expect(storage.raw().customRecipes).toEqual([]);
  });

  it('shows a text mention in the steps as the recipe page will', () => {
    renderAt(`/r/${encodeRecipeShare(SENDER_RECIPE).encoded}`, makeStorage(seed()));
    const notYet = screen.getByRole('heading', { name: 'Not yet' }).closest('section')!;
    expect(within(notYet).getByText(/Add a little honey on top\./)).toBeInTheDocument();
    expect(within(notYet).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows no findings panel when nothing is blocked', () => {
    const clean: Recipe = { ...SENDER_RECIPE, steps: ['Cook the oats.'] };
    renderAt(`/r/${encodeRecipeShare(clean).encoded}`, makeStorage(seed()));
    expect(screen.queryByRole('heading', { name: 'Not yet' })).not.toBeInTheDocument();
  });

  it('saves nothing until Add is tapped', () => {
    const storage = makeStorage(seed());
    const setItem = vi.spyOn(storage, 'setItem');
    renderAt(`/r/${encodeRecipeShare(SENDER_RECIPE).encoded}`, storage);
    expect(setItem.mock.calls.filter(([key]) => key === STORAGE_KEY)).toEqual([]);
    expect(storage.raw().customRecipes).toEqual([]);
  });

  it.each([['garbage'], ['A'.repeat(9000)]])(
    'shows only the error for an unreadable or oversized link (%#)',
    (data) => {
      renderAt(`/r/${data}`, makeStorage(seed()));
      expect(screen.getByRole('alert')).toHaveTextContent(
        "This link can’t be read. Ask for a new one.",
      );
      expect(screen.queryByRole('button', { name: 'Add to my recipes' })).not.toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    },
  );

  it('Add saves a custom recipe marked imported, screened for the recipient, then opens it', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    const storage = makeStorage(seed());
    renderAt(`/r/${encodeRecipeShare(SENDER_RECIPE).encoded}`, storage);
    await user.click(screen.getByRole('button', { name: 'Add to my recipes' }));

    await waitFor(() => expect(storage.raw().customRecipes).toHaveLength(1));
    const saved = storage.raw().customRecipes[0];
    expect(saved.origin).toBe('custom');
    expect(saved.id).not.toBe('custom-sender-id');
    expect(saved.imported).toMatchObject({ from: 'shared' });
    expect(saved.imported?.text).toContain('Oat Bowl');
    expect(saved.source).toBeUndefined();
    expect(saved.clearedMentions ?? []).toEqual([]);
    expect(JSON.stringify(saved)).not.toContain('ORIGINAL-PASTE-MARKER');

    // The recipe page: the honey mention is NOT pre-cleared, so it is ghosted.
    expect(await screen.findByRole('heading', { level: 1, name: 'Oat Bowl' })).toBeInTheDocument();
    const notYet = screen.getByRole('heading', { name: 'Not yet' }).closest('section')!;
    expect(within(notYet).getByText(/Add a little honey on top\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to plan' })).not.toBeInTheDocument();

    // The user clears it with a tap, as for a pasted recipe.
    await user.click(within(notYet).getByRole('button', { name: 'Not used in this recipe' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Not yet' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Add to plan' })).toBeInTheDocument();
    network.expectNoNetwork();
  });

  it('makes no network calls when opened', () => {
    const network = spyOnNetwork();
    renderAt(`/r/${encodeRecipeShare(SENDER_RECIPE).encoded}`, makeStorage(seed()));
    network.expectNoNetwork();
  });
});

describe('Share recipe on the recipe page', () => {
  const OWN: Recipe = { ...SENDER_RECIPE, id: 'custom-own' };
  const stateWithOwn = () => ({ ...seed(), customRecipes: [OWN] });

  function setShare(fn: unknown) {
    Object.defineProperty(navigator, 'share', { value: fn, configurable: true, writable: true });
  }
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'share');
  });

  it('opens the share sheet with the text and the link, with nothing about the child or paste', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    renderAt('/recipes/custom-own', makeStorage(stateWithOwn()));
    await user.click(screen.getByRole('button', { name: 'Share recipe' }));

    expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0][0] as { title: string; text: string; url: string };
    expect(arg.title).toBe('Oat Bowl');
    expect(arg.url).toMatch(/#\/r\/.+/);
    expect(arg.text).toContain('Shared from FirstMenu. Not medical advice; check with your pediatrician.');
    expect(arg.text).toContain('Ingredients');
    const all = JSON.stringify(arg);
    expect(all).not.toMatch(/Zed|ORIGINAL-PASTE-MARKER|custom-own/);
    network.expectNoNetwork();
  });

  it('copies the text and link when there is no share sheet', async () => {
    const user = userEvent.setup();
    const network = spyOnNetwork();
    renderAt('/recipes/custom-own', makeStorage(stateWithOwn()));
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    await user.click(screen.getByRole('button', { name: 'Share recipe' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0];
    expect(copied).toContain('Oat Bowl');
    expect(copied).toMatch(/https:\/\/.*#\/r\//);
    expect(copied).not.toMatch(/Zed|ORIGINAL-PASTE-MARKER/);
    expect(await screen.findByText('Copied the recipe and link.')).toBeInTheDocument();
    network.expectNoNetwork();
  });

  it('does nothing more when the user closes the share sheet', async () => {
    const user = userEvent.setup();
    setShare(vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')));
    renderAt('/recipes/custom-own', makeStorage(stateWithOwn()));
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    await user.click(screen.getByRole('button', { name: 'Share recipe' }));
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies when the share sheet fails for another reason', async () => {
    const user = userEvent.setup();
    setShare(vi.fn().mockRejectedValue(new Error('nope')));
    renderAt('/recipes/custom-own', makeStorage(stateWithOwn()));
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    await user.click(screen.getByRole('button', { name: 'Share recipe' }));
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('says so when copying fails', async () => {
    const user = userEvent.setup();
    renderAt('/recipes/custom-own', makeStorage(stateWithOwn()));
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    await user.click(screen.getByRole('button', { name: 'Share recipe' }));
    expect(await screen.findByText(/Could not copy/)).toBeInTheDocument();
  });

  it('is on a built-in recipe page too (Req 9.1)', () => {
    renderAt('/recipes/b-carrots-and-apples', makeStorage(seed()));
    expect(screen.getByRole('button', { name: 'Share recipe' })).toBeInTheDocument();
  });
});
