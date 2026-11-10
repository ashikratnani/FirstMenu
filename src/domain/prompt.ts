/**
 * ChatGPT prompt helper (Requirements 8.2 - 8.5, 13.5). Pure text building:
 * the app never calls an AI service. The prompt carries only the child's age
 * in months, foods, a texture hint and the leave-out list. It never carries
 * the child's name, birth date or any suggestion state.
 */
import { foodLabel } from './foods';
import { blockRuleFoods, STAGE_TEXTURE_HINTS } from './safety/rules';
import type { FoodRecord, StageId } from './types';

export interface PromptInput {
  ageMonths: number;
  /** Human-readable on-hand and pantry food labels. */
  have: string[];
  stage: StageId;
  /** Labels of foods to leave out (see `leaveOutFor`). */
  leaveOut: string[];
}

/**
 * Foods to leave out (Requirement 8.3): labels of block rules that apply at
 * `ageMonths` (no age limit, or a limit above the age), plus the label of each
 * food with a recorded reaction. Duplicates are removed case-insensitively, keeping the first label.
 */
export function leaveOutFor(
  ageMonths: number,
  foods: Record<string, FoodRecord>,
): string[] {
  const labels = blockRuleFoods()
    .filter((f) => f.underMonths === undefined || f.underMonths > ageMonths)
    .map((f) => f.label);
  const reactions = Object.entries(foods)
    .filter(([, record]) => record.status === 'reaction')
    .map(([key]) => foodLabel(key));
  const seen = new Set<string>();
  return [...labels, ...reactions].filter((label) => {
    const key = label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildPrompt({ ageMonths, have, stage, leaveOut }: PromptInput): string {
  const who = ageMonths >= 12 ? 'toddler' : 'baby';
  return [
    `Suggest one quick and easy recipe for my ${ageMonths}-month-old ${who}.`,
    `Use only foods from this list (you don't need to use all of them): ${have.join(', ')}.`,
    `Texture: ${STAGE_TEXTURE_HINTS[stage].hint}.`,
    `Leave out: ${leaveOut.join(', ')}. Don't mention these foods anywhere in your reply.`,
    'If you can, include an iron-rich food.',
    'Reply in exactly this format and nothing else:',
    'Title: <name>',
    'Total time: <number> minutes',
    'Serves: <number>',
    'Ingredients:',
    '- <amount> <unit> <ingredient>',
    'Steps:',
    '1. <step>',
  ].join('\n');
}
