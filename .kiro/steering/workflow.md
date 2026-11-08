---
inclusion: always
---

# Workflow

## Branches and PRs

- One branch and one PR per top-level task in the active spec's `tasks.md` (`.kiro/specs/what-can-i-make/tasks.md`). Branch name: `v2/<number>-<short-name>`, such as `v2/6-paste-parser`. (v1 used `task/<number>-...`; don't reuse those names.)
- Small follow-up fixes can be a separate PR named `fix/<short-name>`.
- The PR body lists the task ids completed, the requirement ids covered, what was tested, and anything the maintainer should know.
- Tick the completed task checkboxes in `tasks.md` in the same PR.
- Never push directly to `main`. Never force-push to `main` or rewrite its history.
- Changes to `.github/workflows/*` always go through a PR like everything else.

## Review and merge

- The coding agent opens the PR and never merges it.
- After opening or updating a PR, the coding agent invokes the `pr-reviewer` sub-agent by name with the PR number.
- `pr-reviewer` posts a comment with one of three verdicts:
  - `VERDICT: PASS`: it merges the PR (squash) once CI passes. Nothing else to do.
  - `VERDICT: NEEDS_CHANGES`: the coding agent fixes every listed problem on the same branch, pushes, and invokes `pr-reviewer` again.
  - `VERDICT: NEEDS_MAINTAINER`: stop work on that PR and ask the maintainer (see `autonomy.md`).
- After two NEEDS_CHANGES rounds on the same PR, stop and ask the maintainer instead of trying a third time.
- If `pr-reviewer` can't be invoked, leave the PR open and tell the maintainer. Don't merge it yourself.
- After a merge, update local `main` (`git checkout main && git pull --ff-only`) before starting the next branch.
