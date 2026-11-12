// Add recipe (`/add`, active spec Requirements 6, 7.3 to 7.5, 11.2, 17.7,
// 17.10, 18), built on Astryx components. The parent pastes a recipe from
// ChatGPT (Recipe JSON, read by `parseRecipeReply`) or an Instagram caption
// (free text, also the fallback when a reply has no JSON), reads it, checks the
// preview and saves it without
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
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { foodLabel } from '../../domain/foods';
import { MAX_PASTE_CHARS, parseRecipeText } from '../../domain/importText';
import { recipeEffort, recipeMinutes } from '../../domain/effort';
import { recipeNutritionTags } from '../../domain/nutrition';
import { buildFixupPrompt, leaveOutFor } from '../../domain/prompt';
import { parseRecipeReply, type JsonIssue } from '../../domain/recipeJson';
import { screenRecipe, screenTextMentions } from '../../domain/safety/screen';
import { localYmd } from '../../domain/suggest';
import type { ClearedMention, ImportedInfo } from '../../domain/types';
import { useApp } from '../../state/AppProvider';
import { selectAgeMonths, selectStage } from '../../state/selectors';
import AskChatGpt from '../components/AskChatGpt';
import ReelPrompt from '../components/ReelPrompt';
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

export const PLAIN_TEXT_NOTICE =
  "This isn't in the expected format, so it was read as plain text. Check each line.";

export const PASTE_FALLBACK = 'Paste with your keyboard or long-press';

export const REEL_LINK_KEPT =
  'Your link was kept. The reel link was not added to the Link field.';

export const INSTAGRAM_HELP =
  "FirstMenu can't open Instagram reels. Use \"From an Instagram reel\" below to get a prompt for Meta AI, or copy the caption instead. On a phone, you can also copy text from a screenshot by pressing and holding on it.";

export const REEL_ERROR =
  "The AI app couldn't open this reel. Try pasting the caption instead.";

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
  /** Whether this line's actions are shown. Only one line at a time. */
  isOpen: boolean;
  onToggle: () => void;
  onEdit: (text: string) => void;
  onRemove: () => void;
  onMove: (to: LineList) => void;
}

/**
 * One preview line. The line is a single button; it reveals Edit, the move
 * buttons and Delete under it, so a long recipe is not a wall of buttons.
 */
function LineRow({ list, line, isOpen, onToggle, onEdit, onRemove, onMove }: LineRowProps) {
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
          <TextInput
            label={`Edit ${kind}`}
            isLabelHidden
            value={value}
            onChange={setValue}
            hasAutoFocus
          />
          <Button label="Done" type="submit" size="sm" />
          <Button
            label="Cancel"
            size="sm"
            onClick={() => {
              setValue(line.text);
              setEditing(false);
            }}
          />
        </form>
      </li>
    );
  }

  return (
    <li className={styles.line}>
      <button
        type="button"
        className={styles.lineButton}
        aria-expanded={isOpen}
        aria-label={`Change ${kind}: ${line.text}`}
        onClick={onToggle}
      >
        <span className={styles.lineText}>{line.text}</span>
        <span className={styles.lineHint} aria-hidden="true">
          {isOpen ? 'Close' : 'Change'}
        </span>
      </button>
      {isOpen && (
        <span className={styles.lineActions}>
          <Button
            label={`Edit ${kind}: ${line.text}`}
            size="sm"
            onClick={() => {
              setValue(line.text);
              setEditing(true);
              onToggle();
            }}
          >
            Edit
          </Button>
          {MOVE_TARGETS[list].map((to) => (
            <Button
              key={to}
              label={`Move ${kind} to ${to}: ${line.text}`}
              size="sm"
              onClick={() => onMove(to)}
            >
              To {to}
            </Button>
          ))}
          <Button label={`Delete ${kind}: ${line.text}`} size="sm" onClick={onRemove}>
            Delete
          </Button>
        </span>
      )}
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
  const [reelNote, setReelNote] = useState('');
  const lastReelUrl = useRef('');
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState<
    { kind: 'invalid'; errors: JsonIssue[] } | { kind: 'ai-error'; message: string } | null
  >(null);
  const [notices, setNotices] = useState({ extras: false, outside: false });
  const [readAsJson, setReadAsJson] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cleared, setCleared] = useState<ClearedMention[]>([]);
  const [markMode, setMarkMode] = useState(false);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [helper, setHelper] = useState<'chatgpt' | 'reel' | null>(null);
  const [openLine, setOpenLine] = useState<string | null>(null);
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
    setCopyMessage('');
    setCleared([]);
    setMarkMode(false);
    setMarked(new Set());
    setOpenLine(null);
    setProblem(null);
    setShowReply(false);
    setReadAsJson(false);
    setNotices({ extras: false, outside: false });
    const result = parseRecipeReply(source);
    if (result.kind === 'recipe') {
      setNotices({
        extras: result.extras.length > 0,
        outside: result.outsideNotable,
      });
      setReadAsJson(true);
      setDraft(draftFromParsed(result.parsed, result.extras));
    } else if (result.kind === 'no-json') {
      readAsPlainText(source, true);
    } else {
      setProblem(result);
    }
  }

  /** The free-text parser (Requirement 18.7): the fallback and "Read as plain text instead". */
  function readAsPlainText(source: string, withNotice: boolean) {
    const parsed = parseRecipeText(source);
    if (withNotice) parsed.warnings = [PLAIN_TEXT_NOTICE, ...parsed.warnings];
    setProblem(null);
    setReadAsJson(false);
    setDraft(draftFromParsed(parsed));
  }

  async function copyFixup() {
    try {
      await navigator.clipboard.writeText(buildFixupPrompt());
      setCopyMessage('Copied. Paste it into the chat and ask for the recipe again.');
    } catch {
      setCopyMessage(
        'Copying did not work here. Try again, or ask the chat to resend the recipe as JSON.',
      );
    }
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

  // The reel URL becomes the recipe's link and is never opened (Req 19.6).
  function focusPasteBoxForReel(reelUrl: string) {
    setSource('instagram');
    setMessage('');
    setReelNote('');
    if (reelUrl !== '') {
      if (url.trim() === '' || url === lastReelUrl.current) {
        setUrl(reelUrl);
        lastReelUrl.current = reelUrl;
      } else if (url !== reelUrl) {
        setReelNote(REEL_LINK_KEPT);
      }
    }
    pasteBox.current?.focus();
  }

  const buildContext = useMemo(
    () => ({
      id: recipeId,
      stage,
      from: source,
      url,
      originalText: text,
      today: localYmd(new Date()),
      cleared,
    }),
    [recipeId, stage, source, url, text, cleared],
  );
  // The screen sees every note, including hidden unit notes; Save leaves those out.
  const recipe = useMemo(
    () => (draft ? buildRecipe(draft, buildContext) : null),
    [draft, buildContext],
  );

  const screen = useMemo(
    () => (recipe ? screenRecipe(recipe, ageMonths) : null),
    [recipe, ageMonths],
  );
  const mentions = useMemo(
    () => (recipe ? screenTextMentions(recipe, ageMonths) : []),
    [recipe, ageMonths],
  );

  function toggleLine(key: string) {
    setOpenLine((current) => (current === key ? null : key));
  }

  function update(change: (current: Draft) => Draft) {
    setDraft((current) => (current ? change(current) : current));
  }

  function save() {
    if (!recipe || !draft) return;
    const toSave = buildRecipe(draft, { ...buildContext, omitHidden: true });
    dispatch({ type: 'saveCustomRecipe', recipe: toSave });
    navigate(`/recipes/${toSave.id}`);
  }

  function startOver() {
    setDraft(null);
    setProblem(null);
    setNotices({ extras: false, outside: false });
    setShowReply(false);
    setMarkMode(false);
    setOpenLine(null);
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
            <RadioList
              label="Where did it come from?"
              orientation="horizontal"
              value={source}
              onChange={(value) => setSource(value as typeof source)}
            >
              {SOURCES.map((s) => (
                <RadioListItem key={s.value} value={s.value} label={s.label} />
              ))}
            </RadioList>
            <TextInput
              label="Link (optional)"
              description="FirstMenu keeps this link with the recipe and never opens it."
              type="url"
              value={url}
              onChange={setUrl}
              autoComplete="off"
              placeholder="https://"
            />
            {reelNote && (
              <p className={styles.help} role="status">
                {reelNote}
              </p>
            )}
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
            {problem?.kind === 'ai-error' && (
              <p className={styles.warning} role="alert">
                {source === 'instagram' ? (
                  REEL_ERROR
                ) : (
                  <>
                    The chat could not give a recipe
                    {problem.message !== '' ? `: ${problem.message}` : '.'} Try again, or paste
                    the recipe text instead.
                  </>
                )}
              </p>
            )}
            {problem?.kind === 'invalid' && (
              <div className={styles.warning} role="alert">
                <p>This reply could not be read as a FirstMenu recipe. Nothing was saved.</p>
                <ul className={styles.findings}>
                  {problem.errors.map((error, index) => (
                    <li key={`${error.path}-${index}`}>{error.message}</li>
                  ))}
                </ul>
                <div className={styles.row}>
                  <Button label="Copy a fix-up request" onClick={() => void copyFixup()} />
                  <Button
                    label="Read as plain text instead"
                    onClick={() => readAsPlainText(text, false)}
                  />
                </div>
                {copyMessage && <p role="status">{copyMessage}</p>}
              </div>
            )}
            <p className={styles.help}>{INSTAGRAM_HELP}</p>
          </section>

          <section className={styles.helpers} aria-label="Prompt helpers">
            <AskChatGpt
              ageMonths={ageMonths}
              stage={stage}
              have={have}
              leaveOut={leaveOutFor(ageMonths, state.foods)}
              onPasteAnswer={focusPasteBox}
              isOpen={helper === 'chatgpt'}
              onOpenChange={(open) => setHelper(open ? 'chatgpt' : null)}
            />
            <ReelPrompt
              onPasteAnswer={focusPasteBoxForReel}
              isOpen={helper === 'reel'}
              onOpenChange={(open) => setHelper(open ? 'reel' : null)}
            />
          </section>

          <p className={styles.help}>
            <Link className={`fm-link ${styles.typeLink}`} to="/recipes/new">
              Type a recipe instead
            </Link>
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

          {readAsJson && (
            <p className={styles.help} role="status">
              Read as a FirstMenu recipe
            </p>
          )}
          {notices.extras && (
            <p className={styles.warning} role="status">
              Extra text was added to the notes. Check it below.
            </p>
          )}
          {notices.outside && (
            <div className={styles.warning} role="status">
              <p>Text outside the recipe was ignored.</p>
              <Button
                label={showReply ? 'Hide the reply' : 'Show the reply'}
                size="sm"
                onClick={() => setShowReply((value) => !value)}
              >
                {showReply ? 'Hide' : 'Show'}
              </Button>
              {showReply && <pre className={styles.reply}>{text}</pre>}
            </div>
          )}

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
                  <Button
                    label={`Not used in this recipe: ${mention.sentence}`}
                    size="sm"
                    onClick={() =>
                      setCleared((current) => [
                        ...current,
                        { ruleId: mention.ruleId, sentence: mention.sentence },
                      ])
                    }
                  >
                    Not used in this recipe
                  </Button>
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
                  isOpen={openLine === `ingredients-${line.id}`}
                  onToggle={() => toggleLine(`ingredients-${line.id}`)}
                  onEdit={(t) => update((d) => editLine(d, 'ingredients', line.id, t))}
                  onRemove={() => update((d) => removeLine(d, 'ingredients', line.id))}
                  onMove={(to) => {
                    setOpenLine(null);
                    update((d) => moveLine(d, 'ingredients', line.id, to));
                  }}
                />
              ))}
            </ul>
          </section>

          {markMode ? (
            <section aria-label="Mark lines as ingredients" className={styles.markBox}>
              <h3 className={styles.subheading}>Mark lines as ingredients</h3>
              <ul className={styles.lines}>
                {[...draft.steps, ...draft.notes.filter((l) => !l.hidden)].map((line) => (
                  <li key={line.id} className={styles.line}>
                    <CheckboxInput
                      label={line.text}
                      value={marked.has(line.id)}
                      onChange={(checked) =>
                        setMarked((current) => {
                          const next = new Set(current);
                          if (checked) next.add(line.id);
                          else next.delete(line.id);
                          return next;
                        })
                      }
                    />
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
                      isOpen={openLine === `steps-${line.id}`}
                      onToggle={() => toggleLine(`steps-${line.id}`)}
                      onEdit={(t) => update((d) => editLine(d, 'steps', line.id, t))}
                      onRemove={() => update((d) => removeLine(d, 'steps', line.id))}
                      onMove={(to) => {
                        setOpenLine(null);
                        update((d) => moveLine(d, 'steps', line.id, to));
                      }}
                    />
                  ))}
                </ol>
              </section>

              {draft.notes.some((l) => !l.hidden) && (
                <section aria-label="Notes">
                  <h3 className={styles.subheading}>Notes</h3>
                  <ul className={styles.lines}>
                    {draft.notes
                      .filter((l) => !l.hidden)
                      .map((line) => (
                        <LineRow
                          key={line.id}
                          list="notes"
                          line={line}
                          isOpen={openLine === `notes-${line.id}`}
                          onToggle={() => toggleLine(`notes-${line.id}`)}
                          onEdit={(t) => update((d) => editLine(d, 'notes', line.id, t))}
                          onRemove={() => update((d) => removeLine(d, 'notes', line.id))}
                          onMove={(to) => {
                            setOpenLine(null);
                            update((d) => moveLine(d, 'notes', line.id, to));
                          }}
                        />
                      ))}
                  </ul>
                </section>
              )}

              {draft.steps.length + draft.notes.filter((l) => !l.hidden).length > 0 && (
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
            <Link className={`fm-link ${styles.typeLink}`} to="/recipes/new">
              Type a recipe instead
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
