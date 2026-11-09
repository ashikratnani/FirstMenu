// Read-only share links (design.md "Share link (share.ts)", Requirement 11).
// Pure TS, no React. A share link carries a compact, PRIVACY-STRIPPED snapshot
// of the plan in the URL fragment so it never reaches the host: the week plan,
// only the recipes the plan uses (built-in AND custom, so a shared custom
// recipe still renders), the child's age in months, and the food log with
// every note removed.
//
// Privacy guarantee (Requirement 11.3): the payload carries NEITHER the child's
// name NOR birth date — only ageMonths, a single number — and EVERY
// FoodRecord.note is stripped. There is no `child` field at all. The encoded
// string therefore cannot contain the name, the birth date, or any note text.
//
// The payload also carries rulesetVersion (the version the sharer saw), but the
// viewer RE-RUNS its OWN current copy of the rules against the payload
// (design.md: "a link made before a rule change gets the newer rules"), so the
// stored version is informational only.
//
// Untrusted boundary: decodeShareData validates the decompressed JSON with a
// zod schema that REUSES the storage.ts schemas (weekPlanSchema, recipeSchema,
// foodRecordSchema) so the share shape stays in lock-step with persistence.
// Garbage, truncated, tampered or unknown-version (v !== 1) input is rejected
// with { ok: false } and NEVER yields partial data (Requirement 11.5).

import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';
import { z } from 'zod';

import type { AppState, FoodRecord, Recipe, WeekPlan } from './types';
import { RULESET_VERSION } from './safety/rules';
import { foodRecordSchema, recipeSchema, weekPlanSchema } from './storage';
import { selectAgeMonths, selectAllRecipes } from '../state/selectors';

/**
 * The data a share link carries (design.md "Share link"). EXACTLY these fields:
 * no child name or birth date (only ageMonths), and food notes stripped.
 */
export interface SharePayload {
  v: 1;
  rulesetVersion: number;
  ageMonths: number;
  plan: WeekPlan;
  recipes: Recipe[]; // only the recipes used in the plan (built-in + custom)
  foods: Record<string, FoodRecord>; // notes stripped
}

/**
 * Base of the shared-view URL (design.md encode target). The encoded fragment
 * is appended directly after this prefix.
 */
export const SHARE_BASE_URL =
  'https://ashikratnani.github.io/FirstMenu/#/shared/';

/**
 * Above this many characters the UI shows the "link may be too long" warning
 * (Requirement 11.6). The length is measured against the full URL (see
 * encodeSharePayload/isShareLinkLong). The link is STILL created when long.
 */
export const SHARE_WARN_LENGTH = 4000;

/**
 * Build the privacy-stripped share payload from the current AppState
 * (Requirements 11.1, 11.3). The result carries:
 *  - ageMonths: the owner's age via selectAgeMonths(state) (?? 0 with no child).
 *  - plan: the week plan as-is.
 *  - recipes: ONLY the recipes referenced across every meal slot of the plan,
 *    resolved against the full recipe set (built-ins + custom) so a shared
 *    custom recipe is INCLUDED; deduped, unknown ids skipped. Pasted recipes
 *    have imported.text and clearedMentions stripped.
 *  - foods: a copy of state.foods with EVERY note removed (status + date kept).
 *  - rulesetVersion: the current RULESET_VERSION; v: 1.
 *
 * There is NO child field, so the name and birth date never leave the device.
 */
export function buildSharePayload(state: AppState): SharePayload {
  const ageMonths = selectAgeMonths(state) ?? 0;

  // Collect every recipe id referenced across all days / meal slots.
  const usedIds = new Set<string>();
  for (const day of state.plan.days) {
    for (const recipeId of Object.values(day)) {
      if (recipeId) usedIds.add(recipeId);
    }
  }

  // Resolve ids against the full recipe set (built-ins + custom). Preserve the
  // full set's order, keep only used ids, and naturally dedupe + skip unknowns.
  // Strip the fields that make links long or hold the original paste (design:
  // `imported.text` and `clearedMentions`). `imported` itself stays, with an
  // empty text, so the viewer still treats the recipe as a pasted recipe.
  const recipes = selectAllRecipes(state)
    .filter((recipe) => usedIds.has(recipe.id))
    .map(stripImportedFields);

  // Copy the food log, stripping every note (omit the field entirely).
  const foods: Record<string, FoodRecord> = {};
  for (const [key, record] of Object.entries(state.foods)) {
    foods[key] = { status: record.status, date: record.date };
  }

  return {
    v: 1,
    rulesetVersion: RULESET_VERSION,
    ageMonths,
    plan: state.plan,
    recipes,
    foods,
  };
}

/** Drop `imported.text` and `clearedMentions` from a recipe for sharing. */
function stripImportedFields(recipe: Recipe): Recipe {
  const { imported, ...rest } = recipe;
  delete rest.clearedMentions;
  return imported ? { ...rest, imported: { ...imported, text: '' } } : rest;
}

/** The result of encoding a share link. */
export interface EncodedShareLink {
  /** The full shareable URL (SHARE_BASE_URL + encoded). */
  url: string;
  /** The encoded fragment only (what /shared/:data receives). */
  encoded: string;
  /** url.length — the value the length warning is measured against. */
  length: number;
}

/**
 * Encode the share payload for the URL: JSON.stringify -> lz-string
 * compressToEncodedURIComponent -> SHARE_BASE_URL + fragment. Returns the full
 * url, the encoded fragment, and length (url.length) so the UI can copy the
 * link, route on the fragment, and drive the length warning consistently.
 */
export function encodeSharePayload(state: AppState): EncodedShareLink {
  const payload = buildSharePayload(state);
  const encoded = compressToEncodedURIComponent(JSON.stringify(payload));
  const url = SHARE_BASE_URL + encoded;
  return { url, encoded, length: url.length };
}

/**
 * Whether a share link is long enough to warn about (Requirement 11.6). Accepts
 * either the full URL string (measured by .length) or a precomputed length
 * number, both consistent with encodeSharePayload's `length` (= url.length).
 * The link is still valid when long; this only drives the warning.
 */
export function isShareLinkLong(urlOrLength: string | number): boolean {
  const length =
    typeof urlOrLength === 'number' ? urlOrLength : urlOrLength.length;
  return length > SHARE_WARN_LENGTH;
}

// Runtime validator for a decoded share payload. Reuses the storage schemas so
// the share shape cannot drift from persistence. `.strict()` on the top level
// rejects any extra/unknown keys from a tampered link.
const sharePayloadSchema = z
  .object({
    v: z.literal(1),
    rulesetVersion: z.number(),
    ageMonths: z.number(),
    plan: weekPlanSchema,
    recipes: z.array(recipeSchema),
    foods: z.record(z.string(), foodRecordSchema),
  })
  .strict();

// The inferred schema type must match the hand-written SharePayload; this line
// fails to compile if the two drift.
type SchemaShare = z.infer<typeof sharePayloadSchema>;
const _schemaMatchesType: SharePayload extends SchemaShare
  ? SchemaShare extends SharePayload
    ? true
    : never
  : never = true;
void _schemaMatchesType;

/** The result of decoding a share fragment: valid payload or a flat failure. */
export type DecodeShareResult =
  | { ok: true; payload: SharePayload }
  | { ok: false };

/**
 * Decode and validate a share fragment (Requirement 11.5). Steps:
 *  1. lz-string decompressFromEncodedURIComponent (null/'' on garbage),
 *  2. JSON.parse (guarded), then
 *  3. zod validation against the share schema (which rejects unknown v, wrong
 *     shapes, extra keys, bad dates).
 * ANY failure returns { ok: false }; it NEVER returns partial data.
 */
export function decodeShareData(fragment: string): DecodeShareResult {
  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(fragment);
  } catch {
    return { ok: false };
  }
  if (!json) return { ok: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false };
  }

  const result = sharePayloadSchema.safeParse(parsed);
  if (!result.success) return { ok: false };
  return { ok: true, payload: result.data };
}
