// Week home screen (Task 10.2, Req 5.2/5.4/7.6/7.8/8.2/8.4/8.5). Per design
// "Theme mapping" this is a PLAIN, BRIGHT grid of seven day cards with NO
// themed scene; the theme lives in the badges/cards, not here.
//
// Each day card shows only the plan's ACTIVE slots (state.plan.activeSlots).
// Each slot renders exactly one of three states (Req 5.4):
//   - EMPTY: an "Add" control that opens the SlotPicker for that slot;
//   - a RECIPE: the planned recipe's title (a link to /recipes/:id) plus a
//     "Change" control (reopens the picker) and a "Clear" control;
//   - a GHOSTED RECIPE: the recipe is planned but now ghosted for the current
//     state (e.g. a reaction was recorded on one of its foods — Req 7.6). The
//     slot shows the ghost reason as visible text + accessible name AND a
//     "Replace" control that opens the picker so an eligible recipe can be
//     chosen (Req 5.4).
// Ghost state is DERIVED from recipeView() on every render (never cached), so
// recording a reaction on a planned recipe's food ghosts that slot and shows
// the Replace prompt on the next render (Req 7.6).
//
// Above the grid: active-slot toggles (Req 8.2, dispatch setActiveSlots), a
// new-week keep|empty control (Req 8.5, dispatch newWeek{mode}), a prep-date
// input (Req 8.4, dispatch setPrepDate), and — when newFoodSpacingWarning is
// non-null — ONE new-food spacing warning citing its source (Req 7.8). No new
// health wording is written: the warning is derived from the spacing value +
// its published source, like the existing Foods/Sources citations.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../state/AppProvider';
import { selectAgeMonths, selectAllRecipes } from '../../state/selectors';
import { newFoodSpacingWarning } from '../../domain/plan';
import { SOURCES } from '../../domain/safety/rules';
import type { MealType } from '../../domain/types';
import SlotPicker from '../components/SlotPicker';
import {
  MEAL_TYPES,
  dayLabel,
  ghostReason,
  mealTypeLabel,
  recipeView,
} from './recipeView';
import { dayDateLabel, dayDateYmd } from './weekView';
import styles from './Home.module.css';

const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;

export default function Home() {
  const { state, dispatch } = useApp();
  const recipes = selectAllRecipes(state);
  const ageMonths = selectAgeMonths(state) ?? 0;
  const { plan } = state;

  // Which slot (if any) currently has its picker open. Local UI state only.
  const [openSlot, setOpenSlot] = useState<{
    day: number;
    meal: MealType;
  } | null>(null);

  // Active slots in MEAL_TYPES order so the grid is stable regardless of the
  // order the user toggled them in.
  const activeSlots = MEAL_TYPES.filter((meal) =>
    plan.activeSlots.includes(meal),
  );

  // The week's single new-food spacing warning (Req 7.8), derived each render.
  const spacing = newFoodSpacingWarning(plan, recipes, state, ageMonths);

  const toggleSlot = (meal: MealType) => {
    // Toggling a meal OFF only hides it; the planned recipes stay in
    // state.plan.days (clearSlot is the only thing that removes a recipe), so a
    // user can re-enable a meal without losing what they planned.
    const next = plan.activeSlots.includes(meal)
      ? plan.activeSlots.filter((m) => m !== meal)
      : [...plan.activeSlots, meal];
    dispatch({ type: 'setActiveSlots', activeSlots: next });
  };

  const isOpen = (day: number, meal: MealType) =>
    openSlot !== null && openSlot.day === day && openSlot.meal === meal;

  return (
    <>
      <h1>This week</h1>

      <section className={styles.controls} aria-labelledby="week-controls">
        <h2 id="week-controls" className={styles.controlsHeading}>
          Plan settings
        </h2>

        <fieldset className={styles.slotToggles}>
          <legend className={styles.legend}>Meals to plan</legend>
          {MEAL_TYPES.map((meal) => (
            <label key={meal} className={styles.toggle}>
              <input
                type="checkbox"
                checked={plan.activeSlots.includes(meal)}
                onChange={() => toggleSlot(meal)}
              />
              {mealTypeLabel(meal)}
            </label>
          ))}
        </fieldset>

        <div className={styles.prepControl}>
          <label htmlFor="start-date" className={styles.controlLabel}>
            Start day
          </label>
          <input
            id="start-date"
            type="date"
            value={plan.startDate}
            onChange={(e) =>
              dispatch({ type: 'setStartDate', startDate: e.target.value })
            }
          />
        </div>

        <div className={styles.prepControl}>
          <label htmlFor="prep-date" className={styles.controlLabel}>
            Prep day
          </label>
          <input
            id="prep-date"
            type="date"
            value={plan.prepDate}
            onChange={(e) =>
              dispatch({ type: 'setPrepDate', prepDate: e.target.value })
            }
          />
        </div>

        <div className={styles.newWeek}>
          <button
            type="button"
            className={styles.newWeekButton}
            onClick={() => dispatch({ type: 'newWeek', mode: 'keep' })}
          >
            Start next week (keep meals)
          </button>
          <button
            type="button"
            className={styles.newWeekButton}
            onClick={() => dispatch({ type: 'newWeek', mode: 'empty' })}
          >
            Start next week (empty)
          </button>
        </div>
      </section>

      {spacing && (
        <section className={styles.spacingWarning} role="status">
          <p className={styles.spacingText}>
            New foods are planned fewer than {spacing.spacingDays} days apart:{' '}
            {spacing.foodLabels
              .map((label, i) => `${label} (${dayLabel(spacing.firstDays[i])})`)
              .join(', ')}
            . Try spacing new foods at least {spacing.spacingDays} days apart.
          </p>
          <p className={styles.spacingSources}>
            Source
            {spacing.sources.length > 1 ? 's' : ''}:{' '}
            {spacing.sources.map((id, i) => (
              <span key={id}>
                {i > 0 ? ', ' : ''}
                <a
                  href={SOURCES[id].url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {SOURCES[id].title}
                </a>
              </span>
            ))}
          </p>
        </section>
      )}

      {activeSlots.length === 0 ? (
        <p className={styles.noSlots}>
          No meals selected. Choose at least one meal above to start planning.
        </p>
      ) : (
        <ol className={styles.weekGrid}>
          {DAY_INDEXES.map((day) => {
            const dateYmd = dayDateYmd(plan.startDate, day);
            return (
              <li key={day} className={styles.dayCard}>
                <h2 className={styles.dayName}>
                  {dayLabel(day)}
                  <span className={styles.dayDate}>
                    {' '}
                    {dayDateLabel(dateYmd)}
                  </span>
                </h2>
                <ul className={styles.slotList}>
                  {activeSlots.map((meal) => {
                    const recipeId = plan.days[day]?.[meal];
                    const recipe =
                      recipeId !== undefined
                        ? recipes.find((r) => r.id === recipeId)
                        : undefined;
                    const view =
                      recipe !== undefined
                        ? recipeView(recipe, state)
                        : null;
                    const slot = { day, meal };
                    const open = isOpen(day, meal);

                    return (
                      <li key={meal} className={styles.slot}>
                        <span className={styles.slotMeal}>
                          {mealTypeLabel(meal)}
                        </span>

                        {recipe === undefined ? (
                          // EMPTY slot.
                          <div className={styles.slotEmpty}>
                            <button
                              type="button"
                              className={styles.addButton}
                              onClick={() => setOpenSlot(slot)}
                              aria-label={`Add a ${mealTypeLabel(
                                meal,
                              )} for ${dayLabel(day)}`}
                            >
                              Add
                            </button>
                          </div>
                        ) : view !== null && view.isGhosted ? (
                          // GHOSTED planned recipe: show the reason + a Replace
                          // prompt (Req 5.4/7.6).
                          <div
                            className={styles.slotGhost}
                            role="group"
                            aria-label={`${recipe.title}. ${ghostReason(
                              view,
                            )}`}
                          >
                            <Link
                              to={`/recipes/${recipe.id}`}
                              className={styles.slotTitle}
                            >
                              {recipe.title}
                            </Link>
                            <span className={styles.ghostReason}>
                              {ghostReason(view)}
                            </span>
                            <div className={styles.slotActions}>
                              <button
                                type="button"
                                className={styles.replaceButton}
                                onClick={() => setOpenSlot(slot)}
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                className={styles.clearButton}
                                onClick={() =>
                                  dispatch({ type: 'clearSlot', slot })
                                }
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        ) : (
                          // A planned, eligible recipe.
                          <div className={styles.slotFilled}>
                            <Link
                              to={`/recipes/${recipe.id}`}
                              className={styles.slotTitle}
                            >
                              {recipe.title}
                            </Link>
                            <div className={styles.slotActions}>
                              <button
                                type="button"
                                className={styles.changeButton}
                                onClick={() => setOpenSlot(slot)}
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                className={styles.clearButton}
                                onClick={() =>
                                  dispatch({ type: 'clearSlot', slot })
                                }
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        )}

                        {open && (
                          <SlotPicker
                            slot={slot}
                            onPicked={() => setOpenSlot(null)}
                            onClose={() => setOpenSlot(null)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
