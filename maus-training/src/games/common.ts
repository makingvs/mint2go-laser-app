import { mouseIcon } from '../art';
import { el } from '../dom';
import type { Rect } from '../geometry';
import type { Params } from '../levels';

/** Bereich unter der Kopfleiste, in dem Spielfiguren stehen dürfen. */
export const PLAY: Rect = { x: 30, y: 112, w: 1220, h: 588 };

export const num = (p: Params, key: string): number => Number(p[key]);
export const str = (p: Params, key: string): string => String(p[key]);

/**
 * Stellt ein Element der Größe `size` mit Mittelpunkt cx|cy auf die Fläche.
 * Bewusst per left/top und nicht per transform: Animationen mit den Einzel-Eigenschaften
 * `scale`/`translate` würden sonst die Position mitskalieren und das Element verschieben.
 */
export function placeAt(e: HTMLElement, cx: number, cy: number, size: number, h = size): void {
  e.style.position = 'absolute';
  e.style.left = cx - size / 2 + 'px';
  e.style.top = cy - h / 2 + 'px';
  e.style.width = size + 'px';
  e.style.height = h + 'px';
}

/** Kleiner Funken-Ring an einer Stelle (Treffer, Einrasten). */
export function burst(area: HTMLElement, x: number, y: number, color: string, n = 9): void {
  const b = el('div', 'burst');
  b.style.left = x + 'px';
  b.style.top = y + 'px';
  for (let i = 0; i < n; i++) {
    const s = el('i');
    s.style.setProperty('--a', (360 / n) * i + 'deg');
    s.style.background = color;
    b.appendChild(s);
  }
  area.appendChild(b);
  window.setTimeout(() => b.remove(), 650);
}

/** Kleine Maus mit Klick-Zahl neben einer Figur ("1 Klick" oder "2 Klicks"). */
export function clickBadge(clicks: 1 | 2): HTMLElement {
  const b = el('div', 'badge');
  b.innerHTML = mouseIcon(clicks === 1 ? 'click' : 'dblclick') + `<b>${clicks}×</b>`;
  return b;
}

/** Wählt zufällig ein Element. */
export const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
