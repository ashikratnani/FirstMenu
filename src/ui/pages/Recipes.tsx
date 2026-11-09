// Recipe library (Task 9.1, Req 2.4/5.1/5.3/7.3/9.1), on Astryx components
// (active spec Requirement 15). Lists the full recipe set (built-ins + custom
// via selectAllRecipes) as a responsive grid of clickable cards, each opening
// /recipes/:id. Two one-tap filters narrow the list:
//   - STAGE (All / each age stage), defaulting to the child's current stage;
//   - MEAL TYPE (All / breakfast / lunch / dinner / snack).
//
// Each card carries its state in VISIBLE text and in the card link's
// accessible name (Req 14.3); the illustrations are decorative/aria-hidden:
//   - a GHOST state ("Not yet: ...") when the recipe is ghosted;
//   - a DOOR badge ("New food: <food>") naming each untried food (Req 7.3);
//   - a PUMPKIN badge ("Freezes for N months") when freezer-friendly.
// Ghosting/door/pumpkin logic lives in recipeView.ts.
//
// The page's "new recipe" action is the shell's primary "Add recipe" button,
// so there is one clear primary action per screen (issue #36).

import { useMemo, useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@astryxdesign/core/SegmentedControl';
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

/** One recipe card: a clickable card opening the recipe page, with badges. */
function RecipeCard({ view }: { view: RecipeView }) {
  const { recipe, isGhosted, usesUntriedFood, untriedFoodLabels, freezerMonths } =
    view;
  const reason = isGhosted ? ghostReason(view) : null;
  const doorText = usesUntriedFood ? doorBadgeText(untriedFoodLabels) : null;
  const freezerText =
    freezerMonths !== null ? freezerBadgeText(freezerMonths) : null;

  // The card link's accessible name must carry EVERY visible state (Req 14.3).
  const accessibleName = [recipe.title, reason, doorText, freezerText]
    .filter((part): part is string => part !== null)
    .join('. ');

  return (
    <li className={styles.card}>
      <ClickableCard
        label={accessibleName}
        href={`/recipes/${recipe.id}`}
        variant={isGhosted ? 'purple' : 'default'}
        padding={3}
        width="100%"
      >
        <span className={styles.cardBody}>
          <span className={styles.title}>{recipe.title}</span>
          {reason && (
            <span className={styles.ghostReason}>
              <GhostArt />
              <span>{reason}</span>
            </span>
          )}
          {(doorText || freezerText) && (
            <span className={styles.badges}>
              {doorText && <Badge variant="orange" label={doorText} />}
              {freezerText && (
                <Badge variant="yellow" icon={<PumpkinArt />} label={freezerText} />
              )}
            </span>
          )}
        </span>
      </ClickableCard>
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
      <h1 className={styles.heading}>Recipes</h1>
      <p className={styles.intro}>
        Built-in recipes and your own. Tap a recipe to see how to make it.
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
          <Button label="Dismiss" size="sm" onClick={dismissEmptiedSlots} />
        </section>
      )}

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel} aria-hidden="true">
            Stage
          </span>
          <SegmentedControl
            label="Stage"
            size="sm"
            value={stageFilter}
            onChange={(value) => setStageFilter(value as StageFilter)}
          >
            <SegmentedControlItem value="all" label="All" />
            {STAGES.map((stage) => (
              <SegmentedControlItem
                key={stage}
                value={stage}
                label={stageLabel(stage)}
              />
            ))}
          </SegmentedControl>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel} aria-hidden="true">
            Meal type
          </span>
          <SegmentedControl
            label="Meal type"
            size="sm"
            value={mealFilter}
            onChange={(value) => setMealFilter(value as MealFilter)}
          >
            <SegmentedControlItem value="all" label="All" />
            {MEAL_TYPES.map((meal) => (
              <SegmentedControlItem
                key={meal}
                value={meal}
                label={mealTypeLabel(meal)}
              />
            ))}
          </SegmentedControl>
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
