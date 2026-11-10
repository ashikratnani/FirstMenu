// Print view (Task 14.1, Req 6.1/11.7). A single printable page that gathers
// the whole week in one place: the week grid, the prep list and the grocery
// list, all DERIVED every render from the current state (nothing is stored),
// reusing the SAME helpers the on-screen pages use:
//   - week grid  -> recipeView()/ghostReason() (Plan.tsx pattern);
//   - prep list  -> computePrepList() (Prep.tsx pattern);
//   - grocery    -> computeGroceryList() (Grocery.tsx pattern).
// No new health/safety wording is invented here: ghost reasons and prep
// reminders come verbatim from those helpers, and the shared <Disclaimer/>
// renders on the printout.
//
// A "Print" button calls the guarded printNow() (window.print only when it is a
// function, so jsdom tests never throw). Print CSS (Print.module.css +
// @media print rules in theme.css) hides the app-shell chrome and the Print
// button and removes color fills so the printed output is clean black-on-white;
// the page stays readable on screen.

import { useApp } from '../../state/AppProvider';
import { selectAgeMonths, selectAllRecipes } from '../../state/selectors';
import { computePrepList } from '../../domain/prep';
import { computeGroceryList } from '../../domain/grocery';
import type { Recipe } from '../../domain/types';
import Disclaimer from '../components/Disclaimer';
import {
  MEAL_TYPES,
  dayLabel,
  ghostReason,
  mealTypeLabel,
  recipeView,
} from './recipeView';
import { dayDateLabel, dayDateYmd } from './weekView';
import {
  amountLabel,
  batchesLabel,
  categoryLabel,
  printNow,
  servingsLabel,
  storeLabel,
  thawReminderText,
} from './printView';
import styles from './Print.module.css';

const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;

export default function Print() {
  const { state } = useApp();
  const recipes = selectAllRecipes(state);
  const ageMonths = selectAgeMonths(state) ?? 0;
  const { plan } = state;

  // Active slots in MEAL_TYPES order (mirrors Plan.tsx) so the grid is stable.
  const activeSlots = MEAL_TYPES.filter((meal) =>
    plan.activeSlots.includes(meal),
  );

  // Everything below is derived every render; never stored.
  const { sessions, thawReminders } = computePrepList(
    plan,
    recipes,
    state,
    ageMonths,
  );
  const groups = computeGroceryList(plan, recipes, state, ageMonths);

  const recipeById = (id: string): Recipe | undefined =>
    recipes.find((r) => r.id === id);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1>Print your week</h1>
        <button
          type="button"
          className={`${styles.printButton} print-hide`}
          onClick={printNow}
        >
          Print
        </button>
      </div>

      {/* (1) WEEK GRID -------------------------------------------------- */}
      <section aria-labelledby="print-week-heading" className={styles.section}>
        <h2 id="print-week-heading" className={styles.sectionHeading}>
          This week
        </h2>
        {activeSlots.length === 0 ? (
          <p className={styles.empty}>No meals selected for this week.</p>
        ) : (
          <ol className={styles.weekGrid}>
            {DAY_INDEXES.map((day) => {
              const dateYmd = dayDateYmd(plan.startDate, day);
              return (
                <li key={day} className={styles.dayCard}>
                  <h3 className={styles.dayName}>
                    {dayLabel(day)}{' '}
                    <span className={styles.dayDate}>
                      {dayDateLabel(dateYmd)}
                    </span>
                  </h3>
                  <ul className={styles.slotList}>
                    {activeSlots.map((meal) => {
                      const recipeId = plan.days[day]?.[meal];
                      const recipe =
                        recipeId !== undefined ? recipeById(recipeId) : undefined;
                      const view =
                        recipe !== undefined ? recipeView(recipe, state) : null;
                      return (
                        <li key={meal} className={styles.slot}>
                          <span className={styles.slotMeal}>
                            {mealTypeLabel(meal)}
                          </span>
                          {recipe === undefined ? (
                            <span className={styles.slotEmpty}>Empty</span>
                          ) : view !== null && view.isGhosted ? (
                            <span className={styles.slotGhost}>
                              <span className={styles.slotTitle}>
                                {recipe.title}
                              </span>
                              <span className={styles.ghostReason}>
                                {ghostReason(view)}
                              </span>
                            </span>
                          ) : (
                            <span className={styles.slotTitle}>
                              {recipe.title}
                            </span>
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
      </section>

      {/* (2) PREP LIST -------------------------------------------------- */}
      <section aria-labelledby="print-prep-heading" className={styles.section}>
        <h2 id="print-prep-heading" className={styles.sectionHeading}>
          Prep
        </h2>
        {sessions.length === 0 ? (
          <p className={styles.empty}>No cook sessions this week.</p>
        ) : (
          <ol className={styles.list}>
            {sessions.map((session, i) => {
              const recipe = recipeById(session.recipeId);
              const title = recipe?.title ?? session.recipeId;
              return (
                <li
                  key={`${session.date}-${session.recipeId}-${i}`}
                  className={styles.listItem}
                >
                  <span className={styles.itemDate}>
                    {dayDateLabel(session.date)}
                  </span>
                  <span className={styles.itemTitle}>{title}</span>
                  <span className={styles.itemDetail}>
                    {servingsLabel(session.servings)}
                  </span>
                  <span className={styles.itemDetail}>
                    {batchesLabel(session.batches)}
                  </span>
                  <span className={styles.itemDetail}>
                    {storeLabel(session.store)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {thawReminders.length > 0 && (
          <>
            <h3 className={styles.subHeading}>Thaw reminders</h3>
            <ol className={styles.list}>
              {thawReminders.map((reminder, i) => {
                const recipe = recipeById(reminder.recipeId);
                const title = recipe?.title ?? reminder.recipeId;
                return (
                  <li
                    key={`${reminder.date}-${reminder.recipeId}-${i}`}
                    className={styles.listItem}
                  >
                    <span className={styles.itemDate}>
                      {dayDateLabel(reminder.date)}
                    </span>
                    <span className={styles.itemDetail}>
                      {thawReminderText(title)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>

      {/* (3) GROCERY LIST ---------------------------------------------- */}
      <section
        aria-labelledby="print-grocery-heading"
        className={styles.section}
      >
        <h2 id="print-grocery-heading" className={styles.sectionHeading}>
          Grocery
        </h2>
        {groups.length === 0 ? (
          <p className={styles.empty}>Nothing to buy this week.</p>
        ) : (
          groups.map((group) => (
            <div key={group.category} className={styles.groceryGroup}>
              <h3 className={styles.subHeading}>
                {categoryLabel(group.category)}
              </h3>
              <ul className={styles.list}>
                {group.lines.map((line) => (
                  <li key={line.key} className={styles.listItem}>
                    <span className={styles.itemTitle}>{line.label}</span>
                    <span className={styles.itemDetail}>
                      {amountLabel(line)}
                    </span>
                    {line.reminders.map((reminder) => (
                      <span key={reminder} className={styles.itemReminder}>
                        {reminder}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <div className={styles.footer}>
        <Disclaimer />
      </div>
    </div>
  );
}
