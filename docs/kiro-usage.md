# How FirstMenu was built with Kiro

FirstMenu was built almost end to end with [Kiro](https://kiro.dev) working from a spec, a set of steering rules, and an automated review loop. This document explains how those pieces fit together and points at the real code and tests they produced.

## The spec drove the build

Everything started from a spec under [`.kiro/specs/first-menu/`](../.kiro/specs/first-menu/):

- [`requirements.md`](../.kiro/specs/first-menu/requirements.md) — numbered requirements (the safety screen, recipes, foods, plan, prep, grocery, share, print, storage, accessibility). Tasks cite these ids.
- [`design.md`](../.kiro/specs/first-menu/design.md) — the architecture (pure-TypeScript domain, a thin React UI, a single `useReducer` context), the data models, and the full safety rule list with its sources table.
- [`tasks.md`](../.kiro/specs/first-menu/tasks.md) — an ordered implementation plan grouped into milestones, with each task tagged by the requirement ids it satisfies.

Kiro worked through `tasks.md` top to bottom, one top-level task at a time, and each task's checkbox was ticked in the same change that implemented it. The task list maps almost one-to-one onto what shipped:

| Task | What shipped | PR |
| --- | --- | --- |
| 1 | Vite + React + TS scaffold, CI and deploy workflows, steering files | [#3](https://github.com/ashikratnani/FirstMenu/pull/3) |
| 2 | Domain types and age/stage math (`domain/age.ts`) | [#4](https://github.com/ashikratnani/FirstMenu/pull/4) |
| 3 | The safety screen (`domain/safety/*`) | [#5](https://github.com/ashikratnani/FirstMenu/pull/5) |
| 4 | Built-in recipes (`data/recipes.ts`) | [#8](https://github.com/ashikratnani/FirstMenu/pull/8) |
| 5 | State and storage (`domain/storage.ts`, `AppProvider`) | [#11](https://github.com/ashikratnani/FirstMenu/pull/11) |
| 6 | App shell, routing, theme tokens, Sources page | [#13](https://github.com/ashikratnani/FirstMenu/pull/13) |
| 7 | Onboarding and child profile | [#15](https://github.com/ashikratnani/FirstMenu/pull/15) |
| 8 | Foods and first tastes | [#17](https://github.com/ashikratnani/FirstMenu/pull/17) |
| 9 | Recipe library, recipe page and custom editor | [#19](https://github.com/ashikratnani/FirstMenu/pull/19) |
| 10 | Week plan (`domain/plan.ts`, week view) | [#21](https://github.com/ashikratnani/FirstMenu/pull/21) |
| 11 | Prep list (`domain/prep.ts`) | [#24](https://github.com/ashikratnani/FirstMenu/pull/24) |
| 12 | Grocery list (`domain/grocery.ts`) | [#25](https://github.com/ashikratnani/FirstMenu/pull/25) |
| 13 | Share link (`domain/share.ts`, read-only view) | [#27](https://github.com/ashikratnani/FirstMenu/pull/27) |
| 14 | Print view | [#28](https://github.com/ashikratnani/FirstMenu/pull/28) |
| 15 | Theme art (inline SVG set) | [#29](https://github.com/ashikratnani/FirstMenu/pull/29) |
| 16 | Accessibility pass (`ui/a11y.test.tsx`) | [#30](https://github.com/ashikratnani/FirstMenu/pull/30) |
| 17.0 | Release gate: required-source test switched on | [#31](https://github.com/ashikratnani/FirstMenu/pull/31) |

A few small follow-up fixes rode in on their own `fix/` PRs, for example the wheat-term fix in [#22](https://github.com/ashikratnani/FirstMenu/pull/22) and the notice-wording fix in [#16](https://github.com/ashikratnani/FirstMenu/issues/16).

## The steering files

Steering files in [`.kiro/steering/`](../.kiro/steering/) set standing rules that applied to every task, so the same conventions were enforced without repeating them in each prompt.

- **[`autonomy.md`](../.kiro/steering/autonomy.md)** — drew the line between calls Kiro could make on its own (implementation choices within the stack, UI wording, stricter safety rules, test design) and the ones that had to stop and ask the maintainer (loosening a safety rule, writing new health wording, using lower-tier recipe sources, changing scope or repo settings). It also named the actions only the maintainer can do (turning on Pages, recording the demo video).
- **[`workflow.md`](../.kiro/steering/workflow.md)** — one branch and one PR per top-level task, named `task/<number>-<short-name>`; the PR body lists task ids, requirement ids and what was tested; tick the task boxes in the same PR; never push to `main`; and always invoke `pr-reviewer` after opening or updating a PR.
- **[`product.md`](../.kiro/steering/product.md)** — what FirstMenu is and the hard constraints: no backend, no account, no third-party network requests, one child per device, and the "not medical advice" disclaimer in three places.
- **[`tech.md`](../.kiro/steering/tech.md)** — the stack (React 18 + TS + Vite, `HashRouter`, `base: '/FirstMenu/'`, `zod`, `lz-string`), the architecture rule that the domain stays pure TypeScript with no React dependency, and the "lint + test + build must pass before a PR is ready" gate.
- **[`safety-rules.md`](../.kiro/steering/safety-rules.md)** — the strictest file: every safety rule needs a published source **and** a test case; rules match ingredient names only (lowercase, singular, whole-token); the rule list is fixed in source; making the screen stricter is allowed but loosening it must stop and ask; and every rule change bumps `RULESET_VERSION`.

## The `pr-reviewer` agent and the review loop

Kiro never merged its own work. For each top-level task it opened one PR and then invoked the `pr-reviewer` sub-agent by name with the PR number. `pr-reviewer` posted a comment with one of three verdicts:

- **`PASS`** — the reviewer merges the PR (squash) once CI is green. Nothing else to do.
- **`NEEDS_CHANGES`** — Kiro fixes every listed problem on the same branch, pushes, and invokes `pr-reviewer` again. After two rounds without a pass, it stops and asks the maintainer instead of trying a third time.
- **`NEEDS_MAINTAINER`** — Kiro stops work on that PR and escalates to the maintainer via a `Decision needed:` issue.

Examples of the loop on real merged PRs:

- Safety screen — [PR #5](https://github.com/ashikratnani/FirstMenu/pull/5)
- State and storage — [PR #11](https://github.com/ashikratnani/FirstMenu/pull/11)
- App shell and Sources page — [PR #13](https://github.com/ashikratnani/FirstMenu/pull/13)
- Recipe library and editor — [PR #19](https://github.com/ashikratnani/FirstMenu/pull/19)
- Grocery list — [PR #25](https://github.com/ashikratnani/FirstMenu/pull/25)
- Share link — [PR #27](https://github.com/ashikratnani/FirstMenu/pull/27)

Decisions the reviewer or the autonomy rules escalated as `NEEDS_MAINTAINER` were tracked as GitHub issues and resolved by the maintainer before work continued, for example:

- **Built-in recipe sourcing** ([#7](https://github.com/ashikratnani/FirstMenu/issues/7)) — only two Minnesota WIC pages were reachable, so the maintainer chose "Option 4": ship a reduced first batch of 10 recipes (covering dairy, egg and wheat) and defer the full Requirement 2 counts and allergen coverage.
- **Grocery line key** ([#26](https://github.com/ashikratnani/FirstMenu/issues/26)) — how to merge grocery lines by food and unit.
- **Spaghetti squash** ([#23](https://github.com/ashikratnani/FirstMenu/issues/23)) — a recipe-ingredient naming question.

Other maintainer decisions recorded as issues include servings estimation ([#9](https://github.com/ashikratnani/FirstMenu/issues/9)) and the under-6 / 12-plus notice wording ([#16](https://github.com/ashikratnani/FirstMenu/issues/16)).

## Examples of Kiro-generated code and tests

The pure-TypeScript domain was the easiest place to lean on Kiro, because it can be tested exhaustively without rendering.

**Safety screen.** The screen is three small modules, each with its own test file:

- [`src/domain/safety/normalize.ts`](../src/domain/safety/normalize.ts) — case-insensitive, plural-aware, whole-token phrase matching, tested in [`normalize.test.ts`](../src/domain/safety/normalize.test.ts).
- [`src/domain/safety/rules.ts`](../src/domain/safety/rules.ts) — the fixed block/reminder/allergen rule list plus the `SOURCES` table and `RULESET_VERSION`, tested in [`rules.test.ts`](../src/domain/safety/rules.test.ts) (every rule fires on at least one term, cites a source that exists, and every term is lowercase and singular).
- [`src/domain/safety/screen.ts`](../src/domain/safety/screen.ts) — `screenIngredient` / `screenRecipe` with age limits, exceptions and reminder de-duplication, tested in [`screen.test.ts`](../src/domain/safety/screen.test.ts), including the age-limit boundaries at `limit - 1` and `limit` months.

**Rest of the domain.** Each of these is a pure module with a matching `*.test.ts`:

- [`domain/age.ts`](../src/domain/age.ts) — `ageInMonths`, `stageFor`, `defaultSlots`, with tests for month boundaries, end-of-month birthdays and leap years.
- [`domain/foods.ts`](../src/domain/foods.ts) — first-taste tracking (`foodKeyFor`, `collectFoods`, `foodStatus`).
- [`domain/plan.ts`](../src/domain/plan.ts) — week start, new-week keep/empty, new-food spacing warnings.
- [`domain/prep.ts`](../src/domain/prep.ts) — cook sessions, batches, fridge/freezer/fresh rules and thaw reminders.
- [`domain/grocery.ts`](../src/domain/grocery.ts) — merge by food and unit, category grouping and check reconciliation.
- [`domain/share.ts`](../src/domain/share.ts) — encode/decode of the read-only share payload, with round-trip, tampered-link and "no name or birth date" tests.
- [`domain/storage.ts`](../src/domain/storage.ts) — schema version, `migrate`, zod validation, corrupt-data backup and debounced save.

**UI and accessibility.** The React layer is thin, but it is still covered: page tests under [`src/ui/pages/`](../src/ui/pages/) and component tests under [`src/ui/components/`](../src/ui/components/), plus an axe-based accessibility sweep in [`src/ui/a11y.test.tsx`](../src/ui/a11y.test.tsx) that runs on every routed page and asserts each page's unique `<h1>` so the check can't pass on the wrong markup.

The whole suite (lint, the full Vitest run, and the production build) runs in CI on every pull request, which is where the safety tests gate each merge.
