// Bildschirmtastatur im deutschen Layout (QWERTZ) für Text und Bildersuche.
// Reihen wie auf einer deutschen Tastatur, gleich versetzt:
//   1 2 3 4 5 6 7 8 9 0 ß ⌫
//     Q W E R T Z U I O P Ü
//      A S D F G H J K L Ö Ä
//   ⇧ Y X C V B N M , . -
//         ! ? :  [   Leertaste   ]
// Raster: 48 Spalten = 12 Tasten à 4 Spalten; dadurch lassen sich die Reihen um halbe/Dreiviertel-Tasten versetzen.
import { button, h } from './dom';
import { ICONS } from './icons';

const COLS = 48;
const UNIT = 4;

interface KeySpec {
  ch: string;
  /** Buchstabe (reagiert auf Groß/Klein) */
  letter?: boolean;
}
interface RowSpec {
  start: number;
  keys: KeySpec[];
  lead?: 'shift';
  tail?: 'backspace' | 'space';
}

const letters = (s: string): KeySpec[] => [...s].map((ch) => ({ ch, letter: ch !== 'ß' }));
const plain = (s: string): KeySpec[] => [...s].map((ch) => ({ ch }));

export const GERMAN_ROWS: RowSpec[] = [
  { start: 0, keys: [...plain('1234567890'), { ch: 'ß' }], tail: 'backspace' },
  { start: 2, keys: letters('QWERTZUIOPÜ') },
  { start: 3, keys: letters('ASDFGHJKLÖÄ') },
  { start: 0, lead: 'shift', keys: [...letters('YXCVBNM'), ...plain(',.-')] },
  { start: 6, keys: plain('!?:'), tail: 'space' },
];

export interface KeyboardOptions {
  /** Taste gedrückt: Zeichen so, wie es auf der Taste steht (Groß/Klein beachtet) */
  onChar: (ch: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
  /** Groß-/Kleinschreibung umschaltbar (Text); sonst wird nur Kleinschreibung geliefert (Suche) */
  shift: boolean;
}

export interface Keyboard {
  el: HTMLElement;
  /** Alle Buchstabentasten alles groß oder klein beschriften */
  setUpper(upper: boolean): void;
}

export function buildKeyboard(o: KeyboardOptions): Keyboard {
  const el = h('div', 'kb');
  let upper = true;
  const letterKeys: { btn: HTMLButtonElement; ch: string }[] = [];
  const place = (b: HTMLElement, row: number, col: number, span: number) => {
    b.style.gridRow = String(row);
    b.style.gridColumn = `${col + 1} / span ${span}`;
    el.append(b);
  };
  const label = (ch: string, letter?: boolean) => (letter ? (upper ? ch.toUpperCase() : ch.toLowerCase()) : ch);
  let shiftBtn: HTMLButtonElement | null = null;

  GERMAN_ROWS.forEach((row, r) => {
    let col = row.start;
    if (row.lead === 'shift') {
      if (o.shift) {
        shiftBtn = button('key shift active', ICONS.shift, () => {
          upper = !upper;
          shiftBtn!.classList.toggle('active', upper);
          api.setUpper(upper);
          for (const k of letterKeys) k.btn.setAttribute('aria-label', k.ch);
        }, 'Groß/Klein');
        place(shiftBtn, r + 1, col, 6);
      }
      col += 6;
    }
    for (const k of row.keys) {
      const b = button('key', label(k.ch, k.letter), () => o.onChar(o.shift ? b.textContent ?? k.ch : k.ch.toLowerCase()), k.ch);
      if (k.letter) letterKeys.push({ btn: b, ch: k.ch });
      place(b, r + 1, col, UNIT);
      col += UNIT;
    }
    if (row.tail === 'backspace') place(button('key', ICONS.backspace, o.onBackspace, 'Löschen'), r + 1, col, COLS - col);
    if (row.tail === 'space') place(button('key', ICONS.space, o.onSpace, 'Leerzeichen'), r + 1, col, 20);
  });

  const api: Keyboard = {
    el,
    setUpper(u) {
      upper = u;
      for (const k of letterKeys) k.btn.textContent = label(k.ch, true);
    },
  };
  return api;
}
