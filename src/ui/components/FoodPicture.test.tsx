import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import type { Recipe } from '../../domain/types';
import { spyOnNetwork } from '../../test/networkSpy';
import { ruleBody } from '../../test/cssRule';
import firstmenuCss from '../theme/firstmenu.css?raw';
import pictureCss from './FoodPicture.module.css?raw';
import FoodPicture from './FoodPicture';
import Plate from './Plate';
import StatePicture from './StatePicture';
import TagBadge from './TagBadge';

type AxeMatchersModule = { toHaveNoViolations: (r: unknown) => { pass: boolean; message: () => string } };
const { toHaveNoViolations } = axeMatchers as unknown as AxeMatchersModule;

function recipe(names: string[], over: Partial<Recipe> = {}): Recipe {
  return {
    id: 'p1',
    origin: 'custom',
    title: 'Test plate',
    stages: ['6-8'],
    mealTypes: ['lunch'],
    ingredients: names.map((name) => ({ name, category: 'produce' as const })),
    steps: ['Mash.'],
    texture: 'smooth',
    servings: 1,
    ...over,
  };
}

const never = () => false;
const srcs = (c: HTMLElement) => [...c.querySelectorAll('img')].map((i) => i.getAttribute('src'));

describe('FoodPicture', () => {
  it('is a decorative lazy img under the Pages base path with its size set', () => {
    const { container } = render(<FoodPicture name="carrot" size={62} />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', '/FirstMenu/art/foods/carrot.webp');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('width', '62');
    expect(img).toHaveAttribute('height', '62');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('adds nothing to an accessible name', () => {
    render(
      <button type="button">
        <FoodPicture name="carrot" /> Carrot soup
      </button>,
    );
    expect(screen.getByRole('button', { name: 'Carrot soup' })).toBeInTheDocument();
  });

  it('greys the picture only: grayscale and lower opacity, never on text', () => {
    const { container } = render(<FoodPicture name="banana" greyed />);
    expect(container.querySelector('img')!.className).toMatch(/greyed/);
    const body = ruleBody(pictureCss, '.greyed');
    expect(body).toMatch(/filter:\s*grayscale\(1\)/);
    expect(body).toMatch(/opacity:\s*0\.\d+/);
  });
});

describe('StatePicture', () => {
  it('uses the hourglass and snowflake files, and SVG drawings for new and tried', () => {
    const { container } = render(
      <>
        <StatePicture state="not-yet" />
        <StatePicture state="freezes" />
        <StatePicture state="new" />
        <StatePicture state="tried" group="egg" />
      </>,
    );
    expect(srcs(container)).toEqual([
      '/FirstMenu/art/state/hourglass_not_done.webp',
      '/FirstMenu/art/state/snowflake.webp',
    ]);
    for (const img of container.querySelectorAll('img')) expect(img).toHaveAttribute('alt', '');
    expect(container.querySelectorAll('svg[aria-hidden="true"][focusable="false"]')).toHaveLength(2);
    expect(container.querySelector('svg[data-monster="egg"]')).not.toBeNull();
    expect(container.textContent).toBe('');
  });
});

describe('Plate', () => {
  it('shows up to three food pictures on the first food group color', () => {
    const r = recipe(['carrot', 'chicken', 'rice', 'cheese']);
    const { container } = render(<Plate recipe={r} isNotYet={never} />);
    expect(srcs(container)).toEqual([
      '/FirstMenu/art/foods/carrot.webp',
      '/FirstMenu/art/foods/poultry_leg.webp',
      '/FirstMenu/art/foods/cooked_rice.webp',
    ]);
    expect(container.firstElementChild).toHaveAttribute('data-band', 'vegetable');
    expect(container.firstElementChild).toHaveStyle({ backgroundColor: 'var(--fm-color-group-vegetable)' });
  });

  it('shows the generic bowl alone when no main food is left', () => {
    const { container } = render(<Plate recipe={recipe(['red grapes, halved'])} isNotYet={never} />);
    expect(srcs(container)).toEqual(['/FirstMenu/art/foods/bowl_with_spoon.webp']);
    expect(container.firstElementChild).toHaveAttribute('data-band', 'other');
  });

  it('leaves a Not yet food off when the recipe is not Not yet', () => {
    const r = recipe(['carrot', 'pear']);
    const { container } = render(<Plate recipe={r} isNotYet={(key) => key === 'carrot'} />);
    expect(srcs(container)).toEqual(['/FirstMenu/art/foods/pear.webp']);
  });

  it('greys a Not yet plate, keeps its foods and puts the hourglass beside it on the lavender band', () => {
    const r = recipe(['ripe banana'], { title: 'Mashed banana' });
    const { container } = render(<Plate recipe={r} isNotYet={never} notYet />);
    expect(srcs(container)).toEqual([
      '/FirstMenu/art/foods/banana.webp',
      '/FirstMenu/art/state/hourglass_not_done.webp',
    ]);
    const [banana, hourglass] = [...container.querySelectorAll('img')];
    expect(banana.className).toMatch(/greyed/);
    expect(hourglass.className).not.toMatch(/greyed/);
    expect(container.firstElementChild).toHaveAttribute('data-band', 'not-yet');
    expect(container.querySelector('img[src$="bowl_with_spoon.webp"]')).toBeNull();
  });

  it('never greys or adds the hourglass when the recipe is not Not yet', () => {
    const { container } = render(<Plate recipe={recipe(['carrot'])} isNotYet={never} />);
    expect(container.querySelector('img[src*="hourglass"]')).toBeNull();
    for (const img of container.querySelectorAll('img')) expect(img.className).not.toMatch(/greyed/);
  });

  it('adds no text', () => {
    const { container } = render(<Plate recipe={recipe(['carrot'])} isNotYet={never} notYet />);
    expect(container.textContent).toBe('');
  });
});

describe('TagBadge', () => {
  it('shows the tag name in its own background and text colors', () => {
    const { container } = render(<TagBadge tag="iron-rich" />);
    const styled = container.querySelector('[style]')!;
    expect(styled).toHaveTextContent('Iron-rich');
    const style = styled.getAttribute('style')!;
    expect(style).toContain('background-color: var(--fm-color-tag-iron-rich-bg)');
    expect(style).toContain('color: var(--fm-color-tag-iron-rich-text)');
  });
});

describe('heading font', () => {
  it('sets the heading token to Fredoka followed by the body font stack', () => {
    expect(ruleBody(firstmenuCss, "[data-astryx-theme='neutral']")).toMatch(
      /--font-family-heading:\s*Fredoka,\s*var\(--font-family-body\)/,
    );
    expect(ruleBody(firstmenuCss, ":is(h1, h2, h3)")).toMatch(/font-family:\s*var\(--font-family-heading\)/);
  });
});

describe('art components', () => {
  it('make no network request and have no axe violations', async () => {
    const network = spyOnNetwork();
    const r = recipe(['carrot', 'chicken']);
    const { container } = render(
      <main>
        <h1>Plates</h1>
        <Plate recipe={r} isNotYet={never} />
        <Plate recipe={r} isNotYet={never} notYet />
        <StatePicture state="new" />
        <StatePicture state="tried" />
        <StatePicture state="freezes" />
        <TagBadge tag="fruit" />
      </main>,
    );
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    const outcome = toHaveNoViolations(results);
    expect(outcome.pass, outcome.message()).toBe(true);
    network.expectNoNetwork();
  });
});
