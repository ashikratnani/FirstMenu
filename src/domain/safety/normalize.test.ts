import { describe, expect, it } from 'vitest';
import { matchesTerm, normalize, termMatchesTokens, tokenize, tokenMatches } from './normalize';

describe('normalize', () => {
  it('lowercases and turns apostrophes into spaces ("Cow\'s Milk")', () => {
    expect(normalize("Cow's Milk")).toBe('cow s milk');
  });

  it('strips accents via NFKD', () => {
    expect(normalize('Crème Brûlée')).toBe('creme brulee');
    expect(normalize('jalapeño')).toBe('jalapeno');
  });

  it('replaces every non-alphanumeric run with a single space and trims', () => {
    expect(normalize('  2 eggs, large!  ')).toBe('2 eggs large');
    expect(normalize('whole-milk / yogurt')).toBe('whole milk yogurt');
  });

  it('returns an empty string for punctuation-only input', () => {
    expect(normalize('---')).toBe('');
  });
});

describe('tokenize', () => {
  it('splits a normalized name into tokens', () => {
    expect(tokenize("Cow's Milk")).toEqual(['cow', 's', 'milk']);
    expect(tokenize('cherry tomatoes')).toEqual(['cherry', 'tomatoes']);
  });

  it('returns an empty array for empty input', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('tokenMatches (plural-aware)', () => {
  it('matches a plain singular', () => {
    expect(tokenMatches('grape', 'grape')).toBe(true);
  });

  it('matches +s, +es and y->ies plurals', () => {
    expect(tokenMatches('grapes', 'grape')).toBe(true);
    expect(tokenMatches('tomatoes', 'tomato')).toBe(true);
    expect(tokenMatches('peaches', 'peach')).toBe(true);
    expect(tokenMatches('cheeses', 'cheese')).toBe(true);
    expect(tokenMatches('berries', 'berry')).toBe(true);
  });

  it('does not match unrelated tokens', () => {
    expect(tokenMatches('grapefruit', 'grape')).toBe(false);
    expect(tokenMatches('eggplant', 'egg')).toBe(false);
  });
});

describe('termMatchesTokens (consecutive run)', () => {
  it('matches a multi-word term as a consecutive run, plural-aware', () => {
    expect(termMatchesTokens(['cherry', 'tomatoes'], ['cherry', 'tomato'])).toBe(true);
  });

  it('does not match when the run is not consecutive', () => {
    // "cherry ... tomato" with a word in between is not a run.
    expect(
      termMatchesTokens(['cherry', 'red', 'tomatoes'], ['cherry', 'tomato']),
    ).toBe(false);
  });

  it('is false for an empty term', () => {
    expect(termMatchesTokens(['anything'], [])).toBe(false);
  });
});

describe('matchesTerm', () => {
  it('matches plural ingredient names against singular terms', () => {
    expect(matchesTerm('red grapes', 'grape')).toBe(true);
    expect(matchesTerm('grated cheeses', 'cheese')).toBe(true);
  });

  it('avoids the classic false positives', () => {
    expect(matchesTerm('honeydew melon', 'honey')).toBe(false);
    expect(matchesTerm('eggplant', 'egg')).toBe(false);
    expect(matchesTerm('grapefruit', 'grape')).toBe(false);
  });
});

describe('normalize and token caches', () => {
  it('tokenize returns a fresh array each call, so mutating it cannot corrupt the cache', () => {
    const a = tokenize('Cow\'s Milk');
    a.push('junk');
    a[0] = 'changed';
    const b = tokenize('Cow\'s Milk');
    expect(b).toEqual(['cow', 's', 'milk']);
    expect(b).not.toBe(a);
    expect(matchesTerm("Cow's Milk", 'cow s milk')).toBe(true);
  });

  it('gives the same answers before and after the 20,000-entry cache clear', () => {
    const before = [normalize('Honeydew Melon'), matchesTerm('Honey', 'honey'), matchesTerm('honeydew', 'honey')];
    for (let i = 0; i < 20500; i++) {
      normalize(`filler ${i}`);
      matchesTerm(`filler ${i}`, 'honey');
    }
    const after = [normalize('Honeydew Melon'), matchesTerm('Honey', 'honey'), matchesTerm('honeydew', 'honey')];
    expect(after).toEqual(before);
    expect(after).toEqual(['honeydew melon', true, false]);
    expect(tokenize('Cow\'s Milk')).toEqual(['cow', 's', 'milk']);
  });
});
