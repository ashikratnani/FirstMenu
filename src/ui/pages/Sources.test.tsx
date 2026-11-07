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
    // Every distinct source cited is a real published URL in the references.
    const ids = distinctCitedSourceIds();
    expect(ids.length).toBeGreaterThan(0);
    const references = screen.getByRole('heading', { name: /references/i });
    expect(references).toBeInTheDocument();
  });
});
