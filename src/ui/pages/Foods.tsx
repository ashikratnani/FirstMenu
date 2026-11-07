// Foods page (Task 8.2, Req 7.1/7.4/7.6/7.7/14.3). Shows every food the app
// knows about as one of three themed cards:
//   - MysteryDoor  — an untried food (design "New food: egg");
//   - FriendlyMonster — a food tried with no reaction (design "Tried on Nov 12");
//   - GhostCard — a food blocked by the safety screen for this age OR a food
//     with a recorded reaction (design "Not yet: honey. Available at 12 months.").
//
// Layout decision: a single scrollable page split into three sections — doors
// first (the actionable "try something new" list, with allergen guidance on
// allergen doors), then tried monsters, then ghosts (block-covered + reaction).
// State is carried by VISIBLE text labels and each card's accessible name; the
// SVGs are decorative/aria-hidden (Req 14.3 / design "Theme mapping").
//
// Actions: a door offers "tried, no reaction" (records status 'tried') and
// "noticed a reaction" (records status 'reaction'); a monster offers the same
// two; a reaction ghost offers "clear reaction" (the clearReaction action).
// Block-covered ghosts are NOT user-clearable (Req 7.4/7.6).

import { useApp } from '../../state/AppProvider';
import { selectAgeMonths, selectFoodViews } from '../../state/selectors';
import { allergenGuidance } from '../../domain/foods';
import { screenIngredient } from '../../domain/safety/screen';
import { SOURCES } from '../../domain/safety/rules';
import type { FoodRecord } from '../../domain/types';
import { todayYmd } from './childProfile';
import MysteryDoor from '../components/MysteryDoor';
import FriendlyMonster from '../components/FriendlyMonster';
import GhostCard from '../components/GhostCard';
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

export default function Foods() {
  const { state, dispatch } = useApp();
  const ageMonths = selectAgeMonths(state) ?? 0;
  const views = selectFoodViews(state);

  const recordTried = (key: string) => {
    const record: FoodRecord = { status: 'tried', date: todayYmd() };
    dispatch({ type: 'setFoodRecord', key, record });
  };
  const recordReaction = (key: string) => {
    const record: FoodRecord = { status: 'reaction', date: todayYmd() };
    dispatch({ type: 'setFoodRecord', key, record });
  };
  const clearReaction = (key: string) => {
    dispatch({ type: 'clearReaction', key });
  };

  const doors = views.filter((v) => v.status === 'door');
  const monsters = views.filter((v) => v.status === 'monster');
  const ghosts = views.filter((v) => v.status === 'ghost');

  /** The two record controls shared by doors and monsters. */
  const tryControls = (key: string) => (
    <div className={styles.controls}>
      <button type="button" onClick={() => recordTried(key)}>
        Tried, no reaction
      </button>
      <button type="button" onClick={() => recordReaction(key)}>
        Noticed a reaction
      </button>
    </div>
  );

  return (
    <>
      <h1>Foods</h1>
      <p className={styles.intro}>
        Every food your plans use, plus anything you have already tried. Open a
        mystery door when your baby tries something new.
      </p>

      <section className={styles.section} aria-labelledby="foods-doors">
        <h2 id="foods-doors" className={styles.sectionHeading}>
          New foods to try
        </h2>
        <p className={styles.sectionHint}>
          Each untried food is a mystery door. Allergen doors include guidance
          from published sources.
        </p>
        {doors.length === 0 ? (
          <p className={styles.empty}>No new foods right now.</p>
        ) : (
          <ul className={styles.grid}>
            {doors.map((view) => {
              const label = foodLabel(view.key, view.allergenGroup);
              const guidance = view.isAllergen
                ? allergenGuidance(view.allergenGroup!)
                : null;
              return (
                <MysteryDoor key={view.key} label={`New food: ${label}`}>
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
                    </>
                  )}
                  {tryControls(view.key)}
                </MysteryDoor>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="foods-monsters">
        <h2 id="foods-monsters" className={styles.sectionHeading}>
          Tried foods
        </h2>
        {monsters.length === 0 ? (
          <p className={styles.empty}>Nothing tried yet.</p>
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
              return (
                <FriendlyMonster key={view.key} label={name}>
                  {tryControls(view.key)}
                </FriendlyMonster>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="foods-ghosts">
        <h2 id="foods-ghosts" className={styles.sectionHeading}>
          Not yet
        </h2>
        {ghosts.length === 0 ? (
          <p className={styles.empty}>No foods on hold.</p>
        ) : (
          <ul className={styles.grid}>
            {ghosts.map((view) => {
              const label = foodLabel(view.key, view.allergenGroup);
              const isReaction = view.record?.status === 'reaction';
              const block = blockFindingFor(view.key, ageMonths);

              if (isReaction) {
                return (
                  <GhostCard
                    key={view.key}
                    label={`Not yet: ${label}. Reaction recorded.`}
                  >
                    <p className={styles.reactionAdvice} role="note">
                      {REACTION_ADVICE}
                    </p>
                    <div className={styles.controls}>
                      <button
                        type="button"
                        onClick={() => clearReaction(view.key)}
                      >
                        Clear reaction
                      </button>
                    </div>
                  </GhostCard>
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
                <GhostCard key={view.key} label={name}>
                  {block && (
                    <p className={styles.detail}>{block.message}</p>
                  )}
                </GhostCard>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
