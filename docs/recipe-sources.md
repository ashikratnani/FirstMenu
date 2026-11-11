# Built-in recipe sources

Publishers that built-in recipes may come from (active spec Requirement 14.2). A new publisher is added here in the PR that adds its first recipe, with the verdict "Pending pr-reviewer". After pr-reviewer passes and merges that PR, the next PR updates the verdict to "Approved by pr-reviewer (PR #<n>)". Criteria: `.kiro/specs/what-can-i-make/design.md` "Recipe source criteria". Decisions are also logged on issue #42.

| Publisher | Type | Example URL | Criteria notes | Verdict | Date |
| --- | --- | --- | --- | --- | --- |
| Minnesota Department of Health, WIC Program | State WIC program | https://www.health.state.mn.us/people/wic/recipes/babyfood.html | Free HTML, exact quantities | Approved by maintainer (v1 spec) | 2026-11-06 |
| Other state WIC programs (for example Utah, California) | State WIC program | https://wic.stage.utah.gov/wp-content/uploads/Homemade-Baby-Foods-1.pdf | Free PDF; mostly simple ideas | Approved by maintainer (spec PR #33) | 2026-11-08 |
| USDA Food and Nutrition Service | Federal agency | https://www.fns.usda.gov/sites/default/files/resource-files/FI_Ch7a_PrepareFoods.pdf | Free PDF; simple ideas | Approved by maintainer (spec PR #33) | 2026-11-08 |
| Institute of Child Nutrition, Child Nutrition Recipe Box (USDA) | Federally funded nutrition institute | https://theicn.org/cnrb/ | Free HTML, standardized recipes, 6-serving versions | Approved by maintainer (spec PR #33) | 2026-11-08 |
| Food Hero, Oregon State University Extension | University extension | https://foodhero.org/recipes | Free HTML, exact quantities | Approved by maintainer (spec PR #33) | 2026-11-08 |
| National Heart, Lung, and Blood Institute (NHLBI), National Institutes of Health | Federal agency (NIH) | https://www.nhlbi.nih.gov/health/heart-healthy-living/healthy-foods/healthy-eating-recipes/fresh-lumpia-lumpiang-sariwa | Free HTML, exact quantities, US government site; used only for the shellfish gap | Approved by pr-reviewer (PR #60) | 2026-11-10 |
| Oregon Sea Grant, Oregon State University | University program (Oregon State University) | https://seagrant.oregonstate.edu/shrimp-cucumber-and-seaweed-salad | Free HTML, exact quantities, no login, English; university-run outreach program (same university as Food Hero), not a brand or blog; recipes are by named chefs and OSU Extension staff; used only for the shellfish gap | Pending pr-reviewer | 2026-11-10 |
