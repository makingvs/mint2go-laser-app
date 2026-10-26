// Lehrkraft-Bereich (versteckt hinter langem Druck): Plattengröße, Farben, Mindestgröße,
// eigene SVG-Bilder, Export aller Arbeiten. Die Einstellungen gelten für dieses Gerät.
import { button, h, overlay } from './dom';
import { buildZip, saveFile, zipName } from './exporter';
import { openSaveDialog } from './saveDialog';
import { ICONS } from './icons';
import type { Settings } from './model';
import { storage } from './storage';
import { SET_CREDITS } from './online';

const PRESETS: [string, number, number][] = [
  ['300 × 200', 300, 200],
  ['400 × 300', 400, 300],
  ['498 × 319 (S1 maximal)', 498, 319],
  ['200 × 150', 200, 150],
];

export function openTeacher(current: Settings, onSaved: (s: Settings) => void): void {
  const o = overlay('overlay-dim');
  const panel = h('div', 'panel teacher');
  const s: Settings = JSON.parse(JSON.stringify(current));

  const field = (label: string, input: HTMLElement): HTMLElement => {
    const row = h('label', 'trow');
    row.append(h('span', '', label), input);
    return row;
  };
  const num = (value: number, onChange: (v: number) => void, min: number, max: number, step = 1) => {
    const i = h('input');
    i.type = 'number';
    i.inputMode = 'decimal';
    i.min = String(min);
    i.max = String(max);
    i.step = String(step);
    i.value = String(value);
    i.addEventListener('input', () => {
      const v = Number(i.value);
      if (Number.isFinite(v)) onChange(v);
    });
    return i;
  };
  const color = (value: string, onChange: (v: string) => void) => {
    const i = h('input');
    i.type = 'color';
    i.value = value.toLowerCase();
    i.addEventListener('input', () => onChange(i.value.toUpperCase()));
    return i;
  };

  const title = h('h2', '', 'Lehrkraft-Bereich');
  const width = num(s.plate.width, (v) => (s.plate.width = v), 20, 1000);
  const height = num(s.plate.height, (v) => (s.plate.height = v), 20, 1000);
  const presets = h('div', 'presets');
  for (const [label, w, hh] of PRESETS) {
    presets.append(
      button('chip', label, () => {
        s.plate.width = w;
        s.plate.height = hh;
        width.value = String(w);
        height.value = String(hh);
      }),
    );
  }

  const hint = h(
    'p',
    'hint',
    'Die Farben müssen für alle Dateien gleich bleiben, damit die Ebenen in xTool Creative Space jedes Mal gleich zugeordnet werden können. Diese Einstellungen gelten nur für dieses iPad. Standardwerte für alle Geräte stehen in der Datei <b>config.json</b> der App.',
  );

  // Alle Arbeiten aller Kinder als ZIP sichern
  const exportResult = h('p', 'hint');
  const exportBlock = h('div', 'tform-block');
  exportBlock.append(
    h('b', '', 'Alle Arbeiten sichern'),
    button('chip', 'Alle SVGs als ZIP exportieren', async () => {
      const [designs, profiles] = await Promise.all([storage.listAllDesigns(), storage.listProfiles()]);
      const n = designs.filter((d) => d.elements.length).length;
      if (!n) {
        exportResult.textContent = 'Noch keine Arbeiten vorhanden.';
        return;
      }
      openSaveDialog({
        defaultName: zipName('Laser-Arbeiten'),
        ext: 'zip',
        onSave: async (fileName) => {
          await saveFile(fileName, buildZip(designs, profiles, s), 'application/zip');
          exportResult.textContent = `${n} Arbeit(en) exportiert (ein Ordner je Kind).`;
        },
      });
    }),
    exportResult,
  );

  // Quellen und Lizenzen der Online-Suche
  const credits = h('div', 'tform-block');
  credits.append(h('b', '', 'Bilder-Suche im Internet (Iconify)'));
  void storage.getSearchConfig().then((cfg) => {
    const lines = cfg.sets.map((p) => {
      const c = SET_CREDITS[p];
      return c ? `${c.name} – ${c.author}, Lizenz ${c.license}` : p;
    });
    credits.append(h('p', 'hint', `Erlaubte Sammlungen: ${lines.join('; ')}. Die Suche braucht Internet; Begriffe werden vorher auf Deutsch → Englisch übersetzt und ungeeignete Begriffe gesperrt. Gewählte Bilder werden in der Arbeit gespeichert und funktionieren danach offline. Sammlungen/Ein-Aus in der Datei config.json (onlineSearch).`));
  });

  const save = button('btn send', ICONS.check, async () => {
    try {
      const saved = await storage.putSettings(s);
      onSaved(saved);
      o.close();
    } catch {
      save.classList.add('shake');
    }
  }, 'Speichern');
  const reset = button('chip', 'Standardwerte', async () => {
    const d = await storage.resetSettings();
    onSaved(d);
    o.close();
    openTeacher(d, onSaved);
  });

  const head = h('div', 'panel-head');
  head.append(button('btn', ICONS.cross, () => o.close(), 'Schließen'), title, save);
  const form = h('div', 'tform');
  form.append(
    field('Standard-Zeichenfläche: Breite (mm)', width),
    field('Standard-Zeichenfläche: Höhe (mm)', height),
    presets,
    field('Farbe Schneiden (Schere)', color(s.colors.cut, (v) => (s.colors.cut = v))),
    field('Farbe Gravieren (Stift)', color(s.colors.engrave, (v) => (s.colors.engrave = v))),
    field('Farbe Flächengravur (Farbrolle)', color(s.colors.fill, (v) => (s.colors.fill = v))),
    field('Mindestgröße / dünnste Stelle (mm)', num(s.minSize, (v) => (s.minSize = v), 0, 50, 0.5)),
    hint,
    credits,
    exportBlock,
    reset,
  );
  panel.append(head, form);
  o.root.append(panel);
}
