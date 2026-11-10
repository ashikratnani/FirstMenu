import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Make from './Make';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState, Ingredient, Recipe } from '../../domain/types';

// The built-in recipes would add dozens of unrelated results. Every test here
// uses custom recipes with made-up foods, so the built-ins are emptied.
vi.mock('../../data/recipes', () => ({ BUILTIN_RECIPES: [] }));

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

function birthDateMonthsAgo(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ing(name: string): Ingredient {
  return { name, category: 'other' };
}

/** Custom recipes use made-up foods so built-in recipes never interfere. */
function recipe(
  id: string,
  title: string,
  foods: string[],
  extra: Partial<Recipe> = {},
): Recipe {
  return {
    id,
    origin: 'custom',
    title,
    stages: ['9-12'],
    mealTypes: ['dinner'],
    ingredients: foods.map(ing),
    steps: ['Mix.'],
    texture: 'soft',
    servings: 2,
    statedMinutes: 10,
    ...extra,
  };
}

const READY = recipe('c-ready', 'Blorp Mash', ['blorp', 'flib'], { statedMinutes: 20 });
const QUICK = recipe('c-quick', 'Quick Flib', ['flib'], { statedMinutes: 5 });
const ONE_MISSING = recipe('c-one', 'Blorp Zonk Bowl', ['blorp', 'zonk']);
const TWO_MISSING = recipe('c-two', 'Zonk Wumble Pie', ['zonk', 'wumble']);
const GHOSTED = recipe('c-honey', 'Honey Blorp Bites', ['honey', 'blorp']);
const IRON = recipe('c-iron', 'Lentil Blorp', ['lentil', 'blorp']);
const YOUNG = recipe('c-young', 'Young Flib Puree', ['flib'], { stages: ['6-8'] });

function seedState(extra: Partial<AppState> = {}, ageMonths = 10): AppState {
  const s = defaultState(new Date());
  return {
    ...s,
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(ageMonths) },
    onboarded: true,
    pantry: ['blorp', 'flib'],
    customRecipes: [READY, QUICK, ONE_MISSING, TWO_MISSING, GHOSTED, IRON, YOUNG],
    // Mark the first-use pantry offer as skipped unless a test wants it.
    dismissed: { 'pantry-setup': new Date().toISOString() },
    ...extra,
  };
}

function renderMake(seed?: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={['/']}>
        <Make />
      </MemoryRouter>
    </AppProvider>,
  );
}

/** The visible card for a recipe, found through its link. */
function card(name: RegExp): HTMLElement {
  const item = screen.getByRole('link', { name }).closest('li');
  if (!item) throw new Error('card not found');
  return item;
}

function group(name: RegExp): HTMLElement {
  return screen.getByRole('region', { name });
}

describe('Make screen groups (Req 3.4)', () => {
  it('shows the title and puts recipes with nothing missing in Ready now', () => {
    renderMake(seedState());
    expect(screen.getByRole('heading', { level: 1, name: 'What can I make?' })).toBeInTheDocument();
    const ready = group(/Ready now/);
    expect(within(ready).getByRole('link', { name: /Blorp Mash/ })).toBeInTheDocument();
    expect(within(ready).getByRole('link', { name: /Quick Flib/ })).toBeInTheDocument();
  });

  it('puts a recipe missing one food in Missing one, naming the food', () => {
    renderMake(seedState());
    const missing = group(/Missing one/);
    const link = within(missing).getByRole('link', { name: /Blorp Zonk Bowl/ });
    expect(link).toHaveAccessibleName(/Missing: zonk/);
    expect(within(card(/Blorp Zonk Bowl/)).getByText('Missing: zonk')).toBeInTheDocument();
  });

  it('hides recipes missing two or more foods', () => {
    renderMake(seedState());
    expect(screen.queryByRole('link', { name: /Zonk Wumble Pie/ })).not.toBeInTheDocument();
  });

  it('"I have this" adds the food to on-hand and moves the recipe to Ready now', async () => {
    const user = userEvent.setup();
    renderMake(seedState());
    expect(within(group(/Ready now/)).queryByRole('link', { name: /Blorp Zonk Bowl/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'I have this: zonk' }));

    expect(within(group(/Ready now/)).getByRole('link', { name: /Blorp Zonk Bowl/ })).toBeInTheDocument();
    // The food shows as an on-hand chip, and the recipe left Missing one.
    expect(within(screen.getByRole('list', { name: 'On hand today' })).getByText('zonk')).toBeInTheDocument();
    expect(within(group(/Missing one/)).queryByRole('link', { name: /Blorp Zonk Bowl/ })).toBeNull();
  });

  it('sorts a group by time, shortest first (Req 3.7)', () => {
    renderMake(seedState());
    const links = within(group(/Ready now/)).getAllByRole('link');
    expect(links[0]).toHaveAccessibleName(/^Quick Flib/);
    expect(links[1]).toHaveAccessibleName(/^Blorp Mash/);
  });

  it('shows time, effort and tags on each result (Req 3.8)', () => {
    renderMake(seedState());
    const item = card(/Lentil Blorp/);
    expect(within(item).getByText(/10 min · Easy/)).toBeInTheDocument();
    expect(within(item).getByText('Iron-rich')).toBeInTheDocument();
  });

  it('marks an estimated time with "about" and a missing one as "Time not given"', () => {
    const estimated = recipe('c-est', 'Steamed Flib', ['flib'], {
      statedMinutes: undefined,
      steps: ['Steam for 10 minutes.'],
    });
    const none = recipe('c-none', 'Plain Flib', ['flib'], { statedMinutes: undefined });
    renderMake(seedState({ customRecipes: [estimated, none] }));
    expect(within(card(/Steamed Flib/)).getByText(/about 15 min/)).toBeInTheDocument();
    expect(within(card(/Plain Flib/)).getByText(/Time not given/)).toBeInTheDocument();
  });

  it('shows a door badge naming untried foods (Req 3.8)', () => {
    renderMake(seedState());
    expect(within(card(/Blorp Mash/)).getByText(/New food: blorp/)).toBeInTheDocument();
  });
});

describe('Make screen ghosted recipes (Req 3.5)', () => {
  it('never lists a ghosted recipe in a group and reports the count', () => {
    renderMake(seedState());
    expect(within(group(/Ready now/)).queryByRole('link', { name: /Honey Blorp Bites/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Honey Blorp Bites/ })).not.toBeInTheDocument();
    expect(screen.getByText(/1 recipe is left out/)).toBeInTheDocument();
  });

  it('expands the left-out recipes as ghosts with their reasons', async () => {
    const user = userEvent.setup();
    renderMake(seedState());
    await user.click(screen.getByRole('button', { name: 'Show left-out recipes' }));
    const ghost = screen.getByLabelText(/Honey Blorp Bites\. Not yet: honey\. Available at 12 months\./);
    expect(ghost).toBeInTheDocument();
    expect(within(ghost).getByRole('link', { name: /Honey Blorp Bites/ })).toHaveAttribute(
      'href',
      '/recipes/c-honey',
    );
    await user.click(screen.getByRole('button', { name: 'Hide left-out recipes' }));
    expect(screen.queryByLabelText(/Honey Blorp Bites/)).not.toBeInTheDocument();
  });

  it('counts only ghosted recipes that match every active filter', async () => {
    const user = userEvent.setup();
    renderMake(seedState());
    expect(screen.getByText(/1 recipe is left out/)).toBeInTheDocument();
    // Honey Blorp Bites has no Iron-rich ingredient, so the filter drops it.
    await user.click(screen.getByRole('button', { name: 'Iron-rich only' }));
    expect(screen.queryByText(/left out/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lentil Blorp/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Blorp Mash/ })).not.toBeInTheDocument();
  });

  it('ghosts a recipe whose food has a recorded reaction', () => {
    renderMake(seedState({ foods: { flib: { status: 'reaction', date: '2026-11-10' } } }));
    expect(screen.queryByRole('link', { name: /Quick Flib/ })).not.toBeInTheDocument();
    expect(screen.getByText(/recipes are left out/)).toBeInTheDocument();
  });
});

describe('Make screen filters (Req 3.6, 3.9)', () => {
  it('shows only recipes for the child\'s stage until "All stages" is on', async () => {
    const user = userEvent.setup();
    renderMake(seedState());
    expect(screen.queryByRole('link', { name: /Young Flib Puree/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All stages' }));
    expect(screen.getByRole('link', { name: /Young Flib Puree/ })).toBeInTheDocument();
  });

  it('"Iron-rich only" toggles on and off', async () => {
    const user = userEvent.setup();
    renderMake(seedState());
    const toggle = screen.getByRole('button', { name: 'Iron-rich only' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(screen.getByRole('link', { name: /Blorp Mash/ })).toBeInTheDocument();
  });
});

describe('Make screen on-hand foods (Req 3.1, 3.2)', () => {
  it('tapping a suggested food adds it to on-hand; its chip can be removed', async () => {
    const user = userEvent.setup();
    renderMake(seedState());
    const suggested = screen.getByRole('list', { name: 'Tap what you have' });
    await user.click(within(suggested).getByRole('button', { name: 'zonk' }));
    const onHand = screen.getByRole('list', { name: 'On hand today' });
    expect(within(onHand).getByText('zonk')).toBeInTheDocument();
    // It leaves the suggested list once picked.
    expect(within(screen.getByRole('list', { name: 'Tap what you have' })).queryByRole('button', { name: 'zonk' })).toBeNull();

    await user.click(within(onHand).getByRole('button', { name: /Remove zonk/ }));
    expect(screen.queryByRole('list', { name: 'On hand today' })).not.toBeInTheDocument();
  });

  it('Clear removes every on-hand food in one tap', async () => {
    const user = userEvent.setup();
    renderMake(seedState({ onHand: ['zonk', 'wumble'], onHandUpdated: '2026-01-01' }));
    expect(within(screen.getByRole('list', { name: 'On hand today' })).getAllByRole('listitem')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('list', { name: 'On hand today' })).not.toBeInTheDocument();
  });

  it('counts on-hand foods together with the pantry', () => {
    renderMake(seedState({ onHand: ['zonk'] }));
    expect(within(group(/Ready now/)).getByRole('link', { name: /Blorp Zonk Bowl/ })).toBeInTheDocument();
  });
});

describe('Make screen pantry (Req 2.1 to 2.4)', () => {
  it('offers the suggested list on first use and lets the user skip it', async () => {
    const user = userEvent.setup();
    renderMake(seedState({ pantry: [], dismissed: {} }));
    expect(screen.getByRole('heading', { name: 'Set up your pantry' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'oat' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(screen.queryByRole('heading', { name: 'Set up your pantry' })).not.toBeInTheDocument();
    expect(screen.getByText('Pantry: 0 foods')).toBeInTheDocument();
  });

  it('ticking suggested foods fills the pantry', async () => {
    const user = userEvent.setup();
    renderMake(seedState({ pantry: [], dismissed: {} }));
    await user.click(screen.getByRole('checkbox', { name: 'oat' }));
    await user.click(screen.getByRole('checkbox', { name: 'rice' }));
    expect(screen.getByRole('checkbox', { name: 'oat' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Pantry: 2 foods')).toBeInTheDocument();
  });

  it('does not offer the list again once skipped', () => {
    renderMake(seedState({ pantry: [] }));
    expect(screen.queryByRole('heading', { name: 'Set up your pantry' })).not.toBeInTheDocument();
  });

  it('edits the pantry in a dialog by typing any food name', async () => {
    const user = userEvent.setup();
    renderMake(seedState());
    expect(screen.getByText('Pantry: 2 foods')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit pantry' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: /Add a food to your pantry/ }), 'Sweet potatoes');
    await user.click(within(dialog).getByRole('button', { name: 'Add to pantry' }));
    // Typing "Sweet potatoes" stores the plain key `sweet potato`.
    expect(within(dialog).getByText('sweet potato')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByText('Pantry: 3 foods')).toBeInTheDocument());
  });
});

describe('Make screen empty state (Req 3.10)', () => {
  it('says so and offers the prompt helper when nothing fits', async () => {
    const user = userEvent.setup();
    renderMake(seedState({ pantry: [], customRecipes: [TWO_MISSING] }));
    expect(screen.getByRole('heading', { name: 'Nothing fits yet' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ask ChatGPT' }));
    const question = screen.getByRole('textbox', { name: 'Your question for ChatGPT' }) as HTMLTextAreaElement;
    expect(question.value).toMatch(/10-month-old baby/);
    // The question never carries the child's name (Req 8.5).
    expect(question.value).not.toMatch(/Baby\b.*Baby/);
    expect(screen.getByRole('link', { name: 'Open ChatGPT' })).toHaveAttribute('target', '_blank');
  });

  it('does not show the empty state when something is ready', () => {
    renderMake(seedState());
    expect(screen.queryByRole('heading', { name: 'Nothing fits yet' })).not.toBeInTheDocument();
  });
});

describe('Make screen search box (Req 3.1, 3.9, 16.5 to 16.9, 16.12)', () => {
  const CHICKEN_PLATE = recipe('c-plate', 'Chicken Plate', ['chicken', 'rice', 'pea']);
  const WITH_BROCCOLI = recipe('c-bro', 'Broccoli Rice', ['broccoli', 'rice']);
  const PANCAKES = recipe('c-pan', 'Banana Pancakes', ['banana', 'flour', 'egg'], {
    mealTypes: ['breakfast'],
  });
  const PORRIDGE = recipe('c-por', 'Warm Porridge', ['oat', 'milk'], { mealTypes: ['breakfast'] });
  const SUPPER = recipe('c-sup', 'Late Stew', ['carrot', 'potato'], { mealTypes: ['dinner'] });
  const FINGER = recipe('c-fin', 'Pea Bites', ['pea', 'rice'], { serveAs: ['finger-food'] });
  const SOFT = recipe('c-soft', 'Pea Puree', ['pea', 'rice'], { serveAs: ['puree'] });
  const LENTIL = recipe('c-len', 'Lentil Soup', ['lentil', 'rice']);

  const seed = (extra: Partial<AppState> = {}) =>
    seedState({
      pantry: [],
      customRecipes: [CHICKEN_PLATE, WITH_BROCCOLI, PANCAKES, PORRIDGE, SUPPER, FINGER, SOFT, LENTIL],
      ...extra,
    });

  const box = () => screen.getByRole('textbox', { name: 'What do you have?' });

  it('has one text box on the screen', () => {
    renderMake(seed());
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('shows three chips for "leftover chicken, rice and peas" and updates results', async () => {
    const user = userEvent.setup();
    renderMake(seed());
    expect(screen.queryByRole('link', { name: /Chicken Plate/ })).not.toBeInTheDocument();

    await user.type(box(), 'leftover chicken, rice and peas');

    const chips = await screen.findByRole('list', { name: 'Recognized foods' });
    expect(within(chips).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('chicken'),
      expect.stringContaining('rice'),
      expect.stringContaining('pea'),
    ]);
    // Results behave as if those foods were on hand, before Enter.
    expect(
      await within(group(/Ready now/)).findByRole('link', { name: /Chicken Plate/ }),
    ).toBeInTheDocument();
    // Nothing is stored yet.
    expect(screen.queryByRole('list', { name: 'On hand today' })).not.toBeInTheDocument();
  });

  it('a chip can be removed before adding, and its recipe drops back out', async () => {
    const user = userEvent.setup();
    renderMake(seed());
    await user.type(box(), 'chicken rice peas');
    await screen.findByRole('link', { name: /Chicken Plate/ });
    const chips = screen.getByRole('list', { name: 'Recognized foods' });
    await user.click(within(chips).getByRole('button', { name: /Remove chicken/ }));
    expect(await screen.findByRole('region', { name: /Missing one/ })).toBeInTheDocument();
    expect(within(group(/Missing one/)).getByRole('link', { name: /Chicken Plate/ })).toBeInTheDocument();
  });

  it('a typo needs a tap before it counts', async () => {
    const user = userEvent.setup();
    renderMake(seed({ pantry: ['rice'] }));
    await user.type(box(), 'brocoli');

    const didYouMean = await screen.findByRole('button', { name: 'Did you mean broccoli?' });
    // Not counted yet: Broccoli Rice still needs broccoli.
    expect(within(group(/Missing one/)).getByRole('link', { name: /Broccoli Rice/ })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Recognized foods' })).not.toBeInTheDocument();

    await user.click(didYouMean);
    expect(within(group(/Ready now/)).getByRole('link', { name: /Broccoli Rice/ })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'On hand today' })).getByText('broccoli'),
    ).toBeInTheDocument();
    // The typed word is gone from the box.
    expect(box()).toHaveValue('');
  });

  it('Enter moves the recognized foods to on-hand and clears the box', async () => {
    const user = userEvent.setup();
    renderMake(seed());
    await user.type(box(), 'chicken and rice{Enter}');
    const onHand = screen.getByRole('list', { name: 'On hand today' });
    expect(within(onHand).getByText('chicken')).toBeInTheDocument();
    expect(within(onHand).getByText('rice')).toBeInTheDocument();
    expect(box()).toHaveValue('');
    expect(screen.queryByRole('list', { name: 'Recognized foods' })).not.toBeInTheDocument();
  });

  it('"Add" does the same as Enter', async () => {
    const user = userEvent.setup();
    renderMake(seed());
    await user.type(box(), 'lentils');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(
      within(screen.getByRole('list', { name: 'On hand today' })).getByText('lentil'),
    ).toBeInTheDocument();
    expect(box()).toHaveValue('');
  });

  it('lists words it cannot place under "Not recognized"', async () => {
    const user = userEvent.setup();
    renderMake(seed());
    await user.type(box(), 'rice and zorbleflax');
    expect(await screen.findByText('Not recognized: zorbleflax')).toBeInTheDocument();
  });

  it('"something for breakfast" alone shows breakfast recipes, including More ideas', async () => {
    const user = userEvent.setup();
    renderMake(seed({ pantry: ['oat'] }));
    await user.type(box(), 'something for breakfast');

    expect(
      await screen.findByRole('list', { name: 'Filters in use' }),
    ).toHaveTextContent('Breakfast');
    // Warm Porridge needs milk (one missing); Banana Pancakes needs three.
    expect(within(group(/Missing one/)).getByRole('link', { name: /Warm Porridge/ })).toBeInTheDocument();
    const more = group(/More ideas/);
    expect(within(more).getByRole('link', { name: /Banana Pancakes/ })).toHaveAccessibleName(
      /Missing: banana, flour and egg/,
    );
    expect(screen.queryByRole('link', { name: /Late Stew/ })).not.toBeInTheDocument();
  });

  it('"finger food" filters to finger-food recipes', async () => {
    const user = userEvent.setup();
    renderMake(seed({ pantry: ['pea', 'rice'] }));
    expect(screen.getByRole('link', { name: /Pea Puree/ })).toBeInTheDocument();
    await user.type(box(), 'finger food');
    await waitFor(() => expect(screen.queryByRole('link', { name: /Pea Puree/ })).not.toBeInTheDocument());
    expect(within(group(/Ready now/)).getByRole('link', { name: /Pea Bites/ })).toBeInTheDocument();
  });

  it('typing "iron rich" turns on "Iron-rich only"; removing the chip turns it off', async () => {
    const user = userEvent.setup();
    renderMake(seed({ pantry: ['lentil', 'rice', 'pea'] }));
    const toggle = screen.getByRole('button', { name: 'Iron-rich only' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.type(box(), 'iron rich');
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.queryByRole('link', { name: /Pea Puree/ })).not.toBeInTheDocument();

    const chips = screen.getByRole('list', { name: 'Filters in use' });
    await user.click(within(chips).getByRole('button', { name: /Remove Iron-rich/ }));
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    // The phrase left the box too, so the filter does not come back.
    expect(box()).toHaveValue('');
    expect(screen.getByRole('link', { name: /Pea Puree/ })).toBeInTheDocument();
  });

  it('turning the toggle off also removes a typed "iron rich"', async () => {
    const user = userEvent.setup();
    renderMake(seed({ pantry: ['lentil', 'rice'] }));
    await user.type(box(), 'iron rich');
    const toggle = screen.getByRole('button', { name: 'Iron-rich only' });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(box()).toHaveValue('');
  });

  it('a filter stays on as a removable chip after Add', async () => {
    const user = userEvent.setup();
    renderMake(seed({ pantry: ['oat'] }));
    await user.type(box(), 'lunch with rice{Enter}');
    const chips = screen.getByRole('list', { name: 'Filters in use' });
    expect(chips).toHaveTextContent('Lunch');
    await user.click(within(chips).getByRole('button', { name: /Remove Lunch/ }));
    expect(screen.queryByRole('list', { name: 'Filters in use' })).not.toBeInTheDocument();
  });

  it('shows "Recipes named ..." with ghosted recipes as ghosts', async () => {
    const user = userEvent.setup();
    const honeyPancake = recipe('c-hp', 'Honey Pancake', ['honey', 'flour']);
    renderMake(seed({ customRecipes: [PANCAKES, honeyPancake] }));
    await user.type(box(), 'pancakes');
    const named = await screen.findByRole('region', { name: /Recipes named/ });
    expect(within(named).getByRole('link', { name: /Banana Pancakes/ })).toHaveAccessibleName(/Missing:/);
    expect(
      within(named).getByLabelText(/Honey Pancake\. Not yet: honey\. Available at 12 months\./),
    ).toBeInTheDocument();
  });
});
