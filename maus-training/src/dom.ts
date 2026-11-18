// Kleine DOM-Helfer.

/** Text für innerHTML unschädlich machen (Namen kommen von Kindern). */
export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/** Sammelt Aufräum-Aufgaben (Ereignisse, Zeitgeber, Animationsschleifen) und räumt alles auf einmal weg. */
export class Disposer {
  private fns: Array<() => void> = [];
  private dead = false;

  on(target: EventTarget, type: string, fn: (e: any) => void, opts?: AddEventListenerOptions): void {
    target.addEventListener(type, fn, opts);
    this.fns.push(() => target.removeEventListener(type, fn, opts));
  }

  timeout(fn: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      if (!this.dead) fn();
    }, ms);
    this.fns.push(() => window.clearTimeout(id));
    return id;
  }

  interval(fn: () => void, ms: number): void {
    const id = window.setInterval(fn, ms);
    this.fns.push(() => window.clearInterval(id));
  }

  /** Animationsschleife; dt in Sekunden (höchstens 0,05). */
  frame(fn: (dt: number) => void): void {
    let last = performance.now();
    let id = 0;
    const loop = (t: number): void => {
      const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
      last = t;
      fn(dt);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    this.fns.push(() => cancelAnimationFrame(id));
  }

  add(fn: () => void): void {
    this.fns.push(fn);
  }

  dispose(): void {
    this.dead = true;
    for (const f of this.fns.splice(0)) f();
  }
}

/** Lange drücken (für den versteckten Lehrkraft-Bereich). Der Ring zeigt den Fortschritt. */
export function longPress(target: HTMLElement, ms: number, cb: () => void): void {
  let timer = 0;
  const cancel = (): void => {
    window.clearTimeout(timer);
    target.classList.remove('pressing');
  };
  target.addEventListener('pointerdown', () => {
    cancel();
    target.style.setProperty('--lp', ms + 'ms');
    target.classList.add('pressing');
    timer = window.setTimeout(() => {
      target.classList.remove('pressing');
      cb();
    }, ms);
  });
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) target.addEventListener(t, cancel);
}

/** Einfaches Konfetti als DOM-Teilchen (reine CSS-Animation). */
export function confetti(host: HTMLElement, count = 46): void {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#98C227', '#F0A030', '#E01070', '#38B8E8', '#3757A9', '#FFD93B'];
  const layer = el('div', 'confetti');
  for (let i = 0; i < count; i++) {
    const p = el('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 240) + 'px');
    p.style.setProperty('--rot', Math.round(360 + Math.random() * 720) + 'deg');
    p.style.animationDelay = Math.random() * 0.5 + 's';
    p.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
    if (i % 3 === 0) p.style.borderRadius = '50%';
    layer.appendChild(p);
  }
  host.appendChild(layer);
  window.setTimeout(() => layer.remove(), 3600);
}
