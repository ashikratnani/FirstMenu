import { describe, expect, it } from 'vitest';
import type { AllergenGroup, GroceryCategory, MealType, StageId } from '../domain/types';
import { STAGE_IDS, STAGE_MIN_MONTHS } from '../domain/age';
import { recipeEffort, type Effort } from '../domain/effort';
import { foodKeyFromName } from '../domain/foods';
import { screenRecipe } from '../domain/safety/screen';
import { BUILTIN_RECIPES, INFANT_PORTION_OZ, RECIPES, estimateServings } from './recipes';
import { BATCH_2_RECIPES } from './recipesBatch2';
import { BATCH_3_RECIPES } from './recipesBatch3';
import { BATCH_4_RECIPES } from './recipesBatch4';
import { BATCH_5_RECIPES } from './recipesBatch5';
import { BATCH_6_RECIPES } from './recipesBatch6';
import { BATCH_7_RECIPES } from './recipesBatch7';
import { BATCH_8_RECIPES } from './recipesBatch8';
import { BATCH_9_RECIPES } from './recipesBatch9';
import { BATCH_10_RECIPES } from './recipesBatch10';
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
  it('ships the 10 sourced WIC recipes, 1 to 40 simple ideas and the 20 batch 2 recipes', () => {
    expect(RECIPES.length).toBe(10);
    expect(SIMPLE_IDEAS.length).toBeGreaterThanOrEqual(1);
    expect(SIMPLE_IDEAS.length).toBeLessThanOrEqual(40);
    expect(BATCH_2_RECIPES.length).toBe(20);
    expect(BUILTIN_RECIPES.length).toBe(
      RECIPES.length +
        SIMPLE_IDEAS.length +
        BATCH_2_RECIPES.length +
        BATCH_3_RECIPES.length +
        BATCH_4_RECIPES.length +
        BATCH_5_RECIPES.length +
        BATCH_6_RECIPES.length +
        BATCH_7_RECIPES.length +
        BATCH_8_RECIPES.length +
        BATCH_9_RECIPES.length +
        BATCH_10_RECIPES.length,
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
const ALLOWED_HOSTS = [
  'foodhero.org',
  'theicn.org',
  'www.nhlbi.nih.gov',
  'seagrant.oregonstate.edu',
  'texaswic.org',
  'www.health.state.mn.us',
  'food.unl.edu',
];

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

// ---------------------------------------------------------------------------
// Batch 3 (task 14.3): Food Hero and ICN recipes aimed at the scarcest cells
// ---------------------------------------------------------------------------
interface Batch3Expectation {
  publisher: string;
  stages: StageId[];
  serveAs: string[];
  /** Allergen groups from screenRecipe(recipe, 12).allergens, sorted. */
  allergens: string[];
  servings: number;
  /** Exact adaptation note when servings are an estimate; otherwise undefined (source count). */
  estimateNote?: string;
}

const BATCH_3_EXPECTED: Record<string, Batch3Expectation> = {
  'b-fh-microwave-applesauce': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['mashed'], allergens: [], servings: 7, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-mashed-carrots': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'], allergens: ['dairy'], servings: 5, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-mashed-turnips-and-potatoes': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['mashed'], allergens: ['dairy'], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-refried-beans': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['mashed'], allergens: [], servings: 2, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-green-pea-soup': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-chunky-black-bean-dip': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'], allergens: [], servings: 12, estimateNote: ESTIMATE_QUARTER_CUP },
  'b-fh-bell-pepper-smoothie': { publisher: FH, stages: ['9-12'], serveAs: ['puree'], allergens: [], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-frozen-strawberry-yogurt': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree'], allergens: ['dairy'], servings: 7, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-spinach-garbanzo-beans': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: [], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-savory-oatmeal': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: ['dairy'], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-split-pea-soup': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: [], servings: 18, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-broccoli-cheddar-soup': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-sweet-potato-pumpkin-soup': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: ['dairy'], servings: 16, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-kale-and-white-bean-soup': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 10, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-veggie-skillet-eggs': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg'], servings: 8, estimateNote: 'Serving count is an estimate (source gives no servings): 8 wedges, 1 wedge per serving.' },
  'b-fh-baked-cauliflower-tots': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 5, estimateNote: 'Serving count is an estimate (source gives no servings): 15 tots, 3 tots per serving.' },
  'b-fh-applesauce-french-toast': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 6, estimateNote: 'Serving count is an estimate (source gives no servings): 6 slices, 1 slice per serving.' },
  'b-fh-corn-pancakes': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 6, estimateNote: 'Serving count is an estimate (source gives no servings): 6 6-inch pancakes, 1 pancake per serving.' },
  'b-fh-tofu-egg-salad': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'soy'], servings: 2, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-sauteed-zucchini': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-lentil-taco-filling': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: [], servings: 4, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-pasta-greens-and-beans': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 16, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-skillet-mac-and-cheese': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-cheesy-beef-pasta': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 16, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-stovetop-tuna-casserole': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'fish', 'wheat'], servings: 14, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-easy-skillet-chili': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 14, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-veggie-patties': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['egg', 'wheat'], servings: 7, estimateNote: 'Serving count is an estimate (source gives no servings): 14 patties, 2 patties per serving.' },
  'b-fh-favorite-pancakes-with-eggs': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 8, estimateNote: 'Serving count is an estimate (source gives no servings): 8 4-inch pancakes, 1 pancake per serving.' },
  'b-fh-carrot-pancakes': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 7, estimateNote: 'Serving count is an estimate (source gives no servings): 7 pancakes, 1 pancake per serving.' },
  'b-fh-chicken-broccoli-cheese-skillet-meal': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 14, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-skillet-corn-chowder': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-salmon-pasta-skillet': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'fish', 'wheat'], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-hearty-chicken-and-homemade-noodle-soup': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['egg', 'wheat'], servings: 20, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-mushroom-stroganoff': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 12, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-creamy-potato-leek-soup': { publisher: FH, stages: ['9-12'], serveAs: ['mashed'], allergens: ['dairy'], servings: 16, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-west-african-peanut-soup': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['peanut', 'sesame'], servings: 16, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-banana-pancakes': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 8, estimateNote: 'Serving count is an estimate (source gives no servings): 16 pancakes, 2 pancakes per serving.' },
  'b-fh-apple-spice-oatmeal': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: ['dairy'], servings: 4, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-parmesan-peas': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-icn-spinach-egg-bake': { publisher: ICN, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg'], servings: 6 },
  'b-icn-mini-meatloaf-patties': { publisher: ICN, stages: ['12-23', '24-36'], serveAs: ['finger-food', 'pieces'], allergens: ['egg'], servings: 6 },
  'b-icn-whole-wheat-pancakes': { publisher: ICN, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 6 },
  'b-icn-golden-squash-hotcakes': { publisher: ICN, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 6 },
  'b-icn-southwest-tofu-scramble': { publisher: ICN, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['soy'], servings: 6 },
  'b-icn-baked-tilapia-fish-fillets': { publisher: ICN, stages: ['12-23', '24-36'], serveAs: ['pieces', 'finger-food'], allergens: ['fish', 'wheat'], servings: 6 },
  'b-icn-fish-and-veggie-packets': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['fish'], servings: 6 },
  'b-icn-crabby-sandwich': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['shellfish'], servings: 6 },
  'b-icn-noodles-with-peanut-butter-sauce': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['peanut', 'soy', 'wheat'], servings: 6 },
  'b-icn-sauteed-tofu-and-broccoli': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['sesame', 'soy', 'wheat'], servings: 6 },
};

/** Ingredients the sources list but that were left out; the adaptation must say so. */
const BATCH_3_LEFT_OUT: Record<string, { adaptation: string; absent: RegExp }[]> = {
  'b-fh-microwave-applesauce': [{ adaptation: 'Left out 1/4 cup sugar (or less, to taste)', absent: /sugar/i }],
  'b-fh-mashed-carrots': [{ adaptation: 'Left out 2 teaspoons honey or brown sugar', absent: /honey|sugar/i }, { adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-mashed-turnips-and-potatoes': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-green-pea-soup': [{ adaptation: 'Left out 1 teaspoon chicken or vegetable bouillon', absent: /bouillon/i }],
  'b-fh-chunky-black-bean-dip': [{ adaptation: 'Left out the salt the source says to add to taste', absent: /\bsalt\b/i }],
  'b-fh-frozen-strawberry-yogurt': [{ adaptation: 'Left out 1 to 3 Tbsp sugar', absent: /sugar/i }],
  'b-fh-spinach-garbanzo-beans': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-baked-cauliflower-tots': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-applesauce-french-toast': [{ adaptation: 'Left out 2 teaspoons sugar', absent: /sugar/i }],
  'b-fh-corn-pancakes': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-tofu-egg-salad': [{ adaptation: 'Left out 1/8 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-sauteed-zucchini': [{ adaptation: 'Left out 1/8 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-lentil-taco-filling': [{ adaptation: 'Left out optional 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-pasta-greens-and-beans': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-skillet-mac-and-cheese': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-stovetop-tuna-casserole': [{ adaptation: 'Left out 1 teaspoon chicken bouillon', absent: /bouillon/i }],
  'b-fh-veggie-patties': [{ adaptation: 'Left out 1 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-favorite-pancakes-with-eggs': [{ adaptation: 'Left out 1 Tbsp sugar', absent: /sugar/i }, { adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-carrot-pancakes': [{ adaptation: 'Left out 1 Tbsp sugar', absent: /sugar/i }, { adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-salmon-pasta-skillet': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-mushroom-stroganoff': [{ adaptation: 'Left out 1 teaspoon bouillon (vegetable, beef or chicken)', absent: /bouillon/i }],
  'b-fh-banana-pancakes': [{ adaptation: 'Left out 1 Tbsp sugar', absent: /sugar/i }],
  'b-fh-apple-spice-oatmeal': [{ adaptation: 'Left out 1/8 teaspoon salt', absent: /\bsalt\b/i }, { adaptation: 'Left out 1 Tablespoon brown sugar', absent: /sugar/i }],
  'b-icn-spinach-egg-bake': [{ adaptation: 'Left out 1/8 tsp salt', absent: /\bsalt\b/i }],
  'b-icn-whole-wheat-pancakes': [{ adaptation: 'Left out 2 Tbsp sugar', absent: /sugar/i }, { adaptation: 'Left out 1/4 tsp salt', absent: /\bsalt\b/i }],
  'b-icn-golden-squash-hotcakes': [{ adaptation: 'Left out 2 tsp brown sugar', absent: /sugar/i }],
  'b-icn-southwest-tofu-scramble': [{ adaptation: 'Left out 1/2 tsp salt', absent: /\bsalt\b/i }],
};

/** Recipes that keep a salt, sugar or soy sauce ingredient because they are tagged 24-36 only. */
const KEEPS_BLOCKED_AT_24 = [
  'b-icn-fish-and-veggie-packets',
  'b-icn-noodles-with-peanut-butter-sauce',
  'b-icn-sauteed-tofu-and-broccoli',
];

describe('BUILTIN_RECIPES - batch 3', () => {
  it('has a pinned expectation for exactly the batch 3 recipes', () => {
    expect(BATCH_3_RECIPES.map((r) => r.id).sort()).toEqual(Object.keys(BATCH_3_EXPECTED).sort());
    expect(BATCH_3_RECIPES.length).toBeGreaterThanOrEqual(40);
    expect(BATCH_3_RECIPES.length).toBeLessThanOrEqual(60);
  });

  it('every batch 3 recipe is a full recipe with serveAs and at least one quantity', () => {
    for (const recipe of BATCH_3_RECIPES) {
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

  it('every batch 3 source is an https page on an allowed host and a listed publisher', () => {
    for (const recipe of BATCH_3_RECIPES) {
      const source = recipe.source;
      expect(source, recipe.id).toBeDefined();
      if (!source) continue;
      const url = new URL(source.url);
      expect(url.protocol, recipe.id).toBe('https:');
      expect(ALLOWED_HOSTS, `${recipe.id} host ${url.hostname}`).toContain(url.hostname);
      expect(sourcesDoc, `${recipe.id} publisher is in docs/recipe-sources.md`).toContain(source.publisher);
      expect(source.retrieved, recipe.id).toBe('2026-11-10');
      expect(source.title.trim().length, recipe.id).toBeGreaterThan(0);
    }
  });

  it('pins publisher, stages, serveAs and servings for each recipe', () => {
    for (const recipe of BATCH_3_RECIPES) {
      const expected = BATCH_3_EXPECTED[recipe.id];
      expect(recipe.source?.publisher, `${recipe.id} publisher`).toBe(expected.publisher);
      expect(recipe.stages, `${recipe.id} stages`).toEqual(expected.stages);
      expect(recipe.serveAs, `${recipe.id} serveAs`).toEqual(expected.serveAs);
      expect(recipe.servings, `${recipe.id} servings`).toBe(expected.servings);
    }
  });

  it('ICN recipes use the source serving count and Food Hero estimates are disclosed', () => {
    for (const recipe of BATCH_3_RECIPES) {
      const expected = BATCH_3_EXPECTED[recipe.id];
      const adaptations = recipe.source?.adaptations ?? [];
      const estimates = adaptations.filter((a) => a.startsWith('Serving count is an estimate'));
      if (expected.estimateNote) expect(estimates, recipe.id).toEqual([expected.estimateNote]);
      else expect(estimates, recipe.id).toEqual([]);
      if (expected.publisher === ICN) expect(recipe.servings, recipe.id).toBe(6);
      else expect(expected.estimateNote, `${recipe.id} Food Hero servings are estimated`).toBeDefined();
    }
  });

  it('pins the allergen groups of each recipe from the real screen', () => {
    for (const recipe of BATCH_3_RECIPES) {
      const groups = [...new Set(screenRecipe(recipe, 12).allergens.map((f) => f.label))].sort();
      expect(groups, `${recipe.id} allergen groups`).toEqual(BATCH_3_EXPECTED[recipe.id].allergens);
    }
  });

  it('no batch 3 recipe has a block at 24 months; blocked-at-12 ones are tagged 24-36 only', () => {
    for (const recipe of BATCH_3_RECIPES) {
      expect(screenRecipe(recipe, 24).blocks, `${recipe.id} is safe at 24 months`).toEqual([]);
      if (screenRecipe(recipe, 12).blocks.length > 0) {
        expect(recipe.stages, recipe.id).toEqual(['24-36']);
        expect(KEEPS_BLOCKED_AT_24, recipe.id).toContain(recipe.id);
      }
    }
  });

  it('tagged stages younger than 24 months contain no salt, sugar, soy sauce, honey or bouillon', () => {
    for (const recipe of BATCH_3_RECIPES) {
      if (!recipe.stages.some((s) => s !== '24-36')) continue;
      const text = [...recipe.ingredients.map((i) => i.name), ...recipe.steps].join(' ');
      expect(text, `${recipe.id} text`).not.toMatch(/\b(salt|sugar|soy sauce|honey|bouillon)\b/i);
    }
  });

  it('recipes tagged 6-8 or 9-12 contain no juice other than lemon or lime', () => {
    for (const recipe of BATCH_3_RECIPES) {
      if (!recipe.stages.some((s) => s === '6-8' || s === '9-12')) continue;
      for (const ingredient of recipe.ingredients) {
        const name = ingredient.name.toLowerCase().replace(/\b(lemon|lime) juice\b/g, '');
        expect(name, `${recipe.id} ingredient`).not.toMatch(/juice/);
      }
    }
  });

  it('every "Left out" adaptation matches an absent ingredient, and none is missing', () => {
    for (const recipe of BATCH_3_RECIPES) {
      const adaptations = recipe.source?.adaptations ?? [];
      const leftOut = adaptations.filter((a) => a.startsWith('Left out'));
      const expected = BATCH_3_LEFT_OUT[recipe.id] ?? [];
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

  it('recipes that keep salt, sugar or soy sauce are exactly the 24-36 only ones listed', () => {
    for (const recipe of BATCH_3_RECIPES) {
      const keeps = recipe.ingredients.some((i) => /\b(salt|sugar|soy sauce)\b/i.test(i.name));
      expect(keeps, recipe.id).toBe(KEEPS_BLOCKED_AT_24.includes(recipe.id));
    }
  });

  it('puree or mash only recipes are not tagged for toddler stages', () => {
    for (const recipe of BATCH_3_RECIPES) {
      const softPieces = recipe.serveAs?.some((s) => s === 'pieces' || s === 'finger-food');
      if (!softPieces) {
        expect(recipe.stages.includes('12-23') || recipe.stages.includes('24-36'), recipe.id).toBe(false);
      }
    }
  });

  it('no 6-8 recipe is served as pieces or finger food only', () => {
    for (const recipe of BATCH_3_RECIPES) {
      if (!recipe.stages.includes('6-8')) continue;
      expect(
        recipe.serveAs?.some((s) => s === 'puree' || s === 'mashed'),
        `${recipe.id} 6-8 needs a puree or mashed form`,
      ).toBe(true);
    }
  });

  it('no two built-ins share a source URL or a title (duplicate check)', () => {
    // Simple ideas share a few feeding-guide pages, and the WIC recipes share two.
    const urls = [
      ...BATCH_2_RECIPES,
      ...BATCH_3_RECIPES,
      ...BATCH_4_RECIPES,
      ...BATCH_5_RECIPES,
      ...BATCH_6_RECIPES,
      ...BATCH_7_RECIPES,
      ...BATCH_8_RECIPES,
      ...BATCH_9_RECIPES,
      ...BATCH_10_RECIPES,
    ].map((r) => r.source?.url);
    expect(new Set(urls).size, 'source URLs are unique').toBe(urls.length);
    const titles = BUILTIN_RECIPES.map((r) => r.title.trim().toLowerCase());
    expect(new Set(titles).size, 'titles are unique').toBe(titles.length);
  });

  it('batch 3 adds recipes to the scarce 6-8 and 9-12 Easy and Medium cells', () => {
    const cellCount = (stage: StageId, effort: Effort) =>
      BATCH_3_RECIPES.filter((r) => r.stages.includes(stage) && recipeEffort(r) === effort).length;
    expect(cellCount('6-8', 'easy')).toBeGreaterThanOrEqual(5);
    expect(cellCount('6-8', 'medium')).toBeGreaterThanOrEqual(1);
    expect(cellCount('9-12', 'easy')).toBeGreaterThanOrEqual(8);
    expect(cellCount('9-12', 'medium')).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// Batch 4 (task 14.3): soy, egg, tree nut, peanut and fish recipes, then the
// 12-23 and 6-8 Easy and Medium cells
// ---------------------------------------------------------------------------
const BATCH_4_EXPECTED: Record<string, Batch3Expectation> = {
  'b-fh-tuna-veggie-melt': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'fish', 'wheat'], servings: 6, estimateNote: 'Serving count is an estimate (source gives no servings): 6 muffin halves, 1 muffin half per serving.' },
  'b-fh-fish-tacos': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'fish'], servings: 8, estimateNote: 'Serving count is an estimate (source gives no servings): 8 tacos, 1 taco per serving.' },
  'b-fh-fish-and-spinach-bake': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['fish'], servings: 8 },
  'b-icn-sauteed-tempeh-with-vegetables': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy'], servings: 6 },
  'b-fh-zucchini-stir-fry': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-chicken-cabbage-stir-fry': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy'], servings: 12, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-greens-and-carrots': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-sunshine-roll-ups': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy', 'wheat'], servings: 4, estimateNote: 'Serving count is an estimate (source gives no servings): 4 half roll-ups, 1 half roll-up per serving.' },
  'b-fh-beef-and-broccoli': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['sesame', 'soy'], servings: 14, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-sweet-and-sour-chicken': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy'], servings: 12, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-baked-zucchini-sticks': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 16, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-breakfast-burritos': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'wheat'], servings: 4, estimateNote: 'Serving count is an estimate (source gives no servings): 4 burritos, 1 burrito per serving.' },
  'b-fh-easy-meatballs': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg'], servings: 8, estimateNote: 'Serving count is an estimate (source gives no servings): 24 meatballs, 3 meatballs per serving.' },
  'b-fh-veggie-quiche-muffins': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg'], servings: 12, estimateNote: 'Serving count is an estimate (source gives no servings): 12 muffins, 1 muffin per serving.' },
  'b-fh-whole-wheat-blueberry-muffins': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 12, estimateNote: 'Serving count is an estimate (source gives no servings): 12 muffins, 1 muffin per serving.' },
  'b-fh-chicken-and-dumpling-casserole': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'wheat'], servings: 16, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-ginger-almond-asparagus': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['tree nuts'], servings: 4, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-green-beans-onions-and-almonds': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'tree nuts'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-couscous-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['tree nuts', 'wheat'], servings: 10, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-waldorf-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'tree nuts'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-cherry-puff-pancake': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'tree nuts', 'wheat'], servings: 4, estimateNote: 'Serving count is an estimate (source gives no servings): 4 pieces, 1 piece per serving.' },
  'b-fh-morning-muffins': { publisher: FH, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'tree nuts', 'wheat'], servings: 12, estimateNote: 'Serving count is an estimate (source gives no servings): 12 muffins, 1 muffin per serving.' },
  'b-fh-baked-berry-oatmeal': { publisher: FH, stages: ['24-36'], serveAs: ['mashed', 'pieces'], allergens: ['dairy', 'egg', 'tree nuts'], servings: 12, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-peanut-butter-cereal-bars': { publisher: FH, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['peanut'], servings: 16, estimateNote: 'Serving count is an estimate (source gives no servings): 16 bars, 1 bar per serving.' },
  'b-fh-cranberry-oatmeal-balls': { publisher: FH, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['peanut', 'tree nuts'], servings: 16, estimateNote: 'Serving count is an estimate (source gives no servings): 16 balls, 1 ball per serving.' },
  'b-icn-berry-peanut-butter-with-mini-graham-crackers': { publisher: ICN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['peanut', 'wheat'], servings: 6 },
  'b-fh-pinto-bean-dip': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'], allergens: [], servings: 13, estimateNote: ESTIMATE_QUARTER_CUP },
  'b-fh-lemony-garbanzo-bean-dip': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_QUARTER_CUP },
  'b-fh-any-berry-sauce': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'], allergens: [], servings: 9, estimateNote: ESTIMATE_QUARTER_CUP },
  'b-fh-cranberry-applesauce': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['mashed'], allergens: [], servings: 12, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-beet-dip': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree'], allergens: ['sesame'], servings: 8, estimateNote: ESTIMATE_QUARTER_CUP },
  'b-fh-roasted-zucchini': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: [], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-parmesan-roasted-potatoes': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy'], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-creamed-green-beans-and-potatoes': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-roasted-parsnips-and-carrots': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: [], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-refried-bean-soup': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: [], servings: 20, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-barley-lentil-soup': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: [], servings: 20, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-baked-apples-and-squash': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: [], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-not-your-everyday-apples': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-curried-pumpkin-soup': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 12, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-autumn-squash-bisque-with-ginger': { publisher: FH, stages: ['9-12'], serveAs: ['puree'], allergens: ['dairy'], servings: 20, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-savory-turnips': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: ['dairy'], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-icn-gochujang-tofu': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['sesame', 'soy'], servings: 6 },
  'b-fh-sweet-potato-and-orange-muffins': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['finger-food'], allergens: ['egg', 'wheat'], servings: 12, estimateNote: 'Serving count is an estimate (source gives no servings): 12 muffins, 1 muffin per serving.' },
  'b-fh-easy-manicotti': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'wheat'], servings: 14, estimateNote: 'Serving count is an estimate (source gives no servings): 14 filled shells, 1 shell per serving.' },
  'b-icn-mediterranean-tuna-salad': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['fish', 'wheat'], servings: 6 },
  'b-fh-jack-o-lantern-pumpkin-pancakes': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 8, estimateNote: 'Serving count is an estimate (source gives no servings): 16 4-inch pancakes, 2 pancakes per serving.' },
  'b-fh-sauteed-peppers': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-garlic-bok-choy': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 4, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-roasted-sugar-snap-peas': { publisher: FH, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['soy'], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
};

/** Ingredients the sources list but that were left out; the adaptation must say so. */
const BATCH_4_LEFT_OUT: Record<string, { adaptation: string; absent: RegExp }[]> = {
  'b-fh-fish-tacos': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-fish-and-spinach-bake': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-breakfast-burritos': [{ adaptation: 'Left out the salt the source says to add to taste', absent: /\bsalt\b/i }],
  'b-fh-easy-meatballs': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-veggie-quiche-muffins': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-whole-wheat-blueberry-muffins': [{ adaptation: 'Left out 1/2 cup sugar', absent: /sugar/i }, { adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-chicken-and-dumpling-casserole': [{ adaptation: 'Left out 1/2 teaspoon salt in the chicken mixture', absent: /\bsalt\b/i }, { adaptation: 'Left out 1/4 teaspoon salt in the dumplings', absent: /\bsalt\b/i }],
  'b-fh-sauteed-peppers': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-pinto-bean-dip': [{ adaptation: 'Left out 1/8 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-any-berry-sauce': [{ adaptation: 'Left out 1/3 cup sugar', absent: /sugar/i }],
  'b-fh-cranberry-applesauce': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }, { adaptation: 'Left out 1/3 cup packed brown sugar', absent: /sugar/i }],
  'b-fh-beet-dip': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-roasted-zucchini': [{ adaptation: 'Left out 1/8 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-parmesan-roasted-potatoes': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-creamed-green-beans-and-potatoes': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-roasted-parsnips-and-carrots': [{ adaptation: 'Left out 1/8 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-barley-lentil-soup': [{ adaptation: 'Left out the salt the source says to add to taste', absent: /\bsalt\b/i }],
  'b-fh-baked-apples-and-squash': [{ adaptation: 'Left out 1 Tablespoon sugar', absent: /sugar/i }, { adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-not-your-everyday-apples': [{ adaptation: 'Left out 2 teaspoons brown sugar', absent: /sugar/i }],
  'b-fh-curried-pumpkin-soup': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }, { adaptation: 'Left out the optional 1 Tablespoon honey', absent: /honey/i }],
  'b-fh-savory-turnips': [{ adaptation: 'Left out 1/2 teaspoon sugar', absent: /sugar/i }, { adaptation: 'Left out 1/8 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-sweet-potato-and-orange-muffins': [{ adaptation: 'Left out 1/3 cup packed brown sugar', absent: /sugar/i }],
  'b-fh-easy-manicotti': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-jack-o-lantern-pumpkin-pancakes': [{ adaptation: 'Left out 2 Tablespoons brown sugar', absent: /sugar/i }, { adaptation: 'Left out 1 teaspoon salt', absent: /\bsalt\b/i }],
};

/** Batch 4 recipes that keep salt, sugar or soy sauce because they are tagged 24-36 only (the screen does not block them at that age). */
const BATCH_4_KEEPS_BLOCKED_AT_24 = [
  'b-fh-zucchini-stir-fry',
  'b-fh-chicken-cabbage-stir-fry',
  'b-fh-greens-and-carrots',
  'b-fh-sunshine-roll-ups',
  'b-fh-beef-and-broccoli',
  'b-fh-sweet-and-sour-chicken',
  'b-icn-gochujang-tofu',
  'b-fh-ginger-almond-asparagus',
  'b-fh-green-beans-onions-and-almonds',
  'b-fh-waldorf-salad',
  'b-fh-cherry-puff-pancake',
  'b-fh-morning-muffins',
  'b-fh-baked-berry-oatmeal',
  'b-fh-garlic-bok-choy',
  'b-fh-roasted-sugar-snap-peas',
];

/** Food Hero pages that state their own serving count (no estimate needed). */
const BATCH_4_SOURCE_SERVINGS = ['b-fh-fish-and-spinach-bake'];

describe('BUILTIN_RECIPES - batch 4', () => {
  it('has a pinned expectation for exactly the batch 4 recipes', () => {
    expect(BATCH_4_RECIPES.map((r) => r.id).sort()).toEqual(Object.keys(BATCH_4_EXPECTED).sort());
    expect(BATCH_4_RECIPES.length).toBeGreaterThanOrEqual(40);
    expect(BATCH_4_RECIPES.length).toBeLessThanOrEqual(60);
  });

  it('every batch 4 recipe is a full recipe with serveAs and at least one quantity', () => {
    for (const recipe of BATCH_4_RECIPES) {
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

  it('every batch 4 source is an https page on an allowed host and a listed publisher', () => {
    for (const recipe of BATCH_4_RECIPES) {
      const source = recipe.source;
      expect(source, recipe.id).toBeDefined();
      if (!source) continue;
      const url = new URL(source.url);
      expect(url.protocol, recipe.id).toBe('https:');
      expect(ALLOWED_HOSTS, `${recipe.id} host ${url.hostname}`).toContain(url.hostname);
      expect(sourcesDoc, `${recipe.id} publisher is in docs/recipe-sources.md`).toContain(source.publisher);
      expect(source.retrieved, recipe.id).toBe('2026-11-10');
      expect(source.title.trim().length, recipe.id).toBeGreaterThan(0);
    }
  });

  it('pins publisher, stages, serveAs and servings for each recipe', () => {
    for (const recipe of BATCH_4_RECIPES) {
      const expected = BATCH_4_EXPECTED[recipe.id];
      expect(recipe.source?.publisher, `${recipe.id} publisher`).toBe(expected.publisher);
      expect(recipe.stages, `${recipe.id} stages`).toEqual(expected.stages);
      expect(recipe.serveAs, `${recipe.id} serveAs`).toEqual(expected.serveAs);
      expect(recipe.servings, `${recipe.id} servings`).toBe(expected.servings);
    }
  });

  it('ICN recipes use the source serving count and Food Hero estimates are disclosed', () => {
    for (const recipe of BATCH_4_RECIPES) {
      const expected = BATCH_4_EXPECTED[recipe.id];
      const adaptations = recipe.source?.adaptations ?? [];
      const estimates = adaptations.filter((a) => a.startsWith('Serving count is an estimate'));
      if (expected.estimateNote) expect(estimates, recipe.id).toEqual([expected.estimateNote]);
      else expect(estimates, recipe.id).toEqual([]);
      if (expected.publisher === ICN) expect(recipe.servings, recipe.id).toBe(6);
      else if (!expected.estimateNote) expect(BATCH_4_SOURCE_SERVINGS, recipe.id).toContain(recipe.id);
    }
  });

  it('pins the allergen groups of each recipe from the real screen', () => {
    for (const recipe of BATCH_4_RECIPES) {
      const groups = [...new Set(screenRecipe(recipe, 12).allergens.map((f) => f.label))].sort();
      expect(groups, `${recipe.id} allergen groups`).toEqual(BATCH_4_EXPECTED[recipe.id].allergens);
    }
  });

  it('no batch 4 recipe has a block at 24 months; blocked-at-12 ones are tagged 24-36 only', () => {
    for (const recipe of BATCH_4_RECIPES) {
      expect(screenRecipe(recipe, 24).blocks, `${recipe.id} is safe at 24 months`).toEqual([]);
      if (screenRecipe(recipe, 12).blocks.length > 0) {
        expect(recipe.stages, recipe.id).toEqual(['24-36']);
        expect(BATCH_4_KEEPS_BLOCKED_AT_24, recipe.id).toContain(recipe.id);
      }
    }
  });

  it('tagged stages younger than 24 months contain no salt, sugar, soy sauce, honey or bouillon', () => {
    for (const recipe of BATCH_4_RECIPES) {
      if (!recipe.stages.some((s) => s !== '24-36')) continue;
      const text = [...recipe.ingredients.map((i) => i.name), ...recipe.steps].join(' ');
      expect(text, `${recipe.id} text`).not.toMatch(/\b(salt|sugar|soy sauce|honey|bouillon)\b/i);
    }
  });

  it('recipes tagged 6-8 or 9-12 contain no juice other than lemon or lime', () => {
    for (const recipe of BATCH_4_RECIPES) {
      if (!recipe.stages.some((s) => s === '6-8' || s === '9-12')) continue;
      for (const ingredient of recipe.ingredients) {
        const name = ingredient.name.toLowerCase().replace(/\b(lemon|lime) juice\b/g, '');
        expect(name, `${recipe.id} ingredient`).not.toMatch(/juice/);
      }
    }
  });

  it('every "Left out" adaptation matches an absent ingredient, and none is missing', () => {
    for (const recipe of BATCH_4_RECIPES) {
      const adaptations = recipe.source?.adaptations ?? [];
      const leftOut = adaptations.filter((a) => a.startsWith('Left out'));
      const expected = BATCH_4_LEFT_OUT[recipe.id] ?? [];
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

  it('recipes that keep salt, sugar or soy sauce are exactly the 24-36 only ones listed', () => {
    for (const recipe of BATCH_4_RECIPES) {
      const keeps = recipe.ingredients.some((i) => /\b(salt|sugar|soy sauce)\b/i.test(i.name));
      expect(keeps, recipe.id).toBe(BATCH_4_KEEPS_BLOCKED_AT_24.includes(recipe.id));
    }
  });

  it('puree or mash only recipes are not tagged for toddler stages', () => {
    for (const recipe of BATCH_4_RECIPES) {
      const softPieces = recipe.serveAs?.some((s) => s === 'pieces' || s === 'finger-food');
      if (!softPieces) {
        expect(recipe.stages.includes('12-23') || recipe.stages.includes('24-36'), recipe.id).toBe(false);
      }
    }
  });

  it('no 6-8 recipe is served as pieces or finger food only', () => {
    for (const recipe of BATCH_4_RECIPES) {
      if (!recipe.stages.includes('6-8')) continue;
      expect(
        recipe.serveAs?.some((s) => s === 'puree' || s === 'mashed'),
        `${recipe.id} 6-8 needs a puree or mashed form`,
      ).toBe(true);
    }
  });

  it('batch 4 adds recipes to the 12-23 and 6-8 Easy and Medium cells and to the allergen gaps', () => {
    const cellCount = (stage: StageId, effort: Effort) =>
      BATCH_4_RECIPES.filter((r) => r.stages.includes(stage) && recipeEffort(r) === effort).length;
    expect(cellCount('12-23', 'easy')).toBeGreaterThanOrEqual(2);
    expect(cellCount('12-23', 'medium')).toBeGreaterThanOrEqual(13);
    expect(cellCount('6-8', 'easy')).toBeGreaterThanOrEqual(3);
    expect(cellCount('6-8', 'medium')).toBeGreaterThanOrEqual(2);
    const groupCount = (group: string) =>
      BATCH_4_RECIPES.filter((r) => BATCH_4_EXPECTED[r.id].allergens.includes(group)).length;
    expect(groupCount('soy')).toBeGreaterThanOrEqual(8);
    expect(groupCount('egg')).toBeGreaterThanOrEqual(10);
    expect(groupCount('tree nuts')).toBeGreaterThanOrEqual(6);
    expect(groupCount('peanut')).toBeGreaterThanOrEqual(3);
    expect(groupCount('fish')).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Batch 5 (task 14.3): Easy recipes for 12-23 and 24-36, soy, shellfish (Oregon
// Sea Grant), then 24-36 More, 12-23 More and the 6-8 cells
// ---------------------------------------------------------------------------
const OSU = 'Oregon Sea Grant, Oregon State University';
const ESTIMATE_ONE_CUP =
  'Serving count is an estimate (source gives no servings): total yield divided by a 1 cup portion.';

const BATCH_5_EXPECTED: Record<string, Batch3Expectation> = {
  'b-fh-creamy-fruit-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-fruit-pizza': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 2 },
  'b-fh-banana-bobs': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 2 },
  'b-fh-super-sundae': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 2, estimateNote: 'Serving count is an estimate (source gives no servings): the directions make 2 sundaes, 1 sundae per serving.' },
  'b-fh-yogurt-fruit-dip': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4, estimateNote: ESTIMATE_QUARTER_CUP },
  'b-fh-raspberry-fruit-dip': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8 },
  'b-fh-carrot-raisin-salad': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 5, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-melon-and-mint': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 12, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-watermelon-lime-chili': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 4, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-pear-quesadillas': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 8 },
  'b-fh-turkey-cranberry-quesadilla': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 1, estimateNote: 'Serving count is an estimate (source gives no servings): the recipe makes 1 quesadilla, 1 quesadilla per serving.' },
  'b-fh-sauteed-cabbage': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 10, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-summer-cucumbers': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-salmon-salad-mix': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'fish'], servings: 6, estimateNote: ESTIMATE_QUARTER_CUP },
  'b-fh-beet-and-carrot-salad': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-cucumber-and-tomato-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-braised-radishes': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-hoppin-pear-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'tree nuts'], servings: 4 },
  'b-fh-rice-bowl-breakfast-fruit-nuts': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'tree nuts'], servings: 2, estimateNote: 'Serving count is an estimate (source gives no servings): the directions divide the rice between 2 bowls, 1 bowl per serving.' },
  'b-fh-green-salad-with-peas': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 12, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-ants-on-a-log': { publisher: FH, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['peanut'], servings: 4 },
  'b-fh-cranberry-orange-relish': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 10, estimateNote: ESTIMATE_QUARTER_CUP },
  'b-fh-baked-apple-and-cranberries': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 1, estimateNote: 'Serving count is an estimate (source gives no servings): the recipe makes 1 apple, 1 apple per serving.' },
  'b-fh-roasted-cauliflower': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-fried-rice-with-pork': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-green-and-orange-chicken-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['sesame', 'soy'], servings: 12, estimateNote: ESTIMATE_ONE_CUP },
  'b-icn-teriyaki-chicken-and-cabbage': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy'], servings: 6 },
  'b-icn-corn-and-edamame-blend': { publisher: ICN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['sesame', 'soy'], servings: 6 },
  'b-icn-stir-fried-green-rice-eggs-and-ham': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['egg', 'sesame', 'soy'], servings: 6 },
  'b-icn-stir-fry-pork': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy'], servings: 6 },
  'b-osu-sg-shrimp-cucumber-and-seaweed-salad': { publisher: OSU, stages: ['24-36'], serveAs: ['pieces'], allergens: ['sesame', 'shellfish', 'soy'], servings: 4 },
  'b-osu-sg-meridian-dungeness-crab-cakes': { publisher: OSU, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'shellfish', 'wheat'], servings: 8, estimateNote: 'Serving count is an estimate (source gives no servings): 2 pounds of crab meat divided by a 4 ounce portion.' },
  'b-fh-minestrone-soup': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['wheat'], servings: 10, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-vegetarian-chili': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-stuffed-peppers-turkey-vegetables': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6, estimateNote: 'Serving count is an estimate (source gives no servings): 6 pepper halves, 1 half per serving.' },
  'b-fh-turkey-stroganoff': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 8, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-white-chicken-chili': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-turkey-pumpkin-chili': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 10, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-peach-yogurt-smoothie': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree'], allergens: ['dairy'], servings: 4, estimateNote: 'Serving count is an estimate (source gives no servings): the page makes 3 cups with the juice, so about 2 cups without it, divided by a 1/2 cup portion.' },
  'b-fh-banana-berry-smoothie': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree'], allergens: ['dairy'], servings: 6, estimateNote: 'Serving count is an estimate (source gives no servings): the page makes 4 cups with the juice, so about 3 cups without it, divided by a 1/2 cup portion.' },
  'b-fh-bell-pepper-nachos': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'soy'], servings: 8, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-strawberry-swirl': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree'], allergens: [], servings: 2, estimateNote: 'Serving count is an estimate (source gives no servings): the page makes 2 cups with the juice, so about 1 cup without it, divided by a 1/2 cup portion.' },
  'b-fh-glazed-squash': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6, estimateNote: 'Serving count is an estimate (source gives no servings): total yield of 3 cups divided by a 1/2 cup portion.' },
  'b-fh-red-potato-and-cabbage-colcannon': { publisher: FH, stages: ['6-8', '9-12', '12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: ['dairy'], servings: 12, estimateNote: ESTIMATE_HALF_CUP },
  'b-icn-easy-chicken-and-egg-noodle-soup': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['egg', 'sesame', 'soy', 'wheat'], servings: 6 },
  'b-icn-asian-tuna-burger': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['egg', 'fish', 'sesame', 'soy', 'wheat'], servings: 6 },
  'b-icn-bok-choy-wrappers': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy'], servings: 6 },
};

/** Ingredients the sources list but that were left out; the adaptation must say so. */
const BATCH_5_LEFT_OUT: Record<string, { adaptation: string; absent: RegExp }[]> = {
  'b-fh-yogurt-fruit-dip': [{ adaptation: 'Left out 1 teaspoon brown sugar', absent: /sugar/i }],
  'b-fh-raspberry-fruit-dip': [{ adaptation: 'Left out 1 tablespoon sugar', absent: /sugar/i }],
  'b-fh-peach-yogurt-smoothie': [{ adaptation: 'Left out 3/4 cup orange juice', absent: /orange juice/i }],
  'b-fh-banana-berry-smoothie': [{ adaptation: 'Left out 1 cup orange juice', absent: /orange juice/i }],
  'b-fh-melon-and-mint': [{ adaptation: 'Left out 2 tablespoons packed brown sugar', absent: /sugar/i }],
  'b-fh-watermelon-lime-chili': [{ adaptation: 'Left out 1/4 teaspoon salt (optional)', absent: /\bsalt\b/i }],
  'b-fh-sauteed-cabbage': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-beet-and-carrot-salad': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-baked-apple-and-cranberries': [{ adaptation: 'Left out 1 teaspoon packed brown sugar', absent: /sugar/i }],
  'b-fh-roasted-cauliflower': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-icn-corn-and-edamame-blend': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-stuffed-peppers-turkey-vegetables': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-strawberry-swirl': [{ adaptation: 'Left out 1 cup (8 ounces) 100% apple juice', absent: /apple juice/i }],
  'b-fh-glazed-squash': [{ adaptation: 'Left out 3 tablespoons brown sugar', absent: /sugar/i }, { adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-red-potato-and-cabbage-colcannon': [{ adaptation: 'Left out 1 teaspoon salt', absent: /\bsalt\b/i }],
};

/** Batch 5 recipes that keep salt, sugar or soy sauce because they are tagged 24-36 only (the screen does not block them at that age). */
const BATCH_5_KEEPS_BLOCKED_AT_24 = [
  'b-fh-summer-cucumbers',
  'b-fh-braised-radishes',
  'b-fh-cranberry-orange-relish',
  'b-fh-fried-rice-with-pork',
  'b-fh-green-and-orange-chicken-salad',
  'b-icn-teriyaki-chicken-and-cabbage',
  'b-icn-stir-fried-green-rice-eggs-and-ham',
  'b-icn-stir-fry-pork',
  'b-osu-sg-shrimp-cucumber-and-seaweed-salad',
  'b-fh-minestrone-soup',
  'b-fh-turkey-pumpkin-chili',
  'b-icn-easy-chicken-and-egg-noodle-soup',
  'b-icn-asian-tuna-burger',
  'b-icn-bok-choy-wrappers',
];

/** Pages (or ICN versions) that state their own serving count (no estimate needed). */
const BATCH_5_SOURCE_SERVINGS = [
  'b-fh-fruit-pizza',
  'b-fh-banana-bobs',
  'b-fh-raspberry-fruit-dip',
  'b-fh-hoppin-pear-salad',
  'b-fh-ants-on-a-log',
  'b-fh-pear-quesadillas',
  'b-icn-teriyaki-chicken-and-cabbage',
  'b-icn-corn-and-edamame-blend',
  'b-icn-stir-fried-green-rice-eggs-and-ham',
  'b-icn-stir-fry-pork',
  'b-osu-sg-shrimp-cucumber-and-seaweed-salad',
  'b-icn-easy-chicken-and-egg-noodle-soup',
  'b-icn-asian-tuna-burger',
  'b-icn-bok-choy-wrappers',
];

describe('BUILTIN_RECIPES - batch 5', () => {
  it('has a pinned expectation for exactly the batch 5 recipes', () => {
    expect(BATCH_5_RECIPES.map((r) => r.id).sort()).toEqual(Object.keys(BATCH_5_EXPECTED).sort());
    expect(BATCH_5_RECIPES.length).toBeGreaterThanOrEqual(45);
    expect(BATCH_5_RECIPES.length).toBeLessThanOrEqual(55);
  });

  it('every batch 5 recipe is a full recipe with serveAs and at least one quantity', () => {
    for (const recipe of BATCH_5_RECIPES) {
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

  it('every batch 5 source is an https page on an allowed host and a listed publisher', () => {
    for (const recipe of BATCH_5_RECIPES) {
      const source = recipe.source;
      expect(source, recipe.id).toBeDefined();
      if (!source) continue;
      const url = new URL(source.url);
      expect(url.protocol, recipe.id).toBe('https:');
      expect(ALLOWED_HOSTS, `${recipe.id} host ${url.hostname}`).toContain(url.hostname);
      expect(sourcesDoc, `${recipe.id} publisher is in docs/recipe-sources.md`).toContain(source.publisher);
      expect(source.retrieved, recipe.id).toBe('2026-11-10');
      expect(source.title.trim().length, recipe.id).toBeGreaterThan(0);
    }
  });

  it('Oregon Sea Grant is a new publisher listed in docs/recipe-sources.md', () => {
    const row = sourcesDoc.split('\n').find((line) => line.includes(OSU));
    expect(row, 'Oregon Sea Grant row').toBeDefined();
    expect(row).toContain('seagrant.oregonstate.edu');
    expect(row).toMatch(/Pending pr-reviewer|Approved by pr-reviewer \(PR #\d+\)/);
    const osu = BATCH_5_RECIPES.filter((r) => r.source?.publisher === OSU);
    expect(osu.length).toBeGreaterThanOrEqual(2);
    for (const recipe of osu) {
      expect(new URL(recipe.source?.url ?? '').hostname, recipe.id).toBe('seagrant.oregonstate.edu');
    }
  });

  it('pins publisher, stages, serveAs and servings for each recipe', () => {
    for (const recipe of BATCH_5_RECIPES) {
      const expected = BATCH_5_EXPECTED[recipe.id];
      expect(recipe.source?.publisher, `${recipe.id} publisher`).toBe(expected.publisher);
      expect(recipe.stages, `${recipe.id} stages`).toEqual(expected.stages);
      expect(recipe.serveAs, `${recipe.id} serveAs`).toEqual(expected.serveAs);
      expect(recipe.servings, `${recipe.id} servings`).toBe(expected.servings);
    }
  });

  it('ICN recipes use the source serving count and estimates are disclosed', () => {
    for (const recipe of BATCH_5_RECIPES) {
      const expected = BATCH_5_EXPECTED[recipe.id];
      const adaptations = recipe.source?.adaptations ?? [];
      const estimates = adaptations.filter((a) => a.startsWith('Serving count is an estimate'));
      if (expected.estimateNote) expect(estimates, recipe.id).toEqual([expected.estimateNote]);
      else expect(estimates, recipe.id).toEqual([]);
      if (expected.publisher === ICN) expect(recipe.servings, recipe.id).toBe(6);
      else if (!expected.estimateNote) expect(BATCH_5_SOURCE_SERVINGS, recipe.id).toContain(recipe.id);
    }
  });

  it('pins the allergen groups of each recipe from the real screen', () => {
    for (const recipe of BATCH_5_RECIPES) {
      const groups = [...new Set(screenRecipe(recipe, 12).allergens.map((f) => f.label))].sort();
      expect(groups, `${recipe.id} allergen groups`).toEqual(BATCH_5_EXPECTED[recipe.id].allergens);
    }
  });

  it('no batch 5 recipe has a block at 24 months; blocked-at-12 ones are tagged 24-36 only', () => {
    for (const recipe of BATCH_5_RECIPES) {
      expect(screenRecipe(recipe, 24).blocks, `${recipe.id} is safe at 24 months`).toEqual([]);
      if (screenRecipe(recipe, 12).blocks.length > 0) {
        expect(recipe.stages, recipe.id).toEqual(['24-36']);
        expect(BATCH_5_KEEPS_BLOCKED_AT_24, recipe.id).toContain(recipe.id);
      }
    }
  });

  it('no batch 5 recipe has a block at the youngest age of any stage it is tagged for', () => {
    for (const recipe of BATCH_5_RECIPES) {
      for (const stage of recipe.stages) {
        expect(
          screenRecipe(recipe, STAGE_MIN_MONTHS[stage]).blocks,
          `${recipe.id} at ${stage}`,
        ).toEqual([]);
      }
    }
  });

  it('tagged stages younger than 24 months contain no salt, sugar, soy sauce, honey or bouillon', () => {
    for (const recipe of BATCH_5_RECIPES) {
      if (!recipe.stages.some((s) => s !== '24-36')) continue;
      const text = [...recipe.ingredients.map((i) => i.name), ...recipe.steps].join(' ');
      expect(text, `${recipe.id} text`).not.toMatch(/\b(salt|sugar|soy sauce|honey|bouillon)\b/i);
    }
  });

  it('recipes tagged 6-8 or 9-12 contain no juice other than lemon or lime', () => {
    for (const recipe of BATCH_5_RECIPES) {
      if (!recipe.stages.some((s) => s === '6-8' || s === '9-12')) continue;
      for (const ingredient of recipe.ingredients) {
        const name = ingredient.name.toLowerCase().replace(/\b(lemon|lime) juice\b/g, '');
        expect(name, `${recipe.id} ingredient`).not.toMatch(/juice/);
      }
    }
  });

  it('every "Left out" adaptation matches an absent ingredient, and none is missing', () => {
    for (const recipe of BATCH_5_RECIPES) {
      const adaptations = recipe.source?.adaptations ?? [];
      const leftOut = adaptations.filter((a) => a.startsWith('Left out'));
      const expected = BATCH_5_LEFT_OUT[recipe.id] ?? [];
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

  it('recipes that keep salt, sugar or soy sauce are exactly the 24-36 only ones listed', () => {
    for (const recipe of BATCH_5_RECIPES) {
      const keeps = recipe.ingredients.some((i) => /\b(salt|sugar|soy sauce)\b/i.test(i.name));
      expect(keeps, recipe.id).toBe(BATCH_5_KEEPS_BLOCKED_AT_24.includes(recipe.id));
    }
  });

  it('recipes with nut pieces are tagged 24-36 only', () => {
    const nutPieces = /\b(chopped|sliced|slivered|crushed|toasted|pieces)\b.*\b(nuts?|almonds?|walnuts?|pecans?|peanuts?|cashews?|pistachios?)\b|\b(nuts?|almonds?|walnuts?|pecans?|peanuts?|cashews?|pistachios?)\b.*\b(chopped|sliced|slivered|crushed|pieces)\b/i;
    for (const recipe of BATCH_5_RECIPES) {
      if (!recipe.ingredients.some((i) => nutPieces.test(i.name))) continue;
      expect(recipe.stages, recipe.id).toEqual(['24-36']);
    }
  });

  it('puree or mash only recipes are not tagged for toddler stages', () => {
    for (const recipe of BATCH_5_RECIPES) {
      const softPieces = recipe.serveAs?.some((s) => s === 'pieces' || s === 'finger-food');
      if (!softPieces) {
        expect(recipe.stages.includes('12-23') || recipe.stages.includes('24-36'), recipe.id).toBe(false);
      }
    }
  });

  it('no 6-8 recipe is served as pieces or finger food only', () => {
    for (const recipe of BATCH_5_RECIPES) {
      if (!recipe.stages.includes('6-8')) continue;
      expect(
        recipe.serveAs?.some((s) => s === 'puree' || s === 'mashed'),
        `${recipe.id} 6-8 needs a puree or mashed form`,
      ).toBe(true);
    }
  });

  it('batch 5 adds recipes to the Easy cells, soy and shellfish gaps', () => {
    const cellCount = (stage: StageId, effort: Effort) =>
      BATCH_5_RECIPES.filter((r) => r.stages.includes(stage) && recipeEffort(r) === effort).length;
    expect(cellCount('12-23', 'easy')).toBeGreaterThanOrEqual(12);
    expect(cellCount('24-36', 'easy')).toBeGreaterThanOrEqual(23);
    expect(cellCount('6-8', 'easy')).toBeGreaterThanOrEqual(2);
    expect(cellCount('6-8', 'medium')).toBeGreaterThanOrEqual(1);
    expect(cellCount('24-36', 'more')).toBeGreaterThanOrEqual(15);
    expect(cellCount('12-23', 'more')).toBeGreaterThanOrEqual(3);
    const groupCount = (group: string) =>
      BATCH_5_RECIPES.filter((r) => BATCH_5_EXPECTED[r.id].allergens.includes(group)).length;
    expect(groupCount('soy')).toBeGreaterThanOrEqual(11);
    expect(groupCount('shellfish')).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Batch 6 (task 14.3): Easy recipes for 24-36 and 12-23, then 24-36 More, 12-23
// More, 9-12 More, soy and 6-8 Easy
// ---------------------------------------------------------------------------
const BATCH_6_EXPECTED: Record<string, Batch3Expectation> = {
  'b-icn-cottage-cheese-and-fruit-bowls': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-icn-fruit-and-yogurt-roll-ups': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 6 },
  'b-icn-chicken-and-cheese-snack-cup-with-grapes': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-icn-deli-bento-box': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 6 },
  'b-icn-mini-egg-salad-sandwiches': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['egg'], servings: 6 },
  'b-icn-easy-overnight-oats-and-berries': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-icn-dried-fruit-and-cereal-snack-mix': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['wheat'], servings: 6 },
  'b-icn-strawberry-and-waffle-kebabs-with-maple-yogurt-dip': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-icn-whipped-sweet-potatoes': { publisher: ICN, stages: ['9-12'], serveAs: ['mashed'], allergens: ['dairy'], servings: 6 },
  'b-icn-veggie-mash-up': { publisher: ICN, stages: ['12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: [], servings: 6 },
  'b-icn-creamy-coleslaw': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-icn-marinated-black-bean-salad': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-icn-mediterranean-quinoa-salad': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-icn-tuscan-smoked-turkey-and-bean-soup': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-icn-orange-glazed-carrots': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-icn-italian-vegetable-medley': { publisher: ICN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-icn-fiesta-wrap': { publisher: ICN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 6 },
  'b-icn-black-beans-with-plantains': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-icn-tuna-salad-and-apple-slices': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'fish'], servings: 6 },
  'b-icn-fresh-veggie-wraps': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 6 },
  'b-icn-cheesy-bean-tostada': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-icn-herb-bagel-bites': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['wheat'], servings: 6 },
  'b-fh-fruit-yogurt-popsicles': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy'], servings: 9, estimateNote: 'Serving count is an estimate (source gives no servings): 9 popsicles, 1 popsicle per serving.' },
  'b-fh-pumpkin-smoothie-cup': { publisher: FH, stages: ['9-12'], serveAs: ['puree'], allergens: ['dairy'], servings: 2, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-pumpkin-fruit-dip': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 12, estimateNote: ESTIMATE_QUARTER_CUP },
  'b-fh-cherry-salad': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-corn-and-tomato-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-summer-vegetable-and-pasta-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['wheat'], servings: 6, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-glazed-carrots-and-snow-peas': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-honey-mustard-green-beans': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-skillet-braised-chicken': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 2 },
  'b-fh-southwestern-stuffed-potatoes': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4, estimateNote: 'Serving count is an estimate (source gives no servings): 4 potato halves, 1 potato half per serving.' },
  'b-fh-blueberry-tofu-smoothie': { publisher: FH, stages: ['9-12'], serveAs: ['puree'], allergens: ['soy'], servings: 7, estimateNote: 'Serving count is an estimate (source gives no servings): the page makes 4 cups with the juice, so about 3 1/2 cups without it, divided by a 1/2 cup portion.' },
  'b-fh-barley-bean-and-corn-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-chicken-and-black-bean-salsa-burritos': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 4, estimateNote: 'Serving count is an estimate (source gives no servings): 4 burritos, 1 burrito per serving.' },
  'b-fh-garden-sloppy-joes': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['wheat'], servings: 6, estimateNote: 'Serving count is an estimate (source gives no servings): 6 sandwiches, 1 sandwich per serving.' },
  'b-fh-pasta-ratatouille': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 9, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-superhero-shepherds-pie': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 10, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-veggie-quesadillas-with-cilantro-yogurt-dip': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 12, estimateNote: 'Serving count is an estimate (source gives no servings): 12 quesadillas, 1 quesadilla per serving.' },
  'b-icn-toasted-pita-wedges-and-fruit-dip': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['wheat'], servings: 6 },
  'b-fh-strawberry-salsa': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 8, estimateNote: ESTIMATE_QUARTER_CUP },
  'b-fh-un-beet-able-berry-smoothie': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree'], allergens: ['dairy'], servings: 6, estimateNote: 'Serving count is an estimate (source gives no servings): the page makes 4 cups with the juice, so about 3 cups without it, divided by a 1/2 cup portion.' },
  'b-fh-kiwi-pineapple-slaw': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-split-pea-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 4, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-bell-pepper-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 12, estimateNote: ESTIMATE_HALF_CUP },
};

/** Ingredients the sources list but that were left out; the adaptation must say so. */
const BATCH_6_LEFT_OUT: Record<string, { adaptation: string; absent: RegExp }[]> = {
  'b-icn-whipped-sweet-potatoes': [{ adaptation: 'Left out 1/4 teaspoon table salt', absent: /\bsalt\b/i }],
  'b-icn-veggie-mash-up': [{ adaptation: 'Left out 1/4 teaspoon table salt', absent: /\bsalt\b/i }],
  'b-icn-italian-vegetable-medley': [{ adaptation: 'Left out 1/4 teaspoon table salt', absent: /\bsalt\b/i }],
  'b-fh-fruit-yogurt-popsicles': [{ adaptation: 'Left out 1 to 3 tablespoons sugar (optional)', absent: /sugar/i }],
  'b-fh-pumpkin-smoothie-cup': [{ adaptation: 'Left out 2 teaspoons brown sugar', absent: /sugar/i }],
  'b-fh-skillet-braised-chicken': [{ adaptation: 'Left out salt and seasoning salt from the page\'s list of seasoning examples', absent: /\bsalt\b/i }],
  'b-fh-blueberry-tofu-smoothie': [{ adaptation: 'Left out 1/2 cup orange juice (juice from 1 orange)', absent: /orange\sjuice/i }],
  'b-fh-chicken-and-black-bean-salsa-burritos': [{ adaptation: 'Left out 1/2 teaspoon salt, divided', absent: /\bsalt\b/i }],
  'b-fh-pasta-ratatouille': [{ adaptation: 'Left out 3/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-veggie-quesadillas-with-cilantro-yogurt-dip': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-un-beet-able-berry-smoothie': [{ adaptation: 'Left out 1 cup pineapple juice', absent: /pineapple\sjuice/i }],
};

/** Batch 6 recipes that keep salt, sugar, maple syrup or soy sauce because they are tagged 24-36 only (the screen does not block them at that age). */
const BATCH_6_KEEPS_BLOCKED_AT_24 = [
  'b-icn-strawberry-and-waffle-kebabs-with-maple-yogurt-dip',
  'b-icn-creamy-coleslaw',
  'b-icn-mediterranean-quinoa-salad',
  'b-icn-tuscan-smoked-turkey-and-bean-soup',
  'b-icn-orange-glazed-carrots',
  'b-fh-glazed-carrots-and-snow-peas',
  'b-fh-barley-bean-and-corn-salad',
  'b-fh-superhero-shepherds-pie',
  'b-icn-toasted-pita-wedges-and-fruit-dip',
  'b-fh-bell-pepper-salad',
  'b-fh-pumpkin-fruit-dip',
];

/** Pages (or ICN versions) that state their own serving count (no estimate needed). */
const BATCH_6_SOURCE_SERVINGS = [
  'b-icn-cottage-cheese-and-fruit-bowls',
  'b-icn-fruit-and-yogurt-roll-ups',
  'b-icn-chicken-and-cheese-snack-cup-with-grapes',
  'b-icn-deli-bento-box',
  'b-icn-mini-egg-salad-sandwiches',
  'b-icn-easy-overnight-oats-and-berries',
  'b-icn-dried-fruit-and-cereal-snack-mix',
  'b-icn-strawberry-and-waffle-kebabs-with-maple-yogurt-dip',
  'b-icn-whipped-sweet-potatoes',
  'b-icn-veggie-mash-up',
  'b-icn-creamy-coleslaw',
  'b-icn-marinated-black-bean-salad',
  'b-icn-mediterranean-quinoa-salad',
  'b-icn-tuscan-smoked-turkey-and-bean-soup',
  'b-icn-orange-glazed-carrots',
  'b-icn-italian-vegetable-medley',
  'b-icn-fiesta-wrap',
  'b-icn-black-beans-with-plantains',
  'b-icn-tuna-salad-and-apple-slices',
  'b-icn-fresh-veggie-wraps',
  'b-icn-cheesy-bean-tostada',
  'b-icn-herb-bagel-bites',
  'b-fh-skillet-braised-chicken',
  'b-icn-toasted-pita-wedges-and-fruit-dip',
];

describe('BUILTIN_RECIPES - batch 6', () => {
  it('has a pinned expectation for exactly the batch 6 recipes', () => {
    expect(BATCH_6_RECIPES.map((r) => r.id).sort()).toEqual(Object.keys(BATCH_6_EXPECTED).sort());
    expect(BATCH_6_RECIPES.length).toBeGreaterThanOrEqual(45);
    expect(BATCH_6_RECIPES.length).toBeLessThanOrEqual(55);
  });

  it('every batch 6 recipe is a full recipe with serveAs and at least one quantity', () => {
    for (const recipe of BATCH_6_RECIPES) {
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

  it('every batch 6 source is an https page on an allowed host and a listed publisher', () => {
    for (const recipe of BATCH_6_RECIPES) {
      const source = recipe.source;
      expect(source, recipe.id).toBeDefined();
      if (!source) continue;
      const url = new URL(source.url);
      expect(url.protocol, recipe.id).toBe('https:');
      expect(ALLOWED_HOSTS, `${recipe.id} host ${url.hostname}`).toContain(url.hostname);
      expect(sourcesDoc, `${recipe.id} publisher is in docs/recipe-sources.md`).toContain(source.publisher);
      expect(source.retrieved, recipe.id).toBe('2026-11-11');
      expect(source.title.trim().length, recipe.id).toBeGreaterThan(0);
    }
  });

  it('the Oregon Sea Grant publisher row is approved by pr-reviewer (PR #82)', () => {
    const row = sourcesDoc.split('\n').find((line) => line.includes(OSU));
    expect(row, 'Oregon Sea Grant row').toBeDefined();
    expect(row).toContain('seagrant.oregonstate.edu');
    expect(row).toContain('Approved by pr-reviewer (PR #82)');
    expect(BATCH_6_RECIPES.filter((r) => r.source?.publisher === OSU)).toEqual([]);
  });

  it('pins publisher, stages, serveAs and servings for each recipe', () => {
    for (const recipe of BATCH_6_RECIPES) {
      const expected = BATCH_6_EXPECTED[recipe.id];
      expect(recipe.source?.publisher, `${recipe.id} publisher`).toBe(expected.publisher);
      expect(recipe.stages, `${recipe.id} stages`).toEqual(expected.stages);
      expect(recipe.serveAs, `${recipe.id} serveAs`).toEqual(expected.serveAs);
      expect(recipe.servings, `${recipe.id} servings`).toBe(expected.servings);
    }
  });

  it('ICN recipes use the source serving count and estimates are disclosed', () => {
    for (const recipe of BATCH_6_RECIPES) {
      const expected = BATCH_6_EXPECTED[recipe.id];
      const adaptations = recipe.source?.adaptations ?? [];
      const estimates = adaptations.filter((a) => a.startsWith('Serving count is an estimate'));
      if (expected.estimateNote) expect(estimates, recipe.id).toEqual([expected.estimateNote]);
      else expect(estimates, recipe.id).toEqual([]);
      if (expected.publisher === ICN) expect(recipe.servings, recipe.id).toBe(6);
      else if (!expected.estimateNote) expect(BATCH_6_SOURCE_SERVINGS, recipe.id).toContain(recipe.id);
    }
  });

  it('pins the allergen groups of each recipe from the real screen', () => {
    for (const recipe of BATCH_6_RECIPES) {
      const groups = [...new Set(screenRecipe(recipe, 12).allergens.map((f) => f.label))].sort();
      expect(groups, `${recipe.id} allergen groups`).toEqual(BATCH_6_EXPECTED[recipe.id].allergens);
    }
  });

  it('no batch 6 recipe has a block at 24 months; blocked-at-12 ones are tagged 24-36 only', () => {
    for (const recipe of BATCH_6_RECIPES) {
      expect(screenRecipe(recipe, 24).blocks, `${recipe.id} is safe at 24 months`).toEqual([]);
      if (screenRecipe(recipe, 12).blocks.length > 0) {
        expect(recipe.stages, recipe.id).toEqual(['24-36']);
        expect(BATCH_6_KEEPS_BLOCKED_AT_24, recipe.id).toContain(recipe.id);
      }
    }
  });

  it('no batch 6 recipe has a block at the youngest age of any stage it is tagged for', () => {
    for (const recipe of BATCH_6_RECIPES) {
      for (const stage of recipe.stages) {
        expect(
          screenRecipe(recipe, STAGE_MIN_MONTHS[stage]).blocks,
          `${recipe.id} at ${stage}`,
        ).toEqual([]);
      }
    }
  });

  it('tagged stages younger than 24 months contain no salt, sugar, soy sauce, honey or bouillon', () => {
    for (const recipe of BATCH_6_RECIPES) {
      if (!recipe.stages.some((s) => s !== '24-36')) continue;
      const text = [...recipe.ingredients.map((i) => i.name), ...recipe.steps].join(' ');
      expect(text, `${recipe.id} text`).not.toMatch(/\b(salt|sugar|soy sauce|honey|bouillon|maple syrup|agave)\b/i);
    }
  });

  it('recipes tagged 6-8 or 9-12 contain no juice other than lemon or lime', () => {
    for (const recipe of BATCH_6_RECIPES) {
      if (!recipe.stages.some((s) => s === '6-8' || s === '9-12')) continue;
      for (const ingredient of recipe.ingredients) {
        const name = ingredient.name.toLowerCase().replace(/\b(lemon|lime) juice\b/g, '');
        expect(name, `${recipe.id} ingredient`).not.toMatch(/juice/);
      }
    }
  });

  it('every "Left out" adaptation matches an absent ingredient, and none is missing', () => {
    for (const recipe of BATCH_6_RECIPES) {
      const adaptations = recipe.source?.adaptations ?? [];
      const leftOut = adaptations.filter((a) => a.startsWith('Left out'));
      const expected = BATCH_6_LEFT_OUT[recipe.id] ?? [];
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

  it('recipes that keep salt, sugar or soy sauce are exactly the 24-36 only ones listed', () => {
    for (const recipe of BATCH_6_RECIPES) {
      const keeps = recipe.ingredients.some((i) => /\b(salt|sugar|soy sauce|maple syrup)\b/i.test(i.name));
      expect(keeps, recipe.id).toBe(BATCH_6_KEEPS_BLOCKED_AT_24.includes(recipe.id));
    }
  });

  it('recipes with nut pieces are tagged 24-36 only', () => {
    const nutPieces = /\b(chopped|sliced|slivered|crushed|toasted|pieces)\b.*\b(nuts?|almonds?|walnuts?|pecans?|peanuts?|cashews?|pistachios?)\b|\b(nuts?|almonds?|walnuts?|pecans?|peanuts?|cashews?|pistachios?)\b.*\b(chopped|sliced|slivered|crushed|pieces)\b/i;
    for (const recipe of BATCH_6_RECIPES) {
      if (!recipe.ingredients.some((i) => nutPieces.test(i.name))) continue;
      expect(recipe.stages, recipe.id).toEqual(['24-36']);
    }
  });

  it('puree or mash only recipes are not tagged for toddler stages', () => {
    for (const recipe of BATCH_6_RECIPES) {
      const softPieces = recipe.serveAs?.some((s) => s === 'pieces' || s === 'finger-food');
      if (!softPieces) {
        expect(recipe.stages.includes('12-23') || recipe.stages.includes('24-36'), recipe.id).toBe(false);
      }
    }
  });

  it('no 6-8 recipe is served as pieces or finger food only', () => {
    for (const recipe of BATCH_6_RECIPES) {
      if (!recipe.stages.includes('6-8')) continue;
      expect(
        recipe.serveAs?.some((s) => s === 'puree' || s === 'mashed'),
        `${recipe.id} 6-8 needs a puree or mashed form`,
      ).toBe(true);
    }
  });

  it('carries the source choking warnings into the steps', () => {
    const steps = (id: string) => BATCH_6_RECIPES.find((r) => r.id === id)?.steps.join(' ') ?? '';
    expect(steps('b-icn-cottage-cheese-and-fruit-bowls')).toMatch(
      /granola and whole blueberries can be a choking risk for children under the age of 4/i,
    );
    expect(steps('b-icn-fruit-and-yogurt-roll-ups')).toMatch(
      /granola may be a choking risk for children under the age of 4/i,
    );
    const cup = steps('b-icn-chicken-and-cheese-snack-cup-with-grapes');
    expect(cup).toMatch(/large chunks of cheese cubes can be a choking risk for children under the age of 4/i);
    expect(cup).toMatch(/use shredded cheese/i);
    const mix = steps('b-icn-dried-fruit-and-cereal-snack-mix');
    expect(mix).toMatch(/dried fruit can be a choking risk for children under the age of 4/i);
    expect(mix).toMatch(/without dried fruit, combine the cereals in a bowl, toss, and serve 1\/2 cup/i);
    expect(steps('b-icn-strawberry-and-waffle-kebabs-with-maple-yogurt-dip')).toMatch(
      /for children under the age of 4, you may want to cut whole strawberries in half/i,
    );
  });

  it('records the plain yogurt and shredded cheese choices, and uses the page serving wording for the dip', () => {
    const find = (id: string) => BATCH_6_RECIPES.find((r) => r.id === id);
    expect(find('b-fh-un-beet-able-berry-smoothie')?.source?.adaptations).toContain(
      'Source offers plain or vanilla yogurt; plain used.',
    );
    expect(find('b-fh-un-beet-able-berry-smoothie')?.ingredients.map((i) => i.name).join(' ')).not.toMatch(/vanilla/i);
    const cheese = find('b-icn-chicken-and-cheese-snack-cup-with-grapes');
    expect(cheese?.ingredients.some((i) => /shredded/i.test(i.name))).toBe(true);
    expect(cheese?.ingredients.map((i) => i.name).join(' ')).not.toMatch(/diced cheese|cheese, 1\/4 inch/i);
    expect(find('b-fh-pumpkin-fruit-dip')?.steps.join(' ')).toContain('Serve with apple slices, bananas or grapes.');
    for (const id of ['b-icn-marinated-black-bean-salad', 'b-icn-black-beans-with-plantains']) {
      expect(find(id)?.source?.adaptations, id).toContain('Used the canned black beans option.');
    }
    const names = (id: string) => find(id)?.ingredients.map((i) => i.name) ?? [];
    expect(names('b-fh-barley-bean-and-corn-salad')).toContain('kidney beans, drained and rinsed (1 can, 15 ounces)');
    expect(names('b-fh-chicken-and-black-bean-salsa-burritos')).toContain('black beans, drained and rinsed (1 can, 15 ounces)');
    expect(names('b-fh-garden-sloppy-joes')).toEqual(
      expect.arrayContaining(['tomato sauce (1 can, 8 ounces)', 'whole tomatoes, crushed (1 can, 15 ounces)']),
    );
    expect(names('b-icn-easy-overnight-oats-and-berries')).toContain('honey, pasteurized');
  });

  it('batch 6 adds recipes to the gap cells and to soy', () => {
    const cellCount = (stage: StageId, effort: Effort) =>
      BATCH_6_RECIPES.filter((r) => r.stages.includes(stage) && recipeEffort(r) === effort).length;
    expect(cellCount('24-36', 'easy')).toBeGreaterThanOrEqual(15);
    expect(cellCount('12-23', 'easy')).toBeGreaterThanOrEqual(3);
    expect(cellCount('6-8', 'easy')).toBeGreaterThanOrEqual(1);
    expect(cellCount('24-36', 'more')).toBeGreaterThanOrEqual(16);
    expect(cellCount('12-23', 'more')).toBeGreaterThanOrEqual(6);
    expect(cellCount('9-12', 'more')).toBeGreaterThanOrEqual(1);
    expect(cellCount('24-36', 'medium')).toBeGreaterThanOrEqual(10);
    const groupCount = (group: string) =>
      BATCH_6_RECIPES.filter((r) => BATCH_6_EXPECTED[r.id].allergens.includes(group)).length;
    expect(groupCount('soy')).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Batch 7 (task 14.3): Texas WIC, Minnesota WIC, ICN and Food Hero recipes for
// the cells still under the hard minimum (Easy 24-36 and 12-23, 6-8 Medium,
// 9-12 More, 12-23 More)
// ---------------------------------------------------------------------------
const TX = 'Texas WIC, Texas Health and Human Services';
const MN = 'Minnesota Department of Health, WIC Program';
const BATCH_7_EXPECTED: Record<string, Batch3Expectation> = {
  'b-tx-savory-carrot-squash-baby-food': { publisher: TX, stages: ['6-8', '9-12'], serveAs: ['puree'], allergens: [], servings: 5 },
  'b-tx-spiced-apple-pear-baby-food': { publisher: TX, stages: ['6-8', '9-12'], serveAs: ['puree'], allergens: [], servings: 6 },
  'b-tx-mixed-green-veggie-baby-food': { publisher: TX, stages: ['6-8', '9-12'], serveAs: ['puree'], allergens: [], servings: 6 },
  'b-tx-creamy-avocado-berry-baby-food': { publisher: TX, stages: ['6-8', '9-12'], serveAs: ['puree'], allergens: [], servings: 5 },
  'b-tx-white-bean-and-red-pepper-baby-food': { publisher: TX, stages: ['6-8', '9-12'], serveAs: ['puree'], allergens: [], servings: 5 },
  'b-tx-easy-peanut-butter-baby-cereal': { publisher: TX, stages: ['6-8', '9-12'], serveAs: ['puree'], allergens: ['peanut'], servings: 1 },
  'b-tx-babys-first-pancakes': { publisher: TX, stages: ['9-12', '12-23'], serveAs: ['finger-food'], allergens: ['egg', 'wheat'], servings: 10 },
  'b-tx-lemon-cauliflower-bites': { publisher: TX, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: [], servings: 4 },
  'b-tx-zucchinibini-snack-bites': { publisher: TX, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['dairy'], servings: 2 },
  'b-tx-old-fashioned-french-toast': { publisher: TX, stages: ['9-12', '12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 4 },
  'b-tx-tex-mex-brown-rice': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-tx-creamy-pasta-primavera': { publisher: TX, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 2 },
  'b-tx-summer-squash-skillet': { publisher: TX, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-tx-dal-fry': { publisher: TX, stages: ['12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: [], servings: 4 },
  'b-tx-egg-roll-in-a-bowl': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy', 'wheat'], servings: 4 },
  'b-tx-homemade-chicken-nuggets': { publisher: TX, stages: ['12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy'], servings: 4 },
  'b-tx-baked-sweet-potato-bites': { publisher: TX, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['dairy'], servings: 4 },
  'b-tx-texas-breakfast-scramble': { publisher: TX, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg'], servings: 4 },
  'b-tx-easy-homemade-chicken-salad': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4 },
  'b-tx-spinach-salad-with-citrus-dressing': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['egg'], servings: 4 },
  'b-tx-easy-black-bean-breakfast-tacos': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg'], servings: 8 },
  'b-tx-apple-grilled-cheese-sandwiches': { publisher: TX, stages: ['12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'wheat'], servings: 4 },
  'b-tx-southwest-snack-pizzas': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4 },
  'b-tx-tropical-fruit-parfait': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4 },
  'b-tx-funny-face-snack-bread': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['peanut', 'wheat'], servings: 2 },
  'b-tx-tex-mex-tortilla-casserole': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8 },
  'b-tx-chicken-tortilla-soup': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 7 },
  'b-tx-sheet-pan-roasted-sausage-and-vegetables': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-mn-zucchini-mix': { publisher: MN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4 },
  'b-mn-quesadillas': { publisher: MN, stages: ['12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy'], servings: 4 },
  'b-mn-black-bean-soup': { publisher: MN, stages: ['24-36'], serveAs: ['mashed', 'pieces'], allergens: [], servings: 4 },
  'b-mn-lentils-and-rice': { publisher: MN, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4 },
  'b-mn-bean-chowder': { publisher: MN, stages: ['12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: ['dairy'], servings: 4 },
  'b-mn-falafel': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'wheat'], servings: 8 },
  'b-mn-veggie-burgers': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['egg', 'wheat'], servings: 4 },
  'b-mn-mini-pizzas': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4 },
  'b-mn-onion-dip': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-mn-salsa': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 4 },
  'b-mn-guacamole': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 8 },
  'b-mn-peanut-butter-balls': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'peanut'], servings: 12 },
  'b-icn-whipped-cream-cheese-and-pear-toast': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 6 },
  'b-icn-barbecue-beef-sliders': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['wheat'], servings: 6 },
  'b-icn-ground-turkey-wraps-or-pinwheels': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 6 },
  'b-icn-curried-chicken-wraps': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 6 },
  'b-fh-pumpkin-pudding': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
};

/** Ingredients the sources list but that were left out; the adaptation must say so. */
const BATCH_7_LEFT_OUT: Record<string, { adaptation: string; absent: RegExp }[]> = {
  'b-tx-lemon-cauliflower-bites': [{ adaptation: 'Left out the salt in "salt and pepper to taste"', absent: /\bsalt\b/i }],
  'b-tx-old-fashioned-french-toast': [{ adaptation: 'Left out optional 1/8 teaspoon salt', absent: /\bsalt\b/i }, { adaptation: 'Left out the optional powdered sugar and cinnamon topping', absent: /powdered/i }],
  'b-tx-summer-squash-skillet': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }, { adaptation: 'Left out 1/2 teaspoon sugar', absent: /sugar/i }],
  'b-tx-dal-fry': [{ adaptation: 'Left out the salt in "salt to taste"', absent: /\bsalt\b/i }],
  'b-tx-texas-breakfast-scramble': [{ adaptation: 'Left out the salt in "salt and pepper to taste"', absent: /\bsalt\b/i }],
  'b-mn-lentils-and-rice': [{ adaptation: 'Left out the salt in "salt and pepper to taste"', absent: /\bsalt\b/i }],
  'b-mn-bean-chowder': [{ adaptation: 'Left out 1 teaspoon salt', absent: /\bsalt\b/i }],
};

/** Batch 7 recipes that keep salt, sugar or soy sauce because they are tagged 24-36 only (the screen does not block them at that age). */
const BATCH_7_KEEPS_BLOCKED_AT_24 = [
  'b-tx-tex-mex-brown-rice',
  'b-tx-egg-roll-in-a-bowl',
  'b-tx-baked-sweet-potato-bites',
  'b-tx-easy-homemade-chicken-salad',
  'b-tx-easy-black-bean-breakfast-tacos',
  'b-tx-sheet-pan-roasted-sausage-and-vegetables',
  'b-mn-salsa',
  'b-fh-pumpkin-pudding',
];

/** Pages (or ICN versions) that state their own serving count (no estimate needed). */
const BATCH_7_SOURCE_SERVINGS = [
  'b-tx-savory-carrot-squash-baby-food',
  'b-tx-spiced-apple-pear-baby-food',
  'b-tx-mixed-green-veggie-baby-food',
  'b-tx-creamy-avocado-berry-baby-food',
  'b-tx-white-bean-and-red-pepper-baby-food',
  'b-tx-easy-peanut-butter-baby-cereal',
  'b-tx-babys-first-pancakes',
  'b-tx-lemon-cauliflower-bites',
  'b-tx-zucchinibini-snack-bites',
  'b-tx-old-fashioned-french-toast',
  'b-tx-tex-mex-brown-rice',
  'b-tx-creamy-pasta-primavera',
  'b-tx-summer-squash-skillet',
  'b-tx-dal-fry',
  'b-tx-egg-roll-in-a-bowl',
  'b-tx-homemade-chicken-nuggets',
  'b-tx-baked-sweet-potato-bites',
  'b-tx-texas-breakfast-scramble',
  'b-tx-easy-homemade-chicken-salad',
  'b-tx-spinach-salad-with-citrus-dressing',
  'b-tx-easy-black-bean-breakfast-tacos',
  'b-tx-apple-grilled-cheese-sandwiches',
  'b-tx-southwest-snack-pizzas',
  'b-tx-tropical-fruit-parfait',
  'b-tx-funny-face-snack-bread',
  'b-tx-tex-mex-tortilla-casserole',
  'b-tx-chicken-tortilla-soup',
  'b-tx-sheet-pan-roasted-sausage-and-vegetables',
  'b-mn-zucchini-mix',
  'b-mn-quesadillas',
  'b-mn-black-bean-soup',
  'b-mn-lentils-and-rice',
  'b-mn-bean-chowder',
  'b-mn-falafel',
  'b-mn-veggie-burgers',
  'b-mn-mini-pizzas',
  'b-mn-onion-dip',
  'b-mn-salsa',
  'b-mn-guacamole',
  'b-mn-peanut-butter-balls',
  'b-icn-whipped-cream-cheese-and-pear-toast',
  'b-icn-barbecue-beef-sliders',
  'b-icn-ground-turkey-wraps-or-pinwheels',
  'b-icn-curried-chicken-wraps',
];

describe('BUILTIN_RECIPES - batch 7', () => {
  it('has a pinned expectation for exactly the batch 7 recipes', () => {
    expect(BATCH_7_RECIPES.map((r) => r.id).sort()).toEqual(Object.keys(BATCH_7_EXPECTED).sort());
    expect(BATCH_7_RECIPES.length).toBeGreaterThanOrEqual(45);
    expect(BATCH_7_RECIPES.length).toBeLessThanOrEqual(55);
  });

  it('every batch 7 recipe is a full recipe with serveAs and at least one quantity', () => {
    for (const recipe of BATCH_7_RECIPES) {
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

  it('every batch 7 source is an https page on an allowed host and a listed publisher', () => {
    for (const recipe of BATCH_7_RECIPES) {
      const source = recipe.source;
      expect(source, recipe.id).toBeDefined();
      if (!source) continue;
      const url = new URL(source.url);
      expect(url.protocol, recipe.id).toBe('https:');
      expect(ALLOWED_HOSTS, `${recipe.id} host ${url.hostname}`).toContain(url.hostname);
      expect(sourcesDoc, `${recipe.id} publisher is in docs/recipe-sources.md`).toContain(source.publisher);
      expect(source.retrieved, recipe.id).toBe('2026-11-12');
      expect(source.title.trim().length, recipe.id).toBeGreaterThan(0);
    }
  });

  it('the Texas WIC publisher row is in docs/recipe-sources.md, pending pr-reviewer, and the Minnesota WIC row is approved', () => {
    const tx = sourcesDoc.split('\n').find((line) => line.includes(TX));
    expect(tx, 'Texas WIC row').toBeDefined();
    expect(tx).toContain('texaswic.org');
    expect(tx).toMatch(/Pending pr-reviewer|Approved by pr-reviewer \(PR #\d+\)|Approved by maintainer \(#\d+\)/);
    const mn = sourcesDoc.split('\n').find((line) => line.includes(MN));
    expect(mn, 'Minnesota WIC row').toBeDefined();
    expect(mn).toContain('Approved by maintainer (v1 spec)');
  });

  it('pins publisher, stages, serveAs and servings for each recipe', () => {
    for (const recipe of BATCH_7_RECIPES) {
      const expected = BATCH_7_EXPECTED[recipe.id];
      expect(recipe.source?.publisher, `${recipe.id} publisher`).toBe(expected.publisher);
      expect(recipe.stages, `${recipe.id} stages`).toEqual(expected.stages);
      expect(recipe.serveAs, `${recipe.id} serveAs`).toEqual(expected.serveAs);
      expect(recipe.servings, `${recipe.id} servings`).toBe(expected.servings);
    }
  });

  it('ICN recipes use the source serving count and estimates are disclosed', () => {
    for (const recipe of BATCH_7_RECIPES) {
      const expected = BATCH_7_EXPECTED[recipe.id];
      const adaptations = recipe.source?.adaptations ?? [];
      const estimates = adaptations.filter((a) => a.startsWith('Serving count is an estimate'));
      if (expected.estimateNote) expect(estimates, recipe.id).toEqual([expected.estimateNote]);
      else expect(estimates, recipe.id).toEqual([]);
      if (expected.publisher === ICN) expect(recipe.servings, recipe.id).toBe(6);
      else if (!expected.estimateNote) expect(BATCH_7_SOURCE_SERVINGS, recipe.id).toContain(recipe.id);
    }
  });

  it('pins the allergen groups of each recipe from the real screen', () => {
    for (const recipe of BATCH_7_RECIPES) {
      const groups = [...new Set(screenRecipe(recipe, 12).allergens.map((f) => f.label))].sort();
      expect(groups, `${recipe.id} allergen groups`).toEqual(BATCH_7_EXPECTED[recipe.id].allergens);
    }
  });

  it('no batch 7 recipe has a block at 24 months; blocked-at-12 ones are tagged 24-36 only', () => {
    for (const recipe of BATCH_7_RECIPES) {
      expect(screenRecipe(recipe, 24).blocks, `${recipe.id} is safe at 24 months`).toEqual([]);
      if (screenRecipe(recipe, 12).blocks.length > 0) {
        expect(recipe.stages, recipe.id).toEqual(['24-36']);
        expect(BATCH_7_KEEPS_BLOCKED_AT_24, recipe.id).toContain(recipe.id);
      }
    }
  });

  it('no batch 7 recipe has a block at the youngest age of any stage it is tagged for', () => {
    for (const recipe of BATCH_7_RECIPES) {
      for (const stage of recipe.stages) {
        expect(
          screenRecipe(recipe, STAGE_MIN_MONTHS[stage]).blocks,
          `${recipe.id} at ${stage}`,
        ).toEqual([]);
      }
    }
  });

  it('tagged stages younger than 24 months contain no salt, sugar, soy sauce, honey or bouillon', () => {
    for (const recipe of BATCH_7_RECIPES) {
      if (!recipe.stages.some((s) => s !== '24-36')) continue;
      const text = [...recipe.ingredients.map((i) => i.name), ...recipe.steps].join(' ');
      expect(text, `${recipe.id} text`).not.toMatch(/\b(salt|sugar|soy sauce|honey|bouillon|maple syrup|agave)\b/i);
    }
  });

  it('recipes tagged 6-8 or 9-12 contain no juice other than lemon or lime', () => {
    for (const recipe of BATCH_7_RECIPES) {
      if (!recipe.stages.some((s) => s === '6-8' || s === '9-12')) continue;
      for (const ingredient of recipe.ingredients) {
        const name = ingredient.name.toLowerCase().replace(/\b(lemon|lime) juice\b/g, '');
        expect(name, `${recipe.id} ingredient`).not.toMatch(/juice/);
      }
    }
  });

  it('every "Left out" adaptation matches an absent ingredient, and none is missing', () => {
    for (const recipe of BATCH_7_RECIPES) {
      const adaptations = recipe.source?.adaptations ?? [];
      const leftOut = adaptations.filter((a) => a.startsWith('Left out'));
      const expected = BATCH_7_LEFT_OUT[recipe.id] ?? [];
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

  it('recipes that keep salt, sugar or soy sauce are exactly the 24-36 only ones listed', () => {
    for (const recipe of BATCH_7_RECIPES) {
      const keeps = recipe.ingredients.some((i) => /\b(salt|sugar|soy sauce|maple syrup)\b/i.test(i.name));
      expect(keeps, recipe.id).toBe(BATCH_7_KEEPS_BLOCKED_AT_24.includes(recipe.id));
    }
  });

  it('recipes with nut pieces are tagged 24-36 only', () => {
    const nutPieces = /\b(chopped|sliced|slivered|crushed|toasted|pieces)\b.*\b(nuts?|almonds?|walnuts?|pecans?|peanuts?|cashews?|pistachios?)\b|\b(nuts?|almonds?|walnuts?|pecans?|peanuts?|cashews?|pistachios?)\b.*\b(chopped|sliced|slivered|crushed|pieces)\b/i;
    for (const recipe of BATCH_7_RECIPES) {
      if (!recipe.ingredients.some((i) => nutPieces.test(i.name))) continue;
      expect(recipe.stages, recipe.id).toEqual(['24-36']);
    }
  });

  it('puree or mash only recipes are not tagged for toddler stages', () => {
    for (const recipe of BATCH_7_RECIPES) {
      const softPieces = recipe.serveAs?.some((s) => s === 'pieces' || s === 'finger-food');
      if (!softPieces) {
        expect(recipe.stages.includes('12-23') || recipe.stages.includes('24-36'), recipe.id).toBe(false);
      }
    }
  });

  it('no 6-8 recipe is served as pieces or finger food only', () => {
    for (const recipe of BATCH_7_RECIPES) {
      if (!recipe.stages.includes('6-8')) continue;
      expect(
        recipe.serveAs?.some((s) => s === 'puree' || s === 'mashed'),
        `${recipe.id} 6-8 needs a puree or mashed form`,
      ).toBe(true);
    }
  });

  it('carries the source choking warnings into the steps', () => {
    const steps = (id: string) => BATCH_7_RECIPES.find((r) => r.id === id)?.steps.join(' ') ?? '';
    expect(steps('b-tx-easy-peanut-butter-baby-cereal')).toMatch(/do not give a baby chunky peanut butter or whole peanuts/i);
    expect(steps('b-tx-apple-grilled-cheese-sandwiches')).toMatch(/slice the apples thin for young children/i);
    expect(steps('b-tx-dal-fry')).toMatch(/take out any whole chilies before serving/i);
    expect(steps('b-icn-curried-chicken-wraps')).toMatch(
      /children under 4 can choke on dried fruit such as raisins/i,
    );
    expect(steps('b-tx-old-fashioned-french-toast')).toMatch(/cut the French toast into long thin strips/i);
    expect(steps('b-tx-lemon-cauliflower-bites')).toMatch(/squishy and tender/i);
    const nuggets = BATCH_7_RECIPES.find((r) => r.id === 'b-tx-homemade-chicken-nuggets');
    const lastStep = nuggets?.steps[nuggets.steps.length - 1] ?? '';
    expect(lastStep).toMatch(/crush the cornflakes into a powder/i);
    expect(lastStep).toMatch(/cut the baked nuggets into strips/i);
  });

  it('records the option each page offered, and the Texas WIC baby foods carry the storage advice', () => {
    const find = (id: string) => BATCH_7_RECIPES.find((r) => r.id === id);
    expect(find('b-tx-tex-mex-brown-rice')?.source?.adaptations).toContain('Used the water option instead of chicken broth.');
    expect(find('b-mn-quesadillas')?.source?.adaptations).toContain('Used corn tortillas and Monterey Jack cheese, two of the page options.');
    expect(find('b-mn-black-bean-soup')?.source?.adaptations).toContain('Used the vegetable broth option.');
    expect(find('b-mn-onion-dip')?.source?.adaptations).toContain('Used the dry onion soup mix option.');
    for (const id of ['b-tx-savory-carrot-squash-baby-food', 'b-tx-spiced-apple-pear-baby-food', 'b-tx-mixed-green-veggie-baby-food', 'b-tx-creamy-avocado-berry-baby-food', 'b-tx-white-bean-and-red-pepper-baby-food']) {
      expect(find(id)?.steps.join(' '), id).toMatch(/do not save leftovers from the portion your baby eats from/i);
      expect(find(id)?.stages, id).toEqual(['6-8', '9-12']);
      expect(find(id)?.serveAs, id).toEqual(['puree']);
    }
    const names = (id: string) => find(id)?.ingredients.map((i) => i.name) ?? [];
    expect(names('b-mn-black-bean-soup')).toContain('black beans, with liquid (2 cans, 15 ounces each)');
    expect(names('b-tx-white-bean-and-red-pepper-baby-food')).toContain('white beans, such as navy, cannellini or great northern (1 can, 15 ounces)');
  });

  it('batch 7 adds recipes to the cells still under their hard minimum', () => {
    const cellCount = (stage: StageId, effort: Effort) =>
      BATCH_7_RECIPES.filter((r) => r.stages.includes(stage) && recipeEffort(r) === effort).length;
    expect(cellCount('24-36', 'easy')).toBeGreaterThanOrEqual(16);
    expect(cellCount('12-23', 'easy')).toBeGreaterThanOrEqual(5);
    expect(cellCount('6-8', 'medium')).toBeGreaterThanOrEqual(3);
    expect(cellCount('9-12', 'more')).toBeGreaterThanOrEqual(1);
    expect(cellCount('12-23', 'more')).toBeGreaterThanOrEqual(5);
    const groupCount = (group: string) =>
      BATCH_7_RECIPES.filter((r) => BATCH_7_EXPECTED[r.id].allergens.includes(group)).length;
    expect(groupCount('peanut')).toBeGreaterThanOrEqual(1);
  });
});


// ---------------------------------------------------------------------------
// Batch 8 (task 14.3): UNL Food (Nebraska Extension), Texas WIC, Minnesota
// WIC, ICN and Food Hero recipes for the cells still under the hard minimum
// (12-23 Easy, 9-12 More) and the total
// ---------------------------------------------------------------------------
const UNL = 'UNL Food, Nebraska Extension, University of Nebraska-Lincoln';
const BATCH_8_EXPECTED: Record<string, Batch3Expectation> = {
  'b-tx-frozen-fruit-juice-pops': { publisher: TX, stages: ['12-23', '24-36'], serveAs: ['finger-food'], allergens: [], servings: 12 },
  'b-tx-frozen-chocolate-pops': { publisher: TX, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['dairy'], servings: 4 },
  'b-tx-babys-first-cookie-bites': { publisher: TX, stages: ['9-12', '12-23'], serveAs: ['finger-food'], allergens: ['wheat'], servings: 20 },
  'b-tx-sweet-potato-pecan-pancakes': { publisher: TX, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'tree nuts', 'wheat'], servings: 6 },
  'b-tx-avocado-chicken-pesto-wraps': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'tree nuts', 'wheat'], servings: 4 },
  'b-tx-cinnamon-carrot-bread': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['egg', 'tree nuts', 'wheat'], servings: 12 },
  'b-tx-cheesy-stuffed-zucchini': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 6 },
  'b-icn-pizza-green-beans': { publisher: ICN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-icn-chickpeas-and-tomatoes': { publisher: ICN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-icn-shredded-zucchini-and-pasta': { publisher: ICN, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 6 },
  'b-icn-veggie-stir-fry-with-ginger': { publisher: ICN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-icn-curry-vegetables': { publisher: ICN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-icn-collard-greens': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-icn-chicken-alfredo-with-a-twist': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 6 },
  'b-icn-pork-loin-with-rice-and-gravy': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-icn-chicken-and-waffles-with-maple-peach-glaze': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['wheat'], servings: 6 },
  'b-mn-seasoned-rice': { publisher: MN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-mn-goulash': { publisher: MN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['wheat'], servings: 8 },
  'b-mn-black-eyed-pea-soup': { publisher: MN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-mn-fajitas': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy', 'wheat'], servings: 4 },
  'b-mn-pot-roast': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 8 },
  'b-mn-tortilla-roll-ups': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'soy'], servings: 6 },
  'b-mn-chicken-and-wild-rice-soup': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 8 },
  'b-mn-three-bean-hotdish': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-mn-spaghetti-sauce': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-mn-couscous': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['wheat'], servings: 6 },
  'b-mn-wild-rice-with-mushrooms-and-almonds': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'tree nuts'], servings: 6 },
  'b-fh-quick-tomato-pasta-sauce': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 8, estimateNote: ESTIMATE_QUARTER_CUP },
  'b-fh-tropical-beets': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-butternut-squash-and-chile-pan-fry': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 14, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-lentil-soup-with-lime-juice': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 9, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-spring-fling-vegetable-chowder': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-kale-and-cranberry-stir-fry': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 10, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-tuna-pasta-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['fish', 'wheat'], servings: 12, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-veggie-stew': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 8, estimateNote: ESTIMATE_ONE_CUP },
  'b-unl-green-fruit-salad': { publisher: UNL, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 1 },
  'b-unl-frozen-fruit-cups': { publisher: UNL, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-unl-basic-omelet': { publisher: UNL, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg'], servings: 2 },
  'b-unl-egg-and-cheese-muffin': { publisher: UNL, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'wheat'], servings: 1 },
  'b-unl-zoats': { publisher: UNL, stages: ['12-23', '24-36'], serveAs: ['mashed', 'pieces'], allergens: ['peanut'], servings: 4 },
  'b-unl-sauteed-eggplant-with-okra': { publisher: UNL, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 8 },
  'b-unl-cider-braised-cabbage': { publisher: UNL, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4 },
  'b-unl-slow-cooker-hamburger-stew': { publisher: UNL, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 4 },
  'b-unl-okra-succotash': { publisher: UNL, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-unl-shakshuka-with-toast': { publisher: UNL, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: ['egg', 'wheat'], servings: 4 },
  'b-unl-lamb-soup-shorba': { publisher: UNL, stages: ['6-8', '9-12', '12-23', '24-36'], serveAs: ['puree', 'pieces'], allergens: [], servings: 8 },
  'b-unl-super-quick-beans-and-rice': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 4 },
  'b-unl-sauteed-garlic-scapes': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 4 },
  'b-unl-cheeseburger-lettuce-wraps': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8 },
};

/** Ingredients the sources list but that were left out; the adaptation must say so. */
const BATCH_8_LEFT_OUT: Record<string, { adaptation: string; absent: RegExp }[]> = {
  'b-icn-pizza-green-beans': [{ adaptation: 'Left out 1/2 teaspoon kosher salt', absent: /\bsalt\b/i }],
  'b-icn-shredded-zucchini-and-pasta': [{ adaptation: 'Left out 1/4 teaspoon table salt', absent: /\bsalt\b/i }],
  'b-icn-veggie-stir-fry-with-ginger': [{ adaptation: 'Left out 1/2 teaspoon granulated sugar', absent: /sugar/i }, { adaptation: 'Left out 1/4 teaspoon table salt', absent: /\bsalt\b/i }],
  'b-icn-curry-vegetables': [{ adaptation: 'Left out 1/4 teaspoon table salt', absent: /\bsalt\b/i }],
  'b-mn-seasoned-rice': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-mn-goulash': [{ adaptation: 'Left out the salt and the optional seasoned salt in "1/4 tsp each: chili powder, salt, pepper, and seasoned salt (optional)"', absent: /\bsalt\b/i }],
  'b-mn-black-eyed-pea-soup': [{ adaptation: 'Left out the salt in "salt to taste"', absent: /\bsalt\b/i }],
  'b-fh-quick-tomato-pasta-sauce': [{ adaptation: 'Left out the 1/4 teaspoon salt in "1/4 teaspoon each salt and black pepper"', absent: /\bsalt\b/i }],
  'b-fh-tropical-beets': [{ adaptation: 'Left out 2 tablespoons brown sugar', absent: /sugar/i }, { adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-butternut-squash-and-chile-pan-fry': [{ adaptation: 'Left out 1 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-lentil-soup-with-lime-juice': [{ adaptation: 'Left out 1 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-spring-fling-vegetable-chowder': [{ adaptation: 'Left out the optional 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-unl-basic-omelet': [
    { adaptation: 'Left out the optional 1/4 teaspoon salt', absent: /\bsalt\b/i },
    { adaptation: 'Left out the optional ham and turkey (cured meat) fillings; vegetables and cheese stay', absent: /\bham\b/i },
  ],
  'b-unl-zoats': [{ adaptation: 'Left out the optional chocolate chips (added sugar)', absent: /chocolate\schips/i }],
  'b-unl-egg-and-cheese-muffin': [{ adaptation: 'Left out the salt in "salt and pepper, to taste"', absent: /\bsalt\b/i }],
  'b-unl-sauteed-eggplant-with-okra': [{ adaptation: 'Left out the optional 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-unl-cider-braised-cabbage': [{ adaptation: 'Left out the salt in "salt and pepper, to taste"', absent: /\bsalt\b/i }],
  'b-unl-okra-succotash': [{ adaptation: 'Left out the optional 1 teaspoon salt', absent: /\bsalt\b/i }],
  'b-unl-shakshuka-with-toast': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-unl-lamb-soup-shorba': [{ adaptation: 'Left out the optional 1 teaspoon salt', absent: /\bsalt\b/i }, { adaptation: 'Left out the 2 optional small chicken bouillon cubes', absent: /bouillon/i }],
};

/** Batch 8 recipes that keep salt, sugar, soy sauce or maple syrup because they are tagged 24-36 only (the screen does not block them at that age). */
const BATCH_8_KEEPS_BLOCKED_AT_24 = [
  'b-tx-avocado-chicken-pesto-wraps',
  'b-tx-cinnamon-carrot-bread',
  'b-icn-pork-loin-with-rice-and-gravy',
  'b-icn-chicken-and-waffles-with-maple-peach-glaze',
  'b-mn-chicken-and-wild-rice-soup',
  'b-mn-three-bean-hotdish',
  'b-mn-spaghetti-sauce',
  'b-mn-couscous',
  'b-fh-veggie-stew',
  'b-unl-sauteed-garlic-scapes',
  'b-unl-cheeseburger-lettuce-wraps',
];

/** Pages (or ICN versions) that state their own serving count (no estimate needed). */
const BATCH_8_SOURCE_SERVINGS = [
  'b-tx-frozen-fruit-juice-pops',
  'b-tx-frozen-chocolate-pops',
  'b-tx-babys-first-cookie-bites',
  'b-tx-sweet-potato-pecan-pancakes',
  'b-tx-avocado-chicken-pesto-wraps',
  'b-tx-cinnamon-carrot-bread',
  'b-tx-cheesy-stuffed-zucchini',
  'b-icn-pizza-green-beans',
  'b-icn-chickpeas-and-tomatoes',
  'b-icn-shredded-zucchini-and-pasta',
  'b-icn-veggie-stir-fry-with-ginger',
  'b-icn-curry-vegetables',
  'b-icn-collard-greens',
  'b-icn-chicken-alfredo-with-a-twist',
  'b-icn-pork-loin-with-rice-and-gravy',
  'b-icn-chicken-and-waffles-with-maple-peach-glaze',
  'b-mn-seasoned-rice',
  'b-mn-goulash',
  'b-mn-black-eyed-pea-soup',
  'b-mn-fajitas',
  'b-mn-pot-roast',
  'b-mn-tortilla-roll-ups',
  'b-mn-chicken-and-wild-rice-soup',
  'b-mn-three-bean-hotdish',
  'b-mn-spaghetti-sauce',
  'b-mn-couscous',
  'b-mn-wild-rice-with-mushrooms-and-almonds',
  'b-unl-green-fruit-salad',
  'b-unl-frozen-fruit-cups',
  'b-unl-basic-omelet',
  'b-unl-egg-and-cheese-muffin',
  'b-unl-zoats',
  'b-unl-sauteed-eggplant-with-okra',
  'b-unl-cider-braised-cabbage',
  'b-unl-slow-cooker-hamburger-stew',
  'b-unl-okra-succotash',
  'b-unl-shakshuka-with-toast',
  'b-unl-lamb-soup-shorba',
  'b-unl-super-quick-beans-and-rice',
  'b-unl-sauteed-garlic-scapes',
  'b-unl-cheeseburger-lettuce-wraps',
];

describe('BUILTIN_RECIPES - batch 8', () => {
  it('has a pinned expectation for exactly the batch 8 recipes', () => {
    expect(BATCH_8_RECIPES.map((r) => r.id).sort()).toEqual(Object.keys(BATCH_8_EXPECTED).sort());
    expect(BATCH_8_RECIPES.length).toBeGreaterThanOrEqual(49);
    expect(BATCH_8_RECIPES.length).toBeLessThanOrEqual(55);
  });

  it('every batch 8 recipe is a full recipe with serveAs and at least one quantity', () => {
    for (const recipe of BATCH_8_RECIPES) {
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

  it('every batch 8 source is an https page on an allowed host and a listed publisher', () => {
    for (const recipe of BATCH_8_RECIPES) {
      const source = recipe.source;
      expect(source, recipe.id).toBeDefined();
      if (!source) continue;
      const url = new URL(source.url);
      expect(url.protocol, recipe.id).toBe('https:');
      expect(ALLOWED_HOSTS, `${recipe.id} host ${url.hostname}`).toContain(url.hostname);
      expect(sourcesDoc, `${recipe.id} publisher is in docs/recipe-sources.md`).toContain(source.publisher);
      expect(source.retrieved, recipe.id).toBe('2026-11-12');
      expect(source.title.trim().length, recipe.id).toBeGreaterThan(0);
    }
  });

  it('the UNL Food publisher row is in docs/recipe-sources.md, pending pr-reviewer, and the Texas WIC row is approved', () => {
    const unl = sourcesDoc.split('\n').find((line) => line.includes(UNL));
    expect(unl, 'UNL Food row').toBeDefined();
    expect(unl).toContain('food.unl.edu');
    expect(unl).toMatch(/Pending pr-reviewer|Approved by pr-reviewer \(PR #\d+\)|Approved by maintainer \(#\d+\)/);
    const tx = sourcesDoc.split('\n').find((line) => line.includes(TX));
    expect(tx, 'Texas WIC row').toBeDefined();
    expect(tx).toMatch(/Approved by maintainer \(#\d+\)|Approved by pr-reviewer \(PR #\d+\)/);
  });

  it('pins publisher, stages, serveAs and servings for each recipe', () => {
    for (const recipe of BATCH_8_RECIPES) {
      const expected = BATCH_8_EXPECTED[recipe.id];
      expect(recipe.source?.publisher, `${recipe.id} publisher`).toBe(expected.publisher);
      expect(recipe.stages, `${recipe.id} stages`).toEqual(expected.stages);
      expect(recipe.serveAs, `${recipe.id} serveAs`).toEqual(expected.serveAs);
      expect(recipe.servings, `${recipe.id} servings`).toBe(expected.servings);
    }
  });

  it('ICN recipes use the source serving count and estimates are disclosed', () => {
    for (const recipe of BATCH_8_RECIPES) {
      const expected = BATCH_8_EXPECTED[recipe.id];
      const adaptations = recipe.source?.adaptations ?? [];
      const estimates = adaptations.filter((a) => a.startsWith('Serving count is an estimate'));
      if (expected.estimateNote) expect(estimates, recipe.id).toEqual([expected.estimateNote]);
      else expect(estimates, recipe.id).toEqual([]);
      if (expected.publisher === ICN) expect(recipe.servings, recipe.id).toBe(6);
      else if (!expected.estimateNote) expect(BATCH_8_SOURCE_SERVINGS, recipe.id).toContain(recipe.id);
    }
  });

  it('pins the allergen groups of each recipe from the real screen', () => {
    for (const recipe of BATCH_8_RECIPES) {
      const groups = [...new Set(screenRecipe(recipe, 12).allergens.map((f) => f.label))].sort();
      expect(groups, `${recipe.id} allergen groups`).toEqual(BATCH_8_EXPECTED[recipe.id].allergens);
    }
  });

  it('no batch 8 recipe has a block at 24 months; blocked-at-12 ones are tagged 24-36 only', () => {
    for (const recipe of BATCH_8_RECIPES) {
      expect(screenRecipe(recipe, 24).blocks, `${recipe.id} is safe at 24 months`).toEqual([]);
      if (screenRecipe(recipe, 12).blocks.length > 0) {
        expect(recipe.stages, recipe.id).toEqual(['24-36']);
        expect(BATCH_8_KEEPS_BLOCKED_AT_24, recipe.id).toContain(recipe.id);
      }
    }
  });

  it('no batch 8 recipe has a block at the youngest age of any stage it is tagged for', () => {
    for (const recipe of BATCH_8_RECIPES) {
      for (const stage of recipe.stages) {
        expect(
          screenRecipe(recipe, STAGE_MIN_MONTHS[stage]).blocks,
          `${recipe.id} at ${stage}`,
        ).toEqual([]);
      }
    }
  });

  it('tagged stages younger than 24 months contain no salt, sugar, soy sauce, honey or bouillon', () => {
    for (const recipe of BATCH_8_RECIPES) {
      if (!recipe.stages.some((s) => s !== '24-36')) continue;
      const text = [...recipe.ingredients.map((i) => i.name), ...recipe.steps].join(' ');
      expect(text, `${recipe.id} text`).not.toMatch(/\b(salt|sugar|soy sauce|honey|bouillon|maple syrup|agave)\b/i);
    }
  });

  it('recipes tagged 6-8 or 9-12 contain no juice other than lemon or lime', () => {
    for (const recipe of BATCH_8_RECIPES) {
      if (!recipe.stages.some((s) => s === '6-8' || s === '9-12')) continue;
      for (const ingredient of recipe.ingredients) {
        const name = ingredient.name.toLowerCase().replace(/\b(lemon|lime) juice\b/g, '');
        expect(name, `${recipe.id} ingredient`).not.toMatch(/juice/);
      }
    }
  });

  it('every "Left out" adaptation matches an absent ingredient, and none is missing', () => {
    for (const recipe of BATCH_8_RECIPES) {
      const adaptations = recipe.source?.adaptations ?? [];
      const leftOut = adaptations.filter((a) => a.startsWith('Left out'));
      const expected = BATCH_8_LEFT_OUT[recipe.id] ?? [];
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

  it('recipes that keep salt, sugar or soy sauce are exactly the 24-36 only ones listed', () => {
    for (const recipe of BATCH_8_RECIPES) {
      const keeps = recipe.ingredients.some((i) => /\b(salt|sugar|soy sauce|maple syrup)\b/i.test(i.name));
      expect(keeps, recipe.id).toBe(BATCH_8_KEEPS_BLOCKED_AT_24.includes(recipe.id));
    }
  });

  it('recipes with nut pieces are tagged 24-36 only', () => {
    const nutPieces = /\b(chopped|sliced|slivered|crushed|toasted|pieces)\b.*\b(nuts?|almonds?|walnuts?|pecans?|peanuts?|cashews?|pistachios?)\b|\b(nuts?|almonds?|walnuts?|pecans?|peanuts?|cashews?|pistachios?)\b.*\b(chopped|sliced|slivered|crushed|pieces)\b/i;
    for (const recipe of BATCH_8_RECIPES) {
      if (!recipe.ingredients.some((i) => nutPieces.test(i.name))) continue;
      expect(recipe.stages, recipe.id).toEqual(['24-36']);
    }
  });

  it('puree or mash only recipes are not tagged for toddler stages', () => {
    for (const recipe of BATCH_8_RECIPES) {
      const softPieces = recipe.serveAs?.some((s) => s === 'pieces' || s === 'finger-food');
      if (!softPieces) {
        expect(recipe.stages.includes('12-23') || recipe.stages.includes('24-36'), recipe.id).toBe(false);
      }
    }
  });

  it('no 6-8 recipe is served as pieces or finger food only', () => {
    for (const recipe of BATCH_8_RECIPES) {
      if (!recipe.stages.includes('6-8')) continue;
      expect(
        recipe.serveAs?.some((s) => s === 'puree' || s === 'mashed'),
        `${recipe.id} 6-8 needs a puree or mashed form`,
      ).toBe(true);
    }
  });

  it('carries the source choking, honey and serving tips into the steps', () => {
    const steps = (id: string) => BATCH_8_RECIPES.find((r) => r.id === id)?.steps.join(' ') ?? '';
    expect(steps('b-tx-sweet-potato-pecan-pancakes')).toMatch(/leave the nuts out for babies and young children/i);
    expect(steps('b-tx-cinnamon-carrot-bread')).toMatch(/leave the nuts out for young children/i);
    expect(steps('b-tx-frozen-chocolate-pops')).toMatch(/do not give honey to a child under 1 year old/i);
    expect(steps('b-unl-lamb-soup-shorba')).toMatch(/blend the soup before serving it to small children/i);
    expect(steps('b-fh-lentil-soup-with-lime-juice')).toMatch(/take out and discard the bay leaves/i);
  });

  it('records the option each page offered and the equipment the Texas pops page lists', () => {
    const find = (id: string) => BATCH_8_RECIPES.find((r) => r.id === id);
    expect(find('b-mn-fajitas')?.source?.adaptations).toContain(
      'Used the extra firm tofu option (the page also offers 1 pound boneless beef, pork or chicken); the page steps are written for tofu.',
    );
    expect(find('b-fh-spring-fling-vegetable-chowder')?.source?.adaptations).toContain('Used water (the page offers low-sodium broth or water).');
    expect(find('b-tx-frozen-fruit-juice-pops')?.source?.adaptations?.[0]).toMatch(/ice cube tray, aluminum foil and 12 popsicle sticks/);
    const names = (id: string) => find(id)?.ingredients.map((i) => i.name) ?? [];
    expect(names('b-mn-black-eyed-pea-soup')).toContain('black-eyed peas, drained and rinsed (3 cans, 15 ounces each)');
    expect(find('b-unl-lamb-soup-shorba')?.stages).toEqual(['6-8', '9-12', '12-23', '24-36']);
    expect(find('b-unl-lamb-soup-shorba')?.serveAs).toContain('puree');
  });

  it('batch 8 adds recipes to the cells still under their hard minimum', () => {
    const cellCount = (stage: StageId, effort: Effort) =>
      BATCH_8_RECIPES.filter((r) => r.stages.includes(stage) && recipeEffort(r) === effort).length;
    expect(cellCount('12-23', 'easy')).toBeGreaterThanOrEqual(12);
    expect(cellCount('9-12', 'more')).toBeGreaterThanOrEqual(2);
    expect(BUILTIN_RECIPES.length).toBeGreaterThanOrEqual(300);
  });
});



// ---------------------------------------------------------------------------
// Batch 9 (task 14.3): UNL Food (Nebraska Extension), Food Hero and ICN
// recipes for the biggest gaps to the 500 goal, spread over the four stages
// ---------------------------------------------------------------------------
const BATCH_9_EXPECTED: Record<string, Batch3Expectation> = {
  'b-unl-fruit-puree': { publisher: UNL, stages: ['6-8', '9-12'], serveAs: ['puree'], allergens: [], servings: 2 },
  'b-unl-pear-and-parsnip-smash-up': { publisher: UNL, stages: ['6-8', '9-12'], serveAs: ['mashed'], allergens: ['dairy'], servings: 4 },
  'b-unl-elaines-green-mash-potatoes': { publisher: UNL, stages: ['6-8', '9-12'], serveAs: ['mashed'], allergens: ['dairy'], servings: 4 },
  'b-unl-curried-lentil-soup': { publisher: UNL, stages: ['12-23'], serveAs: ['pieces'], allergens: ['wheat'], servings: 6 },
  'b-unl-ham-and-egg-frittata': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg'], servings: 6 },
  'b-unl-chicken-and-rice-soup': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-unl-brown-rice-risotto': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4 },
  'b-unl-tomato-soup': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 4 },
  'b-unl-turkey-mashed-potato-soup': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-unl-dill-rice-pilaf': { publisher: UNL, stages: ['12-23'], serveAs: ['pieces'], allergens: [], servings: 4 },
  'b-unl-roasted-sweet-potatoes-and-apples': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 4 },
  'b-unl-tzatziki-dip': { publisher: UNL, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['dairy'], servings: 6 },
  'b-unl-sauteed-parmesan-asparagus': { publisher: UNL, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['dairy'], servings: 3 },
  'b-unl-lemony-green-beans': { publisher: UNL, stages: ['24-36'], serveAs: ['finger-food'], allergens: [], servings: 4 },
  'b-unl-roasted-broccoli-and-red-peppers': { publisher: UNL, stages: ['24-36'], serveAs: ['finger-food'], allergens: [], servings: 6 },
  'b-unl-butternut-squash-mac-n-cheese': { publisher: UNL, stages: ['12-23'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 6 },
  'b-unl-chicken-rice': { publisher: UNL, stages: ['12-23'], serveAs: ['pieces'], allergens: [], servings: 8 },
  'b-unl-lentil-veggie-tacos': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 5 },
  'b-unl-oodles-of-noodles': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: ['wheat'], servings: 6 },
  'b-unl-tomato-and-basil-pasta': { publisher: UNL, stages: ['12-23'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 4 },
  'b-unl-vegetables-in-cream-sauce': { publisher: UNL, stages: ['12-23'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 4 },
  'b-unl-simply-summer-fruit-salad': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 5 },
  'b-unl-baked-lentil-casserole': { publisher: UNL, stages: ['12-23'], serveAs: ['pieces'], allergens: ['dairy'], servings: 5 },
  'b-unl-potato-soup': { publisher: UNL, stages: ['12-23'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 10 },
  'b-unl-spinach-lasagna': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'wheat'], servings: 8 },
  'b-unl-creamy-avocado-chicken-salad': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4 },
  'b-unl-baked-eggplant-parmesan': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg'], servings: 4 },
  'b-fh-leek-and-mushroom-orzo': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-mushroom-bulgur-pilaf': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-southern-green-beans': { publisher: FH, stages: ['24-36'], serveAs: ['finger-food'], allergens: [], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-lemon-dill-brussels-sprouts': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-kiwi-banana-and-apple-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-orange-delight': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 5, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-banana-boats': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 1 },
  'b-fh-baked-tofu': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy'], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-burrito-soup': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 10, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-great-gazpacho-soup': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 4, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-melon-cooler': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 3, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-chili-cheese-hominy': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-spaghetti-squash': { publisher: FH, stages: ['9-12', '12-23', '24-36'], serveAs: ['pieces'], allergens: [], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-whole-wheat-yogurt-rolls': { publisher: FH, stages: ['12-23'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 10 },
  'b-fh-beef-barley-soup': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 14, estimateNote: ESTIMATE_ONE_CUP },
  'b-icn-cauliflower-rice': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-icn-great-garden-soup': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-icn-oven-baked-pancakes-with-spiced-pears': { publisher: ICN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['wheat'], servings: 6 },
  'b-icn-baked-carrot-fries-with-yogurt-sunflower-seed-butter-dip': { publisher: ICN, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['dairy'], servings: 6 },
  'b-fh-tasty-hamburger-skillet': { publisher: FH, stages: ['12-23'], serveAs: ['pieces'], allergens: ['dairy'], servings: 9, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-one-pan-spaghetti': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 10, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-potato-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 16, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-chicken-creole': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 10, estimateNote: ESTIMATE_ONE_CUP },
};

/** Ingredients the sources list but that were left out; the adaptation must say so. */
const BATCH_9_LEFT_OUT: Record<string, { adaptation: string; absent: RegExp }[]> = {
  'b-unl-pear-and-parsnip-smash-up': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-unl-elaines-green-mash-potatoes': [{ adaptation: 'Left out the 1/8 teaspoon salt sprinkled on top', absent: /\bsalt\b/i }],
  'b-unl-curried-lentil-soup': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-unl-dill-rice-pilaf': [{ adaptation: 'Left out 1 teaspoon salt', absent: /\bsalt\b/i }],
  'b-unl-butternut-squash-mac-n-cheese': [{ adaptation: 'Left out the optional 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-unl-chicken-rice': [{ adaptation: 'Left out the optional 1 teaspoon salt', absent: /\bsalt\b/i }, { adaptation: 'Left out the optional chicken bouillon cube', absent: /bouillon/i }],
  'b-unl-tomato-and-basil-pasta': [{ adaptation: 'Left out the optional 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-unl-vegetables-in-cream-sauce': [{ adaptation: 'Left out the salt in "salt and pepper to taste"', absent: /\bsalt\b/i }],
  'b-unl-baked-lentil-casserole': [{ adaptation: 'Left out the optional 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-unl-potato-soup': [{ adaptation: 'Left out the optional 1 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-whole-wheat-yogurt-rolls': [{ adaptation: 'Left out 1 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-tasty-hamburger-skillet': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
};

/** Batch 9 recipes that keep salt, sugar or syrup because they are tagged 24-36 only (the screen does not block them at that age). */
const BATCH_9_KEEPS_BLOCKED_AT_24 = [
  'b-unl-ham-and-egg-frittata',
  'b-unl-tomato-soup',
  'b-unl-turkey-mashed-potato-soup',
  'b-unl-roasted-sweet-potatoes-and-apples',
  'b-unl-tzatziki-dip',
  'b-unl-lemony-green-beans',
  'b-unl-lentil-veggie-tacos',
  'b-unl-oodles-of-noodles',
  'b-unl-creamy-avocado-chicken-salad',
  'b-fh-leek-and-mushroom-orzo',
  'b-fh-southern-green-beans',
  'b-fh-lemon-dill-brussels-sprouts',
  'b-fh-kiwi-banana-and-apple-salad',
  'b-icn-cauliflower-rice',
  'b-icn-oven-baked-pancakes-with-spiced-pears',
  'b-icn-baked-carrot-fries-with-yogurt-sunflower-seed-butter-dip',
  'b-fh-one-pan-spaghetti',
  'b-fh-potato-salad',
  'b-fh-baked-tofu',
];

/** Pages (or ICN versions) that state their own serving count (no estimate needed). */
const BATCH_9_SOURCE_SERVINGS = [
  'b-unl-fruit-puree',
  'b-unl-pear-and-parsnip-smash-up',
  'b-unl-elaines-green-mash-potatoes',
  'b-unl-curried-lentil-soup',
  'b-unl-ham-and-egg-frittata',
  'b-unl-chicken-and-rice-soup',
  'b-unl-brown-rice-risotto',
  'b-unl-tomato-soup',
  'b-unl-turkey-mashed-potato-soup',
  'b-unl-dill-rice-pilaf',
  'b-unl-roasted-sweet-potatoes-and-apples',
  'b-unl-tzatziki-dip',
  'b-unl-sauteed-parmesan-asparagus',
  'b-unl-lemony-green-beans',
  'b-unl-roasted-broccoli-and-red-peppers',
  'b-unl-butternut-squash-mac-n-cheese',
  'b-unl-chicken-rice',
  'b-unl-lentil-veggie-tacos',
  'b-unl-oodles-of-noodles',
  'b-unl-tomato-and-basil-pasta',
  'b-unl-vegetables-in-cream-sauce',
  'b-unl-simply-summer-fruit-salad',
  'b-unl-baked-lentil-casserole',
  'b-unl-potato-soup',
  'b-unl-spinach-lasagna',
  'b-unl-creamy-avocado-chicken-salad',
  'b-unl-baked-eggplant-parmesan',
  'b-fh-whole-wheat-yogurt-rolls',
  'b-fh-banana-boats',
  'b-icn-cauliflower-rice',
  'b-icn-great-garden-soup',
  'b-icn-oven-baked-pancakes-with-spiced-pears',
  'b-icn-baked-carrot-fries-with-yogurt-sunflower-seed-butter-dip',
];

describe('BUILTIN_RECIPES - batch 9', () => {
  it('has a pinned expectation for exactly the batch 9 recipes', () => {
    expect(BATCH_9_RECIPES.map((r) => r.id).sort()).toEqual(Object.keys(BATCH_9_EXPECTED).sort());
    expect(BATCH_9_RECIPES.length).toBeGreaterThanOrEqual(45);
    expect(BATCH_9_RECIPES.length).toBeLessThanOrEqual(55);
  });

  it('every batch 9 recipe is a full recipe with serveAs and at least one quantity', () => {
    for (const recipe of BATCH_9_RECIPES) {
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

  it('every batch 9 source is an https page on an allowed host and a listed publisher', () => {
    for (const recipe of BATCH_9_RECIPES) {
      const source = recipe.source;
      expect(source, recipe.id).toBeDefined();
      if (!source) continue;
      const url = new URL(source.url);
      expect(url.protocol, recipe.id).toBe('https:');
      expect(ALLOWED_HOSTS, `${recipe.id} host ${url.hostname}`).toContain(url.hostname);
      expect(sourcesDoc, `${recipe.id} publisher is in docs/recipe-sources.md`).toContain(source.publisher);
      expect(source.retrieved, recipe.id).toBe('2026-11-12');
      expect(source.title.trim().length, recipe.id).toBeGreaterThan(0);
    }
  });

  it('the UNL Food row is approved by pr-reviewer (PR #95), and the Food Hero and ICN rows are approved', () => {
    const unl = sourcesDoc.split('\n').find((line) => line.includes(UNL));
    expect(unl, 'UNL Food row').toBeDefined();
    expect(unl).toContain('food.unl.edu');
    expect(unl).toContain('Approved by pr-reviewer (PR #95)');
    for (const publisher of [FH, ICN]) {
      const row = sourcesDoc.split('\n').find((line) => line.includes(publisher));
      expect(row, publisher).toBeDefined();
      expect(row).toMatch(/Approved by maintainer \(spec PR #\d+\)|Approved by pr-reviewer \(PR #\d+\)/);
    }
  });

  it('pins publisher, stages, serveAs and servings for each recipe', () => {
    for (const recipe of BATCH_9_RECIPES) {
      const expected = BATCH_9_EXPECTED[recipe.id];
      expect(recipe.source?.publisher, `${recipe.id} publisher`).toBe(expected.publisher);
      expect(recipe.stages, `${recipe.id} stages`).toEqual(expected.stages);
      expect(recipe.serveAs, `${recipe.id} serveAs`).toEqual(expected.serveAs);
      expect(recipe.servings, `${recipe.id} servings`).toBe(expected.servings);
    }
  });

  it('ICN recipes use the source serving count and estimates are disclosed', () => {
    for (const recipe of BATCH_9_RECIPES) {
      const expected = BATCH_9_EXPECTED[recipe.id];
      const adaptations = recipe.source?.adaptations ?? [];
      const estimates = adaptations.filter((a) => a.startsWith('Serving count is an estimate'));
      if (expected.estimateNote) expect(estimates, recipe.id).toEqual([expected.estimateNote]);
      else expect(estimates, recipe.id).toEqual([]);
      if (expected.publisher === ICN) expect(recipe.servings, recipe.id).toBe(6);
      else if (!expected.estimateNote) expect(BATCH_9_SOURCE_SERVINGS, recipe.id).toContain(recipe.id);
    }
  });

  it('pins the allergen groups of each recipe from the real screen', () => {
    for (const recipe of BATCH_9_RECIPES) {
      const groups = [...new Set(screenRecipe(recipe, 12).allergens.map((f) => f.label))].sort();
      expect(groups, `${recipe.id} allergen groups`).toEqual(BATCH_9_EXPECTED[recipe.id].allergens);
    }
  });

  it('no batch 9 recipe has a block at 24 months; blocked-at-12 ones are tagged 24-36 only', () => {
    for (const recipe of BATCH_9_RECIPES) {
      expect(screenRecipe(recipe, 24).blocks, `${recipe.id} is safe at 24 months`).toEqual([]);
      if (screenRecipe(recipe, 12).blocks.length > 0) {
        expect(recipe.stages, recipe.id).toEqual(['24-36']);
        expect(BATCH_9_KEEPS_BLOCKED_AT_24, recipe.id).toContain(recipe.id);
      }
    }
  });

  it('no batch 9 recipe has a block at the youngest age of any stage it is tagged for', () => {
    for (const recipe of BATCH_9_RECIPES) {
      for (const stage of recipe.stages) {
        expect(
          screenRecipe(recipe, STAGE_MIN_MONTHS[stage]).blocks,
          `${recipe.id} at ${stage}`,
        ).toEqual([]);
      }
    }
  });

  it('tagged stages younger than 24 months contain no salt, sugar, soy sauce, honey or bouillon', () => {
    for (const recipe of BATCH_9_RECIPES) {
      if (!recipe.stages.some((s) => s !== '24-36')) continue;
      const text = [...recipe.ingredients.map((i) => i.name), ...recipe.steps].join(' ');
      expect(text, `${recipe.id} text`).not.toMatch(/\b(salt|sugar|soy sauce|honey|bouillon|syrup|agave)\b/i);
    }
  });

  it('recipes tagged 6-8 or 9-12 contain no juice other than lemon or lime', () => {
    for (const recipe of BATCH_9_RECIPES) {
      if (!recipe.stages.some((s) => s === '6-8' || s === '9-12')) continue;
      for (const ingredient of recipe.ingredients) {
        const name = ingredient.name.toLowerCase().replace(/\b(lemon|lime) juice\b/g, '');
        expect(name, `${recipe.id} ingredient`).not.toMatch(/juice/);
      }
    }
  });

  it('every "Left out" adaptation matches an absent ingredient, and none is missing', () => {
    for (const recipe of BATCH_9_RECIPES) {
      const adaptations = recipe.source?.adaptations ?? [];
      const leftOut = adaptations.filter((a) => a.startsWith('Left out'));
      const expected = BATCH_9_LEFT_OUT[recipe.id] ?? [];
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

  it('recipes that keep salt, sugar or soy sauce are exactly the 24-36 only ones listed', () => {
    for (const recipe of BATCH_9_RECIPES) {
      const keeps = recipe.ingredients.some((i) => /\b(salt|sugar|soy sauce|syrup)\b/i.test(i.name));
      expect(keeps, recipe.id).toBe(BATCH_9_KEEPS_BLOCKED_AT_24.includes(recipe.id));
    }
  });

  it('recipes with nut pieces are tagged 24-36 only', () => {
    const nutPieces = /\b(chopped|sliced|slivered|crushed|toasted|pieces)\b.*\b(nuts?|almonds?|walnuts?|pecans?|peanuts?|cashews?|pistachios?)\b|\b(nuts?|almonds?|walnuts?|pecans?|peanuts?|cashews?|pistachios?)\b.*\b(chopped|sliced|slivered|crushed|pieces)\b/i;
    for (const recipe of BATCH_9_RECIPES) {
      if (!recipe.ingredients.some((i) => nutPieces.test(i.name))) continue;
      expect(recipe.stages, recipe.id).toEqual(['24-36']);
    }
  });

  it('puree or mash only recipes are not tagged for toddler stages', () => {
    for (const recipe of BATCH_9_RECIPES) {
      const softPieces = recipe.serveAs?.some((s) => s === 'pieces' || s === 'finger-food');
      if (!softPieces) {
        expect(recipe.stages.includes('12-23') || recipe.stages.includes('24-36'), recipe.id).toBe(false);
      }
    }
  });

  it('no 6-8 recipe is served as pieces or finger food only', () => {
    for (const recipe of BATCH_9_RECIPES) {
      if (!recipe.stages.includes('6-8')) continue;
      expect(
        recipe.serveAs?.some((s) => s === 'puree' || s === 'mashed'),
        `${recipe.id} 6-8 needs a puree or mashed form`,
      ).toBe(true);
    }
  });

  it('carries the source tips into the steps', () => {
    const steps = (id: string) => BATCH_9_RECIPES.find((r) => r.id === id)?.steps.join(' ') ?? '';
    expect(steps('b-unl-chicken-rice')).toMatch(/shred the chicken before serving it to infants and toddlers/i);
    expect(steps('b-fh-kiwi-banana-and-apple-salad')).toMatch(/do not give honey to a child under 1 year old/i);
    expect(steps('b-unl-sauteed-parmesan-asparagus')).toMatch(/still a bit crunchy/i);
    expect(steps('b-unl-curried-lentil-soup')).toMatch(/carefully move the lentil mixture/i);
    expect(steps('b-icn-baked-carrot-fries-with-yogurt-sunflower-seed-butter-dip')).toMatch(/nut butters can be a choking risk for children under 4/i);
    expect(steps('b-unl-butternut-squash-mac-n-cheese')).toMatch(/because it can be hot/i);
  });

  it('records the option each page offered and the step-derived ingredients', () => {
    const find = (id: string) => BATCH_9_RECIPES.find((r) => r.id === id);
    expect(find('b-unl-tomato-soup')?.source?.adaptations).toContain('Used vegetable broth (the page offers vegetable or chicken broth).');
    expect(find('b-fh-tasty-hamburger-skillet')?.source?.adaptations).toContain('Used canned corn, drained (the page also offers frozen or fresh cooked corn).');
    expect(find('b-fh-spaghetti-squash')?.source?.adaptations).toContain('Used the microwave method (the page also gives an oven method).');
    expect(find('b-unl-baked-lentil-casserole')?.source?.adaptations?.[0]).toMatch(/named "no-sodium-added" here/);
    const names = (id: string) => find(id)?.ingredients.map((i) => i.name) ?? [];
    expect(names('b-icn-oven-baked-pancakes-with-spiced-pears')).toContain(
      'diced pears canned in extra light syrup (4 cups plus 1 tablespoon, about 2 cans, 15 ounces each)',
    );
    expect(names('b-unl-pear-and-parsnip-smash-up')).toContain('water, enough to cover the parsnips');
    expect(find('b-unl-pear-and-parsnip-smash-up')?.source?.adaptations).toContain(
      'The page lists no water; the steps cook the parsnips in water to cover, so it is listed as an ingredient here.',
    );
    expect(names('b-icn-great-garden-soup')).toContain('nonstick cooking spray');
    expect(find('b-unl-fruit-puree')?.serveAs).toEqual(['puree']);
    expect(find('b-unl-pear-and-parsnip-smash-up')?.stages).toEqual(['6-8', '9-12']);
  });

  it('batch 9 fills the biggest gaps to the goal', () => {
    const cellCount = (stage: StageId, effort: Effort) =>
      BATCH_9_RECIPES.filter((r) => r.stages.includes(stage) && recipeEffort(r) === effort).length;
    expect(cellCount('6-8', 'easy')).toBeGreaterThanOrEqual(3);
    // Review round 1 moved two soups to 12-23 and dropped Potato Pals, so these bounds are the real counts.
    expect(cellCount('12-23', 'easy')).toBeGreaterThanOrEqual(2);
    expect(cellCount('12-23', 'medium')).toBeGreaterThanOrEqual(5);
    expect(cellCount('12-23', 'more')).toBeGreaterThanOrEqual(5);
    expect(cellCount('24-36', 'easy')).toBeGreaterThanOrEqual(6);
    expect(cellCount('24-36', 'medium')).toBeGreaterThanOrEqual(14);
    expect(cellCount('24-36', 'more')).toBeGreaterThanOrEqual(15);
    expect(BUILTIN_RECIPES.length).toBeGreaterThanOrEqual(300);
  });
});




// ---------------------------------------------------------------------------
// Batch 10 (task 14.3): UNL Food, Food Hero, Texas WIC and Minnesota WIC
// recipes for the biggest gaps to the 500 goal: 12-23 and 24-36 Easy, soy, then More
// ---------------------------------------------------------------------------
const BATCH_10_EXPECTED: Record<string, Batch3Expectation> = {
  'b-fh-potato-wedges': { publisher: FH, stages: ['12-23', '24-36'], serveAs: ['finger-food'], allergens: [], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-asparagus-mushroom-melt': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8 },
  'b-fh-baked-tomatoes-with-cheese': { publisher: FH, stages: ['12-23'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8 },
  'b-fh-kale-dip': { publisher: FH, stages: ['6-8', '9-12'], serveAs: ['puree', 'mashed'], allergens: ['dairy'], servings: 3, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-gingerbread-pancakes': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'wheat'], servings: 8 },
  'b-fh-sesame-turnips-and-carrots': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['sesame'], servings: 6, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-rice-salad': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'tree nuts'], servings: 8, estimateNote: ESTIMATE_HALF_CUP },
  'b-fh-sesame-noodles-with-broccoli-and-chicken': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['sesame', 'soy', 'wheat'], servings: 8, estimateNote: ESTIMATE_ONE_CUP },
  'b-fh-pineapple-veggie-chicken': { publisher: FH, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy'], servings: 10, estimateNote: ESTIMATE_ONE_CUP },
  'b-unl-cucumber-bites': { publisher: UNL, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['dairy'], servings: 3 },
  'b-unl-low-fat-spinach-dip': { publisher: UNL, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['dairy'], servings: 3 },
  'b-unl-skillet-zucchini-and-mushrooms': { publisher: UNL, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-unl-super-spaghetti-squash-bites': { publisher: UNL, stages: ['12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 5, estimateNote: 'Serving count is an estimate (the page gives the yield as about 20 bites): 4 bites per serving.' },
  'b-unl-banana-in-a-blanket': { publisher: UNL, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['peanut', 'wheat'], servings: 1 },
  'b-unl-asian-cabbage-slaw': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: ['sesame', 'soy'], servings: 6 },
  'b-unl-broccoli-slaw-with-cranberries': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy', 'tree nuts'], servings: 11 },
  'b-unl-pork-rice-bowls': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'soy'], servings: 6 },
  'b-unl-zucchini-and-kidney-bean-salad': { publisher: UNL, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-unl-roasted-root-vegetables': { publisher: UNL, stages: ['12-23'], serveAs: ['pieces'], allergens: [], servings: 6 },
  'b-tx-sesame-ginger-bok-choy': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['sesame', 'soy'], servings: 4 },
  'b-tx-southwest-stuffed-bell-peppers': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4 },
  'b-tx-vegetable-stir-fry-with-peanut-sauce': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['peanut', 'soy'], servings: 4 },
  'b-tx-weeknight-chicken-and-rice-casserole': { publisher: TX, stages: ['24-36'], serveAs: ['pieces'], allergens: ['soy', 'tree nuts'], servings: 6 },
  'b-mn-broccoli-strata': { publisher: MN, stages: ['12-23'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'wheat'], servings: 6 },
  'b-mn-scrambled-egg-enchiladas': { publisher: MN, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'egg'], servings: 4 },
  'b-mn-sesame-chicken': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'sesame', 'soy', 'wheat'], servings: 4 },
  'b-mn-broccoli-tofu-casserole': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'soy', 'wheat'], servings: 6 },
  'b-mn-tofu-casserole': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'soy'], servings: 6 },
  'b-mn-hamburger-and-rice-hotdish': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'soy', 'wheat'], servings: 8 },
  'b-mn-broccoli': { publisher: MN, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['soy'], servings: 6 },
  'b-mn-cauliflower-casserole': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'soy'], servings: 5 },
  'b-mn-scalloped-potatoes': { publisher: MN, stages: ['12-23'], serveAs: ['pieces'], allergens: ['dairy', 'wheat'], servings: 4 },
  'b-mn-bean-huevos-rancheros': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'wheat'], servings: 3 },
  'b-mn-enchilada-bake': { publisher: MN, stages: ['12-23', '24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 8 },
  'b-mn-italian-broccoli-and-pasta': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 4 },
  'b-mn-popovers': { publisher: MN, stages: ['12-23'], serveAs: ['finger-food'], allergens: ['dairy', 'egg', 'wheat'], servings: 12 },
  'b-mn-chicken-barley-soup': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: [], servings: 8 },
  'b-mn-spanish-rice-supreme': { publisher: MN, stages: ['12-23'], serveAs: ['pieces'], allergens: [], servings: 4 },
  'b-mn-skillet-stroganoff': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy', 'egg', 'wheat'], servings: 4 },
  'b-mn-tator-tot-hotdish': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-mn-apple-cheddar-salad': { publisher: MN, stages: ['24-36'], serveAs: ['pieces'], allergens: ['dairy'], servings: 6 },
  'b-unl-berry-butterfly': { publisher: UNL, stages: ['12-23', '24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'wheat'], servings: 1 },
  'b-unl-silly-sandwiches': { publisher: UNL, stages: ['24-36'], serveAs: ['finger-food'], allergens: ['dairy', 'wheat'], servings: 2 },
};

/** Ingredients the sources list but that were left out; the adaptation must say so. */
const BATCH_10_LEFT_OUT: Record<string, { adaptation: string; absent: RegExp }[]> = {
  'b-fh-baked-tomatoes-with-cheese': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-fh-kale-dip': [{ adaptation: 'Left out 1/8 teaspoon salt', absent: /\bsalt\b/i }],
  'b-unl-roasted-root-vegetables': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-mn-broccoli-strata': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
  'b-mn-scalloped-potatoes': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-mn-popovers': [{ adaptation: 'Left out 1/4 teaspoon salt', absent: /\bsalt\b/i }],
  'b-mn-spanish-rice-supreme': [{ adaptation: 'Left out 1/2 teaspoon salt', absent: /\bsalt\b/i }],
};

/** Batch 10 recipes that keep salt, sugar, honey or syrup because they are tagged 24-36 only (the screen does not block them at that age). */
const BATCH_10_KEEPS_BLOCKED_AT_24 = [
  'b-fh-asparagus-mushroom-melt',
  'b-fh-gingerbread-pancakes',
  'b-fh-sesame-turnips-and-carrots',
  'b-fh-rice-salad',
  'b-fh-sesame-noodles-with-broccoli-and-chicken',
  'b-fh-pineapple-veggie-chicken',
  'b-unl-banana-in-a-blanket',
  'b-unl-asian-cabbage-slaw',
  'b-unl-broccoli-slaw-with-cranberries',
  'b-unl-pork-rice-bowls',
  'b-unl-zucchini-and-kidney-bean-salad',
  'b-tx-sesame-ginger-bok-choy',
  'b-tx-vegetable-stir-fry-with-peanut-sauce',
  'b-tx-weeknight-chicken-and-rice-casserole',
  'b-mn-sesame-chicken',
  'b-mn-tofu-casserole',
  'b-mn-hamburger-and-rice-hotdish',
  'b-mn-broccoli',
  'b-mn-cauliflower-casserole',
  'b-mn-skillet-stroganoff',
];

/** Pages that state their own serving count (no estimate needed). */
const BATCH_10_SOURCE_SERVINGS = [
  'b-fh-asparagus-mushroom-melt',
  'b-fh-baked-tomatoes-with-cheese',
  'b-fh-gingerbread-pancakes',
  'b-unl-cucumber-bites',
  'b-unl-low-fat-spinach-dip',
  'b-unl-skillet-zucchini-and-mushrooms',
  'b-unl-banana-in-a-blanket',
  'b-unl-asian-cabbage-slaw',
  'b-unl-broccoli-slaw-with-cranberries',
  'b-unl-pork-rice-bowls',
  'b-unl-zucchini-and-kidney-bean-salad',
  'b-unl-roasted-root-vegetables',
  'b-tx-sesame-ginger-bok-choy',
  'b-tx-southwest-stuffed-bell-peppers',
  'b-tx-vegetable-stir-fry-with-peanut-sauce',
  'b-tx-weeknight-chicken-and-rice-casserole',
  'b-mn-broccoli-strata',
  'b-mn-scrambled-egg-enchiladas',
  'b-mn-sesame-chicken',
  'b-mn-broccoli-tofu-casserole',
  'b-mn-tofu-casserole',
  'b-mn-hamburger-and-rice-hotdish',
  'b-mn-broccoli',
  'b-mn-cauliflower-casserole',
  'b-mn-scalloped-potatoes',
  'b-mn-bean-huevos-rancheros',
  'b-mn-enchilada-bake',
  'b-mn-italian-broccoli-and-pasta',
  'b-mn-popovers',
  'b-mn-chicken-barley-soup',
  'b-mn-spanish-rice-supreme',
  'b-mn-skillet-stroganoff',
  'b-mn-tator-tot-hotdish',
  'b-mn-apple-cheddar-salad',
  'b-unl-berry-butterfly',
  'b-unl-silly-sandwiches',
];

describe('BUILTIN_RECIPES - batch 10', () => {
  it('has a pinned expectation for exactly the batch 10 recipes', () => {
    expect(BATCH_10_RECIPES.map((r) => r.id).sort()).toEqual(Object.keys(BATCH_10_EXPECTED).sort());
    expect(BATCH_10_RECIPES.length).toBeGreaterThanOrEqual(43);
    expect(BATCH_10_RECIPES.length).toBeLessThanOrEqual(55);
  });

  it('every batch 10 ingredient food key is what foodKeyFromName derives (no plural keys)', () => {
    // An override must equal foodKeyFromName of the name or of itself, or be a key an
    // earlier batch already uses (for example 'asparagus', which the
    // singularizer would cut to 'asparagu' if it were run on the key itself).
    const batch10 = new Set(BATCH_10_RECIPES.map((r) => r.id));
    const earlier = new Set<string>();
    for (const recipe of BUILTIN_RECIPES) {
      if (batch10.has(recipe.id)) continue;
      for (const ing of recipe.ingredients) earlier.add(ing.food ?? foodKeyFromName(ing.name));
    }
    for (const recipe of BATCH_10_RECIPES) {
      for (const ing of recipe.ingredients) {
        const label = `${recipe.id}: ${ing.name}`;
        if (ing.food === undefined) continue;
        // Hand-written canonical key, like 'cream of chicken soup' in earlier batches.
        if (earlier.has(ing.food) || ing.food === 'cream of celery soup') continue;
        const derived = [foodKeyFromName(ing.name), foodKeyFromName(ing.food)];
        expect(derived, label).toContain(ing.food);
      }
    }
  });

  it('every batch 10 recipe is a full recipe with serveAs and at least one quantity', () => {
    for (const recipe of BATCH_10_RECIPES) {
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

  it('every batch 10 source is an https page on an allowed host and a listed publisher', () => {
    for (const recipe of BATCH_10_RECIPES) {
      const source = recipe.source;
      expect(source, recipe.id).toBeDefined();
      if (!source) continue;
      const url = new URL(source.url);
      expect(url.protocol, recipe.id).toBe('https:');
      expect(ALLOWED_HOSTS, `${recipe.id} host ${url.hostname}`).toContain(url.hostname);
      expect(sourcesDoc, `${recipe.id} publisher is in docs/recipe-sources.md`).toContain(source.publisher);
      expect(source.retrieved, recipe.id).toBe('2026-11-12');
      expect(source.title.trim().length, recipe.id).toBeGreaterThan(0);
    }
  });

  it('the UNL Food row is approved by pr-reviewer (PR #95), and the Food Hero, Texas WIC and Minnesota WIC rows are approved', () => {
    const unl = sourcesDoc.split('\n').find((line) => line.includes(UNL));
    expect(unl, 'UNL Food row').toBeDefined();
    expect(unl).toContain('food.unl.edu');
    expect(unl).toContain('Approved by pr-reviewer (PR #95)');
    for (const publisher of [FH, TX, MN]) {
      const row = sourcesDoc.split('\n').find((line) => line.includes(publisher));
      expect(row, publisher).toBeDefined();
      expect(row).toMatch(/Approved by maintainer \((spec PR #\d+|#\d+|v1 spec)\)|Approved by pr-reviewer \(PR #\d+\)/);
    }
  });

  it('pins publisher, stages, serveAs and servings for each recipe', () => {
    for (const recipe of BATCH_10_RECIPES) {
      const expected = BATCH_10_EXPECTED[recipe.id];
      expect(recipe.source?.publisher, `${recipe.id} publisher`).toBe(expected.publisher);
      expect(recipe.stages, `${recipe.id} stages`).toEqual(expected.stages);
      expect(recipe.serveAs, `${recipe.id} serveAs`).toEqual(expected.serveAs);
      expect(recipe.servings, `${recipe.id} servings`).toBe(expected.servings);
    }
  });

  it('ICN recipes use the source serving count and estimates are disclosed', () => {
    for (const recipe of BATCH_10_RECIPES) {
      const expected = BATCH_10_EXPECTED[recipe.id];
      const adaptations = recipe.source?.adaptations ?? [];
      const estimates = adaptations.filter((a) => a.startsWith('Serving count is an estimate'));
      if (expected.estimateNote) expect(estimates, recipe.id).toEqual([expected.estimateNote]);
      else expect(estimates, recipe.id).toEqual([]);
      if (expected.publisher === ICN) expect(recipe.servings, recipe.id).toBe(6);
      else if (!expected.estimateNote) expect(BATCH_10_SOURCE_SERVINGS, recipe.id).toContain(recipe.id);
    }
  });

  it('pins the allergen groups of each recipe from the real screen', () => {
    for (const recipe of BATCH_10_RECIPES) {
      const groups = [...new Set(screenRecipe(recipe, 12).allergens.map((f) => f.label))].sort();
      expect(groups, `${recipe.id} allergen groups`).toEqual(BATCH_10_EXPECTED[recipe.id].allergens);
    }
  });

  it('no batch 10 recipe has a block at 24 months; blocked-at-12 ones are tagged 24-36 only', () => {
    for (const recipe of BATCH_10_RECIPES) {
      expect(screenRecipe(recipe, 24).blocks, `${recipe.id} is safe at 24 months`).toEqual([]);
      if (screenRecipe(recipe, 12).blocks.length > 0) {
        expect(recipe.stages, recipe.id).toEqual(['24-36']);
        expect(BATCH_10_KEEPS_BLOCKED_AT_24, recipe.id).toContain(recipe.id);
      }
    }
  });

  it('no batch 10 recipe has a block at the youngest age of any stage it is tagged for', () => {
    for (const recipe of BATCH_10_RECIPES) {
      for (const stage of recipe.stages) {
        expect(
          screenRecipe(recipe, STAGE_MIN_MONTHS[stage]).blocks,
          `${recipe.id} at ${stage}`,
        ).toEqual([]);
      }
    }
  });

  it('tagged stages younger than 24 months contain no salt, sugar, soy sauce, honey or bouillon', () => {
    for (const recipe of BATCH_10_RECIPES) {
      if (!recipe.stages.some((s) => s !== '24-36')) continue;
      const text = [...recipe.ingredients.map((i) => i.name), ...recipe.steps].join(' ');
      expect(text, `${recipe.id} text`).not.toMatch(/\b(salt|sugar|soy sauce|honey|bouillon|syrup|agave)\b/i);
    }
  });

  it('recipes tagged 6-8 or 9-12 contain no juice other than lemon or lime', () => {
    for (const recipe of BATCH_10_RECIPES) {
      if (!recipe.stages.some((s) => s === '6-8' || s === '9-12')) continue;
      for (const ingredient of recipe.ingredients) {
        const name = ingredient.name.toLowerCase().replace(/\b(lemon|lime) juice\b/g, '');
        expect(name, `${recipe.id} ingredient`).not.toMatch(/juice/);
      }
    }
  });

  it('every "Left out" adaptation matches an absent ingredient, and none is missing', () => {
    for (const recipe of BATCH_10_RECIPES) {
      const adaptations = recipe.source?.adaptations ?? [];
      const leftOut = adaptations.filter((a) => a.startsWith('Left out'));
      const expected = BATCH_10_LEFT_OUT[recipe.id] ?? [];
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

  it('recipes that keep salt, sugar or soy sauce are exactly the 24-36 only ones listed', () => {
    for (const recipe of BATCH_10_RECIPES) {
      const keeps = recipe.ingredients.some((i) => /\b(salt|sugar|soy sauce|syrup)\b/i.test(i.name));
      expect(keeps, recipe.id).toBe(BATCH_10_KEEPS_BLOCKED_AT_24.includes(recipe.id));
    }
  });

  it('recipes with nut pieces are tagged 24-36 only', () => {
    const nutPieces = /\b(chopped|sliced|slivered|crushed|toasted|pieces)\b.*\b(nuts?|almonds?|walnuts?|pecans?|peanuts?|cashews?|pistachios?)\b|\b(nuts?|almonds?|walnuts?|pecans?|peanuts?|cashews?|pistachios?)\b.*\b(chopped|sliced|slivered|crushed|pieces)\b/i;
    for (const recipe of BATCH_10_RECIPES) {
      if (!recipe.ingredients.some((i) => nutPieces.test(i.name))) continue;
      expect(recipe.stages, recipe.id).toEqual(['24-36']);
    }
  });

  it('puree or mash only recipes are not tagged for toddler stages', () => {
    for (const recipe of BATCH_10_RECIPES) {
      const softPieces = recipe.serveAs?.some((s) => s === 'pieces' || s === 'finger-food');
      if (!softPieces) {
        expect(recipe.stages.includes('12-23') || recipe.stages.includes('24-36'), recipe.id).toBe(false);
      }
    }
  });

  it('no 6-8 recipe is served as pieces or finger food only', () => {
    for (const recipe of BATCH_10_RECIPES) {
      if (!recipe.stages.includes('6-8')) continue;
      expect(
        recipe.serveAs?.some((s) => s === 'puree' || s === 'mashed'),
        `${recipe.id} 6-8 needs a puree or mashed form`,
      ).toBe(true);
    }
  });

  it('carries the source tips into the steps', () => {
    const steps = (id: string) => BATCH_10_RECIPES.find((r) => r.id === id)?.steps.join(' ') ?? '';
    expect(steps('b-fh-sesame-turnips-and-carrots')).toMatch(/do not give honey to a child under 1 year old/i);
    expect(steps('b-fh-asparagus-mushroom-melt')).toMatch(/watching closely so it does not burn/i);
    expect(steps('b-unl-low-fat-spinach-dip')).toMatch(/sour cream can stand in for the Greek yogurt/i);
    expect(steps('b-unl-super-spaghetti-squash-bites')).toMatch(/fork slides easily through the skin/i);
    expect(steps('b-tx-vegetable-stir-fry-with-peanut-sauce')).toMatch(/heavy pan on top for at least 15 minutes/i);
    expect(steps('b-mn-popovers')).toMatch(/do not open the oven door/i);
    expect(steps('b-mn-broccoli-strata')).toMatch(/chill for at least 1 hour or overnight/i);
  });

  it('records the option each page offered and the step-derived ingredients', () => {
    const find = (id: string) => BATCH_10_RECIPES.find((r) => r.id === id);
    expect(find('b-mn-chicken-barley-soup')?.source?.adaptations).toContain('Used chicken broth (the page offers chicken broth or prepared bouillon).');
    expect(find('b-mn-broccoli-tofu-casserole')?.source?.adaptations).toContain('Used butter (the page offers butter or margarine).');
    expect(find('b-tx-vegetable-stir-fry-with-peanut-sauce')?.source?.adaptations).toContain('Used tofu (the page offers extra firm tofu or chicken).');
    expect(find('b-mn-broccoli-tofu-casserole')?.source?.adaptations).toContain('Used garlic powder (the page offers salt to taste or 1 1/2 teaspoons garlic powder).');
    expect(find('b-unl-pork-rice-bowls')?.source?.adaptations).toContain('The page gives the Sriracha as 1-2 teaspoons; the lower amount, 1 teaspoon, is entered.');
    expect(find('b-mn-scrambled-egg-enchiladas')?.source?.adaptations).toContain('The page gives a 12-16 ounce jar of salsa; 12 ounces, the low end, is used.');
    const names = (id: string) => find(id)?.ingredients.map((i) => i.name) ?? [];
    expect(names('b-tx-southwest-stuffed-bell-peppers')).toContain('cooking spray');
    expect(names('b-tx-weeknight-chicken-and-rice-casserole')).toContain('vegetable cooking spray');
    expect(names('b-mn-hamburger-and-rice-hotdish')).toContain('chow mein noodles (optional)');
    expect(names('b-mn-hamburger-and-rice-hotdish')).toContain('water, one empty soup can');
  });

  it('every soy recipe that keeps a soy sauce or tofu, and the soy count, are as expected', () => {
    const soy = BATCH_10_RECIPES.filter((r) => screenRecipe(r, 12).allergens.some((f) => f.label === 'soy'));
    expect(soy.length).toBeGreaterThanOrEqual(14);
    for (const r of soy.filter((x) => x.ingredients.some((i) => /soy sauce/i.test(i.name)))) {
      expect(r.stages, r.id).toEqual(['24-36']);
    }
  });

  it('batch 10 fills the biggest gaps to the goal', () => {
    const cellCount = (stage: StageId, effort: Effort) =>
      BATCH_10_RECIPES.filter((r) => r.stages.includes(stage) && recipeEffort(r) === effort).length;
    // Bounds are modest so a review-driven drop or retag does not break them (set to the real counts after the round 1 review drops).
    expect(cellCount('12-23', 'easy')).toBeGreaterThanOrEqual(1);
    expect(cellCount('12-23', 'medium')).toBeGreaterThanOrEqual(8);
    expect(cellCount('12-23', 'more')).toBeGreaterThanOrEqual(1);
    expect(cellCount('24-36', 'easy')).toBeGreaterThanOrEqual(4);
    expect(cellCount('24-36', 'medium')).toBeGreaterThanOrEqual(17);
    expect(cellCount('24-36', 'more')).toBeGreaterThanOrEqual(12);
    expect(BUILTIN_RECIPES.length).toBeGreaterThanOrEqual(300);
  });
});





// ---------------------------------------------------------------------------
// Count table (task 14.3, batch 10; design "How the distribution is measured")
// ---------------------------------------------------------------------------
// HARD_MINIMUM and GOAL are the Requirement 14.1 and 14.6 tables. CHECKPOINT is
// the floor for the current batch: it follows the plan line in tasks.md and is
// never above HARD_MINIMUM. Task 14.4 sets CHECKPOINT = HARD_MINIMUM. The goal
// is only reported (console.table), never enforced.
type EffortCounts = Record<Effort, number>;
interface Counts {
  /** Total built-ins and simple ideas (the 300 / 500 totals). */
  total: number;
  /** Most simple ideas allowed. */
  simpleIdeasMax: number;
  stages: Record<StageId, EffortCounts>;
  allergens: Record<AllergenGroup, number>;
}

const cell = (easy: number, medium: number, more: number): EffortCounts => ({ easy, medium, more });

const HARD_MINIMUM: Counts = {
  total: 300,
  simpleIdeasMax: 40,
  stages: {
    '6-8': cell(20, 10, 0),
    '9-12': cell(30, 25, 15),
    '12-23': cell(45, 45, 30),
    '24-36': cell(70, 70, 60),
  },
  allergens: { dairy: 30, egg: 30, wheat: 30, soy: 30, peanut: 8, 'tree nuts': 8, fish: 8, sesame: 4, shellfish: 3 },
};

const GOAL: Counts = {
  total: 500,
  simpleIdeasMax: 40,
  stages: {
    '6-8': cell(30, 12, 3),
    '9-12': cell(50, 45, 25),
    '12-23': cell(80, 80, 60),
    '24-36': cell(130, 130, 120),
  },
  allergens: { dairy: 60, egg: 60, wheat: 60, soy: 60, peanut: 15, 'tree nuts': 15, fish: 15, sesame: 8, shellfish: 6 },
};

/**
 * Floors for this batch (batch 10). Every floor is what the set reaches after
 * batch 10, capped at HARD_MINIMUM (the plan line for batch 10 is about 365; the
 * set has 421, so the total floor stays at the hard minimum of 300). Every
 * floor already equals HARD_MINIMUM since batch 8, so none is raised.
 */
const CHECKPOINT: Counts = {
  total: 300,
  simpleIdeasMax: 40,
  stages: {
    '6-8': cell(20, 10, 0),
    '9-12': cell(30, 25, 15),
    '12-23': cell(45, 45, 30),
    '24-36': cell(70, 70, 60),
  },
  allergens: { dairy: 30, egg: 30, wheat: 30, soy: 30, peanut: 8, 'tree nuts': 8, fish: 8, sesame: 4, shellfish: 3 },
};

const EFFORTS: Effort[] = ['easy', 'medium', 'more'];

function measure(): Counts {
  const stages = {} as Record<StageId, EffortCounts>;
  for (const stage of STAGE_IDS) stages[stage] = cell(0, 0, 0);
  const allergens = {} as Record<AllergenGroup, number>;
  for (const group of EXPECTED_ALLERGEN_GROUPS) allergens[group] = 0;
  for (const recipe of BUILTIN_RECIPES) {
    const effort = recipeEffort(recipe);
    for (const stage of recipe.stages) stages[stage][effort] += 1;
    // 12 months does not suppress any allergen rule, so it reveals every group.
    const groups = new Set(screenRecipe(recipe, 12).allergens.map((f) => f.label as AllergenGroup));
    for (const group of groups) allergens[group] += 1;
  }
  return {
    total: BUILTIN_RECIPES.length,
    simpleIdeasMax: BUILTIN_RECIPES.filter((r) => r.kind === 'simple-idea').length,
    stages,
    allergens,
  };
}

const stageTotal = (c: EffortCounts) => c.easy + c.medium + c.more;

describe('BUILTIN_RECIPES - count table (hard minimum, goal, checkpoint)', () => {
  const have = measure();

  it('prints the stage by effort and allergen table with the gap to the goal', () => {
    const rows: Record<string, Record<string, number | string>> = {};
    for (const stage of STAGE_IDS) {
      for (const effort of EFFORTS) {
        rows[`${stage} ${effort}`] = {
          have: have.stages[stage][effort],
          checkpoint: CHECKPOINT.stages[stage][effort],
          hardMinimum: HARD_MINIMUM.stages[stage][effort],
          goal: GOAL.stages[stage][effort],
          gapToGoal: GOAL.stages[stage][effort] - have.stages[stage][effort],
        };
      }
      rows[`${stage} total`] = {
        have: stageTotal(have.stages[stage]),
        checkpoint: stageTotal(CHECKPOINT.stages[stage]),
        hardMinimum: stageTotal(HARD_MINIMUM.stages[stage]),
        goal: stageTotal(GOAL.stages[stage]),
        gapToGoal: stageTotal(GOAL.stages[stage]) - stageTotal(have.stages[stage]),
      };
    }
    for (const group of EXPECTED_ALLERGEN_GROUPS) {
      rows[`allergen ${group}`] = {
        have: have.allergens[group],
        checkpoint: CHECKPOINT.allergens[group],
        hardMinimum: HARD_MINIMUM.allergens[group],
        goal: GOAL.allergens[group],
        gapToGoal: GOAL.allergens[group] - have.allergens[group],
      };
    }
    rows['total built-ins'] = {
      have: have.total,
      checkpoint: CHECKPOINT.total,
      hardMinimum: HARD_MINIMUM.total,
      goal: GOAL.total,
      gapToGoal: GOAL.total - have.total,
    };
    console.table(rows);
    expect(Object.keys(rows).length).toBeGreaterThan(0);
  });

  it('CHECKPOINT never exceeds HARD_MINIMUM, and HARD_MINIMUM never exceeds GOAL', () => {
    expect(CHECKPOINT.total).toBeLessThanOrEqual(HARD_MINIMUM.total);
    expect(HARD_MINIMUM.total).toBeLessThanOrEqual(GOAL.total);
    for (const stage of STAGE_IDS) {
      for (const effort of EFFORTS) {
        expect(CHECKPOINT.stages[stage][effort], `${stage} ${effort}`).toBeLessThanOrEqual(
          HARD_MINIMUM.stages[stage][effort],
        );
        expect(HARD_MINIMUM.stages[stage][effort], `${stage} ${effort}`).toBeLessThanOrEqual(
          GOAL.stages[stage][effort],
        );
      }
    }
    for (const group of EXPECTED_ALLERGEN_GROUPS) {
      expect(CHECKPOINT.allergens[group], group).toBeLessThanOrEqual(HARD_MINIMUM.allergens[group]);
      expect(HARD_MINIMUM.allergens[group], group).toBeLessThanOrEqual(GOAL.allergens[group]);
    }
  });

  it('the Requirement 14.1 stage totals add up (30 / 70 / 120 / 200 minimum, 45 / 120 / 220 / 380 goal)', () => {
    expect(STAGE_IDS.map((s) => stageTotal(HARD_MINIMUM.stages[s]))).toEqual([30, 70, 120, 200]);
    expect(STAGE_IDS.map((s) => stageTotal(GOAL.stages[s]))).toEqual([45, 120, 220, 380]);
  });

  it('total built-ins >= CHECKPOINT', () => {
    expect(have.total).toBeGreaterThanOrEqual(CHECKPOINT.total);
  });

  it('simple ideas <= 40', () => {
    expect(have.simpleIdeasMax).toBeLessThanOrEqual(CHECKPOINT.simpleIdeasMax);
  });

  it('each stage total >= CHECKPOINT', () => {
    for (const stage of STAGE_IDS) {
      expect(stageTotal(have.stages[stage]), `${stage} total`).toBeGreaterThanOrEqual(
        stageTotal(CHECKPOINT.stages[stage]),
      );
    }
  });

  it('each stage by effort cell >= CHECKPOINT', () => {
    for (const stage of STAGE_IDS) {
      for (const effort of EFFORTS) {
        expect(have.stages[stage][effort], `${stage} ${effort}`).toBeGreaterThanOrEqual(
          CHECKPOINT.stages[stage][effort],
        );
      }
    }
  });

  it('each allergen group >= CHECKPOINT', () => {
    for (const group of EXPECTED_ALLERGEN_GROUPS) {
      expect(have.allergens[group], group).toBeGreaterThanOrEqual(CHECKPOINT.allergens[group]);
    }
  });
});
