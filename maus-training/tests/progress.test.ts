import { describe, expect, it } from 'vitest';
import { LEVELS, MAX_STARS, WORLDS, levelById } from '../src/levels';
import {
  allDone,
  completesWorld,
  isUnlocked,
  nextToPlay,
  starsFor,
  totalStars,
  worldDone,
  worldStars,
  type Profile,
} from '../src/progress';
import { ANIMALS, KEY, MAX_NAME, Store, sanitizeName, type StorageLike } from '../src/storage';

const kid = (stars: Record<number, number> = {}): Profile => ({ id: 'a', name: 'Mia', animal: '🐭', stars, created: 0 });

class Mem implements StorageLike {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe('Levels', () => {
  it('5 Welten mit je 3 Levels, Nummern 1..15 lückenlos', () => {
    expect(WORLDS).toHaveLength(5);
    expect(WORLDS.every((w) => w.levels.length === 3)).toBe(true);
    expect(LEVELS.map((l) => l.id)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(MAX_STARS).toBe(45);
  });

  it('jedes Level hat Titel, Satz, Spielart und stimmige Toleranzen', () => {
    for (const l of LEVELS) {
      expect(l.title.length).toBeGreaterThan(2);
      expect(l.intro.length).toBeGreaterThan(10);
      expect(l.short.length).toBeGreaterThan(5);
      expect(l.tolerance[0]).toBeLessThanOrEqual(l.tolerance[1]);
      expect(levelById(l.id)).toBe(l);
    }
  });

  it('Levels ohne mögliche Fehler haben eine Zeitwertung', () => {
    for (const l of LEVELS) {
      if (l.tolerance[1] === 0) expect(l.par, l.title).toBeDefined();
    }
  });
});

describe('Sterne', () => {
  const l = levelById(4)!; // Toleranz [3, 7]
  it('wenige Fehler = 3, mehr = 2, viele = trotzdem 1', () => {
    expect(starsFor(l, 0, 10)).toBe(3);
    expect(starsFor(l, 3, 10)).toBe(3);
    expect(starsFor(l, 4, 10)).toBe(2);
    expect(starsFor(l, 7, 10)).toBe(2);
    expect(starsFor(l, 8, 10)).toBe(1);
    expect(starsFor(l, 99, 10)).toBe(1);
  });

  it('Zeitwertung nur dort, wo es sie gibt, und sie kann nur senken', () => {
    const t = levelById(1)!; // par [30, 60]
    expect(starsFor(t, 0, 20)).toBe(3);
    expect(starsFor(t, 0, 45)).toBe(2);
    expect(starsFor(t, 0, 500)).toBe(1);
    expect(starsFor(l, 0, 9999)).toBe(3);
  });
});

describe('Freischaltung', () => {
  it('Level 1 ist offen, das nächste erst nach dem vorigen', () => {
    const p = kid();
    expect(isUnlocked(p, 1)).toBe(true);
    expect(isUnlocked(p, 2)).toBe(false);
    p.stars[1] = 1;
    expect(isUnlocked(p, 2)).toBe(true);
    expect(isUnlocked(p, 3)).toBe(false);
  });

  it('Lehrkraft kann alles freischalten', () => {
    expect(isUnlocked(kid(), 15, true)).toBe(true);
  });

  it('Welt fertig, Gesamtsterne, Weiter-Level', () => {
    const p = kid({ 1: 3, 2: 2, 3: 1 });
    expect(worldDone(p, WORLDS[0])).toBe(true);
    expect(worldStars(p, WORLDS[0])).toBe(6);
    expect(worldDone(p, WORLDS[1])).toBe(false);
    expect(totalStars(p)).toBe(6);
    expect(nextToPlay(p)?.id).toBe(4);
    expect(allDone(p)).toBe(false);
    const all = kid(Object.fromEntries(LEVELS.map((x) => [x.id, 3])));
    expect(allDone(all)).toBe(true);
    expect(nextToPlay(all)).toBeUndefined();
  });

  it('erkennt, wann ein Ergebnis eine Welt erstmals abschließt', () => {
    const before = kid({ 1: 3, 2: 2 });
    const after = kid({ 1: 3, 2: 2, 3: 1 });
    expect(completesWorld(before, after, 3)).toBe(true);
    expect(completesWorld(after, after, 3)).toBe(false); // schon vorher fertig
    expect(completesWorld(before, before, 2)).toBe(false);
  });
});

describe('Speicher', () => {
  it('Name wird gesäubert und gekürzt', () => {
    expect(sanitizeName('  Anna   Lena  ')).toBe('Anna Lena');
    expect(sanitizeName('x'.repeat(40))).toHaveLength(MAX_NAME);
    expect(sanitizeName('   ')).toBe('');
  });

  it('Kind anlegen: Tier nur einmal, Name nötig', () => {
    const s = new Store(new Mem());
    expect(s.addProfile('', ANIMALS[0])).toBeNull();
    expect(s.addProfile('Mia', 'X')).toBeNull();
    const a = s.addProfile('Mia', ANIMALS[0]);
    expect(a?.name).toBe('Mia');
    expect(s.addProfile('Ben', ANIMALS[0])).toBeNull(); // Tier vergeben
    expect(s.addProfile('Ben', ANIMALS[1])).not.toBeNull();
    expect(s.profiles).toHaveLength(2);
  });

  it('merkt nur Verbesserungen und übersteht Neuladen', () => {
    const mem = new Mem();
    const s = new Store(mem);
    const p = s.addProfile('Mia', ANIMALS[0])!;
    expect(s.recordResult(p.id, 1, 2)).toBe(true);
    expect(s.recordResult(p.id, 1, 1)).toBe(false); // schlechter -> bleibt 2
    expect(s.recordResult(p.id, 1, 3)).toBe(true);
    expect(s.recordResult('gibtsnicht', 1, 3)).toBe(false);
    s.setSettings({ difficulty: 'hard', unlockAll: true });

    const s2 = new Store(mem);
    expect(s2.profile(p.id)?.stars[1]).toBe(3);
    expect(s2.settings.difficulty).toBe('hard');
    expect(s2.settings.unlockAll).toBe(true);
    expect(s2.data.last).toBe(p.id);
  });

  it('Zurücksetzen und Löschen', () => {
    const s = new Store(new Mem());
    const p = s.addProfile('Mia', ANIMALS[0])!;
    s.recordResult(p.id, 1, 3);
    s.resetProgress(p.id);
    expect(s.profile(p.id)?.stars).toEqual({});
    s.removeProfile(p.id);
    expect(s.profiles).toHaveLength(0);
    expect(s.data.last).toBeUndefined();
  });

  it('kaputte oder fremde Daten stürzen nicht ab', () => {
    const mem = new Mem();
    mem.setItem(KEY, '{nicht json');
    expect(new Store(mem).profiles).toEqual([]);
    mem.setItem(
      KEY,
      JSON.stringify({
        profiles: [
          { id: 'a', name: 'Mia', animal: '🐭', stars: { 1: 99, 2: -3, 77: 3, x: 'y' } },
          { id: 'a', name: 'Doppelt', animal: '🐱', stars: {} },
          { name: 'ohne Id' },
          null,
        ],
        settings: { difficulty: 'wild', unlockAll: 'ja' },
        last: 'unbekannt',
      }),
    );
    const s = new Store(mem);
    expect(s.profiles).toHaveLength(1);
    expect(s.profiles[0].stars).toEqual({ 1: 3 });
    expect(s.settings.difficulty).toBe('normal');
    expect(s.settings.unlockAll).toBe(false);
    expect(s.data.last).toBeUndefined();
  });

  it('läuft auch ohne Speicher (z. B. gesperrter Browser)', () => {
    const s = new Store(null);
    const p = s.addProfile('Mia', ANIMALS[0]);
    expect(p).not.toBeNull();
    expect(s.recordResult(p!.id, 1, 3)).toBe(true);
  });

  it('Speicher, der beim Schreiben wirft, bricht das Spiel nicht ab', () => {
    const bad: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('voll');
      },
    };
    const s = new Store(bad);
    expect(() => s.addProfile('Mia', ANIMALS[0])).not.toThrow();
  });
});
