import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// 3D-Druck-App: eigener Build nach dist/3d/ (neben der Laser-App). Zuerst "vite build" der Laser-App
// (leert dist/), danach dieser Build. base './' : läuft unter jedem Pfad.
export default defineConfig({
  root: fileURLToPath(new URL('./app3d', import.meta.url)),
  base: './',
  server: { host: true, port: 5174 },
  build: { outDir: fileURLToPath(new URL('./dist/3d', import.meta.url)), emptyOutDir: true, target: 'es2020' },
});
