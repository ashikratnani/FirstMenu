// Sources page (Task 6.2, Req 4.7 and 13.3). Generated entirely from
// src/domain/safety/rules.ts: it lists every safety rule with its label,
// message and the source(s) it cites, then a de-duplicated list of every
// distinct source cited across all rules, each linked to its published URL(s).
//
// Nothing here is hardcoded: the rule list and the source list are derived
// from RULES/SOURCES so adding or changing a rule updates this page.

import {
  NEW_FOOD_SPACING_DAYS,
  NEW_FOOD_SPACING_SOURCES,
  RULES,
  SOURCES,
  type Source,
  type SourceId,
} from '../../domain/safety/rules';
import { NUTRITION_RULES, UNCONFIRMED_TAGS, nutritionTerms } from '../../domain/nutrition';
import { TAG_EXPLAINER, tagLabel } from './makeView';
import { BUILTIN_RECIPES } from '../../data/recipes';
import type { RecipeSource } from '../../domain/types';
import styles from './Sources.module.css';

/** All URLs a source cites (urls[] when present, else the single url). */
function sourceUrls(source: Source): string[] {
  return source.urls && source.urls.length > 0 ? source.urls : [source.url];
}

/**
 * Every built-in recipe's published source, de-duplicated by url in first-seen
 * order. Derived from BUILTIN_RECIPES so adding a built-in recipe updates this
 * list without touching the page (Req 6.2).
 */
function recipeSources(): RecipeSource[] {
  const seen = new Set<string>();
  const ordered: RecipeSource[] = [];
  for (const recipe of BUILTIN_RECIPES) {
    const source = recipe.source;
    if (!source || seen.has(source.url)) continue;
    seen.add(source.url);
    ordered.push(source);
  }
  return ordered;
}

/** The distinct source ids cited across every rule, in first-seen order. */
function citedSourceIds(): SourceId[] {
  const seen = new Set<SourceId>();
  const ordered: SourceId[] = [];
  for (const rule of RULES) {
    for (const id of rule.sources) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
  }
  // Sources cited by the nutrition tag lists and the new-food spacing.
  for (const id of [...NUTRITION_RULES.flatMap((r) => r.sources), ...NEW_FOOD_SPACING_SOURCES]) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
}

/** Links for a list of source ids, one per URL the source cites. */
function SourceLinks({ ids }: { ids: SourceId[] }) {
  return (
    <>
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 ? ', ' : ''}
          {sourceUrls(SOURCES[id]).map((url, j) => (
            <span key={url}>
              {j > 0 ? ' ' : ''}
              <a href={url} target="_blank" rel="noopener noreferrer">
                {SOURCES[id].title}
              </a>
            </span>
          ))}
        </span>
      ))}
    </>
  );
}

export default function Sources() {
  const distinctSourceIds = citedSourceIds();
  const recipeSourceList = recipeSources();

  return (
    <>
      <h1>Sources</h1>
      <p>
        Every safety check comes from a published guideline. Each rule below
        lists its reason and the source it cites.
      </p>

      <h2>Safety rules</h2>
      <ul className={styles.ruleList}>
        {RULES.map((rule) => (
          <li key={rule.id} className={styles.rule}>
            <h3 className={styles.ruleLabel}>{rule.label}</h3>
            <p className={styles.ruleMessage}>{rule.message}</p>
            <p className={styles.ruleSources}>
              Source{rule.sources.length > 1 ? 's' : ''}:{' '}
              {rule.sources.map((id, i) => {
                const source = SOURCES[id];
                const urls = sourceUrls(source);
                return (
                  <span key={id}>
                    {i > 0 ? ', ' : ''}
                    {urls.map((url, j) => (
                      <span key={url}>
                        {j > 0 ? ' ' : ''}
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          {source.title}
                        </a>
                      </span>
                    ))}
                  </span>
                );
              })}
            </p>
          </li>
        ))}
      </ul>

      <h2>Nutrition tags</h2>
      <p>{TAG_EXPLAINER}</p>
      <ul className={styles.ruleList}>
        {NUTRITION_RULES.map((rule) => {
          const { terms, except } = nutritionTerms(rule.tag);
          return (
            <li key={rule.tag} className={styles.rule}>
              <h3 className={styles.ruleLabel}>{tagLabel(rule.tag)}</h3>
              <p className={styles.ruleMessage}>Foods on this list: {terms.join(', ')}.</p>
              {except.length > 0 && (
                <p className={styles.ruleMessage}>Not counted: {except.join(', ')}.</p>
              )}
              <p className={styles.ruleSources}>
                Source{rule.sources.length > 1 ? 's' : ''}: <SourceLinks ids={rule.sources} />
              </p>
            </li>
          );
        })}
        {UNCONFIRMED_TAGS.map((tag) => (
          <li key={tag} className={styles.rule}>
            <h3 className={styles.ruleLabel}>{tagLabel(tag)}</h3>
            <p className={styles.ruleMessage}>
              No food list yet. We have not found a published source for one, so no recipe
              gets this tag.
            </p>
          </li>
        ))}
      </ul>

      <h2>New food spacing</h2>
      <section aria-label="New food spacing sources" className={styles.rule}>
        <p className={styles.ruleMessage}>
          FirstMenu uses a gap of at least {NEW_FOOD_SPACING_DAYS} days between new foods when
          it checks the week plan and suggests a new food.
        </p>
        <p className={styles.ruleSources}>
          Source{NEW_FOOD_SPACING_SOURCES.length > 1 ? 's' : ''}:{' '}
          <SourceLinks ids={NEW_FOOD_SPACING_SOURCES} />
        </p>
      </section>

      <h2>References</h2>
      <ul className={styles.referenceList}>
        {distinctSourceIds.map((id) => {
          const source = SOURCES[id];
          const urls = sourceUrls(source);
          return (
            <li key={id} className={styles.reference}>
              {urls.map((url, i) => (
                <span key={url}>
                  {i > 0 ? ' ' : ''}
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {source.title}
                  </a>
                </span>
              ))}
              {source.retrieved ? (
                <span className={styles.retrieved}> (retrieved {source.retrieved})</span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <h2>Recipe sources</h2>
      <ul className={styles.referenceList}>
        {recipeSourceList.map((source) => (
          <li key={source.url} className={styles.reference}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>
            <span className={styles.retrieved}>
              {' '}
              — {source.publisher} (retrieved {source.retrieved})
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
