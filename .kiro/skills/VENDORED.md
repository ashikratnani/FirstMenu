# Vendored design skills

Copied unmodified so the Kiro agent can load them from `.kiro/skills/`. How FirstMenu uses them, and which parts don't apply, is in `.kiro/steering/design-skills.md`.

| Skill | Source | Commit | License | What was copied |
| --- | --- | --- | --- | --- |
| impeccable 4.8.2 (folder `impeccable/`) | https://github.com/pbakaus/impeccable | b4bff1626c344067788c2679f048a20057c7cc5a | Apache 2.0 (LICENSE, NOTICE.md) | Upstream `.kiro/skills/impeccable/` in full, plus `LICENSE` and `NOTICE.md` from the repo root. Its launcher downloads a checksum-verified engine binary from the repo's GitHub releases on first run. |
| tasteskill 2.5.1 (folder `design-taste-frontend/`, matching the skill's `name`) | https://github.com/leonxlnx/taste-skill | f6b76575f949707b4e3c37cd86cb44b0b98643e8 | MIT (LICENSE) | From upstream `skills/taste-skill/`: `SKILL.md`, `references/` and `library/` only, plus `LICENSE` from the repo root. Not copied: `scripts/` (photo downloads, hosted fonts, Chrome gates written for Claude Code) and `assets/` (38 MB of marketing-site components). |

To update, re-copy from a newer commit and update this table.

tasteskill's `SKILL.md` declares a Claude Code `Stop` hook in its front matter. It does nothing here: Kiro doesn't run it, and the `gate.mjs` script it calls isn't vendored.
