import { describe, expect, it } from 'vitest';
import type { AllergenGroup, GroceryCategory, MealType, StageId } from '../domain/types';
import { STAGE_IDS, STAGE_MIN_MONTHS } from '../domain/age';
import { screenRecipe } from '../domain/safety/screen';
import { BUILTIN_RECIPES, INFANT_PORTION_OZ, RECIPES, estimateServings } from './recipes';
import { BATCH_2_RECIPES } from './recipesBatch2';
import { SIMPLE_IDEAS } from './simpleIdeas';
import sourcesDoc from '../../docs/recipe-sources.md?raw';

// ---------------------------------------------------------------------------
// COVERAGE SCOPE
// ---------------------------------------------------------------------------
// Batch 2 (task 14.3) closed the allergen gap: all nine allergen groups are now
// covered and proven by the real screen. The full Requirement 14 targets (100
// built-ins, 15 for 6-8, 25 for each other stage) are still being worked toward
// in later batches, so the stage floors below are the counts reached so far.
//
// The invariant tests (no blocks at a stage's youngest age, valid categories,
// complete source fields, sourced storage times) apply to every shipped recipe.

/** Youngest age in months for each tagged stage. */
const YOUNGEST_AGE: Record<StageId, number> = STAGE_MIN_MONTHS;

const VALID_CATEGORIES: GroceryCategory[] = [
  'produce',
  'dairy-eggs',
  'protein',
  'grains',
  'pantry',
  'frozen',
  'other',
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** All nine allergen groups the built-in set must cover. */
const EXPECTED_ALLERGEN_GROUPS: AllergenGroup[] = [
  'dairy',
  'egg',
  'wheat',
  'peanut',
  'tree nuts',
  'soy',
  'fish',
  'shellfish',
  'sesame',
];

/** Union of allergen groups across the whole set, proven via the real screen. */
function coveredAllergenGroups(): Set<AllergenGroup> {
  const groups = new Set<AllergenGroup>();
  for (const recipe of BUILTIN_RECIPES) {
    // 12 months does not suppress any allergen rule, so it reveals every group.
    for (const finding of screenRecipe(recipe, 12).allergens) {
      groups.add(finding.label as AllergenGroup);
    }
  }
  return groups;
}

describe('BUILTIN_RECIPES - invariants (every shipped recipe)', () => {
  it('ships at least one recipe', () => {
    expect(BUILTIN_RECIPES.length).toBeGreaterThan(0);
  });

  it('every recipe is built-in with a unique id', () => {
    const ids = BUILTIN_RECIPES.map((r) => r.id);
    for (const recipe of BUILTIN_RECIPES) {
      expect(recipe.origin).toBe('builtin');
      expect(recipe.id.startsWith('b-')).toBe(true);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every recipe has complete source fields (publisher, url, retrieved date)', () => {
    for (const recipe of BUILTIN_RECIPES) {
      const source = recipe.source;
      expect(source, `${recipe.id} must have a source`).toBeDefined();
      if (!source) continue;
      expect(source.title.trim().length, `${recipe.id} source title`).toBeGreaterThan(0);
      expect(source.publisher.trim().length, `${recipe.id} source publisher`).toBeGreaterThan(0);
      expect(source.url.trim().length, `${recipe.id} source url`).toBeGreaterThan(0);
      expect(source.url.startsWith('http'), `${recipe.id} source url is a URL`).toBe(true);
      expect(source.retrieved, `${recipe.id} retrieved date format`).toMatch(DATE_RE);
      expect(Array.isArray(source.adaptations), `${recipe.id} adaptations array`).toBe(true);
    }
  });

  it('every ingredient has a valid grocery category', () => {
    for (const recipe of BUILTIN_RECIPES) {
      expect(recipe.ingredients.length, `${recipe.id} has ingredients`).toBeGreaterThan(0);
      for (const ingredient of recipe.ingredients) {
        expect(
          VALID_CATEGORIES,
          `${recipe.id} ingredient "${ingredient.name}" category`,
        ).toContain(ingredient.category);
      }
    }
  });

  it('every recipe has steps, a texture and a positive serving count', () => {
    for (const recipe of BUILTIN_RECIPES) {
      expect(recipe.steps.length, `${recipe.id} has steps`).toBeGreaterThan(0);
      expect(recipe.texture.trim().length, `${recipe.id} has a texture`).toBeGreaterThan(0);
      expect(recipe.servings, `${recipe.id} servings`).toBeGreaterThan(0);
    }
  });

  it('has NO block findings at the youngest age of every tagged stage', () => {
    for (const recipe of BUILTIN_RECIPES) {
      expect(recipe.stages.length, `${recipe.id} is tagged with a stage`).toBeGreaterThan(0);
      for (const stage of recipe.stages) {
        const age = YOUNGEST_AGE[stage];
        const blocks = screenRecipe(recipe, age).blocks;
        expect(
          blocks.map((b) => b.ruleId),
          `${recipe.id} must have zero blocks at ${age} months (stage ${stage})`,
        ).toEqual([]);
      }
    }
  });

  it('covers all four stages (6-8, 9-12, 12-23, 24-36) in the youngest-age table', () => {
    expect(Object.keys(YOUNGEST_AGE).sort()).toEqual([...STAGE_IDS].sort());
    expect(YOUNGEST_AGE['12-23']).toBe(12);
    expect(YOUNGEST_AGE['24-36']).toBe(24);
  });

  it('the stage invariant applies at 12 and 24 months: honey blocks at 9 but not at 12', () => {
    const honey = { ...BUILTIN_RECIPES[0], ingredients: [{ name: 'honey', category: 'pantry' as const }] };
    expect(screenRecipe(honey, YOUNGEST_AGE['9-12']).blocks.length).toBeGreaterThan(0);
    expect(screenRecipe(honey, YOUNGEST_AGE['12-23']).blocks).toEqual([]);
    expect(screenRecipe(honey, YOUNGEST_AGE['24-36']).blocks).toEqual([]);
  });

  it('any recipe that sets storage times records a storage source', () => {
    for (const recipe of BUILTIN_RECIPES) {
      const setsStorage =
        recipe.storage?.fridgeDays !== undefined || recipe.storage?.freezerMonths !== undefined;
      if (!setsStorage) continue;
      expect(
        recipe.source?.storageSource && recipe.source.storageSource.trim().length > 0,
        `${recipe.id} sets storage times, so it must cite a storageSource`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// SERVINGS (maintainer Option A, issue #9)
// ---------------------------------------------------------------------------
// The source gives no yield for the baby-food recipes, so servings are ESTIMATED
// deterministically: servings = max(1, round(totalYieldOz / 2 oz portion)). This
// table recomputes each recipe's servings from the SAME documented YIELD_OZ used
// in the data-file comments (see the SERVINGS block in recipes.ts for the oz
// conversion table), so the pinned serving numbers cannot silently drift. The one
// recipe with a source-stated yield (Cereal Pancakes: "about twelve 4\" pancakes")
// uses that source yield directly and is NOT marked as an estimate.

/** Expected serving derivation per recipe id. */
type ServingsExpectation =
  | { kind: 'estimate'; yieldOz: number }
  | { kind: 'source'; servings: number };

const SERVINGS_BY_ID: Record<string, ServingsExpectation> = {
  'b-carrots-and-apples': { kind: 'estimate', yieldOz: 15 },
  'b-sweet-potato-chicken': { kind: 'estimate', yieldOz: 15 },
  'b-beef-peas-potatoes': { kind: 'estimate', yieldOz: 24 },
  'b-chicken-broccoli-rice': { kind: 'estimate', yieldOz: 24 },
  'b-beef-squash-macaroni': { kind: 'estimate', yieldOz: 24 },
  'b-cereal-pancakes': { kind: 'source', servings: 12 },
  'b-apple-rice-pudding': { kind: 'estimate', yieldOz: 24 },
  'b-meat-balls': { kind: 'estimate', yieldOz: 37 },
  'b-spinach-apple-puffs': { kind: 'estimate', yieldOz: 19.5 },
  'b-sweet-potato-puffs': { kind: 'estimate', yieldOz: 12.5 },
};

const SERVINGS_ESTIMATE_NOTE =
  'Serving count is an estimate (source gives no yield): total cooked yield \u00f7 a 2 oz infant portion.';

describe('BUILTIN_RECIPES - servings (Option A deterministic estimate, issue #9)', () => {
  it('estimateServings rounds total yield to whole 2 oz portions, minimum 1', () => {
    expect(INFANT_PORTION_OZ).toBe(2);
    expect(estimateServings(0)).toBe(1); // never below 1
    expect(estimateServings(1)).toBe(1); // round(0.5) = 1 (Math.round rounds halves up)
    expect(estimateServings(15)).toBe(8); // round(7.5) = 8
    expect(estimateServings(24)).toBe(12);
    expect(estimateServings(37)).toBe(19); // round(18.5) = 19
    expect(estimateServings(12.5)).toBe(6); // round(6.25) = 6
  });

  it('every recipe has a pinned servings expectation', () => {
    const expected = new Set(Object.keys(SERVINGS_BY_ID));
    const actual = new Set(RECIPES.map((r) => r.id));
    expect(actual).toEqual(expected);
  });

  it('each recipe servings matches the rule (or the source yield) and cannot drift', () => {
    for (const recipe of RECIPES) {
      const expectation = SERVINGS_BY_ID[recipe.id];
      expect(expectation, `${recipe.id} must have a servings expectation`).toBeDefined();
      if (!expectation) continue;

      if (expectation.kind === 'source') {
        // Source states the yield -> use it verbatim, and do NOT flag an estimate.
        expect(recipe.servings, `${recipe.id} uses the source yield`).toBe(expectation.servings);
        expect(
          recipe.source?.adaptations ?? [],
          `${recipe.id} source yield must NOT be marked an estimate`,
        ).not.toContain(SERVINGS_ESTIMATE_NOTE);
      } else {
        // No source yield -> deterministic estimate, flagged in adaptations.
        expect(recipe.servings, `${recipe.id} servings = estimate from yieldOz`).toBe(
          estimateServings(expectation.yieldOz),
        );
        expect(
          recipe.source?.adaptations ?? [],
          `${recipe.id} estimated servings must be disclosed in adaptations`,
        ).toContain(SERVINGS_ESTIMATE_NOTE);
      }
    }
  });
});

describe('BUILTIN_RECIPES - coverage', () => {
  it('ships the 10 sourced WIC recipes, 1 to 25 simple ideas and the 20 batch 2 recipes', () => {
    expect(RECIPES.length).toBe(10);
    expect(SIMPLE_IDEAS.length).toBeGreaterThanOrEqual(1);
    expect(SIMPLE_IDEAS.length).toBeLessThanOrEqual(25);
    expect(BATCH_2_RECIPES.length).toBe(20);
    expect(BUILTIN_RECIPES.length).toBe(
      RECIPES.length + SIMPLE_IDEAS.length + BATCH_2_RECIPES.length,
    );
  });

  it('represents both stages (6-8 and 9-12)', () => {
    const stages = new Set<StageId>();
    for (const recipe of BUILTIN_RECIPES) {
      for (const stage of recipe.stages) stages.add(stage);
    }
    expect(stages.has('6-8')).toBe(true);
    expect(stages.has('9-12')).toBe(true);
  });

  it('covers the meal types these sources support (breakfast, lunch, dinner, snack)', () => {
    const mealTypes = new Set<MealType>();
    for (const recipe of BUILTIN_RECIPES) {
      for (const meal of recipe.mealTypes) mealTypes.add(meal);
    }
    // The Minnesota WIC pages genuinely support all four meal types in this batch.
    expect(mealTypes.has('breakfast')).toBe(true);
    expect(mealTypes.has('lunch')).toBe(true);
    expect(mealTypes.has('dinner')).toBe(true);
    expect(mealTypes.has('snack')).toBe(true);
  });

  it('covers all nine allergen groups (proven by the real screen)', () => {
    const covered = coveredAllergenGroups();
    expect(EXPECTED_ALLERGEN_GROUPS.length).toBe(9);
    for (const group of EXPECTED_ALLERGEN_GROUPS) {
      expect(covered.has(group), `built-ins should cover allergen group "${group}"`).toBe(true);
    }
  });

  it('batch 2 alone covers the six groups batch 1 lacked', () => {
    const covered = new Set<string>();
    for (const recipe of BATCH_2_RECIPES) {
      for (const finding of screenRecipe(recipe, 12).allergens) covered.add(finding.label);
    }
    for (const group of ['peanut', 'tree nuts', 'soy', 'fish', 'shellfish', 'sesame']) {
      expect(covered.has(group), group).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Batch 1 (task 14.2): toddler tags, serveAs, simple ideas
// ---------------------------------------------------------------------------
const WIC_TAGS: Record<string, { stages: StageId[]; serveAs: string[] }> = {
  'b-beef-peas-potatoes': { stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'] },
  'b-chicken-broccoli-rice': { stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'] },
  'b-beef-squash-macaroni': { stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'] },
  'b-carrots-and-apples': { stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'] },
  'b-sweet-potato-chicken': { stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'] },
  'b-apple-rice-pudding': { stages: ['6-8', '9-12'], serveAs: ['puree'] },
  'b-cereal-pancakes': { stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'] },
  'b-meat-balls': { stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food', 'pieces'] },
  'b-spinach-apple-puffs': { stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'] },
  'b-sweet-potato-puffs': { stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'] },
};

describe('BUILTIN_RECIPES - batch 1', () => {
  it('every built-in has at least one serveAs', () => {
    for (const recipe of BUILTIN_RECIPES) {
      expect(recipe.serveAs?.length ?? 0, `${recipe.id} serveAs`).toBeGreaterThan(0);
    }
  });

  it('the 10 WIC recipes have the decided stages and serveAs', () => {
    expect(Object.keys(WIC_TAGS).sort()).toEqual(RECIPES.map((r) => r.id).sort());
    for (const recipe of RECIPES) {
      expect(recipe.stages, `${recipe.id} stages`).toEqual(WIC_TAGS[recipe.id].stages);
      expect(recipe.serveAs, `${recipe.id} serveAs`).toEqual(WIC_TAGS[recipe.id].serveAs);
    }
  });

  it('simple ideas are simple-idea kind, built-in, have no quantities and 1 to 2 foods', () => {
    for (const idea of SIMPLE_IDEAS) {
      expect(idea.kind, idea.id).toBe('simple-idea');
      expect(idea.id.startsWith('b-idea-'), idea.id).toBe(true);
      expect(idea.ingredients.length, idea.id).toBeGreaterThanOrEqual(1);
      expect(idea.ingredients.length, idea.id).toBeLessThanOrEqual(2);
      expect(idea.steps.length, idea.id).toBeLessThanOrEqual(3);
      expect(idea.servings, idea.id).toBe(1);
      for (const ing of idea.ingredients) {
        expect(ing.quantity, `${idea.id} ${ing.name}`).toBeUndefined();
      }
    }
  });

  it('full recipes keep quantities and are not simple ideas', () => {
    for (const recipe of RECIPES) {
      expect(recipe.kind).not.toBe('simple-idea');
      expect(
        recipe.ingredients.some((i) => i.quantity !== undefined),
        `${recipe.id} has quantities`,
      ).toBe(true);
    }
  });

  it('pureed or mashed only recipes and ideas are not tagged for toddler stages', () => {
    for (const idea of BUILTIN_RECIPES) {
      const softPieces = idea.serveAs?.some((s) => s === 'pieces' || s === 'finger-food');
      const toddler = idea.stages.some((s) => s === '12-23' || s === '24-36');
      if (!softPieces) expect(toddler, idea.id).toBe(false);
    }
  });

  // Maintainer decision on issue #46 (option b): the Utah 8 month items say "ground or
  // finely chopped", so they are tagged 9-12 and later only, never 6-8.
  it('tags the Utah 8 month items 9-12 and later only, not 6-8', () => {
    for (const id of [
      'b-idea-chopped-peaches',
      'b-idea-chopped-carrots',
      'b-idea-mashed-rice',
      'b-idea-ground-beef',
    ]) {
      const idea = SIMPLE_IDEAS.find((i) => i.id === id);
      expect(idea, id).toBeDefined();
      expect(idea?.stages, id).toContain('9-12');
      expect(idea?.stages, id).not.toContain('6-8');
    }
  });

  it('keeps the stage counts reached so far (batch 1 floors raised by batch 2)', () => {
    const count = (stage: StageId) => BUILTIN_RECIPES.filter((r) => r.stages.includes(stage)).length;
    expect(count('6-8')).toBeGreaterThanOrEqual(12);
    expect(count('9-12')).toBeGreaterThanOrEqual(33);
    expect(count('12-23')).toBeGreaterThanOrEqual(20);
    expect(count('24-36')).toBeGreaterThanOrEqual(25);
    const covered = coveredAllergenGroups();
    for (const group of ['dairy', 'egg', 'wheat'] as AllergenGroup[]) expect(covered.has(group)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Batch 2 (task 14.3): Food Hero, ICN and NHLBI recipes
// ---------------------------------------------------------------------------
const FH = 'Food Hero, Oregon State University Extension';
const ICN = 'Institute of Child Nutrition, Child Nutrition Recipe Box (USDA)';
const NHLBI = 'National Heart, Lung, and Blood Institute (NHLBI), National Institutes of Health';
const ESTIMATE_HALF_CUP =
  'Serving count is an estimate (source gives no servings): total yield divided by a 1/2 cup portion.';
const ESTIMATE_QUARTER_CUP =
  'Serving count is an estimate (source gives no servings): total yield divided by a 1/4 cup portion.';

interface Batch2Expectation {
  publisher: string;
  stages: StageId[];
  serveAs: string[];
  /** Allergen groups from screenRecipe(recipe, 12).allergens, sorted. */
  allergens: string[];
  servings: number;
  /** Exact adaptation note when servings are an estimate; otherwise undefined (source count). */
  estimateNote?: string;
}

const BATCH_2_EXPECTED: Record<string, Batch2Expectation> = {
  'b-fh-peanut-butter-yogurt-dip': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'peanut'], servings: 3, estimateNote: ESTIMATE_QUARTER_CUP },
  'b-fh-peanut-power-smoothie': { publisher: FH, stages: ['9-12'], serveAs: ['puree'], allergens: ['dairy', 'peanut'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-icn-fruit-nut-butter-pita-pockets': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['peanut', 'wheat'], servings: 6 },
  'b-icn-apples-and-almond-butter': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['tree nuts'], servings: 6 },
  'b-fh-almond-rice-pudding': { publisher: FH, stages: ['9-12'], serveAs: ['mashed'], allergens: ['tree nuts'], servings: 12, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-tofu-banana-pudding': { publisher: FH, stages: ['9-12'], serveAs: ['puree', 'mashed'], allergens: ['soy'], servings: 7, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-tofu-scramble': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces', 'finger-food'], allergens: ['dairy', 'soy'], servings: 10, estimateNote: ESTIMATE_HALF_CUP },
  'b-icn-baked-tofu-bites': { publisher: ICN, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['soy', 'wheat'], servings: 6 },
  'b-fh-salmon-patties': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food', 'pieces'], allergens: ['egg', 'fish', 'wheat'], servings: 4 },
  'b-fh-crispy-parmesan-baked-fish': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['finger-food', 'pieces'], allergens: ['dairy', 'fish', 'wheat'], servings: 8 },
  'b-fh-tuna-quesadillas': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'fish', 'wheat'], servings: 4 },
  'b-nhlbi-fresh-lumpia': { publisher: NHLBI, stages: ['24-36'], serveAs: ['pieces'], allergens: ['shellfish', 'soy'], servings: 8 },
  'b-icn-sweet-potato-hummus': { publisher: ICN, stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'], allergens: ['sesame'], servings: 6 },
  'b-fh-sesame-broccoli': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['sesame', 'soy'], servings: 4, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-hummus-no-tahini': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_QUARTER_CUP },
  'b-fh-banana-oatmeal-muffins': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 12 },
  'b-icn-spiral-pasta-and-broccoli': { publisher: ICN, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces', 'finger-food'], allergens: ['dairy', 'wheat'], servings: 6 },
  'b-icn-roasted-sweet-potato-hash': { publisher: ICN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-icn-breakfast-black-beans-with-eggs': { publisher: ICN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['egg'], servings: 6 },
  'b-icn-egg-and-broccoli-scramble': { publisher: ICN, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg'], servings: 6 },
};

/** Hosts a batch 2 source URL may come from. */
const ALLOWED_HOSTS = ['foodhero.org', 'theicn.org', 'www.nhlbi.nih.gov'];

/** Ingredients the sources list but that were left out; the adaptation must say so. */
const LEFT_OUT: Record<string, { adaptation: string; absent: RegExp }[]> = {
  'b-fh-almond-rice-pudding': [
    { adaptation: 'Left out 1/4 cup sugar', absent: /sugar/i },
    { adaptation: 'Left out optional 1/4 cup toasted almonds', absent: /almonds/i },
  ],
  'b-fh-tofu-banana-pudding': [{ adaptation: 'Left out 2 Tbsp sugar', absent: /sugar/i }],
  'b-fh-tofu-scramble': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-nhlbi-fresh-lumpia': [{ adaptation: 'Left out 1/3 C dry roasted peanuts', absent: /peanut/i }],
  'b-icn-sweet-potato-hummus': [{ adaptation: 'Left out 1/4 tsp salt', absent: /\bsalt\b/i }],
  'b-fh-banana-oatmeal-muffins': [
    { adaptation: 'Left out 1/2 cup sugar', absent: /sugar/i },
    { adaptation: 'Left out 1/4 tsp salt', absent: /\bsalt\b/i },
  ],
  'b-icn-roasted-sweet-potato-hash': [{ adaptation: 'Left out 1/4 tsp salt', absent: /\bsalt\b/i }],
  'b-icn-breakfast-black-beans-with-eggs': [{ adaptation: 'Left out 1/2 tsp salt', absent: /\bsalt\b/i }],
  'b-icn-egg-and-broccoli-scramble': [{ adaptation: 'Left out 1/8 tsp salt', absent: /\bsalt\b/i }],
};

describe('BUILTIN_RECIPES - batch 2', () => {
  it('has a pinned expectation for exactly the 20 batch 2 recipes', () => {
    expect(BATCH_2_RECIPES.map((r) => r.id).sort()).toEqual(Object.keys(BATCH_2_EXPECTED).sort());
  });

  it('built-in ids are unique across all sets', () => {
    const ids = BUILTIN_RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every batch 2 recipe is a full recipe with serveAs and at least one quantity', () => {
    for (const recipe of BATCH_2_RECIPES) {
      expect(recipe.origin, recipe.id).toBe('builtin');
      expect(recipe.kind, recipe.id).not.toBe('simple-idea');
      expect(recipe.serveAs?.length ?? 0, `${recipe.id} serveAs`).toBeGreaterThan(0);
      expect(
        recipe.ingredients.some((i) => i.quantity !== undefined),
        `${recipe.id} has a quantity`,
      ).toBe(true);
      expect(recipe.storage, `${recipe.id} sets no unsourced storage`).toBeUndefined();
    }
  });

  it('every batch 2 source is on an allowed host and a listed publisher', () => {
    for (const recipe of BATCH_2_RECIPES) {
      const source = recipe.source;
      expect(source, recipe.id).toBeDefined();
      if (!source) continue;
      const url = new URL(source.url);
      expect(url.protocol, recipe.id).toBe('https:');
      expect(ALLOWED_HOSTS, `${recipe.id} host ${url.hostname}`).toContain(url.hostname);
      expect(sourcesDoc, `${recipe.id} publisher is in docs/recipe-sources.md`).toContain(source.publisher);
      expect(source.retrieved, recipe.id).toBe('2026-11-10');
    }
  });

  it('pins publisher, stages, serveAs and servings for each recipe', () => {
    for (const recipe of BATCH_2_RECIPES) {
      const expected = BATCH_2_EXPECTED[recipe.id];
      expect(recipe.source?.publisher, `${recipe.id} publisher`).toBe(expected.publisher);
      expect(recipe.stages, `${recipe.id} stages`).toEqual(expected.stages);
      expect(recipe.serveAs, `${recipe.id} serveAs`).toEqual(expected.serveAs);
      expect(recipe.servings, `${recipe.id} servings`).toBe(expected.servings);
    }
  });

  it('flags estimated servings in adaptations and does not flag source counts', () => {
    for (const recipe of BATCH_2_RECIPES) {
      const expected = BATCH_2_EXPECTED[recipe.id];
      const adaptations = recipe.source?.adaptations ?? [];
      const estimates = adaptations.filter((a) => a.startsWith('Serving count is an estimate'));
      if (expected.estimateNote) expect(estimates, recipe.id).toEqual([expected.estimateNote]);
      else expect(estimates, recipe.id).toEqual([]);
    }
  });

  it('pins the allergen groups of each recipe from the real screen', () => {
    for (const recipe of BATCH_2_RECIPES) {
      const groups = [...new Set(screenRecipe(recipe, 12).allergens.map((f) => f.label))].sort();
      expect(groups, `${recipe.id} allergen groups`).toEqual(BATCH_2_EXPECTED[recipe.id].allergens);
    }
  });

  it('recipes with a blocked-at-24-months ingredient are tagged 24-36 only', () => {
    for (const recipe of BATCH_2_RECIPES) {
      const blocksAt12 = screenRecipe(recipe, 12).blocks.length > 0;
      const blocksAt24 = screenRecipe(recipe, 24).blocks.length > 0;
      expect(blocksAt24, `${recipe.id} is safe at 24 months`).toBe(false);
      if (blocksAt12) expect(recipe.stages, recipe.id).toEqual(['24-36']);
    }
  });

  it('tagged stages younger than 24 months contain no salt, sugar, soy sauce or honey', () => {
    for (const recipe of BATCH_2_RECIPES) {
      if (!recipe.stages.some((s) => s !== '24-36')) continue;
      for (const ingredient of recipe.ingredients) {
        expect(ingredient.name, `${recipe.id} ingredient`).not.toMatch(
          /\b(salt|sugar|soy sauce|honey)\b/i,
        );
      }
    }
  });

  it('recipes tagged 6-8 or 9-12 contain no juice other than lemon or lime', () => {
    for (const recipe of BATCH_2_RECIPES) {
      if (!recipe.stages.some((s) => s === '6-8' || s === '9-12')) continue;
      for (const ingredient of recipe.ingredients) {
        const name = ingredient.name.toLowerCase().replace(/\b(lemon|lime) juice\b/g, '');
        expect(name, `${recipe.id} ingredient`).not.toMatch(/juice/);
      }
    }
  });

  it('every "Left out" adaptation matches an absent ingredient, and none is missing', () => {
    for (const recipe of BATCH_2_RECIPES) {
      const adaptations = recipe.source?.adaptations ?? [];
      const leftOut = adaptations.filter((a) => a.startsWith('Left out'));
      const expected = LEFT_OUT[recipe.id] ?? [];
      expect(leftOut.length, `${recipe.id} Left out adaptations`).toBe(expected.length);
      for (const item of expected) {
        expect(
          adaptations.some((a) => a.startsWith(item.adaptation)),
          `${recipe.id}: ${item.adaptation}`,
        ).toBe(true);
        for (const ingredient of recipe.ingredients) {
          expect(ingredient.name, `${recipe.id} must not contain the left-out item`).not.toMatch(
            item.absent,
          );
        }
      }
    }
  });

  it('keeps the source chef tips on the nut butter recipes', () => {
    for (const id of ['b-icn-fruit-nut-butter-pita-pockets', 'b-icn-apples-and-almond-butter']) {
      const recipe = BATCH_2_RECIPES.find((r) => r.id === id);
      expect(recipe?.stages, id).toEqual(['24-36']);
      expect(recipe?.steps.join(' '), id).toMatch(/thin layer/i);
    }
  });

  it('the puree-only recipes are not tagged for toddler stages', () => {
    for (const recipe of BATCH_2_RECIPES) {
      const softPieces = recipe.serveAs?.some((s) => s === 'pieces' || s === 'finger-food');
      if (!softPieces) {
        expect(recipe.stages.includes('12-23') || recipe.stages.includes('24-36'), recipe.id).toBe(false);
      }
    }
  });
});
