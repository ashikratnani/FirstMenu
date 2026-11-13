import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DoorArt,
  GhostArt,
  LanternArt,
  MonsterArt,
  PeekabooArt,
  PumpkinArt,
} from './foodArt';
import GhostCard from './GhostCard';
import cardStyles from './foodCard.module.css';
// Load the stylesheets as raw text (Vite `?raw`) so we can assert, without
// running CSS, that the animations exist and are gated by reduced motion.
import themeCss from '../theme.css?raw';
import cardCss from './foodCard.module.css?raw';

/** Every theme illustration is a decorative, inline, aria-hidden SVG (Req 14.3). */
describe('foodArt illustrations stay decorative', () => {
  const arts = {
    DoorArt,
    MonsterArt,
    PeekabooArt,
    PumpkinArt,
    GhostArt,
    LanternArt,
  } as const;

  for (const [name, Art] of Object.entries(arts)) {
    it(`${name} renders an inline SVG with aria-hidden and focusable="false"`, () => {
      const { container } = render(<Art />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('focusable', 'false');
      expect(svg).toHaveClass('foodArt');
    });
  }
});

describe('MonsterArt per-group variant', () => {
  it('renders the generic monster (data-monster="generic") with no group', () => {
    const { container } = render(<MonsterArt />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-monster', 'generic');
  });

  it('renders a per-group variant whose data-monster identifies the group', () => {
    const { container } = render(<MonsterArt group="peanut" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-monster', 'peanut');
    // No visible/accessible text is introduced by the variant (Req 14.3).
    expect(container.textContent).toBe('');
  });
});

describe('monster drawings use unique ids', () => {
  const ids = (svg: Element) => [...svg.querySelectorAll('[id]')].map((el) => el.id);

  it('two monsters of different colors on one page share no id and each reference their own', () => {
    const { container } = render(
      <>
        <MonsterArt group="egg" />
        <MonsterArt group="fish" />
      </>,
    );
    const [egg, fish] = [...container.querySelectorAll('svg')];
    const all = [...ids(egg), ...ids(fish)];
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all).size).toBe(all.length);
    // The body fill points at a gradient inside the same drawing.
    for (const svg of [egg, fish]) {
      const own = new Set(ids(svg));
      const refs = [...svg.querySelectorAll('[fill]')]
        .map((el) => /^url\(#(.+)\)$/.exec(el.getAttribute('fill')!)?.[1])
        .filter((ref): ref is string => ref !== undefined);
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) expect(own.has(ref)).toBe(true);
    }
    expect(container.innerHTML).toContain('#e0a338');
    expect(container.innerHTML).toContain('#70a8ad');
  });

  it('a monster and the peekaboo monster share no id, and ids are safe inside url()', () => {
    const { container } = render(
      <>
        <MonsterArt />
        <PeekabooArt />
      </>,
    );
    const all = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(id).toMatch(/^[A-Za-z][\w-]*$/);
  });

  it('draws at the size it is given in a 128-unit viewBox and adds no text', () => {
    const { container } = render(<MonsterArt size={96} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '96');
    expect(svg).toHaveAttribute('viewBox', '0 0 128 128');
    expect(container.textContent).toBe('');
  });
});

describe('card components keep text + accessible name, art stays decorative', () => {
  it('GhostCard: label carries the accessible name; ghost art aria-hidden', () => {
    render(
      <ul>
        <GhostCard label="Not yet: honey. Available at 12 months." />
      </ul>,
    );
    const item = screen.getByRole('listitem', {
      name: 'Not yet: honey. Available at 12 months.',
    });
    expect(item).toHaveTextContent('Not yet: honey. Available at 12 months.');
    const svg = item.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});

/*
 * jsdom can't run CSS animations, so we assert the CSS-only animations are
 * defined AND disabled under prefers-reduced-motion (Req 14.5) by reading the
 * stylesheets. The door-open animation lives in theme.css (global .doorPanel);
 * the ghost-float lives in the card module CSS.
 */
describe('animations are CSS-only and gated by reduced motion (Req 14.5)', () => {
  it('theme.css defines a door-open animation', () => {
    expect(themeCss).toMatch(/@keyframes door-open/);
    expect(themeCss).toMatch(/animation:\s*door-open/);
  });

  it('foodCard.module.css defines a ghost-float animation', () => {
    expect(cardCss).toMatch(/@keyframes ghost-float/);
    expect(cardCss).toMatch(/animation:\s*ghost-float/);
  });

  it('both animations are disabled under prefers-reduced-motion: reduce', () => {
    // theme.css: a reduced-motion block that sets door-open to none.
    expect(themeCss).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(themeCss).toMatch(/\.doorPanel\s*{\s*animation:\s*none/);
    // foodCard.module.css: an explicit reduced-motion guard for ghost-float.
    expect(cardCss).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(cardCss).toMatch(/animation:\s*none/);
  });

  /*
   * Regression guard for the dead-selector defect: the ghost-float rule lives
   * in a CSS Module, so a bare `.foodArt` would be HASHED and never match the
   * SVG's literal `foodArt` class. The rule must scope the float under the
   * hashed `.ghost` while keeping `.foodArt` literal via `:global(.foodArt)`,
   * so the compiled selector actually binds to the rendered ghost art. These
   * assertions fail if the scoping regresses to the inert `.ghost .foodArt`.
   */
  it('ghost-float scopes the literal .foodArt via :global so it binds', () => {
    // Both the animation declaration and its reduced-motion guard must use
    // `.ghost :global(.foodArt)` — a bare `.foodArt` here is hashed and dead.
    const floatRules = cardCss.match(/\.ghost[^{]*\{[^}]*ghost-float[^}]*\}/g);
    expect(floatRules).not.toBeNull();
    expect(cardCss).toMatch(
      /\.ghost\s+:global\(\.foodArt\)\s*\{[^}]*animation:\s*ghost-float/,
    );
    expect(cardCss).toMatch(
      /\.ghost\s+:global\(\.foodArt\)\s*\{\s*animation:\s*none/,
    );
    // The module must NOT contain a hashed (non-:global) `.ghost .foodArt`
    // selector, which would be the inert form that never matched the SVG.
    expect(cardCss).not.toMatch(/\.ghost\s+\.foodArt\b/);
  });

  it('GhostCard renders the exact DOM the ghost-float selector targets', () => {
    // The compiled selector is `._ghost_<hash> .foodArt`: a hashed `.ghost`
    // wrapper (from the CSS Module) containing the SVG's LITERAL `foodArt`
    // class. Assert that shape against the real rendered consumer so a hashed
    // or renamed art class — the original dead-selector bug — fails here.
    const { container } = render(
      <ul>
        <GhostCard label="Not yet: honey. Available at 12 months." />
      </ul>,
    );
    const ghost = container.querySelector(`.${cardStyles.ghost}`);
    expect(ghost).not.toBeNull();
    // The ghost wrapper class is the hashed module class, not a literal.
    expect(cardStyles.ghost).not.toBe('ghost');
    // The decorative art inside carries the unhashed literal `foodArt` class,
    // which `:global(.foodArt)` in the module keeps intact so the float binds.
    const art = ghost?.querySelector('svg.foodArt');
    expect(art).not.toBeNull();
    expect(art?.getAttribute('class')).toBe('foodArt');
  });
});
