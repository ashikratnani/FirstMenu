// Sources page (Task 6.2, Req 4.7 and 13.3). Generated entirely from
// src/domain/safety/rules.ts: it lists every safety rule with its label,
// message and the source(s) it cites, then a de-duplicated list of every
// distinct source cited across all rules, each linked to its published URL(s).
//
// Nothing here is hardcoded: the rule list and the source list are derived
// from RULES/SOURCES so adding or changing a rule updates this page.

import type { MouseEvent, ReactNode } from 'react';
import { Link } from '@astryxdesign/core/Link';
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

/**
 * Grouped publisher view of the built-in recipe sources: publishers in
 * first-seen order, each with its de-duplicated sources (derived from
 * recipeSources(), so counts always match the data).
 */
function recipeSourceGroups(): { publisher: string; sources: RecipeSource[] }[] {
  const groups = new Map<string, RecipeSource[]>();
  for (const source of recipeSources()) {
    groups.set(source.publisher, [...(groups.get(source.publisher) ?? []), source]);
  }
  return [...groups].map(([publisher, sources]) => ({ publisher, sources }));
}

/**
 * Jump to a section on this page. The app uses hash routing, so a plain
 * `#id` link would change the route; scroll and move focus to the target
 * heading instead.
 */
function jumpTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
  event.preventDefault();
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView?.({ block: 'start' });
  target.focus({ preventScroll: true });
}

/** A same-page link (jump list, publisher list, back to top). */
function JumpLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a className={`fm-link ${styles.jumpLink}`} href="#/sources" onClick={(e) => jumpTo(e, to)}>
      {children}
    </a>
  );
}

/** One link per URL a source cites, each on its own line. */
function UrlLinks({ source }: { source: Source }) {
  return (
    <>
      {sourceUrls(source).map((url) => (
        <EntryLink key={url} href={url}>
          {source.title}
        </EntryLink>
      ))}
    </>
  );
}

/** An external source link: a full-width 44 px row, not an inline link. */
function EntryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      className={`fm-link ${styles.entryLink}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </Link>
  );
}

/** "Source:" or "Sources:" and a list of links for a list of source ids. */
function SourceLinks({ ids }: { ids: SourceId[] }) {
  return (
    <div>
      <p className={styles.sourcesLabel}>Source{ids.length > 1 ? 's' : ''}:</p>
      <ul className={styles.sourceLinks}>
        {ids.flatMap((id) =>
          sourceUrls(SOURCES[id]).map((url) => (
            <li key={`${id}-${url}`}>
              <EntryLink href={url}>{SOURCES[id].title}</EntryLink>
            </li>
          )),
        )}
      </ul>
    </div>
  );
}

export default function Sources() {
  const distinctSourceIds = citedSourceIds();
  const recipeGroups = recipeSourceGroups();
  const recipeCount = recipeGroups.reduce((n, g) => n + g.sources.length, 0);
  const nutritionCount = NUTRITION_RULES.length + UNCONFIRMED_TAGS.length;

  const sections = [
    { id: 'sources-safety', label: `Safety rules (${RULES.length})` },
    { id: 'sources-nutrition', label: `Nutrition tags (${nutritionCount})` },
    { id: 'sources-spacing', label: 'New food spacing' },
    { id: 'sources-references', label: `References (${distinctSourceIds.length})` },
    { id: 'sources-recipes', label: `Recipe sources (${recipeCount})` },
  ];

  const backToTop = (
    <p className={styles.backToTop}>
      <JumpLink to="sources-top">Back to top</JumpLink>
    </p>
  );

  return (
    <>
      <h1 id="sources-top" tabIndex={-1} className={styles.pageTitle}>
        Sources
      </h1>
      <p>
        Every safety check comes from a published guideline. Each rule below
        lists its reason and the source it cites.
      </p>

      <nav aria-label="On this page" className={styles.jump}>
        <p className={styles.jumpTitle}>On this page</p>
        <ul className={styles.jumpList}>
          {sections.map((section) => (
            <li key={section.id}>
              <JumpLink to={section.id}>{section.label}</JumpLink>
            </li>
          ))}
        </ul>
      </nav>

      <section className={styles.band}>
        <h2 id="sources-safety" tabIndex={-1} className={styles.sectionTitle}>
          Safety rules
        </h2>
        <ul className={styles.ruleList}>
          {RULES.map((rule) => (
            <li key={rule.id} className={styles.rule}>
              <h3 className={styles.ruleLabel}>{rule.label}</h3>
              <p className={styles.ruleMessage}>{rule.message}</p>
              <SourceLinks ids={rule.sources} />
            </li>
          ))}
        </ul>
        {backToTop}
      </section>

      <section className={styles.band}>
        <h2 id="sources-nutrition" tabIndex={-1} className={styles.sectionTitle}>
          Nutrition tags
        </h2>
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
                <SourceLinks ids={rule.sources} />
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
        {backToTop}
      </section>

      <section className={styles.band}>
        <h2 id="sources-spacing" tabIndex={-1} className={styles.sectionTitle}>
          New food spacing
        </h2>
        <ul aria-label="New food spacing sources" className={styles.ruleList}>
          <li className={styles.rule}>
            <p className={styles.ruleMessage}>
              FirstMenu uses a gap of at least {NEW_FOOD_SPACING_DAYS} days between new foods when
              it checks the week plan and suggests a new food.
            </p>
            <SourceLinks ids={NEW_FOOD_SPACING_SOURCES} />
          </li>
        </ul>
        {backToTop}
      </section>

      <section className={styles.band}>
        <h2 id="sources-references" tabIndex={-1} className={styles.sectionTitle}>
          References
        </h2>
        <ul className={styles.referenceList}>
          {distinctSourceIds.map((id) => {
            const source = SOURCES[id];
            return (
              <li key={id} className={styles.reference}>
                <UrlLinks source={source} />
                {source.retrieved ? (
                  <span className={styles.retrieved}>(retrieved {source.retrieved})</span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {backToTop}
      </section>

      <section className={styles.band}>
        <h2 id="sources-recipes" tabIndex={-1} className={styles.sectionTitle}>
          Recipe sources
        </h2>
        <p>
          Built-in recipes come from {recipeGroups.length} publishers. Jump to one:
        </p>
        <ul className={styles.publisherList}>
          {recipeGroups.map((group, i) => (
            <li key={group.publisher}>
              <JumpLink to={`sources-publisher-${i}`}>
                {group.publisher} ({group.sources.length})
              </JumpLink>
            </li>
          ))}
        </ul>
        {recipeGroups.map((group, i) => (
          <section key={group.publisher} className={styles.publisher}>
            <h3 id={`sources-publisher-${i}`} tabIndex={-1} className={styles.publisherTitle}>
              {group.publisher}
            </h3>
            <ul className={styles.referenceList}>
              {group.sources.map((source) => (
                <li key={source.url} className={styles.reference}>
                  <EntryLink href={source.url}>{source.title}</EntryLink>
                  <span className={styles.retrieved}>(retrieved {source.retrieved})</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {backToTop}
      </section>
    </>
  );
}
