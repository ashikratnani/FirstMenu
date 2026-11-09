#!/usr/bin/env node
// Bundle size report (active spec Requirement 15.6, decision in issue #37).
//
// Pages are code-split, so what matters is the FIRST LOAD of each page: the
// app entry plus the page's own chunk and everything it imports, JS and CSS,
// gzipped. Built-in recipe data (src/data/*) is reported but not budgeted.
// The budget: the heaviest page's first load may be at most 250 KB larger
// than the v1 build, which loaded everything at once.
//
// Reads dist/.vite/manifest.json (vite.config.ts sets build.manifest).
// Usage: node scripts/size-report.mjs [distDir]   (default: dist)

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// v1 build on main (commit 17bc237), gzip level 9: 120,625 B JS + 5,501 B CSS.
const V1_BASELINE_BYTES = 126_126;
const BUDGET_BYTES = 250 * 1024;

const dist = process.argv[2] ?? 'dist';
const manifest = JSON.parse(
  readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'),
);

const gzCache = new Map();
function gz(file) {
  if (!gzCache.has(file)) {
    gzCache.set(file, gzipSync(readFileSync(join(dist, file)), { level: 9 }).length);
  }
  return gzCache.get(file);
}

const isData = (key) => key.startsWith('src/data/');

/** Files (JS + CSS) a chunk needs, following static imports only. */
function closure(key, files = new Set(), data = new Set(), seen = new Set()) {
  if (seen.has(key)) return { files, data };
  seen.add(key);
  const chunk = manifest[key];
  (isData(key) ? data : files).add(chunk.file);
  for (const css of chunk.css ?? []) files.add(css);
  for (const dep of chunk.imports ?? []) closure(dep, files, data, seen);
  return { files, data };
}

const sum = (set) => [...set].reduce((n, f) => n + gz(f), 0);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const entryKey = 'index.html';
const entry = closure(entryKey);
const pages = (manifest[entryKey].dynamicImports ?? []).map((key) => {
  const page = closure(key, new Set(entry.files), new Set(entry.data));
  return { name: key.replace(/^src\/ui\/pages\//, '').replace(/\.tsx?$/, ''), bytes: sum(page.files), data: sum(page.data) };
});
pages.sort((a, b) => b.bytes - a.bytes);

const allJsCss = readdirSync(join(dist, 'assets'))
  .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
  .reduce((n, f) => n + gz(join('assets', f)), 0);
const fonts = readdirSync(join(dist, 'assets'))
  .filter((f) => f.endsWith('.woff2') && !f.includes('latin-ext'))
  .reduce((n, f) => n + readFileSync(join(dist, 'assets', f)).length, 0);

console.log(`App shell (entry, gzip):        ${kb(sum(entry.files))}`);
console.log('First load per page (JS + CSS, gzip):');
for (const p of pages) {
  console.log(`  ${p.name.padEnd(14)} ${kb(p.bytes).padStart(9)}${p.data ? `  + ${kb(p.data)} recipe data` : ''}`);
}
console.log(`All JS + CSS in the build:      ${kb(allJsCss)}`);
console.log(`Fonts (latin woff2):            ${kb(fonts)} (not budgeted)`);

const heaviest = pages[0];
const growth = heaviest.bytes - V1_BASELINE_BYTES;
console.log(`Heaviest page vs v1:            ${heaviest.name} ${kb(heaviest.bytes)} vs ${kb(V1_BASELINE_BYTES)} (${growth >= 0 ? '+' : ''}${kb(growth)})`);
console.log(`Budget:                         +${kb(BUDGET_BYTES)}`);
if (growth > BUDGET_BYTES) {
  console.error(`Over budget by ${kb(growth - BUDGET_BYTES)}.`);
  process.exit(1);
}
console.log('Within budget.');
