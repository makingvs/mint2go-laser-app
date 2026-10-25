// Kleine DOM-Helfer und gemeinsame Dialoge.
import { ICONS } from './icons';

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export function button(cls: string, html: string, onTap: (ev: PointerEvent | MouseEvent) => void, label = ''): HTMLButtonElement {
  const b = h('button', cls, html);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', onTap);
  return b;
}

/** Overlay über der ganzen Seite. close() entfernt es wieder. */
export function overlay(cls = ''): { root: HTMLDivElement; close: () => void } {
  const root = h('div', `overlay ${cls}`);
  document.body.appendChild(root);
  return { root, close: () => root.remove() };
}

/** Bestätigung ohne Text: großes Symbol, links Abbrechen, rechts Bestätigen. */
export function confirmDialog(iconHtml: string): Promise<boolean> {
  return new Promise((resolve) => {
    const o = overlay('overlay-dim');
    const card = h('div', 'confirm-card');
    const big = h('div', 'confirm-icon', iconHtml);
    const row = h('div', 'confirm-row');
    const done = (v: boolean) => {
      o.close();
      resolve(v);
    };
    row.append(
      button('big-btn no', ICONS.cross, () => done(false), 'Abbrechen'),
      button('big-btn yes', ICONS.check, () => done(true), 'Ja'),
    );
    card.append(big, row);
    o.root.append(card);
  });
}

/** Löst nach langem Druck (ohne Bewegung) aus. */
export function onLongPress(target: HTMLElement, ms: number, cb: () => void): void {
  let timer: number | undefined;
  let sx = 0;
  let sy = 0;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  target.addEventListener('pointerdown', (e) => {
    sx = e.clientX;
    sy = e.clientY;
    cancel();
    timer = window.setTimeout(() => {
      timer = undefined;
      cb();
    }, ms);
  });
  target.addEventListener('pointermove', (e) => {
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > 12) cancel();
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) target.addEventListener(ev, cancel);
}
