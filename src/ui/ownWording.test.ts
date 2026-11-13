// Task 19.4: the app's own wording never names a ghost, a door or a pumpkin
// (Requirement 21.10). The internal names GhostCard, MysteryDoor and the
// 'ghost' and 'door' statuses stay, so this reads string literals and JSX text
// in the app's own source (text with a space in it), not identifiers or comments. Published recipe text
// (src/data) and the safety rules (src/domain/safety) are not scanned.

import { describe, expect, it } from 'vitest';

const files = import.meta.glob(
  ['./**/*.{ts,tsx}', '../domain/**/*.ts', '../state/**/*.ts', '!./**/*.test.*', '!../domain/safety/**', '!../domain/**/*.test.*'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const WORDS = /ghost|door|pumpkin/i;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\w])\/\/.*$/gm, '$1');
}

/** String literals (with `${...}` removed) and JSX text that mention the words. */
function wordingHits(src: string): string[] {
  const code = stripComments(src);
  const hits: string[] = [];
  for (const m of code.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)) {
    const text = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, '');
    // Ids, import paths, class names and statuses ('ghost', 'door') have no
    // spaces; a sentence or label does.
    if (!/\s/.test(text.trim()) || text.startsWith('var(')) continue;
    if (WORDS.test(text)) hits.push(text);
  }
  for (const m of code.matchAll(/>([^<>{}\n]+)</g)) {
    if (WORDS.test(m[1])) hits.push(m[1]);
  }
  return hits;
}

describe('the app\'s own wording', () => {
  it('scans the app source', () => {
    expect(Object.keys(files).length).toBeGreaterThan(30);
  });

  it('has no ghost, door or pumpkin in any string or JSX text', () => {
    const found = Object.entries(files).flatMap(([file, src]) =>
      wordingHits(src).map((hit) => `${file}: ${hit}`),
    );
    expect(found).toEqual([]);
  });

  it('would catch a user-facing mention', () => {
    expect(wordingHits(`const a = 'Open a mystery door';`)).toHaveLength(1);
    expect(wordingHits(`<p>Pumpkin badge</p>`)).toHaveLength(1);
    expect(wordingHits(`// a ghost\nconst s = 'ghost'; const t = \`\${styles.ghost}\`;`)).toHaveLength(0);
  });
});
