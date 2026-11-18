// Speicher auf dem Gerät (localStorage): Kinder, Sterne, Einstellungen der Lehrkraft.
import { LEVELS } from './levels';
import type { Profile } from './progress';

export const ANIMALS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐷'];
export const MAX_NAME = 14;
export const MAX_PROFILES = 30;

export type Difficulty = 'easy' | 'normal' | 'hard';
export interface Settings {
  difficulty: Difficulty;
  unlockAll: boolean;
  bigCursor: boolean;
}
export interface Data {
  v: 1;
  profiles: Profile[];
  settings: Settings;
  last?: string;
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const KEY = 'maus-training.v1';
/** Größenfaktor der Ziele je Schwierigkeit */
export const SIZE_SCALE: Record<Difficulty, number> = { easy: 1.25, normal: 1, hard: 0.8 };

export const defaultSettings = (): Settings => ({ difficulty: 'normal', unlockAll: false, bigCursor: false });

export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim();
}

function normalize(raw: unknown): Data {
  const d: Data = { v: 1, profiles: [], settings: defaultSettings() };
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const ids = new Set<string>();
  if (Array.isArray(r.profiles)) {
    for (const p of r.profiles) {
      if (!p || typeof p !== 'object') continue;
      const q = p as Record<string, unknown>;
      if (typeof q.id !== 'string' || typeof q.name !== 'string' || typeof q.animal !== 'string') continue;
      if (ids.has(q.id)) continue;
      ids.add(q.id);
      const stars: Record<number, number> = {};
      if (q.stars && typeof q.stars === 'object') {
        for (const l of LEVELS) {
          const v = (q.stars as Record<string, unknown>)[String(l.id)];
          if (typeof v === 'number' && v >= 1) stars[l.id] = Math.min(3, Math.floor(v));
        }
      }
      d.profiles.push({
        id: q.id,
        name: sanitizeName(q.name) || '?',
        animal: q.animal,
        stars,
        created: typeof q.created === 'number' ? q.created : 0,
      });
    }
  }
  const s = r.settings as Record<string, unknown> | undefined;
  if (s && typeof s === 'object') {
    if (s.difficulty === 'easy' || s.difficulty === 'normal' || s.difficulty === 'hard') d.settings.difficulty = s.difficulty;
    d.settings.unlockAll = s.unlockAll === true;
    d.settings.bigCursor = s.bigCursor === true;
  }
  if (typeof r.last === 'string' && ids.has(r.last)) d.last = r.last;
  return d;
}

export class Store {
  data: Data;

  constructor(private storage: StorageLike | null) {
    this.data = this.read();
  }

  private read(): Data {
    try {
      const raw = this.storage?.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch {
      /* kaputte Daten: neu anfangen */
    }
    return normalize(null);
  }

  private write(): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* Speicher voll oder gesperrt: Spiel läuft trotzdem weiter */
    }
  }

  get profiles(): Profile[] {
    return this.data.profiles;
  }
  get settings(): Settings {
    return this.data.settings;
  }
  profile(id: string | undefined): Profile | undefined {
    return this.data.profiles.find((p) => p.id === id);
  }
  usedAnimals(): string[] {
    return this.data.profiles.map((p) => p.animal);
  }

  addProfile(name: string, animal: string): Profile | null {
    const n = sanitizeName(name);
    if (!n || !ANIMALS.includes(animal) || this.usedAnimals().includes(animal)) return null;
    if (this.data.profiles.length >= MAX_PROFILES) return null;
    const p: Profile = {
      id: 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: n,
      animal,
      stars: {},
      created: Date.now(),
    };
    this.data.profiles.push(p);
    this.data.last = p.id;
    this.write();
    return p;
  }

  removeProfile(id: string): void {
    this.data.profiles = this.data.profiles.filter((p) => p.id !== id);
    if (this.data.last === id) delete this.data.last;
    this.write();
  }

  resetProgress(id: string): void {
    const p = this.profile(id);
    if (p) p.stars = {};
    this.write();
  }

  /** Speichert nur Verbesserungen. Gibt zurück, ob sich etwas geändert hat. */
  recordResult(id: string, levelId: number, stars: number): boolean {
    const p = this.profile(id);
    if (!p) return false;
    const s = Math.max(1, Math.min(3, Math.floor(stars)));
    if ((p.stars[levelId] ?? 0) >= s) return false;
    p.stars[levelId] = s;
    this.write();
    return true;
  }

  setLast(id: string | undefined): void {
    if (id) this.data.last = id;
    else delete this.data.last;
    this.write();
  }

  setSettings(part: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...part };
    this.write();
  }
}

export function browserStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    s.getItem(KEY);
    return s;
  } catch {
    return null;
  }
}
