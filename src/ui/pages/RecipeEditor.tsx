// Custom recipe editor (Task 9.3, Req 3.1-3.5, 4.9, 5.6). One component serves
// BOTH /recipes/new (blank form) and /recipes/:id/edit (prefilled from the
// matching custom recipe). A controlled form exposes every Recipe field,
// including a per-ingredient "counts as" food override (Ingredient.food) and
// dynamic ingredient/step rows.
//
// On SAVE the real safety screen runs (screenRecipe) and the findings are shown
// on the page: block reasons (with the age the food becomes available),
// per-ingredient prep reminders, and allergen reminders. Saving is NOT gated on
// the findings - a recipe with a block is saved and simply ghosted like a
// built-in (enforced in recipeView.ts / planning). The editor never offers a
// control to bypass a block (autonomy.md: never weaken the safety screen).
//
// Edit mode also offers Delete, which routes through the AppProvider context
// helper so the plan slots the recipe occupied are emptied AND surfaced via the
// emptied-slot notice on the library page (Req 3.5/5.6). The pure reducer is
// unchanged.

import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../state/AppProvider';
import { selectAgeMonths } from '../../state/selectors';
import { screenRecipe, type ScreenResult } from '../../domain/safety/screen';
import type {
  GroceryCategory,
  Ingredient,
  MealType,
  Recipe,
  StageId,
} from '../../domain/types';
import { MEAL_TYPES, STAGES, mealTypeLabel, stageLabel } from './recipeView';
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

const emptyIngredient = (): IngredientForm => ({
  name: '',
  food: '',
  quantity: '',
  unit: '',
  category: 'produce',
});

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
    const recipeId = editing?.id ?? crypto.randomUUID();
    const recipe = buildRecipe(
      {
        title,
        stages,
        mealTypes,
        ingredients,
        steps,
        texture,
        servings,
        fridgeDays,
        freezerMonths,
        makeAheadNote,
      },
      recipeId,
    );

    // Run the real safety screen and show the findings; saving is not gated on
    // them (a block simply ghosts the recipe later).
    const result = screenRecipe(recipe, selectAgeMonths(state) ?? 0);
    setScreen(result);
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
            required
            autoComplete="off"
          />
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
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Ingredients</legend>
          <ul className={styles.rows}>
            {ingredients.map((row, index) => {
              const rowId = `ingredient-${index}`;
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
                      autoComplete="off"
                    />
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
            autoComplete="off"
          />
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
              <p className={styles.noFindings}>
                No safety flags for this recipe at the current age.
              </p>
            )}

          <p className={styles.viewLink}>
            <Link to="/recipes">Back to recipes</Link>
          </p>
        </section>
      )}
    </>
  );
}
