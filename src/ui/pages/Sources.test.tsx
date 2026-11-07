import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  RULES,
  SOURCES,
  type Source,
  type SourceId,
} from '../../domain/safety/rules';
import Sources from './Sources';

/** All URLs a source cites (urls[] when present, else the single url). */
function sourceUrls(source: Source): string[] {
  return source.urls && source.urls.length > 0 ? source.urls : [source.url];
}

/** Distinct source ids cited across every rule, derived from rules.ts. */
function distinctCitedSourceIds(): SourceId[] {
  const seen = new Set<SourceId>();
  for (const rule of RULES) {
    for (const id of rule.sources) seen.add(id);
  }
  return [...seen];
}

function renderSources() {
  return render(
    <MemoryRouter>
      <Sources />
    </MemoryRouter>,
  );
}

describe('Sources page', () => {
  it('lists every safety rule with its message', () => {
    renderSources();
    for (const rule of RULES) {
      expect(screen.getAllByText(rule.message).length).toBeGreaterThan(0);
    }
  });

  it('renders a link for every URL of every distinct cited source', () => {
    renderSources();
    const ids = distinctCitedSourceIds();
    // Derive the expected URLs from rules.ts so this test cannot silently drift.
    for (const id of ids) {
      const source = SOURCES[id];
      for (const url of sourceUrls(source)) {
        const links = screen
          .getAllByRole('link')
          .filter((a) => a.getAttribute('href') === url);
        expect(links.length).toBeGreaterThan(0);
        // External links must be safe.
        expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
      }
    }
  });

  it('does not render sources that no rule cites', () => {
    renderSources();
    const cited = new Set(distinctCitedSourceIds());
    const uncited = (Object.keys(SOURCES) as SourceId[]).filter(
      (id) => !cited.has(id),
    );
    for (const id of uncited) {
      for (const url of sourceUrls(SOURCES[id])) {
        const links = screen
          .queryAllByRole('link')
          .filter((a) => a.getAttribute('href') === url);
        expect(links.length).toBe(0);
      }
    }
  });

  it('de-duplicates sources cited by more than one rule in the references list', () => {
    renderSources();
    // The References list has exactly one <li> per DISTINCT cited source, so a
    // source cited by several rules still appears once. The expected count is
    // derived from rules.ts so the test cannot drift from the data.
    const ids = distinctCitedSourceIds();
    expect(ids.length).toBeGreaterThan(0);

    const referencesHeading = screen.getByRole('heading', {
      name: /references/i,
    });
    // The list immediately following the References heading holds the entries.
    const referenceList = referencesHeading.nextElementSibling;
    expect(referenceList?.tagName).toBe('UL');
    const items = referenceList?.querySelectorAll('li') ?? [];
    expect(items.length).toBe(ids.length);

    // Sanity check: at least one source is cited by more than one rule, so the
    // de-duplication is actually exercised (otherwise the assertion is trivial).
    const citations: SourceId[] = RULES.flatMap((rule) => rule.sources);
    const hasSharedSource = citations.length > ids.length;
    expect(hasSharedSource).toBe(true);

    // Every distinct cited source id is represented exactly once in the list.
    for (const id of ids) {
      const title = SOURCES[id].title;
      const matching = [...items].filter((li) =>
        li.textContent?.includes(title),
      );
      expect(matching.length).toBe(1);
    }
  });
});
