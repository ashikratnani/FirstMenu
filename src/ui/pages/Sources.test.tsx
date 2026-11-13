import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  NEW_FOOD_SPACING_SOURCES,
  RULES,
  SOURCES,
  type Source,
  type SourceId,
} from '../../domain/safety/rules';
import { NUTRITION_RULES, UNCONFIRMED_TAGS } from '../../domain/nutrition';
import { BUILTIN_RECIPES } from '../../data/recipes';
import Sources from './Sources';

/** All URLs a source cites (urls[] when present, else the single url). */
function sourceUrls(source: Source): string[] {
  return source.urls && source.urls.length > 0 ? source.urls : [source.url];
}

/** Distinct source ids cited by safety rules, nutrition lists and new-food spacing. */
function distinctCitedSourceIds(): SourceId[] {
  const seen = new Set<SourceId>();
  for (const rule of RULES) {
    for (const id of rule.sources) seen.add(id);
  }
  for (const rule of NUTRITION_RULES) {
    for (const id of rule.sources) seen.add(id);
  }
  for (const id of NEW_FOOD_SPACING_SOURCES) seen.add(id);
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
    // The section groups its entries by publisher: one list per publisher
    // under an h3, all inside the section that holds the heading.
    const section = heading.closest('section') as HTMLElement;
    expect(section).not.toBeNull();

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

    const items = [...section.querySelectorAll('h3 + ul > li')];
    // One <li> per distinct recipe-source URL (de-duplicated).
    expect(items.length).toBe(expectedUrls.length);

    // Query the links once and group them by href (one pass, not one query per URL).
    const linksByHref = new Map<string, HTMLElement[]>();
    for (const a of screen.getAllByRole('link')) {
      const href = a.getAttribute('href');
      if (href === null) continue;
      linksByHref.set(href, [...(linksByHref.get(href) ?? []), a]);
    }

    for (const url of expectedUrls) {
      const links = linksByHref.get(url) ?? [];
      expect(links.length).toBeGreaterThan(0);
      expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
      expect(links[0]).toHaveAttribute('target', '_blank');
    }
  });

  it('lists every nutrition tag food list with its sources, and says tags are not amounts', () => {
    renderSources();
    const heading = screen.getByRole('heading', { name: 'Nutrition tags' });
    expect(
      screen.getByText(/not how much of a nutrient it provides/),
    ).toBeInTheDocument();
    const list = heading.nextElementSibling?.nextElementSibling;
    expect(list?.tagName).toBe('UL');
    const items = [...(list?.querySelectorAll(':scope > li') ?? [])];
    expect(items.length).toBe(NUTRITION_RULES.length + UNCONFIRMED_TAGS.length);
    NUTRITION_RULES.forEach((rule, index) => {
      const hrefs = [...items[index].querySelectorAll('a')].map((a) => a.getAttribute('href'));
      for (const id of rule.sources) {
        for (const url of sourceUrls(SOURCES[id])) expect(hrefs).toContain(url);
      }
    });
    expect(items[items.length - 1].textContent).toMatch(/Healthy fat.*seafood, nut, seed, oil/);
    expect(list?.textContent).not.toContain('No food list yet');
  });

  it('has a "New food spacing" entry that lists every spacing source with its URL', () => {
    renderSources();
    const heading = screen.getByRole('heading', { name: 'New food spacing' });
    const entry = heading.nextElementSibling as HTMLElement;
    expect(entry).not.toBeNull();
    expect(NEW_FOOD_SPACING_SOURCES.length).toBeGreaterThan(0);
    const anchors = [...entry.querySelectorAll('a')];
    for (const id of NEW_FOOD_SPACING_SOURCES) {
      for (const url of sourceUrls(SOURCES[id])) {
        const match = anchors.filter((a) => a.getAttribute('href') === url);
        expect(match.length, `spacing source ${id} should link to ${url}`).toBeGreaterThan(0);
        expect(match[0]).toHaveAttribute('rel', 'noopener noreferrer');
        expect(match[0]).toHaveTextContent(SOURCES[id].title);
      }
    }
  });
});

describe('Sources page credits (Requirement 21.15)', () => {
  it('ends with a Credits section naming the picture and font licenses', () => {
    render(
      <MemoryRouter>
        <Sources />
      </MemoryRouter>,
    );
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[headings.length - 1]).toHaveTextContent('Credits');
    expect(
      screen.getByText('Food pictures, the hourglass and the snowflake: Fluent Emoji by Microsoft, MIT License'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Headings: Fredoka. Body text: Figtree. Both under the SIL Open Font License 1.1.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fluent Emoji on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/microsoft/fluentui-emoji',
    );
    expect(screen.getByRole('link', { name: 'Fluent Emoji license text' })).toHaveAttribute(
      'href',
      '/FirstMenu/art/LICENSE-fluentui-emoji.txt',
    );
  });

  it('lists Credits in the jump list', () => {
    render(
      <MemoryRouter>
        <Sources />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    expect(nav).toHaveTextContent('Credits');
  });
});
