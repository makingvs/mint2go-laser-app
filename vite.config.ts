import { defineConfig } from 'vite';

// base './' : Die App läuft unter jedem Pfad (eigene Domain, Unterordner, GitHub Pages, lokaler Server).
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', target: 'es2020' },
  test: { include: ['tests/**/*.test.ts'] },
});
