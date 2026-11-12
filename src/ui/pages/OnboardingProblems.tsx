// Onboarding step 2 (Requirement 20.1, 20.2): "What would you like help with?"
// Five toggle chips, a primary "Show me" and a secondary "Skip". The choices
// live in the flow's component state only; nothing is stored.

import { Button } from '@astryxdesign/core/Button';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { usePagePrimaryAction } from '../components/primaryActionContext';
import { PROBLEMS, type ProblemId } from './onboardingProblems';
import styles from './Onboarding.module.css';

export interface OnboardingProblemsProps {
  selected: ProblemId[];
  onToggle: (id: ProblemId) => void;
  onShow: () => void;
  onSkip: () => void;
}

export default function OnboardingProblems({ selected, onToggle, onShow, onSkip }: OnboardingProblemsProps) {
  usePagePrimaryAction(true);
  return (
    <section className={styles.problems} aria-labelledby="onboarding-problems">
      <h1 id="onboarding-problems">What would you like help with?</h1>
      <ul className={styles.chips} aria-label="Choose one or more">
        {PROBLEMS.map((problem) => (
          <li key={problem.id}>
            <ToggleButton
              label={problem.label}
              className="fm-toggle"
              isPressed={selected.includes(problem.id)}
              onPressedChange={() => onToggle(problem.id)}
            />
          </li>
        ))}
      </ul>
      <div className={styles.row}>
        <Button
          label="Show me"
          variant="primary"
          size="lg"
          onClick={onShow}
          isDisabled={selected.length === 0}
        />
        <Button label="Skip" onClick={onSkip} />
      </div>
    </section>
  );
}
