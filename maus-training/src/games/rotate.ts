// Welt 5, Level 1 und 2: Bilder mit dem Mausrad gerade hindrehen.
//  mode "click": Mausrad DRÜCKEN (mittlere Taste) = 90 Grad weiter
//  mode "wheel": Mausrad DREHEN = 15 Grad pro Rastung
import { UPRIGHT_KINDS, uprightArt, type UprightKind } from '../art';
import { el } from '../dom';
import { normAngle, shuffle } from '../geometry';
import { burst, num, pick, placeAt, str } from './common';
import type { GameFactory } from './types';

/** Wie viele Grad dreht ein Drehschritt? */
export const STEP = { click: 90, wheel: 15 } as const;

/** Startwinkel: nie schon gerade; beim Rad mindestens 30 Grad daneben. */
export function startAngle(rng: () => number, mode: 'click' | 'wheel'): number {
  if (mode === 'click') return pick(rng, [90, 180, 270]);
  const opts: number[] = [];
  for (let a = 30; a <= 330; a += 15) opts.push(a);
  return pick(rng, opts);
}

/** Gerade, wenn der Winkel (mod 360) null ist. */
export const isUpright = (angle: number): boolean => normAngle(angle) === 0;

function layout(n: number): { x: number; y: number }[] {
  if (n === 6) return [250, 640, 1030].flatMap((x) => [270, 510].map((y) => ({ x, y })));
  if (n === 4) return [220, 500, 780, 1060].map((x) => ({ x, y: 400 }));
  const gap = 1100 / n;
  return Array.from({ length: n }, (_, i) => ({ x: 90 + gap / 2 + i * gap, y: 400 }));
}

export const rotate: GameFactory = (ctx) => {
  const mode = str(ctx.p, 'mode') === 'wheel' ? 'wheel' : 'click';
  const count = num(ctx.p, 'count');
  const size = 150 * ctx.scale;
  const spots = shuffle(ctx.rng, layout(count));
  const kinds: UprightKind[] = shuffle(ctx.rng, Array.from({ length: count }, (_, i) => UPRIGHT_KINDS[i % UPRIGHT_KINDS.length]));

  interface Item {
    el: HTMLElement;
    rotEl: HTMLElement;
    rot: number;
    done: boolean;
    x: number;
    y: number;
  }
  const items: Item[] = [];
  const byEl = new Map<HTMLElement, Item>();
  let done = 0;
  let wheelAcc = 0;
  let lastHint = 0;
  ctx.progress(0, count);

  spots.forEach((s, i) => {
    const d = el('div', 'piece rotator', '<div class="lift"><div class="rot"></div></div>');
    const rotEl = d.querySelector<HTMLElement>('.rot')!;
    rotEl.innerHTML = uprightArt(kinds[i]);
    const it: Item = { el: d, rotEl, rot: startAngle(ctx.rng, mode), done: false, x: s.x, y: s.y };
    rotEl.style.transform = `rotate(${it.rot}deg)`;
    placeAt(d, s.x, s.y, size);
    ctx.area.appendChild(d);
    items.push(it);
    byEl.set(d, it);
  });

  const hint = (text: string): void => {
    const now = performance.now();
    if (now - lastHint < 3000) return;
    lastHint = now;
    ctx.say(text);
  };

  const turn = (it: Item, deg: number): void => {
    if (it.done) return;
    it.rot += deg;
    it.rotEl.style.transform = `rotate(${it.rot}deg)`;
    if (!isUpright(it.rot)) return;
    it.done = true;
    it.el.classList.add('upright');
    burst(ctx.area, it.x, it.y, '#98C227');
    done++;
    ctx.progress(done, count);
    if (done >= count) ctx.win();
  };

  const itemOf = (e: Event): Item | undefined => byEl.get((e.target as HTMLElement).closest<HTMLElement>('.rotator') as HTMLElement);

  ctx.dis.on(ctx.area, 'mousedown', (e: MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault(); // kein Autoscroll-Kreis des Browsers
      const it = itemOf(e);
      if (!it) return;
      if (mode === 'click') turn(it, STEP.click);
      else hint('Hier hilft das Drehen des Rades!');
    } else if (mode === 'click') {
      hint('Drücke auf das Mausrad, wie auf eine Taste!');
    } else {
      hint('Drehe das Mausrad mit dem Finger!');
    }
  });
  ctx.dis.on(ctx.area, 'auxclick', (e: MouseEvent) => e.preventDefault());

  ctx.dis.on(
    ctx.area,
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();
      const it = itemOf(e);
      if (mode !== 'wheel') {
        hint('Nicht drehen – drücke auf das Mausrad!');
        return;
      }
      if (!it) {
        hint('Zeige mit dem Mauszeiger auf ein Bild und drehe dann das Rad.');
        return;
      }
      // Eine Rastung eines Mausrads = ein Schritt; Touchpads liefern viele kleine Werte
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) >= 40) {
        turn(it, wheelAcc > 0 ? STEP.wheel : -STEP.wheel);
        wheelAcc = 0;
      }
    },
    { passive: false },
  );
};
