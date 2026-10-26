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

/**
 * Dateiname aus der Eingabe: ungültige Zeichen (\ / : * ? " < > |) und Steuerzeichen entfallen,
 * Leerzeichen werden zusammengefasst, eine schon getippte Endung wird nicht verdoppelt.
 * Leere Eingabe ergibt ''.
 */
export function sanitizeFileName(input: string, ext: string): string {
  let s = String(input ?? '')
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  s = s.replace(new RegExp(`\.${ext}$`, 'i'), '').trim().slice(0, 80).trim();
  return s ? `${s}.${ext}` : '';
}
