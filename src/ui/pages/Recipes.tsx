// Recipe library (Task 9.1, Req 2.4/5.1/5.3/7.3/9.1). Lists the full recipe
// set (built-ins + custom via selectAllRecipes) as a responsive grid of cards,
// each linking to /recipes/:id. Two filters narrow the list:
//   - a STAGE filter (All / 6-8 / 9-12) that DEFAULTS to the child's current
//     stage (selectStage) when known, else All;
//   - a MEAL-TYPE filter (All / breakfast / lunch / dinner / snack).
//
// Each card carries its state in VISIBLE text and an accessible name (Req
// 14.3); the illustrations are decorative/aria-hidden:
//   - a GHOST state ("Not yet: ...") when the recipe is ghosted (a block
//     finding OR an ingredient food with a recorded reaction);
//   - a DOOR badge ("New food: <food>") naming each untried food the recipe
//     uses (Req 7.3);
//   - a PUMPKIN badge ("Freezes for N months") when freezer-friendly.
// Ghosting/door/pumpkin logic lives in recipeView.ts so it stays aligned with
// screen.ts and foods.ts (no new ghosting rule invented).

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../state/AppProvider';
import { selectAllRecipes, selectStage } from '../../state/selectors';
import type { Recipe } from '../../domain/types';
import { GhostArt, PumpkinArt } from '../components/foodArt';
import {
  MEAL_TYPES,
  STAGES,
  doorBadgeText,
  emptiedSlotLabel,
  freezerBadgeText,
  ghostReason,
  mealTypeLabel,
  recipeView,
  stageLabel,
  type MealFilter,
  type RecipeView,
  type StageFilter,
} from './recipeView';
import styles from './Recipes.module.css';

/** One recipe card: a list item linking to the recipe page, with its badges. */
function RecipeCard({ view }: { view: RecipeView }) {
  const { recipe, isGhosted, usesUntriedFood, untriedFoodLabels, freezerMonths } =
    view;
  const reason = isGhosted ? ghostReason(view) : null;
  const doorText = usesUntriedFood ? doorBadgeText(untriedFoodLabels) : null;
  const freezerText =
    freezerMonths !== null ? freezerBadgeText(freezerMonths) : null;

  // The card link's accessible name must carry EVERY visible state (Req 14.3):
  // the title, the ghost reason, and the door / freezer badge text. An
  // aria-label overrides the content, so we compose it from all of them rather
  // than let the badge text go unspoken.
  const accessibleName = [recipe.title, reason, doorText, freezerText]
    .filter((part): part is string => part !== null)
    .join('. ');

  return (
    <li className={styles.card}>
      <Link
        to={`/recipes/${recipe.id}`}
        className={`${styles.cardLink} ${isGhosted ? styles.ghost : ''}`}
        aria-label={accessibleName}
      >
        <span className={styles.title}>{recipe.title}</span>
        {reason && (
          <span className={styles.ghostReason}>
            <GhostArt />
            <span>{reason}</span>
          </span>
        )}
        <span className={styles.badges}>
          {doorText && <span className={styles.badgeDoor}>{doorText}</span>}
          {freezerText && (
            <span className={styles.badgeFreezer}>
              <PumpkinArt />
              {freezerText}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

export default function Recipes() {
  const { state, emptiedSlots, dismissEmptiedSlots } = useApp();
  const childStage = selectStage(state);

  // Stage filter defaults to the child's current stage when known, else All.
  const [stageFilter, setStageFilter] = useState<StageFilter>(
    childStage ?? 'all',
  );
  const [mealFilter, setMealFilter] = useState<MealFilter>('all');

  const recipes = selectAllRecipes(state);

  const views = useMemo(() => {
    return recipes
      .filter((r: Recipe) =>
        stageFilter === 'all' ? true : r.stages.includes(stageFilter),
      )
      .filter((r: Recipe) =>
        mealFilter === 'all' ? true : r.mealTypes.includes(mealFilter),
      )
      .map((recipe) => recipeView(recipe, state));
  }, [recipes, state, stageFilter, mealFilter]);

  return (
    <>
      <div className={styles.header}>
        <h1>Recipes</h1>
        <Link to="/recipes/new" className={styles.newButton}>
          New recipe
        </Link>
      </div>
      <p className={styles.intro}>
        Browse built-in and your own recipes. Filter by stage and meal type;
        each card opens the full recipe.
      </p>

      {emptiedSlots.length > 0 && (
        <section className={styles.emptiedNotice} role="status">
          <p className={styles.emptiedTitle}>
            {emptiedSlots.length === 1
              ? 'A deleted recipe emptied 1 plan slot:'
              : `A deleted recipe emptied ${emptiedSlots.length} plan slots:`}
          </p>
          <ul className={styles.emptiedList}>
            {emptiedSlots.map((slot) => (
              <li key={`${slot.day}-${slot.meal}`}>{emptiedSlotLabel(slot)}</li>
            ))}
          </ul>
          <button
            type="button"
            className={styles.emptiedDismiss}
            onClick={dismissEmptiedSlots}
          >
            Dismiss
          </button>
        </section>
      )}

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="stage-filter" className={styles.filterLabel}>
            Stage
          </label>
          <select
            id="stage-filter"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as StageFilter)}
          >
            <option value="all">All stages</option>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabel(stage)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="meal-filter" className={styles.filterLabel}>
            Meal type
          </label>
          <select
            id="meal-filter"
            value={mealFilter}
            onChange={(e) => setMealFilter(e.target.value as MealFilter)}
          >
            <option value="all">All meals</option>
            {MEAL_TYPES.map((meal) => (
              <option key={meal} value={meal}>
                {mealTypeLabel(meal)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {views.length === 0 ? (
        <p className={styles.empty}>No recipes match these filters.</p>
      ) : (
        <ul className={styles.grid}>
          {views.map((view) => (
            <RecipeCard key={view.recipe.id} view={view} />
          ))}
        </ul>
      )}
    </>
  );
}
