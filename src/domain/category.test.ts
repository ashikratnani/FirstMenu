import { describe, expect, it } from 'vitest';
import { guessCategory } from './category';

describe('guessCategory', () => {
  it('frozen token wins first', () => {
    expect(guessCategory('frozen peas')).toBe('frozen');
    expect(guessCategory('Frozen blueberries')).toBe('frozen');
    expect(guessCategory('frozen chicken')).toBe('frozen');
  });

  it('dairy-eggs', () => {
    for (const n of ['plain yogurt', 'cheddar cheese', 'cottage cheese', 'ricotta', 'whole milk',
      'buttermilk', 'eggs', 'egg yolk', 'unsalted butter', 'Greek Yogurts']) {
      expect(guessCategory(n), n).toBe('dairy-eggs');
    }
  });

  it('protein', () => {
    for (const n of ['ground beef', 'lamb', 'pork chops', 'chicken thighs', 'turkey', 'salmon fillet',
      'tuna', 'shrimp', 'firm tofu', 'red lentils', 'black beans', 'chickpeas', 'steak']) {
      expect(guessCategory(n), n).toBe('protein');
    }
  });

  it('grains', () => {
    for (const n of ['brown rice', 'rolled oats', 'all-purpose flour', 'pasta', 'egg-free noodles',
      'whole wheat bread', 'infant cereal', 'quinoa', 'barley', 'crackers', 'oatmeal']) {
      expect(guessCategory(n), n).toBe('grains');
    }
  });

  it('produce', () => {
    for (const n of ['sweet potato', 'carrots', 'peas', 'broccoli florets', 'butternut squash',
      'spinach', 'green beans', 'tomatoes', 'bell pepper', 'apples', 'banana', 'avocado',
      'blueberries', 'peach', 'prunes', 'applesauce']) {
      expect(guessCategory(n), n).toBe('produce');
    }
  });

  it('pantry', () => {
    for (const n of ['olive oil', 'cinnamon', 'cumin', 'nutmeg', 'ground ginger', 'garlic powder',
      'paprika', 'dried oregano', 'baking powder', 'baking soda', 'vanilla extract']) {
      expect(guessCategory(n), n).toBe('pantry');
    }
  });

  it('falls back to other', () => {
    for (const n of ['water', 'salt', 'honeydew', '', '   ', '!!!']) {
      expect(guessCategory(n), n).toBe('other');
    }
  });

  describe('word boundaries and plurals', () => {
    it('does not match inside longer words', () => {
      expect(guessCategory('eggplant')).toBe('other');
      expect(guessCategory('butternut squash')).toBe('produce');
      expect(guessCategory('peanuts')).toBe('other');
      expect(guessCategory('pear')).toBe('produce');
      expect(guessCategory('pearl barley')).toBe('grains');
      expect(guessCategory('spice')).toBe('other');
      expect(guessCategory('foil')).toBe('other');
    });

    it('handles plurals and case', () => {
      expect(guessCategory('Eggs')).toBe('dairy-eggs');
      expect(guessCategory('CHERRY TOMATOES')).toBe('produce');
      expect(guessCategory('strawberries')).toBe('produce');
      expect(guessCategory('Plums')).toBe('produce');
    });
  });

  describe('ambiguous names follow the rule order', () => {
    it('peanut butter and nut butters are not dairy', () => {
      expect(guessCategory('peanut butter')).toBe('pantry');
      expect(guessCategory('almond butter')).toBe('pantry');
      expect(guessCategory('butter')).toBe('dairy-eggs');
    });

    it('plant milks are not dairy, grains, or produce', () => {
      expect(guessCategory('coconut milk')).toBe('pantry');
      expect(guessCategory('oat milk')).toBe('pantry');
      expect(guessCategory('rice milk')).toBe('pantry');
      expect(guessCategory('soy milk')).toBe('pantry');
      expect(guessCategory('almond milk')).toBe('pantry');
      expect(guessCategory('milk')).toBe('dairy-eggs');
    });

    it('breast milk and formula milk are other', () => {
      expect(guessCategory('breast milk')).toBe('other');
      expect(guessCategory('formula milk')).toBe('other');
    });

    it('plant and infant qualifiers must directly precede the dairy term', () => {
      expect(guessCategory('egg fried rice')).toBe('dairy-eggs');
      expect(guessCategory('rice and cheese')).toBe('dairy-eggs');
      expect(guessCategory('cheese oat bar')).toBe('dairy-eggs');
      expect(guessCategory('soy marinated eggs')).toBe('dairy-eggs');
      expect(guessCategory('butter and rice')).toBe('dairy-eggs');
      expect(guessCategory('free range eggs')).toBe('dairy-eggs');
    });

    it('plant yogurt and cheese are not dairy', () => {
      expect(guessCategory('coconut yogurt')).toBe('other');
      expect(guessCategory('oat yogurt')).toBe('other');
    });

    it('free-from names ignore the excluded word', () => {
      expect(guessCategory('gluten free pasta')).toBe('grains');
    });

    it('bean exception only ignores the bean, not other protein', () => {
      expect(guessCategory('chicken and green beans')).toBe('protein');
      expect(guessCategory('green beans and ham')).toBe('protein');
    });

    it('dairy-free names are alternatives, not dairy', () => {
      expect(guessCategory('dairy-free milk')).toBe('pantry');
      expect(guessCategory('dairy free yogurt')).toBe('other');
    });

    it('free range is not a free-from phrase', () => {
      expect(guessCategory('free range eggs')).toBe('dairy-eggs');
    });

    it('bean exceptions', () => {
      expect(guessCategory('green beans')).toBe('produce');
      expect(guessCategory('vanilla bean')).toBe('pantry');
      expect(guessCategory('jelly beans')).toBe('other');
    });

    it('earlier rules beat later ones', () => {
      expect(guessCategory('egg noodles')).toBe('dairy-eggs');
      expect(guessCategory('cheese pasta')).toBe('dairy-eggs');
      expect(guessCategory('chicken and rice')).toBe('protein');
      expect(guessCategory('rice cereal')).toBe('grains');
      expect(guessCategory('oat flour')).toBe('grains');
      expect(guessCategory('corn flour')).toBe('grains');
    });

    it('produce exceptions fall through', () => {
      expect(guessCategory('sweet potato puff')).toBe('other');
      expect(guessCategory('apple juice')).toBe('other');
      expect(guessCategory('sweet potato')).toBe('produce');
    });

    it('applesauce is produce, not matched via apple alone', () => {
      expect(guessCategory('unsweetened applesauce')).toBe('produce');
    });

    it('coconut oil is pantry', () => {
      expect(guessCategory('coconut oil')).toBe('pantry');
    });
  });
});
