// Export-Ablauf, den Editor und Galerie gemeinsam nutzen: endgültiges Netz bauen, Druckprüfung zeigen,
// Dateiart wählen, Dateiname vom Kind tippen lassen, speichern (STL/3MF).
import { h, overlay } from '../../src/dom';
import { downloadFile, saveFile } from '../../src/exporter';
import { ICONS } from '../../src/icons';
import { openSaveDialog } from '../../src/saveDialog';
import type { PrinterSettings } from './bed';
import { figureCheck } from './figure';
import { explain, openExportPanel } from './dialogs3d';
import type { Part } from './model3d';
import { MSG } from './problems3d';
import { bedCorner, buildFinal, printCheck, shareMime, to3mf, toStl } from './printExport';
import type { ExportFormat } from './storage3d';

/** Sanduhr-Fenster während einer Berechnung; close() entfernt es wieder. */
export function busyOverlay(): { close: () => void } {
  const o = overlay('overlay-dim');
  o.root.append(h('div', 'confirm-card', `<div class="spinner">${ICONS.gear}</div>`));
  return o;
}

/**
 * Liefert die gewählte Dateiart (zum Merken) oder null, wenn nichts exportiert wurde.
 * `figure`: Spielfigur – die Prüfung (30 mm, Überhang, lose Teile ...) sperrt den Export, bis alles in Ordnung ist.
 * Wenn etwas nicht geht, steht in einem Fenster, warum.
 */
export async function exportParts(parts: Part[], printer: PrinterSettings, format: ExportFormat, figure = false): Promise<ExportFormat | null> {
  const busy = busyOverlay();
  const model = await buildFinal(parts).catch(() => 'error' as const);
  busy.close();
  if (model === 'error') {
    void explain(ICONS.warn, MSG.exportBroken);
    return null;
  }
  if (!model || (figure && figureCheck(parts, model, printer.nozzle).onlyBase)) {
    void explain(ICONS.warn, figure && model ? MSG.exportBase : MSG.exportEmpty);
    return null;
  }
  const fmt = await openExportPanel(printCheck(parts, model, printer.bed, printer.nozzle), format, figure ? figureCheck(parts, model, printer.nozzle) : undefined, printer.nozzle);
  if (!fmt) return null;
  // Die Datei ist fertig, bevor der Name getippt wird: beim Tipp auf ✓ muss nur noch geteilt werden
  // (das Teilen-Menü am iPad darf nur direkt aus dem Tipp heraus geöffnet werden und verträgt keine Wartezeit davor)
  const data = fmt === 'stl' ? toStl(model, bedCorner(printer.bed)) : to3mf(model, bedCorner(printer.bed));
  openSaveDialog({
    ext: fmt,
    icon: ICONS.share,
    onSave: (name) => void saveFile(name, data, shareMime(fmt)),
    // zweite Möglichkeit, wenn das Teilen-Menü nicht klappt: Datei landet in "Dateien" und lässt sich von dort weitergeben
    onDownload: (name) => downloadFile(name, data, shareMime(fmt)),
  });
  return fmt;
}
