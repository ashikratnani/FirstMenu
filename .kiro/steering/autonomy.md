---
inclusion: always
---

# Working autonomously on FirstMenu

The maintainer wants this project built with as little input from them as possible. The spec in `.kiro/specs/first-menu/` is the source of truth. Work through `tasks.md` in order, following `workflow.md` for branches, review and merging.

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
- Using tier 3 recipe sources, or shipping with fewer recipes or allergen groups than Requirement 2 asks for.
- The release gate (task 17.0) failing because a rule still has no published source.
- Any change to requirements, scope or the theme decisions.
- Anything that costs money, needs a new account or third-party service, or changes repository settings.
- Anything `pr-reviewer` marks `NEEDS_MAINTAINER`, or a PR stuck after two review rounds.

How to ask: open a GitHub issue titled `Decision needed: <topic>` with the context, the options, and your recommendation, then tell the maintainer in the session. Keep working on tasks that don't depend on the answer.

## Things only the maintainer can do

Ask once, at the right time, and keep working meanwhile:

- Turn on GitHub Pages: Settings → Pages → Source: "GitHub Actions". Needed before task 17.
- Turn on branch protection for `main` requiring the CI check to pass. Ask right after the CI workflow from task 1.2 is merged and has run once.
- Review the built-in recipes (task 4.3). Open an issue titled `Recipe review` listing every recipe with its source link, stage tags and adaptations. Don't wait for the review. Apply the feedback when it arrives.
- Record the demo video, upload it to YouTube and submit the entry (task 18).

## Schedule

Milestone dates are in `tasks.md`. The deadline is Friday, December 4, 2026, 2:00 PM PT, with submission planned for Thursday, December 3. If a milestone slips by more than two days, tell the maintainer and propose specific cuts from the remaining tasks. Don't cut anything without their answer.

## Reporting

At the end of each milestone, post a short summary in the session and as a comment on the last merged PR: tasks done, PR links, decisions made under "Decide yourself", open questions, and whether the schedule holds.
