// Edits to the "What do you have?" text for the Make screen (Req 16.9: removing
// a filter chip also removes its phrase from the box). React-free. Words are
// compared the way the search compares them: normalized and plural-aware.

import { SEARCH_PHRASES, type SearchFilter } from '../../data/searchPhrases';
import { normalize, tokenMatches, tokenize } from '../../domain/safety/normalize';

interface Word {
  start: number;
  end: number;
  token: string;
}

function wordsOf(text: string): Word[] {
  const words: Word[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const start = match.index ?? 0;
    words.push({ start, end: start + match[0].length, token: normalize(match[0]) });
  }
  return words;
}

/** Tidy what is left after cutting words out: spacing and dangling separators. */
function tidy(text: string): string {
  let out = text.replace(/\s+/g, ' ');
  out = out.replace(/\s+([,;])/g, '$1').replace(/([,;+&])(\s*[,;+&])+/g, '$1');
  const lead = /^\s*(?:(?:and|with|for)\b|[,;+&])\s*/i;
  const trail = /\s*(?:\b(?:and|with|for)|[,;+&])\s*$/i;
  for (let previous = ''; previous !== out; ) {
    previous = out;
    out = out.replace(lead, '').replace(trail, '');
  }
  return out.trim();
}

/** Remove every run of words matching one of the token lists (longest first). */
function removeRuns(text: string, runs: string[][]): string {
  const words = wordsOf(text);
  const ordered = [...runs].filter((r) => r.length > 0).sort((a, b) => b.length - a.length);
  const cuts: Array<[number, number]> = [];
  const used = new Set<number>();
  for (const run of ordered) {
    for (let i = 0; i + run.length <= words.length; i++) {
      const free = run.every((_, k) => !used.has(i + k));
      const same = run.every(
        (token, k) => tokenMatches(words[i + k].token, token) || words[i + k].token === token,
      );
      if (!free || !same) continue;
      run.forEach((_, k) => used.add(i + k));
      cuts.push([words[i].start, words[i + run.length - 1].end]);
      i += run.length - 1;
    }
  }
  let out = text;
  for (const [start, end] of cuts.sort((a, b) => b[0] - a[0])) {
    out = out.slice(0, start) + ' ' + out.slice(end);
  }
  return tidy(out);
}

/** Remove the dish-kind phrases that produce `filter` from the text. */
export function removeFilterPhrases(text: string, filter: SearchFilter): string {
  const runs = SEARCH_PHRASES.filter((g) => g.filter === filter).flatMap((g) =>
    g.phrases.map(tokenize),
  );
  return removeRuns(text, runs);
}

/** Remove one typed word (such as a typo the user just resolved). */
export function removeTypedWord(text: string, word: string): string {
  return removeRuns(text, [tokenize(word)]);
}
