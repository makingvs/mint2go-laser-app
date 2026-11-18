import type { Store } from '../storage';

export const STAGE_W = 1280;
export const STAGE_H = 720;

export interface Screen {
  el: HTMLElement;
  dispose?(): void;
}

export interface App {
  store: Store;
  /** Die feste 1280x720-Bühne (wird auf das Fenster skaliert) */
  stage: HTMLElement;
  mount(screen: Screen): void;
  showProfiles(): void;
  showMap(profileId: string): void;
  showLevel(profileId: string, levelId: number): void;
}

/** Skaliert die Bühne so, dass sie ins Fenster passt (Seitenverhältnis bleibt, Rest ist Rand). */
export function fitStage(stage: HTMLElement): void {
  const fit = (): void => {
    const s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  };
  window.addEventListener('resize', fit);
  fit();
}

/** Fenster-Koordinaten -> Bühnen-Koordinaten (1280x720), egal wie stark skaliert wird. */
export function toStage(area: HTMLElement, e: { clientX: number; clientY: number }): { x: number; y: number } {
  const r = area.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * STAGE_W) / r.width, y: ((e.clientY - r.top) * STAGE_H) / r.height };
}
