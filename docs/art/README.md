# FirstMenu art references

Reference boards and drawings from the Kiro session of November 13, 2026, for whoever builds tasks 19.3 and 19.4 of the active spec (`.kiro/specs/what-can-i-make/`, Requirement 21 and design "Food art").

Nothing in this folder ships with the app. The app's pictures will live in `public/art/` (task 19.3), and the art size check reads `dist/art/`, so these files are not counted. The boards are mockups: where a board and the spec differ, the spec wins.

## Files

| File | What it is |
| --- | --- |
| `final-picks.png` | The final picks. A legend of the four state pictures (new food, tried, not yet, freezes well), three recipe cards with plates, and six Foods tiles. Start here. |
| `style-options.png` | The first board: the same ten foods in four styles (Fluent 3D, Fluent Color, Fluent Flat, Twemoji), theme art in the Fluent 3D style, recipe cards with a plate and Foods tiles. The maintainer chose Fluent 3D. Its section 2 (Fluent ghost, door and jack-o'-lantern) was replaced by the later picks. |
| `new-food-options.png` | Options for the new-food picture (A peekaboo monster, B new moon, C crystal ball) and for freezes well (snowflake, ice cube), with a note on why not the pumpkin: 7 built-in recipes use pumpkin, so a pumpkin badge can read as "has pumpkin". The maintainer picked A and the snowflake. The board's subtitle says the ghost stays for "Not yet"; the maintainer then asked to replace the ghost too (next board). |
| `not-yet-options.png` | Options for "Not yet": A sleeping monster, B night owl, C hourglass. The board marks the sleeping monster as "My pick", but the maintainer chose C, the hourglass. |
| `reference/peekaboo.svg` | The app's own drawing for a new food: a friendly monster hiding in a dark round hole, with only its eyes and horn tips showing. |
| `reference/monster.svg` | The app's own drawing for a tried food, in the generic color (green body, cream horns). |
| `reference/monster-egg.svg` | The same monster in the egg allergen group's color (yellow body, lavender horns), an example of one color per allergen group. |
| `LICENSE-fluentui-emoji.txt` | The MIT license of Microsoft Fluent Emoji, whose pictures appear in the boards. Copied unchanged from the repository at commit `1ffb34c752ecf5d402f04cfb4b392c77f57c54bc`. |

The reference SVGs use fixed ids (`rim`, `eye`, `body`). In the app each drawing needs ids made unique with `useId()` (design "State pictures").

## Decisions

Made by the maintainer in the Kiro session on November 13, 2026:

- "I think the app needs images for foods, recipes. Also, the UI lacks art and general baby app feel. It feels very dull."
- After seeing the options he approved the direction: "yes, I like this direction". That is Fluent 3D food pictures, theme art redrawn in the same style, Fredoka headings, no photos and no AI-generated images.
- He said the mystery door and "the pumpkin for freezes well" didn't make sense, asked to replace the ghost too, and picked "New food: Peekaboo monster", "Freezes well: Snowflakes" and "I like hourglass for not yet".

The state labels in the app stay the same; only the pictures change. Two help lines on the Foods page name the mystery door, so they are reworded (design "State pictures").

## Where the boards differ from the spec

- The Blueberries tile on `final-picks.png` says "Flatten or cut small". The app shows the rule's message as written in `src/domain/safety/rules.ts` ("Flatten or cut into small pieces.").
- Band colors on the boards were picked by hand. In the app, a card's band follows the food group of the first food on its plate, and a Not yet card uses the lavender band (design "Colors").
- Sizes on the boards are a guide only.
- The legend captions ("hiding in the dark", "came out to say hi", "waits until later", "make ahead"), the status lines on the board's Foods tiles (for example "Tried Nov 12") and the cards' "New foods: carrot, apple" are mockup text. The app keeps its current labels, such as "egg — tried on Nov 12" and "New food: carrot, apple" (Requirement 21.10).

## Credits

- Every Fluent picture in the boards (the foods, the hourglass, the snowflake and the other options): [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) by Microsoft, MIT License (see `LICENSE-fluentui-emoji.txt`).
- The Twemoji row in `style-options.png`: Twemoji graphics by Twitter, Inc and other contributors, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) ([jdecked/twemoji](https://github.com/jdecked/twemoji)). The board labels Twemoji as MIT, which applies to Twemoji's code, not its graphics. The app does not use Twemoji.
- Text in the boards: Fredoka (headings) and Figtree (body), both under the SIL Open Font License 1.1.
- The peekaboo monster, the friendly monsters and the sleeping monster are FirstMenu's own drawings, under the repository's MIT license.
