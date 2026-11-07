// Pure-TS matching helpers for the safety screen (design.md, "Matching").
// No React. Rule terms are written lowercase and singular; ingredient names are
// free text. We normalize both sides and match terms as whole-token phrases
// with plural-aware token equality, which avoids the common false positives
// ("honeydew melon" must not match "honey", "eggplant" must not match "egg").

/**
 * Lowercase, strip accents (NFKD + drop combining marks), replace every
 * non [a-z0-9] character with a space, then collapse and trim spaces.
 *
 * e.g. "Cow's Milk" -> "cow s milk".
 */
export function normalize(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Normalize then split into non-empty tokens. */
export function tokenize(name: string): string[] {
  const n = normalize(name);
  return n.length === 0 ? [] : n.split(' ');
}

/**
 * Plural-aware token match: an ingredient token matches a singular term token
 * `t` when it equals `t`, `t + "s"`, `t + "es"`, or (when `t` ends in `y`) `t`
 * with the trailing `y` replaced by `ies`.
 */
export function tokenMatches(ingredientToken: string, termToken: string): boolean {
  if (ingredientToken === termToken) return true;
  if (ingredientToken === termToken + 's') return true;
  if (ingredientToken === termToken + 'es') return true;
  if (termToken.endsWith('y') && ingredientToken === termToken.slice(0, -1) + 'ies') {
    return true;
  }
  return false;
}

/**
 * True when the term's tokens appear as a consecutive run in the ingredient's
 * tokens, using plural-aware per-token matching.
 */
export function termMatchesTokens(
  ingredientTokens: string[],
  termTokens: string[],
): boolean {
  if (termTokens.length === 0) return false;
  if (termTokens.length > ingredientTokens.length) return false;

  for (let start = 0; start + termTokens.length <= ingredientTokens.length; start++) {
    let allMatch = true;
    for (let i = 0; i < termTokens.length; i++) {
      if (!tokenMatches(ingredientTokens[start + i], termTokens[i])) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;
  }
  return false;
}

/** Convenience: does `term` match anywhere in the ingredient `name`? */
export function matchesTerm(name: string, term: string): boolean {
  return termMatchesTokens(tokenize(name), tokenize(term));
}
