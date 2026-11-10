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
