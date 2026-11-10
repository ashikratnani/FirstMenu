// "What can I make?" (home screen at `/`, Requirements 1.1, 2.1 to 2.4, 3.1 to
// 3.10), on Astryx components. The parent sets her pantry once, taps what else
// she has today, and sees recipes she can make now, quickest and easiest first.
//
// Matching, grouping and sorting live in domain/make.ts; this page only shows
// them. Ghosted recipes never appear in the two groups; their count is shown
// and they expand as ghosts with their reasons (Req 3.5).

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { Token } from '@astryxdesign/core/Token';
import { FILTER_LABELS, type SearchFilter } from '../../data/searchPhrases';
import { foodLabel } from '../../domain/foods';
import { buildVocabulary, searchHave } from '../../domain/foodSearch';
import {
  makeResults,
  recipesNamed,
  setIronRichFilter,
  suggestedChips,
  type MakeResult,
} from '../../domain/make';
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
import { removeFilterPhrases, removeTypedWord } from './makeText';
import { plural } from './makeView';
import styles from './Make.module.css';

/** How many suggested food chips are shown at once. */
const SUGGESTED_LIMIT = 16;
const IRON_FILTER: SearchFilter = 'tag:iron-rich';
/** Typing is parsed after this pause (design "Screen behavior"). */
const SEARCH_DEBOUNCE_MS = 150;

function setFilterOff(list: SearchFilter[], filter: SearchFilter): SearchFilter[] {
  return filter === IRON_FILTER ? setIronRichFilter(list, false) : list.filter((f) => f !== filter);
}

export default function Make() {
  const { state, dispatch } = useApp();
  const [now] = useState(() => new Date());
  const today = localYmd(now);

  const ageMonths = selectAgeMonths(state) ?? 0;
  const recipes = selectAllRecipes(state);

  // Filters the user turned on with a button or chip. Filters typed into the
  // box are derived from the text and added to these (Req 16.9).
  const [manualFilters, setManualFilters] = useState<SearchFilter[]>([]);
  const [text, setText] = useState('');
  // The text the search has parsed. It trails `text` by 150 ms while typing.
  const [parsedText, setParsedText] = useState('');
  // Recognized foods the user removed before adding; cleared with the box.
  const [ignored, setIgnored] = useState<string[]>([]);
  const [allStages, setAllStages] = useState(false);
  const [showGhosts, setShowGhosts] = useState(false);
  const [pantryOpen, setPantryOpen] = useState(false);
  // The first-use pantry offer (Req 2.4) shows while the pantry is empty and
  // has not been skipped. It closes for the session on Done or Skip.
  const [setupOpen, setSetupOpen] = useState(
    () => state.pantry.length === 0 && !isDismissed(state.dismissed, PANTRY_SETUP_ID, now),
  );

  useEffect(() => {
    const timer = setTimeout(() => setParsedText(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const vocabulary = useMemo(
    () => buildVocabulary(recipes, [...state.pantry, ...state.onHand]),
    [recipes, state.pantry, state.onHand],
  );
  const search = useMemo(() => searchHave(parsedText, vocabulary), [parsedText, vocabulary]);
  const typedFoods = useMemo(
    () => search.foods.filter((food) => !ignored.includes(food)),
    [search.foods, ignored],
  );
  const filters = useMemo(
    () => [...manualFilters, ...search.filters.filter((f) => !manualFilters.includes(f))],
    [manualFilters, search.filters],
  );

  // While typing, recognized foods count as on hand (Req 16.5).
  const have = useMemo(
    () => new Set([...state.pantry, ...state.onHand, ...typedFoods]),
    [state.pantry, state.onHand, typedFoods],
  );

  const groups = useMemo(
    () => makeResults(recipes, have, ageMonths, state.foods, { allStages, filters }),
    [recipes, have, ageMonths, state.foods, allStages, filters],
  );
  const named = useMemo(
    () => recipesNamed(recipes, search.titleWords, have, ageMonths, state.foods, { allStages, filters }),
    [recipes, search.titleWords, have, ageMonths, state.foods, allStages, filters],
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
    for (const list of [
      groups.readyNow,
      groups.missingOne,
      groups.ghosted,
      groups.moreIdeas,
      named.results,
      named.ghosted,
    ]) {
      for (const result of list) map.set(result.recipe.id, recipeView(result.recipe, state, ageMonths));
    }
    return map;
  }, [groups, named, state, ageMonths]);

  const addOnHand = (food: string) => dispatch({ type: 'addOnHand', food, today });
  const ironRichOnly = filters.includes(IRON_FILTER);

  /** Change the box text and re-parse right away (not after the pause). */
  const setTextNow = (value: string) => {
    setText(value);
    setParsedText(value);
  };

  /** Enter or "Add": recognized foods go to on-hand, the box clears (Req 16.6). */
  const commit = () => {
    const result = searchHave(text, vocabulary);
    for (const food of result.foods) {
      if (!ignored.includes(food)) addOnHand(food);
    }
    // Filters stay on as removable chips even though the box is empty.
    setManualFilters((current) => [
      ...current,
      ...result.filters.filter((f) => !current.includes(f)),
    ]);
    setIgnored([]);
    setTextNow('');
  };

  const removeFilter = (filter: SearchFilter) => {
    setManualFilters((current) => setFilterOff(current, filter));
    setTextNow(removeFilterPhrases(text, filter));
  };

  const pickDidYouMean = (typed: string, food: string) => {
    addOnHand(food);
    setTextNow(removeTypedWord(text, typed));
  };

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

      <section aria-labelledby="make-search" className={styles.section}>
        <h2 id="make-search" className={styles.subheading}>
          What do you have?
        </h2>
        <div className={styles.searchRow}>
          <TextInput
            label="What do you have?"
            isLabelHidden
            value={text}
            onChange={(value) => {
              setText(value);
              if (value === '') setIgnored([]);
            }}
            onEnter={commit}
            placeholder="e.g. leftover chicken, rice and peas · something for breakfast"
            autoComplete="off"
            enterKeyHint="done"
          />
          <Button label="Add" onClick={commit} isDisabled={text.trim() === ''} />
        </div>

        {typedFoods.length > 0 && (
          <ul className={styles.chips} aria-label="Recognized foods">
            {typedFoods.map((food) => (
              <li key={food}>
                <Token
                  label={foodLabel(food)}
                  color="teal"
                  description={`Remove ${foodLabel(food)}`}
                  onRemove={() => setIgnored((current) => [...current, food])}
                />
              </li>
            ))}
          </ul>
        )}
        {search.didYouMean.length > 0 && (
          <ul className={styles.chips} aria-label="Did you mean">
            {search.didYouMean.map(({ typed, food }) => (
              <li key={typed}>
                <Button
                  label={`Did you mean ${foodLabel(food)}?`}
                  size="sm"
                  onClick={() => pickDidYouMean(typed, food)}
                />
              </li>
            ))}
          </ul>
        )}
        {filters.length > 0 && (
          <ul className={styles.chips} aria-label="Filters in use">
            {filters.map((filter) => (
              <li key={filter}>
                <Token
                  label={FILTER_LABELS[filter] ?? filter}
                  color="purple"
                  description={`Remove the ${FILTER_LABELS[filter] ?? filter} filter`}
                  onRemove={() => removeFilter(filter)}
                />
              </li>
            ))}
          </ul>
        )}
        {search.unrecognized.length > 0 && (
          <p className={styles.hint}>Not recognized: {search.unrecognized.join(', ')}</p>
        )}
      </section>

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
          onPressedChange={(on) => {
            if (on) setManualFilters((current) => setIronRichFilter(current, true));
            else removeFilter(IRON_FILTER);
          }}
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

      {named.results.length + named.ghosted.length > 0 && (
        <section aria-labelledby="make-named" className={styles.group}>
          <h2 id="make-named" className={styles.groupHeading}>
            Recipes named {search.titleWords.map((w) => `“${w}”`).join(', ')}
          </h2>
          <ul className={styles.grid}>
            {named.results.map((result) => (
              <ResultCard
                key={result.recipe.id}
                result={result}
                doorText={doorFor(result)}
                showMissing
                onHave={addOnHand}
              />
            ))}
            {named.ghosted.map((result) => {
              const view = views.get(result.recipe.id);
              const reason = view ? ghostReason(view) : 'Not yet.';
              return (
                <GhostCard key={result.recipe.id} label={`${result.recipe.title}. ${reason}`}>
                  <Link to={`/recipes/${result.recipe.id}`}>Open {result.recipe.title}</Link>
                </GhostCard>
              );
            })}
          </ul>
        </section>
      )}

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

      {groups.moreIdeas.length > 0 && (
        <section aria-labelledby="make-more" className={styles.group}>
          <h2 id="make-more" className={styles.groupHeading}>
            More ideas ({groups.moreIdeas.length})
          </h2>
          <p className={styles.hint}>
            These match your filters but need two or more foods you don&apos;t have yet.
          </p>
          <ul className={styles.grid}>
            {groups.moreIdeas.map((result) => (
              <ResultCard
                key={result.recipe.id}
                result={result}
                doorText={doorFor(result)}
                showMissing
                onHave={addOnHand}
              />
            ))}
          </ul>
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
