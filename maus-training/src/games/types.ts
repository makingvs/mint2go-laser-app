import type { Disposer } from '../dom';
import type { Pt, Rect } from '../geometry';
import type { LevelDef, Params } from '../levels';

/** Alles, was ein Spiel von der Umgebung braucht. Spiele räumen über ctx.dis selbst auf. */
export interface GameCtx {
  /** Die Spielfläche (1280 x 720, deckt die ganze Bühne ab; oben liegt die Kopfleiste) */
  area: HTMLElement;
  level: LevelDef;
  p: Params;
  /** Größenfaktor aus der Schwierigkeit (leicht 1,25 / normal 1 / schwer 0,8) */
  scale: number;
  rng: () => number;
  /** Bereich, in dem Spielfiguren stehen dürfen (unter der Kopfleiste) */
  play: Rect;
  mistake(): void;
  progress(done: number, total: number): void;
  win(): void;
  say(text: string): void;
  toStage(e: { clientX: number; clientY: number }): Pt;
  dis: Disposer;
}

export type GameFactory = (ctx: GameCtx) => void;
