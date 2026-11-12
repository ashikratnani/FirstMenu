---
inclusion: always
---

# Design skills: impeccable and tasteskill

The maintainer asked (November 12, 2026) that UI and UX work use two skills, vendored in `.kiro/skills/` (see `.kiro/skills/VENDORED.md`):

- **impeccable** (`.kiro/skills/impeccable/`): the primary skill. Use it for every UI change: critique, audit, layout, typography, color, UX copy, empty states, onboarding, forms, responsive behavior, accessibility, polish.
- **tasteskill** (`.kiro/skills/taste-skill/`): a second opinion. Use its copy guidance (`references/copy*.md`), its consistency and system rules (`references/system.md`, `references/cards.md`) and its motion restraint (`references/motion.md`). Its scripts and assets are not vendored.

Both skills are written mostly for marketing and company websites. FirstMenu is an app a tired parent uses with one hand. Where a skill and this repo disagree, the spec and steering win.

## How to apply them

- **Mode: Operate** (impeccable). Every FirstMenu screen is a task screen: find something to cook, add a recipe, check a food. Ambition shows as clarity, speed and precision, not spectacle. The share view is also Operate.
- **Refinement, not redesign.** Keep the Astryx components, the FirstMenu theme (creams, soft orange, lavender), the friendly ghost, door, monster and pumpkin art, and every safety state and its text. Improve hierarchy, spacing, copy, flows and feedback within that.
- **Context files.** impeccable looks for `PRODUCT.md` and `DESIGN.md`. If they don't exist, create them at the repo root from `.kiro/steering/product.md`, `tech.md`, the active spec and `src/ui/theme/firstmenu.css`. Don't invent facts.
- **Inspiration:** `docs/design-inspiration.md`. Use it for patterns, never to copy another site's look, text or images.
- **Every UI PR** (task 19 and any later UI change): start with an impeccable critique of the screen at 390 px and 1280 px, fix what it finds, then run its craft-floor checks before the PR. Put the critique's main findings and what you changed in the PR body.

## What the skills must not override

| Skill guidance | FirstMenu rule that wins |
| --- | --- |
| Hosted fonts, Google Fonts, font matching from the Google catalog | Only bundled fonts (Figtree via `@fontsource`). `check:external` must pass. |
| Stock or licensed photographs, picsum, Wikimedia, generated plates | No photos or remote images. Inline SVG art only, `aria-hidden`, with state in text. |
| Hero sections, "one section per screen", entrance moments, shader effects, scenes | App screens, not landing pages. No hero, no scroll-jacking, no shaders. |
| Bolder or louder motion | CSS-only, subtle, and off under `prefers-reduced-motion`. |
| Replacing the palette or visual world | Theme decisions belong to the maintainer. Contrast must stay WCAG 2.1 AA (`check:contrast`). |
| New dependencies or design-system swaps | Keep Astryx (issue #37). Size budget `check:size` must pass. |
| Copy that claims or advises | No health or safety wording beyond the design and cited sources (`autonomy.md`). |
| Several prominent buttons | One filled primary button per screen (Requirement 17.10). |
| Skill hooks, gates or launchers | Optional. If impeccable's launcher can't run (no network or binary), say so and read the context files directly, as its SKILL.md describes. tasteskill's gate is not vendored. |

## Checks every UI PR still runs

`npm run lint`, `npm test`, `npm run build`, `npm run check:contrast`, `npm run check:external`, `npm run check:size`, and `vitest-axe` on changed pages, plus a look at 390 px and 1280 px.
