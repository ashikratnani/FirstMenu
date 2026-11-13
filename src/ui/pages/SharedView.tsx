// Read-only shared-plan view (Task 13.2, Req 11.4/11.5). Opened from a share
// link at /shared/:data. This view renders ENTIRELY from the decoded payload:
// it NEVER calls useApp()/useAppState(), NEVER dispatches, and NEVER touches
// localStorage or storage.ts, so opening someone else's link changes nothing on
// the viewer's device (Req 11.4). It is wired OUTSIDE the app Layout (App.tsx),
// so there is no primary nav and no first-run disclaimer chrome — a clean
// recipient view — but it still provides a <main> landmark and the footer
// <Disclaimer/> (pure text, no store).
//
// Decode safety (Req 11.5): decodeShareData validates the fragment with zod. On
// ANY failure (or a missing param) the page renders ONLY the error
// "This link can't be read. Ask for a new one." (design Error Handling) with no
// plan, no recipes and no partial data.
//
// Age handling: the payload carries ageMonths as a NUMBER and has NO child, so
// every derivation is driven by payload.ageMonths directly — screenRecipe(r,
// ageMonths), computePrepList/computeGroceryList(..., ageMonths) — via a
// synthetic read-only AppState built from the payload (child omitted). The
// viewer RE-RUNS the CURRENT ruleset (design: "the viewer runs its own copy of
// the rules"); the payload's rulesetVersion is not trusted for screening.

import { useParams } from 'react-router-dom';
import { decodeShareData, type SharePayload } from '../../domain/share';
import type { AppState, MealType, Recipe } from '../../domain/types';
import { screenRecipe } from '../../domain/safety/screen';
import { computePrepList, type CookSession } from '../../domain/prep';
import {
  computeGroceryList,
  type GroceryLine,
} from '../../domain/grocery';
import type { GroceryCategory } from '../../domain/types';
import { MEAL_TYPES, mealTypeLabel, recipeView, ghostReason } from './recipeView';
import { dayDateLabel, dayDateYmd } from './weekView';
import Disclaimer from '../components/Disclaimer';
import styles from './SharedView.module.css';

const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Build a synthetic, read-only AppState from a share payload so the existing
 * age-number derivations (prep/grocery) can run. The child is OMITTED on
 * purpose: nothing reads state.child here, and every derivation is passed
 * payload.ageMonths explicitly.
 */
function syntheticState(payload: SharePayload): AppState {
  return {
    schemaVersion: 2,
    onboarded: true,
    customRecipes: payload.recipes,
    foods: payload.foods,
    plan: payload.plan,
    groceryChecked: [],
    disclaimerAcknowledged: true,
    pantry: [],
    onHand: [],
    madeLog: [],
    onHandDays: {},
    dismissed: {},
  };
}

/**
 * The prep reminders to show on a recipe card, computed from the CURRENT safety
 * screen at the payload age (Req 11.4 — same plan and safety reminders). The
 * screen already de-dupes reminder messages per ingredient; a recipe can repeat
 * a message across ingredients, so dedupe once more by message (first-seen
 * order), matching how the recipe page / grocery list present reminders.
 */
function recipeReminderMessages(recipe: Recipe, ageMonths: number): string[] {
  const seen = new Set<string>();
  const messages: string[] = [];
  for (const reminder of screenRecipe(recipe, ageMonths).reminders) {
    if (seen.has(reminder.message)) continue;
    seen.add(reminder.message);
    messages.push(reminder.message);
  }
  return messages;
}

/** Human heading for a grocery category (matches Grocery.tsx). */
function categoryLabel(category: GroceryCategory): string {
  switch (category) {
    case 'dairy-eggs':
      return 'Dairy & eggs';
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}

/** Shopping-amount text for a grocery line (matches Grocery.tsx). */
function amountLabel(line: GroceryLine): string {
  if (line.quantity === undefined) return 'as needed';
  const qty =
    line.unit !== undefined ? `${line.quantity} ${line.unit}` : `${line.quantity}`;
  return line.asNeeded ? `${qty} and more as needed` : qty;
}

/** Plain logistics label for where a cooked session is kept (matches Prep.tsx). */
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

/** Wrapper giving the shared view a <main> landmark and the footer disclaimer. */
function SharedShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.shell}>
      {children}
      <footer className={styles.footer}>
        <Disclaimer />
      </footer>
    </main>
  );
}

export default function SharedView() {
  const { data } = useParams<{ data: string }>();
  const result = data ? decodeShareData(data) : { ok: false as const };

  // Req 11.5: on any decode/validation failure render ONLY the error, no plan,
  // no partial data.
  if (!result.ok) {
    return (
      <SharedShell>
        <h1>Shared plan</h1>
        <p className={styles.error} role="alert">
          This link can&rsquo;t be read. Ask for a new one.
        </p>
      </SharedShell>
    );
  }

  const { payload } = result;
  const { ageMonths, plan } = payload;
  const state = syntheticState(payload);

  // Resolve a recipe by id against the payload's recipe set (built-in + custom
  // are both already in payload.recipes).
  const recipeById = (id: string): Recipe | undefined =>
    payload.recipes.find((r) => r.id === id);

  // Re-run the CURRENT safety screen for every recipe at the payload age,
  // reusing the SAME recipeView/ghostReason helpers the owner's views use so a
  // recipe is ghosted on a block OR a recorded reaction (payload.foods carries
  // reactions), and the reason text matches (Req 11.4 — viewer runs its own
  // rules). ageMonths is passed as the override because the synthetic state has
  // no child to derive age from.
  const viewFor = (recipe: Recipe) => recipeView(recipe, state, ageMonths);

  // Active slots in MEAL_TYPES order for a stable grid.
  const activeSlots = MEAL_TYPES.filter((meal) =>
    plan.activeSlots.includes(meal),
  );

  const nothingPlanned = plan.days.every((day) =>
    activeSlots.every((meal) => day[meal] === undefined),
  );

  // Prep + grocery driven by the payload age (read-only; never stored).
  const { sessions, thawReminders } = computePrepList(
    plan,
    payload.recipes,
    state,
    ageMonths,
  );
  const groceryGroups = computeGroceryList(plan, payload.recipes, state, ageMonths);

  return (
    <SharedShell>
      <h1>Shared plan</h1>
      <p className={styles.intro}>
        This is a read-only view of a shared week. Nothing here is saved on your
        device.
      </p>

      {/* Week grid (read-only; no Add/Change/Clear/Replace controls). */}
      <section aria-labelledby="shared-week-heading">
        <h2 id="shared-week-heading" className={styles.sectionHeading}>
          This week
        </h2>
        {activeSlots.length === 0 ? (
          <p className={styles.empty}>No meals planned.</p>
        ) : nothingPlanned ? (
          <p className={styles.empty}>
            Nothing is planned for this week yet.
          </p>
        ) : (
          <ol className={styles.weekGrid}>
            {DAY_INDEXES.map((day) => {
              const dateYmd = dayDateYmd(plan.startDate, day);
              return (
                <li key={day} className={styles.dayCard}>
                  <h3 className={styles.dayName}>
                    {dayDateLabel(dateYmd)}
                  </h3>
                  <ul className={styles.slotList}>
                    {activeSlots.map((meal: MealType) => {
                      const recipeId = plan.days[day]?.[meal];
                      const recipe =
                        recipeId !== undefined ? recipeById(recipeId) : undefined;
                      const view =
                        recipe !== undefined ? viewFor(recipe) : null;
                      const ghosted = view !== null && view.isGhosted;
                      const reason =
                        ghosted && view !== null ? ghostReason(view) : '';
                      return (
                        <li key={meal} className={styles.slot}>
                          <span className={styles.slotMeal}>
                            {mealTypeLabel(meal)}
                          </span>
                          {recipe === undefined ? (
                            <span className={styles.slotEmpty}>—</span>
                          ) : ghosted ? (
                            <span
                              className={styles.slotGhost}
                              role="group"
                              aria-label={`${recipe.title}. ${reason}`}
                            >
                              <span className={styles.slotTitle}>
                                {recipe.title}
                              </span>
                              <span className={styles.ghostReason}>{reason}</span>
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

      {/* Recipes used in the plan (read-only; re-screened). */}
      <section aria-labelledby="shared-recipes-heading">
        <h2 id="shared-recipes-heading" className={styles.sectionHeading}>
          Recipes
        </h2>
        {payload.recipes.length === 0 ? (
          <p className={styles.empty}>No recipes in this plan.</p>
        ) : (
          <ul className={styles.recipeList}>
            {payload.recipes.map((recipe) => {
              const view = viewFor(recipe);
              const ghosted = view.isGhosted;
              const reason = ghosted ? ghostReason(view) : '';
              const reminders = recipeReminderMessages(recipe, ageMonths);
              return (
                <li key={recipe.id} className={styles.recipeCard}>
                  <h3 className={styles.recipeTitle}>{recipe.title}</h3>
                  {ghosted && (
                    <p className={styles.ghostReason}>{reason}</p>
                  )}
                  <p className={styles.recipeMeta}>{recipe.texture}</p>
                  {reminders.length > 0 && (
                    <>
                      <h4 className={styles.recipeSubheading}>Prep reminders</h4>
                      <ul className={styles.reminderList}>
                        {reminders.map((message) => (
                          <li key={message} className={styles.reminderText}>
                            {message}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <h4 className={styles.recipeSubheading}>Ingredients</h4>
                  <ul className={styles.ingredientList}>
                    {recipe.ingredients.map((ingredient, i) => (
                      <li key={`${recipe.id}-ing-${i}`}>
                        {ingredient.quantity !== undefined
                          ? `${ingredient.quantity}${
                              ingredient.unit !== undefined
                                ? ` ${ingredient.unit}`
                                : ''
                            } `
                          : ''}
                        {ingredient.name}
                      </li>
                    ))}
                  </ul>
                  <h4 className={styles.recipeSubheading}>Steps</h4>
                  <ol className={styles.stepList}>
                    {recipe.steps.map((step, i) => (
                      <li key={`${recipe.id}-step-${i}`}>{step}</li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Prep list (read-only). */}
      <section aria-labelledby="shared-prep-heading">
        <h2 id="shared-prep-heading" className={styles.sectionHeading}>
          Prep
        </h2>
        {sessions.length === 0 && thawReminders.length === 0 ? (
          <p className={styles.empty}>Nothing to prep.</p>
        ) : (
          <>
            {sessions.length > 0 && (
              <ol className={styles.plainList}>
                {sessions.map((session, i) => {
                  const recipe = recipeById(session.recipeId);
                  const title = recipe?.title ?? session.recipeId;
                  return (
                    <li
                      key={`${session.date}-${session.recipeId}-${i}`}
                      className={styles.plainItem}
                    >
                      <span className={styles.itemDate}>
                        {dayDateLabel(session.date)}
                      </span>
                      <span className={styles.itemBody}>
                        {title} — {storeLabel(session.store)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {thawReminders.length > 0 && (
              <>
                <h3 className={styles.subheading}>Thaw reminders</h3>
                <ol className={styles.plainList}>
                  {thawReminders.map((reminder, i) => {
                    const recipe = recipeById(reminder.recipeId);
                    const title = recipe?.title ?? reminder.recipeId;
                    return (
                      <li
                        key={`${reminder.date}-${reminder.recipeId}-${i}`}
                        className={styles.plainItem}
                      >
                        <span className={styles.itemDate}>
                          {dayDateLabel(reminder.date)}
                        </span>
                        <span className={styles.itemBody}>
                          Thaw {title} in the fridge the night before.
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </>
        )}
      </section>

      {/* Grocery list (read-only; no check-off). */}
      <section aria-labelledby="shared-grocery-heading">
        <h2 id="shared-grocery-heading" className={styles.sectionHeading}>
          Grocery
        </h2>
        {groceryGroups.length === 0 ? (
          <p className={styles.empty}>Nothing to buy.</p>
        ) : (
          groceryGroups.map((group) => (
            <section
              key={group.category}
              aria-labelledby={`shared-grocery-${group.category}-heading`}
            >
              <h3
                id={`shared-grocery-${group.category}-heading`}
                className={styles.subheading}
              >
                {categoryLabel(group.category)}
              </h3>
              <ul className={styles.plainList}>
                {group.lines.map((line) => {
                  const amount = amountLabel(line);
                  return (
                    <li key={line.key} className={styles.groceryLine}>
                      <span className={styles.lineName}>{line.label}</span>
                      <span className={styles.lineAmount}>{amount}</span>
                      {line.reminders.length > 0 && (
                        <ul className={styles.reminderList}>
                          {line.reminders.map((reminder) => (
                            <li key={reminder} className={styles.reminderText}>
                              {reminder}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </section>
    </SharedShell>
  );
}
