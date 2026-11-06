---
inclusion: always
---

# Safety rules

The safety screen is the part of FirstMenu where a bug can hurt someone. These
rules are not optional conventions; treat them as hard requirements. The full
rule list and sources live in `.kiro/specs/first-menu/design.md` and, once
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
- Matching is case-insensitive, matches whole words and multi-word phrases, and
  treats singular and plural as the same word. Terms are written in singular,
  lowercase form; a test checks this.
- Matching is whole-token, so a name the list does not contain is not
  recognized. Adding a term is a one-line change plus a test case.

## The rule list is fixed in source

- The rule list is fixed in the app's source code and is NOT editable by users
  (Req 4.6).
- A rule is one of three kinds: a block rule (ghost), a prep reminder, or an
  allergen rule (mystery door). Allergen and reminder rules never block.

## Changing a safety rule

Per `.kiro/steering/autonomy.md`:

- Making the screen stricter is allowed without asking: adding terms to a rule,
  adding test cases, adding a source.
- Loosening a rule is NOT allowed without the maintainer: removing it, lowering
  its age limit, adding an exception word, or turning a block into a reminder or
  allergen rule. Stop and ask first.
- Every rule change bumps `RULESET_VERSION`.
