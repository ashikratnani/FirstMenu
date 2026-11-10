// The fixed safety rule list and its sources (design.md, "Rule shape",
// "Initial rule list", "Sources"). Pure TS, no React.
//
// Safety policy (steering/safety-rules.md): every rule MUST have a published
// source and a test case; terms are lowercase and singular; the screen may be
// made STRICTER but never looser. Any rule change bumps RULESET_VERSION.

import type { AllergenGroup } from '../types';

export type RuleKind = 'block' | 'reminder' | 'allergen';

export interface SafetyRule {
  id: string;
  kind: RuleKind;
  terms: string[];
  except?: string[];
  fromMonths?: number; // rule applies only once age >= fromMonths (default 0)
  underMonths?: number; // rule applies while age < underMonths
  allergenGroup?: AllergenGroup; // kind === 'allergen' only
  label: string; // short name shown in UI, e.g. "Honey"
  message: string; // plain-language reason or reminder
  sources: SourceId[];
}

// Source ids. Each maps to an entry in SOURCES below.
export type SourceId =
  | 'AAP-honey'
  | 'AAP-juice'
  | 'AAP-sugar'
  | 'AAP-milk'
  | 'AAP-choking'
  | 'AAP-allergens'
  | 'AAP-solid-foods'
  | 'NIAID-peanut'
  | 'WHO-2023'
  | 'FDA-EPA-fish'
  | 'FDA-raw-milk'
  | 'FDA-safe-food-handling'
  | 'CDC-choking'
  | 'CDC-solids'
  | 'CDC-iron'
  | 'CDC-encourage'
  | 'USDA-FNS-iron'
  | 'HHS-CFOC';

export interface Source {
  title: string;
  url: string; // primary / first cited page
  urls?: string[]; // all cited pages when a source lists more than one (design "Sources")
  retrieved?: string; // YYYY-MM-DD
  note?: string; // e.g. the archive copy actually read
}

// Sources table (design.md "Sources"), plus the sources confirmed in task 3.2
// (retrieved 2026-11-07). The four previously-placeholder "confirm source"
// rules now cite real published URLs: FDA raw-milk for the unpasteurized rule,
// FDA safe-food-handling for the egg-cooking / cook-through doneness rules, and
// AAP "Starting Solid Foods" for the 3-day new-food spacing value.
export const SOURCES: Record<SourceId, Source> = {
  'AAP-honey': {
    title: "AAP HealthyChildren: Caring for your child's cold",
    url: 'https://www.healthychildren.org/English/health-issues/conditions/flu/Pages/caring-for-Your-childs-cold-or-flu.aspx',
  },
  'AAP-juice': {
    title: 'AAP HealthyChildren: How to reduce added sugar',
    url: 'https://www.healthychildren.org/English/healthy-living/nutrition/Pages/How-to-Reduce-Added-Sugar-in-Your-Childs-Diet.aspx',
  },
  'AAP-sugar': {
    title: "AAP News: Added sugar in kids' diets",
    url: 'https://publications.aap.org/aapnews/news/pdfDownload/7331',
  },
  'AAP-milk': {
    title: 'AAP HealthyChildren: Feeding your baby when money is tight / Cow\u2019s milk alternatives FAQ',
    url: 'https://www.healthychildren.org/English/tips-tools/ask-the-pediatrician/Pages/how-should-we-feed-our-baby-if-running-low-on-money.aspx',
    urls: [
      'https://www.healthychildren.org/English/tips-tools/ask-the-pediatrician/Pages/how-should-we-feed-our-baby-if-running-low-on-money.aspx',
      'https://www.healthychildren.org/English/healthy-living/nutrition/Pages/milk-allergy-foods-and-ingredients-to-avoid.aspx',
    ],
  },
  'AAP-choking': {
    title: 'AAP HealthyChildren: Choking prevention',
    url: 'https://www.healthychildren.org/English/health-issues/injuries-emergencies/Pages/Choking-Prevention.aspx',
  },
  'AAP-allergens': {
    title: 'AAP HealthyChildren: When to introduce egg, peanut butter and other allergens',
    url: 'https://www.healthychildren.org/English/healthy-living/nutrition/Pages/when-to-introduce-egg-peanut-butter-and-other-common-food-allergens-to-your-baby-food-allergy-prevention-tips.aspx',
  },
  'AAP-solid-foods': {
    title: 'AAP HealthyChildren: Starting Solid Foods',
    url: 'https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Starting-Solid-Foods.aspx',
    retrieved: '2026-11-07',
  },
  'NIAID-peanut': {
    title: 'NIAID: Addendum guidelines for the prevention of peanut allergy',
    url: 'https://www.niaid.nih.gov/sites/default/files/peanut-allergy-prevention-guidelines-clinician-summary.pdf',
  },
  'WHO-2023': {
    title: 'WHO Guideline for complementary feeding of infants and young children 6\u201323 months (2023)',
    url: 'https://www.who.int/publications/i/item/9789240081864',
  },
  'FDA-EPA-fish': {
    title: 'EPA-FDA advice about eating fish and shellfish',
    url: 'https://www.epa.gov/choose-fish-and-shellfish-wisely/epa-fda-advice-about-eating-fish-and-shellfish',
  },
  'FDA-raw-milk': {
    title:
      'FDA: The Dangers of Raw Milk: Unpasteurized Milk Can Pose a Serious Health Risk',
    url: 'https://www.fda.gov/food/buy-store-serve-safe-food/dangers-raw-milk-unpasteurized-milk-can-pose-serious-health-risk',
    retrieved: '2026-11-07',
  },
  'FDA-safe-food-handling': {
    title: 'FDA: Safe Food Handling',
    url: 'https://www.fda.gov/food/buy-store-serve-safe-food/safe-food-handling',
    retrieved: '2026-11-07',
  },
  'CDC-choking': {
    title: 'CDC: Choking hazards',
    url: 'https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/choking-hazards.html',
  },
  'CDC-solids': {
    title: 'CDC: When, what and how to introduce solid foods',
    url: 'https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/when-what-and-how-to-introduce-solid-foods.html',
    retrieved: '2026-11-10',
    note: 'Texture hints read from a web.archive.org copy captured 2025-01-26 (page dated December 5, 2023; the live page returned 403). Re-check against the live page.',
  },
  // Nutrition tag sources (task 4.1). Used by domain/nutrition.ts, not by safety
  // rules. CDC pages were read from Internet Archive copies (CDC returns 403 to
  // the build sandbox), so `retrieved` is the day the copy was read and `note`
  // gives the copy's own date. The USDA PDF was read directly. See nutrition.ts.
  'CDC-iron': {
    title: 'CDC: Iron (Infant and Toddler Nutrition)',
    url: 'https://www.cdc.gov/infant-toddler-nutrition/vitamins-minerals/iron.html',
    retrieved: '2026-11-09',
    note: 'Read from a web.archive.org copy dated 2024-04-01 (the live page returned 403). Re-check against the live page.',
  },
  'CDC-encourage': {
    title: 'CDC: Foods and drinks to encourage',
    url: 'https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/foods-and-drinks-to-encourage.html',
    retrieved: '2026-11-09',
    note: 'Read from a web.archive.org copy dated 2023-11-24 (the live page returned 403). Re-check against the live page. Two copies were read: the nutrition tags (nutrition.ts) used the 2023-11-24 copy; the stage texture hints (STAGE_TEXTURE_HINTS) used the copy captured 2025-01-26, which carries the page date November 24, 2023. `retrieved` is the day of the earlier nutrition read.',
  },
  'USDA-FNS-iron': {
    title: 'USDA FNS: For parents, making sure your baby gets enough iron (PDF)',
    url: 'https://www.fna.usda.gov/sites/default/files/resource-files/FI_PHa_5MakingSureEnoughIron.pdf',
    retrieved: '2026-11-09',
  },
  'HHS-CFOC': {
    title: 'Caring for Our Children 4.5.0.10: Foods that are choking hazards',
    url: 'https://childcareta.acf.hhs.gov/cfoc/basic/chapter/4/4.5.0.10',
  },
};

/**
 * Stage texture hints (Req 13.5). Each hint is limited to wording the cited
 * Internet Archive copy supports (CDC returns 403 to the sandbox; maintainer
 * decision on issue #54). `quote` is the supporting text from the page, and
 * `archiveNote` says which copy it was read from. Hints never use a pronoun.
 * Gaps: the CDC pages give no age-specific texture wording for 2 to 3 years
 * and do not use the phrase "small, bite-sized pieces". The 12-23 and 24-36
 * hints both rest on one sentence from the "Starting solid foods" section of
 * the encourage page (match foods to the child's eating skills; soft and
 * mashed or bite-sized at first). That sentence is general, not an age-specific
 * rule for 2 to 3 years. Every content word of a hint appears in its quote.
 */
export interface StageTextureHint {
  hint: string;
  quote: string;
  sources: SourceId[];
  archiveNote: string;
}

const SOLIDS_ARCHIVE =
  'web.archive.org copy captured 2025-01-26 of the CDC page dated December 5, 2023';
const ENCOURAGE_ARCHIVE =
  'web.archive.org copy captured 2025-01-26 of the CDC page dated November 24, 2023';

export const STAGE_TEXTURE_HINTS: Record<'6-8' | '9-12' | '12-23' | '24-36', StageTextureHint> = {
  '6-8': {
    hint: 'mashed, pureed or strained, very smooth',
    quote:
      "At first, it's easier for your child to eat mashed, pureed, or strained foods that are very smooth in texture.",
    sources: ['CDC-solids'],
    archiveNote: SOLIDS_ARCHIVE,
  },
  '9-12': {
    hint: 'thicker and more lumpy foods; soft food cut into small pieces',
    quote:
      "You can introduce thicker and more lumpy foods as your baby's ability to eat develops. ... Cut soft food into small pieces or thin slices.",
    sources: ['CDC-solids'],
    archiveNote: SOLIDS_ARCHIVE,
  },
  '12-23': {
    hint: 'soft and mashed, or bite-sized',
    quote: 'At first, foods may need to be soft and mashed or bite-sized.',
    sources: ['CDC-encourage'],
    archiveNote: ENCOURAGE_ARCHIVE,
  },
  '24-36': {
    hint: 'foods that match eating skills, soft and mashed or bite-sized at first',
    quote:
      "It is important to provide foods that match your child's eating skills. At first, foods may need to be soft and mashed or bite-sized.",
    sources: ['CDC-encourage'],
    archiveNote: ENCOURAGE_ARCHIVE,
  },
};

/**
 * New-food spacing: wait at least 3 days between introducing new single-
 * ingredient foods (AAP "Starting Solid Foods": "Introduce one single-ingredient
 * new food ... every 3 to 5 days"). The plan module (task 10) imports this;
 * the source citation lives here with the rules.
 */
export const NEW_FOOD_SPACING_DAYS = 3;
export const NEW_FOOD_SPACING_SOURCES: SourceId[] = ['AAP-solid-foods'];

// Block rules (ghosts). Transcribed verbatim from design.md "Block rules".
const BLOCK_RULES: SafetyRule[] = [
  {
    id: 'honey',
    kind: 'block',
    terms: ['honey'],
    underMonths: 12,
    label: 'Honey',
    message: 'Honey can cause infant botulism, even baked into food.',
    sources: ['AAP-honey'],
  },
  {
    id: 'juice',
    kind: 'block',
    terms: ['juice'],
    except: ['lemon', 'lime'],
    underMonths: 12,
    label: 'Fruit juice',
    message: 'No fruit juice before 12 months.',
    sources: ['AAP-juice'],
  },
  {
    id: 'added-sugar',
    kind: 'block',
    terms: ['sugar', 'brown sugar', 'maple syrup', 'corn syrup', 'agave', 'molasses', 'syrup'],
    except: ['snap'],
    underMonths: 24,
    label: 'Added sugar',
    message: 'No added sugar before 2 years.',
    sources: ['AAP-sugar', 'WHO-2023'],
  },
  {
    id: 'sweeteners',
    kind: 'block',
    terms: ['stevia', 'sucralose', 'aspartame', 'saccharin', 'sweetener'],
    underMonths: 24,
    label: 'Sugar substitutes',
    message: 'No sugar substitutes for babies.',
    sources: ['WHO-2023'],
  },
  {
    id: 'added-salt',
    kind: 'block',
    terms: ['salt', 'salted', 'soy sauce', 'fish sauce', 'bouillon', 'stock cube'],
    underMonths: 24,
    label: 'Added salt',
    message: "Don't add salt or salty sauces to baby food.",
    sources: ['WHO-2023'],
  },
  {
    id: 'high-mercury-fish',
    kind: 'block',
    terms: ['shark', 'swordfish', 'king mackerel', 'bigeye tuna', 'marlin', 'orange roughy', 'tilefish'],
    label: 'High-mercury fish',
    message: 'High in mercury. Choose lower-mercury fish.',
    sources: ['FDA-EPA-fish'],
  },
  {
    id: 'unpasteurized',
    kind: 'block',
    terms: ['raw milk', 'unpasteurized'],
    label: 'Unpasteurized',
    message: 'Only pasteurized milk and cheese.',
    sources: ['FDA-raw-milk'],
  },
  {
    id: 'choking-no-safe-form',
    kind: 'block',
    terms: ['popcorn', 'hard candy', 'chewing gum', 'gum', 'marshmallow'],
    except: ['xanthan', 'guar'],
    underMonths: 48,
    label: 'Choking hazard',
    message: 'Choking hazard with no safe form for babies.',
    sources: ['AAP-choking', 'CDC-choking', 'HHS-CFOC'],
  },
];

// Prep reminders (never block). Transcribed verbatim from design.md.
const REMINDER_RULES: SafetyRule[] = [
  {
    id: 'grapes',
    kind: 'reminder',
    terms: ['grape', 'grape tomato'],
    underMonths: 48,
    label: 'Grapes',
    message: 'Quarter lengthwise before serving.',
    sources: ['AAP-choking', 'CDC-choking'],
  },
  {
    id: 'cherry-tomato',
    kind: 'reminder',
    terms: ['cherry tomato'],
    underMonths: 48,
    label: 'Cherry tomatoes',
    message: 'Quarter lengthwise before serving.',
    sources: ['CDC-choking'],
  },
  {
    id: 'cherries',
    kind: 'reminder',
    terms: ['cherry'],
    except: ['tomato'],
    underMonths: 48,
    label: 'Cherries',
    message: 'Remove pits and cut into small pieces.',
    sources: ['CDC-choking'],
  },
  {
    id: 'small-round-fruit',
    kind: 'reminder',
    terms: ['blueberry', 'raspberry', 'olive'],
    underMonths: 48,
    label: 'Small round fruit',
    message: 'Flatten or cut into small pieces.',
    sources: ['CDC-choking'],
  },
  {
    id: 'sausages',
    kind: 'reminder',
    terms: ['hot dog', 'sausage'],
    underMonths: 48,
    label: 'Sausages',
    message: 'Cut lengthwise into strips, then into small pieces.',
    sources: ['AAP-choking'],
  },
  {
    id: 'whole-nuts',
    kind: 'reminder',
    terms: ['peanut', 'almond', 'cashew', 'walnut', 'pecan', 'hazelnut', 'pistachio', 'macadamia', 'brazil nut', 'pine nut'],
    except: ['butter', 'flour', 'meal', 'powder', 'ground', 'milk'],
    underMonths: 48,
    label: 'Whole nuts',
    message: 'Only finely ground or mixed into food. Never whole or in pieces.',
    sources: ['AAP-choking'],
  },
  {
    id: 'nut-seed-butter',
    kind: 'reminder',
    terms: ['peanut butter', 'almond butter', 'cashew butter', 'sunflower seed butter', 'tahini'],
    underMonths: 48,
    label: 'Nut or seed butter',
    message: 'Thin with water, breast milk or formula, or spread thinly. Never a spoonful.',
    sources: ['AAP-allergens', 'CDC-choking'],
  },
  {
    id: 'hard-produce',
    kind: 'reminder',
    terms: ['carrot', 'apple', 'celery'],
    except: ['sauce', 'juice'],
    underMonths: 48,
    label: 'Hard produce',
    message: 'Cook until soft or grate finely.',
    sources: ['CDC-choking'],
  },
  {
    id: 'dried-fruit',
    kind: 'reminder',
    terms: ['raisin', 'prune', 'dried fruit', 'dried apricot', 'dried mango', 'dried fig'],
    underMonths: 48,
    label: 'Dried fruit',
    message: 'Chop finely or soak until soft.',
    sources: ['CDC-choking'],
  },
  {
    id: 'cheese',
    kind: 'reminder',
    terms: ['cheese'],
    underMonths: 48,
    label: 'Cheese',
    message: 'Grate or slice thinly. Use pasteurized cheese.',
    sources: ['CDC-choking'],
  },
  {
    id: 'eggs-cooked',
    kind: 'reminder',
    terms: ['egg'],
    label: 'Cook eggs through',
    message: 'Cook until white and yolk are firm.',
    sources: ['FDA-safe-food-handling'],
  },
  {
    id: 'cook-through',
    kind: 'reminder',
    terms: ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'fish', 'salmon', 'cod', 'trout', 'tilapia', 'shrimp'],
    label: 'Cook meat through',
    message: 'Cook through and remove all bones.',
    sources: ['FDA-safe-food-handling'],
  },
  {
    id: 'cows-milk',
    kind: 'reminder',
    terms: ['milk'],
    except: ['breast', 'formula'],
    underMonths: 12,
    label: "Cow's milk",
    message: 'Fine in cooking. Before 12 months, breast milk or formula should be the main drink.',
    sources: ['AAP-milk'],
  },
  {
    // Active spec Requirement 13.7: 100% juice limit for toddlers. AAP-juice is
    // the source already used for the under-12-month juice block.
    id: 'juice-limit',
    kind: 'reminder',
    terms: ['juice'],
    except: ['lemon', 'lime'],
    fromMonths: 12,
    underMonths: 36,
    label: 'Juice',
    message: '100% juice only, no more than 4 ounces a day.',
    sources: ['AAP-juice'],
  },
];

// Allergen rules (mystery doors, never block). Transcribed verbatim from
// design.md "Allergen rules". All cite AAP-allergens and NIAID-peanut.
const ALLERGEN_SOURCES: SourceId[] = ['AAP-allergens', 'NIAID-peanut'];

interface AllergenSpec {
  group: AllergenGroup;
  terms: string[];
  except?: string[];
}

const ALLERGEN_SPECS: AllergenSpec[] = [
  { group: 'peanut', terms: ['peanut'] },
  { group: 'egg', terms: ['egg'] },
  {
    group: 'dairy',
    terms: ['milk', 'buttermilk', 'yogurt', 'yoghurt', 'cheese', 'butter', 'cream', 'ricotta', 'kefir', 'ghee'],
    except: ['breast', 'formula', 'peanut', 'almond', 'cashew', 'nut', 'seed', 'sunflower', 'apple', 'coconut', 'oat', 'soy', 'rice'],
  },
  {
    group: 'tree nuts',
    terms: ['almond', 'cashew', 'walnut', 'pecan', 'hazelnut', 'pistachio', 'macadamia', 'brazil nut', 'pine nut'],
  },
  { group: 'soy', terms: ['soy', 'soya', 'tofu', 'edamame', 'tempeh', 'miso'] },
  {
    group: 'wheat',
    terms: ['wheat', 'flour', 'bread', 'pasta', 'couscous', 'semolina', 'noodle', 'breadcrumb', 'cracker', 'macaroni', 'penne'],
    except: ['almond', 'oat', 'rice', 'coconut', 'chickpea', 'corn', 'buckwheat'],
  },
  {
    group: 'fish',
    terms: ['fish', 'salmon', 'cod', 'tuna', 'tilapia', 'haddock', 'pollock', 'sardine', 'trout', 'halibut', 'catfish', 'whitefish', 'mackerel', 'anchovy', 'herring', 'flounder'],
  },
  { group: 'shellfish', terms: ['shrimp', 'prawn', 'crab', 'lobster', 'crawfish', 'crayfish'] },
  { group: 'sesame', terms: ['sesame', 'tahini'] },
];

const ALLERGEN_RULES: SafetyRule[] = ALLERGEN_SPECS.map((spec) => ({
  id: `allergen-${spec.group.replace(/\s+/g, '-')}`,
  kind: 'allergen' as const,
  terms: spec.terms,
  except: spec.except,
  allergenGroup: spec.group,
  label: spec.group,
  message: `Common allergen: ${spec.group}. Introduce one at a time and watch for a reaction.`,
  sources: ALLERGEN_SOURCES,
}));

/** The complete, ordered rule list used by the screen. */
export const RULES: SafetyRule[] = [...BLOCK_RULES, ...REMINDER_RULES, ...ALLERGEN_RULES];

/** A representative blocked food surfaced from a BLOCK rule (for the Foods page). */
export interface BlockRuleFood {
  /** The food key, a plain lowercase term the safety screen also matches. */
  key: string;
  /** The rule's short label (e.g. "Honey"). */
  label: string;
  /** The rule's plain-language reason. */
  message: string;
  /** Age (months) under which the block applies, or undefined for no age limit. */
  underMonths?: number;
}

/**
 * One representative blocked food per BLOCK rule, derived from the rule's FIRST
 * term (Requirement 5.7: the child's blocked foods must be visible even when no
 * recipe uses them). The first term is a lowercase, singular food word that the
 * safety screen matches back to the SAME block rule, so the Foods page can list
 * it as a ghost with the rule's reason and available-at age.
 *
 * This reads the existing BLOCK_RULES; it does NOT change the RULES table, the
 * matching, or RULESET_VERSION.
 */
export function blockRuleFoods(): BlockRuleFood[] {
  return BLOCK_RULES.map((rule) => ({
    key: rule.terms[0],
    label: rule.label,
    message: rule.message,
    underMonths: rule.underMonths,
  }));
}

// Allergen-door guidance (Requirement 7.7). Per design.md ("Foods and first
// tastes": "Allergen door guidance text (Requirement 7.7) lives next to the
// rules and cites AAP-allergens and NIAID-peanut") this HEALTH wording lives
// next to the rule table so its single source of truth is here.
//
// autonomy.md ("do not invent new health/safety wording"): the two strings
// below are taken DIRECTLY from Requirement 7.7, which states the substance
// verbatim enough to use: every allergen door shows "introduce one at a time,
// keep offering it regularly once tolerated, and serve it in a safe form", and
// "The peanut door SHALL also say to ask a pediatrician first if the baby has
// severe eczema or an egg allergy." No extra medical guidance is added.

/** Shape of the guidance shown on an allergen door (Requirement 7.7). */
export interface AllergenGuidance {
  /** Generic guidance shown on every allergen door. */
  generic: string;
  /** Extra note shown only on the peanut door, or undefined otherwise. */
  peanutNote?: string;
  /** Published sources cited by the guidance. */
  sources: SourceId[];
}

/**
 * Generic allergen-door guidance shown for every one of the nine groups
 * (Requirement 7.7, verbatim substance). Cites AAP-allergens and NIAID-peanut.
 */
export const ALLERGEN_GENERIC_GUIDANCE =
  'Introduce one at a time, keep offering it regularly once tolerated, and serve it in a safe form.';

/**
 * Extra note shown only on the peanut door (Requirement 7.7, verbatim
 * substance). Cites NIAID-peanut (and AAP-allergens).
 */
export const ALLERGEN_PEANUT_NOTE =
  'For peanut, ask a pediatrician first if the baby has severe eczema or an egg allergy.';

/**
 * Guidance for a given allergen group: the generic text for all nine groups,
 * plus the peanut-only addendum for the `peanut` group (Requirement 7.7). The
 * cited sources are the same AAP-allergens and NIAID-peanut the allergen rules
 * carry.
 */
export function allergenGuidance(group: AllergenGroup): AllergenGuidance {
  return {
    generic: ALLERGEN_GENERIC_GUIDANCE,
    peanutNote: group === 'peanut' ? ALLERGEN_PEANUT_NOTE : undefined,
    sources: ALLERGEN_SOURCES,
  };
}

/**
 * Bumped whenever the rules change (steering/safety-rules.md). Share links
 * carry this so a viewer can tell their rules differ from the link's.
 */
export const RULESET_VERSION = 4;
