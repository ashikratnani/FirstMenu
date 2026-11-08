#!/usr/bin/env node
// Bundle size report (active spec Requirement 15.6). Prints the gzipped size
// of the built JavaScript and CSS, plus font files, and checks the budget:
// JS + CSS (excluding the built-in recipe data chunk, once task 14.1 splits it
// out) may grow by at most 150 KB gzipped over the v1 baseline.
//
// Usage: node scripts/size-report.mjs [distDir]   (default: dist)

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// v1 build on main (commit 17bc237), gzip level 9: 120,625 B JS + 5,501 B CSS.
const V1_BASELINE_BYTES = 126_126;
const BUDGET_BYTES = 150 * 1024;
// Task 14.1 names the recipe data chunk; it is reported but not budgeted.
const RECIPE_CHUNK = /^recipes-.*\.js$/;

const assets = join(process.argv[2] ?? 'dist', 'assets');
const totals = { js: 0, css: 0, recipes: 0, fonts: 0 };

for (const name of readdirSync(assets)) {
  const bytes = readFileSync(join(assets, name));
  if (/\.(woff|ttf|otf)$/.test(name)) continue; // legacy fallbacks, not fetched by current browsers
  if (name.endsWith('.woff2')) {
    // Latin files are what an English page loads; latin-ext only loads when
    // a character needs it.
    if (!name.includes('latin-ext')) totals.fonts += bytes.length;
    continue;
  }
  const gz = gzipSync(bytes, { level: 9 }).length;
  if (RECIPE_CHUNK.test(name)) totals.recipes += gz;
  else if (name.endsWith('.js')) totals.js += gz;
  else if (name.endsWith('.css')) totals.css += gz;
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const budgeted = totals.js + totals.css;
const growth = budgeted - V1_BASELINE_BYTES;

console.log(`JS (gzip):            ${kb(totals.js)}`);
console.log(`CSS (gzip):           ${kb(totals.css)}`);
console.log(`Recipe data (gzip):   ${kb(totals.recipes)} (not budgeted)`);
console.log(`Fonts (woff2, latin): ${kb(totals.fonts)} (not budgeted)`);
console.log(`JS + CSS vs v1:       ${kb(budgeted)} vs ${kb(V1_BASELINE_BYTES)} (${growth >= 0 ? '+' : ''}${kb(growth)})`);
console.log(`Budget:               +${kb(BUDGET_BYTES)}`);

if (growth > BUDGET_BYTES) {
  console.error(`Over budget by ${kb(growth - BUDGET_BYTES)}.`);
  process.exit(1);
}
console.log('Within budget.');
