#!/usr/bin/env node
// Build check (active spec Requirement 15.4, v1 Requirement 12.2): the built
// app must not load fonts, stylesheets, scripts or images from any other host.
//
// Scans dist/ for things that make the browser fetch a URL:
//   - HTML: <script src>, <link href>, <img src>, <iframe src>, <source src>
//   - CSS:  @import and url(...)
//   - JS:   import()/import from, fetch(), new URL(...), importScripts()
//           with an absolute http(s) or protocol-relative URL, and a `src`
//           property set to one (src:"https://..."), which is how React
//           renders a remote <img> (food pictures are local files).
// Plain http(s) strings that are only shown or linked to (for example source
// citations on the Sources page) are not fetches and are allowed.
//
// Usage: node scripts/check-external.mjs [distDir]   (default: dist)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const distDir = process.argv[2] ?? 'dist';
const ABS = String.raw`(?:https?:)?\/\/[^\s"'\`)]+`;

const PATTERNS = {
  html: [
    new RegExp(String.raw`<(?:script|img|iframe|source|audio|video)\b[^>]*\ssrc=["'](${ABS})`, 'gi'),
    new RegExp(String.raw`<link\b[^>]*\shref=["'](${ABS})`, 'gi'),
  ],
  css: [
    new RegExp(String.raw`@import\s+(?:url\()?\s*["']?(${ABS})`, 'gi'),
    new RegExp(String.raw`url\(\s*["']?(${ABS})`, 'gi'),
  ],
  js: [
    new RegExp(String.raw`\bimport\s*\(\s*["'\`](${ABS})`, 'g'),
    new RegExp(String.raw`\bfrom\s*["'](${ABS})`, 'g'),
    new RegExp(String.raw`\bfetch\s*\(\s*["'\`](${ABS})`, 'g'),
    new RegExp(String.raw`\bimportScripts\s*\(\s*["'\`](${ABS})`, 'g'),
    new RegExp(String.raw`\bsrc\s*:\s*["'\`](${ABS})`, 'g'),
    new RegExp(String.raw`\bnew\s+URL\s*\(\s*["'\`](${ABS})`, 'g'),
  ],
};

// XML namespaces inside inline SVG are identifiers, not fetches. React Router
// uses new URL(path, "http://localhost") only as a parsing base.
const ALLOWED = [/^https?:\/\/www\.w3\.org\//, /^http:\/\/localhost$/];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function kindOf(path) {
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.js') || path.endsWith('.mjs')) return 'js';
  return null;
}

const problems = [];
for (const file of walk(distDir)) {
  const kind = kindOf(file);
  if (!kind) continue;
  const text = readFileSync(file, 'utf8');
  for (const pattern of PATTERNS[kind]) {
    for (const match of text.matchAll(pattern)) {
      const url = match[1];
      if (ALLOWED.some((ok) => ok.test(url))) continue;
      problems.push(`${relative(distDir, file)}: ${url}`);
    }
  }
}

if (problems.length > 0) {
  console.error('External resources found in the build (not allowed):');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`check-external: no external fonts, styles or scripts in ${distDir}/`);
