import { describe, expect, it } from 'vitest';
import { MAX_REEL_URL_CHARS, checkReelUrl } from './reelUrl';

const base = 'https://www.instagram.com/reel/abc/';

describe('checkReelUrl (Req 19.2)', () => {
  it('accepts Instagram hosts without a warning', () => {
    for (const host of ['instagram.com', 'www.instagram.com', 'instagr.am']) {
      expect(checkReelUrl(`https://${host}/reel/abc/`)).toEqual({
        ok: true,
        url: `https://${host}/reel/abc/`,
        warning: false,
      });
    }
  });

  it('warns but accepts a non-Instagram host', () => {
    expect(checkReelUrl('https://example.com/reel')).toMatchObject({ ok: true, warning: true });
    expect(checkReelUrl('https://instagram.com.evil.test/x')).toMatchObject({ warning: true });
  });

  it('rejects empty, http and other schemes', () => {
    expect(checkReelUrl('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(checkReelUrl('http://www.instagram.com/reel/abc/')).toEqual({ ok: false, reason: 'not-https' });
    expect(checkReelUrl('javascript:alert(1)')).toEqual({ ok: false, reason: 'not-https' });
    expect(checkReelUrl('not a url')).toEqual({ ok: false, reason: 'not-https' });
  });

  it('allows exactly 500 characters and rejects 501', () => {
    const at = base + 'a'.repeat(MAX_REEL_URL_CHARS - base.length);
    expect(at).toHaveLength(500);
    expect(checkReelUrl(at).ok).toBe(true);
    expect(checkReelUrl(at + 'a')).toEqual({ ok: false, reason: 'too-long' });
  });
});
