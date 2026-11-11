// Draft week for the onboarding quick solve (Requirement 20.3). Pure and
// React-free: the current plan with each empty active slot filled from the
// recipes the slot picker would offer (not ghosted, foods already tried
// first). Nothing is stored here.

import { defaultSlots } from '../../domain/age';
import type { AppState, MealType, Recipe, WeekPlan } from '../../domain/types';
import { selectStage } from '../../state/selectors';
import { slotCandidates } from './weekView';

export interface DraftWeek {
  plan: WeekPlan;
  added: Array<{ day: number; meal: MealType; recipeId: string }>;
}

export function draftWeek(state: AppState, recipes: Recipe[]): DraftWeek {
  const stage = selectStage(state);
  // A new plan has no active slots yet; use the stage's defaults, as Plan does.
  const slots = state.plan.activeSlots.length > 0 ? state.plan.activeSlots : defaultSlots(stage ?? '6-8');
  const days = state.plan.days.map((day) => ({ ...day }));
  const added: DraftWeek['added'] = [];
  let turn = 0;
  for (let day = 0; day < days.length; day++) {
    for (const meal of slots) {
      if (days[day][meal] !== undefined) continue;
      const eligible = slotCandidates(recipes, state, meal, stage).filter((v) => !v.isGhosted);
      const ordered = [...eligible.filter((v) => !v.usesUntriedFood), ...eligible.filter((v) => v.usesUntriedFood)];
      if (ordered.length === 0) continue;
      const recipeId = ordered[turn++ % ordered.length].recipe.id;
      days[day][meal] = recipeId;
      added.push({ day, meal, recipeId });
    }
  }
  return { plan: { ...state.plan, activeSlots: slots, days }, added };
}
