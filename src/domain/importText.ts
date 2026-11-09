// Paste parser (active spec design.md, "Paste parser"; Requirements 6.2, 6.3,
// 6.6). Turns pasted ChatGPT text or an Instagram caption into a title,
// ingredients, steps, notes, stated time and servings. Pure TS, no React, no
// network. Nothing is guessed about safety here: every pasted line ends up in
// the ingredients, steps, notes or title, where the safety screen reads it.

import { UNIT_WORDS } from './foods';

/** Longest paste the parser reads; the UI shows a message above this. */
export const MAX_PASTE_CHARS = 20_000;

export const DEFAULT_TITLE = 'Pasted recipe';

export interface ParsedIngredient {
  name: string;
  quantity?: number;
  unit?: string;
  optional: boolean;
  line: number;
}

export interface ParsedLine {
  text: string;
  line: number;
}

export interface ParsedRecipe {
  title: string;
  ingredients: ParsedIngredient[];
  steps: ParsedLine[];
  notes: ParsedLine[];
  statedMinutes?: number;
  servings?: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Clean-up (design steps 1 to 5)
// ---------------------------------------------------------------------------

interface Item {
  text: string;
  /** 1-based line number in the original text. */
  line: number;
  /** True when a blank (or symbol-only) line came right before this one. */
  brk: boolean;
  /** Set when the line was used as the title, time or servings. */
  consumed: boolean;
}

// Filler lines of Instagram captions (design step 5).
const FILLER_RE = /\b(?:save this|follow for|link in bio|comments?|share with|tag a)\b/i;

/**
 * Clean one raw line. Returns null for a dropped line (hashtags, @mentions,
 * caption filler), '' for a blank or symbol-only line (a section break).
 */
function cleanLine(raw: string): string | null {
  let s = raw.trim();
  if (s === '') return '';

  // Keycap emoji "1️⃣" become "1." so they work as numbered markers.
  s = s.replace(/(\d)\uFE0F?\u20E3/g, '$1.');

  // Markdown: headers, bold, italic, inline code.
  s = s.replace(/^#{1,6}\s+/, '');
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, '$1$2');
  s = s.replace(/`/g, '');

  // Emoji and decorative symbols (arrows, box drawing, dingbats, shapes). The
  // fraction characters are not in these ranges, so they stay. "▪" is a list
  // marker and stays.
  s = s.replace(
    /\p{Extended_Pictographic}|\uFE0F|\u200D|\u20E3|[\u2190-\u21FF\u2500-\u25FF\u2600-\u27BF\u2B00-\u2BFF]/gu,
    (m) => (m === '\u25AA' || m === '\u25AB' ? m : ' '),
  );
  s = s.replace(/\s+/g, ' ').trim();

  // A line of only hashtags and @mentions is dropped; trailing runs are cut.
  if (s !== '' && s.split(' ').every((t) => /^[#@][\p{L}\p{N}_]+$/u.test(t))) {
    return null;
  }
  s = s.replace(/(?:\s+[#@][\p{L}\p{N}_]+)+$/u, '').trim();

  if (!/[\p{L}\p{N}]/u.test(s)) return '';
  if (FILLER_RE.test(s)) return null;
  return s;
}

function buildItems(text: string): Item[] {
  const items: Item[] = [];
  let brk = false;
  text.split(/\r\n|\r|\n/).forEach((raw, index) => {
    const cleaned = cleanLine(raw);
    if (cleaned === null) return; // dropped: not a break
    if (cleaned === '') {
      brk = true;
      return;
    }
    items.push({ text: cleaned, line: index + 1, brk, consumed: false });
    brk = false;
  });
  return items;
}

// ---------------------------------------------------------------------------
// Markers, headings
// ---------------------------------------------------------------------------

const MARKER_RE = /^(?:([-*•▪–])\s+|(\d+[.)])\s+|(step\s*\d+\s*[:.)-]?)\s*)/i;

interface Stripped {
  rest: string;
  marker: 'bullet' | 'number' | null;
}

function stripMarker(text: string): Stripped {
  const m = MARKER_RE.exec(text);
  if (!m || m[0].length >= text.length) return { rest: text, marker: null };
  return { rest: text.slice(m[0].length).trim(), marker: m[1] ? 'bullet' : 'number' };
}

type Section = 'ingredients' | 'steps' | 'notes';

const HEADING_WORDS: Array<[string, Section]> = [
  ['ingredients', 'ingredients'],
  ['what you need', 'ingredients'],
  ["what you'll need", 'ingredients'],
  ['you will need', 'ingredients'],
  ["you'll need", 'ingredients'],
  ['instructions', 'steps'],
  ['steps', 'steps'],
  ['method', 'steps'],
  ['directions', 'steps'],
  ['how to make it', 'steps'],
  ['how to make', 'steps'],
  ['preparation', 'steps'],
  ['notes', 'notes'],
  ['tips', 'notes'],
  ['storage', 'notes'],
  ['serving', 'notes'],
];
const HEADING_MAP = new Map(HEADING_WORDS);
const HEADING_RE = new RegExp(
  `^(${HEADING_WORDS.map(([w]) => w.replace(/ /g, '\\s+')).join('|')})\\s*(?:\\([^)]*\\)\\s*)?(?::\\s*(.*))?$`,
  'i',
);

interface Heading {
  section: Section;
  rest: string;
}

function matchHeading(text: string): Heading | null {
  const m = HEADING_RE.exec(text.replace(/[\u2018\u2019]/g, "'"));
  if (!m) return null;
  const key = m[1].toLowerCase().replace(/\s+/g, ' ');
  const section = HEADING_MAP.get(key);
  if (!section) return null;
  return { section, rest: (m[2] ?? '').trim() };
}

// ---------------------------------------------------------------------------
// Time and servings
// ---------------------------------------------------------------------------

const TITLE_RE = /^title\s*:\s*(\S.*)$/i;
const TIME_LABEL = '(?:total time|ready in|prep(?:aration)? time|cook(?:ing)? time)';
const TIME_START_RE = new RegExp(`^${TIME_LABEL}\\b`, 'i');
const TIME_SPLIT_RE = new RegExp(`(?=\\b${TIME_LABEL}\\b)`, 'i');
const TIME_PART_RE = new RegExp(`^(${TIME_LABEL})\\s*[:\\-–]?\\s*(.*)$`, 'i');

const RANGE = '(\\d+(?:\\.\\d+)?)(?:\\s*(?:-|–|to)\\s*(\\d+(?:\\.\\d+)?))?';
const HOURS_RE = new RegExp(`${RANGE}\\s*(?:hours?|hrs?|h)(?![a-z])`);
const MINUTES_RE = new RegExp(`${RANGE}\\s*(?:minutes?|mins?|m)(?![a-z])`);
const BARE_RE = new RegExp(`^\\s*${RANGE}\\s*$`);

/** Minutes in "20 minutes", "1 hr 30 min", "1.5 hours", "20-25 min" (upper bound). */
function parseDuration(value: string): number | undefined {
  const t = value.toLowerCase();
  let hours = 0;
  let minutes = 0;
  let found = false;
  let rest = t;
  const h = HOURS_RE.exec(t);
  if (h) {
    hours = Number(h[2] ?? h[1]);
    found = true;
    rest = t.slice(h.index + h[0].length);
    const bareMinutes = /^\s*(\d{1,2})\s*$/.exec(rest); // "1h30"
    if (bareMinutes) minutes = Number(bareMinutes[1]);
  }
  const m = MINUTES_RE.exec(rest);
  if (m) {
    minutes = Number(m[2] ?? m[1]);
    found = true;
  }
  if (!found) {
    const bare = BARE_RE.exec(t);
    if (!bare) return undefined;
    minutes = Number(bare[2] ?? bare[1]);
  }
  const total = Math.round(hours * 60 + minutes);
  return total > 0 ? total : undefined;
}

interface TimeParts {
  total?: number;
  ready?: number;
  prep?: number;
  cook?: number;
}

/** Read a line like "Total time: 20 min" or "Prep time: 5 min | Cook time: 10 min". */
function readTimeLine(text: string, into: TimeParts): boolean {
  if (!TIME_START_RE.test(text)) return false;
  const found: Array<[keyof TimeParts, number]> = [];
  for (const part of text.split(TIME_SPLIT_RE)) {
    const m = TIME_PART_RE.exec(part.trim().replace(/[|;·•]\s*$/, ''));
    if (!m) return false;
    const minutes = parseDuration(m[2]);
    if (minutes === undefined) return false;
    const label = m[1].toLowerCase();
    const key: keyof TimeParts = label.startsWith('total')
      ? 'total'
      : label.startsWith('ready')
        ? 'ready'
        : label.startsWith('prep')
          ? 'prep'
          : 'cook';
    found.push([key, minutes]);
  }
  for (const [key, minutes] of found) into[key] ??= minutes;
  return found.length > 0;
}

const SERVINGS_RE =
  /^(?:serves|servings|yields?|serving(?=\s*:\s*\d+\s*$))\s*[:\-–]?\s*(?:about\s+|approx\.?\s+|approximately\s+)?(\d+)(?:\s*(?:-|–|to)\s*(\d+))?(?![\d/.])/i;
const MAKES_RE =
  /^makes\s+(?:about\s+|approx\.?\s+|approximately\s+)?(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s+servings?\b/i;

function readServings(text: string): number | undefined {
  const m = SERVINGS_RE.exec(text) ?? MAKES_RE.exec(text);
  if (!m) return undefined;
  const n = Number(m[2] ?? m[1]);
  return n > 0 ? n : undefined;
}

// ---------------------------------------------------------------------------
// Quantities, units, ingredient lines
// ---------------------------------------------------------------------------

const FRACTIONS: Record<string, number> = {
  '½': 1 / 2,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};
const F = Object.keys(FRACTIONS).join('');
const NUM = `(?:\\d+\\s+\\d+/\\d+|\\d+\\s*[${F}]|\\d+/\\d+|[${F}]|\\d+(?:\\.\\d+)?)`;
const QTY_RE = new RegExp(
  `^(${NUM})(?:\\s*(?:-|–|—)\\s*(${NUM})|\\s+to\\s+(${NUM}))?(?=\\s|$|[a-zA-Z(])`,
);

function parseNumber(s: string): number | null {
  const t = s.trim();
  let m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[3]) === 0 ? null : Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = /^(\d+)\s*([½¼¾⅓⅔⅛⅜⅝⅞])$/.exec(t);
  if (m) return Number(m[1]) + FRACTIONS[m[2]];
  m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  if (t in FRACTIONS) return FRACTIONS[t];
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Round to 3 places so 1/3 reads as 0.333, not 0.3333333333333333. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// The v1 UNIT_WORDS plus the extra units from the design, and the spelled-out
// forms recipes use. Written forms map to the short unit vocabulary.
const UNIT_CANON: Record<string, string> = {
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbsps: 'tbsp',
  tbs: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsps: 'tsp',
  cups: 'cup',
  ounce: 'oz',
  ounces: 'oz',
  pound: 'lb',
  pounds: 'lb',
  lbs: 'lb',
  gram: 'g',
  grams: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  pieces: 'piece',
  pinches: 'pinch',
  handfuls: 'handful',
  cloves: 'clove',
  slices: 'slice',
  cans: 'can',
  jars: 'jar',
};
const UNITS: ReadonlySet<string> = new Set([
  ...UNIT_WORDS,
  'pinch',
  'handful',
  'clove',
  'slice',
  'can',
  'jar',
  ...Object.keys(UNIT_CANON),
]);
/** Units that read as an ingredient line even without a quantity. */
const LOOSE_UNITS: ReadonlySet<string> = new Set(['pinch', 'pinches', 'handful', 'handfuls']);

const OPTIONAL_PAREN_RE = /\(\s*(?:optional|if you like|to taste)\s*\)/gi;
const OPTIONAL_WORD_RE = /,?\s*\b(?:optional|if you like|to taste)\b/gi;
const TIME_WORD_RE = /^(?:minutes?|mins?|hours?|hrs?|seconds?|secs?|days?|weeks?|months?|years?|degrees?)\b/i;

function tidyName(s: string): string {
  return s
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:.]+|[\s,;:.]+$/g, '');
}

function parseIngredient(text: string, line: number): ParsedIngredient {
  let rest = text.trim();
  const optional = /\b(?:optional|if you like|to taste)\b/i.test(rest);
  if (optional) {
    const stripped = tidyName(rest.replace(OPTIONAL_PAREN_RE, '').replace(OPTIONAL_WORD_RE, ''));
    if (stripped !== '') rest = stripped;
  }

  let quantity: number | undefined;
  let unit: string | undefined;

  const q = QTY_RE.exec(rest);
  if (q) {
    const upper = q[2] ?? q[3];
    const value = parseNumber(upper ?? q[1]);
    if (value !== null && (upper === undefined || parseNumber(q[1]) !== null)) {
      quantity = round3(value);
      rest = rest.slice(q[0].length).trim();
    }
  }

  const u = /^([A-Za-z]+)\.?(?=\s|$|,)/.exec(rest);
  if (u) {
    const word = u[1].toLowerCase();
    const after = rest.slice(u[0].length).trim();
    const hasOf = /^of\s+\S/i.test(after);
    if (UNITS.has(word) && after !== '' && (quantity !== undefined || hasOf || LOOSE_UNITS.has(word))) {
      unit = UNIT_CANON[word] ?? word;
      rest = hasOf ? after.replace(/^of\s+/i, '') : after;
    }
  }

  const name = tidyName(rest) || tidyName(text);
  const result: ParsedIngredient = { name, optional, line };
  if (quantity !== undefined) result.quantity = quantity;
  if (unit !== undefined) result.unit = unit;
  return result;
}

/** "1 banana, 2 tbsp oats and a pinch of salt" -> pieces, only when each is under 6 words. */
function splitInlineList(content: string): string[] {
  const pieces = content
    .split(/\s*,\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter((p) => p !== '');
  if (pieces.length > 1 && pieces.every((p) => p.split(/\s+/).length < 6)) return pieces;
  return [content];
}

// ---------------------------------------------------------------------------
// Lines with no section heading (captions)
// ---------------------------------------------------------------------------

const COOKING_VERBS = 'add|mix|stir|cook|bake|steam|boil|blend|mash|serve|heat|combine|pour|cut|chop';
const VERB_FIRST_RE = new RegExp(`^(?:${COOKING_VERBS})\\b`, 'i');
const VERB_ANY_RE = new RegExp(
  `\\b(?:(?:${COOKING_VERBS})(?:s|es|ed|d|ing)?|cutting|chopped|chopping)\\b`,
  'i',
);

type LooseKind = 'ingredient' | 'step' | 'note';

function looseKinds(items: Item[], hasHeadings: boolean): LooseKind[] {
  // With headings elsewhere in the text, a sentence that merely contains a
  // cooking word ("a soft mash for baby") is an intro note, not a step.
  const verbSentence: LooseKind = hasHeadings ? 'note' : 'step';
  const kinds: Array<LooseKind | 'candidate'> = items.map((item) => {
    const { rest, marker } = stripMarker(item.text);
    if (marker === 'number') return 'step';
    if (VERB_FIRST_RE.test(rest)) return 'step';
    if (rest.split(/\s+/).length < 8) {
      if (marker === 'bullet') return 'candidate';
      const q = QTY_RE.exec(rest);
      if (q && !TIME_WORD_RE.test(rest.slice(q[0].length).trim())) return 'candidate';
      if (!q) {
        const parsed = parseIngredient(rest, item.line);
        if (parsed.unit !== undefined) return 'candidate';
      }
    }
    return VERB_ANY_RE.test(rest) ? verbSentence : 'note';
  });

  // Consecutive candidates form the ingredient list. A lone candidate counts
  // only when it has both a quantity and a unit.
  const result: LooseKind[] = kinds.map((k) => (k === 'candidate' ? 'note' : k));
  let i = 0;
  while (i < kinds.length) {
    if (kinds[i] !== 'candidate') {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < kinds.length && kinds[j] === 'candidate' && !items[j].brk) j++;
    const lone = j - i === 1;
    for (let k = i; k < j; k++) {
      const { rest } = stripMarker(items[k].text);
      const parsed = parseIngredient(rest, items[k].line);
      const strong = parsed.quantity !== undefined && parsed.unit !== undefined;
      if (!lone || strong) {
        result[k] = 'ingredient';
      } else {
        result[k] = VERB_ANY_RE.test(rest) ? verbSentence : 'note';
      }
    }
    i = j;
  }
  return result;
}

// ---------------------------------------------------------------------------
// parseRecipeText
// ---------------------------------------------------------------------------

export function parseRecipeText(text: string): ParsedRecipe {
  const empty: ParsedRecipe = {
    title: DEFAULT_TITLE,
    ingredients: [],
    steps: [],
    notes: [],
    warnings: [],
  };
  if (text.trim() === '') return { ...empty, warnings: ['There is no text to read.'] };
  if (text.length > MAX_PASTE_CHARS) {
    return { ...empty, warnings: ['The text is too long to read (over 20,000 characters).'] };
  }

  const items = buildItems(text);
  const result: ParsedRecipe = { ...empty, ingredients: [], steps: [], notes: [], warnings: [] };

  // Title, time and servings lines are used up here and never reach the lists.
  const times: TimeParts = {};
  let title: string | undefined;
  for (const item of items) {
    const { rest } = stripMarker(item.text);
    const t = TITLE_RE.exec(rest);
    if (t && title === undefined) {
      title = t[1].trim();
      item.consumed = true;
    } else if (readTimeLine(rest, times)) {
      item.consumed = true;
    } else {
      const servings = readServings(rest);
      if (servings !== undefined) {
        result.servings ??= servings;
        item.consumed = true;
      }
    }
  }
  result.statedMinutes =
    times.total ??
    times.ready ??
    (times.prep !== undefined && times.cook !== undefined ? times.prep + times.cook : undefined);
  if (result.statedMinutes === undefined) delete result.statedMinutes;

  const live = items.filter((i) => !i.consumed);
  if (title === undefined) {
    // First line before the first heading: under 80 characters, not a list
    // item, and not an ingredient line.
    const first = live[0];
    if (first && matchHeading(first.text) === null) {
      const { marker } = stripMarker(first.text);
      const q = QTY_RE.exec(first.text);
      const looksLikeIngredient =
        q !== null &&
        !TIME_WORD_RE.test(first.text.slice(q[0].length).trim()) &&
        !/^ingredients?\b/i.test(first.text.slice(q[0].length).trim());
      if (marker === null && first.text.length < 80 && !looksLikeIngredient) {
        title = first.text;
        first.consumed = true;
      }
    }
  }
  result.title = title && title !== '' ? title : DEFAULT_TITLE;

  // Sections.
  const hasHeadings = items.some((i) => !i.consumed && matchHeading(i.text) !== null);
  let section: Section | null = null;
  let pending: Item[] = []; // lines before the first heading
  let stepsInSection = 0;

  const flushLoose = (list: Item[]) => {
    const kinds = looseKinds(list, hasHeadings);
    list.forEach((item, index) => {
      const { rest } = stripMarker(item.text);
      if (kinds[index] === 'ingredient') {
        result.ingredients.push(parseIngredient(rest, item.line));
      } else if (kinds[index] === 'step') {
        result.steps.push({ text: rest, line: item.line });
      } else {
        result.notes.push({ text: rest, line: item.line });
      }
    });
  };

  for (const item of items) {
    if (item.consumed) continue;
    const heading = matchHeading(item.text);
    if (heading) {
      flushLoose(pending);
      pending = [];
      section = heading.section;
      stepsInSection = 0;
      if (heading.rest !== '') {
        if (section === 'ingredients') {
          for (const piece of splitInlineList(heading.rest)) {
            result.ingredients.push(parseIngredient(piece, item.line));
          }
        } else if (section === 'steps') {
          result.steps.push({ text: heading.rest, line: item.line });
          stepsInSection++;
        } else {
          result.notes.push({ text: heading.rest, line: item.line });
        }
      }
      continue;
    }
    if (section === null) {
      pending.push(item);
      continue;
    }
    const { rest, marker } = stripMarker(item.text);
    if (section === 'ingredients') {
      if (rest.endsWith(':')) {
        result.notes.push({ text: rest, line: item.line }); // "For the sauce:"
      } else {
        result.ingredients.push(parseIngredient(rest, item.line));
      }
    } else if (section === 'steps') {
      // Closing chatter after a gap ("Enjoy!") is a note, not a step.
      if (marker === null && item.brk && stepsInSection > 0 && !VERB_ANY_RE.test(rest)) {
        result.notes.push({ text: rest, line: item.line });
      } else {
        result.steps.push({ text: rest, line: item.line });
        stepsInSection++;
      }
    } else {
      result.notes.push({ text: rest, line: item.line });
    }
  }
  flushLoose(pending);

  if (result.ingredients.length === 0) result.warnings.push('No ingredient list found');
  if (result.steps.length === 0) result.warnings.push('No steps found');
  return result;
}
