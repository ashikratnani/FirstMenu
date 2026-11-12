// Grocery screen (Task 12.2, Req 10.1-10.6). The grocery list is DERIVED every
// render with computeGroceryList(plan, recipes, state, ageMonths) from
// domain/grocery.ts; nothing here is stored except state.groceryChecked (the
// checked line keys). This mirrors Prep.tsx: the page turns the derived,
// grouped lines into plain shopping text and never re-screens or re-walks the
// plan (ghosting/session logic lives in prep.ts, reused via computeGroceryList).
//
// Per design "Theme mapping" every bit of state (checked / quantity / as-needed
// / reminders) is carried by visible TEXT + the checkbox's accessible name, so
// there is no color-only signalling. Prep reminders come verbatim from the
// safety screen (line.reminders); no health wording is invented here.
//
// Stale checks: when the plan or prep day changes, groceryChecked may contain
// keys that no longer exist on the list. An effect reconciles them
// (reconcileGroceryChecks) by dispatching toggleGroceryItem for each stale key,
// guarded so it only runs when there is actually a stale key to drop.

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { useApp } from '../../state/AppProvider';
import { selectAgeMonths, selectAllRecipes } from '../../state/selectors';
import {
  computeGroceryList,
  reconcileGroceryChecks,
  type GroceryLine,
} from '../../domain/grocery';
import type { GroceryCategory } from '../../domain/types';
import Disclaimer from '../components/Disclaimer';
import styles from './Grocery.module.css';

/** Human-readable heading for a grocery category (matches RecipeEditor). */
function categoryLabel(category: GroceryCategory): string {
  switch (category) {
    case 'dairy-eggs':
      return 'Dairy & eggs';
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}

/**
 * The shopping-amount text for a line, following the three-case contract from
 * grocery.ts:
 *   - no quantity            -> 'as needed'
 *   - quantity, not asNeeded -> '<quantity> <unit>'
 *   - quantity AND asNeeded  -> '<quantity> <unit> and more as needed' (mixed)
 */
function amountLabel(line: GroceryLine): string {
  if (line.quantity === undefined) return 'as needed';
  const qty = line.unit !== undefined ? `${line.quantity} ${line.unit}` : `${line.quantity}`;
  return line.asNeeded ? `${qty} and more as needed` : qty;
}

export default function Grocery() {
  const { state, dispatch } = useApp();
  const recipes = selectAllRecipes(state);
  const ageMonths = selectAgeMonths(state) ?? 0;
  const { plan, groceryChecked } = state;

  // Derived every render; never stored (Req 10.1).
  const groups = computeGroceryList(plan, recipes, state, ageMonths);

  // Reconcile stale checks (Req 10.5/10.6): drop any checked key that is no
  // longer on the current list. Guarded so it only dispatches when there IS a
  // stale key, which keeps the effect from looping.
  useEffect(() => {
    const kept = reconcileGroceryChecks(groceryChecked, groups);
    const keptSet = new Set(kept);
    const stale = groceryChecked.filter((key) => !keptSet.has(key));
    for (const key of stale) {
      dispatch({ type: 'toggleGroceryItem', key });
    }
  }, [groceryChecked, groups, dispatch]);

  const isEmpty = groups.length === 0;

  return (
    <>
      <h1>Grocery</h1>

      {/* One live region stays mounted, so the empty message is announced
          when the last planned meal goes away. */}
      <div role="status" className={isEmpty ? styles.empty : undefined}>
        {isEmpty && (
          <>
            <p className={styles.emptyText}>
              Nothing to buy yet. Add meals to your week to see a grocery list.
            </p>
            <Link className={`fm-link ${styles.nextStep}`} to="/plan">
              Plan your week
            </Link>
          </>
        )}
      </div>

      {!isEmpty &&
        groups.map((group) => (
          <section
            key={group.category}
            aria-labelledby={`grocery-${group.category}-heading`}
          >
            <h2
              id={`grocery-${group.category}-heading`}
              className={styles.sectionHeading}
            >
              {categoryLabel(group.category)}
            </h2>
            <ul className={styles.lineList}>
              {group.lines.map((line) => {
                const checked = groceryChecked.includes(line.key);
                const amount = amountLabel(line);
                const reminderText =
                  line.reminders.length > 0 ? ` ${line.reminders.join(' ')}` : '';
                const accessibleName = `${line.label}, ${amount}.${reminderText}`;
                return (
                  <li key={line.key} className={styles.line}>
                    <CheckboxInput
                      label={line.label}
                      description={amount}
                      aria-label={accessibleName}
                      value={checked}
                      onChange={() =>
                        dispatch({ type: 'toggleGroceryItem', key: line.key })
                      }
                    />
                    {line.reminders.length > 0 && (
                      <ul className={styles.reminderList}>
                        {line.reminders.map((reminder) => (
                          <li key={reminder} className={styles.reminderText}>
                            {reminder}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

      <div className={styles.footer}>
        <Disclaimer />
      </div>
    </>
  );
}
