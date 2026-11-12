import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach } from 'vitest';
import Plan from './Plan';
import planCss from './Plan.module.css?raw';
import { ruleBody } from '../../test/cssRule';
import { AppProvider, useApp } from '../../state/AppProvider';
import { STORAGE_KEY, defaultState } from '../../domain/storage';
import type { AppState, MealType, Recipe } from '../../domain/types';

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

/** Capture the latest app state for assertions after interactions. */
let captured: AppState | null = null;
function StateProbe() {
  captured = useApp().state;
  return null;
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

// A plain, eligible breakfast recipe whose only food (oats) is untried -> it
// will carry a door marker but is NOT ghosted.
const OATS_RECIPE: Recipe = {
  id: 'custom-oats',
  origin: 'custom',
  title: 'Oat Porridge',
  stages: ['6-8', '9-12'],
  mealTypes: ['breakfast'],
  ingredients: [{ name: 'oats', category: 'grains' }],
  steps: ['Cook.'],
  texture: 'smooth',
  servings: 1,
};

// A breakfast recipe containing honey -> blocks under 12 months -> ghosted.
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
};

// A breakfast recipe whose egg ingredient can carry a reaction (ghosts it).
const EGG_RECIPE: Recipe = {
  id: 'custom-egg',
  origin: 'custom',
  title: 'Egg Breakfast',
  stages: ['6-8', '9-12'],
  mealTypes: ['breakfast'],
  ingredients: [{ name: 'egg, beaten', category: 'dairy-eggs' }],
  steps: ['Cook.'],
  texture: 'soft',
  servings: 1,
};

function seedState(
  ageMonths = 8,
  customRecipes: Recipe[] = [],
  activeSlots: MealType[] = ['breakfast'],
  days?: AppState['plan']['days'],
  foods: AppState['foods'] = {},
): AppState {
  const s = defaultState(new Date());
  return {
    ...s,
    child: { name: 'Baby', birthDate: birthDateMonthsAgo(ageMonths) },
    onboarded: true,
    customRecipes,
    foods,
    plan: {
      ...s.plan,
      activeSlots,
      days: days ?? s.plan.days,
    },
  };
}

function renderHome(seed?: AppState) {
  return render(
    <AppProvider storage={makeStorage(seed)}>
      <MemoryRouter initialEntries={['/plan']}>
        <StateProbe />
        <Plan />
      </MemoryRouter>
    </AppProvider>,
  );
}

/** 7 empty days with one recipe planned at day 0 breakfast. */
function daysWith(recipeId: string): AppState['plan']['days'] {
  const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
  days[0] = { breakfast: recipeId };
  return days;
}

describe('Plan week view', () => {
  beforeEach(() => {
    captured = null;
  });

  it('renders a 7-day grid of the active slots', () => {
    renderHome(seedState(8, [OATS_RECIPE], ['breakfast']));
    // Day cards Day 1..Day 7.
    for (let i = 1; i <= 7; i += 1) {
      expect(
        screen.getByRole('heading', { name: new RegExp(`Day ${i}`) }),
      ).toBeInTheDocument();
    }
  });

  it('a ghosted recipe CANNOT be added to a slot (control disabled, state unchanged)', async () => {
    const user = userEvent.setup();
    // Honey is blocked at 8 months -> ghosted; oats is eligible.
    renderHome(seedState(8, [HONEY_RECIPE, OATS_RECIPE], ['breakfast']));

    // Open the picker for Day 1 breakfast.
    const addButton = screen.getByRole('button', {
      name: /Add a Breakfast for Day 1/,
    });
    await user.click(addButton);

    // The honey option is rendered DISABLED with its ghost reason, so it
    // cannot be selected (Req 5.2).
    const honeyOption = screen.getByRole('button', {
      name: /Honey Oat Mash\. Not yet: honey\. Available at 12 months\./,
    });
    expect(honeyOption).toBeDisabled();

    // Attempting to click it does not change state.plan.days.
    await user.click(honeyOption);
    expect(captured!.plan.days[0].breakfast).toBeUndefined();

    // The eligible oats option CAN be selected and does change state.
    const oatsOption = screen.getByRole('button', { name: /Oat Porridge/ });
    expect(oatsOption).not.toBeDisabled();
    await user.click(oatsOption);
    expect(captured!.plan.days[0].breakfast).toBe('custom-oats');
  });

  it('eligible recipes come before ghosted ones in the picker, with a door marker on an untried-food recipe', async () => {
    const user = userEvent.setup();
    renderHome(seedState(8, [HONEY_RECIPE, OATS_RECIPE], ['breakfast']));

    await user.click(
      screen.getByRole('button', { name: /Add a Breakfast for Day 1/ }),
    );

    const options = screen.getAllByRole('button', {
      name: /Oat Porridge|Honey Oat Mash/,
    });
    // Eligible (Oat Porridge) first, ghosted (Honey Oat Mash) last.
    expect(options[0]).toHaveAccessibleName(/Oat Porridge/);
    expect(options[options.length - 1]).toHaveAccessibleName(/Honey Oat Mash/);

    // The eligible oats option shows a door marker naming the untried food.
    const oatsOption = screen.getByRole('button', { name: /Oat Porridge/ });
    expect(within(oatsOption).getByText('New food: oat')).toBeInTheDocument();
  });

  it('a planned recipe whose food has a recorded reaction renders the slot ghosted with a Replace prompt', () => {
    // Egg has a recorded reaction -> EGG_RECIPE is ghosted; it is planned at
    // Day 1 breakfast, so that slot must show the ghost reason + Replace
    // (Req 7.6/5.4), derived from recipeView each render (not cached).
    renderHome(
      seedState(10, [EGG_RECIPE], ['breakfast'], daysWith('custom-egg'), {
        'allergen:egg': { status: 'reaction', date: '2026-11-10' },
      }),
    );

    expect(
      screen.getByText(/Not yet: egg\. Reaction recorded\./),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Replace' }),
    ).toBeInTheDocument();
  });

  it('recording a reaction ghosts an already-planned slot on re-render (derived, not cached)', async () => {
    const user = userEvent.setup();
    // Render Plan plus a tiny control that dispatches the reaction, proving the
    // slot re-derives its ghost state from recipeView after a reaction.
    function ReactionButton() {
      const { dispatch } = useApp();
      return (
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'setFoodRecord',
              key: 'allergen:egg',
              record: { status: 'reaction', date: '2026-11-10' },
            })
          }
        >
          record egg reaction
        </button>
      );
    }
    render(
      <AppProvider
        storage={makeStorage(
          seedState(10, [EGG_RECIPE], ['breakfast'], daysWith('custom-egg')),
        )}
      >
        <MemoryRouter initialEntries={['/plan']}>
          <ReactionButton />
          <Plan />
        </MemoryRouter>
      </AppProvider>,
    );

    // Before: eligible planned recipe, no Replace prompt.
    expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull();

    await user.click(
      screen.getByRole('button', { name: 'record egg reaction' }),
    );

    // After: the slot is ghosted with its reason and a Replace prompt.
    expect(
      screen.getByText(/Not yet: egg\. Reaction recorded\./),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Replace' }),
    ).toBeInTheDocument();
  });

  it('toggling an active slot dispatches setActiveSlots and updates the visible slots', async () => {
    const user = userEvent.setup();
    renderHome(seedState(10, [OATS_RECIPE], ['breakfast']));

    // Lunch is not active, so its slot label does not show in the grid.
    expect(screen.queryByText('LUNCH')).toBeNull();

    // Toggle lunch on.
    await user.click(screen.getByRole('checkbox', { name: 'Lunch' }));
    expect(captured!.plan.activeSlots).toContain('lunch');
    // The grid now shows a Lunch slot label (uppercased via CSS text; the DOM
    // text is "Lunch").
    expect(screen.getAllByText('Lunch').length).toBeGreaterThan(0);
  });

  it('shows a new-food spacing warning when two untried foods are planned too close', () => {
    // Two distinct untried foods (oats day 0, egg day 1) are < 3 days apart.
    const days: AppState['plan']['days'] = Array.from({ length: 7 }, () => ({}));
    days[0] = { breakfast: 'custom-oats' };
    days[1] = { breakfast: 'custom-egg' };
    renderHome(
      seedState(10, [OATS_RECIPE, EGG_RECIPE], ['breakfast'], days),
    );

    const warning = screen.getByRole('status');
    expect(warning).toHaveTextContent(/fewer than 3 days apart/);
    expect(warning).toHaveTextContent(/oat/);
    expect(warning).toHaveTextContent(/egg/);
    // Req 7.8: the warning names the DAY each food is first introduced, using
    // the existing dayLabel wording ("Day 1"/"Day 2").
    expect(warning).toHaveTextContent(/oat \(Day 1\)/);
    expect(warning).toHaveTextContent(/egg \(Day 2\)/);
  });

  it('the start-date control dispatches setStartDate (Req 8.1)', () => {
    renderHome(seedState(10, [OATS_RECIPE], ['breakfast']));
    const start = screen.getByLabelText('Start day');
    fireEvent.change(start, { target: { value: '2026-03-16' } });
    expect(captured!.plan.startDate).toBe('2026-03-16');
    // prepDate follows the new start (the day before).
    expect(captured!.plan.prepDate).toBe('2026-03-15');
  });

  it('a ghosted planned slot exposes its accessible name via role="group" (Req 14.3)', () => {
    // Egg has a recorded reaction -> EGG_RECIPE is ghosted at Day 1 breakfast.
    renderHome(
      seedState(10, [EGG_RECIPE], ['breakfast'], daysWith('custom-egg'), {
        'allergen:egg': { status: 'reaction', date: '2026-11-10' },
      }),
    );
    // A group with the recipe title + ghost reason as its accessible name, so a
    // screen reader reliably announces the slot's state.
    const group = screen.getByRole('group', {
      name: /Egg Breakfast\. Not yet: egg\. Reaction recorded\./,
    });
    expect(group).toBeInTheDocument();
  });

  it('the new-week keep/empty and prep-date controls dispatch the matching actions', async () => {
    const user = userEvent.setup();
    renderHome(seedState(10, [OATS_RECIPE], ['breakfast'], daysWith('custom-oats')));

    const startBefore = captured!.plan.startDate;

    // Keep: shifts startDate +7 and keeps the planned day.
    await user.click(
      screen.getByRole('button', { name: 'Start next week (keep meals)' }),
    );
    expect(captured!.plan.startDate).not.toBe(startBefore);
    expect(captured!.plan.days[0].breakfast).toBe('custom-oats');

    // Empty: clears the days.
    await user.click(
      screen.getByRole('button', { name: 'Start next week (empty)' }),
    );
    expect(captured!.plan.days[0].breakfast).toBeUndefined();

    // Prep-date input dispatches setPrepDate with the committed value. A date
    // input commits a whole value at once; clearing it sends "" which the
    // reducer now rejects as a no-op (guards prep.ts against NaN offsets), so a
    // valid replacement must still go through.
    const prep = screen.getByLabelText('Prep day');
    const prepBefore = captured!.plan.prepDate;
    fireEvent.change(prep, { target: { value: '' } });
    expect(captured!.plan.prepDate).toBe(prepBefore); // cleared -> no-op
    fireEvent.change(prep, { target: { value: '2030-01-02' } });
    expect(captured!.plan.prepDate).toBe('2030-01-02');
  });

  it('shows the week before the plan settings, with no second Print control', () => {
    renderHome(seedState(8, [OATS_RECIPE], ['breakfast'], daysWith('custom-oats')));
    const day1 = screen.getByRole('heading', { name: /Day 1/ });
    const settings = screen.getByRole('heading', { name: 'Plan settings' });
    expect(
      day1.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The Print tab in the plan navigation is the one way to open /print.
    expect(screen.queryByRole('link', { name: 'Print' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Print' })).toBeNull();
  });

  it('keeps one live region mounted and links to the settings when no meal is selected', async () => {
    const user = userEvent.setup();
    renderHome(seedState(8, [OATS_RECIPE], ['breakfast']));
    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();

    await user.click(screen.getByLabelText('Breakfast'));
    // The same region element now carries the message and a link to the settings.
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('No meals selected.');
    const link = within(region).getByRole('link', { name: 'Plan settings' });
    expect(link).toHaveAttribute('href', '#week-controls');
    expect(link).toHaveClass('fm-link');
    expect(document.getElementById('week-controls')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: /Day 1/ })).toBeNull();
  });

  it('slot buttons and settings controls are 44 px targets (CSS)', () => {
    for (const selector of ['.slotButton', '.toggle', '.dateInput', '.newWeekButton', '.nextStep']) {
      expect(ruleBody(planCss, selector), selector).toContain(
        'min-height: 44px',
      );
    }
  });
});
