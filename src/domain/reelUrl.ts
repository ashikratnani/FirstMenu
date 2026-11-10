// Reel URL check for the Instagram reel prompt (Requirement 19.2): https only,
// at most 500 characters. A host that is not Instagram only produces a warning.
// The app never fetches the URL.

export const MAX_REEL_URL_CHARS = 500;

export type ReelUrlCheck =
  | { ok: true; url: string; warning: boolean }
  | { ok: false; reason: 'empty' | 'not-https' | 'too-long' };

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'instagr.am']);

export function checkReelUrl(input: string): ReelUrlCheck {
  const url = input.trim();
  if (url === '') return { ok: false, reason: 'empty' };
  if (url.length > MAX_REEL_URL_CHARS) return { ok: false, reason: 'too-long' };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'not-https' };
  }
  if (parsed.protocol !== 'https:' || /\s/.test(url)) return { ok: false, reason: 'not-https' };
  return { ok: true, url, warning: !INSTAGRAM_HOSTS.has(parsed.hostname.toLowerCase()) };
}
