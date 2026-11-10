import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Vitest configuration kept separate from vite.config.ts so the production
// build's Vite types and Vitest's bundled Vite types don't collide.
export default defineConfig({
  base: '/FirstMenu/',
  plugins: [react()],
  resolve: {
    // The app lazy-loads pages (src/ui/pages/routes.ts). Tests use eager
    // versions so they can query a page right after render.
    alias: [
      {
        find: /^\.\/ui\/pages\/routes$/,
        replacement: '/src/ui/pages/routes.eager.ts',
      },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // UI tests render whole pages with CSS; slow CI runners can exceed the
    // 5s default.
    testTimeout: 20000,
  },
});
