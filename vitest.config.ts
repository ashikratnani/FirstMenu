import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Vitest configuration kept separate from vite.config.ts so the production
// build's Vite types and Vitest's bundled Vite types don't collide.
export default defineConfig({
  base: '/FirstMenu/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
