// Add recipe (`/add`, active spec Requirements 6, 7.3 to 7.5, 11.2, 17.7,
// 17.10), built on Astryx components. The parent pastes a recipe from ChatGPT
// or an Instagram caption, reads it, checks the preview and saves it without
// typing anything. Parsing and the safety screen run on the device; the
// optional link is never fetched and the clipboard is read only when the
// "Paste" button is tapped.
//
// One filled primary button at a time (Req 17.10): "Paste" before a preview,
// "Save recipe" during one. "Read recipe" is secondary, and the shell hides its
// own "Add recipe" button on this page.

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { foodLabel } from '../../domain/foods';
import { MAX_PASTE_CHARS, parseRecipeText } from '../../domain/importText';
import { recipeEffort, recipeMinutes } from '../../domain/effort';
import { recipeNutritionTags } from '../../domain/nutrition';
import { leaveOutFor } from '../../domain/prompt';
import { screenRecipe, screenTextMentions } from '../../domain/safety/screen';
import { localYmd } from '../../domain/suggest';
import type { ClearedMention, ImportedInfo } from '../../domain/types';
import { useApp } from '../../state/AppProvider';
import { selectAgeMonths, selectStage } from '../../state/selectors';
import AskChatGpt from '../components/AskChatGpt';
import { usePagePrimaryAction } from '../components/primaryActionContext';
import {
  buildRecipe,
  draftFromParsed,
  editLine,
  isWebLink,
  markAsIngredients,
  moveLine,
  removeLine,
  type Draft,
  type DraftLine,
  type LineList,
} from './addRecipeDraft';
import { FIXED_LIST_NOTE, effortLabel, tagLabel, timeLabel } from './makeView';
import styles from './AddRecipe.module.css';

type Source = ImportedInfo['from'];

const SOURCES: ReadonlyArray<{ value: Source; label: string }> = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'other', label: 'Other' },
];

export const PASTE_FALLBACK = 'Paste with your keyboard or long-press';

export const INSTAGRAM_HELP =
  "Instagram reels can't be opened here. Copy the caption instead. On a phone, you can also copy text from a screenshot by pressing and holding on it.";

const LIST_LABELS: Record<LineList, string> = {
  ingredients: 'ingredient',
  steps: 'step',
  notes: 'note',
};

const MOVE_TARGETS: Record<LineList, LineList[]> = {
  ingredients: ['steps', 'notes'],
  steps: ['ingredients', 'notes'],
  notes: ['ingredients', 'steps'],
};

interface LineRowProps {
  list: LineList;
  line: DraftLine;
  onEdit: (text: string) => void;
  onRemove: () => void;
  onMove: (to: LineList) => void;
}

/** One preview line: its text with Edit, Delete and move buttons. */
function LineRow({ list, line, onEdit, onRemove, onMove }: LineRowProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(line.text);
  const kind = LIST_LABELS[list];

  function finish(event: FormEvent) {
    event.preventDefault();
    if (value.trim() === '') {
      onRemove();
      return;
    }
    onEdit(value.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <li className={styles.line}>
        <form className={styles.editForm} onSubmit={finish}>
          <input
            className={styles.editInput}
            aria-label={`Edit ${kind}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
          <button type="submit" className={styles.lineButton}>
            Done
          </button>
          <button
            type="button"
            className={styles.lineButton}
            onClick={() => {
              setValue(line.text);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className={styles.line}>
      <span className={styles.lineText}>{line.text}</span>
      <span className={styles.lineActions}>
        <button
          type="button"
          className={styles.lineButton}
          aria-label={`Edit ${kind}: ${line.text}`}
          onClick={() => {
            setValue(line.text);
            setEditing(true);
          }}
        >
          Edit
        </button>
        {MOVE_TARGETS[list].map((to) => (
          <button
            key={to}
            type="button"
            className={styles.lineButton}
            aria-label={`Move ${kind} to ${to}: ${line.text}`}
            onClick={() => onMove(to)}
          >
            To {to}
          </button>
        ))}
        <button
          type="button"
          className={styles.lineButton}
          aria-label={`Delete ${kind}: ${line.text}`}
          onClick={onRemove}
        >
          Delete
        </button>
      </span>
    </li>
  );
}

export default function AddRecipe() {
  // "Paste" before a preview, "Save recipe" during one: always one primary.
  usePagePrimaryAction(true);

  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ageMonths = selectAgeMonths(state) ?? 0;
  const stage = selectStage(state) ?? '6-8';

  const [source, setSource] = useState<Source>(
    params.get('from') === 'chatgpt' ? 'chatgpt' : 'other',
  );
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cleared, setCleared] = useState<ClearedMention[]>([]);
  const [markMode, setMarkMode] = useState(false);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const pasteBox = useRef<HTMLTextAreaElement>(null);
  const [recipeId] = useState(() => crypto.randomUUID());

  const have = [...new Set([...state.pantry, ...state.onHand])].map(foodLabel);

  function read(source: string) {
    if (source.trim() === '') {
      setMessage('Paste a recipe first, then tap Read recipe.');
      return;
    }
    if (source.length > MAX_PASTE_CHARS) {
      setMessage('The text is too long to read (over 20,000 characters).');
      return;
    }
    if (url.trim() !== '' && !isWebLink(url)) {
      setMessage('The link must start with http:// or https://');
      return;
    }
    setMessage('');
    setCleared([]);
    setMarkMode(false);
    setMarked(new Set());
    setDraft(draftFromParsed(parseRecipeText(source)));
  }

  // The clipboard is read here, inside the tap, and nowhere else (Req 17.7).
  async function paste() {
    try {
      if (!navigator.clipboard?.readText) throw new Error('unsupported');
      const clip = await navigator.clipboard.readText();
      setText(clip);
      read(clip);
    } catch {
      setMessage(PASTE_FALLBACK);
      pasteBox.current?.focus();
    }
  }

  function focusPasteBox() {
    setSource('chatgpt');
    setMessage('');
    pasteBox.current?.focus();
  }

  const recipe = useMemo(
    () =>
      draft
        ? buildRecipe(draft, {
            id: recipeId,
            stage,
            from: source,
            url,
            originalText: text,
            today: localYmd(new Date()),
            cleared,
          })
        : null,
    [draft, recipeId, stage, source, url, text, cleared],
  );

  const screen = useMemo(
    () => (recipe ? screenRecipe(recipe, ageMonths) : null),
    [recipe, ageMonths],
  );
  const mentions = useMemo(
    () => (recipe ? screenTextMentions(recipe, ageMonths) : []),
    [recipe, ageMonths],
  );

  function update(change: (current: Draft) => Draft) {
    setDraft((current) => (current ? change(current) : current));
  }

  function save() {
    if (!recipe) return;
    dispatch({ type: 'saveCustomRecipe', recipe });
    navigate(`/recipes/${recipe.id}`);
  }

  function startOver() {
    setDraft(null);
    setMarkMode(false);
    setMessage('');
  }

  const time = recipe ? recipeMinutes(recipe) : undefined;
  const timeText = timeLabel({ minutes: time?.minutes, minutesKind: time?.kind ?? 'stated' });
  const blockCount = (screen?.blocks.length ?? 0) + mentions.length;

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Add recipe</h1>
      <p className={styles.intro}>
        Paste a recipe from ChatGPT or an Instagram caption. FirstMenu reads it
        on your device and checks it before you save.
      </p>

      {draft === null && (
        <>
          <section className={styles.section} aria-label="Where it came from">
            <fieldset className={styles.sourcePicker}>
              <legend className={styles.legend}>Where did it come from?</legend>
              {SOURCES.map((s) => (
                <label key={s.value} className={styles.sourceOption}>
                  <input
                    type="radio"
                    name="recipe-source"
                    checked={source === s.value}
                    onChange={() => setSource(s.value)}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </fieldset>
            <TextInput
              label="Link (optional)"
              description="FirstMenu keeps this link with the recipe and never opens it."
              type="url"
              value={url}
              onChange={setUrl}
              autoComplete="off"
              placeholder="https://"
            />
          </section>

          <section className={styles.section} aria-label="Paste the recipe">
            <TextArea
              ref={pasteBox}
              label="Recipe text"
              value={text}
              onChange={setText}
              rows={10}
              placeholder="Paste the recipe here"
            />
            <div className={styles.row}>
              <Button label="Paste" variant="primary" onClick={() => void paste()} />
              <Button label="Read recipe" onClick={() => read(text)} />
            </div>
            {message && (
              <p className={styles.status} role="status">
                {message}
              </p>
            )}
            <p className={styles.help}>{INSTAGRAM_HELP}</p>
          </section>

          <section className={styles.section}>
            <AskChatGpt
              ageMonths={ageMonths}
              stage={stage}
              have={have}
              leaveOut={leaveOutFor(ageMonths, state.foods)}
              onPasteAnswer={focusPasteBox}
            />
          </section>

          <p className={styles.help}>
            <Link to="/recipes/new">Type a recipe instead</Link>
          </p>
        </>
      )}

      {draft !== null && recipe !== null && screen !== null && (
        <section className={styles.section} aria-label="Preview">
          <h2 className={styles.subheading}>Check the recipe</h2>

          <TextInput
            label="Title"
            value={draft.title}
            onChange={(value) => update((d) => ({ ...d, title: value }))}
            autoComplete="off"
          />

          <p className={styles.facts}>
            {timeText}
            {' · '}
            {effortLabel(recipeEffort(recipe))}
            {recipeNutritionTags(recipe).map((tag) => ` · ${tagLabel(tag)}`)}
          </p>

          {draft.warnings.map((warning) => (
            <p key={warning} className={styles.warning} role="status">
              {warning}
            </p>
          ))}

          <section className={styles.results} aria-label="Safety results">
            <h3 className={styles.subheading}>Safety check</h3>
            {screen.blocks.length === 0 &&
              mentions.length === 0 &&
              screen.reminders.length === 0 &&
              screen.allergens.length === 0 && (
                <p>Nothing on FirstMenu&apos;s list was found in this recipe.</p>
              )}
            {blockCount > 0 && (
              <p className={styles.warning}>
                Not safe yet for your child. You can still save it, but it will
                not show up in your ideas.
              </p>
            )}
            <ul className={styles.findings}>
              {screen.blocks.map((finding, index) => (
                <li key={`block-${index}`}>
                  <strong>Not safe yet:</strong> {finding.ingredientName}.{' '}
                  {finding.message} Delete the ingredient line to fix this.
                </li>
              ))}
              {mentions.map((mention) => (
                <li key={`${mention.ruleId}-${mention.sentence}`}>
                  <strong>Not safe yet:</strong> {mention.label} is mentioned in
                  the {mention.where === 'title' ? 'title' : mention.where}:{' '}
                  <q>{mention.sentence}</q> {mention.message}{' '}
                  <button
                    type="button"
                    className={styles.lineButton}
                    aria-label={`Not used in this recipe: ${mention.sentence}`}
                    onClick={() =>
                      setCleared((current) => [
                        ...current,
                        { ruleId: mention.ruleId, sentence: mention.sentence },
                      ])
                    }
                  >
                    Not used in this recipe
                  </button>
                </li>
              ))}
              {screen.reminders.map((finding, index) => (
                <li key={`reminder-${index}`}>
                  <strong>Reminder:</strong> {finding.ingredientName}.{' '}
                  {finding.message}
                </li>
              ))}
              {screen.allergens.map((finding, index) => (
                <li key={`allergen-${index}`}>
                  <strong>Allergen:</strong> {finding.ingredientName}.{' '}
                  {finding.message}
                </li>
              ))}
            </ul>
            <p className={styles.help}>{FIXED_LIST_NOTE}</p>
          </section>

          <section aria-label="Ingredients">
            <h3 className={styles.subheading}>Ingredients</h3>
            {draft.ingredients.length === 0 && (
              <p className={styles.warning} role="status">
                No ingredients found. Mark the lines that are ingredients.
              </p>
            )}
            <ul className={styles.lines}>
              {draft.ingredients.map((line) => (
                <LineRow
                  key={line.id}
                  list="ingredients"
                  line={line}
                  onEdit={(t) => update((d) => editLine(d, 'ingredients', line.id, t))}
                  onRemove={() => update((d) => removeLine(d, 'ingredients', line.id))}
                  onMove={(to) => update((d) => moveLine(d, 'ingredients', line.id, to))}
                />
              ))}
            </ul>
          </section>

          {markMode ? (
            <section aria-label="Mark lines as ingredients" className={styles.markBox}>
              <h3 className={styles.subheading}>Mark lines as ingredients</h3>
              <ul className={styles.lines}>
                {[...draft.steps, ...draft.notes].map((line) => (
                  <li key={line.id} className={styles.line}>
                    <label className={styles.markLabel}>
                      <input
                        type="checkbox"
                        checked={marked.has(line.id)}
                        onChange={(event) =>
                          setMarked((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(line.id);
                            else next.delete(line.id);
                            return next;
                          })
                        }
                      />
                      <span>{line.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className={styles.row}>
                <Button
                  label="Add marked lines to ingredients"
                  onClick={() => {
                    update((d) => markAsIngredients(d, marked));
                    setMarked(new Set());
                    setMarkMode(false);
                  }}
                />
                <Button
                  label="Cancel"
                  variant="ghost"
                  onClick={() => {
                    setMarked(new Set());
                    setMarkMode(false);
                  }}
                />
              </div>
            </section>
          ) : (
            <>
              <section aria-label="Steps">
                <h3 className={styles.subheading}>Steps</h3>
                {draft.steps.length === 0 && <p className={styles.help}>No steps found.</p>}
                <ol className={styles.lines}>
                  {draft.steps.map((line) => (
                    <LineRow
                      key={line.id}
                      list="steps"
                      line={line}
                      onEdit={(t) => update((d) => editLine(d, 'steps', line.id, t))}
                      onRemove={() => update((d) => removeLine(d, 'steps', line.id))}
                      onMove={(to) => update((d) => moveLine(d, 'steps', line.id, to))}
                    />
                  ))}
                </ol>
              </section>

              {draft.notes.length > 0 && (
                <section aria-label="Notes">
                  <h3 className={styles.subheading}>Notes</h3>
                  <ul className={styles.lines}>
                    {draft.notes.map((line) => (
                      <LineRow
                        key={line.id}
                        list="notes"
                        line={line}
                        onEdit={(t) => update((d) => editLine(d, 'notes', line.id, t))}
                        onRemove={() => update((d) => removeLine(d, 'notes', line.id))}
                        onMove={(to) => update((d) => moveLine(d, 'notes', line.id, to))}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {draft.steps.length + draft.notes.length > 0 && (
                <div className={styles.row}>
                  <Button
                    label="Mark lines as ingredients"
                    onClick={() => setMarkMode(true)}
                  />
                </div>
              )}
            </>
          )}

          <div className={styles.row}>
            <Button label="Save recipe" variant="primary" onClick={save} />
            <Button label="Start over" variant="ghost" onClick={startOver} />
          </div>
          <p className={styles.help}>
            <Link to="/recipes/new">Type a recipe instead</Link>
          </p>
        </section>
      )}
    </div>
  );
}
