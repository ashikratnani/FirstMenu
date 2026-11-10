// Pantry editor (Requirements 2.1 to 2.3): tick foods from a suggested list or
// type any food name. Edits are saved as you go. Used inside the Make screen's
// dialog and first-use panel, and on the Settings page. It has its own name
// entry, so the Make screen itself keeps a single text box (Req 3.1).

import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Token } from '@astryxdesign/core/Token';
import { SUGGESTED_PANTRY_NAMES } from '../../data/foodNames';
import { foodKeyFromName, foodLabel } from '../../domain/foods';
import { suggestedChips } from '../../domain/make';
import { useApp } from '../../state/AppProvider';
import { selectAllRecipes } from '../../state/selectors';
import styles from './PantryEditor.module.css';

/** How many common recipe ingredients are added after the household staples. */
const COMMON_FOODS = 8;

export default function PantryEditor({ idPrefix = 'pantry' }: { idPrefix?: string }) {
  const { state, dispatch } = useApp();
  const [typed, setTyped] = useState('');
  const recipes = selectAllRecipes(state);

  // Household staples first, then the foods most recipes use (design
  // "Suggested pantry list"). Every entry is an ordinary food key.
  const suggested = useMemo(() => {
    const keys = SUGGESTED_PANTRY_NAMES.map(foodKeyFromName);
    for (const key of suggestedChips(recipes, []).slice(0, COMMON_FOODS)) {
      if (!keys.includes(key)) keys.push(key);
    }
    return keys.filter((key, i) => key.length > 0 && keys.indexOf(key) === i);
  }, [recipes]);

  const others = state.pantry.filter((key) => !suggested.includes(key));

  const toggle = (key: string, on: boolean) => {
    const next = on
      ? [...state.pantry, key]
      : state.pantry.filter((existing) => existing !== key);
    dispatch({ type: 'setPantry', foods: next });
  };

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    const key = foodKeyFromName(typed);
    if (key.length === 0) return;
    if (!state.pantry.includes(key)) {
      dispatch({ type: 'setPantry', foods: [...state.pantry, key] });
    }
    setTyped('');
  };

  return (
    <div className={styles.editor}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Suggested foods</legend>
        <ul className={styles.checklist}>
          {suggested.map((key) => (
            <li key={key}>
              <CheckboxInput
                label={foodLabel(key)}
                value={state.pantry.includes(key)}
                onChange={(checked) => toggle(key, checked)}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      {others.length > 0 && (
        <section aria-labelledby={`${idPrefix}-yours`}>
          <h3 id={`${idPrefix}-yours`} className={styles.subheading}>
            Foods you added
          </h3>
          <ul className={styles.tokens}>
            {others.map((key) => (
              <li key={key}>
                <Token
                  label={foodLabel(key)}
                  onRemove={() => toggle(key, false)}
                  description={`Remove ${foodLabel(key)} from your pantry`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className={styles.addRow} onSubmit={handleAdd}>
        <TextInput
          label="Add a food to your pantry"
          value={typed}
          onChange={setTyped}
          autoComplete="off"
          placeholder="e.g. lentils"
        />
        <Button label="Add to pantry" type="submit" isDisabled={typed.trim() === ''} />
      </form>
    </div>
  );
}
