// Lehrkraft-Bereich der 3D-App (versteckt hinter langem Druck auf das Logo): Drucker (Bett, Düse), Standard-Dateiart,
// Export aller Arbeiten aller Kinder. Die Einstellungen gelten für dieses Gerät.
import { button, h, overlay } from '../../src/dom';
import { saveFile } from '../../src/exporter';
import { ICONS } from '../../src/icons';
import { openSaveDialog } from '../../src/saveDialog';
import { buildZip3d } from './designIO';
import { storage, type ExportFormat, type Settings } from './storage3d';

/** Häufige Drucker (Breite × Tiefe × Höhe des Bauraums in mm). */
const PRESETS: [string, number, number, number][] = [
  ['Ender 3 · 220 × 220 × 250', 220, 220, 250],
  ['Prusa MK4 · 250 × 210 × 220', 250, 210, 220],
  ['Bambu P1/A1 · 256 × 256 × 256', 256, 256, 256],
  ['Bambu A1 mini · 180 × 180 × 180', 180, 180, 180],
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

  const width = num(s.bed.width, (v) => (s.bed.width = v), 50, 1000);
  const depth = num(s.bed.depth, (v) => (s.bed.depth = v), 50, 1000);
  const height = num(s.bed.height, (v) => (s.bed.height = v), 20, 1000);
  const presets = h('div', 'presets');
  for (const [label, w, d, hh] of PRESETS) {
    presets.append(
      button('chip', label, () => {
        s.bed = { width: w, depth: d, height: hh };
        width.value = String(w);
        depth.value = String(d);
        height.value = String(hh);
      }),
    );
  }

  // Standard-Dateiart für "Alle exportieren" und die Galerie
  const formats = h('div', 'presets');
  const fmtBtns: [ExportFormat, HTMLButtonElement][] = (['stl', '3mf'] as const).map((f) => [
    f,
    button('chip' + (s.format === f ? ' active' : ''), f.toUpperCase(), () => {
      s.format = f;
      fmtBtns.forEach(([k, b]) => b.classList.toggle('active', k === f));
    }),
  ]);
  fmtBtns.forEach(([, b]) => formats.append(b));

  const hint = h(
    'p',
    'hint',
    'Das Bett legt fest, wo die rote Warnung erscheint und wie groß die Fläche ist. Die Düse (meist 0,4 mm) bestimmt, was als „zu dünn“ gilt. Diese Einstellungen gelten nur für dieses iPad. Standardwerte für alle Geräte stehen in der Datei <b>config.json</b> der App.',
  );

  // Alle Arbeiten aller Kinder als ZIP sichern
  const exportResult = h('p', 'hint');
  const exportBlock = h('div', 'tform-block');
  exportBlock.append(
    h('b', '', 'Alle Arbeiten sichern'),
    button('chip', 'Alle als ZIP exportieren', async () => {
      const [designs, profiles] = await Promise.all([storage.listAllDesigns(), storage.listProfiles()]);
      exportResult.textContent = 'Wird berechnet …';
      const zip = await buildZip3d(designs.filter((d) => d.parts.length), profiles, s, s.format).catch(() => null);
      if (!zip) {
        exportResult.textContent = 'Noch keine druckbaren Arbeiten vorhanden.';
        return;
      }
      exportResult.textContent = '';
      openSaveDialog({
        ext: 'zip',
        onSave: async (fileName) => {
          await saveFile(fileName, zip, 'application/zip');
          exportResult.textContent = 'Exportiert (ein Ordner je Kind).';
        },
      });
    }),
    exportResult,
  );

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
  head.append(button('btn', ICONS.cross, () => o.close(), 'Schließen'), h('h2', '', 'Lehrkraft-Bereich'), save);
  const form = h('div', 'tform');
  form.append(
    field('Druckbett: Breite (mm)', width),
    field('Druckbett: Tiefe (mm)', depth),
    field('Bauhöhe (mm)', height),
    presets,
    field('Düse (mm)', num(s.nozzle, (v) => (s.nozzle = v), 0.1, 2, 0.1)),
    field('Standard-Dateiart', formats),
    hint,
    exportBlock,
    reset,
  );
  panel.append(head, form);
  o.root.append(panel);
}
