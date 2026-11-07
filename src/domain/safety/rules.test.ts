import { describe, expect, it } from 'vitest';
import { screenIngredient } from './screen';
import { RULES, RULESET_VERSION, SOURCES, type SourceId } from './rules';
import { tokenize } from './normalize';

// Strictest age so every age-limited rule applies when we test term firing.
const STRICT_AGE = 0;

describe('rules metadata', () => {
  it('exports a numeric RULESET_VERSION starting at 1', () => {
    expect(RULESET_VERSION).toBe(1);
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
      const firedOnSomeTerm = rule.terms.some((term) =>
        screenIngredient(term, STRICT_AGE).some((f) => f.ruleId === rule.id),
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

  it('gives every SOURCES entry a title and URL', () => {
    for (const [id, source] of Object.entries(SOURCES)) {
      expect(source.title, `${id} missing title`).toBeTruthy();
      expect(source.url, `${id} missing url`).toBeTruthy();
    }
  });

  it('points no active rule at the superseded CDC-food-safety placeholder', () => {
    const offenders = RULES.filter((r) => r.sources.includes('CDC-food-safety'));
    expect(offenders.map((r) => r.id)).toEqual([]);
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
// lacks a URL. Switched on in task 17.0; kept skipped during development.
describe.skip('release gate (task 17.0): every cited source has a URL', () => {
  it('every source cited by a rule resolves to a URL', () => {
    for (const rule of RULES) {
      for (const sourceId of rule.sources as SourceId[]) {
        expect(SOURCES[sourceId]?.url).toMatch(/^https?:\/\//);
      }
    }
  });
});
