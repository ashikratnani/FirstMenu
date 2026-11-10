import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import RecipeDetail, { AddToPlan } from './RecipeDetail';
import { useApp } from '../../state/AppProvider';
import Recipes from './Recipes';
import { AppProvider } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import { NOT_MEDICAL_ADVICE } from '../components/Disclaimer';
import type { AppState, Recipe } from '../../domain/types';

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

/** A custom recipe containing honey -> blocks under 12 months -> ghosted. */
const HONEY_RECIPE: Recipe = {
  id: 'custom-honey',
  origin: 'custom',
  title: 'Honey Oat Mash',
  stages: ['6-8', '9-12'],
  mealTypes: ['breakfast'],
  ingredients: [
    { name: 'honey', category: 'pantry' },
    { name: 'oats', category: 'grains' },
  ],
  steps: ['Mix.'],
  texture: 'smooth',
  servings: 1,
  storage: { fridgeDays: 2 },
};

/** A custom recipe with grapes -> "Quarter lengthwise before serving." prep. */
const GRAPE_RECIPE: Recipe = {
  id: 'custom-grapes',
  origin: 'custom',
  title: 'Grape Mash',
  stages: ['9-12'],
  mealTypes: ['snack'],
  ingredients: [
    { name: 'red grapes', quantity: 6, unit: 'piece', category: 'produce' },
    { name: 'plain yogurt', quantity: 0.5, unit: 'cup', category: 'dairy-eggs' },
  ],
  steps: ['Quarter the grapes.', 'Stir into the yogurt.'],
  texture: 'soft',
  servings: 1,
};

function seedState(ageMonths = 8, customRecipes: Recipe[] = []): AppState {
  const s = defaultState(new Date());
  return {
    ...s,
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(ageMonths) },
    onboarded: true,
    customRecipes,
  };
}

/** Seed with Breakfast and Lunch switched on in the Plan page. */
function withSlots(s: AppState): AppState {
  return { ...s, plan: { ...s.plan, activeSlots: ['breakfast', 'lunch'] } };
}

/** Captures the live app state (persistence is debounced, so read it here). */
let latestState: AppState;
function StateProbe() {
  latestState = useApp().state;
  return null;
}

function renderDetail(id: string, seed?: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={[`/recipes/${id}`]}>
        <Routes>
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/recipes" element={<Recipes />} />
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
}

describe('RecipeDetail page', () => {
  it('renders a built-in recipe: ingredients, steps, storage, source and disclaimer', () => {
    renderDetail('b-carrots-and-apples', seedState(8));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Carrots and Apples' }),
    ).toBeInTheDocument();

    // Ingredients with quantity labels.
    expect(
      screen.getByText(/carrots, peeled and sliced/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 cup/)).toBeInTheDocument();

    // Steps (ordered list).
    const stepsHeading = screen.getByRole('heading', { name: 'Steps' });
    const stepsList = stepsHeading.nextElementSibling;
    expect(stepsList?.tagName).toBe('OL');
    expect(stepsList?.querySelectorAll('li').length).toBe(3);

    // Storage text (fridge 2 days, freezer 1 month).
    expect(
      screen.getByText('Keeps in the fridge for 2 days'),
    ).toBeInTheDocument();
    expect(screen.getByText('Freezes for 1 month')).toBeInTheDocument();

    // Source link + adaptations.
    const sourceLink = screen.getByRole('link', { name: 'Carrots and Apples' });
    expect(sourceLink).toHaveAttribute(
      'href',
      'https://www.health.state.mn.us/people/wic/recipes/babyfood.html',
    );
    expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(sourceLink).toHaveAttribute('target', '_blank');
    expect(
      screen.getByRole('heading', { name: 'Adaptations' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Serving count is an estimate/)).toBeInTheDocument();

    // Shared disclaimer in the footer.
    expect(screen.getByText(NOT_MEDICAL_ADVICE)).toBeInTheDocument();
  });

  it('shows a per-ingredient prep reminder for an ingredient that triggers one', () => {
    // carrots + apple both trigger the hard-produce "Cook until soft" reminder.
    renderDetail('b-carrots-and-apples', seedState(8));
    expect(
      screen.getAllByText('Prep: Cook until soft or grate finely.').length,
    ).toBeGreaterThan(0);
  });

  it('shows a grape prep reminder on a custom recipe', () => {
    renderDetail('custom-grapes', seedState(10, [GRAPE_RECIPE]));
    expect(
      screen.getByText('Prep: Quarter lengthwise before serving.'),
    ).toBeInTheDocument();
  });

  it('shows block reasons with the availability note for a ghosted recipe', () => {
    renderDetail('custom-honey', seedState(8, [HONEY_RECIPE]));

    expect(
      screen.getByRole('heading', { name: 'Not yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Honey can cause infant botulism/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Available at 12 months\./),
    ).toBeInTheDocument();
  });

  it('does not ghost the honey recipe once the child is old enough', () => {
    renderDetail('custom-honey', seedState(13, [HONEY_RECIPE]));
    expect(
      screen.queryByRole('heading', { name: 'Not yet' }),
    ).not.toBeInTheDocument();
  });

  it('a built-in recipe exposes no Edit or Delete control', () => {
    renderDetail('b-carrots-and-apples', seedState(8));
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('a custom recipe exposes Edit (to /recipes/:id/edit) and Delete', async () => {
    const user = userEvent.setup();
    renderDetail('custom-grapes', seedState(10, [GRAPE_RECIPE]));

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/recipes/custom-grapes/edit',
    );

    // Delete navigates back to the library.
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Recipes' }),
    ).toBeInTheDocument();
  });

  it('deleting a plan-used custom recipe surfaces the emptied-slot notice (Req 3.5)', async () => {
    const user = userEvent.setup();
    const seed = seedState(10, [GRAPE_RECIPE]);
    // The custom recipe occupies a plan slot.
    seed.plan.days[2] = { snack: 'custom-grapes' };

    renderDetail('custom-grapes', seed);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // Landed on the library, which shows the emptied-slot notice naming the slot.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Recipes' }),
    ).toBeInTheDocument();
    // Astryx buttons carry their own hidden live region, so find the notice
    // by its title rather than by the first status role on the page.
    const notice = screen
      .getByText(/A deleted recipe emptied/)
      .closest('[role="status"]') as HTMLElement;
    expect(within(notice).getByText('Day 3, Snack')).toBeInTheDocument();
  });

  it('renders a clear not-found message for an unknown id', () => {
    renderDetail('does-not-exist', seedState(8));
    const heading = screen.getByRole('heading', { name: 'Recipe not found' });
    expect(heading).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to recipes' })).toHaveAttribute(
      'href',
      '/recipes',
    );
  });
  describe('Serve as (Req 16.13)', () => {
    const MASH: Recipe = {
      id: 'custom-mash',
      origin: 'custom',
      title: 'Plain Bowl',
      stages: ['9-12'],
      mealTypes: ['lunch'],
      ingredients: [{ name: 'pear', category: 'produce' }],
      steps: ['Stir.'],
      texture: 'soft',
      servings: 1,
    };

    it('shows a guessed serving form for a custom recipe, then lets the user correct it', async () => {
      const user = userEvent.setup();
      renderDetail('custom-mash', seedState(10, [MASH]));
      // Nothing in the text matches, so the stage default is used.
      expect(screen.getByText('Serve as: Mashed (guessed)')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Edit serve as' }));
      await user.click(screen.getByRole('checkbox', { name: 'Finger food' }));
      await user.click(screen.getByRole('checkbox', { name: 'Mashed' }));
      await user.click(screen.getByRole('button', { name: 'Save serve as' }));

      expect(screen.getByText('Serve as: Finger food')).toBeInTheDocument();
      expect(screen.queryByText(/guessed/)).not.toBeInTheDocument();
    });

    it('needs at least one serving form to save, and Cancel keeps the old value', async () => {
      const user = userEvent.setup();
      renderDetail('custom-mash', seedState(10, [MASH]));
      await user.click(screen.getByRole('button', { name: 'Edit serve as' }));
      await user.click(screen.getByRole('checkbox', { name: 'Mashed' }));
      expect(screen.getByRole('button', { name: 'Save serve as' })).toBeDisabled();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByText('Serve as: Mashed (guessed)')).toBeInTheDocument();
    });

    it('shows a built-in recipe\'s form without an edit button', () => {
      renderDetail('b-carrots-and-apples', seedState(8));
      expect(screen.getByText(/^Serve as: /)).toBeInTheDocument();
      expect(screen.queryByText(/guessed/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit serve as' })).not.toBeInTheDocument();
    });
  });

  it('shows time, effort, tags and the tag explainer', () => {
    renderDetail('custom-grapes', seedState(10, [GRAPE_RECIPE]));
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('Time not given')).toBeInTheDocument();
    const tags = screen.getByRole('list', { name: 'Nutrition tags' });
    expect(within(tags).getByText('Dairy')).toBeInTheDocument();
    expect(
      screen.getByText(/not how much of a nutrient it provides/),
    ).toBeInTheDocument();
  });

  it('labels a simple idea', () => {
    const idea: Recipe = { ...GRAPE_RECIPE, id: 'custom-idea', kind: 'simple-idea' };
    renderDetail('custom-idea', seedState(10, [idea]));
    expect(screen.getByText('Simple idea')).toBeInTheDocument();
  });

  it('"Add to plan" stores the recipe in the chosen slot and confirms', async () => {
    const user = userEvent.setup();
    const storage = makeStorage(withSlots(seedState(10, [GRAPE_RECIPE])));
    render(
      <AppProvider storage={storage}>
        <StateProbe />
        <MemoryRouter initialEntries={['/recipes/custom-grapes']}>
          <Routes>
            <Route path="/recipes/:id" element={<RecipeDetail />} />
          </Routes>
        </MemoryRouter>
      </AppProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Add to plan' }));
    await user.selectOptions(screen.getByLabelText('Day'), '2');
    await user.selectOptions(screen.getByLabelText('Meal'), 'lunch');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText(/^Added to /)).toBeInTheDocument();
    const plan = latestState.plan;
    expect(plan.days[2].lunch).toBe('custom-grapes');
    expect(plan.activeSlots).toEqual(['breakfast', 'lunch']);
  });

  it('offers only the meals switched on, and points to the Plan page when none are', async () => {
    const user = userEvent.setup();
    const { unmount } = renderDetail('custom-grapes', withSlots(seedState(10, [GRAPE_RECIPE])));
    await user.click(screen.getByRole('button', { name: 'Add to plan' }));
    const options = within(screen.getByLabelText('Meal')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Breakfast', 'Lunch']);
    unmount();

    renderDetail('custom-grapes', seedState(10, [GRAPE_RECIPE]));
    await user.click(screen.getByRole('button', { name: 'Add to plan' }));
    expect(screen.getByText(/Choose your meals on the Plan page/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
  });

  it('never plans a ghosted recipe, even if the Add control is used directly', async () => {
    const user = userEvent.setup();
    const storage = makeStorage(withSlots(seedState(8, [HONEY_RECIPE])));
    render(
      <AppProvider storage={storage}>
        <StateProbe />
        <MemoryRouter>
          <AddToPlan recipe={HONEY_RECIPE} />
        </MemoryRouter>
      </AppProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Add to plan' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.queryByText(/^Added to /)).not.toBeInTheDocument();
    const days = latestState.plan.days;
    expect(days.every((d) => Object.keys(d).length === 0)).toBe(true);
  });

  it('does not offer "Add to plan" on a ghosted recipe', () => {
    renderDetail('custom-honey', seedState(8, [HONEY_RECIPE]));
    expect(screen.queryByRole('button', { name: 'Add to plan' })).not.toBeInTheDocument();
  });

  it('"I made this" records today once per day and confirms', async () => {
    const user = userEvent.setup();
    renderDetail('custom-grapes', seedState(10, [GRAPE_RECIPE]));
    const button = screen.getByRole('button', { name: 'I made this' });
    expect(button).not.toHaveAttribute('data-variant', 'primary');
    await user.click(button);
    expect(screen.getByText('Saved for today.')).toBeInTheDocument();
    await user.click(button);
    expect(screen.getByText('Already saved for today.')).toBeInTheDocument();
  });

  describe('pasted recipe', () => {
    const PASTED: Recipe = {
      id: 'custom-pasted',
      origin: 'custom',
      title: 'Oat bowl',
      stages: ['9-12'],
      mealTypes: ['breakfast'],
      ingredients: [{ name: 'oats', category: 'grains' }],
      steps: ['Cook the oats.', 'Add a little honey on top.'],
      texture: 'soft',
      servings: 1,
      imported: {
        from: 'chatgpt',
        text: 'Oat bowl\nOats\nCook the oats.\nAdd a little honey on top.',
        date: '2026-11-10',
      },
    };

    it('shows the fixed-list note, Original text and the text mention', () => {
      renderDetail('custom-pasted', seedState(8, [PASTED]));
      expect(screen.getByText(/uses a fixed list of foods/)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Original text' })).toBeInTheDocument();
      expect(screen.getByText(/Add a little honey on top\./, { selector: 'q' })).toBeInTheDocument();
    });

    it('renders an https link with rel="noopener noreferrer"', () => {
      const linked: Recipe = {
        ...PASTED,
        imported: { ...PASTED.imported!, url: 'https://example.com/oats' },
      };
      renderDetail('custom-pasted', seedState(8, [linked]));
      const link = screen.getByRole('link', { name: 'https://example.com/oats' });
      expect(link).toHaveAttribute('href', 'https://example.com/oats');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('does not render a javascript: URL as a link', () => {
      const bad: Recipe = {
        ...PASTED,
        imported: { ...PASTED.imported!, url: 'javascript:alert(1)' },
      };
      renderDetail('custom-pasted', seedState(8, [bad]));
      expect(screen.queryByRole('link', { name: /javascript:/ })).not.toBeInTheDocument();
      expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
    });

    it('clears a mention with "Not used in this recipe" and lists it as cleared', async () => {
      const user = userEvent.setup();
      renderDetail('custom-pasted', seedState(8, [PASTED]));
      await user.click(screen.getByRole('button', { name: /Not used in this recipe/ }));
      expect(screen.queryByText('Not yet')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Not used in this recipe' })).toBeInTheDocument();
    });
  });
});
