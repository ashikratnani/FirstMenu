import { describe, expect, it } from 'vitest';
import type { AllergenGroup, GroceryCategory, MealType, StageId } from '../domain/types';
import { screenRecipe } from '../domain/safety/screen';
import { BUILTIN_RECIPES, INFANT_PORTION_OZ, estimateServings } from './recipes';

// ---------------------------------------------------------------------------
// COVERAGE SCOPE: OPTION 4 REDUCED FIRST BATCH (maintainer decision, issue #7)
// ---------------------------------------------------------------------------
// The coverage assertions below guard the recipes we are ACTUALLY shipping in
// this first batch. They are intentionally NOT the full Requirement 2 targets.
//
// The full Requirement 2 coverage targets (>=24 recipes, >=10 recipes per stage,
// and all NINE allergen groups: peanut, egg, dairy, tree nuts, soy, wheat, fish,
// shellfish, sesame) are DEFERRED under the maintainer's Option 4 decision and
// tracked on GitHub issue #7 as follow-up work. In this environment only the two
// Minnesota WIC HTML pages are fetchable, and they cover the allergen groups
// dairy, egg and wheat only. Do NOT tighten these assertions to the full targets
// here; that happens when issue #7 is worked and more sourced recipes are added.
//
// The invariant tests (no blocks at a stage's youngest age, valid categories,
// complete source fields, sourced storage times) always apply to every shipped
// recipe and are not scoped down.

/** Youngest age in months for each tagged stage. */
const YOUNGEST_AGE: Record<StageId, number> = { '6-8': 6, '9-12': 9 };

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

/** Allergen groups the shipped batch is expected to cover (dairy/egg/wheat). */
const EXPECTED_ALLERGEN_GROUPS: AllergenGroup[] = ['dairy', 'egg', 'wheat'];

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
    expect(estimateServings(1)).toBe(1); // round(0.5) then floored up to the min
    expect(estimateServings(15)).toBe(8); // round(7.5) = 8
    expect(estimateServings(24)).toBe(12);
    expect(estimateServings(37)).toBe(19); // round(18.5) = 19
    expect(estimateServings(12.5)).toBe(6); // round(6.25) = 6
  });

  it('every recipe has a pinned servings expectation', () => {
    const expected = new Set(Object.keys(SERVINGS_BY_ID));
    const actual = new Set(BUILTIN_RECIPES.map((r) => r.id));
    expect(actual).toEqual(expected);
  });

  it('each recipe servings matches the rule (or the source yield) and cannot drift', () => {
    for (const recipe of BUILTIN_RECIPES) {
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

describe('BUILTIN_RECIPES - coverage of the Option 4 shipped batch (issue #7 defers the rest)', () => {
  it('matches the shipped recipe count', () => {
    // Guards the current batch transcribed from the two Minnesota WIC pages.
    // When issue #7 adds more sourced recipes, raise this count then.
    expect(BUILTIN_RECIPES.length).toBe(10);
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

  it('covers allergen groups dairy, egg and wheat (proven by the real screen)', () => {
    const covered = coveredAllergenGroups();
    for (const group of EXPECTED_ALLERGEN_GROUPS) {
      expect(covered.has(group), `shipped batch should cover allergen group "${group}"`).toBe(true);
    }
  });
});
