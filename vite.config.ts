import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves the app from /FirstMenu/, so the build must use that base
// path. HashRouter handles client-side routing because Pages has no server-side
// rewrites (see design.md). Test (Vitest) config lives in vitest.config.ts.
export default defineConfig({
  base: '/FirstMenu/',
  plugins: [react()],
});
