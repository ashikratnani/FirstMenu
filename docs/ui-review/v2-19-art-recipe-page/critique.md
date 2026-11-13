# Impeccable critique: recipe page and shared recipe view (task 19.4, recipe page only)

Before (origin/main c7810cb) and after at 360 and 1280 px: normal recipe with tag chips, Not yet recipe, freezable recipe, shared view (no child, block finding, only a recorded reaction).

Findings
1. The plate gives the page a clear first picture and the food-group band matches the tag chips below it. Title, state note and disclaimer wording and order are unchanged.
2. Spacing: the band sat flush against the next block (tag chips or the shared intro line) on ready recipes and the shared view. Fixed with a spaced wrapper (`.plate`, 12 px below) in both pages, with tests. Not yet pages already had space from the note.
3. Hourglass shows twice on a Not yet recipe (plate corner and beside the Not yet heading). Judged: kept. The corner mark belongs to the picture (same as the My recipes cards), the one by the heading belongs to the labelled note that carries the reason, and both are decorative with empty alt text. Dropping either would make the picture and the note inconsistent with the rest of the app. Open to a reviewer's call.
4. Freezer line: the snowflake sits left of the unchanged "Freezes for N months" text, aligned on the text line, no layout shift.
5. Shared view with only a recorded reaction: the reaction food stays on the plate, not greyed, no Not yet section (matches Requirement 21.8). No child: nothing greyed.
6. Page length grows by about 180 px at 360 (plate 160 px + gap); a smaller plate on narrow screens is a possible follow-up.
7. Detector advisory (not from this PR): "months." alone on the last line of the existing block reason at 360 px. Wording is pre-existing and pinned, left.
