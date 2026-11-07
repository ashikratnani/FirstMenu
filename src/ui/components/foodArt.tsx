// Theme art for the Foods / Recipes / Prep pages (Task 15 / 15.1, Req 14.1,
// 14.2, 14.3, 14.5). Polished, rounded, SMILING inline SVGs in the light,
// welcoming palette (creams, soft oranges, lavender, soft greens) using the
// theme.css colour tokens. Every illustration is decorative: aria-hidden,
// focusable="false", className="foodArt". The state is carried by the visible
// TEXT label and the card's accessible name — never by the SVG (Req 14.3).
//
// Nothing scary: no haunted houses, night scenes, skulls, blood, sharp teeth
// or jump scares. Ghosts are translucent and smiling; monsters smile; the door
// is a friendly rounded mystery door; the pumpkin is a cheerful bright pumpkin;
// the lantern is a warm welcoming glow.

import type { AllergenGroup } from '../../domain/types';
import { monsterStyleFor } from './monsterArt';

/**
 * A friendly rounded mystery door — an untried food. Soft-orange door on a warm
 * frame with a little round knob and a welcoming arched top. The `.doorPanel`
 * class lets the door-open animation swing it on hover-free, CSS-only motion.
 */
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
      {/* Warm frame */}
      <rect
        x="7"
        y="4"
        width="26"
        height="33"
        rx="8"
        fill="var(--color-accent-soft, #f6d9c4)"
        stroke="var(--color-accent, #b4541a)"
        strokeWidth="1.5"
      />
      {/* Door panel (animated open) */}
      <g className="doorPanel">
        <rect
          x="11"
          y="8"
          width="18"
          height="25"
          rx="6"
          fill="var(--color-door-surface, #f6d9c4)"
          stroke="var(--color-accent, #b4541a)"
          strokeWidth="1.2"
        />
        <circle cx="25" cy="21" r="1.8" fill="var(--color-accent, #b4541a)" />
      </g>
    </svg>
  );
}

/**
 * A smiling, friendly monster — a tried food with no reaction. Rounded pastel
 * body with round (never sharp) eyes and a happy curved smile. An optional
 * `group` selects a per-allergen-group variant (colour / eye-count / antenna);
 * the variant is exposed only as a non-text `data-monster` hook for tests, and
 * falls back to the generic monster when no group is given. The variant adds
 * NO visible or accessible text (Req 14.3).
 */
export function MonsterArt({ group }: { group?: AllergenGroup } = {}) {
  const style = monsterStyleFor(group);
  const eyeXs =
    style.eyes === 1 ? [20] : style.eyes === 2 ? [15, 25] : [13, 20, 27];
  return (
    <svg
      className="foodArt"
      width="40"
      height="40"
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      data-monster={style.variant}
    >
      {style.antenna && (
        <>
          <line
            x1="20"
            y1="10"
            x2="20"
            y2="5"
            stroke={style.body}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="20" cy="4" r="2" fill="var(--color-accent, #b4541a)" />
        </>
      )}
      {/* Rounded friendly body */}
      <rect x="7" y="10" width="26" height="25" rx="12" fill={style.body} />
      {/* Soft belly/face patch */}
      <ellipse cx="20" cy="24" rx="9" ry="8" fill={style.belly} />
      {/* Round friendly eyes */}
      {eyeXs.map((cx) => (
        <circle key={cx} cx={cx} cy="19" r="1.9" fill="#4b4b4b" />
      ))}
      {/* Happy smile */}
      <path
        d="M14 25 q6 5 12 0"
        fill="none"
        stroke="#4b4b4b"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A cheerful bright pumpkin — the freezer-friendly ("Freezes for N months")
 * badge on a recipe card. Decorative only (aria-hidden); the text carries the
 * meaning (Req 14.3). Warm orange, rounded, with a friendly green stem and a
 * little leaf. No spooky carving.
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
      {/* Stem + leaf */}
      <rect x="18" y="5" width="4" height="8" rx="2" fill="#6b8e4e" />
      <path d="M22 9 q6 -3 7 2 q-5 2 -7 -2 z" fill="#8ab566" />
      {/* Rounded pumpkin body */}
      <ellipse cx="20" cy="25" rx="15" ry="12" fill="var(--color-pumpkin-surface, #f7c9a0)" />
      <ellipse cx="20" cy="25" rx="15" ry="12" fill="none" stroke="var(--color-accent, #b4541a)" strokeWidth="1.1" opacity="0.5" />
      {/* Soft ribs */}
      <path d="M20 14 v22" stroke="var(--color-accent, #b4541a)" strokeWidth="1.1" opacity="0.5" />
      <path d="M12 17 q-3 8 0 16" fill="none" stroke="var(--color-accent, #b4541a)" strokeWidth="1.1" opacity="0.5" />
      <path d="M28 17 q3 8 0 16" fill="none" stroke="var(--color-accent, #b4541a)" strokeWidth="1.1" opacity="0.5" />
    </svg>
  );
}

/**
 * A friendly, translucent, smiling ghost — a blocked or reaction-flagged food.
 * Lavender-tinted, rounded, with a gentle wavy hem, round eyes and a soft
 * smile. Decorative (aria-hidden); state lives in the visible "Not yet…" label
 * and accessible name (Req 14.3).
 */
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
        d="M9 21 a11 11 0 0 1 22 0 v12 q-2.75 3 -5.5 0 q-2.75 3 -5.5 0 q-2.75 3 -5.5 0 q-2.75 3 -5.5 0 z"
        fill="var(--color-ghost-surface, #e7e0f3)"
        stroke="var(--color-lavender, #e7e0f3)"
        strokeWidth="1"
        opacity="0.85"
      />
      {/* Round friendly eyes */}
      <circle cx="16" cy="19" r="1.7" fill="var(--color-heading, #4a2f5e)" />
      <circle cx="24" cy="19" r="1.7" fill="var(--color-heading, #4a2f5e)" />
      {/* Soft smile */}
      <path
        d="M16 24 q4 3 8 0"
        fill="none"
        stroke="var(--color-heading, #4a2f5e)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A warm, welcoming lantern — the prep-reminder marker (design "Theme mapping":
 * Lantern -> prep reminder). Decorative only (aria-hidden); the reminder TEXT
 * carries the meaning (Req 14.3). Soft orange glow, rounded cage, no spooky
 * flame. Light/welcoming palette.
 */
export function LanternArt() {
  return (
    <svg
      className="foodArt"
      width="24"
      height="24"
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      {/* Top ring + handle */}
      <path d="M17 6 q3 -4 6 0" fill="none" stroke="var(--color-accent, #b4541a)" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="15" y="7" width="10" height="3" rx="1.5" fill="var(--color-accent, #b4541a)" />
      {/* Rounded body */}
      <rect x="13" y="10" width="14" height="22" rx="7" fill="var(--color-pumpkin-surface, #f7c9a0)" stroke="var(--color-accent, #b4541a)" strokeWidth="1.2" />
      {/* Warm glow */}
      <ellipse cx="20" cy="21" rx="4.5" ry="6" fill="var(--color-accent-soft, #f6d9c4)" />
      <circle cx="20" cy="21" r="2.4" fill="#ffd79a" />
      {/* Base */}
      <rect x="15" y="31" width="10" height="3" rx="1.5" fill="var(--color-accent, #b4541a)" />
    </svg>
  );
}
