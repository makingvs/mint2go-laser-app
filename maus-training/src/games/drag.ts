// Welt 4 und Level 15: Ziehen und Ablegen (linke Taste gedrückt halten), in Level 15 zusätzlich Drehen.
//  mode "bins":     Formen in den Korb mit der gleichen Form sortieren
//  mode "slots":    Teile in das passende Loch (Form "shapes" bzw. Größe "sizes")
//  mode "rotslots": Teile erst mit dem Mausrad richtig drehen, dann ins Loch ziehen
import {
  C,
  SHAPE_KINDS,
  UPRIGHT_KINDS,
  shapeArt,
  shapeHole,
  starArt,
  uprightArt,
  uprightHole,
  type ShapeKind,
} from '../art';
import { el } from '../dom';
import { placeNonOverlapping, shuffle, type Pt } from '../geometry';
import { binCell, resolveDrop, rowSpots, type DropTarget } from './dragLogic';
import { burst, num, pick, placeAt, str } from './common';
import type { GameFactory } from './types';

interface Piece {
  el: HTMLElement;
  rotEl: HTMLElement;
  kind: string;
  size: number;
  home: Pt;
  pos: Pt;
  rot: number;
  locked: boolean;
  busy?: boolean;
}

const SHAPE_COLOR: Record<ShapeKind, string> = {
  circle: C.orange,
  square: C.sky,
  triangle: C.green,
  star: '#FFD93B',
  heart: C.pink,
  hexagon: C.blue,
};
const FREE_COLORS = [C.orange, C.sky, C.green, C.pink, C.blue, '#FFD93B'];

export const drag: GameFactory = (ctx) => {
  const mode = str(ctx.p, 'mode');
  const area = ctx.area;
  const pieces: Piece[] = [];
  const targets: DropTarget[] = [];
  const targetEls: HTMLElement[] = [];
  const filled: number[] = []; // je Ziel: wie viele liegen schon drin
  let placed = 0;
  let total = 0;
  const wheelRotates = mode === 'rotslots';

  const makePiece = (kind: string, art: string, size: number, at: Pt, rot = 0): Piece => {
    const d = el('div', 'piece draggable', '<div class="lift"><div class="rot"></div></div>');
    const rotEl = d.querySelector<HTMLElement>('.rot')!;
    rotEl.innerHTML = art;
    rotEl.style.transform = `rotate(${rot}deg)`;
    d.style.width = size + 'px';
    d.style.height = size + 'px';
    d.style.left = '0';
    d.style.top = '0';
    const pc: Piece = { el: d, rotEl, kind, size, home: { ...at }, pos: { ...at }, rot, locked: false };
    move(pc, at);
    area.appendChild(d);
    pieces.push(pc);
    return pc;
  };

  const move = (pc: Piece, p: Pt): void => {
    pc.pos = { x: p.x, y: p.y };
    pc.el.style.transform = `translate(${p.x - pc.size / 2}px, ${p.y - pc.size / 2}px)`;
  };

  /* ---------- Aufbau je Spielart ---------- */

  if (mode === 'bins') {
    const kinds: ShapeKind[] = ['circle', 'square', 'triangle'];
    const per = num(ctx.p, 'perBin');
    const size = num(ctx.p, 'r') * 2 * ctx.scale;
    kinds.forEach((k, i) => {
      const cx = 230 + i * 410;
      const cy = 585;
      const bin = el('div', 'bin', `<div class="bin-icon">${shapeHole(k)}</div>`);
      placeAt(bin, cx, cy, 340, 200);
      area.appendChild(bin);
      targets.push({ x: cx, y: cy, w: 340, h: 200, shape: 'rect', kind: k });
      targetEls.push(bin);
      filled.push(0);
    });
    const list = shuffle(ctx.rng, kinds.flatMap((k) => Array(per).fill(k) as ShapeKind[]));
    const pts = placeNonOverlapping(ctx.rng, list.length, size / 2, { x: 40, y: 120, w: 1200, h: 330 }, 14);
    list.forEach((k, i) => makePiece(k, shapeArt(k, pick(ctx.rng, FREE_COLORS)), size, pts[i]));
    total = list.length;
  } else if (mode === 'slots' && str(ctx.p, 'set') === 'shapes') {
    const n = num(ctx.p, 'count');
    const kinds = SHAPE_KINDS.slice(0, n);
    const hole = 130 * Math.min(ctx.scale, 1.15);
    const board = el('div', 'board');
    board.style.cssText = 'left:600px;top:120px;width:640px;height:580px';
    area.appendChild(board);
    const cols = [710, 920, 1130];
    const rows = [280, 520];
    kinds.forEach((k, i) => {
      const x = cols[i % 3];
      const y = rows[Math.floor(i / 3)];
      const h = el('div', 'hole', shapeHole(k));
      placeAt(h, x, y, hole);
      area.appendChild(h);
      targets.push({ x, y, w: hole, h: hole, shape: 'circle', kind: k });
      targetEls.push(h);
      filled.push(0);
    });
    const order = shuffle(ctx.rng, kinds);
    const lc = [125, 320, 495];
    const lr = [250, 470, 640];
    const spots = shuffle(ctx.rng, lr.flatMap((y) => lc.map((x) => ({ x, y }))).slice(0, order.length));
    order.forEach((k, i) => {
      const jx = (ctx.rng() - 0.5) * 30;
      const jy = (ctx.rng() - 0.5) * 20;
      makePiece(k, shapeArt(k, SHAPE_COLOR[k]), hole, { x: spots[i].x + jx, y: Math.min(660, spots[i].y + jy) });
    });
    total = kinds.length;
  } else if (mode === 'slots') {
    // Groß und klein: fünf Sterne, fünf Plätze in passender Größe (unten bündig)
    const k = Math.min(ctx.scale, 1.1);
    const sizes = [70, 95, 120, 145, 170].slice(0, num(ctx.p, 'count')).map((s) => s * k);
    const gap = 60;
    const sum = sizes.reduce((a, b) => a + b, 0) + gap * (sizes.length - 1);
    let x = (1280 - sum) / 2;
    sizes.forEach((s) => {
      const cx = x + s / 2;
      const cy = 690 - s / 2;
      const h = el('div', 'hole', shapeHole('star'));
      placeAt(h, cx, cy, s);
      area.appendChild(h);
      targets.push({ x: cx, y: cy, w: s, h: s, shape: 'circle', kind: 's' + Math.round(s) });
      targetEls.push(h);
      filled.push(0);
      x += s + gap;
    });
    const shuffled = shuffle(ctx.rng, sizes);
    const spots = rowSpots(shuffled.length, 60, 1220, 270, 40, ctx.rng);
    const colors = [C.orange, C.sky, C.green, C.pink, C.blue];
    shuffled.forEach((s, i) => makePiece('s' + Math.round(s), starArt(colors[sizes.indexOf(s) % colors.length], false), s, spots[i]));
    total = sizes.length;
  } else {
    // rotslots: erst drehen, dann ziehen
    const n = Math.min(num(ctx.p, 'count'), UPRIGHT_KINDS.length);
    const kinds = UPRIGHT_KINDS.slice(0, n);
    const size = 150 * ctx.scale;
    const slotPos = [{ x: 820, y: 270 }, { x: 1060, y: 270 }, { x: 820, y: 520 }, { x: 1060, y: 520 }];
    const partPos = shuffle(ctx.rng, [{ x: 160, y: 270 }, { x: 400, y: 270 }, { x: 160, y: 520 }, { x: 400, y: 520 }]);
    const board = el('div', 'board');
    board.style.cssText = 'left:690px;top:120px;width:500px;height:580px';
    area.appendChild(board);
    const slotRot = shuffle(ctx.rng, [0, 90, 180, 270]);
    kinds.forEach((k, i) => {
      const hole = el('div', 'hole', '<div class="rot"></div>');
      hole.querySelector<HTMLElement>('.rot')!.innerHTML = uprightHole(k);
      hole.querySelector<HTMLElement>('.rot')!.style.transform = `rotate(${slotRot[i]}deg)`;
      placeAt(hole, slotPos[i].x, slotPos[i].y, size);
      area.appendChild(hole);
      targets.push({ x: slotPos[i].x, y: slotPos[i].y, w: size, h: size, shape: 'circle', kind: k, rot: slotRot[i] });
      targetEls.push(hole);
      filled.push(0);
    });
    shuffle(ctx.rng, kinds).forEach((k, i) => {
      const t = targets.find((x) => x.kind === k)!;
      const choices = [0, 90, 180, 270].filter((a) => a !== t.rot);
      makePiece(k, uprightArt(k), size, partPos[i], pick(ctx.rng, choices));
    });
    total = kinds.length;
  }
  ctx.progress(0, total);

  /* ---------- Ziehen ---------- */

  let dragging: Piece | null = null;
  let grab: Pt = { x: 0, y: 0 };

  const pieceAt = (e: Event): Piece | undefined => {
    const d = (e.target as HTMLElement).closest<HTMLElement>('.draggable');
    return pieces.find((p) => p.el === d);
  };

  const sendHome = (pc: Piece): void => {
    pc.el.classList.add('returning');
    pc.busy = true; // während des Rückflugs nicht greifbar (sonst springt es unter dem Zeiger)
    move(pc, pc.home);
    ctx.dis.timeout(() => {
      pc.el.classList.remove('returning');
      pc.busy = false;
    }, 380);
  };

  const rotateBy = (pc: Piece, deg: number): void => {
    pc.rot += deg;
    pc.rotEl.style.transform = `rotate(${pc.rot}deg)`;
  };

  ctx.dis.on(area, 'pointerdown', (e: PointerEvent) => {
    const pc = pieceAt(e);
    if (e.button === 1) {
      e.preventDefault();
      if (pc && !pc.locked && wheelRotates) rotateBy(pc, 90);
      return;
    }
    if (!pc || pc.locked || pc.busy) return;
    if (e.button !== 0) {
      ctx.say('Halte die linke Maustaste gedrückt und ziehe!');
      return;
    }
    if (dragging) return;
    dragging = pc;
    const p = ctx.toStage(e);
    grab = { x: pc.pos.x - p.x, y: pc.pos.y - p.y };
    pc.el.classList.remove('returning');
    pc.el.classList.add('dragging');
    try {
      area.setPointerCapture(e.pointerId);
    } catch {
      /* ältere Browser: Ziehen klappt dann nur innerhalb des Fensters */
    }
  });
  ctx.dis.on(area, 'mousedown', (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault(); // kein Autoscroll-Kreis
  });
  ctx.dis.on(area, 'auxclick', (e: MouseEvent) => e.preventDefault());

  ctx.dis.on(area, 'pointermove', (e: PointerEvent) => {
    if (!dragging) return;
    const p = ctx.toStage(e);
    const x = Math.max(dragging.size / 4, Math.min(1280 - dragging.size / 4, p.x + grab.x));
    const y = Math.max(dragging.size / 4 + 90, Math.min(720 - dragging.size / 4, p.y + grab.y));
    move(dragging, { x, y });
  });

  const drop = (): void => {
    const pc = dragging;
    if (!pc) return;
    dragging = null;
    pc.el.classList.remove('dragging');
    const r = resolveDrop(pc.pos, { kind: pc.kind, rot: pc.rot }, targets);
    if (r.type === 'none') {
      sendHome(pc);
      return;
    }
    if (r.type === 'wrong') {
      ctx.mistake();
      ctx.say(mode === 'bins' ? 'Das ist der falsche Korb.' : 'Das passt hier nicht. Probiere ein anderes Loch.');
      targetEls[r.target].classList.remove('nope');
      void targetEls[r.target].offsetWidth;
      targetEls[r.target].classList.add('nope');
      sendHome(pc);
      return;
    }
    if (r.type === 'needsTurn') {
      ctx.mistake();
      ctx.say('Richtiges Loch! Dreh das Teil erst mit dem Mausrad.');
      sendHome(pc);
      return;
    }
    // richtig: einrasten
    const t = targets[r.target];
    pc.locked = true;
    pc.el.classList.add('locked');
    if (mode === 'bins') {
      const cell = binCell(t.x, t.y, filled[r.target], 3, 104);
      pc.el.classList.add('in-bin', 'returning');
      move(pc, cell);
      pc.home = cell;
    } else {
      pc.el.classList.add('returning');
      move(pc, { x: t.x, y: t.y });
      targetEls[r.target].classList.add('filled');
    }
    filled[r.target]++;
    burst(area, t.x, t.y, '#98C227');
    placed++;
    ctx.progress(placed, total);
    if (placed >= total) ctx.win();
  };

  ctx.dis.on(area, 'pointerup', drop);
  ctx.dis.on(area, 'pointercancel', drop);
  ctx.dis.on(area, 'lostpointercapture', () => {
    // Zeiger verloren (z. B. Fenster gewechselt): Teil zurücklegen, nichts zählt als Fehler
    if (!dragging) return;
    const pc = dragging;
    dragging = null;
    pc.el.classList.remove('dragging');
    sendHome(pc);
  });

  if (wheelRotates) {
    let acc = 0;
    ctx.dis.on(
      area,
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const pc = dragging ?? pieceAt(e);
        if (!pc || pc.locked) return;
        acc += e.deltaY;
        if (Math.abs(acc) >= 40) {
          rotateBy(pc, acc > 0 ? 90 : -90);
          acc = 0;
        }
      },
      { passive: false },
    );
  }
};
