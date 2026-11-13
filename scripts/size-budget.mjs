// Recipe data budget (active spec Requirement 14.9, design "Bundle size and
// speed with 500 recipes", approved by the maintainer on #68). The gzipped
// `recipe-data` chunk warns at 160 KB and fails the build check at 200 KB. The
// expected size for 500 recipes is about 135 KB, so neither trips unless
// something other than recipes (for example pasted source text) gets in.
// Kept apart from size-report.mjs so a test can import it without a build.

export const DATA_WARN_BYTES = 160 * 1024;
export const DATA_FAIL_BYTES = 200 * 1024;

/**
 * @param {number} bytes gzipped size of the recipe-data chunk
 * @returns {{ level: 'ok' | 'warn' | 'fail', message: string }}
 */
export function recipeDataStatus(bytes) {
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  if (bytes > DATA_FAIL_BYTES) {
    return {
      level: 'fail',
      message: `Recipe data is ${kb(bytes)} gzipped, over the ${kb(DATA_FAIL_BYTES)} limit by ${kb(bytes - DATA_FAIL_BYTES)}.`,
    };
  }
  if (bytes > DATA_WARN_BYTES) {
    return {
      level: 'warn',
      message: `Recipe data is ${kb(bytes)} gzipped, over the ${kb(DATA_WARN_BYTES)} warning level (limit ${kb(DATA_FAIL_BYTES)}).`,
    };
  }
  return {
    level: 'ok',
    message: `Recipe data is ${kb(bytes)} gzipped, within the ${kb(DATA_WARN_BYTES)} warning level.`,
  };
}

// Picture files in dist/art (design "Food art", "Credits, license and checks").
// They are not JavaScript or CSS, so the page budget and the recipe data
// budget do not change. Each file may be at most 8 KB; the total warns past
// 900 KB.
export const ART_FILE_LIMIT_BYTES = 8 * 1024;
export const ART_WARN_BYTES = 900 * 1024;

/**
 * @param {{ path: string, bytes: number }[]} files every file under dist/art
 * @returns {{ level: 'ok' | 'warn' | 'fail', count: number, total: number,
 *   largest: { path: string, bytes: number } | null,
 *   oversized: { path: string, bytes: number }[], message: string }}
 */
export function artStatus(files) {
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  const total = files.reduce((n, f) => n + f.bytes, 0);
  const largest = files.reduce((best, f) => (best === null || f.bytes > best.bytes ? f : best), null);
  const oversized = files.filter((f) => f.bytes > ART_FILE_LIMIT_BYTES);
  const summary = `${files.length} art files, ${kb(total)} in total, largest ${largest ? `${largest.path} (${kb(largest.bytes)})` : 'none'}`;
  if (oversized.length > 0) {
    return {
      level: 'fail',
      count: files.length,
      total,
      largest,
      oversized,
      message: `${summary}. Over the ${kb(ART_FILE_LIMIT_BYTES)} file limit: ${oversized.map((f) => `${f.path} (${f.bytes} B)`).join(', ')}.`,
    };
  }
  if (total > ART_WARN_BYTES) {
    return {
      level: 'warn',
      count: files.length,
      total,
      largest,
      oversized,
      message: `${summary}. Over the ${kb(ART_WARN_BYTES)} total warning level.`,
    };
  }
  return { level: 'ok', count: files.length, total, largest, oversized, message: `${summary}, within limits.` };
}
