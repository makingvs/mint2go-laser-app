// Welten und Levels. Reine Daten – die Spiele selbst liegen in src/games/.

export type GameKind = 'hoverStars' | 'path' | 'balloons' | 'targets' | 'apples' | 'dbl' | 'drag' | 'rotate';
export type MouseKind = 'move' | 'click' | 'dblclick' | 'drag' | 'wheelclick' | 'wheelscroll' | 'wheeldrag';
export type IconKey = 'star' | 'balloon' | 'egg' | 'puzzle' | 'rocket';
export type Params = Record<string, number | string | boolean>;

export interface LevelDef {
  id: number;
  world: number;
  title: string;
  /** Satz im Startfenster */
  intro: string;
  /** Kurzer Hinweis oben im Spiel */
  short: string;
  mouse: MouseKind;
  game: GameKind;
  params: Params;
  /** Fehler, bis zu denen es 3 bzw. 2 Sterne gibt (darüber: 1 Stern, geschafft ist immer mindestens 1) */
  tolerance: [number, number];
  /** Nur für Levels ohne mögliche Fehler: Sekunden für 3 bzw. 2 Sterne */
  par?: [number, number];
}

export interface WorldDef {
  id: number;
  title: string;
  color: string;
  icon: IconKey;
  levels: LevelDef[];
}

type L = Omit<LevelDef, 'id' | 'world'>;

const w = (id: number, title: string, color: string, icon: IconKey, levels: L[], firstId: number): WorldDef => ({
  id,
  title,
  color,
  icon,
  levels: levels.map((l, i) => ({ ...l, id: firstId + i, world: id })),
});

export const WORLDS: WorldDef[] = [
  w(1, 'Zeigen & Bewegen', '#98C227', 'star', [
    {
      title: 'Sterne sammeln',
      intro: 'Bewege die Maus über die Sterne. Du musst nicht klicken!',
      short: 'Fahre über die Sterne',
      mouse: 'move',
      game: 'hoverStars',
      params: { count: 6, r: 58 },
      tolerance: [0, 0],
      par: [30, 60],
    },
    {
      title: 'Der breite Weg',
      intro: 'Fahre mit dem Mauszeiger vom Start ins Ziel. Bleib auf dem Weg!',
      short: 'Bleib auf dem Weg',
      mouse: 'move',
      game: 'path',
      params: { path: 'wide', width: 130 },
      tolerance: [2, 5],
    },
    {
      title: 'Die Schlange',
      intro: 'Dieser Weg ist schmaler. Fahre langsam und bleib auf dem Weg!',
      short: 'Bleib auf dem schmalen Weg',
      mouse: 'move',
      game: 'path',
      params: { path: 'snake', width: 84 },
      tolerance: [3, 6],
    },
  ], 1),
  w(2, 'Klicken', '#F0A030', 'balloon', [
    {
      title: 'Ballons platzen',
      intro: 'Klicke mit der linken Maustaste auf die Ballons.',
      short: 'Klicke die Ballons',
      mouse: 'click',
      game: 'balloons',
      params: { total: 10, r: 60, speed: 95, max: 5 },
      tolerance: [3, 7],
    },
    {
      title: 'Volltreffer',
      intro: 'Klicke die Zielscheiben, bevor sie verschwinden!',
      short: 'Klicke die Zielscheiben',
      mouse: 'click',
      game: 'targets',
      params: { total: 12, r: 46, life: 3400, max: 2 },
      tolerance: [3, 7],
    },
    {
      title: 'Äpfel pflücken',
      intro: 'Pflücke nur die roten Äpfel. Die Birnen bleiben hängen!',
      short: 'Nur die roten Äpfel klicken',
      mouse: 'click',
      game: 'apples',
      params: { good: 8, bad: 8, r: 48 },
      tolerance: [1, 3],
    },
  ], 4),
  w(3, 'Doppelklick', '#E01070', 'egg', [
    {
      title: 'Küken schlüpfen',
      intro: 'Klicke zweimal ganz schnell hintereinander auf ein Ei.',
      short: 'Doppelklick auf die Eier',
      mouse: 'dblclick',
      game: 'dbl',
      params: { mode: 'eggs', count: 5, r: 70 },
      tolerance: [4, 8],
    },
    {
      title: 'Schatzkisten',
      intro: 'Öffne alle Kisten mit einem Doppelklick.',
      short: 'Doppelklick auf die Kisten',
      mouse: 'dblclick',
      game: 'dbl',
      params: { mode: 'chests', count: 8, r: 52 },
      tolerance: [4, 8],
    },
    {
      title: 'Eins oder zwei?',
      intro: 'Blumen öffnen sich mit einem Klick, Eier mit zwei schnellen Klicks.',
      short: 'Blume: 1 Klick · Ei: 2 Klicks',
      mouse: 'dblclick',
      game: 'dbl',
      params: { mode: 'mix', count: 10, r: 52 },
      tolerance: [3, 6],
    },
  ], 7),
  w(4, 'Ziehen & Ablegen', '#38B8E8', 'puzzle', [
    {
      title: 'Aufräumen',
      intro: 'Halte die linke Maustaste gedrückt und ziehe jede Form in den passenden Korb.',
      short: 'Ziehe jede Form in ihren Korb',
      mouse: 'drag',
      game: 'drag',
      params: { mode: 'bins', perBin: 3, r: 50 },
      tolerance: [3, 6],
    },
    {
      title: 'Puzzle',
      intro: 'Ziehe jedes Teil in das Loch, in das es passt.',
      short: 'Ziehe jedes Teil in sein Loch',
      mouse: 'drag',
      game: 'drag',
      params: { mode: 'slots', set: 'shapes', count: 6 },
      tolerance: [3, 6],
    },
    {
      title: 'Groß und klein',
      intro: 'Ziehe die Sterne auf die passenden Plätze. Achte auf die Größe!',
      short: 'Jeder Stern passt nur auf einen Platz',
      mouse: 'drag',
      game: 'drag',
      params: { mode: 'slots', set: 'sizes', count: 5 },
      tolerance: [3, 6],
    },
  ], 10),
  w(5, 'Mausrad', '#3757A9', 'rocket', [
    {
      title: 'Auf den Kopf gestellt',
      intro: 'Drücke das Mausrad wie eine Taste: Das Bild dreht sich. Stelle alle Bilder gerade hin!',
      short: 'Aufs Mausrad drücken = drehen',
      mouse: 'wheelclick',
      game: 'rotate',
      params: { mode: 'click', count: 6 },
      tolerance: [0, 0],
      par: [60, 120],
    },
    {
      title: 'Feines Drehen',
      intro: 'Drehe das Mausrad mit dem Finger. Das Bild dreht sich ein kleines Stück. Stelle alle Bilder gerade hin!',
      short: 'Mausrad drehen = fein drehen',
      mouse: 'wheelscroll',
      game: 'rotate',
      params: { mode: 'wheel', count: 4 },
      tolerance: [0, 0],
      par: [90, 180],
    },
    {
      title: 'Dreh und zieh',
      intro: 'Drehe jedes Teil mit dem Mausrad richtig herum und ziehe es dann in sein Loch.',
      short: 'Erst drehen, dann ziehen',
      mouse: 'wheeldrag',
      game: 'drag',
      params: { mode: 'rotslots', count: 4 },
      tolerance: [3, 6],
    },
  ], 13),
];

export const LEVELS: LevelDef[] = WORLDS.flatMap((x) => x.levels);
export const MAX_STARS = LEVELS.length * 3;

export const levelById = (id: number): LevelDef | undefined => LEVELS.find((l) => l.id === id);
export const worldById = (id: number): WorldDef | undefined => WORLDS.find((x) => x.id === id);
export const nextLevel = (id: number): LevelDef | undefined => levelById(id + 1);
