// Prep screen (Task 11.2, Req 9.2/9.3/9.5). The prep list is DERIVED every
// render with computePrepList(plan, recipes, state, ageMonths) from
// domain/prep.ts; nothing here is stored (mirrors how Plan.tsx derives the week
// view and the new-food spacing warning). Editing the prep-day date input
// dispatches the existing setPrepDate action, so the next render recomputes the
// whole list (a session's store can flip or a thaw reminder appear/disappear).
//
// GHOSTED slots are already excluded inside computePrepList (the shared
// isRecipeGhosted rule), so this page never has to re-check safety; it only
// turns the derived sessions and thaw reminders into plain prep LOGISTICS text.
// Per design "Theme mapping": a Pumpkin badge marks a freezer-friendly recipe;
// every store state is carried by visible TEXT + accessible name (no color-only
// signalling) and any illustration stays aria-hidden with the state in text.

import { Link } from 'react-router-dom';
import { useApp } from '../../state/AppProvider';
import { selectAgeMonths, selectAllRecipes } from '../../state/selectors';
import { computePrepList, type CookSession } from '../../domain/prep';
import type { Recipe } from '../../domain/types';
import { freezerBadgeText } from './recipeView';
import { dayDateLabel } from './weekView';
import { LanternArt } from '../components/foodArt';
import styles from './Prep.module.css';

/** Plain, non-health logistics label for where a cooked session is kept. */
function storeLabel(store: CookSession['store']): string {
  switch (store) {
    case 'fridge':
      return 'Keep in the fridge';
    case 'freezer':
      return 'Freeze in single portions';
    case 'serve':
      return 'Serve fresh';
  }
}

/** "N batch" / "N batches" for a session's batch count. */
function batchesLabel(batches: number): string {
  return `${batches} ${batches === 1 ? 'batch' : 'batches'}`;
}

/** "N serving" / "N servings" for a session's servings-needed count (Req 9.2). */
function servingsLabel(servings: number): string {
  return `${servings} ${servings === 1 ? 'serving' : 'servings'}`;
}

export default function Prep() {
  const { state, dispatch } = useApp();
  const recipes = selectAllRecipes(state);
  const ageMonths = selectAgeMonths(state) ?? 0;
  const { plan } = state;

  // Derived every render; never stored (Req 9.5).
  const prepList = computePrepList(plan, recipes, state, ageMonths);
  const { sessions, thawReminders } = prepList;

  const recipeById = (id: string): Recipe | undefined =>
    recipes.find((r) => r.id === id);

  const isEmpty = sessions.length === 0 && thawReminders.length === 0;

  return (
    <>
      <h1>Prep</h1>

      <section className={styles.controls} aria-labelledby="prep-controls">
        <h2 id="prep-controls" className={styles.controlsHeading}>
          Prep settings
        </h2>
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
      </section>

      {isEmpty ? (
        <p className={styles.empty}>
          Nothing to prep yet. Add meals to your week to see a prep plan.
        </p>
      ) : (
        <>
          <section aria-labelledby="cook-sessions-heading">
            <h2 id="cook-sessions-heading" className={styles.sectionHeading}>
              Cook sessions
            </h2>
            {sessions.length === 0 ? (
              <p className={styles.empty}>No cook sessions this week.</p>
            ) : (
              <ol className={styles.sessionList}>
                {sessions.map((session, i) => {
                  const recipe = recipeById(session.recipeId);
                  const title = recipe?.title ?? session.recipeId;
                  const store = storeLabel(session.store);
                  const batches = batchesLabel(session.batches);
                  const servings = servingsLabel(session.servings);
                  const freezerMonths = recipe?.storage?.freezerMonths;
                  return (
                    <li
                      key={`${session.date}-${session.recipeId}-${i}`}
                      className={styles.session}
                    >
                      <span className={styles.sessionDate}>
                        {dayDateLabel(session.date)}
                      </span>
                      <div
                        className={styles.sessionBody}
                        role="group"
                        aria-label={`${title}. ${servings}. ${batches}. ${store}.`}
                      >
                        {recipe !== undefined ? (
                          <Link
                            to={`/recipes/${recipe.id}`}
                            className={styles.sessionTitle}
                          >
                            {title}
                          </Link>
                        ) : (
                          <span className={styles.sessionTitle}>{title}</span>
                        )}
                        <span className={styles.sessionServings}>
                          {servings}
                        </span>
                        <span className={styles.sessionBatches}>{batches}</span>
                        <span className={styles.sessionStore}>{store}</span>
                        {typeof freezerMonths === 'number' &&
                          freezerMonths > 0 && (
                            <span className={styles.freezerBadge}>
                              <svg
                                className={styles.badgeIcon}
                                viewBox="0 0 16 16"
                                aria-hidden="true"
                                focusable="false"
                              >
                                <circle cx="8" cy="9" r="5" fill="#e07b2f" />
                                <rect x="7" y="2" width="2" height="3" fill="#5a7d3a" />
                              </svg>
                              {freezerBadgeText(freezerMonths)}
                            </span>
                          )}
                        {recipe?.makeAheadNote !== undefined &&
                          recipe.makeAheadNote !== '' && (
                            <span className={styles.makeAheadNote}>
                              {recipe.makeAheadNote}
                            </span>
                          )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {thawReminders.length > 0 && (
            <section aria-labelledby="thaw-reminders-heading">
              <h2
                id="thaw-reminders-heading"
                className={styles.sectionHeading}
              >
                Thaw reminders
              </h2>
              <ol className={styles.reminderList}>
                {thawReminders.map((reminder, i) => {
                  const recipe = recipeById(reminder.recipeId);
                  const title = recipe?.title ?? reminder.recipeId;
                  const text = `Thaw ${title} in the fridge the night before.`;
                  return (
                    <li
                      key={`${reminder.date}-${reminder.recipeId}-${i}`}
                      className={styles.reminder}
                    >
                      <span className={styles.reminderDate}>
                        {dayDateLabel(reminder.date)}
                      </span>
                      <LanternArt />
                      <span className={styles.reminderText}>{text}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </>
      )}
    </>
  );
}
