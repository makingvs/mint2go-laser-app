// Schriftarten für Text. "Block" ist die eigene Strichschrift (src/text.ts, Vektor). Alle anderen sind
// Webschriften unter der SIL Open Font License 1.1 (Lizenztexte in public/licenses/). Der Text wird vom
// Browser mit der Schrift gezeichnet und dann in Umrisse umgewandelt (src/trace.ts); dadurch stimmen
// Abstände, Umlaute und Überlappungen immer mit der Vorschau überein.
import type { Shape } from './geometry';
import { fitSize, grayFromRGBA, traceGray } from './trace';

export interface FontChoice {
  id: string;
  /** Anzeigename (nur für Lehrkräfte/Dokumentation, die App zeigt Schriftmuster) */
  label: string;
  /** CSS-Familienname; null = eigene Blockschrift */
  family: string | null;
  weight: number;
  /** Lizenzdatei public/licenses/font-<id>.txt (außer Block) */
  license: string | null;
  copyright?: string;
  url?: string;
}

export const FONTS: FontChoice[] = [
  { id: 'block', label: 'Block', family: null, weight: 700, license: null },
  { id: 'jost', label: 'Jost', family: 'Jost Variable', weight: 700, license: 'font-jost', copyright: 'The Jost Project Authors', url: 'https://github.com/indestructible-type/Jost' },
  { id: 'fredoka', label: 'Fredoka', family: 'Fredoka Variable', weight: 600, license: 'font-fredoka', copyright: 'The Fredoka Project Authors', url: 'https://github.com/hafontia/Fredoka-One' },
  { id: 'baloo', label: 'Baloo 2', family: 'Baloo 2 Variable', weight: 800, license: 'font-baloo', copyright: 'The Baloo 2 Project Authors', url: 'https://github.com/EkType/Baloo2' },
  { id: 'rubik', label: 'Rubik Mono One', family: 'Rubik Mono One', weight: 400, license: 'font-rubik', copyright: 'The Rubik Project Authors', url: 'https://github.com/googlefonts/rubik' },
  { id: 'bangers', label: 'Bangers', family: 'Bangers', weight: 400, license: 'font-bangers', copyright: 'The Bangers Project Authors', url: 'https://github.com/googlefonts/bangers' },
  { id: 'caveat', label: 'Caveat', family: 'Caveat Variable', weight: 700, license: 'font-caveat', copyright: 'The Caveat Project Authors', url: 'https://github.com/googlefonts/caveat' },
  { id: 'pacifico', label: 'Pacifico', family: 'Pacifico', weight: 400, license: 'font-pacifico', copyright: 'The Pacifico Project Authors', url: 'https://github.com/googlefonts/Pacifico' },
];

/** Schrift und Wortlaut eines Text-Teils; ältere Arbeiten ohne Angabe werden aus ref gelesen. */
export function textInfo(e: { kind: string; ref: string; text?: { font: string; value: string } }): { font: FontChoice; value: string } | null {
  if (e.kind !== 'text') return null;
  if (e.text) return { font: fontById(e.text.font), value: e.text.value };
  const m = /^([a-z]+):(.*)$/s.exec(e.ref);
  if (m && FONTS.some((f) => f.id === m[1])) return { font: fontById(m[1]), value: m[2] };
  return { font: FONTS[0], value: e.ref };
}

export const fontById = (id: string): FontChoice => FONTS.find((f) => f.id === id) ?? FONTS[0];

/** CSS für Vorschau/Schriftmuster. */
export const fontStyle = (f: FontChoice): string => (f.family ? `font-family:'${f.family}',sans-serif;font-weight:${f.weight}` : '');

const TRACE_PX = 360;
const MAX_CANVAS_W = 5200;

export interface FontText {
  rings: Shape;
  /** Schriftgröße in Pixeln, in der gezeichnet wurde (1 em = px Einheiten der Ringe) */
  px: number;
}

/** Text mit der Webschrift zeichnen und als Umrisse zurückgeben (Pixelkoordinaten, y nach unten). */
export async function fontTextShape(font: FontChoice, text: string): Promise<FontText> {
  if (!font.family) throw new Error('Block-Schrift hat keine Webschrift');
  const probe = `${font.weight} 100px "${font.family}"`;
  await document.fonts.load(probe, text);
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.font = probe;
  const w100 = Math.max(1, ctx.measureText(text).width);
  const px = Math.max(80, Math.min(TRACE_PX, Math.floor((100 * MAX_CANVAS_W) / (w100 + 60))));
  const spec = `${font.weight} ${px}px "${font.family}"`;
  ctx.font = spec;
  const m = ctx.measureText(text);
  const pad = Math.round(px * 0.12);
  const w = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + 2 * pad;
  const h = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 2 * pad;
  const size = fitSize(w, h, 6000);
  c.width = size.w;
  c.height = size.h;
  ctx.font = spec; // Größe setzen setzt den Kontext zurück
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size.w, size.h);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, pad + m.actualBoundingBoxLeft, pad + m.actualBoundingBoxAscent);
  const img = grayFromRGBA(ctx.getImageData(0, 0, size.w, size.h).data, size.w, size.h);
  const rings = traceGray(img, { threshold: 128, minAreaFraction: 0.00002 });
  return { rings, px };
}
