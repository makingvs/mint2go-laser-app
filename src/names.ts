// Dateinamen für Export und Ordner.

/** Macht aus beliebigem Text einen sicheren Datei-/Ordnernamen. */
export function safeName(text: string, fallback = 'Kind'): string {
  const s = String(text ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}_ -]/gu, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40);
  return s || fallback;
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** <Kindname>_<Datum>_<Uhrzeit>.svg */
export function exportFileName(kind: string, date: Date = new Date()): string {
  const d = `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
  const t = `${p2(date.getHours())}-${p2(date.getMinutes())}-${p2(date.getSeconds())}`;
  return `${safeName(kind)}_${d}_${t}.svg`;
}

/** Emoji am Anfang eines Themennamens ("🐾 Tiere") abtrennen. */
export function splitThemeName(name: string): { icon: string; name: string } {
  const m = /^(\p{Extended_Pictographic}️?)\s*(.*)$/u.exec(name);
  return m ? { icon: m[1], name: m[2] || name } : { icon: '🖼️', name };
}
