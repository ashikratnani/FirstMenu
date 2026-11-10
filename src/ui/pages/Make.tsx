// "What can I make?" (home screen at `/`, Requirements 1.1, 2.1 to 2.4, 3.1 to
// 3.10), on Astryx components. The parent sets her pantry once, taps what else
// she has today, and sees recipes she can make now, quickest and easiest first.
//
// Matching, grouping and sorting live in domain/make.ts; this page only shows
// them. Ghosted recipes never appear in the two groups; their count is shown
// and they expand as ghosts with their reasons (Req 3.5).

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { Dialog } from '@astryxdesign/core/Dialog';
import { DialogHeader } from '@astryxdesign/core/Dialog';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { Token } from '@astryxdesign/core/Token';
import type { SearchFilter } from '../../data/searchPhrases';
import { foodLabel } from '../../domain/foods';
import { makeResults, setIronRichFilter, suggestedChips, type MakeResult } from '../../domain/make';
import { leaveOutFor } from '../../domain/prompt';
import { PANTRY_SETUP_ID, isDismissed, localYmd } from '../../domain/suggest';
import { stageFor } from '../../domain/age';
import { useApp } from '../../state/AppProvider';
import { selectAgeMonths, selectAllRecipes } from '../../state/selectors';
import AskChatGpt from '../components/AskChatGpt';
import GhostCard from '../components/GhostCard';
import PantryEditor from '../components/PantryEditor';
import ResultCard from '../components/ResultCard';
import { doorBadgeText, ghostReason, recipeView } from './recipeView';
import { plural } from './makeView';
import styles from './Make.module.css';

/** How many suggested food chips are shown at once. */
const SUGGESTED_LIMIT = 16;
const IRON_FILTER: SearchFilter = 'tag:iron-rich';

export default function Make() {
  const { state, dispatch } = useApp();
  const [now] = useState(() => new Date());
  const today = localYmd(now);

  const ageMonths = selectAgeMonths(state) ?? 0;
  const recipes = selectAllRecipes(state);

  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [allStages, setAllStages] = useState(false);
  const [showGhosts, setShowGhosts] = useState(false);
  const [pantryOpen, setPantryOpen] = useState(false);
  // The first-use pantry offer (Req 2.4) shows while the pantry is empty and
  // has not been skipped. It closes for the session on Done or Skip.
  const [setupOpen, setSetupOpen] = useState(
    () => state.pantry.length === 0 && !isDismissed(state.dismissed, PANTRY_SETUP_ID, now),
  );

  const have = useMemo(
    () => new Set([...state.pantry, ...state.onHand]),
    [state.pantry, state.onHand],
  );

  const groups = useMemo(
    () => makeResults(recipes, have, ageMonths, state.foods, { allStages, filters }),
    [recipes, have, ageMonths, state.foods, allStages, filters],
  );

  const recentFoods = useMemo(
    () =>
      Object.entries(state.onHandDays)
        .map(([food, days]) => ({ food, last: days[days.length - 1] ?? '' }))
        .sort((a, b) => b.last.localeCompare(a.last))
        .map((entry) => entry.food),
    [state.onHandDays],
  );
  const suggested = useMemo(
    () =>
      suggestedChips(recipes, state.pantry, recentFoods)
        .filter((key) => !state.onHand.includes(key))
        .slice(0, SUGGESTED_LIMIT),
    [recipes, state.pantry, state.onHand, recentFoods],
  );

  const views = useMemo(() => {
    const map = new Map<string, ReturnType<typeof recipeView>>();
    for (const list of [groups.readyNow, groups.missingOne, groups.ghosted]) {
      for (const result of list) map.set(result.recipe.id, recipeView(result.recipe, state, ageMonths));
    }
    return map;
  }, [groups, state, ageMonths]);

  const addOnHand = (food: string) => dispatch({ type: 'addOnHand', food, today });
  const ironRichOnly = filters.includes(IRON_FILTER);

  const doorFor = (result: MakeResult): string | null => {
    const view = views.get(result.recipe.id);
    return view?.usesUntriedFood ? doorBadgeText(view.untriedFoodLabels) : null;
  };

  const renderGroup = (
    id: string,
    title: string,
    list: MakeResult[],
    showMissing: boolean,
  ) => (
    <section aria-labelledby={id} className={styles.group}>
      <h2 id={id} className={styles.groupHeading}>
        {title} ({list.length})
      </h2>
      <ul className={styles.grid}>
        {list.map((result) => (
          <ResultCard
            key={result.recipe.id}
            result={result}
            doorText={doorFor(result)}
            showMissing={showMissing}
            onHave={addOnHand}
          />
        ))}
      </ul>
    </section>
  );

  const nothingFits = groups.readyNow.length === 0 && groups.missingOne.length === 0;
  const stage = stageFor(ageMonths);

  return (
    <>
      <h1 className={styles.heading}>What can I make?</h1>

      {setupOpen ? (
        <section className={styles.panel} aria-labelledby="make-setup">
          <h2 id="make-setup" className={styles.panelHeading}>
            Set up your pantry
          </h2>
          <p className={styles.hint}>
            Tap the foods you usually have at home. You only do this once, and you can
            change it any time.
          </p>
          <PantryEditor idPrefix="setup" />
          <div className={styles.row}>
            <Button
              label={state.pantry.length > 0 ? 'Done' : 'Skip for now'}
              onClick={() => {
                dispatch({ type: 'dismissSuggestion', id: PANTRY_SETUP_ID, at: now.toISOString() });
                setSetupOpen(false);
              }}
            />
          </div>
        </section>
      ) : (
        <p className={styles.pantryRow}>
          <span>
            Pantry: {state.pantry.length} {plural(state.pantry.length, 'food', 'foods')}
          </span>
          <Button label="Edit pantry" size="sm" onClick={() => setPantryOpen(true)} />
        </p>
      )}

      <Dialog isOpen={pantryOpen} onOpenChange={setPantryOpen} purpose="form" width={520}>
        <DialogHeader title="Your pantry" onOpenChange={setPantryOpen} />
        <div className={styles.dialogBody}>
          <PantryEditor idPrefix="dialog" />
          <div className={styles.row}>
            <Button label="Done" onClick={() => setPantryOpen(false)} />
          </div>
        </div>
      </Dialog>

      <section aria-labelledby="make-onhand" className={styles.section}>
        <h2 id="make-onhand" className={styles.subheading}>
          What else do you have today?
        </h2>
        {state.onHand.length > 0 && (
          <div className={styles.row}>
            <ul className={styles.chips} aria-label="On hand today">
              {state.onHand.map((food) => (
                <li key={food}>
                  <Token
                    label={foodLabel(food)}
                    color="green"
                    description={`Remove ${foodLabel(food)} from what you have today`}
                    onRemove={() => dispatch({ type: 'removeOnHand', food, today })}
                  />
                </li>
              ))}
            </ul>
            <Button
              label="Clear"
              size="sm"
              onClick={() => dispatch({ type: 'clearOnHand', today })}
            />
          </div>
        )}
        {suggested.length > 0 && (
          <ul className={styles.chips} aria-label="Tap what you have">
            {suggested.map((food) => (
              <li key={food}>
                <Button label={foodLabel(food)} size="sm" onClick={() => addOnHand(food)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.row} role="group" aria-label="Filters">
        <ToggleButton
          label="Iron-rich only"
          size="sm"
          isPressed={ironRichOnly}
          onPressedChange={(on) => setFilters((current) => setIronRichFilter(current, on))}
        />
        <ToggleButton
          label="All stages"
          size="sm"
          isPressed={allStages}
          onPressedChange={setAllStages}
        />
      </div>

      {groups.readyNow.length > 0 &&
        renderGroup('make-ready', 'Ready now', groups.readyNow, false)}
      {groups.missingOne.length > 0 &&
        renderGroup('make-missing', 'Missing one', groups.missingOne, true)}

      {nothingFits && (
        <section className={styles.panel} aria-labelledby="make-empty">
          <h2 id="make-empty" className={styles.panelHeading}>
            Nothing fits yet
          </h2>
          <p className={styles.hint}>
            No recipe is ready to make or missing just one food with what you have. Tap
            a few more foods above, or ask ChatGPT for an idea.{' '}
            <Link to="/recipes">Browse all recipes</Link>
          </p>
        </section>
      )}

      {groups.ghosted.length > 0 && (
        <section aria-labelledby="make-ghosts" className={styles.group}>
          <h2 id="make-ghosts" className={styles.groupHeading}>
            Left out
          </h2>
          <p className={styles.hint}>
            {groups.ghosted.length}{' '}
            {plural(groups.ghosted.length, 'recipe is', 'recipes are')} left out because{' '}
            {plural(groups.ghosted.length, 'it is', 'they are')} not safe for your child yet.
          </p>
          <Button
            label={showGhosts ? 'Hide left-out recipes' : 'Show left-out recipes'}
            size="sm"
            onClick={() => setShowGhosts((value) => !value)}
          />
          {showGhosts && (
            <ul className={styles.ghostList}>
              {groups.ghosted.map((result) => {
                const view = views.get(result.recipe.id);
                const reason = view ? ghostReason(view) : 'Not yet.';
                return (
                  <GhostCard key={result.recipe.id} label={`${result.recipe.title}. ${reason}`}>
                    <Link to={`/recipes/${result.recipe.id}`}>Open {result.recipe.title}</Link>
                  </GhostCard>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section className={styles.group} aria-label="Nothing fits?">
        <AskChatGpt
          ageMonths={ageMonths}
          stage={stage}
          have={[...have].map(foodLabel)}
          leaveOut={leaveOutFor(ageMonths, state.foods)}
        />
      </section>
    </>
  );
}
