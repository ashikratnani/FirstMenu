// Foods page (Task 8.2, Req 7.1/7.4/7.6/7.7/14.3, Req 21). Shows every food
// the app knows about as one tile (FoodTile) in one of three states:
//   - New food, with the peekaboo monster (design "New food: egg");
//   - Tried, with the friendly monster (design "Tried on Nov 12");
//   - Not yet, with the hourglass and a greyed picture: a food blocked by the
//     safety screen for this age OR a food with a recorded reaction (design
//     "Not yet: honey. Available at 12 months.").
//
// Layout decision: a single scrollable page split into three sections: new
// foods first (the actionable "try something new" list, with allergen guidance
// on allergen foods), then tried foods, then Not yet (block-covered + reaction).
// State is carried by VISIBLE text labels and each tile's accessible name; the
// pictures are decorative (Req 14.3 / design "Theme mapping").
//
// Actions: a new food offers "tried, no reaction" (records status 'tried') and
// "noticed a reaction" (records status 'reaction'); a tried food offers the
// same two; a reaction tile offers "clear reaction" (the clearReaction action).
// Block-covered tiles are NOT user-clearable (Req 7.4/7.6).
//
// Scanning (task 19.2): a search box narrows the list by food name, and a
// door or monster shows one "Log a try" / "Change" button; the two record
// buttons appear when it is opened (aria-expanded, one open at a time). A
// reaction ghost keeps "Clear reaction" always visible. All state text stays.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Link } from '@astryxdesign/core/Link';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useApp } from '../../state/AppProvider';
import { selectAgeMonths, selectFoodViews } from '../../state/selectors';
import { allergenGuidance, foodKeyFor } from '../../domain/foods';
import { screenIngredient } from '../../domain/safety/screen';
import { SOURCES } from '../../domain/safety/rules';
import type { FoodRecord, Ingredient } from '../../domain/types';
import { todayYmd } from './childProfile';
import FoodTile from '../components/FoodTile';
import StatePicture from '../components/StatePicture';
import { foodTilePicture } from './foodsPicture';
import styles from './Foods.module.css';

// ---------------------------------------------------------------------------
// Reaction safety messaging (Req 7.6). This is HEALTH wording taken directly
// from Requirement 7.6, which states it verbatim enough to use: the app
// "SHALL tell the user to contact their pediatrician and, for severe symptoms
// such as trouble breathing, to call emergency services." autonomy.md: no
// extra medical guidance is invented beyond the requirement's own words.
// ---------------------------------------------------------------------------
export const REACTION_ADVICE =
  'Contact your pediatrician. For severe symptoms such as trouble breathing, call emergency services.';

/** Month abbreviations for a friendly, timezone-safe "Nov 12" date label. */
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Format a YYYY-MM-DD date as "Nov 12" without timezone drift. */
function formatTriedDate(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const name = MONTHS_SHORT[month - 1];
  if (!name) return ymd;
  return `${name} ${day}`;
}

/** The human-readable display name for a food key. */
function foodLabel(key: string, allergenGroup: string | null): string {
  return allergenGroup ?? key;
}

/** The block finding covering a food at an age, if any (the first block). */
function blockFindingFor(key: string, ageMonths: number) {
  return screenIngredient(key, ageMonths).find((f) => f.kind === 'block');
}

/** True when the user asks the system for less motion (no first-taste animation then). */
function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Foods() {
  const { state, dispatch } = useApp();
  const ageMonths = selectAgeMonths(state) ?? 0;
  const allViews = selectFoodViews(state);
  const [search, setSearch] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  // The tile playing the first-taste animation (component state, never stored).
  const [poppedKey, setPoppedKey] = useState<string | null>(null);
  // The food whose card should take focus once the record change renders.
  const focusKey = useRef<string | null>(null);
  // Screening names is the costly part, so it runs once per food list.
  const pictures = useMemo(
    () => new Map(allViews.map((v) => [v.key, foodTilePicture(v.key, foodLabel(v.key, v.allergenGroup))])),
    [allViews],
  );
  const needle = search.trim().toLowerCase();
  // A food also matches when the typed word maps to its key (shrimp finds the
  // shellfish card, milk the dairy card), using the same allergen matching as
  // the plans.
  const needleKeys = needle ? foodKeyFor({ name: needle } as Ingredient) : [];
  const views = needle
    ? allViews.filter(
        (v) =>
          foodLabel(v.key, v.allergenGroup).toLowerCase().includes(needle) ||
          needleKeys.includes(v.key),
      )
    : allViews;

  // Logging collapses the card, and the control that held focus unmounts (a
  // door becomes a monster). Send focus to the new card's toggle, or to the
  // reaction note, so keyboard users are not dropped at the top of the page.
  useEffect(() => {
    const key = focusKey.current;
    if (key === null) return;
    focusKey.current = null;
    const target = Array.from(
      document.querySelectorAll<HTMLElement>('[data-food-focus]'),
    ).find((el) => el.dataset.foodFocus === key);
    target?.focus();
  });

  const recordTried = (key: string) => {
    const record: FoodRecord = { status: 'tried', date: todayYmd() };
    focusKey.current = key;
    setOpenKey(null);
    setPoppedKey(prefersReducedMotion() ? null : key);
    dispatch({ type: 'setFoodRecord', key, record });
  };
  const recordReaction = (key: string) => {
    const record: FoodRecord = { status: 'reaction', date: todayYmd() };
    focusKey.current = key;
    setOpenKey(null);
    setPoppedKey(null);
    dispatch({ type: 'setFoodRecord', key, record });
  };
  const clearReaction = (key: string) => {
    dispatch({ type: 'clearReaction', key });
  };

  const doors = views.filter((v) => v.status === 'door');
  const monsters = views.filter((v) => v.status === 'monster');
  const ghosts = views.filter((v) => v.status === 'ghost');

  /** The rule message that goes with a food's own picture, first under the picture and name. */
  const hiddenNote = (key: string, except?: string) => {
    const message = pictures.get(key)?.hiddenMessage;
    return message && message !== except ? <p className={styles.detail}>{message}</p> : null;
  };

  /** The disclosure button, shown at the end of a door or monster's head row. */
  const tryToggle = (key: string, label: string, hint: string) => {
    const isOpen = openKey === key;
    return (
      <button
        type="button"
        className={styles.disclosure}
        data-food-focus={key}
        aria-expanded={isOpen}
        aria-label={`${hint}: ${label}`}
        onClick={() => setOpenKey(isOpen ? null : key)}
      >
        {hint}
      </button>
    );
  };

  /** The two record buttons, shown under the head while that food is open. */
  const tryControls = (key: string) =>
    openKey === key && (
      <div className={styles.controls}>
        <Button label="Tried, no reaction" size="sm" onClick={() => recordTried(key)} />
        <Button label="Noticed a reaction" size="sm" onClick={() => recordReaction(key)} />
      </div>
    );

  return (
    <>
      <h1>Foods</h1>
      <p className={styles.intro}>
        Every food your plans use, plus anything you have already tried. Tap
        "Log a try" when your child tries something new.
      </p>

      <div className={styles.search}>
        <TextInput
          label="Search foods"
          isLabelHidden
          type="search"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setOpenKey(null);
          }}
          placeholder="Search by food name"
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      {/* One live region stays mounted for both outcomes, so a search with no match is announced too. */}
      <div className={views.length === 0 ? styles.noMatch : styles.status}>
        <div className={styles.emptyRow}>
          {views.length === 0 && <StatePicture state="tried" size={96} />}
          <p role="status">
            {views.length === 0
              ? 'No foods match your search.'
              : needle
                ? `${views.length} of ${allViews.length} foods match.`
                : `${allViews.length} foods.`}
          </p>
        </div>
        {views.length === 0 && (
          <Button
            label="Clear search"
            onClick={() => {
              setSearch('');
              setOpenKey(null);
            }}
          />
        )}
      </div>

      {(!needle || doors.length > 0) && (
        <section className={styles.section} aria-labelledby="foods-doors">
          <h2 id="foods-doors" className={styles.sectionHeading}>
            New foods to try
          </h2>
          <p className={styles.sectionHint}>
            Allergen foods show guidance from published sources.
          </p>
          {doors.length === 0 ? (
            <div className={styles.emptyRow}>
              <StatePicture state="tried" size={96} />
              <p className={styles.empty}>No new foods right now.</p>
            </div>
          ) : (
            <ul className={styles.grid}>
              {doors.map((view) => {
                const label = foodLabel(view.key, view.allergenGroup);
                const guidance = view.isAllergen
                  ? allergenGuidance(view.allergenGroup!)
                  : null;
                const art = pictures.get(view.key)!;
                return (
                  <FoodTile
                    key={view.key}
                    label={`New food: ${label}`}
                    picture={art.picture}
                    group={art.group}
                    state="new"
                    action={tryToggle(view.key, label, 'Log a try')}
                  >
                    {hiddenNote(view.key)}
                    {guidance && (
                      <>
                        <p className={styles.guidance}>{guidance.generic}</p>
                        {guidance.peanutNote && (
                          <p className={styles.peanutNote}>
                            {guidance.peanutNote}
                          </p>
                        )}
                        <p className={styles.sources}>
                          Source
                          {guidance.sources.length > 1 ? 's' : ''}:{' '}
                          {guidance.sources.map((id, i) => (
                            <span key={id}>
                              {i > 0 ? ', ' : ''}
                              <Link
                                href={SOURCES[id].url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {SOURCES[id].title}
                              </Link>
                            </span>
                          ))}
                        </p>
                      </>
                    )}
                    {tryControls(view.key)}
                  </FoodTile>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {(!needle || monsters.length > 0) && (
        <section className={styles.section} aria-labelledby="foods-monsters">
          <h2 id="foods-monsters" className={styles.sectionHeading}>
            Tried foods
          </h2>
          {monsters.length === 0 ? (
            <div className={styles.emptyRow}>
              <StatePicture state="new" size={96} />
              <p className={styles.empty}>Nothing tried yet.</p>
            </div>
          ) : (
            <ul className={styles.grid}>
              {monsters.map((view) => {
                const label = foodLabel(view.key, view.allergenGroup);
                const when = view.record
                  ? formatTriedDate(view.record.date)
                  : '';
                const name = when
                  ? `${label} — tried on ${when}`
                  : `${label} — tried, no reaction`;
                const art = pictures.get(view.key)!;
                return (
                  <FoodTile
                    key={view.key}
                    label={name}
                    picture={art.picture}
                    group={art.group}
                    state="tried"
                    monsterGroup={
                      view.isAllergen ? view.allergenGroup ?? undefined : undefined
                    }
                    popping={poppedKey === view.key}
                    onPopEnd={() => setPoppedKey(null)}
                    action={tryToggle(view.key, label, 'Change record')}
                  >
                    {hiddenNote(view.key)}
                    {tryControls(view.key)}
                  </FoodTile>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {(!needle || ghosts.length > 0) && (
        <section className={styles.section} aria-labelledby="foods-ghosts">
          <h2 id="foods-ghosts" className={styles.sectionHeading}>
            Not yet
          </h2>
          {ghosts.length === 0 ? (
            <div className={styles.emptyRow}>
              <StatePicture state="tried" size={96} />
              <p className={styles.empty}>No foods on hold.</p>
            </div>
          ) : (
            <ul className={styles.grid}>
              {ghosts.map((view) => {
                const label = foodLabel(view.key, view.allergenGroup);
                const isReaction = view.record?.status === 'reaction';
                const block = blockFindingFor(view.key, ageMonths);
                const art = pictures.get(view.key)!;

                if (isReaction) {
                  return (
                    <FoodTile
                      key={view.key}
                      label={`Not yet: ${label}. Reaction recorded.`}
                      picture={art.picture}
                      group="not-yet"
                      state="not-yet"
                      greyed
                    >
                      {hiddenNote(view.key)}
                      <p
                        className={styles.reactionAdvice}
                        role="note"
                        tabIndex={-1}
                        data-food-focus={view.key}
                      >
                        {REACTION_ADVICE}
                      </p>
                      <div className={styles.controls}>
                        <Button
                          label="Clear reaction"
                          size="sm"
                          onClick={() => clearReaction(view.key)}
                        />
                      </div>
                    </FoodTile>
                  );
                }

                // Block-covered ghost: show the reason and the age it becomes
                // available (from the real block rule); NOT user-clearable.
                const available = block?.availableAtMonths;
                const name =
                  available !== undefined
                    ? `Not yet: ${label}. Available at ${available} months.`
                    : `Not yet: ${label}.`;
                return (
                  <FoodTile
                    key={view.key}
                    label={name}
                    picture={art.picture}
                    group="not-yet"
                    state="not-yet"
                    greyed
                  >
                    {hiddenNote(view.key, block?.message)}
                    {block && (
                      <p className={styles.detail}>{block.message}</p>
                    )}
                  </FoodTile>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
