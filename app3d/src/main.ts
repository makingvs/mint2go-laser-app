import '@fontsource-variable/jost';
import './style3d.css';
import { DEFAULT_PRINTER, normalizePrinter, type PrinterSettings } from './bed';
import { Editor3d } from './editor3d';

const app = document.getElementById('app')!;

// Kein Zoomen der Seite, kein Herunterziehen, kein Textmarkieren.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick']) {
  document.addEventListener(ev, (e) => e.preventDefault());
}
document.addEventListener(
  'touchmove',
  (e) => {
    if (!(e.target as HTMLElement).closest('.left-rail')) e.preventDefault();
  },
  { passive: false },
);

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
  app.append(new Editor3d(printer).root);
}

// Offline-Betrieb: Service Worker (nur über https oder localhost verfügbar).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

void start();
