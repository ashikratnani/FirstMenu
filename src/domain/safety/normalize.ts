// Pure-TS matching helpers for the safety screen (design.md, "Matching").
// No React. Rule terms are written lowercase and singular; ingredient names are
// free text. We normalize both sides and match terms as whole-token phrases
// with plural-aware token equality, which avoids the common false positives
// ("honeydew melon" must not match "honey", "eggplant" must not match "egg").

// Invisible code points that must not hide a food word from the screen:
// every default-ignorable code point (Hangul fillers U+115F/U+1160/U+3164/
// U+FFA0, variation selectors, soft hyphen, zero-width and bidi controls, tag
// characters, ...), every format character, and the Braille blank U+2800.
const INVISIBLE = /[\p{Default_Ignorable_Code_Point}\p{Cf}\u2800]/gu;
const HAS_INVISIBLE = /[\p{Default_Ignorable_Code_Point}\p{Cf}\u2800]/u;

/** Does `text` contain any invisible code point that normalize() strips? */
export function hasInvisible(text: string): boolean {
  return HAS_INVISIBLE.test(text);
}

/** Replace every invisible code point with `replacement`. */
function dropInvisible(text: string, replacement: string): string {
  return text.replace(INVISIBLE, replacement);
}

/**
 * Lowercase, strip invisible characters (so "ho\u3164ney" reads "honey"), strip
 * accents (NFKD + drop combining marks), replace every non [a-z0-9] character
 * with a space, then collapse and trim spaces.
 *
 * e.g. "Cow's Milk" -> "cow s milk".
 */
export function normalize(name: string): string {
  const cached = normalizeCache.get(name);
  if (cached !== undefined) return cached;
  const result = dropInvisible(dropInvisible(name, '').normalize('NFKD'), '')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  // Speed only (active spec Requirement 14.9): the screen normalizes the same
  // ingredient name once per rule term, so strings repeat many times. The
  // function is pure, so the cache cannot change a result. It is cleared when
  // it grows past the limit so it cannot grow without bound.
  if (normalizeCache.size >= NORMALIZE_CACHE_LIMIT) normalizeCache.clear();
  normalizeCache.set(name, result);
  return result;
}

const NORMALIZE_CACHE_LIMIT = 20000;
const normalizeCache = new Map<string, string>();

/**
 * Token lists for the safety screen. An invisible character can hide a word
 * ("ho\u3164ney") or stand in for a space ("honey\u200Bcake"), and the screen
 * cannot tell which, so it checks both readings: invisibles removed (the first
 * list) and invisibles read as spaces (a second list, only when they differ).
 * Checking both keeps the screen strictly stricter than before.
 */
export function screenTokenVariants(text: string): string[][] {
  const stripped = tokenize(text);
  if (!hasInvisible(text)) return [stripped];
  const spaced = tokenize(dropInvisible(text, ' '));
  return spaced.join(' ') === stripped.join(' ') ? [stripped] : [stripped, spaced];
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
  const termTokens = cachedTokens(term);
  return cachedVariants(name).some((tokens) => termMatchesTokens(tokens, termTokens));
}

// Speed only (active spec Requirement 14.9): the screen calls matchesTerm for
// every rule term against the same ingredient name, so the same strings are
// tokenized again and again. These arrays are read-only and never leave this
// module (tokenize() above still returns a fresh array to its callers). The
// cache is cleared when it passes the limit so it cannot grow without bound.
const TOKEN_CACHE_LIMIT = 20000;
const tokenCache = new Map<string, string[][]>();

function cachedVariants(text: string): string[][] {
  const cached = tokenCache.get(text);
  if (cached !== undefined) return cached;
  const variants = screenTokenVariants(text);
  if (tokenCache.size >= TOKEN_CACHE_LIMIT) tokenCache.clear();
  tokenCache.set(text, variants);
  return variants;
}

function cachedTokens(text: string): string[] {
  return cachedVariants(text)[0];
}
