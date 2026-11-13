# Art pipeline (task 19.3): UI review

Branch `v2/19-art-pipeline`. Before screenshots come from a build of `main` (f6187d7), after screenshots from this branch, at 360 px and 1280 px, with a seeded 8-month-old child, a tried carrot and banana, a recorded dairy reaction and a two-food pantry.

Screens: Make, Foods (with tried foods) and Sources stand in for the heading change, which reaches every page. Files: `before-<screen>-<width>.png`, `after-<screen>-<width>.png`, plus `before|after-tried-tile-<width>.png` close-ups of the redrawn Tried monster.

## What changed that users see

1. Headings (h1 to h3, recipe card titles, Foods tile names) use Fredoka 600 instead of Figtree.
2. The Tried monster on Foods tiles is the new gradient drawing (same shape for every group, color per allergen group).
3. Nutrition tags are colored chips with their names (Make result cards, recipe page).
4. Sources has a final Credits section and a "Credits" entry in its jump list.

The plate, state pictures and peekaboo monster are not on any screen yet (task 19.4, one PR per screen).

## Critique, ranked

1. Fredoka headings are rounder and a little heavier than Figtree; hierarchy on Make and Foods is clearer (section headings now stand apart from the card text). No wrapping or overflow changes at 360 px (page widths unchanged, overflow 0 on every page).
2. The tag colors are soft pastels with dark text (8.2:1 to 9.97:1). Names stay visible, so color is never the only signal. The Iron-rich and Protein chips are close in hue (both peach); the names tell them apart.
3. The Tried monster reads as friendly at 40 px. Dark eyes with highlights stay legible at that size.
4. Credits uses the existing full-width 44 px link rows. The two license lines are plain text under the section title.

Measured: horizontal overflow 0 at 360 and 1280 px on all three pages; exactly one filled primary button per screen (unchanged); no new request to any other host (page request log empty apart from the app's own files); page heights unchanged except Sources (+371 px at 360, +288 px at 1280 for the Credits section) and Foods at 1280 (+61 px, tile row height).

## Keyboard pass (1280 px, compared to main)

Tab order through Make (44 stops), Foods (252 stops) is identical to main, and every stop except the same 2 (Make) and 1 (Foods) that have no ring on main shows a focus ring. Sources has hundreds of links, so the pass was capped at 400 stops; its sequence starts with one more jump-list link (Credits) than main, which is why the capped sequences differ. Nothing in this PR changes focus handling.

## Impeccable detector (seeded state, 360 and 1280 px)

Make, Foods and Sources: the cream-palette advisory only (the maintainer's theme, left as is), plus existing "straggler" advisories on help text that this PR does not touch. No new findings from the changes.
