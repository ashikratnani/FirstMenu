import { describe, expect, it } from 'vitest';
import type { Recipe } from '../types';
import { normalize, matchesTerm, tokenize } from './normalize';
import { screenIngredient, screenRecipe, screenTextMentions, textMentionsBlockFood } from './screen';

const AGE = 6;

// Hangul fillers, variation selectors (VS1, VS16, supplement), Braille blank,
// plus zero-width, soft hyphen, word joiner, BOM, bidi mark and a tag character.
const INVISIBLES: Array<[string, string]> = [
  ['U+3164 Hangul filler', '\u3164'],
  ['U+FFA0 halfwidth Hangul filler', '\uFFA0'],
  ['U+115F Hangul choseong filler', '\u115F'],
  ['U+1160 Hangul jungseong filler', '\u1160'],
  ['U+FE00 VS1', '\uFE00'],
  ['U+FE0F VS16', '\uFE0F'],
  ['U+E0100 VS17', '\u{E0100}'],
  ['U+E01EF VS256', '\u{E01EF}'],
  ['U+2800 Braille blank', '\u2800'],
  ['U+200B zero width space', '\u200B'],
  ['U+200D zero width joiner', '\u200D'],
  ['U+00AD soft hyphen', '\u00AD'],
  ['U+2060 word joiner', '\u2060'],
  ['U+FEFF BOM', '\uFEFF'],
  ['U+200E left-to-right mark', '\u200E'],
  ['U+E0041 tag character', '\u{E0041}'],
  ['U+0000 NUL', '\u0000'],
  ['U+0001 control', '\u0001'],
  ['U+0085 next line', '\u0085'],
  ['U+007F delete', '\u007F'],
  ['U+009F control', '\u009F'],
  ['U+E000 private use', '\uE000'],
  ['U+F8FF private use', '\uF8FF'],
  ['U+10FFFD plane 16 private use', '\u{10FFFD}'],
  ['U+0378 unassigned', '\u0378'],
  ['U+FFFF noncharacter', '\uFFFF'],
  ['U+D800 lone high surrogate', '\uD800'],
  ['U+DC00 lone low surrogate', '\uDC00'],
  ['U+FFFC object replacement', '\uFFFC'],
  ['U+20DD combining enclosing circle', '\u20DD'],
  ['U+20D2 combining long vertical line', '\u20D2'],
  ['U+1AB0 combining doubled circumflex', '\u1AB0'],
  ['U+FE20 combining ligature left half', '\uFE20'],
  ['U+0301 combining acute', '\u0301'],
];

// [word with a gap, rule id]
const WORDS: Array<[string, string, string]> = [
  ['ho', 'ney', 'honey'],
  ['sa', 'lt', 'added-salt'],
  ['pea', 'nut', 'allergen-peanut'],
  ['gra', 'pes', 'grapes'],
];

function recipe(over: Partial<Recipe> = {}): Recipe {
  return {
    id: 'inv',
    origin: 'custom',
    title: 'Banana oats',
    stages: ['6-8'],
    mealTypes: ['lunch'],
    ingredients: [{ name: 'banana', category: 'produce' }],
    steps: ['Mash the banana.'],
    notes: [],
    texture: 'smooth',
    servings: 1,
    imported: { from: 'chatgpt', text: 'x', date: '2026-01-05' },
    ...over,
  };
}

describe('invisible characters cannot hide a food word (must fire)', () => {
  for (const [label, ch] of INVISIBLES) {
    describe(label, () => {
      for (const [a, b, ruleId] of WORDS) {
        const word = `${a}${ch}${b}`;
        it(`ingredient name "${a}<inv>${b}" fires ${ruleId}`, () => {
          expect(screenIngredient(word, AGE).map((f) => f.ruleId)).toContain(ruleId);
          expect(screenIngredient(`1 tsp ${word}`, AGE).map((f) => f.ruleId)).toContain(ruleId);
          const result = screenRecipe(recipe({ ingredients: [{ name: word, category: 'pantry' }] }), AGE);
          expect(
            [...result.blocks, ...result.reminders, ...result.allergens].map((f) => f.ruleId),
          ).toContain(ruleId);
        });
      }

      it('textMentionsBlockFood and screenTextMentions fire in steps, notes and title', () => {
        const honey = `ho${ch}ney`;
        expect(textMentionsBlockFood(honey)).toBe(true);
        expect(textMentionsBlockFood(`Drizzle with ${honey} on top.`)).toBe(true);
        const r = recipe({
          title: `${honey} oats`,
          steps: [`Drizzle with ${honey}.`],
          notes: [`Add sa${ch}lt to taste.`],
        });
        const mentions = screenTextMentions(r, AGE);
        expect(mentions.map((m) => `${m.ruleId}:${m.where}`).sort()).toEqual(
          ['added-salt:note', 'honey:step', 'honey:title'].sort(),
        );
      });

      it('an invisible character used as a separator still fires', () => {
        expect(screenIngredient(`honey${ch}cake`, AGE).map((f) => f.ruleId)).toContain('honey');
        expect(textMentionsBlockFood(`honey${ch}cake`)).toBe(true);
        expect(textMentionsBlockFood(`${ch}honey${ch}`)).toBe(true);
      });
    });
  }

  it('runs of several invisible characters still fire', () => {
    expect(textMentionsBlockFood('ho\u3164\uFE0F\u2800\u200Bney')).toBe(true);
    expect(screenIngredient('ho\u3164\uFE0F\u2800\u200Bney', AGE).map((f) => f.ruleId)).toContain('honey');
  });

  it('the reviewer probes', () => {
    expect(textMentionsBlockFood('ho\u3164ney')).toBe(true);
    expect(textMentionsBlockFood('ho\ufe0fney')).toBe(true);
  });
});

describe('invisible characters do not cause false positives (must not fire)', () => {
  it('normal words and non-matching foods stay quiet', () => {
    expect(textMentionsBlockFood('Mash the banana.')).toBe(false);
    expect(screenIngredient('honeydew melon', AGE).map((f) => f.ruleId)).not.toContain('honey');
    expect(screenIngredient('ho\u3164neydew melon', AGE).map((f) => f.ruleId)).not.toContain('honey');
    expect(screenIngredient('eggplant', AGE).map((f) => f.ruleId)).not.toContain('allergen-egg');
  });

  it('emoji with VS16 on an unrelated word do not fire', () => {
    expect(textMentionsBlockFood('Mash the banana \u2764\uFE0F and enjoy \u2600\uFE0F')).toBe(false);
    expect(textMentionsBlockFood('Yummy \u{1F34C}\uFE0F bananas \u{1F44D}\u{1F3FD}')).toBe(false);
    expect(screenIngredient('banana\uFE0F', AGE)).toEqual([]);
    expect(screenTextMentions(recipe({ steps: ['Love it \u2764\uFE0F.'] }), AGE)).toEqual([]);
  });

  it('accented text is unchanged', () => {
    expect(normalize('Crème Brûlée')).toBe('creme brulee');
    expect(normalize('jalape\u00F1o')).toBe('jalapeno');
    expect(textMentionsBlockFood('Une cr\u00E8me d\u00E9licieuse.')).toBe(false);
  });

  it('normalize strips invisibles and keeps ordinary spacing', () => {
    expect(normalize('ho\u3164ney')).toBe('honey');
    expect(normalize('ho\uFE0Fney  badger')).toBe('honey badger');
    expect(tokenize('a\u200Bb c')).toEqual(['ab', 'c']);
    expect(matchesTerm('ho\u2800ney', 'honey')).toBe(true);
  });
});

describe('control, private-use and combining-mark characters (extra cases)', () => {
  it('tab, CR and LF stay whitespace', () => {
    expect(normalize('honey\tcake')).toBe('honey cake');
    expect(normalize('honey\r\ncake')).toBe('honey cake');
    expect(tokenize('a\nb')).toEqual(['a', 'b']);
  });

  it('the reviewer probes', () => {
    for (const ch of ['\u0001', '\u0000', '\u0085', '\uE000', '\uD800', '\uFFFC', '\u20DD', '\u20D2', '\u1AB0', '\uFE20']) {
      expect(textMentionsBlockFood(`ho${ch}ney`)).toBe(true);
      expect(matchesTerm(`ho${ch}ney`, 'honey')).toBe(true);
    }
  });

  it('mixed runs still fire', () => {
    expect(textMentionsBlockFood('ho\u0001\uE000\u20DD\uD800\u3164ney')).toBe(true);
    expect(screenIngredient('pea\u0000\u20DDnut', AGE).map((f) => f.ruleId)).toContain('allergen-peanut');
  });

  it('must not fire on other foods, accents, other scripts or emoji', () => {
    expect(screenIngredient('ho\u0001neydew melon', AGE).map((f) => f.ruleId)).not.toContain('honey');
    expect(screenIngredient('ho\u20DDneydew melon', AGE).map((f) => f.ruleId)).not.toContain('honey');
    expect(screenIngredient('eggplant', AGE).map((f) => f.ruleId)).not.toContain('allergen-egg');
    expect(screenIngredient('egg\u20DDplant', AGE).map((f) => f.ruleId)).toContain('allergen-egg'); // spaced reading, stricter by design
    expect(textMentionsBlockFood('Mash the banana \u0001 and \uE000 \u20DD enjoy')).toBe(false);
    expect(textMentionsBlockFood('\u{1F34C} \u{1F600} \u{1F1FA}\u{1F1F8}')).toBe(false);
  });

  it('accents (precomposed and decomposed) and non-Latin scripts keep matching as before', () => {
    expect(normalize('Cr\u00E8me Br\u00FBl\u00E9e')).toBe('creme brulee');
    expect(normalize('Cre\u0300me')).toBe('creme');
    expect(normalize('jalapen\u0303o')).toBe('jalapeno');
    expect(normalize('\u0928\u092E\u0938\u094D\u0924\u0947')).toBe('');
    expect(normalize('\u4E2D\u6587 honey')).toBe('honey');
    expect(textMentionsBlockFood('Une cr\u00E8me d\u00E9licieuse.')).toBe(false);
    expect(screenIngredient('hone\u0300y', AGE).map((f) => f.ruleId)).toContain('honey');
  });

  it('screening many strings with hidden characters stays fast', () => {
    const start = performance.now();
    for (let i = 0; i < 2000; i++) {
      screenIngredient(`${i} ho\u0001ney \u20DD pea\uE000nut gra\uD800pes`, AGE);
    }
    expect(performance.now() - start).toBeLessThan(5000);
  });
});
