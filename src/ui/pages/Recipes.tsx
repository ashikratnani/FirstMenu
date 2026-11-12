// Recipe library (Task 9.1, Req 2.4/5.1/5.3/7.3/9.1), on Astryx components
// (active spec Requirement 15). Lists the full recipe set (built-ins + custom
// via selectAllRecipes) as a responsive grid of clickable cards, each opening
// /recipes/:id. A search box (title or ingredient) and two one-tap filters
// narrow the list:
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
// The list is shown RECIPES_PAGE_SIZE (50) cards at a time with a "Show more"
// button, so 500+ recipes never render at once (Requirement 14.9). The
// count goes back to one page whenever the search or a filter changes.
//
// The page's "new recipe" action is the shell's primary "Add recipe" button,
// so there is one clear primary action per screen (issue #36).

import { useMemo, useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { recipeDerived } from '../../domain/make';
import { useApp } from '../../state/AppProvider';
import { selectAllRecipes, selectStage } from '../../state/selectors';
import type { Recipe } from '../../domain/types';
import { GhostArt, PumpkinArt } from '../components/foodArt';
import {
  MEAL_TYPES,
  RECIPES_PAGE_SIZE,
  STAGES,
  collapseTags,
  doorBadgeText,
  emptiedSlotLabel,
  freezerBadgeText,
  ghostReason,
  matchesSearch,
  mealTypeLabel,
  pageStatusText,
  recipeView,
  stageLabel,
  type MealFilter,
  type RecipeView,
  type StageFilter,
} from './recipeView';
import { PASTED_BADGE, effortLabel, tagLabel, timeLabel } from './makeView';
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
  const derived = recipeDerived(recipe);
  const timeText = timeLabel({ minutes: derived.minutes, minutesKind: derived.minutesKind });
  const effortText = effortLabel(derived.effort);
  const { shown: shownTags, hidden: hiddenTags } = collapseTags(derived.tags);
  const facts = [timeText, effortText, ...derived.tags.map(tagLabel)].join(' · ');
  const pasted =
    recipe.imported !== undefined && recipe.imported.from !== 'shared' ? PASTED_BADGE : null;
  const simpleIdea = recipe.kind === 'simple-idea' ? 'Simple idea' : null;

  const accessibleName = [recipe.title, reason, doorText, freezerText, simpleIdea, facts, pasted]
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
          <span className={styles.facts}>
            {[timeText, effortText, ...shownTags.map(tagLabel)].map((fact) => (
              <span key={fact} className={styles.fact}>
                {fact}
              </span>
            ))}
            {hiddenTags > 0 && <span className={styles.fact}>+{hiddenTags} more</span>}
          </span>
          {reason && (
            <span className={styles.ghostReason}>
              <GhostArt />
              <span>{reason}</span>
            </span>
          )}
          {(doorText || freezerText || pasted || simpleIdea) && (
            <span className={styles.badges}>
              {simpleIdea && <Badge variant="green" label={simpleIdea} />}
              {pasted && <Badge variant="blue" label={pasted} />}
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
  const [search, setSearch] = useState('');
  // How many cards are shown. Changing a filter goes back to the first page.
  const [shownCount, setShownCount] = useState(RECIPES_PAGE_SIZE);

  const recipes = selectAllRecipes(state);

  const matching = useMemo(() => {
    return recipes
      .filter((r: Recipe) =>
        stageFilter === 'all' ? true : r.stages.includes(stageFilter),
      )
      .filter((r: Recipe) =>
        mealFilter === 'all' ? true : r.mealTypes.includes(mealFilter),
      )
      .filter((r: Recipe) => matchesSearch(r, search));
  }, [recipes, stageFilter, mealFilter, search]);

  // Only the visible page is turned into views (the safety screen runs for
  // these cards only, not for every recipe in the library).
  const views = useMemo(
    () => matching.slice(0, shownCount).map((recipe) => recipeView(recipe, state)),
    [matching, shownCount, state],
  );

  const changeStage = (value: StageFilter) => {
    setStageFilter(value);
    setShownCount(RECIPES_PAGE_SIZE);
  };
  const changeMeal = (value: MealFilter) => {
    setMealFilter(value);
    setShownCount(RECIPES_PAGE_SIZE);
  };
  const changeSearch = (value: string) => {
    setSearch(value);
    setShownCount(RECIPES_PAGE_SIZE);
  };
  const showAll = () => {
    setStageFilter('all');
    setMealFilter('all');
    setSearch('');
    setShownCount(RECIPES_PAGE_SIZE);
  };

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

      <div className={styles.search}>
        <TextInput
          label="Search recipes"
          isLabelHidden
          type="search"
          value={search}
          onChange={changeSearch}
          placeholder="Search by name or ingredient"
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup} role="group" aria-label="Stage">
          <span className={styles.filterLabel} aria-hidden="true">
            Stage
          </span>
          <div className={styles.chips}>
            {(['all', ...STAGES] as StageFilter[]).map((stage) => (
              <ToggleButton
                key={stage}
                label={stage === 'all' ? 'All' : stageLabel(stage)}
                size="sm"
                className="fm-toggle"
                isPressed={stageFilter === stage}
                onPressedChange={() => changeStage(stage)}
              />
            ))}
          </div>
        </div>

        <div className={styles.filterGroup} role="group" aria-label="Meal type">
          <span className={styles.filterLabel} aria-hidden="true">
            Meal type
          </span>
          <div className={styles.chips}>
            {(['all', ...MEAL_TYPES] as MealFilter[]).map((meal) => (
              <ToggleButton
                key={meal}
                label={meal === 'all' ? 'All' : mealTypeLabel(meal)}
                size="sm"
                className="fm-toggle"
                isPressed={mealFilter === meal}
                onPressedChange={() => changeMeal(meal)}
              />
            ))}
          </div>
        </div>
      </div>

      {matching.length === 0 ? (
        <div className={styles.empty}>
          <p>No recipes match these filters.</p>
          <Button label="Show all recipes" onClick={showAll} />
        </div>
      ) : (
        <>
          <ul className={styles.grid} aria-label="Recipes">
            {views.map((view) => (
              <RecipeCard key={view.recipe.id} view={view} />
            ))}
          </ul>
          <div className={styles.more}>
            <p className={styles.moreStatus} role="status">
              {pageStatusText(views.length, matching.length)}
            </p>
            {views.length < matching.length && (
              <Button
                label="Show more"
                onClick={() => setShownCount((n) => n + RECIPES_PAGE_SIZE)}
              />
            )}
          </div>
        </>
      )}
    </>
  );
}
