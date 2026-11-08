---
inclusion: always
---

# Working autonomously on FirstMenu

The maintainer wants this project built with as little input from them as possible. There are two specs:

- `.kiro/specs/first-menu/`: v1, built and live. It is the baseline for anything the active spec doesn't change.
- `.kiro/specs/what-can-i-make/`: the active spec. Where it conflicts with v1, it wins.

Work through `.kiro/specs/what-can-i-make/tasks.md` in order, following `workflow.md` for branches, review and merging. Don't start it while its tasks file says "Status: DRAFT". Remaining unticked v1 tasks are carried into the active spec's tasks 12 and 13; don't work them from the v1 file.

## Decide yourself

Make these calls without asking, and mention them in the PR body:

- Implementation choices within the stack in the design (React, TypeScript, Vite, plain CSS, Vitest).
- Adding a small, well-maintained library or dev dependency when it clearly saves work. Say why in the PR.
- UI layout, component structure and wording that isn't safety or health guidance.
- Test design and coverage beyond the minimums in the design.
- Bug fixes, including in already-merged code.
- Making the safety screen stricter: adding terms to a rule, adding test cases, adding a source.
- Choosing which published recipes to use, within the sourcing rules in the design.

## Stop and ask

Stop and ask the maintainer before any of these:

- Loosening a safety rule: removing it, lowering its age limit, adding an exception word, or changing a block into a reminder or allergen rule.
- Writing new health or safety wording that isn't already in the design or taken from a cited source.
- Using tier 3 recipe sources, or adding built-in recipes beyond the current 10 (tracked in issue #7).
- The release-gate test failing because a safety rule still has no published source.
- A nutrition tag term that no cited source supports. Drop it rather than keep it, and say so in the PR.
- Adding negation handling ("no salt", "without honey") or any other way to skip a text mention without the user's tap.
- Any change to requirements, scope or the theme decisions.
- Anything that costs money, needs a new account or third-party service, or changes repository settings.
- Anything `pr-reviewer` marks `NEEDS_MAINTAINER`, or a PR stuck after two review rounds.

How to ask: open a GitHub issue titled `Decision needed: <topic>` with the context, the options, and your recommendation, then tell the maintainer in the session. Keep working on tasks that don't depend on the answer.

## Things only the maintainer can do

Ask once, at the right time, and keep working meanwhile:

- Turn on branch protection for `main` requiring the CI check to pass, if not done yet.
- Review the built-in recipes (v1 task 4.3, `Recipe review` issue). Apply the feedback when it arrives.
- Provide real paste samples (active spec task 12.2). Don't wait for them.
- Record the demo video, upload it to YouTube and submit the entry (active spec task 13.2).

## Schedule

Milestone dates are in `tasks.md`. The deadline is Friday, December 4, 2026, 2:00 PM PT, with submission planned for Thursday, December 3. If a milestone slips by more than two days, tell the maintainer and propose specific cuts from the remaining tasks. Don't cut anything without their answer.

## Reporting

At the end of each milestone, post a short summary in the session and as a comment on the last merged PR: tasks done, PR links, decisions made under "Decide yourself", open questions, and whether the schedule holds.
