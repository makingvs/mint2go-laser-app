// Export: SVG-Dateien über das Teilen-Menü (iPad: "In Dateien sichern", AirDrop, Mail …)
// oder als Download speichern; alle Arbeiten gesammelt als ZIP.
import { exportSvg } from './svgExport';
import { exportFileName } from './names';
import type { Design, Settings } from './model';
import type { Profile, StoredDesign } from './storage';
import { makeZip } from './zip';

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/** Datei dem Nutzer übergeben. Auf Touch-Geräten über das Teilen-Menü, sonst als Download. */
export async function saveFile(name: string, data: BlobPart, mime: string): Promise<SaveResult> {
  const file = new File([data], name, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.maxTouchPoints > 1 && typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      // Teilen nicht möglich: auf Download zurückfallen
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 10000);
  return 'downloaded';
}

export function saveSvg(profile: Pick<Profile, 'name'>, design: Pick<Design, 'elements'>, settings: Settings): Promise<SaveResult> {
  return saveFile(exportFileName(profile.name), exportSvg(design, settings), 'image/svg+xml');
}

/** ZIP mit je einem Ordner pro Kind: <Kind>/<Kind>_<Datum>_<Uhrzeit>.svg */
export function buildZip(designs: StoredDesign[], profiles: Pick<Profile, 'id' | 'name'>[], settings: Settings): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const used = new Set<string>();
  const entries = [];
  for (const d of designs) {
    if (!d.elements.length) continue;
    const kind = profiles.find((p) => p.id === d.profile)?.name ?? d.profile;
    const when = new Date(d.updated || d.created || Date.now());
    let name = `${kind}/${exportFileName(kind, when)}`;
    for (let i = 2; used.has(name); i++) name = `${kind}/${exportFileName(kind, when).replace(/\.svg$/, `_${i}.svg`)}`;
    used.add(name);
    entries.push({ name, data: enc.encode(exportSvg(d, settings)), date: when });
  }
  return makeZip(entries);
}

export function zipName(prefix: string, date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${prefix}_${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.zip`;
}
