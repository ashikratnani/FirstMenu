// Slot picker (Task 10.2, Req 5.2/7.3/8.3). A small picker that lists the
// candidate recipes for one plan slot (a {day, meal} location) so the user can
// fill or replace it from the week view (Plan.tsx).
//
// Ordering (Req 8.3 / design "slot picker"): ELIGIBLE (non-ghosted) recipes
// first, then ghosted recipes. Candidate derivation + ordering lives in the
// React-free weekView.ts (slotCandidates), which goes through recipeView() so
// ghost/door state is identical to the recipe library.
//
// Safety (Req 5.2 — a ghosted recipe CANNOT be added to a slot):
//   - visible affordance: a ghosted recipe renders as a DISABLED button that
//     shows its ghost reason, so it cannot be clicked/selected; and
//   - enforcement: onPick() re-derives recipeView(recipe, state) and REFUSES
//     to dispatch setSlot for a ghosted recipe even if invoked programmatically
//     (the disabled control is the UI; this guard is the real gate).
//
// Door markers (Req 7.3/8.3): a recipe using an untried food shows its
// doorBadgeText NAMING the untried food(s).

import { useEffect } from 'react';
import { useApp } from '../../state/AppProvider';
import { selectAllRecipes, selectStage } from '../../state/selectors';
import type { MealType } from '../../domain/types';
import {
  doorBadgeText,
  ghostReason,
  mealTypeLabel,
  recipeView,
} from '../pages/recipeView';
import { slotCandidates } from '../pages/weekView';
import styles from './SlotPicker.module.css';

export interface SlotPickerProps {
  /** The plan slot to fill: day index (0..6) and meal type. */
  slot: { day: number; meal: MealType };
  /** Called after a successful pick so the parent can close the picker. */
  onPicked?: () => void;
  /** Called when the user cancels the picker without picking. */
  onClose?: () => void;
}

export default function SlotPicker({ slot, onPicked, onClose }: SlotPickerProps) {
  const { state, dispatch } = useApp();
  const stage = selectStage(state);
  const recipes = selectAllRecipes(state);

  // Escape closes the picker (Req 14.4 keyboard use). The picker is
  // non-modal, so listen on the document rather than only inside the dialog.
  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Eligible (non-ghosted) first, then ghosted — all via recipeView() so the
  // picker matches the library (weekView.slotCandidates).
  const candidates = slotCandidates(recipes, state, slot.meal, stage);

  // Req 5.2 enforcement: never plan a ghosted recipe. Re-derive the ghost state
  // from the CURRENT state at the moment of the pick (not a cached flag) and
  // refuse the dispatch if it is ghosted, even if this is called programmatically.
  const pick = (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (recipe === undefined) return;
    if (recipeView(recipe, state).isGhosted) return; // guard: cannot plan a ghost
    dispatch({ type: 'setSlot', slot, recipeId });
    onPicked?.();
  };

  return (
    <div
      className={styles.picker}
      role="dialog"
      aria-modal="false"
      aria-label={`Choose a recipe for ${mealTypeLabel(slot.meal)}`}
    >
      <div className={styles.header}>
        <h3 className={styles.heading}>Choose a {mealTypeLabel(slot.meal)}</h3>
        {onClose && (
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
          >
            Cancel
          </button>
        )}
      </div>

      {candidates.length === 0 ? (
        <p className={styles.empty}>No recipes for this meal yet.</p>
      ) : (
        <ul className={styles.list}>
          {candidates.map((view) => {
            const { recipe, isGhosted, usesUntriedFood, untriedFoodLabels } =
              view;
            const reason = isGhosted ? ghostReason(view) : null;
            const doorText = usesUntriedFood
              ? doorBadgeText(untriedFoodLabels)
              : null;
            // Accessible name carries every visible state (Req 14.3): title,
            // ghost reason (when ghosted), and the door marker.
            const accessibleName = [recipe.title, reason, doorText]
              .filter((part): part is string => part !== null)
              .join('. ');

            return (
              <li key={recipe.id} className={styles.item}>
                <button
                  type="button"
                  className={`${styles.option} ${
                    isGhosted ? styles.ghost : ''
                  }`}
                  disabled={isGhosted}
                  aria-disabled={isGhosted || undefined}
                  aria-label={accessibleName}
                  onClick={() => pick(recipe.id)}
                >
                  <span className={styles.title}>{recipe.title}</span>
                  {reason && (
                    <span className={styles.reason}>{reason}</span>
                  )}
                  {doorText && (
                    <span className={styles.door}>{doorText}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
