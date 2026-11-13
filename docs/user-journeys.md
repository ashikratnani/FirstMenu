# FirstMenu user journeys (draft for review)

Status: DRAFT, November 13, 2026. Not approved yet. Once the maintainer approves
it, it becomes requirements, design and tasks in `.kiro/specs/what-can-i-make/`.
Mockups: [user-journeys-mockups.png](art/user-journeys-mockups.png).

## Why

Maintainer feedback, November 13, 2026:

> In regard to UX, I like the proactive approach but the features feel half
> baked. The app seems to make little effort to actually help. [...] The whole
> product feels disconnected and incoherent. [...] It shouldn't left to the
> user to figure it out and make it work.

What the code does today (audit of `main` at `f6187d7`):

- "Show another" is an index that wraps around (`Make.tsx` `tryOffset %
  tryPicks.length`). Nothing records the "no". It restarts at the first pick
  when Make opens again, and it points at a different recipe when the list
  re-sorts.
- The pantry editor accepts typed foods, but the field sits at the bottom of a
  dialog and doesn't recognize names: "courgette" isn't matched to zucchini,
  and "chicken, rice" keeps only "chicken". Every "I have this" and food chip
  writes to today's foods, never the pantry.
- Make's box knows other names, typos and phrases. The Recipes page search
  matches literal words only. Make has two "what I have" inputs, with the Try
  this card and up to two banners between them.
- Effort today, on a phone:

| Task | Today |
|---|---|
| Save a recipe from ChatGPT | 12 taps, 2 app switches, 2 copies |
| Save a recipe from an Instagram reel | about 20 taps, 4 app switches, 3 copies |
| Log a new food | 5 to 7 taps plus typing, across 3 screens; no food links to its recipes |
| Plan a toddler's week (4 meals) | about 64 taps, after finding that no meals are switched on |

## Rules for every journey

1. **One food box.** Every place that takes food names (Home, the pantry, the
   ChatGPT question, Saved recipes, First tastes) uses the same recognizer:
   other names, typos, commas and "and", and phrases like "something for
   breakfast" or "finger food".
2. **One "What you have" list.** The parent sees one list. Staples stay until
   she removes them. Fresh foods get the existing "Still have these?" check
   after 3 days. Wherever she says she has a food, she can keep it for good
   with one more tap.
3. **A "no" is remembered.** A skipped suggestion stays skipped for the rest of
   the day. Nothing wraps around.
4. **Every screen has a next step.** An empty result always offers the
   next-best action: a recipe missing one food, Ask ChatGPT, or Add a recipe.
5. **The app does the setup.** Defaults come from the child's age (meals,
   textures) and from her history (staples, tried foods). She changes them
   only if she wants to.
6. **One primary button per screen**, within thumb reach.
7. **Safety doesn't change.** The safety screen, its sources and the Not yet
   rules stay as they are, and every new flow shows the same Not yet reasons.

## The journeys

| # | Journey | How often | Target |
|---|---|---|---|
| 1 | Find something to make now | Daily | A pick with 0 taps; no repeats after a "no" |
| 2 | Save a recipe from ChatGPT or Instagram | Weekly | ChatGPT: 6 taps, 2 switches. Reel: about 10 taps, 3 switches |
| 3 | Try a new food | Every 3 days or more | 4 taps from the Home card to a logged result |
| 4 | Plan the week and shop | Weekly | 2 taps to a full week; the list shows only what's missing |
| 0 | First run | Once | Under a minute; Home shows a pick right away |

### Journey 1: Find something to make now

Goal: "I have a few things. What's the quickest, easiest thing I can make?"

1. Home opens on one Try this pick for the time of day, for example
   "Sweet Potato Chicken. Ready now · 10 min · Easy · Iron-rich". The primary
   button is "Make this".
2. "Not this" shows the next pick. Skipped picks stay skipped until tomorrow,
   including after leaving Home. After the last pick, the card says "That's
   everything you can make with what you have" and offers "3 recipes need one
   more food" and "Ask ChatGPT with these foods".
3. Below the pick is one box: "What do you have, or what are you looking for?"
   - Food names join What you have as soon as they're recognized, shown as
     chips with ✕. No Enter needed, and nothing is lost on leaving.
   - Dish names ("pancakes") and phrases ("finger food", "quick", "something
     for breakfast") filter the results.
4. Results: Ready now, then Missing one. A Missing one card says "Missing:
   peas" with "I have peas". After the tap: "Added. Always have peas?" with
   "Yes" as an optional second tap.
5. A toggle switches between "Can make" (the default) and "All recipes", so
   browsing every recipe happens on the same screen with the same box.
6. "What you have" is one row of chips under the box, with "Edit". The editor
   shows staples and fresh foods, the same box, and a picture grid of common
   foods.

Changes from today:
- One box and one What you have list replace the separate search box, the
  "What else do you have today?" chips, the Pantry row, the pantry dialog and
  the first-use pantry panel.
- The Recipes page becomes "Saved": only her own recipes, with the same box.
- At most one banner at a time, always below the pick.

Done when:
- With staples set, Home shows a pick with no taps.
- A declined recipe doesn't come back the same day.
- The same words find the same foods in every box.
- Every empty result offers a next step.

### Journey 2: Save a recipe from ChatGPT or Instagram

Goal: keep a recipe she found, without typing it.

**From ChatGPT** (on Home or Add):
1. "Ask ChatGPT" opens with the question filled in from the box, for example
   "quick dinner with chicken and peas". She can edit it.
2. "Open ChatGPT" opens chatgpt.com with the full question already sent: the
   child's age, the texture and the foods to leave out. ChatGPT reads a `q`
   link parameter for this ([OpenAI community](https://community.openai.com/t/query-parameters-in-chatgpt/1027747),
   [Tenable](https://www.tenable.com/security/research/tra-2025-22)). It isn't
   a documented API, so "Copy and open" stays as the fallback.
3. In ChatGPT she taps Copy on the reply.
4. Back in FirstMenu, Add says "Waiting for ChatGPT's answer" with one primary
   button, "Paste answer". The app remembers this for an hour, even after a
   reload.
5. The preview shows the safety check. She taps "Save".
6. She lands on the saved recipe with "Saved", and "Make this" if it's Ready
   now.

Taps: Ask, Open, Copy, switch back, Paste answer, Save. That's 6 taps and 2
switches.

**From an Instagram reel:**
1. In Instagram: Share, then Copy link.
2. In FirstMenu, on Home or Add: "Paste". The app sees a reel link and shows
   "Next: ask Meta AI to read this reel" with one button, "Copy prompt and open
   Meta AI".
3. In Meta AI: paste, send, then copy the reply.
4. Back in FirstMenu: "Paste answer", check the preview, then "Save".

That's about 10 taps and 3 switches.

**One Paste button.** Whatever she pastes, the app works out what it is:
- a reel link starts the reel steps;
- an AI reply goes to the preview;
- a caption or recipe text goes to the preview through the plain-text reader;
- anything else gets "This doesn't look like a recipe" and the two helpers.

Changes from today:
- The Add page follows the journey. "Paste" is the only primary button. The
  two helpers are large choices above it, not collapsed below it.
- The source choice and the link field go away. The app infers both from what
  was pasted.
- Copy and Open become one tap.
- The prompts ask the AI for anything the preview can't work out, such as
  meals and servings.
- The preview says "Not yet", like the rest of the app, not "Not safe yet".
- After saving she gets a confirmation and the next step.

Check on a phone: whether the ChatGPT app honors the `q` link on iOS and
Android, and whether Meta AI has a similar link. Without it, the fallback is
one "Copy and open" tap. The question travels in the link. It holds the same
content she would paste: the age in months, the texture and the foods to leave
out, never the child's name or birth date.

### Journey 3: Try a new food

Goal: introduce new foods one at a time, record how it went, and know what's
next.

1. When a new food is due (3 days after the last one, the spacing the app
   already uses from AAP), Home shows one card: "New food day: egg", with the
   egg picture and "4 recipes you can make now". The primary button is "See egg
   recipes". "Pick a different food" offers 3 foods she has what she needs
   for.
2. The list shows recipes where egg is the only new food, Ready now first.
3. The recipe page shows "New food: egg" with the existing allergen guidance
   next to the ingredients. Its primary button is "We tried it".
4. "How did it go?": "No reaction" (primary) or "Noticed a reaction". The date
   is today, with a "Yesterday" option.
5. With no reaction, the monster comes out (Requirement 21), the card says
   "Next new food in 3 days", and egg recipes join the normal suggestions. With
   a reaction, the food gets the hourglass, its recipes leave the suggestions,
   and the screen shows the existing pediatrician advice.
6. If she cooked it but didn't log it, the next time she opens the app Home
   asks "Did {name} try egg on Tuesday?" with the same two buttons, once.

The Foods page becomes "First tastes":
- At the top: "Next up" and a count, such as "23 foods tried · 5 of 9 allergen
  groups".
- Then New (peekaboo monster), Tried (friendly monster) and Not yet
  (hourglass).
- Each food opens its recipes, and the box finds foods by any name.

Changes from today:
- A Home card with actions replaces the text-only banner.
- Foods link to their recipes, and the recipe page can log a try.
- "I made this" on a recipe with one new food asks whether the child tried it.
- The date of a log can be changed.

Done when: from the Home card to a logged result takes 4 taps (See egg
recipes, open a recipe, We tried it, No reaction), and a forgotten log is
asked about once.

### Journey 4: Plan the week and shop

Goal: a week of meals and one shopping trip, without filling 28 slots by hand.

1. Plan opens with "Plan my week" as the primary button. Meals come from the
   child's age: breakfast and dinner at 6 to 8 months, all four after that.
   She can change them.
2. One tap fills the week. The app picks recipes that:
   - she can make, or is one food away from, so the list stays short;
   - share ingredients across days;
   - repeat freezer-friendly recipes, so one cook covers several meals;
   - include at most one new food, at least 3 days after the last one;
   - include an Iron-rich recipe each day where one fits;
   - are never Not yet.
3. She reviews the week. Each meal has "Swap", which offers 3 recipes that fit
   the same rules. "Redo" refills the whole week.
4. "Keep this plan" opens the shopping list. It shows only what she doesn't
   have, grouped by aisle, with amounts. Checking an item off adds it to What
   you have. "Share list" sends it as text, for example to her partner.
5. Prep: "Cook day Sunday: 3 recipes, about 1 hour", what to freeze, and thaw
   reminders the night before.

Changes from today:
- Filling the week, which only exists inside the onboarding tour today,
  becomes the main way to plan. Picking a recipe by hand stays, through Swap.
- Meals default from age, which removes today's dead end.
- The list leaves out what she has, and checking off feeds What you have.

Done when: a full week takes 2 taps (Plan my week, Keep this plan), the list
shows only missing foods, and an empty plan never shows a dead end.

Scope: the active spec says "no new work" on Plan, and v1 lists generated
plans as out of scope. This journey changes both, so it needs your OK.

### Journey 0: First run

Goal: useful suggestions in under a minute.

1. "Welcome": the child's first name (optional) and birth date. The
   not-medical-advice notice sits on this screen with "I understand", not in a
   separate popup.
2. "What do you usually have?": a picture grid of about 24 common foods (rice,
   oats, eggs, milk, banana and so on) plus the food box for anything else.
   "Skip" is allowed.
3. "Foods {name} already eats" (optional): a picture grid. These are saved as
   "tried before FirstMenu" with no date, so they don't hold the next new food
   for 3 days.
4. Home, with a Try this pick already showing.

Changes from today: this replaces the "What would you like help with?" screen
and its four walkthroughs. Their answers aren't used anywhere later, and none
of them asks for the pantry, so Home starts empty.

## Navigation

On phones, a bottom bar: Home, Saved, Add (in the middle), First tastes, Plan.
Settings and Sources move to a menu at the top of Home.

Today there are 7 items behind ☰, and "Add recipe" shows twice.

## Bugs to fix first (task 20)

These break approved requirements and don't depend on the journeys:

1. The child's age is calculated at the plan's start date, so after first run
   it stops advancing unless the plan is edited. A plan dated next week makes
   today's screens use next week's age, which can lift a Not yet rule early.
2. New plans have no meals switched on (v1 Requirement 8.2).
3. Export and import have no button (v1 Requirements 12.4 and 12.5).
4. Foods marked as already tried during setup are dated today, which holds the
   next new food for 3 days.
5. The safety screen ignores an ingredient's "counts as" food. The fix only
   makes the screen stricter.
6. Deleting a recipe doesn't ask first.

"Show another" and pantry typing are covered by Journey 1.

## Order and schedule (20 days to December 3)

1. November 14: you approve or change this draft.
2. November 14 to 15: requirements, design and tasks, through pr-reviewer.
3. November 15 to 27: build in this order: task 20, Journey 1, Journey 2,
   Journey 0, Journey 3, Journey 4. The art (tasks 19.3 and 19.4) runs
   alongside.
4. November 28 to December 1: phone checks (task 16).
5. December 2: record the video. December 3: submit.

If time runs short, Journey 4 ships with filling the week and the shorter list
only, without Swap and the prep changes. Recipe sharing stays the first thing
to cut.

## Questions for the maintainer

1. Merge the pantry and today's foods into one "What you have" list?
   (Recommended.)
2. Open ChatGPT with the question already filled in, after a check on a phone?
3. Replace the onboarding problem screen and its walkthroughs with the
   three-step setup?
4. Fill the week automatically? This changes "no new work on Plan".
5. Rename Foods to "First tastes"?
6. Use a bottom bar on phones?
