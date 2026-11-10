import { describe, expect, it } from 'vitest';
import { buildPrompt, leaveOutFor, PROMPT_NOTICE } from './prompt';
import { STAGE_TEXTURE_HINTS } from './safety/rules';
import { stageFor } from './age';
import { defaultState } from './storage';
import type { AppState } from './types';

function promptFor(ageMonths: number, state: AppState, have = ['chicken', 'rice', 'peas']): string {
  return buildPrompt({
    ageMonths,
    have,
    stage: stageFor(ageMonths),
    leaveOut: leaveOutFor(ageMonths, state.foods),
  });
}

const state = defaultState(new Date(2026, 0, 15));

describe('buildPrompt content', () => {
  it('has the age, the foods, the texture, the leave-out list and the reply format', () => {
    const text = promptFor(10, state);
    expect(text).toContain('Suggest one quick and easy recipe for my 10-month-old baby.');
    expect(text).toContain(
      "Use only foods from this list (you don't need to use all of them): chicken, rice, peas.",
    );
    expect(text).toContain(`Texture: ${STAGE_TEXTURE_HINTS['9-12'].hint}.`);
    expect(text).toContain("Don't mention these foods anywhere in your reply.");
    expect(text).toContain('If you can, include an iron-rich food.');
    expect(text).toContain(
      [
        'Reply in exactly this format and nothing else:',
        'Title: <name>',
        'Total time: <number> minutes',
        'Serves: <number>',
        'Ingredients:',
        '- <amount> <unit> <ingredient>',
        'Steps:',
        '1. <step>',
      ].join('\n'),
    );
  });

  it('uses the exact texture hint for every stage', () => {
    const cases: Array<[number, keyof typeof STAGE_TEXTURE_HINTS]> = [
      [7, '6-8'],
      [10, '9-12'],
      [13, '12-23'],
      [25, '24-36'],
    ];
    for (const [months, stage] of cases) {
      expect(promptFor(months, state)).toContain(`Texture: ${STAGE_TEXTURE_HINTS[stage].hint}.`);
    }
  });

  it('keeps the helper notice wording', () => {
    expect(PROMPT_NOTICE).toBe(
      'AI recipes can be wrong. FirstMenu checks them against its fixed safety list, which can miss things. Check with your pediatrician.',
    );
  });
});

describe('leave-out list', () => {
  it('at 10 months includes honey, juice, sugar and salt', () => {
    const list = leaveOutFor(10, {});
    expect(list).toEqual(expect.arrayContaining(['Honey', 'Fruit juice', 'Added sugar', 'Added salt']));
    expect(promptFor(10, state)).toMatch(/Leave out: .*Honey.*\. Don't mention/);
  });

  it('at 13 months drops honey and juice but keeps sugar and salt', () => {
    const list = leaveOutFor(13, {});
    expect(list).not.toContain('Honey');
    expect(list).not.toContain('Fruit juice');
    expect(list).toEqual(expect.arrayContaining(['Added sugar', 'Added salt']));
  });

  it('at 25 months drops sugar and salt but keeps choking hazards', () => {
    const list = leaveOutFor(25, {});
    expect(list).not.toContain('Added sugar');
    expect(list).not.toContain('Added salt');
    expect(list).not.toContain('Honey');
    expect(list).toEqual(expect.arrayContaining(['Choking hazard']));
  });

  it('adds foods with a recorded reaction, not tried foods', () => {
    const foods = {
      egg: { status: 'reaction' as const, date: '2026-01-10' },
      pear: { status: 'tried' as const, date: '2026-01-10' },
    };
    const list = leaveOutFor(13, foods);
    expect(list).toContain('egg');
    expect(list).not.toContain('pear');
    const text = buildPrompt({
      ageMonths: 13,
      have: ['rice'],
      stage: '12-23',
      leaveOut: list,
    });
    expect(text).toMatch(/Leave out: .*egg/);
  });

  it('has no duplicates', () => {
    const list = leaveOutFor(10, { honey: { status: 'reaction', date: '2026-01-10' } });
    expect(new Set(list).size).toBe(list.length);
  });
});

describe('toddler wording', () => {
  it('says baby under 12 months', () => {
    expect(promptFor(11, state)).toContain('11-month-old baby.');
    expect(promptFor(11, state)).not.toContain('toddler');
  });

  it('says toddler at 12 months and over', () => {
    expect(promptFor(12, state)).toContain('12-month-old toddler.');
    expect(promptFor(25, state)).toContain('25-month-old toddler.');
    expect(promptFor(12, state)).not.toContain('baby');
  });
});

describe('privacy', () => {
  it('never contains the name or birth date', () => {
    const withChild: AppState = {
      ...state,
      child: { name: 'Zuzu', birthDate: '2025-03-04' },
    };
    const text = promptFor(10, withChild);
    expect(text).not.toContain('Zuzu');
    expect(text).not.toContain('2025-03-04');
    expect(text).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
  });

  it('has no suggestion state (made log, dismissals, on-hand days)', () => {
    const withSuggestions: AppState = {
      ...state,
      madeLog: [{ recipeId: 'secret-recipe-id', date: '2026-01-14' }],
      dismissed: { 'new-food:kiwi': '2026-01-15T08:00:00.000Z' },
      onHandDays: { zucchini: ['2026-01-13'] },
      onHandUpdated: '2026-01-14',
    };
    const text = promptFor(10, withSuggestions);
    expect(text).not.toContain('secret-recipe-id');
    expect(text).not.toContain('new-food:kiwi');
    expect(text).not.toContain('zucchini');
    expect(text).not.toContain('2026-01-1');
    expect(text).toBe(promptFor(10, state));
  });
});
