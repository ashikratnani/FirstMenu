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

import { useId } from 'react';
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
        fill="var(--fm-color-accent-soft, #f6d9c4)"
        stroke="var(--fm-color-accent, #b4541a)"
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
          fill="var(--fm-color-door-surface, #f6d9c4)"
          stroke="var(--fm-color-accent, #b4541a)"
          strokeWidth="1.2"
        />
        <circle cx="25" cy="21" r="1.8" fill="var(--fm-color-accent, #b4541a)" />
      </g>
    </svg>
  );
}

/** React's useId() without the colons, so the id is safe inside `url(#...)`. */
function useArtId(): string {
  return `fm${useId().replace(/:/g, '')}`;
}

/** Eyes, pupils and soft shadow shared by both monsters (docs/art/reference). */
function EyeDefs({ id }: { id: string }) {
  return (
    <>
      <radialGradient id={`${id}-eye`} cx="0.4" cy="0.32" r="0.75">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.7" stopColor="#f3f0fa" />
        <stop offset="1" stopColor="#cfc6e6" />
      </radialGradient>
      <radialGradient id={`${id}-pupil`} cx="0.4" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#55457a" />
        <stop offset="1" stopColor="#1d1630" />
      </radialGradient>
      <radialGradient id={`${id}-shadow`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#6b4a2a" stopOpacity="0.22" />
        <stop offset="1" stopColor="#6b4a2a" stopOpacity="0" />
      </radialGradient>
    </>
  );
}

/**
 * A smiling, friendly monster, a tried food with no reaction. Drawn from
 * docs/art/reference/monster.svg and monster-egg.svg: soft radial gradients,
 * no outlines, round eyes with highlights, an open smile with no teeth. Every
 * monster has the same shape; an optional `group` only changes its colors
 * (monsterArt.ts), exposed as a non-text `data-monster` hook for tests, and
 * falls back to the generic monster. All ids are prefixed with useId() so two
 * monsters of different colors on one page never share `url(#body)`. Adds NO
 * visible or accessible text (Req 14.3).
 */
export function MonsterArt({ group, size = 40 }: { group?: AllergenGroup; size?: number } = {}) {
  const style = monsterStyleFor(group);
  const id = useArtId();
  return (
    <svg
      className="foodArt"
      width={size}
      height={size}
      viewBox="0 0 128 128"
      aria-hidden="true"
      focusable="false"
      data-monster={style.variant}
    >
      <defs>
        <radialGradient id={`${id}-body`} cx="0.36" cy="0.28" r="0.85">
          <stop offset="0" stopColor={style.body[0]} />
          <stop offset="0.5" stopColor={style.body[1]} />
          <stop offset="1" stopColor={style.body[2]} />
        </radialGradient>
        <radialGradient id={`${id}-arm`} cx="0.4" cy="0.3" r="0.9">
          <stop offset="0" stopColor={style.arm[0]} />
          <stop offset="1" stopColor={style.arm[1]} />
        </radialGradient>
        <linearGradient id={`${id}-horn`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={style.horn[0]} />
          <stop offset="1" stopColor={style.horn[1]} />
        </linearGradient>
        <EyeDefs id={id} />
      </defs>
      <ellipse cx="64" cy="117" rx="42" ry="7" fill={`url(#${id}-shadow)`} />
      <path d="M41 42 C 37 30, 39 19, 46 12 C 51 21, 55 31, 55 40 Z" fill={`url(#${id}-horn)`} />
      <path d="M87 42 C 91 30, 89 19, 82 12 C 77 21, 73 31, 73 40 Z" fill={`url(#${id}-horn)`} />
      <ellipse cx="21" cy="90" rx="8" ry="11" transform="rotate(28 21 90)" fill={`url(#${id}-arm)`} />
      <ellipse cx="107" cy="90" rx="8" ry="11" transform="rotate(-28 107 90)" fill={`url(#${id}-arm)`} />
      <path
        d="M22 98 C 18 62, 36 30, 64 30 C 92 30, 110 62, 106 98 C 105 109, 98 114, 90 114 L 38 114 C 30 114, 23 109, 22 98 Z"
        fill={`url(#${id}-body)`}
      />
      <ellipse cx="45" cy="47" rx="13" ry="7" transform="rotate(-28 45 47)" fill="#ffffff" opacity="0.45" />
      <ellipse cx="64" cy="103" rx="24" ry="9" fill="#ffffff" opacity="0.25" />
      <ellipse cx="50" cy="64" rx="12" ry="14" fill={`url(#${id}-eye)`} />
      <ellipse cx="78" cy="64" rx="12" ry="14" fill={`url(#${id}-eye)`} />
      <ellipse cx="52.5" cy="67" rx="6" ry="7.5" fill={`url(#${id}-pupil)`} />
      <ellipse cx="80.5" cy="67" rx="6" ry="7.5" fill={`url(#${id}-pupil)`} />
      <circle cx="55" cy="63.5" r="2.3" fill="#ffffff" />
      <circle cx="83" cy="63.5" r="2.3" fill="#ffffff" />
      <ellipse cx="37" cy="84" rx="7" ry="4" fill="#ff8fa6" opacity="0.5" />
      <ellipse cx="91" cy="84" rx="7" ry="4" fill="#ff8fa6" opacity="0.5" />
      <path d="M53 85 Q 64 99 75 85 Q 64 89 53 85 Z" fill="#3b2747" />
      <path d="M58.5 90 Q 64 96 69.5 90 Q 64 91.5 58.5 90 Z" fill="#ff7d96" />
    </svg>
  );
}

/**
 * The peekaboo monster, a new food: only its eyes and horn tips show above a
 * dark round hole, so its mouth stays hidden. Drawn from
 * docs/art/reference/peekaboo.svg. One drawing is used for every new food.
 * Decorative (aria-hidden); ids are prefixed with useId().
 */
export function PeekabooArt({ size = 40 }: { size?: number } = {}) {
  const id = useArtId();
  return (
    <svg
      className="foodArt"
      width={size}
      height={size}
      viewBox="0 0 128 128"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-rim`} cx="0.38" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#efe8ff" />
          <stop offset="0.6" stopColor="#bba9ee" />
          <stop offset="1" stopColor="#8a72cf" />
        </radialGradient>
        <radialGradient id={`${id}-hole`} cx="0.5" cy="0.62" r="0.62">
          <stop offset="0" stopColor="#3a2b63" />
          <stop offset="1" stopColor="#171028" />
        </radialGradient>
        <radialGradient id={`${id}-head`} cx="0.45" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#4c3b80" />
          <stop offset="1" stopColor="#2a1f4a" />
        </radialGradient>
        <EyeDefs id={id} />
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <clipPath id={`${id}-clip`}>
          <circle cx="64" cy="64" r="44" />
        </clipPath>
      </defs>
      <ellipse cx="64" cy="119" rx="40" ry="6" fill={`url(#${id}-shadow)`} />
      <circle cx="64" cy="62" r="55" fill={`url(#${id}-rim)`} />
      <circle cx="64" cy="64" r="44" fill={`url(#${id}-hole)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <path d="M44 56 C 41 46, 43 38, 49 33 C 53 40, 56 47, 56 54 Z" fill="#4a3a7c" />
        <path d="M84 56 C 87 46, 85 38, 79 33 C 75 40, 72 47, 72 54 Z" fill="#4a3a7c" />
        <path d="M26 120 C 24 84, 42 54, 64 54 C 86 54, 104 84, 102 120 Z" fill={`url(#${id}-head)`} />
        <ellipse cx="51" cy="74" rx="14" ry="16" fill="#cbb8ff" opacity="0.4" filter={`url(#${id}-glow)`} />
        <ellipse cx="77" cy="74" rx="14" ry="16" fill="#cbb8ff" opacity="0.4" filter={`url(#${id}-glow)`} />
        <ellipse cx="51" cy="74" rx="11" ry="13" fill={`url(#${id}-eye)`} />
        <ellipse cx="77" cy="74" rx="11" ry="13" fill={`url(#${id}-eye)`} />
        <ellipse cx="54" cy="72" rx="5.5" ry="7" fill={`url(#${id}-pupil)`} />
        <ellipse cx="80" cy="72" rx="5.5" ry="7" fill={`url(#${id}-pupil)`} />
        <circle cx="56" cy="69" r="2" fill="#ffffff" />
        <circle cx="82" cy="69" r="2" fill="#ffffff" />
      </g>
      <ellipse cx="44" cy="20" rx="14" ry="6" transform="rotate(-20 44 20)" fill="#ffffff" opacity="0.45" />
      <path d="M106 16 l2.6 7.4 7.4 2.6 -7.4 2.6 -2.6 7.4 -2.6 -7.4 -7.4 -2.6 7.4 -2.6 z" fill="#ffd36b" />
      <path d="M18 98 l1.8 5 5 1.8 -5 1.8 -1.8 5 -1.8 -5 -5 -1.8 5 -1.8 z" fill="#ffd36b" />
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
      <ellipse cx="20" cy="25" rx="15" ry="12" fill="var(--fm-color-pumpkin-surface, #f7c9a0)" />
      <ellipse cx="20" cy="25" rx="15" ry="12" fill="none" stroke="var(--fm-color-accent, #b4541a)" strokeWidth="1.1" opacity="0.5" />
      {/* Soft ribs */}
      <path d="M20 14 v22" stroke="var(--fm-color-accent, #b4541a)" strokeWidth="1.1" opacity="0.5" />
      <path d="M12 17 q-3 8 0 16" fill="none" stroke="var(--fm-color-accent, #b4541a)" strokeWidth="1.1" opacity="0.5" />
      <path d="M28 17 q3 8 0 16" fill="none" stroke="var(--fm-color-accent, #b4541a)" strokeWidth="1.1" opacity="0.5" />
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
        fill="var(--fm-color-ghost-surface, #e7e0f3)"
        stroke="var(--fm-color-lavender, #e7e0f3)"
        strokeWidth="1"
        opacity="0.85"
      />
      {/* Round friendly eyes */}
      <circle cx="16" cy="19" r="1.7" fill="var(--fm-color-heading, #4a2f5e)" />
      <circle cx="24" cy="19" r="1.7" fill="var(--fm-color-heading, #4a2f5e)" />
      {/* Soft smile */}
      <path
        d="M16 24 q4 3 8 0"
        fill="none"
        stroke="var(--fm-color-heading, #4a2f5e)"
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
      <path d="M17 6 q3 -4 6 0" fill="none" stroke="var(--fm-color-accent, #b4541a)" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="15" y="7" width="10" height="3" rx="1.5" fill="var(--fm-color-accent, #b4541a)" />
      {/* Rounded body */}
      <rect x="13" y="10" width="14" height="22" rx="7" fill="var(--fm-color-pumpkin-surface, #f7c9a0)" stroke="var(--fm-color-accent, #b4541a)" strokeWidth="1.2" />
      {/* Warm glow */}
      <ellipse cx="20" cy="21" rx="4.5" ry="6" fill="var(--fm-color-accent-soft, #f6d9c4)" />
      <circle cx="20" cy="21" r="2.4" fill="#ffd79a" />
      {/* Base */}
      <rect x="15" y="31" width="10" height="3" rx="1.5" fill="var(--fm-color-accent, #b4541a)" />
    </svg>
  );
}
