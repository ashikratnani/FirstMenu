---
inclusion: always
---

# Safety rules

The safety screen is the part of FirstMenu where a bug can hurt someone. These
rules are not optional conventions; treat them as hard requirements. The full
rule list and sources live in `.kiro/specs/first-menu/design.md` (plus the
pasted-recipe additions in `.kiro/specs/what-can-i-make/design.md`) and, once
built, in `src/domain/safety/rules.ts`.

## Every rule needs a published source AND a test case

- Every safety rule MUST cite at least one published source from a recognized
  authority: AAP, WHO, CDC, FDA/EPA or NIAID (Req 4.7). The source is shown in
  the app on the Sources page.
- Every safety rule MUST have at least one test case: a test that the rule fires
  on at least one of its terms, and (if it has an age limit) that it respects
  that limit at `limit - 1` months and at `limit` months.
- A test asserts that every rule has at least one source and that every source
  id it cites exists in the sources table.
- A release-gate test fails when any rule cites a source without a URL. It is
  skipped during development and switched on at task 17.0, so the app cannot be
  submitted while a rule still lacks a published source.
- Rules marked "confirm source" in the design stay active until their source is
  confirmed. Blocking or reminding too much is the safer failure.

## Rules match ingredient names only

- The safety screen reads ingredient names ONLY. It never reads recipe titles,
  steps or notes (Req 4.1).
- One exception (active spec Requirement 7): for **pasted** recipes
  (`recipe.imported` set), block rules only are also checked against the
  title, steps and notes. A text mention ghosts the recipe until the user taps
  "Not used in this recipe" for that exact sentence. There is no negation
  handling; never add any without the maintainer.
- Nutrition tags reuse the matcher but are not safety rules. Each tag term
  list still needs a cited source (CDC, USDA, AAP or WHO) and tests.
- Matching is case-insensitive, matches whole words and multi-word phrases, and
  treats singular and plural as the same word. Terms are written in singular,
  lowercase form; a test checks this.
- Matching is whole-token, so a name the list does not contain is not
  recognized. Adding a term is a one-line change plus a test case.

## The rule list is fixed in source

- The rule list is fixed in the app's source code and is NOT editable by users
  (Req 4.6).
- A rule is one of three kinds: a block rule (Not yet, "ghosted"), a prep
  reminder, or an allergen rule (new food). Allergen and reminder rules never
  block.

## Changing a safety rule

Per `.kiro/steering/autonomy.md`:

- Making the screen stricter is allowed without asking: adding terms to a rule,
  adding test cases, adding a source.
- Loosening a rule (removing it, lowering its age limit, adding an exception
  word, or turning a block into a reminder or allergen rule) needs a cited
  published source with a URL that directly supports the change. pr-reviewer
  checks the source and decides ("Decisions you make" in pr-reviewer.md) and
  logs it on the `Reviewer decisions log` issue (#42). The source must be from
  AAP, WHO, CDC, FDA/EPA or NIAID. Without such a source it goes to the
  maintainer.
- Removing the honey, high-mercury fish, unpasteurized or no-safe-form choking
  rules, or making a block apply to fewer ages than its source states, always
  goes to the maintainer.
- Never skip, delete or loosen the safety tests or the release-gate test (a
  source-backed loosening may change only the assertion for the case it fixes), and
  never remove a rule's source without a replacement that has a URL. These
  always go to the maintainer.
- Every rule change bumps `RULESET_VERSION`.

## Art

Pictures never change the safety screen; they only add limits (active spec
Requirement 21, design "Food art"):

- A plate never shows a food that `choking-no-safe-form` or the prep reminders
  for round or tube-shaped foods (`grapes`, `cherry-tomato`, `cherries`,
  `small-round-fruit`, `sausages`, `whole-nuts`) match, at any age. A Foods
  tile may show such a food's picture only with the rule's message, unchanged,
  as the first line under it.
- The cards and recipe page of a Not yet recipe, and the Foods tile of a Not
  yet food, show the hourglass. Every picture of a Not yet food is greyed, so
  a plate never shows a Not yet food in full color.
- No photos, no pictures made by an image-generation model, and no pictures
  from other hosts.
- Renaming or removing one of these rule ids needs the same change in
  `PLATE_HIDDEN_RULE_IDS` (`src/domain/plate.ts`, from task 19.3); a test
  fails otherwise.
