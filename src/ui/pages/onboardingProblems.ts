// The five problem choices of the problem-first onboarding (Requirement 20.1)
// and the fixed order the quick solve follows (Requirement 20.3).

export type ProblemId = 'make' | 'save' | 'plan' | 'safe' | 'looking';

export interface ProblemChoice {
  id: ProblemId;
  /** The chip label, worded as in Requirement 20.1. */
  label: string;
  /** Where the end screen links for this problem (Requirement 20.4). */
  path: string;
  /** The end-screen link text. */
  linkLabel: string;
}

/** In the fixed order of Requirement 20.1; the first chosen one is solved. */
export const PROBLEMS: readonly ProblemChoice[] = [
  { id: 'make', label: 'What can I make with what I have', path: '/', linkLabel: 'What can I make' },
  {
    id: 'save',
    label: 'Save recipes from ChatGPT or Instagram',
    path: '/add',
    linkLabel: 'Add a recipe from ChatGPT or Instagram',
  },
  {
    id: 'plan',
    label: 'Plan the week and make a grocery list',
    path: '/plan',
    linkLabel: 'Plan the week and make a grocery list',
  },
  { id: 'safe', label: "What's safe for my child", path: '/foods', linkLabel: 'Foods to leave out for now' },
  { id: 'looking', label: 'Just looking', path: '/', linkLabel: '' },
];

/** The problems to solve, in the fixed order ("Just looking" is not one). */
export function chosenProblems(selected: readonly ProblemId[]): ProblemId[] {
  return PROBLEMS.map((p) => p.id).filter((id) => id !== 'looking' && selected.includes(id));
}
