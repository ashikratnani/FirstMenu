// Onboarding step 3 (Requirement 20.3, 20.9): one quick solve for the first
// chosen problem. Everything runs on the device from existing data and code:
// no network request, no new stored field. Each solve has one filled primary
// button and a secondary "Skip" (Requirement 20.4, 17.10).

import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Token } from '@astryxdesign/core/Token';
import { foodLabel } from '../../domain/foods';
import { buildVocabulary, searchHave } from '../../domain/foodSearch';
import { makeResults } from '../../domain/make';
import { computeGroceryList, type GroceryGroup } from '../../domain/grocery';
import { leaveOutFor } from '../../domain/prompt';
import { recipeEffort, recipeMinutes } from '../../domain/effort';
import { parseRecipeReply } from '../../domain/recipeJson';
import { RULES, SOURCES, type SourceId } from '../../domain/safety/rules';
import { screenIngredient, screenRecipe, screenTextMentions } from '../../domain/safety/screen';
import { localYmd } from '../../domain/suggest';
import type { MealType, Recipe } from '../../domain/types';
import { useApp } from '../../state/AppProvider';
import { selectAgeMonths, selectAllRecipes, selectStage } from '../../state/selectors';
import AskChatGpt from '../components/AskChatGpt';
import { NOT_MEDICAL_ADVICE, SCREEN_LIMITS } from '../components/Disclaimer';
import FoodSearchBox from '../components/FoodSearchBox';
import { usePagePrimaryAction } from '../components/primaryActionContext';
import ReelPrompt from '../components/ReelPrompt';
import ResultCard from '../components/ResultCard';
import { buildRecipe, draftFromParsed } from './addRecipeDraft';
import { effortLabel } from './makeView';
import type { ProblemId } from './onboardingProblems';
import { draftWeek } from './draftWeek';
import { dayLabel } from './recipeView';
import styles from './Onboarding.module.css';

/** The sample reply "Try an example" reads. It is parsed, never saved. */
export const SAMPLE_REPLY = `Here is a recipe you can try.
{
  "firstmenu_recipe": 1,
  "title": "Oat and banana pancakes",
  "total_minutes": 15,
  "servings": 2,
  "ingredients": [
    { "quantity": 0.5, "unit": "cup", "name": "rolled oats", "optional": false },
    { "quantity": 1, "unit": null, "name": "ripe banana", "optional": false },
    { "quantity": 1, "unit": null, "name": "egg", "optional": false }
  ],
  "steps": ["Mash the banana and mix in the oats and egg.", "Cook small spoonfuls in a pan until set."],
  "notes": []
}`;

const TOP_LIMIT = 3;

export interface OnboardingSolveProps {
  problem: ProblemId;
  /** The solve finished: the flow shows the end screen or Make. */
  onDone: () => void;
  /** Skip lands on Make. */
  onSkip: () => void;
}

export default function OnboardingSolve({ problem, onDone, onSkip }: OnboardingSolveProps) {
  usePagePrimaryAction(true);
  switch (problem) {
    case 'make':
      return <SolveMake onDone={onDone} onSkip={onSkip} />;
    case 'save':
      return <SolveSave onSkip={onSkip} />;
    case 'plan':
      return <SolvePlan onDone={onDone} onSkip={onSkip} />;
    default:
      return <SolveSafe onDone={onDone} onSkip={onSkip} />;
  }
}

/** The two disclaimers of Requirement 11, shown beside safety results (Requirement 20.9). */
function Disclaimers() {
  return (
    <div className={styles.disclaimers}>
      <p>{NOT_MEDICAL_ADVICE}</p>
      <p>{SCREEN_LIMITS}</p>
    </div>
  );
}

function Frame({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.solve} aria-labelledby={id}>
      <h1 id={id}>{title}</h1>
      {children}
    </section>
  );
}

interface DoneProps {
  onDone: () => void;
  onSkip: () => void;
}

// --- What can I make ------------------------------------------------------

function SolveMake({ onDone, onSkip }: DoneProps) {
  const { state, dispatch } = useApp();
  const ageMonths = selectAgeMonths(state) ?? 0;
  const recipes = selectAllRecipes(state);
  const [text, setText] = useState('');
  const [ignored, setIgnored] = useState<string[]>([]);

  const vocabulary = useMemo(
    () => buildVocabulary(recipes, [...state.pantry, ...state.onHand]),
    [recipes, state.pantry, state.onHand],
  );
  const search = useMemo(() => searchHave(text, vocabulary), [text, vocabulary]);
  const typed = search.foods.filter((food) => !ignored.includes(food));
  const have = useMemo(
    () => new Set([...state.pantry, ...state.onHand, ...typed]),
    [state.pantry, state.onHand, typed],
  );
  const groups = useMemo(
    () => makeResults(recipes, have, ageMonths, state.foods, { filters: search.filters }),
    [recipes, have, ageMonths, state.foods, search.filters],
  );
  const top = [
    ...groups.readyNow.map((result) => ({ result, missing: false })),
    ...groups.missingOne.map((result) => ({ result, missing: true })),
  ].slice(0, TOP_LIMIT);

  const keep = () => {
    if (typed.length === 0) return;
    const today = localYmd(new Date());
    for (const food of typed) dispatch({ type: 'addOnHand', food, today });
    onDone();
  };

  return (
    <Frame id="solve-make" title="What can I make?">
      <p>Type what you have. Recipes you can make show up as you type.</p>
      <FoodSearchBox
        value={text}
        onChange={(value) => {
          setText(value);
          if (value === '') setIgnored([]);
        }}
      />
      {typed.length > 0 && (
        <ul className={styles.chips} aria-label="Recognized foods">
          {typed.map((food) => (
            <li key={food}>
              <Token
                label={foodLabel(food)}
                color="teal"
                description={`Remove ${foodLabel(food)}`}
                onRemove={() => setIgnored((current) => [...current, food])}
              />
            </li>
          ))}
        </ul>
      )}
      {top.length > 0 && (
        <ul className={styles.results} aria-label="Top recipes">
          {top.map(({ result, missing }) => (
            <ResultCard key={result.recipe.id} result={result} showMissing={missing} />
          ))}
        </ul>
      )}
      <div className={styles.row}>
        <Button
          label="Keep these foods"
          variant="primary"
          size="lg"
          onClick={keep}
          isDisabled={typed.length === 0}
        />
        <Button label="Skip" onClick={onSkip} />
      </div>
    </Frame>
  );
}

// --- Save recipes -----------------------------------------------------------

function SolveSave({ onSkip }: { onSkip: () => void }) {
  const { state } = useApp();
  const navigate = useNavigate();
  const ageMonths = selectAgeMonths(state) ?? 0;
  const stage = selectStage(state) ?? '6-8';
  const [example, setExample] = useState<Recipe | null>(null);

  const have = [...new Set([...state.pantry, ...state.onHand])].map(foodLabel);

  function tryExample() {
    const result = parseRecipeReply(SAMPLE_REPLY);
    if (result.kind !== 'recipe') return;
    setExample(
      buildRecipe(draftFromParsed(result.parsed, result.extras), {
        id: 'onboarding-example',
        stage,
        from: 'chatgpt',
        url: '',
        originalText: SAMPLE_REPLY,
        today: localYmd(new Date()),
        cleared: [],
      }),
    );
  }

  return (
    <Frame id="solve-save" title="Save recipes">
      <p>Ask ChatGPT, or send an Instagram reel to an AI app, then paste its answer into FirstMenu.</p>
      <div className={styles.boxes}>
        <AskChatGpt
          ageMonths={ageMonths}
          stage={stage}
          have={have}
          leaveOut={leaveOutFor(ageMonths, state.foods)}
        />
        <ReelPrompt onPasteAnswer={() => navigate('/add')} />
      </div>
      <div className={styles.row}>
        <Button label="Try an example" onClick={tryExample} />
      </div>
      {example !== null && <ExamplePreview recipe={example} ageMonths={ageMonths} />}
      <div className={styles.row}>
        <Button label="Open Add recipe" variant="primary" size="lg" onClick={() => navigate('/add')} />
        <Button label="Skip" onClick={onSkip} />
      </div>
    </Frame>
  );
}

function ExamplePreview({ recipe, ageMonths }: { recipe: Recipe; ageMonths: number }) {
  const screen = screenRecipe(recipe, ageMonths);
  const mentions = screenTextMentions(recipe, ageMonths);
  const minutes = recipeMinutes(recipe);
  return (
    <section className={styles.card} aria-label="Example preview">
      <h2>{recipe.title}</h2>
      <p>
        This is an example. Nothing was saved.
      </p>
      <p>
        {minutes !== undefined && `${minutes.minutes} min · `}
        {effortLabel(recipeEffort(recipe))}
      </p>
      <ul className={styles.list} aria-label="Ingredients">
        {recipe.ingredients.map((ingredient, index) => (
          <li key={index}>{ingredient.name}</li>
        ))}
      </ul>
      <div role="status" aria-label="Safety results">
        <h3>Safety check</h3>
        <ul className={styles.list}>
          {screen.blocks.map((finding, index) => (
            <li key={`block-${index}`}>
              <strong>Not safe yet:</strong> {finding.ingredientName}. {finding.message}
            </li>
          ))}
          {mentions.map((mention) => (
            <li key={`${mention.ruleId}-${mention.sentence}`}>
              <strong>Not safe yet:</strong> {mention.label} is mentioned: <q>{mention.sentence}</q>{' '}
              {mention.message}
            </li>
          ))}
          {screen.reminders.map((finding, index) => (
            <li key={`reminder-${index}`}>
              <strong>Reminder:</strong> {finding.ingredientName}. {finding.message}
            </li>
          ))}
          {screen.allergens.map((finding, index) => (
            <li key={`allergen-${index}`}>
              <strong>Allergen:</strong> {finding.ingredientName}. {finding.message}
            </li>
          ))}
        </ul>
        <Disclaimers />
      </div>
    </section>
  );
}

// --- Plan and grocery ---------------------------------------------------------

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

function SolvePlan({ onDone, onSkip }: DoneProps) {
  const { state, dispatch } = useApp();
  const ageMonths = selectAgeMonths(state) ?? 0;
  const recipes = selectAllRecipes(state);
  const draft = useMemo(() => draftWeek(state, recipes), [state, recipes]);
  const groceries: GroceryGroup[] = useMemo(
    () => computeGroceryList(draft.plan, recipes, state, ageMonths),
    [draft, recipes, state, ageMonths],
  );
  const title = (id: string) => recipes.find((r) => r.id === id)?.title ?? id;

  const keep = () => {
    if (state.plan.activeSlots.length === 0) {
      dispatch({ type: 'setActiveSlots', activeSlots: draft.plan.activeSlots });
    }
    for (const { day, meal, recipeId } of draft.added) {
      dispatch({ type: 'setSlot', slot: { day, meal }, recipeId });
    }
    onDone();
  };

  return (
    <Frame id="solve-plan" title="Plan the week">
      {draft.added.length === 0 ? (
        <p>Your week is already planned.</p>
      ) : (
        <p>Here is a draft week. Nothing is kept until you tap Keep this plan.</p>
      )}
      <ul className={styles.list} aria-label="Draft week">
        {draft.plan.days.map((day, index) => {
          const meals = draft.plan.activeSlots.filter((meal) => day[meal] !== undefined);
          if (meals.length === 0) return null;
          return (
            <li key={index}>
              {dayLabel(index)}: {meals.map((meal) => `${MEAL_LABELS[meal]} ${title(day[meal]!)}`).join(', ')}
            </li>
          );
        })}
      </ul>
      {groceries.length > 0 && (
        <section aria-label="Grocery list">
          <h2>Grocery list</h2>
          {groceries.map((group) => (
            <div key={group.category}>
              <h3>{group.category.charAt(0).toUpperCase() + group.category.slice(1)}</h3>
              <ul className={styles.list}>
                {group.lines.map((line) => (
                  <li key={line.key}>
                    {line.label}
                    {line.quantity !== undefined ? `, ${line.quantity}${line.unit ? ` ${line.unit}` : ''}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      <div className={styles.row}>
        <Button label="Keep this plan" variant="primary" size="lg" onClick={keep} />
        <Button label="Not now" onClick={onDone} />
        <Button label="Skip" onClick={onSkip} />
      </div>
    </Frame>
  );
}

// --- What's safe ------------------------------------------------------------

function SourceLinks({ ids }: { ids: readonly SourceId[] }) {
  return (
    <>
      {' '}
      Source{ids.length > 1 ? 's' : ''}:{' '}
      {ids.map((id, index) => (
        <span key={id}>
          {index > 0 && ', '}
          <a className="fm-link" href={SOURCES[id].url} target="_blank" rel="noopener noreferrer">
            {SOURCES[id].title}
          </a>
        </span>
      ))}
    </>
  );
}

function SolveSafe({ onDone, onSkip }: DoneProps) {
  const { state } = useApp();
  const ageMonths = selectAgeMonths(state) ?? 0;
  const [food, setFood] = useState('');
  const [checked, setChecked] = useState<string | null>(null);

  const leaveOut = useMemo(() => leaveOutFor(ageMonths, state.foods), [ageMonths, state.foods]);
  const findings = useMemo(
    () => (checked === null ? [] : screenIngredient(checked, ageMonths)),
    [checked, ageMonths],
  );

  const check = () => {
    if (food.trim() !== '') setChecked(food.trim());
  };

  return (
    <Frame id="solve-safe" title="Foods to leave out">
      <p>These are the foods on FirstMenu&apos;s list for your child&apos;s age.</p>
      <ul className={styles.list} aria-label="Leave out for your child's age">
        {leaveOut.map((label) => {
          const rule = RULES.find((r) => r.kind === 'block' && r.label.toLowerCase() === label.toLowerCase());
          return (
            <li key={label}>
              <strong>{label}</strong>
              {rule && (
                <>
                  . {rule.message}
                  <SourceLinks ids={rule.sources} />
                </>
              )}
            </li>
          );
        })}
      </ul>
      <div className={styles.row}>
        <TextInput
          label="Check a food"
          value={food}
          onChange={setFood}
          onEnter={check}
          autoComplete="off"
          enterKeyHint="done"
        />
        <Button label="Check food" onClick={check} isDisabled={food.trim() === ''} />
      </div>
      <div role="status" aria-label="Food check result" className={styles.card}>
        {checked !== null &&
          (findings.length === 0 ? (
            <p>{`FirstMenu's list has no rule for ${checked} at this age.`}</p>
          ) : (
            <ul className={styles.list}>
              {findings.map((finding) => {
                const rule = RULES.find((r) => r.id === finding.ruleId);
                return (
                  <li key={finding.ruleId}>
                    <strong>{finding.label}.</strong> {finding.message}
                    {rule && <SourceLinks ids={rule.sources} />}
                  </li>
                );
              })}
            </ul>
          ))}
        <Disclaimers />
      </div>
      <div className={styles.row}>
        <Button label="Done" variant="primary" size="lg" onClick={onDone} />
        <Button label="Skip" onClick={onSkip} />
      </div>
    </Frame>
  );
}
