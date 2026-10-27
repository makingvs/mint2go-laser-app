// Dateinamen in ZIP-Dateien der 3D-App (Ordner je Kind, Name aus Kind, Datum und Uhrzeit).
import { safeName } from '../../src/names';

const p2 = (n: number) => String(n).padStart(2, '0');

/** <Kind>/<Kind>_<Datum>_<Uhrzeit>.<ext>; gleiche Namen bekommen _2, _3 ... */
export function zipDesignNames(items: { kind: string; when: Date }[], ext: string): string[] {
  const used = new Set<string>();
  return items.map(({ kind, when }) => {
    const k = safeName(kind);
    const stamp = `${when.getFullYear()}-${p2(when.getMonth() + 1)}-${p2(when.getDate())}_${p2(when.getHours())}-${p2(when.getMinutes())}-${p2(when.getSeconds())}`;
    let name = `${k}/${k}_${stamp}.${ext}`;
    for (let i = 2; used.has(name); i++) name = `${k}/${k}_${stamp}_${i}.${ext}`;
    used.add(name);
    return name;
  });
}
