// Simple placeholder illustrations for the Foods page states (Task 8.2).
// These are intentionally minimal inline SVGs — full theme art is Task 15.
// Every illustration is aria-hidden so the state is carried by visible TEXT
// and the accessible name (Req 14.3 / design "Theme mapping").

/** A plain closed door — a mystery (untried) food. */
export function DoorArt() {
  return (
    <svg
      className="foodArt"
      width="40"
      height="40"
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="10" y="6" width="20" height="30" rx="2" fill="#e8c9a0" />
      <circle cx="25" cy="21" r="1.6" fill="#8a6d3b" />
    </svg>
  );
}

/** A friendly smiling monster — a tried food with no reaction. */
export function MonsterArt() {
  return (
    <svg
      className="foodArt"
      width="40"
      height="40"
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="20" cy="22" r="13" fill="#f2a365" />
      <circle cx="15" cy="19" r="2" fill="#333" />
      <circle cx="25" cy="19" r="2" fill="#333" />
      <path
        d="M14 25 q6 5 12 0"
        fill="none"
        stroke="#333"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A cheerful pumpkin — the freezer-friendly ("freezes for N months") badge on
 * a recipe card. Decorative only (aria-hidden); the "Freezes for N months"
 * text carries the meaning (Req 14.3). Bright, light palette, no spooky theme.
 */
export function PumpkinArt() {
  return (
    <svg
      className="foodArt"
      width="24"
      height="24"
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="18" y="5" width="4" height="7" rx="1.5" fill="#6b8e4e" />
      <ellipse cx="20" cy="24" rx="14" ry="12" fill="#f0923a" />
      <path d="M20 13 v22" stroke="#d9772a" strokeWidth="1.4" />
      <path d="M11 17 q-3 7 0 14" fill="none" stroke="#d9772a" strokeWidth="1.4" />
      <path d="M29 17 q3 7 0 14" fill="none" stroke="#d9772a" strokeWidth="1.4" />
    </svg>
  );
}

/** A friendly translucent ghost — a blocked or reaction-flagged food. */
export function GhostArt() {
  return (
    <svg
      className="foodArt"
      width="40"
      height="40"
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 20 a10 10 0 0 1 20 0 v14 l-4-3 -3 3 -3-3 -3 3 -3-3 -1 3 z"
        fill="#cdbdf0"
        opacity="0.8"
      />
      <circle cx="16" cy="19" r="1.6" fill="#4b4b6b" />
      <circle cx="24" cy="19" r="1.6" fill="#4b4b6b" />
    </svg>
  );
}
