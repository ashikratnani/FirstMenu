import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  LanternArt,
  MonsterArt,
  PeekabooArt,
} from './foodArt';
import GhostCard from './GhostCard';

/** Every theme illustration is a decorative, inline, aria-hidden SVG (Req 14.3). */
describe('foodArt illustrations stay decorative', () => {
  const arts = {
    MonsterArt,
    PeekabooArt,
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
  it('GhostCard: label carries the accessible name; the given art stays aria-hidden', () => {
    render(
      <ul>
        <GhostCard label="Not yet: honey. Available at 12 months." art={<PeekabooArt />} />
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

describe('removed art stays removed', () => {
  it('theme.css and the card module define no door or ghost animation', async () => {
    const theme = (await import('../theme.css?raw')).default;
    const card = (await import('./foodCard.module.css?raw')).default;
    expect(`${theme}${card}`).not.toMatch(/door-open|ghost-float|doorPanel/);
  });

  it('GhostCard draws only the art it is given', () => {
    const { container } = render(
      <ul>
        <GhostCard label="Not yet: honey." art={<span data-testid="given" />} />
      </ul>,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByTestId('given')).toBeInTheDocument();
  });
});
