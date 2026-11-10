// Placeholder for the "What can I make?" screen at `/` (design: Make is home).
// Task 10.1 replaces this page with the real screen. Until then it points to
// the week plan, which moved to `/plan` in task 9.1, so the old home content
// stays one tap away.

import { Link } from 'react-router-dom';

export default function Make() {
  return (
    <>
      <h1>What can I make?</h1>
      <p>
        Pick what you have at home and see recipes you can make. This screen is
        coming soon.
      </p>
      <p>
        <Link to="/plan">Open this week&apos;s plan</Link> or{' '}
        <Link to="/recipes">browse your recipes</Link>.
      </p>
    </>
  );
}
