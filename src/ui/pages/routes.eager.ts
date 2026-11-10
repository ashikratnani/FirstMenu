// Eager page exports used in tests in place of routes.ts (see the alias in
// vitest.config.ts). Same names as routes.ts; routes.test.ts checks they match.

export { default as Make } from './Make';
export { default as Plan } from './Plan';
export { default as AddRecipe } from './AddRecipe';
export { default as Recipes } from './Recipes';
export { default as RecipeDetail } from './RecipeDetail';
export { default as RecipeEditor } from './RecipeEditor';
export { default as Foods } from './Foods';
export { default as Prep } from './Prep';
export { default as Grocery } from './Grocery';
export { default as Share } from './Share';
export { default as SharedView } from './SharedView';
export { default as Print } from './Print';
export { default as Settings } from './Settings';
export { default as Onboarding } from './Onboarding';
export { default as Sources } from './Sources';
