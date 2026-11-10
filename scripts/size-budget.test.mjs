import { describe, expect, it } from 'vitest';
import { DATA_FAIL_BYTES, DATA_WARN_BYTES, recipeDataStatus } from './size-budget.mjs';

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
