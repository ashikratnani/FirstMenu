// Custom recipe editor (Task 9.3, Req 3.1-3.5, 4.9, 5.6). One component serves
// BOTH /recipes/new (blank form) and /recipes/:id/edit (prefilled from the
// matching custom recipe). A controlled form exposes every Recipe field,
// including a per-ingredient "counts as" food override (Ingredient.food) and
// dynamic ingredient/step rows.
//
// Before a save the required fields are validated (title, >=1 stage, >=1 meal
// type, >=1 ingredient with a name, >=1 step; Req 2.2/3.1); a missing field
// blocks the save and shows a per-field message. Each ingredient row also shows
// the food it "counts as", derived from its name via the real foodKeyFor (Req
// 3.3), which the user can override (Ingredient.food).
//
// On SAVE the real safety screen runs (screenRecipe) and the findings are shown
// on the page: block reasons (with the age the food becomes available),
// per-ingredient prep reminders, and allergen reminders. When nothing fires the
// panel reuses the shared SCREEN_LIMITS caveat (Req 13.2) rather than inventing
// an all-clear sentence (autonomy.md: health wording comes from the spec).
// Saving is NOT gated on the findings - a recipe with a block is saved and
// simply ghosted like a built-in (enforced in recipeView.ts / planning). The
// editor never offers a control to bypass a block (autonomy.md: never weaken
// the safety screen). Saving a brand-new recipe reuses the first-save id on
// subsequent saves, so a double-save updates one recipe (no duplicate).
//
// Edit mode also offers Delete, which routes through the AppProvider context
// helper so the plan slots the recipe occupied are emptied AND surfaced via the
// emptied-slot notice on the library page (Req 3.5/5.6). The pure reducer is
// unchanged.

import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../state/AppProvider';
import { usePagePrimaryAction } from '../components/primaryActionContext';
import { selectAgeMonths } from '../../state/selectors';
import { screenRecipe, type ScreenResult } from '../../domain/safety/screen';
import { foodKeyFor, foodLabel } from '../../domain/foods';
import type {
  GroceryCategory,
  Ingredient,
  MealType,
  Recipe,
  StageId,
} from '../../domain/types';
import { MEAL_TYPES, STAGES, mealTypeLabel, stageLabel } from './recipeView';
import { SCREEN_LIMITS } from '../components/Disclaimer';
import styles from './RecipeEditor.module.css';

const GROCERY_CATEGORIES: readonly GroceryCategory[] = [
  'produce',
  'dairy-eggs',
  'protein',
  'grains',
  'pantry',
  'frozen',
  'other',
];

/** Human label for a grocery category select option. */
function categoryLabel(category: GroceryCategory): string {
  switch (category) {
    case 'dairy-eggs':
      return 'Dairy & eggs';
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}

/** A single ingredient row's editable (string-backed) form fields. */
interface IngredientForm {
  name: string;
  food: string; // "counts as" override
  quantity: string;
  unit: string;
  category: GroceryCategory;
}

/**
 * The food each ingredient "counts as", derived from its current name via the
 * real foodKeyFor (Req 3.3). Multi-group names (e.g. "egg noodles" -> egg +
 * wheat) are labeled and joined, so the user sees what the name maps to and can
 * override it. Returns '' for a blank name.
 */
function derivedCountsAs(name: string): string {
  if (name.trim() === '') return '';
  const keys = foodKeyFor({ name: name.trim(), category: 'other' });
  return keys
    .map(foodLabel)
    .filter((label) => label.length > 0)
    .join(', ');
}

const emptyIngredient = (): IngredientForm => ({
  name: '',
  food: '',
  quantity: '',
  unit: '',
  category: 'produce',
});

/** Per-field validation messages shown when a save is rejected. */
interface FormErrors {
  title?: string;
  stages?: string;
  mealTypes?: string;
  ingredients?: string;
  steps?: string;
  texture?: string;
}

/**
 * Validate the required fields before a save (Req 2.2, 3.1): a recipe needs a
 * title, at least one stage, at least one meal type, at least one ingredient
 * with a name, at least one step, and a texture note. Returns a per-field
 * message map; an empty map means the form is valid.
 */
function validateForm(form: {
  title: string;
  stages: StageId[];
  mealTypes: MealType[];
  ingredients: IngredientForm[];
  steps: string[];
  texture: string;
}): FormErrors {
  const errors: FormErrors = {};
  if (form.title.trim() === '') {
    errors.title = 'Add a title.';
  }
  if (form.stages.length === 0) {
    errors.stages = 'Choose at least one stage.';
  }
  if (form.mealTypes.length === 0) {
    errors.mealTypes = 'Choose at least one meal type.';
  }
  if (form.ingredients.every((row) => row.name.trim() === '')) {
    errors.ingredients = 'Add at least one ingredient.';
  }
  if (form.steps.every((step) => step.trim() === '')) {
    errors.steps = 'Add at least one step.';
  }
  if (form.texture.trim() === '') {
    errors.texture = 'Add a texture note.';
  }
  return errors;
}

/** Prefill the ingredient form rows from a saved recipe's ingredients. */
function toIngredientForms(ingredients: Ingredient[]): IngredientForm[] {
  if (ingredients.length === 0) return [emptyIngredient()];
  return ingredients.map((ing) => ({
    name: ing.name,
    food: ing.food ?? '',
    quantity: ing.quantity === undefined ? '' : String(ing.quantity),
    unit: ing.unit ?? '',
    category: ing.category,
  }));
}

/**
 * Build the persisted Recipe from the form state, dropping empty optional
 * fields so the storage zod schema accepts it (omit storage entirely when both
 * numbers are blank; omit food/quantity/unit when blank). Trims text; keeps
 * only non-empty ingredient and step rows. `id` is preserved on edit or a fresh
 * uuid on create; origin is always 'custom' and no source is written.
 */
function buildRecipe(
  form: {
    title: string;
    stages: StageId[];
    mealTypes: MealType[];
    ingredients: IngredientForm[];
    steps: string[];
    texture: string;
    servings: string;
    statedMinutes: string;
    fridgeDays: string;
    freezerMonths: string;
    makeAheadNote: string;
  },
  id: string,
): Recipe {
  const ingredients: Ingredient[] = form.ingredients
    .filter((row) => row.name.trim() !== '')
    .map((row) => {
      const ingredient: Ingredient = {
        name: row.name.trim(),
        category: row.category,
      };
      const food = row.food.trim();
      if (food !== '') ingredient.food = food;
      const quantity = Number(row.quantity);
      if (row.quantity.trim() !== '' && Number.isFinite(quantity)) {
        ingredient.quantity = quantity;
      }
      const unit = row.unit.trim();
      if (unit !== '') ingredient.unit = unit;
      return ingredient;
    });

  const steps = form.steps.map((s) => s.trim()).filter((s) => s !== '');

  const servingsNum = Number(form.servings);
  const servings =
    form.servings.trim() !== '' && Number.isFinite(servingsNum)
      ? servingsNum
      : 1;

  const recipe: Recipe = {
    id,
    origin: 'custom',
    title: form.title.trim(),
    stages: form.stages,
    mealTypes: form.mealTypes,
    ingredients,
    steps,
    texture: form.texture.trim(),
    servings,
  };

  // Stated total time (Req 4.6): a whole number of minutes, blank for none.
  const minutesNum = Number(form.statedMinutes);
  if (form.statedMinutes.trim() !== '' && Number.isFinite(minutesNum) && minutesNum > 0) {
    recipe.statedMinutes = Math.round(minutesNum);
  }

  const fridgeNum = Number(form.fridgeDays);
  const freezerNum = Number(form.freezerMonths);
  const hasFridge = form.fridgeDays.trim() !== '' && Number.isFinite(fridgeNum);
  const hasFreezer =
    form.freezerMonths.trim() !== '' && Number.isFinite(freezerNum);
  if (hasFridge || hasFreezer) {
    recipe.storage = {};
    if (hasFridge) recipe.storage.fridgeDays = fridgeNum;
    if (hasFreezer) recipe.storage.freezerMonths = freezerNum;
  }

  const note = form.makeAheadNote.trim();
  if (note !== '') recipe.makeAheadNote = note;

  return recipe;
}

export default function RecipeEditor() {
  // Save recipe is this screen's primary button (Req 17.10).
  usePagePrimaryAction(true);
  const { id } = useParams<{ id: string }>();
  const { state, dispatch, deleteCustomRecipe } = useApp();
  const navigate = useNavigate();

  // Edit mode: a custom recipe with this id must exist. A built-in id or a
  // missing id is not editable, so we redirect back to the library (built-ins
  // open read-only at /recipes/:id). The lookup is on customRecipes only.
  const editing = useMemo(
    () =>
      id === undefined
        ? undefined
        : state.customRecipes.find((r) => r.id === id),
    [id, state.customRecipes],
  );
  const isEditMode = id !== undefined;

  // Seed the form once from the recipe being edited (or blank for a new one).
  const [title, setTitle] = useState(editing?.title ?? '');
  const [stages, setStages] = useState<StageId[]>(editing?.stages ?? []);
  const [mealTypes, setMealTypes] = useState<MealType[]>(
    editing?.mealTypes ?? [],
  );
  const [ingredients, setIngredients] = useState<IngredientForm[]>(() =>
    toIngredientForms(editing?.ingredients ?? []),
  );
  const [steps, setSteps] = useState<string[]>(() =>
    editing && editing.steps.length > 0 ? [...editing.steps] : [''],
  );
  const [texture, setTexture] = useState(editing?.texture ?? '');
  const [servings, setServings] = useState(
    editing?.servings === undefined ? '' : String(editing.servings),
  );
  const [statedMinutes, setStatedMinutes] = useState(
    editing?.statedMinutes === undefined ? '' : String(editing.statedMinutes),
  );
  const [fridgeDays, setFridgeDays] = useState(
    editing?.storage?.fridgeDays === undefined
      ? ''
      : String(editing.storage.fridgeDays),
  );
  const [freezerMonths, setFreezerMonths] = useState(
    editing?.storage?.freezerMonths === undefined
      ? ''
      : String(editing.storage.freezerMonths),
  );
  const [makeAheadNote, setMakeAheadNote] = useState(
    editing?.makeAheadNote ?? '',
  );

  // Findings shown after a save (null until the first save on this page).
  const [screen, setScreen] = useState<ScreenResult | null>(null);

  // The id currently being edited. In edit mode this is the route id; on
  // /recipes/new it is null until the FIRST successful save mints a uuid, after
  // which it is reused so re-saving UPDATES the same recipe instead of minting
  // a new uuid each time (no duplicate on double-save).
  const [savedId, setSavedId] = useState<string | null>(null);

  // Per-field validation messages, populated when a save is rejected.
  const [errors, setErrors] = useState<FormErrors>({});

  // Edit mode pointing at a non-existent / built-in id: nothing to edit.
  if (isEditMode && !editing) {
    return (
      <>
        <h1>Recipe not found</h1>
        <p>
          That recipe can&rsquo;t be edited. Built-in recipes are read-only, and
          the recipe may have been deleted.
        </p>
        <p>
          <Link to="/recipes">Back to recipes</Link>
        </p>
      </>
    );
  }

  const toggleStage = (stage: StageId) => {
    setStages((prev) =>
      prev.includes(stage)
        ? prev.filter((s) => s !== stage)
        : [...prev, stage],
    );
  };

  const toggleMeal = (meal: MealType) => {
    setMealTypes((prev) =>
      prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal],
    );
  };

  const updateIngredient = (
    index: number,
    patch: Partial<IngredientForm>,
  ) => {
    setIngredients((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const addIngredient = () =>
    setIngredients((prev) => [...prev, emptyIngredient()]);

  const removeIngredient = (index: number) =>
    setIngredients((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
    );

  const updateStep = (index: number, value: string) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? value : s)));

  const addStep = () => setSteps((prev) => [...prev, '']);

  const removeStep = (index: number) =>
    setSteps((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    // Block the save and surface per-field messages when required fields are
    // missing (Req 2.2, 3.1). The safety screen is NOT run and nothing is
    // dispatched while the form is invalid.
    const validation = validateForm({
      title,
      stages,
      mealTypes,
      ingredients,
      steps,
      texture,
    });
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      setScreen(null);
      return;
    }

    // Reuse the id already being edited (route id in edit mode, or the id the
    // first save on /recipes/new minted). Only mint a fresh uuid the very first
    // time a brand-new recipe is saved, so saving twice updates one recipe
    // rather than creating a duplicate.
    const recipeId = editing?.id ?? savedId ?? crypto.randomUUID();
    const recipe = buildRecipe(
      {
        title,
        stages,
        mealTypes,
        ingredients,
        steps,
        texture,
        servings,
        statedMinutes,
        fridgeDays,
        freezerMonths,
        makeAheadNote,
      },
      recipeId,
    );

    // Run the real safety screen and show the findings; saving is not gated on
    // them (a block simply ghosts the recipe later).
    // Keep what the form does not edit (a pasted recipe's original text,
    // notes, cleared mentions, kind, serve-as), so editing never drops it.
    if (editing) {
      if (editing.imported) recipe.imported = editing.imported;
      if (editing.notes) recipe.notes = editing.notes;
      if (editing.clearedMentions) recipe.clearedMentions = editing.clearedMentions;
      if (editing.kind) recipe.kind = editing.kind;
      if (editing.serveAs) recipe.serveAs = editing.serveAs;
    }

    const result = screenRecipe(recipe, selectAgeMonths(state) ?? 0);
    setScreen(result);
    setSavedId(recipeId);
    dispatch({ type: 'saveCustomRecipe', recipe });
  };

  const handleDelete = () => {
    if (!editing) return;
    deleteCustomRecipe(editing.id);
    navigate('/recipes');
  };

  return (
    <>
      <p className={styles.back}>
        <Link to="/recipes">&larr; Back to recipes</Link>
      </p>

      <h1>{isEditMode ? 'Edit recipe' : 'New recipe'}</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="recipe-title">
            Title
          </label>
          <input
            id="recipe-title"
            className={styles.input}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? 'recipe-title-error' : undefined}
            autoComplete="off"
          />
          {errors.title && (
            <p id="recipe-title-error" className={styles.error} role="alert">
              {errors.title}
            </p>
          )}
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Stages</legend>
          <ul className={styles.checkRow}>
            {STAGES.map((stage) => {
              const inputId = `recipe-stage-${stage}`;
              return (
                <li key={stage} className={styles.check}>
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={stages.includes(stage)}
                    onChange={() => toggleStage(stage)}
                  />
                  <label htmlFor={inputId}>{stageLabel(stage)}</label>
                </li>
              );
            })}
          </ul>
          {errors.stages && (
            <p className={styles.error} role="alert">
              {errors.stages}
            </p>
          )}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Meal types</legend>
          <ul className={styles.checkRow}>
            {MEAL_TYPES.map((meal) => {
              const inputId = `recipe-meal-${meal}`;
              return (
                <li key={meal} className={styles.check}>
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={mealTypes.includes(meal)}
                    onChange={() => toggleMeal(meal)}
                  />
                  <label htmlFor={inputId}>{mealTypeLabel(meal)}</label>
                </li>
              );
            })}
          </ul>
          {errors.mealTypes && (
            <p className={styles.error} role="alert">
              {errors.mealTypes}
            </p>
          )}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Ingredients</legend>
          <ul className={styles.rows}>
            {ingredients.map((row, index) => {
              const rowId = `ingredient-${index}`;
              // The food the recipe will actually save (Req 3.3): the user's
              // override when set, otherwise the name-derived default. Shown as
              // the "Counts as" hint so it always matches what buildRecipe
              // persists as Ingredient.food. The name-derived value is also the
              // placeholder/default when no override is set.
              const override = row.food.trim();
              const derivedFood = derivedCountsAs(row.name);
              const countsAs = override === '' ? derivedFood : override;
              return (
                <li key={index} className={styles.ingredientRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`${rowId}-name`}>
                      Ingredient {index + 1} name
                    </label>
                    <input
                      id={`${rowId}-name`}
                      className={styles.input}
                      type="text"
                      value={row.name}
                      onChange={(e) =>
                        updateIngredient(index, { name: e.target.value })
                      }
                      autoComplete="off"
                    />
                  </div>

                  <div className={styles.field}>
                    <label
                      className={styles.label}
                      htmlFor={`${rowId}-quantity`}
                    >
                      Quantity
                    </label>
                    <input
                      id={`${rowId}-quantity`}
                      className={styles.input}
                      type="number"
                      min="0"
                      step="any"
                      value={row.quantity}
                      onChange={(e) =>
                        updateIngredient(index, { quantity: e.target.value })
                      }
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`${rowId}-unit`}>
                      Unit
                    </label>
                    <input
                      id={`${rowId}-unit`}
                      className={styles.input}
                      type="text"
                      value={row.unit}
                      onChange={(e) =>
                        updateIngredient(index, { unit: e.target.value })
                      }
                      autoComplete="off"
                    />
                  </div>

                  <div className={styles.field}>
                    <label
                      className={styles.label}
                      htmlFor={`${rowId}-category`}
                    >
                      Category
                    </label>
                    <select
                      id={`${rowId}-category`}
                      className={styles.input}
                      value={row.category}
                      onChange={(e) =>
                        updateIngredient(index, {
                          category: e.target.value as GroceryCategory,
                        })
                      }
                    >
                      {GROCERY_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {categoryLabel(category)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`${rowId}-food`}>
                      Counts as (food override)
                    </label>
                    <input
                      id={`${rowId}-food`}
                      className={styles.input}
                      type="text"
                      value={row.food}
                      onChange={(e) =>
                        updateIngredient(index, { food: e.target.value })
                      }
                      placeholder={derivedFood || undefined}
                      autoComplete="off"
                    />
                    {countsAs && (
                      <p className={styles.countsAsHint}>
                        Counts as: {countsAs}
                        {override === '' ? ' (derived from the name)' : ''}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => removeIngredient(index)}
                    disabled={ingredients.length === 1}
                  >
                    Remove ingredient {index + 1}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className={styles.addButton}
            onClick={addIngredient}
          >
            Add ingredient
          </button>
          {errors.ingredients && (
            <p className={styles.error} role="alert">
              {errors.ingredients}
            </p>
          )}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Steps</legend>
          <ul className={styles.rows}>
            {steps.map((step, index) => {
              const stepId = `recipe-step-${index}`;
              return (
                <li key={index} className={styles.stepRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={stepId}>
                      Step {index + 1}
                    </label>
                    <input
                      id={stepId}
                      className={styles.input}
                      type="text"
                      value={step}
                      onChange={(e) => updateStep(index, e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => removeStep(index)}
                    disabled={steps.length === 1}
                  >
                    Remove step {index + 1}
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className={styles.addButton} onClick={addStep}>
            Add step
          </button>
          {errors.steps && (
            <p className={styles.error} role="alert">
              {errors.steps}
            </p>
          )}
        </fieldset>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="recipe-texture">
            Texture
          </label>
          <input
            id="recipe-texture"
            className={styles.input}
            type="text"
            value={texture}
            onChange={(e) => setTexture(e.target.value)}
            aria-invalid={errors.texture ? true : undefined}
            aria-describedby={
              errors.texture ? 'recipe-texture-error' : undefined
            }
            autoComplete="off"
          />
          {errors.texture && (
            <p id="recipe-texture-error" className={styles.error} role="alert">
              {errors.texture}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="recipe-servings">
            Servings
          </label>
          <input
            id="recipe-servings"
            className={styles.input}
            type="number"
            min="1"
            step="1"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="recipe-minutes">
            Total time in minutes (optional)
          </label>
          <input
            id="recipe-minutes"
            className={styles.input}
            type="number"
            min="1"
            step="1"
            value={statedMinutes}
            onChange={(e) => setStatedMinutes(e.target.value)}
          />
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Storage (optional)</legend>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="recipe-fridge-days">
              Fridge days
            </label>
            <input
              id="recipe-fridge-days"
              className={styles.input}
              type="number"
              min="0"
              step="1"
              value={fridgeDays}
              onChange={(e) => setFridgeDays(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="recipe-freezer-months">
              Freezer months
            </label>
            <input
              id="recipe-freezer-months"
              className={styles.input}
              type="number"
              min="0"
              step="1"
              value={freezerMonths}
              onChange={(e) => setFreezerMonths(e.target.value)}
            />
          </div>
        </fieldset>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="recipe-make-ahead">
            Make-ahead note (optional)
          </label>
          <input
            id="recipe-make-ahead"
            className={styles.input}
            type="text"
            value={makeAheadNote}
            onChange={(e) => setMakeAheadNote(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.submit}>
            Save recipe
          </button>
          {isEditMode && (
            <button
              type="button"
              className={styles.delete}
              onClick={handleDelete}
            >
              Delete recipe
            </button>
          )}
        </div>
      </form>

      {screen && (
        <section className={styles.findings} aria-label="Safety screen results">
          <h2>Safety screen</h2>
          <p className={styles.savedNote} role="status">
            Recipe saved.
          </p>

          {screen.blocks.length > 0 && (
            <div className={styles.block} role="note">
              <h3 className={styles.blockHeading}>Not yet</h3>
              <ul className={styles.findingList}>
                {screen.blocks.map((block, i) => (
                  <li key={`${block.ruleId}-${block.ingredientIndex}-${i}`}>
                    <span className={styles.findingLabel}>{block.label}:</span>{' '}
                    {block.message}
                    {block.availableAtMonths !== undefined && (
                      <span className={styles.availableAt}>
                        {' '}
                        Available at {block.availableAtMonths} months.
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {screen.reminders.length > 0 && (
            <div className={styles.reminders}>
              <h3 className={styles.findingHeading}>Prep reminders</h3>
              <ul className={styles.findingList}>
                {screen.reminders.map((reminder, i) => (
                  <li
                    key={`${reminder.ruleId}-${reminder.ingredientIndex}-${i}`}
                  >
                    <span className={styles.findingLabel}>
                      {reminder.ingredientName}:
                    </span>{' '}
                    {reminder.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {screen.allergens.length > 0 && (
            <div className={styles.allergens}>
              <h3 className={styles.findingHeading}>Allergens</h3>
              <ul className={styles.findingList}>
                {screen.allergens.map((allergen, i) => (
                  <li
                    key={`${allergen.ruleId}-${allergen.ingredientIndex}-${i}`}
                  >
                    <span className={styles.findingLabel}>
                      {allergen.ingredientName}:
                    </span>{' '}
                    {allergen.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {screen.blocks.length === 0 &&
            screen.reminders.length === 0 &&
            screen.allergens.length === 0 && (
              <p className={styles.noFindings}>{SCREEN_LIMITS}</p>
            )}

          <p className={styles.viewLink}>
            <Link to="/recipes">Back to recipes</Link>
          </p>
        </section>
      )}
    </>
  );
}
