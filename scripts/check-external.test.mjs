import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const dirs = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true });
});

function run(js) {
  const dist = mkdtempSync(join(tmpdir(), 'dist-'));
  dirs.push(dist);
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'assets', 'app.js'), js);
  return spawnSync(process.execPath, [join(process.cwd(), 'scripts', 'check-external.mjs'), dist], { encoding: 'utf8' });
}

describe('check-external src pattern', () => {
  it('fails on an absolute URL in a JavaScript src property', () => {
    const result = run('h.createElement("img",{src:"https://example.com/carrot.webp",alt:""})');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('https://example.com/carrot.webp');
  });

  it('passes on a local picture path', () => {
    expect(run('h.createElement("img",{src:"/FirstMenu/art/foods/carrot.webp",alt:""})').status).toBe(0);
  });
});
