import { defineConfig } from 'vite';

// base './' + IIFE-Bündel: dist/index.html lässt sich auch per Doppelklick (file://) öffnen,
// ohne Server. scripts/post-build.mjs macht aus dem Modul-Script ein normales defer-Script.
export default defineConfig({
  base: './',
  server: { port: 5180 },
  build: {
    outDir: 'dist',
    target: 'es2020',
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
