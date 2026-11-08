---
inclusion: always
---

# Tech conventions

Stack and conventions follow `.kiro/specs/first-menu/design.md` (v1 baseline)
and `.kiro/specs/what-can-i-make/design.md` (active changes, wins on conflict).
This file is the short version; the design docs are the source of truth.

New domain modules from the active spec: `make.ts`, `effort.ts`,
`nutrition.ts`, `category.ts`, `importText.ts`, `prompt.ts`, `recipeShare.ts`.
They follow the same rules: pure TypeScript, no React, derived data not stored.
The paste parser and prompt helper run entirely in the browser; the app never
calls an AI service.

## Stack

- React 19 + TypeScript, built with Vite. Strict TypeScript everywhere.
- UI components: Astryx (`@astryxdesign/core`, pinned versions) once the trial
  passes, with the FirstMenu theme in `ui/theme/`. Fonts are self-hosted
  (`@fontsource/figtree`); never use the Astryx CDN or Google Fonts setup.
  Trial setup (task 2): `ui/theme/ThemeRoot.tsx` wraps the app in `<Theme>`
  with `@astryxdesign/theme-neutral` plus FirstMenu color overrides in
  `ui/theme/firstmenu.css`; `ui/theme/RouterLinkProvider.tsx` makes Astryx
  links React Router links; app-only CSS variables use the `--fm-` prefix so
  they never clash with Astryx tokens. Astryx's `reset.css` is not loaded until
  every page is converted (task 13). Whether Astryx stays depends on the
  `Decision needed: Astryx trial` issue (bundle size).
- Build checks in CI: `npm run check:contrast`, `check:external`, `check:size`.
- Look up Astryx component docs with `npm run astryx -- component <Name>`.
- Static hosting on GitHub Pages at `https://ashikratnani.github.io/FirstMenu/`.
- `HashRouter` for routing. GitHub Pages has no server-side rewrites, so hash
  routes always load `index.html`.
- Vite `base` is `'/FirstMenu/'`. Do not change it; the deployed URL depends on
  it.
- State: a single React context with `useReducer`. No external state library.
- Validation: `zod` for all untrusted input (imported files, share links).
- Share links: `lz-string` (`compressToEncodedURIComponent`), data in the URL
  fragment.
- Styling: Astryx components and theme (after the trial), plus CSS modules for
  app-specific pieces (theme art, week grid). No other CSS framework or
  CSS-in-JS runtime. Before the trial: plain CSS with custom properties.
- Tests: Vitest + React Testing Library (jsdom).

## Architecture rules

- The domain is pure TypeScript with no React dependency: `domain/age.ts`,
  `domain/safety/*`, `domain/foods.ts`, `domain/plan.ts`, `domain/prep.ts`,
  `domain/grocery.ts`, `domain/share.ts`, `domain/storage.ts`. Keeping it pure
  lets the safety screen be tested exhaustively without rendering.
- Derived data (screen results, foods, prep list, grocery list) is never stored.
  Compute it from state with memoized selectors.
- The UI (`ui/pages`, `ui/components`) is a thin React layer over the domain.

## Source layout

```
src/
  domain/   types.ts, age.ts, safety/{normalize,rules,screen}.ts,
            foods.ts, plan.ts, prep.ts, grocery.ts, share.ts, storage.ts
  data/     recipes.ts (built-in recipes)
  state/    AppProvider.tsx, selectors.ts
  ui/       pages/, components/, assets/ (inline SVG), theme.css
```

## Hard rules

- No analytics, ads, third-party trackers, web fonts, or any files loaded from
  third-party hosts (Req 12.2, 12.3). The only network requests the app makes
  are for its own files.
- All illustrations are inline SVG with `aria-hidden="true"`; state is carried
  by visible text and the accessible name.
- Animations are CSS-only and disabled under `prefers-reduced-motion: reduce`.
- Meet WCAG 2.1 AA color contrast; the app must be fully keyboard-usable and
  work on screens 360 px wide and up.

## Workflow

- One branch and one PR per top-level task in `tasks.md`. See
  `.kiro/steering/workflow.md`.
- `npm run lint`, `npm test` and `npm run build` must all pass before a PR is
  marked ready. CI runs the same on every pull request.
