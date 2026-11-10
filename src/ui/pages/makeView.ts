// React-free label helpers for the Make screen (Requirement 3.8). Kept out of
// the page file so the page and its tests share one source and the
// react-refresh lint rule stays quiet.

import type { MakeResult } from '../../domain/make';
import type { Effort } from '../../domain/effort';
import type { NutritionTag } from '../../domain/nutrition';
import { foodLabel } from '../../domain/foods';

const EFFORT_LABELS: Record<Effort, string> = {
  easy: 'Easy',
  medium: 'Medium',
  more: 'More effort',
};

const TAG_LABELS: Record<NutritionTag, string> = {
  'iron-rich': 'Iron-rich',
  protein: 'Protein',
  vegetable: 'Vegetable',
  fruit: 'Fruit',
  'whole-grain': 'Whole grain',
  dairy: 'Dairy',
  'healthy-fat': 'Healthy fat',
};

export function effortLabel(effort: Effort): string {
  return EFFORT_LABELS[effort];
}

export function tagLabel(tag: NutritionTag): string {
  return TAG_LABELS[tag];
}

/** "10 min", "about 15 min" (estimated) or "Time not given" (Req 3.8, 4.3). */
export function timeLabel(result: Pick<MakeResult, 'minutes' | 'minutesKind'>): string {
  if (result.minutes === undefined) return 'Time not given';
  return result.minutesKind === 'estimated'
    ? `about ${result.minutes} min`
    : `${result.minutes} min`;
}

/** "rice", or "rice and peas" / "rice, peas and oats" for a list of food keys. */
export function foodList(keys: string[]): string {
  const labels = keys.map(foodLabel);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
