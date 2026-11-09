// Tastenkürzel der 3D-App (PC-Tastatur oder Tastatur am Tablet). Reine Zuordnung, ohne Oberfläche -> testbar.
// Strg bzw. Befehlstaste für Bearbeiten, einzelne Buchstaben und Ziffern für Werkzeuge.

export type Action3d =
  | 'undo'
  | 'redo'
  | 'copy'
  | 'paste'
  | 'duplicate'
  | 'delete'
  | 'deselect'
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'raise'
  | 'lower'
  | 'rotate'
  | 'rotateBack'
  | 'next'
  | 'prev'
  | 'body'
  | 'shapes'
  | 'draw'
  | 'text'
  | 'svg'
  | 'hole'
  | 'merge'
  | 'tilt'
  | 'mirror'
  | 'align'
  | 'center'
  | 'home'
  | 'export'
  | 'help';

type KeyInfo = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

const MOD: Record<string, Action3d> = { c: 'copy', v: 'paste', d: 'duplicate', y: 'redo', e: 'export' };

const PLAIN: Record<string, Action3d> = {
  Delete: 'delete',
  Backspace: 'delete',
  Escape: 'deselect',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  PageUp: 'raise',
  PageDown: 'lower',
  Home: 'home',
  Tab: 'next',
  '1': 'body',
  '2': 'shapes',
  '3': 'draw',
  '4': 'text',
  '5': 'svg',
  l: 'hole',
  v: 'merge',
  k: 'tilt',
  s: 'mirror',
  a: 'align',
  m: 'center',
  h: 'home',
  r: 'rotate',
  '?': 'help',
};

/** Welche Aktion gehört zu dieser Taste? null = keine (Browser-Kürzel wie Strg+R bleiben unberührt). */
export function shortcut3dFor(e: KeyInfo): Action3d | null {
  if (e.altKey) return null;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.ctrlKey || e.metaKey) {
    if (key === 'z') return e.shiftKey ? 'redo' : 'undo';
    return MOD[key] ?? null;
  }
  if (key === 'Tab' && e.shiftKey) return 'prev';
  if (key === 'r' && e.shiftKey) return 'rotateBack';
  return PLAIN[key] ?? null;
}

/**
 * Pfeiltaste -> Schritt (dx, dy) auf den Achsen des Betts, so wie es auf dem Bildschirm aussieht:
 * rechts = nach rechts im Bild, oben = von der Kamera weg. `yaw` = Blickrichtung der Kamera (orbit.ts).
 */
export function arrowDelta(action: 'left' | 'right' | 'up' | 'down', yaw: number): [number, number] {
  const right: [number, number] = [-Math.sin(yaw), Math.cos(yaw)];
  const away: [number, number] = [-Math.cos(yaw), -Math.sin(yaw)];
  const sign = action === 'left' || action === 'down' ? -1 : 1;
  const v = action === 'left' || action === 'right' ? right : away;
  const vx = v[0] * sign;
  const vy = v[1] * sign;
  return Math.abs(vx) >= Math.abs(vy) ? [Math.sign(vx), 0] : [0, Math.sign(vy)];
}

/** Liste für das Hilfe-Fenster (Taste ?): Tasten und was sie tun; `actions` zum Prüfen, dass nichts fehlt. */
export const SHORTCUT_HELP: { keys: string; text: string; actions: Action3d[] }[] = [
  { keys: 'Strg + Z', text: 'Rückgängig', actions: ['undo'] },
  { keys: 'Strg + Y  /  Strg + Umschalt + Z', text: 'Wiederholen', actions: ['redo'] },
  { keys: 'Strg + C  /  Strg + V', text: 'Kopieren / Einfügen', actions: ['copy', 'paste'] },
  { keys: 'Strg + D', text: 'Verdoppeln (Kopie)', actions: ['duplicate'] },
  { keys: 'Entf', text: 'Löschen (mit Rückfrage)', actions: ['delete'] },
  { keys: 'Esc', text: 'Auswahl aufheben', actions: ['deselect'] },
  { keys: 'Pfeiltasten', text: 'Verschieben um 1 mm (mit Umschalt 10 mm), wie im Bild', actions: ['left', 'right', 'up', 'down'] },
  { keys: 'Bild ↑  /  Bild ↓', text: 'Anheben / Absenken um 1 mm (mit Umschalt 10 mm)', actions: ['raise', 'lower'] },
  { keys: 'R  /  Umschalt + R', text: 'Drehen um 15° / zurück', actions: ['rotate', 'rotateBack'] },
  { keys: 'Tab  /  Umschalt + Tab', text: 'Nächster / vorheriger Körper', actions: ['next', 'prev'] },
  { keys: '1  2  3  4  5', text: 'Körper, Formen, Freihand, Text (Buchstabe), SVG', actions: ['body', 'shapes', 'draw', 'text', 'svg'] },
  { keys: 'L  /  V', text: 'Loch / Vereinen', actions: ['hole', 'merge'] },
  { keys: 'K  /  S  /  A', text: 'Kippen / Spiegeln / Ausrichten', actions: ['tilt', 'mirror', 'align'] },
  { keys: 'M', text: 'In die Mitte', actions: ['center'] },
  { keys: 'H  /  Pos1', text: 'Ansicht zurücksetzen', actions: ['home'] },
  { keys: 'Strg + E', text: 'Exportieren', actions: ['export'] },
  { keys: '?', text: 'Diese Liste', actions: ['help'] },
];
