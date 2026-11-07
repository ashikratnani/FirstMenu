// Sources page (Task 6.2, Req 4.7 and 13.3). Generated entirely from
// src/domain/safety/rules.ts: it lists every safety rule with its label,
// message and the source(s) it cites, then a de-duplicated list of every
// distinct source cited across all rules, each linked to its published URL(s).
//
// Nothing here is hardcoded: the rule list and the source list are derived
// from RULES/SOURCES so adding or changing a rule updates this page.

import { RULES, SOURCES, type Source, type SourceId } from '../../domain/safety/rules';
import styles from './Sources.module.css';

/** All URLs a source cites (urls[] when present, else the single url). */
function sourceUrls(source: Source): string[] {
  return source.urls && source.urls.length > 0 ? source.urls : [source.url];
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
  return ordered;
}

export default function Sources() {
  const distinctSourceIds = citedSourceIds();

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
    </>
  );
}
