import { describe, expect, it } from 'vitest';
import { screenIngredient } from './screen';
import {
  NEW_FOOD_SPACING_SOURCES,
  RULES,
  RULESET_VERSION,
  SOURCES,
  STAGE_TEXTURE_HINTS,
  type SourceId,
} from './rules';
import { tokenize } from './normalize';

// Strictest age so every age-limited rule applies when we test term firing.
const STRICT_AGE = 0;

describe('rules metadata', () => {
  it('exports a numeric RULESET_VERSION bumped to 4 (invisible characters stripped before matching)', () => {
    expect(RULESET_VERSION).toBe(4);
  });

  it('has a non-empty rule list', () => {
    expect(RULES.length).toBeGreaterThan(0);
  });

  it('gives every rule a unique id', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('every rule fires on at least one of its terms', () => {
  for (const rule of RULES) {
    it(`${rule.id} fires on a built-from-term ingredient`, () => {
      // A rule with fromMonths only applies from that age (juice-limit).
      const age = rule.fromMonths ?? STRICT_AGE;
      const firedOnSomeTerm = rule.terms.some((term) =>
        screenIngredient(term, age).some((f) => f.ruleId === rule.id),
      );
      expect(firedOnSomeTerm, `${rule.id} did not fire on any of its terms`).toBe(true);
    });
  }
});

describe('sources', () => {
  it('gives every rule at least one source', () => {
    for (const rule of RULES) {
      expect(rule.sources.length, `${rule.id} has no source`).toBeGreaterThan(0);
    }
  });

  it('references only source ids that exist in SOURCES', () => {
    for (const rule of RULES) {
      for (const sourceId of rule.sources) {
        expect(SOURCES[sourceId], `${rule.id} cites unknown source ${sourceId}`).toBeDefined();
      }
    }
  });

  it('references only new-food-spacing source ids that exist in SOURCES', () => {
    for (const sourceId of NEW_FOOD_SPACING_SOURCES) {
      expect(
        SOURCES[sourceId],
        `new-food spacing cites unknown source ${sourceId}`,
      ).toBeDefined();
    }
  });

  it('gives every SOURCES entry a title and URL', () => {
    for (const [id, source] of Object.entries(SOURCES)) {
      expect(source.title, `${id} missing title`).toBeTruthy();
      expect(source.url, `${id} missing url`).toBeTruthy();
    }
  });
});

describe('terms are lowercase and singular', () => {
  // Singular words that legitimately end in "s" (not plurals the matcher would
  // generate). Keep this list tight; extend it only for real singular terms.
  const SINGULAR_ENDING_IN_S = new Set(['molasses', 'couscous', 'asparagus', 'hummus']);

  for (const rule of RULES) {
    const allTerms = [...rule.terms, ...(rule.except ?? [])];
    for (const term of allTerms) {
      it(`${rule.id}: "${term}" is lowercase and singular`, () => {
        expect(term).toBe(term.toLowerCase());
        for (const token of tokenize(term)) {
          if (SINGULAR_ENDING_IN_S.has(token)) continue;
          expect(token.endsWith('s'), `"${term}" token "${token}" looks plural`).toBe(false);
        }
      });
    }
  }
});

// Release gate (design "Testing Strategy"): a rule may not cite a source that
// lacks a URL. Switched on in task 17.0.
describe('release gate (task 17.0): every cited source has a URL', () => {
  it('every source cited by a rule resolves to a URL', () => {
    for (const rule of RULES) {
      for (const sourceId of rule.sources as SourceId[]) {
        expect(SOURCES[sourceId]?.url).toMatch(/^https?:\/\//);
      }
    }
  });

  it('every new-food-spacing cited source resolves to a URL', () => {
    for (const sourceId of NEW_FOOD_SPACING_SOURCES) {
      expect(SOURCES[sourceId]?.url).toMatch(/^https?:\/\//);
    }
  });
});

describe('juice-limit reminder (active spec Requirement 13.7)', () => {
  const fires = (name: string, months: number) =>
    screenIngredient(name, months).some((f) => f.ruleId === 'juice-limit');

  it('is a reminder from 12 up to 36 months citing AAP-juice', () => {
    const rule = RULES.find((r) => r.id === 'juice-limit');
    expect(rule?.kind).toBe('reminder');
    expect(rule?.fromMonths).toBe(12);
    expect(rule?.underMonths).toBe(36);
    expect(rule?.sources).toEqual(['AAP-juice']);
    expect(rule?.message).toBe('100% juice only, no more than 4 ounces a day.');
  });

  it('does not fire at 11 months and fires at 12 and 35 months', () => {
    expect(fires('apple juice', 11)).toBe(false);
    expect(fires('apple juice', 12)).toBe(true);
    expect(fires('apple juice', 35)).toBe(true);
  });

  it('does not fire at 36 months', () => {
    expect(fires('apple juice', 36)).toBe(false);
  });

  it('honors the lemon and lime exceptions', () => {
    expect(fires('lemon juice', 18)).toBe(false);
    expect(fires('lime juice', 18)).toBe(false);
  });

  it('never blocks: it is a reminder, and the under-12 juice block still fires at 11 months', () => {
    const at18 = screenIngredient('apple juice', 18);
    expect(at18.some((f) => f.kind === 'block')).toBe(false);
    const at11 = screenIngredient('apple juice', 11);
    expect(at11.some((f) => f.ruleId === 'juice' && f.kind === 'block')).toBe(true);
  });

  it('leaves existing rules without fromMonths', () => {
    for (const rule of RULES) {
      if (rule.id !== 'juice-limit') expect(rule.fromMonths).toBeUndefined();
    }
  });
});

describe('stage texture hints (Req 13.5)', () => {
  const stages = ['6-8', '9-12', '12-23', '24-36'] as const;

  it('has a hint for each of the four stages', () => {
    expect(Object.keys(STAGE_TEXTURE_HINTS).sort()).toEqual([...stages].sort());
  });

  for (const stage of stages) {
    const entry = STAGE_TEXTURE_HINTS[stage];

    it(`${stage}: cites existing sources with URLs, a quote and an archive note`, () => {
      expect(entry.hint.trim().length).toBeGreaterThan(0);
      expect(entry.quote.trim().length).toBeGreaterThan(0);
      expect(entry.archiveNote).toMatch(/web\.archive\.org/);
      expect(entry.sources.length).toBeGreaterThan(0);
      for (const id of entry.sources) {
        expect(SOURCES[id]?.url, `${stage} cites ${id}`).toMatch(/^https:\/\//);
        expect(SOURCES[id]?.note, `${id} carries the archive note`).toMatch(/web\.archive\.org/);
      }
    });

    it(`${stage}: hint has no pronoun`, () => {
      expect(entry.hint).not.toMatch(/\b(he|she|his|her|him|hers|they|their)\b/i);
    });
  }

  it('toddler hints are supported by CDC-encourage, infant hints by CDC-solids', () => {
    expect(STAGE_TEXTURE_HINTS['6-8'].sources).toEqual(['CDC-solids']);
    expect(STAGE_TEXTURE_HINTS['9-12'].sources).toEqual(['CDC-solids']);
    expect(STAGE_TEXTURE_HINTS['12-23'].sources).toEqual(['CDC-encourage']);
    expect(STAGE_TEXTURE_HINTS['24-36'].sources).toEqual(['CDC-encourage']);
  });

  it('each hint is tied to its quote: key phrases are in the quote and every content word of the hint appears in it', () => {
    expect(STAGE_TEXTURE_HINTS['6-8'].quote).toContain('mashed, pureed, or strained foods that are very smooth');
    expect(STAGE_TEXTURE_HINTS['9-12'].quote).toContain('thicker and more lumpy foods');
    expect(STAGE_TEXTURE_HINTS['12-23'].quote).toContain('soft and mashed or bite-sized');
    expect(STAGE_TEXTURE_HINTS['24-36'].quote).toContain('soft and mashed or bite-sized');
    for (const stage of stages) {
      const { hint, quote } = STAGE_TEXTURE_HINTS[stage];
      const quoteWords = new Set(quote.toLowerCase().match(/[a-z]+(?:-[a-z]+)*/g));
      for (const word of hint.toLowerCase().match(/[a-z]+(?:-[a-z]+)*/g) ?? []) {
        expect(quoteWords.has(word), `${stage}: "${word}" is in the quote`).toBe(true);
      }
    }
  });
});
