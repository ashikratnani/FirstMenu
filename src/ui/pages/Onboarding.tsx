// First-run onboarding (Task 7.1, Req 1.1, 1.4, 1.5, 7.2). Collects the
// child's birth date (required) and an optional first name, shows the under-6
// / 12+ age notices live as the date is entered, and offers a tried-foods
// checklist with the nine allergen groups listed FIRST (Req 7.2). Completing
// it dispatches `setChild` (which also sets onboarded:true) and one
// `setFoodRecord` per checked food, then navigates to the week home.
//
// The birth date uses a native <input type="date">, so it only ever produces a
// valid YYYY-MM-DD that round-trips through storage's ymdDateSchema.

import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../state/AppProvider';
import type { FoodRecord } from '../../domain/types';
import styles from './Onboarding.module.css';
import {
  ALLERGEN_GROUPS,
  OTHER_FIRST_FOODS,
  ageMonthsForBirthDate,
  allergenFoodKey,
  noticeForAgeMonths,
  todayYmd,
  type ChecklistItem,
} from './childProfile';

export default function Onboarding() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Allergen items first, each keyed `allergen:<group>`; then common foods.
  const allergenItems: ChecklistItem[] = useMemo(
    () =>
      ALLERGEN_GROUPS.map((group) => ({
        key: allergenFoodKey(group),
        label: group,
      })),
    [],
  );

  // Live age notice from the entered birth date (Req 1.4 / 1.5). The age is
  // computed from the plan's start date (Req 1.2 / design: every age is
  // relative to plan.startDate, not today) so the notice agrees with the age
  // the rest of the app shows once onboarding completes.
  const ageMonths = ageMonthsForBirthDate(birthDate, state.plan.startDate);
  const notice = noticeForAgeMonths(ageMonths);

  const toggle = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

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
      if (checked[item.key]) {
        dispatch({ type: 'setFoodRecord', key: item.key, record });
      }
    }

    navigate('/');
  }

  return (
    <>
      <h1>Welcome to FirstMenu</h1>
      <p>Tell us about your baby so we can show the right recipes and safety rules.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="onboarding-name">
            First name (optional)
          </label>
          <input
            id="onboarding-name"
            className={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="onboarding-birthdate">
            Birth date
          </label>
          <input
            id="onboarding-birthdate"
            className={styles.input}
            type="date"
            required
            max={todayYmd()}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>

        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Foods already tried</legend>
          <p className={styles.hint}>
            Check anything your baby has already tried with no reaction. You can
            change this later in Settings.
          </p>

          <h2 className={styles.allergenHeading}>Common allergens</h2>
          <ul className={styles.checklist}>
            {allergenItems.map((item) => (
              <li key={item.key} className={styles.check}>
                <input
                  id={`tried-${item.key}`}
                  type="checkbox"
                  checked={checked[item.key] ?? false}
                  onChange={() => toggle(item.key)}
                />
                <label htmlFor={`tried-${item.key}`}>{item.label}</label>
              </li>
            ))}
          </ul>

          <h2 className={styles.otherHeading}>Other common first foods</h2>
          <ul className={styles.checklist}>
            {OTHER_FIRST_FOODS.map((item) => (
              <li key={item.key} className={styles.check}>
                <input
                  id={`tried-${item.key}`}
                  type="checkbox"
                  checked={checked[item.key] ?? false}
                  onChange={() => toggle(item.key)}
                />
                <label htmlFor={`tried-${item.key}`}>{item.label}</label>
              </li>
            ))}
          </ul>
        </fieldset>

        <button type="submit" className={styles.submit} disabled={!birthDate}>
          Start planning
        </button>
      </form>
    </>
  );
}
