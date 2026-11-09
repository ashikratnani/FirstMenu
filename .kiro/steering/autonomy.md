---
inclusion: always
---

# Working autonomously on FirstMenu

The maintainer wants this project built with as little input from them as possible. There are two specs:

- `.kiro/specs/first-menu/`: v1, built and live. It is the baseline for anything the active spec doesn't change.
- `.kiro/specs/what-can-i-make/`: the active spec. Where it conflicts with v1, it wins.

Work through `.kiro/specs/what-can-i-make/tasks.md` in order (except task 14, which runs in batches alongside the others as that file explains), following `workflow.md` for branches, review and merging. Don't start it unless its tasks file says "Status: APPROVED". Remaining unticked v1 tasks are carried into the active spec's tasks 16 and 17; don't work them from the v1 file. If the schedule slips, cut task 15 (recipe sharing) first: ask for a `Reviewer decision: scope` and tell the maintainer in the session.

## Decide yourself

Make these calls without asking, and mention them in the PR body:

- Implementation choices within the stack in the design (React, TypeScript, Vite, Astryx after its trial passes, CSS modules, Vitest).
- Which Astryx components to use, and adjusting the FirstMenu theme, as long as contrast stays WCAG 2.1 AA and the palette stays light.
- Adding a small, well-maintained library or dev dependency when it clearly saves work. Say why in the PR.
- UI layout, component structure and wording that isn't safety or health guidance.
- Test design and coverage beyond the minimums in the design.
- Bug fixes, including in already-merged code.
- Making the safety screen stricter: adding terms to a rule, adding test cases, adding a source.
- Choosing which published recipes to use, within the sourcing rules and source criteria in the design.
- Fixing spec text (requirements, design, tasks) when pr-reviewer finds a contradiction, gap or missing test, as long as the fix doesn't change behavior the maintainer approved or the scope. Note it in the PR body.
- A nutrition tag term that no cited source supports: drop it and say so in the PR.
- A size, accessibility, contrast or external-resource check failing: fix the code. Ask only if the fix would need a requirement change, such as raising a budget.
- A new safety rule or term with no published source with a URL: don't add it, and say so in the PR. Never weaken an existing rule, its source or its tests to get past the release-gate test.
- A built-in recipe batch falling short of its share of the counts: keep going with later batches. Ask only at the end of task 14 (see below).
- A problem pr-reviewer reports again that needs no decision (for example a wording gap or a missing test): fix it and keep going.

## Decide with pr-reviewer

These used to stop for the maintainer. Now the coder makes the change, explains it in the PR body under a heading `Reviewer decision: <type>` with the evidence, and pr-reviewer decides using the rules in `.kiro/agents/pr-reviewer.md` ("Decisions you make"). Every such decision is logged on the `Reviewer decisions log` issue (#42) so the maintainer can audit it.

- **Publisher** (`Reviewer decision: publisher`). Any publisher that meets the source criteria in the active design ("Recipe source criteria"). Add its row to `docs/recipe-sources.md` with the verdict "Pending pr-reviewer"; after a PASS, update it to "Approved by pr-reviewer (PR #<n>)".
- **Safety** (`Reviewer decision: safety`). Making the safety screen catch less (removing a rule, lowering an age limit, adding an exception word, turning a block into a reminder or allergen rule) only when a source from AAP, WHO, CDC, FDA/EPA or NIAID with a URL directly supports the change, with tests showing the rule still fires where it should.
- **Scope** (`Reviewer decision: scope`). Changes to how a feature works that serve its user story and don't contradict a recorded maintainer decision: flows, ordering, wording that isn't health guidance, splitting or merging tasks. No new screens, no data the user didn't give, no network requests or accounts, and no removed requirements, except cutting task 15 (recipe sharing) when the schedule slips; tell the maintainer when that happens.

## Stop and ask

Stop and ask the maintainer only for these:

1. **Cost and settings.** Anything that costs money, needs a new account or third-party service, or changes repository settings.
2. **Stuck.** Anything pr-reviewer marks `NEEDS_MAINTAINER`, or a PR that is still failing after 10 review rounds or stuck sooner as `workflow.md` describes.

pr-reviewer marks `NEEDS_MAINTAINER`, so these still reach the maintainer, for: a safety loosening with no source from AAP, WHO, CDC, FDA/EPA or NIAID that directly supports it; removing the honey, high-mercury fish, unpasteurized or no-safe-form choking rules; making a block apply to fewer ages than its source states; skipping, deleting or loosening the release-gate test or any safety test; removing a rule's source without a replacement that has a URL; new health or safety wording that isn't in the design or taken from a cited source; negation handling or any other way to skip a text mention without the user's tap; new features or removed requirements beyond "scope within intent"; changes to theme decisions or deliverables; finishing task 14 short of its counts or allergen groups; and anything pr-reviewer is unsure is safe.

How to ask: open a GitHub issue titled `Decision needed: <topic>` with the context, the options, and your recommendation, then tell the maintainer in the session. Keep working on tasks that don't depend on the answer.

## Things only the maintainer can do

Ask once, at the right time, and keep working meanwhile:

- Turn on branch protection for `main` requiring the CI check to pass, if not done yet.
- Review the built-in recipes (v1 `Recipe review` issue and one `Recipe review: batch <n>` issue per new batch). Apply the feedback when it arrives; don't wait for it.
- Say what to change in the UI (active spec task 2.1). Don't wait for it.
- Provide real paste samples (active spec task 16.1). Don't wait for them.
- Record the demo video, upload it to YouTube and submit the entry (active spec task 17.2).

## Schedule

Milestone dates are in `tasks.md`. The deadline is Friday, December 4, 2026, 2:00 PM PT, with submission planned for Thursday, December 3. If a milestone slips by more than two days, tell the maintainer and propose specific cuts from the remaining tasks. Task 15 may be cut with pr-reviewer's approval as above; don't cut anything else without the maintainer's answer.

## Reporting

At the end of each milestone, post a short summary in the session and as a comment on the last merged PR: tasks done, PR links, decisions made under "Decide yourself", open questions, and whether the schedule holds.
