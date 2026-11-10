// Route-level code splitting (decision in issue #37, active spec Requirement
// 15.6). Each page is its own chunk, loaded the first time it is opened, so
// the first load only downloads the shell plus the page being opened.
//
// Tests import routes.eager.ts instead (vitest.config.ts aliases this file),
// so component tests can query a page synchronously right after render. Both
// files must export the same names; routes.test.ts checks this.

import { lazy } from 'react';

export const Make = lazy(() => import('./Make'));
export const Plan = lazy(() => import('./Plan'));
export const Recipes = lazy(() => import('./Recipes'));
export const RecipeDetail = lazy(() => import('./RecipeDetail'));
export const RecipeEditor = lazy(() => import('./RecipeEditor'));
export const Foods = lazy(() => import('./Foods'));
export const Prep = lazy(() => import('./Prep'));
export const Grocery = lazy(() => import('./Grocery'));
export const Share = lazy(() => import('./Share'));
export const SharedView = lazy(() => import('./SharedView'));
export const Print = lazy(() => import('./Print'));
export const Settings = lazy(() => import('./Settings'));
export const Onboarding = lazy(() => import('./Onboarding'));
export const Sources = lazy(() => import('./Sources'));
