// "Share recipe" (Requirement 9.1/9.2). On a device with the system share sheet
// it opens that sheet with the recipe text and the link; otherwise it copies
// the text and link. Everything comes from domain/recipeShare.ts, which leaves
// out the child's details and any pasted original text (Req 9.5). Nothing is
// sent anywhere by the app.

import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { encodeRecipeShare, recipeShareText } from '../../domain/recipeShare';
import type { Recipe } from '../../domain/types';
import styles from '../pages/RecipeDetail.module.css';

export default function ShareRecipe({ recipe }: { recipe: Recipe }) {
  const [message, setMessage] = useState('');

  const share = async () => {
    const text = recipeShareText(recipe);
    const { url } = encodeRecipeShare(recipe);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: recipe.title, text, url });
        return;
      } catch (error) {
        // The user closing the sheet is not an error.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Any other failure: fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n\n${url}`);
      setMessage('Copied the recipe and link.');
    } catch {
      setMessage('Could not copy. Try again from a secure page.');
    }
  };

  return (
    <div className={styles.planAction}>
      <Button label="Share recipe" variant="secondary" onClick={() => void share()} />
      <p role="status" className={styles.status}>
        {message}
      </p>
    </div>
  );
}
