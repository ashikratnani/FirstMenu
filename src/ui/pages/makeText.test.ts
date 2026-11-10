import { describe, expect, it } from 'vitest';
import { removeFilterPhrases, removeTypedWord } from './makeText';

describe('removeFilterPhrases', () => {
  it('removes a phrase and the separators around it', () => {
    expect(removeFilterPhrases('chicken, something quick, rice', 'quick')).toBe(
      'chicken, something, rice',
    );
    expect(removeFilterPhrases('rice and iron rich', 'tag:iron-rich')).toBe('rice');
    expect(removeFilterPhrases('breakfast', 'meal:breakfast')).toBe('');
  });

  it('matches hyphens, accents and plurals the way the search does', () => {
    expect(removeFilterPhrases('Iron-rich lunch', 'tag:iron-rich')).toBe('lunch');
    expect(removeFilterPhrases('purée and banana', 'form:puree')).toBe('banana');
    expect(removeFilterPhrases('dinners with peas', 'meal:dinner')).toBe('peas');
  });

  it('removes the longest phrase first and leaves other text alone', () => {
    expect(removeFilterPhrases('iron rich, rice', 'tag:iron-rich')).toBe('rice');
    expect(removeFilterPhrases('chicken rice', 'meal:lunch')).toBe('chicken rice');
  });
});

describe('removeTypedWord', () => {
  it('removes the typed word only', () => {
    expect(removeTypedWord('rice, brocoli and peas', 'brocoli')).toBe('rice, and peas');
    expect(removeTypedWord('brocoli', 'brocoli')).toBe('');
  });
});
