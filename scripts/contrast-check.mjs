#!/usr/bin/env node
// WCAG 2.1 AA contrast check for the FirstMenu Astryx theme (active spec
// Requirement 15.3). Reads the color tokens from src/ui/theme/firstmenu.css
// and checks each foreground/background pair the app relies on.
//
// Usage: node scripts/contrast-check.mjs

import { readFileSync } from 'node:fs';

const css = readFileSync('src/ui/theme/firstmenu.css', 'utf8');
const tokens = Object.fromEntries(
  [...css.matchAll(/(--color-[a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]),
);

// FirstMenu app tokens (--fm-*), used by the lavender band on the Sources page:
// 60% lavender over the cream page background (Sources.module.css .band).
const fm = Object.fromEntries(
  [...readFileSync('src/ui/theme.css', 'utf8').matchAll(/(--fm-color-[a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map(
    (m) => [m[1], m[2]],
  ),
);
const mix = (a, b, pct) =>
  '#' +
  [1, 3, 5]
    .map((i) =>
      Math.round(parseInt(a.slice(i, i + 2), 16) * pct + parseInt(b.slice(i, i + 2), 16) * (1 - pct))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
tokens['--band'] = mix(fm['--fm-color-lavender'], fm['--fm-color-bg'], 0.6);
tokens['--fm-color-heading'] = fm['--fm-color-heading'];
tokens['--fm-color-muted'] = fm['--fm-color-muted'];
// Nutrition tag chips (theme.css): each text color on its background.
const TAGS = ['vegetable', 'fruit', 'whole-grain', 'protein', 'dairy', 'iron-rich', 'healthy-fat'];
for (const [token, value] of Object.entries(fm)) {
  if (/^--fm-color-tag-/.test(token)) tokens[token] = value;
}

// [foreground, background, minimum ratio, what it is]
const PAIRS = [
  ['--color-text-primary', '--color-background-body', 4.5, 'body text'],
  ['--color-text-primary', '--color-background-surface', 4.5, 'text on cards'],
  ['--color-text-secondary', '--color-background-body', 4.5, 'secondary text'],
  ['--color-text-secondary', '--color-background-surface', 4.5, 'secondary text on cards'],
  ['--color-text-accent', '--color-background-body', 4.5, 'accent text'],
  ['--color-on-accent', '--color-accent', 4.5, 'primary button label'],
  ['--color-accent', '--color-background-body', 3, 'focus ring and accent UI'],
  ['--color-border-emphasized', '--color-background-surface', 3, 'input borders'],
  ['--color-text-purple', '--color-background-purple', 4.5, 'ghost card text'],
  ['--color-text-primary', '--color-background-purple', 4.5, 'text on ghost cards'],
  ['--color-text-orange', '--color-background-orange', 4.5, 'notice text'],
  ['--color-text-primary', '--color-background-orange', 4.5, 'text on notices'],
  ['--color-text-yellow', '--color-background-yellow', 4.5, 'pumpkin badge text'],
  ['--fm-color-heading', '--band', 4.5, 'headings on the Sources lavender band'],
  ['--fm-color-muted', '--band', 4.5, 'muted text on the Sources lavender band'],
  ['--color-text-primary', '--band', 4.5, 'body text on the Sources lavender band'],
  ['--color-text-accent', '--band', 4.5, 'links on the Sources lavender band'],
  ...TAGS.map((tag) => [`--fm-color-tag-${tag}-text`, `--fm-color-tag-${tag}-bg`, 4.5, `${tag} tag chip`]),
];

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

let failed = false;
for (const [fg, bg, min, what] of PAIRS) {
  if (!tokens[fg] || !tokens[bg]) {
    console.error(`missing token: ${tokens[fg] ? bg : fg}`);
    failed = true;
    continue;
  }
  const r = ratio(tokens[fg], tokens[bg]);
  const ok = r >= min;
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}:1 (needs ${min}:1)  ${what}: ${tokens[fg]} on ${tokens[bg]}`);
}
process.exit(failed ? 1 : 0);
