// Welt 1, Level 2 und 3: vom Start ins Ziel fahren und dabei auf dem Weg bleiben.
import { dist, nearestOnPolyline, pointAlong, polylineLength, roundedPath, type Pt } from '../geometry';
import { el } from '../dom';
import { burst, num, placeAt, str } from './common';
import type { GameFactory } from './types';

export const PATHS: Record<string, Pt[]> = {
  wide: roundedPath(
    [{ x: 120, y: 250 }, { x: 520, y: 250 }, { x: 680, y: 500 }, { x: 960, y: 250 }, { x: 1150, y: 590 }],
    150,
  ),
  snake: roundedPath(
    [{ x: 110, y: 175 }, { x: 1090, y: 175 }, { x: 1090, y: 335 }, { x: 190, y: 335 }, { x: 190, y: 495 }, { x: 1090, y: 495 }, { x: 1090, y: 640 }],
    70,
  ),
};

const toPoints = (pts: Pt[]): string => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

export const path: GameFactory = (ctx) => {
  const pts = PATHS[str(ctx.p, 'path')];
  const width = num(ctx.p, 'width') * ctx.scale;
  const half = width / 2;
  const total = polylineLength(pts);
  const markR = Math.max(34, half - 6);
  const start = pts[0];
  const goal = pts[pts.length - 1];

  const svg = el(
    'div',
    'path-layer',
    `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">` +
      `<polyline points="${toPoints(pts)}" fill="none" stroke="#4D597C" stroke-opacity=".55" stroke-width="${width + 16}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<polyline points="${toPoints(pts)}" fill="none" stroke="#FFF6E0" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<polyline points="${toPoints(pts)}" fill="none" stroke="#38B8E8" stroke-opacity=".7" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 16"/>` +
      `</svg>`,
  );
  ctx.area.appendChild(svg);

  const startEl = el('div', 'path-mark path-start', '<b>START</b>');
  placeAt(startEl, start.x, start.y, markR * 2);
  const goalEl = el('div', 'path-mark path-goal', '<b>ZIEL</b>');
  placeAt(goalEl, goal.x, goal.y, markR * 2);
  ctx.area.append(startEl, goalEl);

  // Münzen entlang des Wegs: nur zur Freude, gewonnen wird im Ziel
  const coins: { pt: Pt; d: HTMLElement; got: boolean }[] = [];
  for (let s = 150; s < total - 90; s += 150) {
    const pt = pointAlong(pts, s);
    const d = el('div', 'path-coin');
    placeAt(d, pt.x, pt.y, 30);
    ctx.area.appendChild(d);
    coins.push({ pt, d, got: false });
  }

  let running = false;
  let best = 0;
  ctx.progress(0, 100);

  ctx.dis.on(ctx.area, 'pointermove', (e: PointerEvent) => {
    const p = ctx.toStage(e);
    if (!running) {
      if (dist(p, start) <= markR) {
        running = true;
        best = 0;
        startEl.classList.add('on');
        goalEl.classList.add('on');
      }
      return;
    }
    const n = nearestOnPolyline(p, pts);
    if (n.d > half) {
      running = false;
      startEl.classList.remove('on');
      goalEl.classList.remove('on');
      startEl.classList.remove('shake');
      void startEl.offsetWidth; // Animation neu starten
      startEl.classList.add('shake');
      ctx.progress(0, 100);
      ctx.mistake();
      ctx.say('Ups! Fahre noch einmal vom Start los.');
      return;
    }
    if (n.along > best) {
      best = n.along;
      ctx.progress(Math.round((best / total) * 100), 100);
    }
    for (const c of coins) {
      if (!c.got && dist(p, c.pt) < 36) {
        c.got = true;
        c.d.classList.add('collected');
      }
    }
    if (dist(p, goal) <= markR) {
      burst(ctx.area, goal.x, goal.y, '#98C227', 12);
      running = false;
      ctx.progress(100, 100);
      ctx.win();
    }
  });
};
