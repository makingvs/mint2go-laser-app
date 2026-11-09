// Große Zahlentastatur für Maße (statt der iPad-Tastatur, die die Fläche verschieben würde).
import { button, h, overlay } from './dom';
import { ICONS } from './icons';

export interface NumpadOptions {
  /** Symbol links neben der Zahl */
  icon: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  /** Nachkommastellen (Standard 1; z. B. 2 für Schnittbreite in mm) */
  decimals?: number;
}

/** Zahl für die Anzeige: höchstens eine Nachkommastelle, Komma als Trenner. */
export function formatNumber(n: number, decimals = 1): string {
  return String(+n.toFixed(decimals)).replace('.', ',');
}

/** Eingabe ("12,5") in eine Zahl umwandeln und in den erlaubten Bereich bringen; null bei Unsinn. */
export function parseEntry(text: string, min: number, max: number, decimals = 1): number | null {
  const v = Number(text.replace(',', '.'));
  if (!text || !Number.isFinite(v)) return null;
  const f = 10 ** decimals;
  return Math.min(max, Math.max(min, Math.round(v * f) / f));
}

/** Öffnet die Zahlentastatur; liefert die neue Zahl oder null bei Abbruch. */
export function openNumpad(o: NumpadOptions): Promise<number | null> {
  return new Promise((resolve) => {
    const dlg = overlay('overlay-dim');
    const card = h('div', 'numpad');
    const display = h('div', 'np-display');
    const dec = o.decimals ?? 1;
    let text = formatNumber(o.value, dec);
    let fresh = true; // erste Ziffer ersetzt den alten Wert
    const show = () => {
      display.innerHTML = `<span class="np-ico">${o.icon}</span><span class="np-val">${text || '0'}</span><span class="np-unit">${o.unit}</span>`;
      display.classList.toggle('fresh', fresh);
    };
    const press = (k: string) => {
      if (fresh) {
        text = '';
        fresh = false;
      }
      if (k === ',') {
        if (text.includes(',')) return;
        if (!text) text = '0';
      } else if (text === '0') text = '';
      if (text.replace(',', '').length >= 6) return;
      if (text.includes(',') && text.split(',')[1].length >= dec && k !== ',') return; // Nachkommastellen begrenzen
      text += k;
      show();
    };
    const done = (v: number | null) => {
      dlg.close();
      resolve(v);
    };
    const keys = h('div', 'np-keys');
    for (const k of ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0']) keys.append(button('key', k, () => press(k), k));
    keys.append(
      button('key', ICONS.backspace, () => {
        fresh = false;
        text = text.slice(0, -1);
        show();
      }, 'Löschen'),
    );
    const row = h('div', 'confirm-row');
    row.append(
      button('big-btn no', ICONS.cross, () => done(null), 'Abbrechen'),
      button('big-btn yes', ICONS.check, () => {
        const v = parseEntry(text, o.min, o.max, dec);
        if (v === null) {
          row.classList.remove('shake');
          void row.offsetWidth;
          row.classList.add('shake');
          return;
        }
        done(v);
      }, 'Fertig'),
    );
    card.append(display, keys, row);
    dlg.root.append(card);
    show();
  });
}
