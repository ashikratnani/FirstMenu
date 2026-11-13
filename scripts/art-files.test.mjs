import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOOD_PICTURES, GROUP_PICTURES } from '../src/data/foodPictures.ts';

// Picture files in public/art (design "Picture files"). Vitest runs from the repository root.
const ART = join(process.cwd(), 'public', 'art');
const artPath = (file) => join(ART, file);
const STATE_PICTURES = ['hourglass_not_done', 'snowflake'];

describe('picture files', () => {
  const named = new Set([
    ...Object.values(FOOD_PICTURES).flatMap((e) => (e.picture ? [e.picture] : [])),
    ...Object.values(GROUP_PICTURES),
  ]);

  it('has a file for every picture the map and the group pictures name', () => {
    const missing = [...named].filter((p) => !existsSync(artPath(`foods/${p}.webp`)));
    expect(missing).toEqual([]);
  });

  it('has the two state pictures', () => {
    for (const p of STATE_PICTURES) expect(existsSync(artPath(`state/${p}.webp`)), p).toBe(true);
  });

  it('keeps every file at most 8 KB and a 128 x 128 WebP', () => {
    const files = [
      ...[...named].map((p) => `foods/${p}.webp`),
      ...STATE_PICTURES.map((p) => `state/${p}.webp`),
    ];
    for (const f of files) {
      const path = artPath(f);
      expect(statSync(path).size, f).toBeLessThanOrEqual(8192);
      const buf = readFileSync(path);
      expect(buf.subarray(0, 4).toString('ascii'), f).toBe('RIFF');
      expect(buf.subarray(8, 12).toString('ascii'), f).toBe('WEBP');
      expect(webpSize(buf), f).toEqual([128, 128]);
    }
  });

  it('names the repository and the pinned commit on the first line of the license', () => {
    const text = readFileSync(artPath('LICENSE-fluentui-emoji.txt'), 'utf8');
    const [first, ...rest] = text.split('\n');
    expect(first).toContain('microsoft/fluentui-emoji');
    expect(first).toContain('1ffb34c752ecf5d402f04cfb4b392c77f57c54bc');
    expect(rest.join('\n')).toContain('Permission is hereby granted, free of charge');
    const docs = readFileSync(join(process.cwd(), 'docs', 'art', 'LICENSE-fluentui-emoji.txt'), 'utf8');
    expect(rest.join('\n').trim()).toBe(docs.trim());
  });
});

/** Width and height from a lossy (VP8), lossless (VP8L) or extended (VP8X) WebP header. */
function webpSize(buf) {
  const kind = buf.subarray(12, 16).toString('ascii');
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
}
