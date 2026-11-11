// First-run onboarding (Task 7.1, Req 1.1, 1.4, 1.5, 7.2). Collects the
// child's birth date (required) and an optional first name, shows the under-6
// / over-36 age notices live as the date is entered, and offers a tried-foods
// checklist with the nine allergen groups listed FIRST (Req 7.2), collapsed
// under "Foods already tried (optional)" (Req 20.6). Completing it dispatches
// `setChild` (which also sets onboarded:true) and one `setFoodRecord` per
// checked food, then shows the problem-first steps (Req 20), which are
// lazy-loaded so first paint only pays for this screen.
//
// The birth date uses a native <input type="date">, so it only ever produces a
// valid YYYY-MM-DD that round-trips through storage's ymdDateSchema.

import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useApp } from '../../state/AppProvider';
import type { FoodRecord } from '../../domain/types';
import { usePagePrimaryAction } from '../components/primaryActionContext';
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

const OnboardingFlow = lazy(() => import('./OnboardingFlow'));

export default function Onboarding() {
  const { state, dispatch } = useApp();
  usePagePrimaryAction(true);

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [profileDone, setProfileDone] = useState(false);

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

    setProfileDone(true);
  }

  if (profileDone) {
    return (
      <Suspense fallback={<p role="status">Loading…</p>}>
        <OnboardingFlow />
      </Suspense>
    );
  }

  return (
    <>
      <h1>Welcome to FirstMenu</h1>
      <p>Tell us about your baby or toddler so we can show the right recipes and safety rules.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <TextInput
          label="First name"
          isOptional
          value={name}
          onChange={(value) => setName(value)}
          autoComplete="off"
        />

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

        <details className={styles.tried}>
          <summary className={styles.summary}>Foods already tried (optional)</summary>
          <p className={styles.hint}>
            Check anything your child has already tried with no reaction. You can
            change this later in Settings.
          </p>

          <h2 className={styles.allergenHeading}>Common allergens</h2>
          <ul className={styles.checklist}>
            {allergenItems.map((item) => (
              <li key={item.key} className={styles.check}>
                <CheckboxInput
                  label={item.label}
                  value={checked[item.key] ?? false}
                  onChange={() => toggle(item.key)}
                />
              </li>
            ))}
          </ul>

          <h2 className={styles.otherHeading}>Other common first foods</h2>
          <ul className={styles.checklist}>
            {OTHER_FIRST_FOODS.map((item) => (
              <li key={item.key} className={styles.check}>
                <CheckboxInput
                  label={item.label}
                  value={checked[item.key] ?? false}
                  onChange={() => toggle(item.key)}
                />
              </li>
            ))}
          </ul>
        </details>

        <div className={styles.actions}>
          <Button label="Start planning" type="submit" variant="primary" size="lg" isDisabled={!birthDate} />
        </div>
      </form>
    </>
  );
}
