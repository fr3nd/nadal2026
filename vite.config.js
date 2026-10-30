import { defineConfig } from 'vite';

// base './' keeps asset paths relative so dist/ works from any folder or domain.
export default defineConfig({
  base: './',
  build: { target: 'es2018', assetsInlineLimit: 0 },
});
