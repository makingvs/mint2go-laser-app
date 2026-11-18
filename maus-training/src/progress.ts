// Fortschritt, Freischaltung und Sterne – reine Logik, getestet in tests/progress.test.ts.
import { LEVELS, WORLDS, levelById, type LevelDef, type WorldDef } from './levels';

export interface Profile {
  id: string;
  name: string;
  animal: string;
  /** Beste Sternzahl (1–3) je Level-Nummer */
  stars: Record<number, number>;
  created: number;
}

/** 3 Sterne bei wenigen Fehlern, sonst 2, sonst 1. Fertig werden gibt immer mindestens 1 Stern. */
export function starsFor(level: LevelDef, mistakes: number, seconds: number): number {
  let s = mistakes <= level.tolerance[0] ? 3 : mistakes <= level.tolerance[1] ? 2 : 1;
  if (level.par) {
    const byTime = seconds <= level.par[0] ? 3 : seconds <= level.par[1] ? 2 : 1;
    s = Math.min(s, byTime);
  }
  return s;
}

export const starsOf = (p: Profile, levelId: number): number => p.stars[levelId] ?? 0;

/** Level 1 ist immer offen, jedes weitere, wenn das vorige geschafft ist. */
export function isUnlocked(p: Profile, levelId: number, unlockAll = false): boolean {
  if (unlockAll || levelId <= 1) return true;
  return starsOf(p, levelId - 1) >= 1;
}

export const totalStars = (p: Profile): number => LEVELS.reduce((n, l) => n + starsOf(p, l.id), 0);
export const worldStars = (p: Profile, w: WorldDef): number => w.levels.reduce((n, l) => n + starsOf(p, l.id), 0);
export const worldDone = (p: Profile, w: WorldDef): boolean => w.levels.every((l) => starsOf(p, l.id) >= 1);
export const allDone = (p: Profile): boolean => WORLDS.every((w) => worldDone(p, w));

/** Das erste noch nicht geschaffte, freigeschaltete Level (für den Weiter-Hinweis auf der Karte). */
export function nextToPlay(p: Profile): LevelDef | undefined {
  return LEVELS.find((l) => starsOf(p, l.id) === 0 && isUnlocked(p, l.id));
}

/** Schließt dieses Ergebnis eine Welt erstmals ab? */
export function completesWorld(before: Profile, after: Profile, levelId: number): boolean {
  const l = levelById(levelId);
  if (!l) return false;
  const w = WORLDS.find((x) => x.id === l.world);
  return !!w && !worldDone(before, w) && worldDone(after, w);
}
