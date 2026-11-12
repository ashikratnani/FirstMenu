# Vendored design skills

Copied unmodified so the Kiro agent can load them from `.kiro/skills/`. How FirstMenu uses them, and which parts don't apply, is in `.kiro/steering/design-skills.md`.

| Skill | Source | Commit | License | What was copied |
| --- | --- | --- | --- | --- |
| impeccable 4.8.2 | https://github.com/pbakaus/impeccable | b4bff1626c344067788c2679f048a20057c7cc5a | Apache 2.0 (LICENSE, NOTICE.md) | The repo's own Kiro build, `.kiro/skills/impeccable/`, in full. Its launcher downloads a checksum-verified engine binary from the repo's GitHub releases on first run. |
| tasteskill 2.5.1 | https://github.com/leonxlnx/taste-skill | f6b76575f949707b4e3c37cd86cb44b0b98643e8 | MIT (LICENSE) | `SKILL.md`, `references/` and `library/` only. Not copied: `scripts/` (photo downloads, hosted fonts, Chrome gates written for Claude Code) and `assets/` (38 MB of marketing-site components). |

To update, re-copy from a newer commit and update this table.
