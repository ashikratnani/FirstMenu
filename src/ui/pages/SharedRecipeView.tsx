// Read-only shared recipe (Requirement 9.4/9.6). Opened from a recipe link at
// /r/:data (`#/r/<data>`). It shows the decoded recipe and one action, "Add to
// my recipes", which saves it as a custom recipe marked as pasted
// (recipeFromShare), so the recipe page screens its text for the recipient's
// child and the user clears any mention with a tap. Nothing is saved until
// that tap, and nothing is fetched.
//
// Wired OUTSIDE the app Layout (App.tsx): no primary nav, so "Add to my
// recipes" is the one filled primary button here. A link that cannot be read
// (bad, cut off or too big) shows only the error, never partial data.

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { decodeRecipeShare, recipeFromShare } from '../../domain/recipeShare';
import { screenRecipe, screenTextMentions } from '../../domain/safety/screen';
import { localYmd } from '../../domain/suggest';
import type { Ingredient } from '../../domain/types';
import { useApp } from '../../state/AppProvider';
import { selectAgeMonths } from '../../state/selectors';
import Disclaimer from '../components/Disclaimer';
import styles from './SharedRecipeView.module.css';

function quantityLabel(ingredient: Ingredient): string {
  const { quantity, unit } = ingredient;
  if (quantity === undefined) return '';
  return unit ? `${quantity} ${unit} ` : `${quantity} `;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.shell}>
      {children}
      <footer className={styles.footer}>
        <Disclaimer />
      </footer>
    </main>
  );
}

export default function SharedRecipeView() {
  const { data } = useParams<{ data: string }>();
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  // One id per opened link, so a second tap saves over the first, not twice.
  const [recipeId] = useState(() => crypto.randomUUID());

  const result = data ? decodeRecipeShare(data) : ({ ok: false } as const);
  if (!result.ok) {
    return (
      <Shell>
        <h1>Shared recipe</h1>
        <p className={styles.error} role="alert">
          This link can&rsquo;t be read. Ask for a new one.
        </p>
      </Shell>
    );
  }

  const shared = result.payload.recipe;
  // The viewer's own safety screen, as the recipe page will run it once the
  // recipe is saved (pasted, so text mentions count). Clearing a mention is
  // only offered on the recipe page after adding.
  const recipe = recipeFromShare(shared, recipeId, localYmd(new Date()));
  const ageMonths = selectAgeMonths(state) ?? 0;
  const { blocks, reminders } = screenRecipe(recipe, ageMonths);
  const textMentions = screenTextMentions(recipe, ageMonths);

  const add = () => {
    dispatch({ type: 'saveCustomRecipe', recipe });
    navigate(`/recipes/${recipe.id}`);
  };

  return (
    <Shell>
      <h1>{shared.title}</h1>
      <p className={styles.intro}>
        Someone shared this recipe with you. Adding it checks it for your child.
      </p>
      {(blocks.length > 0 || textMentions.length > 0) && (
        <section className={styles.ghost} role="note" aria-labelledby="shared-recipe-not-yet">
          <h2 id="shared-recipe-not-yet" className={styles.ghostHeading}>
            Not yet
          </h2>
          <ul className={styles.blockList}>
            {blocks.map((block, i) => (
              <li key={`${block.ruleId}-${block.ingredientIndex}-${i}`}>
                <span className={styles.blockLabel}>{block.label}:</span> {block.message}
                {block.availableAtMonths !== undefined && (
                  <span className={styles.availableAt}>
                    {' '}
                    Available at {block.availableAtMonths} months.
                  </span>
                )}
              </li>
            ))}
            {textMentions.map((mention) => (
              <li key={`${mention.ruleId}-${mention.sentence}`}>
                <span className={styles.blockLabel}>{mention.label}</span> is mentioned in the{' '}
                {mention.where === 'title' ? 'title' : mention.where}: <q>{mention.sentence}</q>{' '}
                {mention.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.meta}>
        <span>Texture: {shared.texture}</span>
        <span>
          Serves {shared.servings} {shared.servings === 1 ? 'portion' : 'portions'}
        </span>
      </p>

      <section aria-labelledby="shared-recipe-ingredients">
        <h2 id="shared-recipe-ingredients">Ingredients</h2>
        <ul className={styles.list}>
          {shared.ingredients.map((ingredient, index) => (
            <li key={`${ingredient.name}-${index}`}>
              {quantityLabel(ingredient)}
              {ingredient.name}
              {ingredient.optional ? ' (optional)' : ''}
              {reminders
                .filter((r) => r.ingredientIndex === index)
                .map((r) => (
                  <span key={r.ruleId} className={styles.prep} role="note">
                    Prep: {r.message}
                  </span>
                ))}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="shared-recipe-steps">
        <h2 id="shared-recipe-steps">Steps</h2>
        <ol className={styles.list}>
          {shared.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </section>

      <section aria-label="Add this recipe" className={styles.actions}>
        <Button label="Add to my recipes" variant="primary" onClick={add} />
      </section>
    </Shell>
  );
}
