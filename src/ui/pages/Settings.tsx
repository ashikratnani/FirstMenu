// Settings page (Task 7.1, Req 1.6, 7.2). Edit the same child profile fields
// as onboarding later: first name, birth date, and the tried-foods checklist
// (with the nine allergens first). Prefilled from state. Saving dispatches
// `setChild` with the edited profile and `setFoodRecord` for newly checked
// foods.
//
// Because age and stage are DERIVED via selectors (selectAgeMonths /
// selectStage over plan.startDate), editing the birth date here updates the
// derived age/stage everywhere automatically (Req 1.6). The current derived
// age/stage is shown on this page to make that update visible, and the same
// under-6 / 12+ notices are reused so the health wording stays in one place.

import { useMemo, useState, type FormEvent } from 'react';
import { useApp } from '../../state/AppProvider';
import { selectAgeMonths, selectStage } from '../../state/selectors';
import type { FoodRecord } from '../../domain/types';
import styles from './Settings.module.css';
import {
  ALLERGEN_GROUPS,
  OTHER_FIRST_FOODS,
  ageMonthsForBirthDate,
  allergenFoodKey,
  noticeForAgeMonths,
  todayYmd,
  type ChecklistItem,
} from './childProfile';

/** Whether a food key is currently recorded as tried in state. */
function isTried(
  foods: Record<string, FoodRecord>,
  key: string,
): boolean {
  return foods[key]?.status === 'tried';
}

/** Whether a food key has a logged reaction in state. */
function hasReaction(
  foods: Record<string, FoodRecord>,
  key: string,
): boolean {
  return foods[key]?.status === 'reaction';
}

/** Whether a food key has any record (tried OR reaction) in state. */
function hasRecord(
  foods: Record<string, FoodRecord>,
  key: string,
): boolean {
  return foods[key] !== undefined;
}

export default function Settings() {
  const { state, dispatch } = useApp();

  const [name, setName] = useState(state.child?.name ?? '');
  const [birthDate, setBirthDate] = useState(state.child?.birthDate ?? '');
  const [saved, setSaved] = useState(false);

  // Prefill the checklist from recorded tried foods.
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of ALLERGEN_GROUPS) {
      const key = allergenFoodKey(group);
      initial[key] = isTried(state.foods, key);
    }
    for (const item of OTHER_FIRST_FOODS) {
      initial[item.key] = isTried(state.foods, item.key);
    }
    return initial;
  });

  const allergenItems: ChecklistItem[] = useMemo(
    () =>
      ALLERGEN_GROUPS.map((group) => ({
        key: allergenFoodKey(group),
        label: group,
      })),
    [],
  );

  // Derived age/stage from persisted state (plan-relative, Req 1.6). Updates
  // on save because the child in state changes.
  const persistedMonths = selectAgeMonths(state);
  const persistedStage = selectStage(state);

  // Live notice from the currently-edited birth date so the warning tracks the
  // input, not just the last-saved value. The age is computed from the plan's
  // start date (Req 1.2 / design: every age is relative to plan.startDate, not
  // today) so the notice agrees with the "Current age" line above it.
  const editedMonths = ageMonthsForBirthDate(birthDate, state.plan.startDate);
  const notice = noticeForAgeMonths(editedMonths);

  const toggle = (key: string) => {
    setSaved(false);
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /**
   * Render one checklist row. A food with a logged reaction is shown as a
   * DISABLED, checked control with a visible "reaction recorded" note instead
   * of a plain editable checkbox: the reducer refuses to clear a reaction
   * anyway, so a plain checkbox would mislead the user into thinking toggling
   * it (and seeing "Saved.") changed anything. Disabling it keeps the save
   * path from ever reporting a change for these foods (see handleSubmit).
   */
  const renderItem = (item: ChecklistItem) => {
    const reaction = hasReaction(state.foods, item.key);
    const inputId = `settings-tried-${item.key}`;
    return (
      <li key={item.key} className={styles.check}>
        <input
          id={inputId}
          type="checkbox"
          checked={reaction ? true : (checked[item.key] ?? false)}
          disabled={reaction}
          onChange={reaction ? undefined : () => toggle(item.key)}
        />
        <label htmlFor={inputId}>
          {item.label}
          {reaction && (
            <span className={styles.reactionNote}> (reaction recorded)</span>
          )}
        </label>
      </li>
    );
  };

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!birthDate) return;

    const trimmedName = name.trim();
    dispatch({
      type: 'setChild',
      child: trimmedName ? { name: trimmedName, birthDate } : { birthDate },
    });

    const today = todayYmd();
    const record: FoodRecord = { status: 'tried', date: today };
    for (const item of [...allergenItems, ...OTHER_FIRST_FOODS]) {
      const currentlyTried = isTried(state.foods, item.key);
      if (checked[item.key] && !hasRecord(state.foods, item.key)) {
        // Newly checked with no existing record: record it. Never overwrite an
        // existing record (a logged reaction or an earlier tried date stays
        // as-is), so we gate on hasRecord, not just isTried.
        dispatch({ type: 'setFoodRecord', key: item.key, record });
      } else if (!checked[item.key] && currentlyTried) {
        // Unchecked a food previously recorded as tried: clear it so the
        // checkbox's affordance (an undo) matches its behaviour. Only 'tried'
        // records are clearable; clearFoodRecord leaves a 'reaction' intact.
        dispatch({ type: 'clearFoodRecord', key: item.key });
      }
    }

    setSaved(true);
  }

  return (
    <>
      <h1>Settings</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="settings-name">
            First name (optional)
          </label>
          <input
            id="settings-name"
            className={styles.input}
            type="text"
            value={name}
            onChange={(e) => {
              setSaved(false);
              setName(e.target.value);
            }}
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="settings-birthdate">
            Birth date
          </label>
          <input
            id="settings-birthdate"
            className={styles.input}
            type="date"
            required
            max={todayYmd()}
            value={birthDate}
            onChange={(e) => {
              setSaved(false);
              setBirthDate(e.target.value);
            }}
          />
        </div>

        {persistedMonths !== null && (
          <p className={styles.derived}>
            Current age: {persistedMonths}{' '}
            {persistedMonths === 1 ? 'month' : 'months'}
            {persistedStage ? ` (stage ${persistedStage})` : ''}
          </p>
        )}

        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Foods already tried</legend>
          <p className={styles.hint}>
            Check anything your baby has tried with no reaction.
          </p>

          <h2 className={styles.allergenHeading}>Common allergens</h2>
          <ul className={styles.checklist}>
            {allergenItems.map((item) => renderItem(item))}
          </ul>

          <h2 className={styles.otherHeading}>Other common first foods</h2>
          <ul className={styles.checklist}>
            {OTHER_FIRST_FOODS.map((item) => renderItem(item))}
          </ul>
        </fieldset>

        <button type="submit" className={styles.submit} disabled={!birthDate}>
          Save
        </button>

        {saved && (
          <p className={styles.saved} role="status">
            Saved.
          </p>
        )}
      </form>
    </>
  );
}
