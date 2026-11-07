import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  RULES,
  SOURCES,
  type Source,
  type SourceId,
} from '../../domain/safety/rules';
import { BUILTIN_RECIPES } from '../../data/recipes';
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

  it("renders each rule's cited sources as links inside that rule's own list item", () => {
    renderSources();

    // The "Safety rules" list has exactly one <li> per rule, in RULES order.
    // Scoping to each rule's own <li> (not the whole page) means this test
    // fails if the per-rule sources were rendered as plain text, even though
    // the References list still carries links.
    const ruleHeading = screen.getByRole('heading', { name: /safety rules/i });
    const ruleList = ruleHeading.nextElementSibling;
    expect(ruleList?.tagName).toBe('UL');
    const ruleItems = [...(ruleList?.querySelectorAll(':scope > li') ?? [])];
    expect(ruleItems.length).toBe(RULES.length);

    // Sanity check: at least one rule cites a source whose urls[] carries more
    // than one URL, so the multi-URL path (e.g. AAP-milk) is exercised.
    const hasMultiUrlSource = RULES.some((rule) =>
      rule.sources.some((id) => sourceUrls(SOURCES[id]).length > 1),
    );
    expect(hasMultiUrlSource).toBe(true);

    RULES.forEach((rule, index) => {
      const item = ruleItems[index];
      // Confirm we are scoped to the correct rule's list item.
      expect(item.textContent).toContain(rule.label);

      // Every URL this rule cites, derived from rules.ts.
      const expectedUrls = rule.sources.flatMap((id) =>
        sourceUrls(SOURCES[id]),
      );
      expect(expectedUrls.length).toBeGreaterThan(0);

      const anchors = [...item.querySelectorAll('a')];
      const hrefs = anchors.map((a) => a.getAttribute('href'));

      for (const url of expectedUrls) {
        const matching = anchors.filter((a) => a.getAttribute('href') === url);
        // The link for this URL must live WITHIN this rule's <li>.
        expect(
          matching.length,
          `rule "${rule.label}" should link to ${url} within its own list item; found hrefs: ${hrefs.join(', ')}`,
        ).toBeGreaterThan(0);
        // External links must be safe.
        expect(matching[0]).toHaveAttribute('rel', 'noopener noreferrer');
      }
    });
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

  it('renders a de-duplicated "Recipe sources" section with real links', () => {
    renderSources();

    const heading = screen.getByRole('heading', { name: /recipe sources/i });
    const list = heading.nextElementSibling;
    expect(list?.tagName).toBe('UL');

    // Expected distinct recipe-source URLs, derived from the data so the test
    // cannot drift from BUILTIN_RECIPES.
    const expectedUrls = [
      ...new Set(
        BUILTIN_RECIPES.map((r) => r.source?.url).filter(
          (u): u is string => typeof u === 'string',
        ),
      ),
    ];
    expect(expectedUrls.length).toBeGreaterThan(0);

    const items = [...(list?.querySelectorAll(':scope > li') ?? [])];
    // One <li> per distinct recipe-source URL (de-duplicated).
    expect(items.length).toBe(expectedUrls.length);

    for (const url of expectedUrls) {
      const links = screen
        .getAllByRole('link')
        .filter((a) => a.getAttribute('href') === url);
      expect(links.length).toBeGreaterThan(0);
      expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
      expect(links[0]).toHaveAttribute('target', '_blank');
    }
  });
});
