// Export-Ablauf, den Editor und Galerie gemeinsam nutzen: endgültiges Netz bauen, Druckprüfung zeigen,
// Dateiart wählen, Dateiname vom Kind tippen lassen, speichern (STL/3MF).
import { h, overlay } from '../../src/dom';
import { saveFile } from '../../src/exporter';
import { ICONS } from '../../src/icons';
import { openSaveDialog } from '../../src/saveDialog';
import type { PrinterSettings } from './bed';
import { notify, openExportPanel } from './dialogs3d';
import type { Part } from './model3d';
import { bedCorner, buildFinal, printCheck, shareMime, to3mf, toStl } from './printExport';
import type { ExportFormat } from './storage3d';

/** Sanduhr-Fenster während einer Berechnung; close() entfernt es wieder. */
export function busyOverlay(): { close: () => void } {
  const o = overlay('overlay-dim');
  o.root.append(h('div', 'confirm-card', `<div class="spinner">${ICONS.gear}</div>`));
  return o;
}

/** Liefert die gewählte Dateiart (zum Merken) oder null, wenn nichts exportiert wurde. */
export async function exportParts(parts: Part[], printer: PrinterSettings, format: ExportFormat): Promise<ExportFormat | null> {
  const busy = busyOverlay();
  const model = await buildFinal(parts).catch(() => 'error' as const);
  busy.close();
  if (!model || model === 'error') {
    notify(ICONS.warn); // nichts zu drucken oder ein Körper ist nicht in Ordnung
    return null;
  }
  const fmt = await openExportPanel(printCheck(parts, model, printer.bed, printer.nozzle), format);
  if (!fmt) return null;
  const shift = bedCorner(printer.bed);
  openSaveDialog({
    ext: fmt,
    icon: ICONS.share,
    // direkt im Tipp auf ✓: nur so darf das Teilen-Menü (iPad) geöffnet werden
    onSave: (name) => void saveFile(name, fmt === 'stl' ? toStl(model, shift) : to3mf(model, shift), shareMime(fmt)),
  });
  return fmt;
}
