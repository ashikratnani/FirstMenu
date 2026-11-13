import { describe, expect, it } from 'vitest';
import {
  ART_FILE_LIMIT_BYTES,
  ART_WARN_BYTES,
  DATA_FAIL_BYTES,
  DATA_WARN_BYTES,
  artStatus,
  recipeDataStatus,
} from './size-budget.mjs';

describe('recipe data budget', () => {
  it('uses 160 KB for the warning and 200 KB for the failure', () => {
    expect(DATA_WARN_BYTES).toBe(160 * 1024);
    expect(DATA_FAIL_BYTES).toBe(200 * 1024);
  });

  it('is ok at and below the warning level', () => {
    expect(recipeDataStatus(0).level).toBe('ok');
    expect(recipeDataStatus(135 * 1024).level).toBe('ok');
    expect(recipeDataStatus(DATA_WARN_BYTES).level).toBe('ok');
  });

  it('warns above 160 KB and up to 200 KB', () => {
    expect(recipeDataStatus(DATA_WARN_BYTES + 1).level).toBe('warn');
    expect(recipeDataStatus(DATA_FAIL_BYTES).level).toBe('warn');
  });

  it('fails above 200 KB and says by how much', () => {
    const status = recipeDataStatus(DATA_FAIL_BYTES + 2048);
    expect(status.level).toBe('fail');
    expect(status.message).toContain('2.0 KB');
  });
});

describe('art budget', () => {
  const file = (bytes, path = 'foods/carrot.webp') => ({ path, bytes });

  it('uses 8 KB per file and 900 KB for the total warning', () => {
    expect(ART_FILE_LIMIT_BYTES).toBe(8192);
    expect(ART_WARN_BYTES).toBe(900 * 1024);
  });

  it('accepts a file of 8,192 bytes and fails one of 8,193', () => {
    expect(artStatus([file(8192)]).level).toBe('ok');
    const status = artStatus([file(8193, 'foods/big.webp')]);
    expect(status.level).toBe('fail');
    expect(status.message).toContain('foods/big.webp');
  });

  it('accepts a total of 900 KB and warns one byte over', () => {
    const files = (total) => Array.from({ length: total / 4096 }, (_, i) => file(4096, `foods/f${i}.webp`));
    expect(artStatus(files(900 * 1024)).level).toBe('ok');
    expect(artStatus([...files(900 * 1024 - 4096), file(4097)]).level).toBe('warn');
  });

  it('reports the count, the total and the largest file', () => {
    const status = artStatus([file(100), file(300, 'state/snowflake.webp'), file(200)]);
    expect(status.count).toBe(3);
    expect(status.total).toBe(600);
    expect(status.largest?.path).toBe('state/snowflake.webp');
  });

  it('reports an empty folder as ok', () => {
    expect(artStatus([]).level).toBe('ok');
  });
});
