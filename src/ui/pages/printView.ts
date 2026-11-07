// Shared, React-free helpers for the Print page (Task 14.1). Kept in a
// non-component module (like recipeView.ts/weekView.ts) so the page and its test
// import the SAME helpers with no react-refresh lint warning.
//
// Nothing here invents health/safety wording: the print page reuses
// ghostReason()/recipeView() (week grid), computePrepList() (prep list) and
// computeGroceryList() (grocery list) for all derived data. These helpers only
// carry the plain labels the Print page shares with Home/Prep/Grocery.

import type { GroceryCategory } from '../../domain/types';
import type { CookSession } from '../../domain/prep';
import type { GroceryLine } from '../../domain/grocery';

/**
 * Trigger the browser print dialog, but ONLY when window.print is actually a
 * function. jsdom leaves window.print undefined and throws "Not implemented" if
 * called, so this guard keeps the Print buttons safe in tests (which spy on a
 * window.print they define themselves).
 */
export function printNow(): void {
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
  }
}

/**
 * Where a cooked session is kept, as plain logistics text. Mirrors Prep.tsx's
 * storeLabel so the print page reads identically to the Prep screen.
 */
export function storeLabel(store: CookSession['store']): string {
  switch (store) {
    case 'fridge':
      return 'Keep in the fridge';
    case 'freezer':
      return 'Freeze in single portions';
    case 'serve':
      return 'Serve fresh';
  }
}

/** "N batch" / "N batches" for a session's batch count (mirrors Prep.tsx). */
export function batchesLabel(batches: number): string {
  return `${batches} ${batches === 1 ? 'batch' : 'batches'}`;
}

/** "N serving" / "N servings" for a session's servings count (mirrors Prep.tsx). */
export function servingsLabel(servings: number): string {
  return `${servings} ${servings === 1 ? 'serving' : 'servings'}`;
}

/** Thaw-reminder text for a frozen portion (mirrors Prep.tsx wording). */
export function thawReminderText(title: string): string {
  return `Thaw ${title} in the fridge the night before.`;
}

/** Human-readable heading for a grocery category (mirrors Grocery.tsx). */
export function categoryLabel(category: GroceryCategory): string {
  switch (category) {
    case 'dairy-eggs':
      return 'Dairy & eggs';
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}

/**
 * The shopping-amount text for a grocery line (mirrors Grocery.tsx amountLabel):
 *   - no quantity            -> 'as needed'
 *   - quantity, not asNeeded -> '<quantity> <unit>'
 *   - quantity AND asNeeded  -> '<quantity> <unit> and more as needed'
 */
export function amountLabel(line: GroceryLine): string {
  if (line.quantity === undefined) return 'as needed';
  const qty =
    line.unit !== undefined ? `${line.quantity} ${line.unit}` : `${line.quantity}`;
  return line.asNeeded ? `${qty} and more as needed` : qty;
}
