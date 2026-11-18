// Reine Entscheidung "wohin wurde das Teil gelegt?" – ohne DOM, getestet in tests/drag.test.ts.
import { dist, normAngle, type Pt } from '../geometry';

export interface DropTarget {
  /** Mittelpunkt */
  x: number;
  y: number;
  /** Maße: Rechteck (Korb) oder Kreis (Loch, Durchmesser = w) */
  w: number;
  h: number;
  shape: 'rect' | 'circle';
  /** Welche Teile passen? (Form, Größe, Bildart …) */
  kind: string;
  /** Nur bei Drehaufgaben: nötiger Winkel (0/90/180/270) */
  rot?: number;
}

export interface DropPiece {
  kind: string;
  /** gesamter, mitgezählter Drehwinkel in Grad */
  rot: number;
}

export type DropResult =
  | { type: 'none' }
  | { type: 'ok'; target: number }
  | { type: 'wrong'; target: number }
  | { type: 'needsTurn'; target: number };

/** Wie weit neben einem runden Loch noch als "darauf" gilt (zusätzlich zum Radius). */
export const SLOT_REACH = 44;
export const BIN_REACH = 12;

export function hitTarget(p: Pt, targets: DropTarget[]): number {
  let best = -1;
  let bd = Infinity;
  targets.forEach((t, i) => {
    if (t.shape === 'rect') {
      const inside =
        Math.abs(p.x - t.x) <= t.w / 2 + BIN_REACH && Math.abs(p.y - t.y) <= t.h / 2 + BIN_REACH;
      if (inside) {
        const d = dist(p, t);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    } else {
      const d = dist(p, t);
      if (d <= t.w / 2 + SLOT_REACH && d < bd) {
        bd = d;
        best = i;
      }
    }
  });
  return best;
}

export function resolveDrop(center: Pt, piece: DropPiece, targets: DropTarget[]): DropResult {
  const i = hitTarget(center, targets);
  if (i < 0) return { type: 'none' };
  const t = targets[i];
  if (t.kind !== piece.kind) return { type: 'wrong', target: i };
  if (t.rot !== undefined && normAngle(piece.rot) !== normAngle(t.rot)) return { type: 'needsTurn', target: i };
  return { type: 'ok', target: i };
}

/** Plätze für n Teile in einer Reihe, gleichmäßig über die Breite verteilt (mit kleinem Versatz nach oben/unten). */
export function rowSpots(n: number, left: number, right: number, y: number, jitter: number, rng: () => number): Pt[] {
  const gap = (right - left) / n;
  return Array.from({ length: n }, (_, i) => ({
    x: left + gap / 2 + i * gap,
    y: y + (rng() - 0.5) * 2 * jitter,
  }));
}

/** Mittelpunkte für Teile in Zellen eines Korbs (von links nach rechts, dann nächste Reihe). */
export function binCell(cx: number, cy: number, index: number, perRow = 3, cell = 100): Pt {
  const col = index % perRow;
  const row = Math.floor(index / perRow);
  return { x: cx + (col - (perRow - 1) / 2) * cell, y: cy + 24 + row * cell * 0.8 };
}
