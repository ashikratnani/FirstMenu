# FirstMenu

Meal Planner for Babies

**Live app: [https://ashikratnani.github.io/FirstMenu/](https://ashikratnani.github.io/FirstMenu/)**

FirstMenu is a free web app for planning a week of baby meals for babies roughly 6 to 12 months old. Pick recipes by age stage or add your own, and get a weekly plan, a make-ahead prep list and a grocery list. Every recipe is screened against a fixed infant-safety list based on pediatric guidance.

There is no account and no backend. All data lives in your browser's `localStorage`, and the app loads only its own files (no analytics, ads, trackers or third-party fonts).

> FirstMenu is not medical advice. Check with your pediatrician.

## What it does

- **Plan a week.** Build a 7-day plan across breakfast, lunch, dinner and snack slots. Eligible recipes come first; recipes that aren't safe for your baby's age are shown but can't be planned.
- **Recipes by stage or your own.** Browse a library filtered by age stage and meal type, or add custom recipes in the built-in editor. Every ingredient you add is screened on save.
- **Safety screen with ghosts and doors.** Unsafe-for-age ingredients turn a recipe into a *ghost* that can't be planned, with the reason shown. Common allergens appear as *mystery doors* for first tastes, and once a food is introduced it becomes a friendly *monster*. A recorded reaction ghosts affected recipes until you clear it.
- **Prep reminders.** Choking-risk foods carry a plain-language reminder (for example, "quarter grapes lengthwise before serving") drawn from the same rule list.
- **Make-ahead prep list.** Turn the week's plan into cook sessions with batch sizes, fridge/freezer storage times and thaw reminders.
- **Grocery list.** A merged shopping list grouped by category, with check-off that reconciles against what you already have.
- **Share and print.** Share a week as a read-only link (the plan is packed into the URL fragment, with no name or birth date) so family who cook can follow along, or open a print view for the week grid, prep list and grocery list.

Each theme element (ghost, door, monster, pumpkin) is also announced in text for screen readers, the palette meets WCAG 2.1 AA contrast, and animations turn off under reduced-motion settings.

## Screenshots

> **Maintainer note:** these screenshots need to be captured from a real browser against the live app and committed under `docs/images/`, then linked here. They are intentionally left as placeholders.

Shots to add:

- [ ] Week plan grid (a planned 7-day week)
- [ ] A ghosted recipe (unsafe-for-age, with the reason shown)
- [ ] The Foods page (mystery doors, friendly monsters and a ghost)
- [ ] Prep list (cook sessions and storage times)
- [ ] Grocery list (grouped by category, with check-off)
- [ ] Share screen (the read-only link)

## Safety and recipe sources

**Safety screen.** Every rule in the safety list cites at least one published source from a recognized public-health authority, and the full list is shown in the app on the **Sources** page (generated directly from the rules in `src/domain/safety/rules.ts`). The guidelines the rules draw on are:

- **AAP** (American Academy of Pediatrics / HealthyChildren) — honey, fruit juice, added sugar, cow's milk, choking hazards, starting solids and allergen introduction.
- **CDC** — choking hazards and introducing solid foods.
- **FDA / EPA** — fish and mercury advice, raw/unpasteurized milk, and safe food handling.
- **WHO** — complementary feeding of infants and young children 6–23 months (2023).
- **NIAID** — peanut allergy prevention.
- **HHS** — *Caring for Our Children* standards for foods that are choking hazards.

The safety screen checks ingredient names against this fixed list and can miss foods or preparations that are not on it. See the in-app **Sources** page for the exact rule-by-rule citations and links.

**Recipes.** The built-in recipes are adapted from the **Minnesota WIC Program** (Minnesota Department of Health): their *Homemade Baby Food* and *Infant Food Recipes* pages. Ingredients and quantities are copied from the source and the method steps are rewritten in our own words; each recipe records its source link and any adaptations, and these citations also appear on the Sources page. The current build ships a reduced first batch of 10 recipes covering the dairy, egg and wheat allergen groups; broader recipe coverage is tracked on the project's issues.

## Development

```sh
npm ci        # install from the lockfile
npm run lint  # ESLint
npm test      # Vitest + React Testing Library
npm run build # production build
```

The app is React 18 + TypeScript built with Vite, uses `HashRouter`, and deploys to GitHub Pages on push to `main`. The project spec and steering live in [`.kiro/specs/first-menu/`](.kiro/specs/first-menu/) and [`.kiro/steering/`](.kiro/steering/); see [`docs/kiro-usage.md`](docs/kiro-usage.md) for how the app was built with Kiro.

## License

[MIT](LICENSE)
