import '@fontsource-variable/jost';
import './style3d.css';
import { DEFAULT_PRINTER, normalizePrinter, type PrinterSettings } from './bed';
import { View3d } from './view3d';

const app = document.getElementById('app')!;

// Kein Zoomen der Seite, kein Herunterziehen, kein Textmarkieren.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick']) {
  document.addEventListener(ev, (e) => e.preventDefault());
}
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

/** Standardwerte des Druckers aus config.json (je Gerät später im Lehrkraft-Bereich änderbar). */
async function loadPrinter(): Promise<PrinterSettings> {
  try {
    const res = await fetch('./config.json', { cache: 'no-cache' });
    return normalizePrinter(await res.json());
  } catch {
    return DEFAULT_PRINTER;
  }
}

async function start(): Promise<void> {
  const printer = await loadPrinter();
  app.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'editor3d';
  const host = document.createElement('div');
  host.className = 'view-host';
  root.append(host);

  const logo = document.createElement('div');
  logo.className = 'corner tl';
  logo.innerHTML = '<img src="./mint2go-logo.png" alt="" />';

  // Ansicht zurücksetzen (Haus-Symbol)
  const home = document.createElement('button');
  home.className = 'btn';
  home.setAttribute('aria-label', 'Ansicht zurücksetzen');
  home.innerHTML =
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>';
  const corner = document.createElement('div');
  corner.className = 'corner br';
  corner.append(home);

  root.append(logo, corner);
  app.append(root);

  const view = new View3d(host, printer.bed);
  view.addDemoCube();
  home.addEventListener('click', () => view.resetView());
}

// Offline-Betrieb: Service Worker (nur über https oder localhost verfügbar).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

void start();
