// `/onboarding/tour` (Requirement 20.10): the problems step onward, never the
// profile step. Opened from Settings "Quick tour". `OnboardingGate` redirects a
// user who has not finished onboarding to `/onboarding` as for any other route.

import OnboardingFlow from './OnboardingFlow';

export default function OnboardingTour() {
  return <OnboardingFlow />;
}
