// Arbeit <-> gespeicherte Form: Körper vom Typ 'mesh' haben ihr Netz im Speicher (meshStore.ts);
// beim Speichern wandert das Netz in die Arbeit, beim Laden wieder zurück in den Speicher.
import { zipDesignNames } from './names3d';
import { getMesh, putMesh } from './meshStore';
import { cloneParts, newId, type Part } from './model3d';
import type { Design, ExportFormat, StoredMesh } from './storage3d';
import { buildFinal, toStl, to3mf, bedCorner } from './printExport';
import type { PrinterSettings } from './bed';
import { makeZip, type ZipEntry } from '../../src/zip';

export function createDesign(): Design {
  const now = Date.now();
  return { id: newId(), created: now, updated: now, parts: [], meshes: {} };
}

/** Arbeit zum Speichern zusammenstellen (nur die Netze, die die Körper wirklich brauchen). */
export function packDesign(base: Pick<Design, 'id' | 'created' | 'thumb' | 'guide'>, parts: Part[], now = Date.now()): Design {
  const meshes: Record<string, StoredMesh> = {};
  for (const p of parts) {
    if (p.kind !== 'mesh' || !p.meshId || meshes[p.meshId]) continue;
    const m = getMesh(p.meshId);
    if (m) meshes[p.meshId] = { pos: Float32Array.from(m.pos), idx: Uint32Array.from(m.idx) };
  }
  return { id: base.id, created: base.created, updated: now, parts: cloneParts(parts), meshes, thumb: base.thumb, ...(base.guide ? { guide: base.guide } : {}) };
}

/** Gespeicherte Arbeit öffnen: Netze zurück in den Speicher, Körper liefern. */
export function unpackDesign(d: Design): Part[] {
  for (const [id, m] of Object.entries(d.meshes ?? {})) putMesh(id, { pos: Array.from(m.pos), idx: Array.from(m.idx) });
  return cloneParts(d.parts ?? []);
}

/**
 * ZIP mit je einem Ordner pro Kind: <Kind>/<Kind>_<Datum>_<Uhrzeit>.stl (oder .3mf).
 * Arbeiten ohne druckbaren Inhalt (leer, nur Löcher, fehlerhaftes Netz) werden übersprungen.
 */
export async function buildZip3d(
  designs: (Design & { profile: string })[],
  profiles: { id: string; name: string }[],
  printer: PrinterSettings,
  format: ExportFormat,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const items: { folder: string; when: Date; data: Uint8Array }[] = [];
  const shift = bedCorner(printer.bed);
  for (const d of designs) {
    const model = await buildFinal(unpackDesign(d)).catch(() => 'error' as const);
    if (!model || model === 'error') continue;
    items.push({
      folder: profiles.find((p) => p.id === d.profile)?.name ?? d.profile,
      when: new Date(d.updated || d.created || Date.now()),
      data: format === 'stl' ? toStl(model, shift) : to3mf(model, shift),
    });
  }
  if (!items.length) return null;
  const names = zipDesignNames(items.map((i) => ({ kind: i.folder, when: i.when })), format);
  const entries: ZipEntry[] = items.map((it, i) => ({ name: names[i], data: it.data, date: it.when }));
  return makeZip(entries);
}
