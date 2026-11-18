// Welt 2, Level 1: Ballons steigen auf, mit der linken Maustaste platzen lassen.
import { C, balloonArt } from '../art';
import { el } from '../dom';
import { burst, num } from './common';
import type { GameFactory } from './types';

interface Balloon {
  el: HTMLElement;
  x: number;
  y: number;
  vy: number;
  phase: number;
  color: string;
  alive: boolean;
}

export const balloons: GameFactory = (ctx) => {
  const total = num(ctx.p, 'total');
  const r = num(ctx.p, 'r') * ctx.scale;
  const speed = num(ctx.p, 'speed');
  const max = num(ctx.p, 'max');
  const colors = [C.pink, C.orange, C.sky, C.green, C.blue, '#FFD93B'];
  const list: Balloon[] = [];
  const byEl = new Map<HTMLElement, Balloon>();
  let popped = 0;
  let n = 0;

  const spawn = (y0: number): void => {
    const color = colors[n++ % colors.length];
    const d = el('div', 'balloon', balloonArt(color));
    d.style.width = r * 2 + 'px';
    d.style.height = r * 2.2 + 'px';
    const b: Balloon = {
      el: d,
      x: ctx.play.x + r + 20 + ctx.rng() * (ctx.play.w - 2 * r - 40),
      y: y0,
      vy: speed * (0.8 + ctx.rng() * 0.4),
      phase: ctx.rng() * 6.28,
      color,
      alive: true,
    };
    list.push(b);
    byEl.set(d, b);
    ctx.area.appendChild(d);
    render(b);
  };

  const render = (b: Balloon): void => {
    b.el.style.transform = `translate(${b.x - r}px, ${b.y - r}px)`;
  };

  ctx.progress(0, total);
  // Zu Beginn sind schon ein paar Ballons im Bild
  for (let i = 0; i < Math.min(3, max); i++) spawn(ctx.play.y + ctx.play.h - r - i * 190);

  ctx.dis.frame((dt) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      b.y -= b.vy * dt;
      b.phase += dt * 1.6;
      b.x += Math.sin(b.phase) * 16 * dt;
      render(b);
      if (b.y < -r * 2.4) {
        b.el.remove();
        byEl.delete(b.el);
        list.splice(i, 1);
      }
    }
    if (list.length < max && ctx.rng() < dt * 1.6) spawn(ctx.play.y + ctx.play.h + r * 1.2);
  });

  ctx.dis.on(ctx.area, 'mousedown', (e: MouseEvent) => {
    if (e.button !== 0) {
      ctx.say('Nimm die linke Maustaste!');
      return;
    }
    const b = byEl.get((e.target as HTMLElement).closest<HTMLElement>('.balloon') as HTMLElement);
    if (!b || !b.alive) {
      ctx.mistake();
      return;
    }
    b.alive = false;
    b.el.classList.add('pop');
    burst(ctx.area, b.x, b.y, b.color);
    byEl.delete(b.el);
    list.splice(list.indexOf(b), 1);
    window.setTimeout(() => b.el.remove(), 260);
    popped++;
    ctx.progress(popped, total);
    if (popped >= total) ctx.win();
  });
};
