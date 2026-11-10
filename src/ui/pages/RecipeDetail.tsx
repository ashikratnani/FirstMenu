// Recipe detail page (Task 9.2, Req 2.7/2.9/5.3/6.1/6.2/13.1). Route
// /recipes/:id. Shows one recipe's ingredients (with per-ingredient prep
// reminders from the real safety screen), steps, texture/servings, storage
// (fridge/freezer + make-ahead note), and — when the recipe is ghosted — the
// block reason(s) prominently near the top with the age the food becomes
// available. Built-in recipes render their published source link and
// adaptations; custom recipes expose Edit and Delete.
//
// Health wording is NOT invented here (autonomy.md): the footer reuses the
// shared <Disclaimer/> component, and the ghost/block wording mirrors the
// Foods page and recipeView.ts helpers. The page offers NO control that would
// let a user bypass a block (blocks are presented honestly).

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { recipeServeAs } from '../../domain/make';
import { useApp } from '../../state/AppProvider';
import { selectAgeMonths, selectAllRecipes } from '../../state/selectors';
import { screenRecipe } from '../../domain/safety/screen';
import type { Ingredient, Recipe, ServeAs } from '../../domain/types';
import { ghostReason, recipeView } from './recipeView';
import Disclaimer from '../components/Disclaimer';
import styles from './RecipeDetail.module.css';

/** "1 cup carrots" style quantity label; omits parts that are absent. */
function quantityLabel(ingredient: Ingredient): string | null {
  const { quantity, unit } = ingredient;
  if (quantity === undefined) return null;
  return unit ? `${quantity} ${unit}` : `${quantity}`;
}

/** "Keeps in the fridge for N day(s)" (Req 6.1). */
function fridgeText(days: number): string {
  return `Keeps in the fridge for ${days} ${days === 1 ? 'day' : 'days'}`;
}

/** "Freezes for N month(s)" (Req 6.1). */
function freezerText(months: number): string {
  return `Freezes for ${months} ${months === 1 ? 'month' : 'months'}`;
}

const SERVE_AS_OPTIONS: ReadonlyArray<{ form: ServeAs; label: string }> = [
  { form: 'puree', label: 'Puree' },
  { form: 'mashed', label: 'Mashed' },
  { form: 'finger-food', label: 'Finger food' },
  { form: 'pieces', label: 'Pieces' },
];

function serveAsText(forms: ServeAs[]): string {
  return SERVE_AS_OPTIONS.filter((o) => forms.includes(o.form))
    .map((o) => o.label)
    .join(', ');
}

/**
 * "Serve as: Mashed (guessed)" (Req 16.13). Custom recipes can be corrected;
 * saving stores the forms on the recipe, so "(guessed)" goes away.
 */
function ServeAsLine({ recipe }: { recipe: Recipe }) {
  const { dispatch } = useApp();
  const { forms, guessed } = recipeServeAs(recipe);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ServeAs[]>(forms);

  if (!editing) {
    return (
      <p className={styles.serveAs}>
        <span>
          Serve as: {serveAsText(forms)}
          {guessed ? ' (guessed)' : ''}
        </span>
        {recipe.origin === 'custom' && (
          <Button
            label="Edit serve as"
            size="sm"
            onClick={() => {
              setDraft(forms);
              setEditing(true);
            }}
          />
        )}
      </p>
    );
  }

  return (
    <fieldset className={styles.serveAsEditor}>
      <legend>Serve as</legend>
      <ul className={styles.serveAsList}>
        {SERVE_AS_OPTIONS.map(({ form, label }) => (
          <li key={form}>
            <CheckboxInput
              label={label}
              value={draft.includes(form)}
              onChange={(checked) =>
                setDraft((current) =>
                  checked ? [...current, form] : current.filter((f) => f !== form),
                )
              }
            />
          </li>
        ))}
      </ul>
      <div className={styles.serveAsActions}>
        <Button
          label="Save serve as"
          isDisabled={draft.length === 0}
          onClick={() => {
            dispatch({
              type: 'saveCustomRecipe',
              recipe: {
                ...recipe,
                serveAs: SERVE_AS_OPTIONS.map((o) => o.form).filter((f) => draft.includes(f)),
              },
            });
            setEditing(false);
          }}
        />
        <Button label="Cancel" onClick={() => setEditing(false)} />
      </div>
    </fieldset>
  );
}

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const { state, deleteCustomRecipe } = useApp();
  const navigate = useNavigate();

  const recipe = selectAllRecipes(state).find((r) => r.id === id);

  if (!recipe) {
    return (
      <>
        <h1>Recipe not found</h1>
        <p>We couldn&rsquo;t find that recipe. It may have been deleted.</p>
        <p>
          <Link to="/recipes">Back to recipes</Link>
        </p>
      </>
    );
  }

  const ageMonths = selectAgeMonths(state) ?? 0;
  const screen = screenRecipe(recipe, ageMonths);
  const view = recipeView(recipe, state);
  const { blocks, reminders } = screen;

  const storage = recipe.storage;
  const source = recipe.source;

  const handleDelete = () => {
    // Route through the context helper (same path the editor uses) so the
    // emptied plan slots are computed and surfaced on the library's notice
    // (Req 3.5), not just emptied silently by the raw reducer action.
    deleteCustomRecipe(recipe.id);
    navigate('/recipes');
  };

  return (
    <article className={styles.page}>
      <p className={styles.back}>
        <Link to="/recipes">&larr; Back to recipes</Link>
      </p>

      <h1>{recipe.title}</h1>

      {/* Ghost / block reasons, prominent near the top (Req 5.3). No control
          here lets the user bypass a block. */}
      {view.isGhosted && (
        <section
          className={styles.ghost}
          role="note"
          aria-label={`Not yet. ${ghostReason(view)}`}
        >
          <h2 className={styles.ghostHeading}>Not yet</h2>
          {blocks.length > 0 ? (
            <ul className={styles.blockList}>
              {blocks.map((block, i) => (
                <li key={`${block.ruleId}-${block.ingredientIndex}-${i}`}>
                  <span className={styles.blockLabel}>{block.label}:</span>{' '}
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
          ) : (
            <p className={styles.ghostReason}>{ghostReason(view)}</p>
          )}
        </section>
      )}

      <p className={styles.meta}>
        <span>Texture: {recipe.texture}</span>
        <span>
          Serves {recipe.servings} {recipe.servings === 1 ? 'portion' : 'portions'}
        </span>
      </p>

      <ServeAsLine key={`${recipe.id}-${recipe.serveAs?.join() ?? ''}`} recipe={recipe} />

      <section aria-labelledby="recipe-ingredients">
        <h2 id="recipe-ingredients">Ingredients</h2>
        <ul className={styles.ingredients}>
          {recipe.ingredients.map((ingredient, index) => {
            const qty = quantityLabel(ingredient);
            const prep = reminders.filter((r) => r.ingredientIndex === index);
            return (
              <li key={`${ingredient.name}-${index}`} className={styles.ingredient}>
                <span className={styles.ingredientName}>
                  {qty ? `${qty} ` : ''}
                  {ingredient.name}
                </span>
                {prep.map((reminder) => (
                  <span
                    key={reminder.ruleId}
                    className={styles.prep}
                    role="note"
                  >
                    Prep: {reminder.message}
                  </span>
                ))}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="recipe-steps">
        <h2 id="recipe-steps">Steps</h2>
        <ol className={styles.steps}>
          {recipe.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </section>

      {(storage?.fridgeDays !== undefined ||
        storage?.freezerMonths !== undefined ||
        recipe.makeAheadNote) && (
        <section aria-labelledby="recipe-storage">
          <h2 id="recipe-storage">Storage</h2>
          <ul className={styles.storage}>
            {storage?.fridgeDays !== undefined && (
              <li>{fridgeText(storage.fridgeDays)}</li>
            )}
            {storage?.freezerMonths !== undefined && (
              <li>{freezerText(storage.freezerMonths)}</li>
            )}
          </ul>
          {recipe.makeAheadNote && (
            <p className={styles.makeAhead}>{recipe.makeAheadNote}</p>
          )}
        </section>
      )}

      {source && (
        <section aria-labelledby="recipe-source" className={styles.source}>
          <h2 id="recipe-source">Source</h2>
          <p>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>{' '}
            &mdash; {source.publisher}
          </p>
          <p className={styles.retrieved}>Retrieved {source.retrieved}</p>
          {source.adaptations.length > 0 && (
            <>
              <h3 className={styles.adaptationsHeading}>Adaptations</h3>
              <ul className={styles.adaptations}>
                {source.adaptations.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </>
          )}
          {source.storageSource && (
            <p className={styles.storageSource}>
              Storage times:{' '}
              <a
                href={source.storageSource}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.publisher}
              </a>
            </p>
          )}
        </section>
      )}

      {recipe.origin === 'custom' && (
        <section aria-label="Recipe actions" className={styles.actions}>
          <Link to={`/recipes/${recipe.id}/edit`} className={styles.edit}>
            Edit
          </Link>
          <button
            type="button"
            className={styles.delete}
            onClick={handleDelete}
          >
            Delete
          </button>
        </section>
      )}

      <footer className={styles.footer}>
        <Disclaimer />
      </footer>
    </article>
  );
}
