import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves the app from /FirstMenu/, so the build must use that base
// path. HashRouter handles client-side routing because Pages has no server-side
// rewrites (see design.md). Test (Vitest) config lives in vitest.config.ts.
export default defineConfig({
  base: '/FirstMenu/',
  plugins: [react()],
  build: {
    // scripts/size-report.mjs reads the manifest to measure what each page
    // downloads on first open (active spec Requirement 15.6).
    manifest: true,
    rollupOptions: {
      output: {
        // Built-in recipe data (src/data/recipes.ts, simpleIdeas.ts) gets its own
        // chunk so size-report.mjs can report it apart from the page budgets.
        manualChunks(id) {
          if (id.includes('/src/data/')) return 'recipe-data';
        },
      },
    },
  },
});
