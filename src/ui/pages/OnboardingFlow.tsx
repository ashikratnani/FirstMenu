// Onboarding after the profile (Requirement 20): the problems screen, one
// quick solve for the first chosen problem, and a short end screen. Used by
// the profile step on `/onboarding` and by `/onboarding/tour` (Settings "Quick
// tour"). Choices live in component state only; no stored field is added and
// no network request is made. Skipping anywhere lands on Make (`/`).

import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { usePagePrimaryAction } from '../components/primaryActionContext';
import OnboardingProblems from './OnboardingProblems';
import { PROBLEMS, chosenProblems, type ProblemId } from './onboardingProblems';
import styles from './Onboarding.module.css';

const OnboardingSolve = lazy(() => import('./OnboardingSolve'));

type Step = { kind: 'problems' } | { kind: 'solve'; problem: ProblemId } | { kind: 'done' };

export default function OnboardingFlow() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ProblemId[]>([]);
  const [step, setStep] = useState<Step>({ kind: 'problems' });

  const chosen = chosenProblems(selected);
  const others = step.kind === 'solve' ? chosen.filter((id) => id !== step.problem) : chosen.slice(1);
  const toMake = () => navigate('/');

  /** A solve ended: more problems chosen means the end screen, else Make. */
  const finishSolve = () => (others.length > 0 ? setStep({ kind: 'done' }) : toMake());

  const toggle = (id: ProblemId) =>
    setSelected((current) => (current.includes(id) ? current.filter((p) => p !== id) : [...current, id]));

  if (step.kind === 'problems') {
    return (
      <OnboardingProblems
        selected={selected}
        onToggle={toggle}
        // "Just looking" alone behaves as Skip.
        onShow={() => (chosen.length === 0 ? toMake() : setStep({ kind: 'solve', problem: chosen[0] }))}
        onSkip={toMake}
      />
    );
  }

  if (step.kind === 'solve') {
    return (
      <Suspense fallback={<p role="status">Loading…</p>}>
        <OnboardingSolve problem={step.problem} onDone={finishSolve} onSkip={toMake} />
      </Suspense>
    );
  }

  return <Done others={others} onGo={toMake} />;
}

function Done({ others, onGo }: { others: ProblemId[]; onGo: () => void }) {
  usePagePrimaryAction(true);
  return (
    <section className={styles.done} aria-labelledby="onboarding-done">
      <h1 id="onboarding-done">You&apos;re all set</h1>
      {others.length > 0 && (
        <ul className={styles.list} aria-label="Other things you chose">
          {others.map((id) => {
            const problem = PROBLEMS.find((p) => p.id === id)!;
            return (
              <li key={id}>
                <Link to={problem.path}>{problem.linkLabel}</Link>
              </li>
            );
          })}
        </ul>
      )}
      <div className={styles.row}>
        <Button label="Go to Make" variant="primary" size="lg" onClick={onGo} />
      </div>
    </section>
  );
}
