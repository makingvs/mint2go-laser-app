// Welt 2, Level 2: Zielscheiben erscheinen und verschwinden wieder – rechtzeitig anklicken.
import { targetArt } from '../art';
import { el } from '../dom';
import { placeNonOverlapping } from '../geometry';
import { burst, num, placeAt } from './common';
import type { GameFactory } from './types';

interface Target {
  el: HTMLElement;
  x: number;
  y: number;
  alive: boolean;
  timer: number;
}

export const targets: GameFactory = (ctx) => {
  const total = num(ctx.p, 'total');
  const r = num(ctx.p, 'r') * ctx.scale;
  const life = num(ctx.p, 'life') / Math.min(ctx.scale, 1.15);
  const max = num(ctx.p, 'max');
  const active: Target[] = [];
  const byEl = new Map<HTMLElement, Target>();
  let hits = 0;

  const remove = (t: Target): void => {
    t.alive = false;
    window.clearTimeout(t.timer);
    byEl.delete(t.el);
    active.splice(active.indexOf(t), 1);
  };

  const spawn = (): void => {
    if (hits + active.length >= total || active.length >= max) return;
    const [pt] = placeNonOverlapping(
      ctx.rng,
      1,
      r + 12,
      ctx.play,
      16,
      active.map((a) => ({ x: a.x, y: a.y, r: r + 12 })),
    );
    const d = el('div', 'target', targetArt() + '<div class="ring"></div>');
    d.style.setProperty('--life', life + 'ms');
    placeAt(d, pt.x, pt.y, r * 2);
    ctx.area.appendChild(d);
    const t: Target = { el: d, x: pt.x, y: pt.y, alive: true, timer: 0 };
    t.timer = window.setTimeout(() => {
      if (!t.alive) return;
      remove(t);
      d.classList.add('gone');
      window.setTimeout(() => d.remove(), 250);
      ctx.mistake();
    }, life);
    ctx.dis.add(() => window.clearTimeout(t.timer));
    active.push(t);
    byEl.set(d, t);
  };

  ctx.progress(0, total);
  spawn();
  ctx.dis.interval(spawn, 750);

  ctx.dis.on(ctx.area, 'mousedown', (e: MouseEvent) => {
    if (e.button !== 0) {
      ctx.say('Nimm die linke Maustaste!');
      return;
    }
    const t = byEl.get((e.target as HTMLElement).closest<HTMLElement>('.target') as HTMLElement);
    if (!t || !t.alive) {
      ctx.mistake();
      return;
    }
    remove(t);
    t.el.classList.add('hit');
    burst(ctx.area, t.x, t.y, '#E01070');
    window.setTimeout(() => t.el.remove(), 300);
    hits++;
    ctx.progress(hits, total);
    if (hits >= total) ctx.win();
  });
};
