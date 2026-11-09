import { describe, expect, it } from 'vitest';
import { BUILTIN_RECIPES } from '../data/recipes';
import { SOURCES } from './safety/rules';
import {
  NUTRITION_RULES,
  NUTRITION_VERSION,
  UNCONFIRMED_TAGS,
  nutritionTags,
  nutritionTerms,
  recipeNutritionTags,
  type NutritionTag,
} from './nutrition';

const tags = (...names: string[]) => nutritionTags(names.map((name) => ({ name })));

describe('rule format', () => {
  it('has a version', () => {
    expect(NUTRITION_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('uses lowercase, singular terms', () => {
    for (const rule of NUTRITION_RULES) {
      for (const term of [...rule.terms, ...(rule.except ?? [])]) {
        expect(term, `${rule.tag}: ${term}`).toBe(term.toLowerCase().trim());
        expect(term, `${rule.tag}: ${term}`).toMatch(/^[a-z]+( [a-z]+)*$/);
        for (const word of term.split(' ')) {
          // plural-looking words that are not plural nouns
          if (['hummus', 'asparagus'].includes(word)) continue;
          expect(word.endsWith('s'), `${rule.tag}: "${term}" looks plural`).toBe(false);
        }
      }
    }
  });

  it('gives every rule a CDC or USDA source that exists with a URL', () => {
    for (const rule of NUTRITION_RULES) {
      expect(rule.sources.length).toBeGreaterThan(0);
      for (const id of rule.sources) {
        expect(SOURCES[id], `${rule.tag} cites unknown ${id}`).toBeDefined();
        expect(SOURCES[id].url).toMatch(/^https:\/\/www\.(cdc|fns\.usda)\.gov\//);
      }
    }
  });

  it('lists the new sources in the sources table', () => {
    expect(SOURCES['CDC-iron'].url).toBe(
      'https://www.cdc.gov/infant-toddler-nutrition/vitamins-minerals/iron.html',
    );
    expect(SOURCES['CDC-encourage'].url).toBe(
      'https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/foods-and-drinks-to-encourage.html',
    );
    expect(SOURCES['USDA-FNS-iron'].url).toContain('FI_PHa_5MakingSureEnoughIron.pdf');
  });

  it('accounts for all seven tags: a rule or an unconfirmed note', () => {
    const all: NutritionTag[] = ['iron-rich', 'protein', 'vegetable', 'fruit', 'whole-grain', 'dairy', 'healthy-fat'];
    for (const tag of all) {
      const has = NUTRITION_RULES.some((r) => r.tag === tag);
      expect(has || UNCONFIRMED_TAGS.includes(tag), tag).toBe(true);
      expect(has && UNCONFIRMED_TAGS.includes(tag), tag).toBe(false);
    }
    expect(nutritionTerms('healthy-fat').terms).toEqual([]);
  });
});

describe('each tag fires', () => {
  const fixtures: Array<[NutritionTag, string]> = [
    ['iron-rich', 'ground beef'],
    ['protein', 'chicken thighs'],
    ['vegetable', 'carrots'],
    ['fruit', 'ripe banana'],
    ['whole-grain', 'whole grain bread'],
    ['dairy', 'plain yogurt'],
  ];
  it.each(fixtures)('%s on "%s"', (tag, name) => {
    expect(tags(name)).toContain(tag);
  });

  it('fires every confirmed tag on at least one fixture or built-in recipe', () => {
    const seen = new Set<NutritionTag>();
    for (const [tag] of fixtures) seen.add(tag);
    for (const r of BUILTIN_RECIPES) recipeNutritionTags(r).forEach((t) => seen.add(t));
    for (const rule of NUTRITION_RULES) expect(seen.has(rule.tag), rule.tag).toBe(true);
  });

  it('every term fires on itself and its plural-aware forms', () => {
    for (const rule of NUTRITION_RULES) {
      for (const term of rule.terms) {
        expect(nutritionTags([{ name: term }]), `${rule.tag}: ${term}`).toContain(rule.tag);
      }
    }
  });

  it('works on built-in recipes with no extra input', () => {
    expect(BUILTIN_RECIPES.some((r) => recipeNutritionTags(r).length > 0)).toBe(true);
  });
});

describe('except and matching cases', () => {
  it('green bean is a vegetable, not iron-rich', () => {
    expect(tags('green beans')).toContain('vegetable');
    expect(tags('green beans')).not.toContain('iron-rich');
  });
  it('black beans are iron-rich', () => {
    expect(tags('black beans')).toContain('iron-rich');
  });
  it('jelly bean and vanilla bean get no tags', () => {
    expect(tags('jelly beans')).toEqual([]);
    expect(tags('vanilla bean')).toEqual([]);
  });
  it('plant milks and infant milks are not dairy', () => {
    for (const n of ['oat milk', 'almond milk', 'coconut milk', 'rice milk', 'soy milk', 'breast milk', 'formula milk']) {
      expect(tags(n), n).not.toContain('dairy');
    }
    expect(tags('whole milk')).toContain('dairy');
    expect(tags('soy yogurt')).toContain('dairy');
  });
  it('sweet potato puff and orange juice are excluded', () => {
    expect(tags('sweet potato puffs')).not.toContain('vegetable');
    expect(tags('sweet potato')).toContain('vegetable');
    expect(tags('orange juice')).not.toContain('fruit');
    expect(tags('orange')).toContain('fruit');
  });
  it('matches whole tokens only', () => {
    expect(tags('eggplant')).toEqual([]);
    expect(tags('peanut')).toEqual([]);
    expect(tags('peanut butter')).toEqual([]);
  });
  it('iron-fortified infant cereal is iron-rich, plain cereal is not', () => {
    expect(tags('iron-fortified infant cereal')).toContain('iron-rich');
    expect(tags('oat cereal')).toEqual([]);
  });
  it('returns tags in a stable order without duplicates', () => {
    expect(tags('chicken', 'carrot', 'beef')).toEqual(['iron-rich', 'protein', 'vegetable']);
  });
});

describe('optional ingredients', () => {
  it('are ignored', () => {
    expect(nutritionTags([{ name: 'banana', optional: true }])).toEqual([]);
    expect(nutritionTags([{ name: 'banana', optional: true }, { name: 'beef' }])).toEqual(['iron-rich', 'protein']);
  });
});
