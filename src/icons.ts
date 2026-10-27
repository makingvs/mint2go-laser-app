// Alle Symbole als Inline-SVG (keine Texte nötig für Kinder).
import { bbox, shapeArea, shapeToPath } from './geometry';
import { SHAPE_IDS, baseShape, type ShapeId } from './shapes';

const svg = (inner: string, extra = '') =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${inner}</svg>`;

export const ICONS = {
  scissors: svg('<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.2 16 19 3M15.8 16 5 3"/>'),
  pen: svg('<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/>'),
  roller: svg('<rect x="3" y="3" width="15" height="6" rx="2"/><path d="M18 6h3v6H11v3"/><rect x="9" y="15" width="4" height="6" rx="1"/>'),
  undo: svg('<path d="M7 5 3 9l4 4"/><path d="M3 9h11a6 6 0 0 1 0 12H8"/>'),
  redo: svg('<path d="M17 5l4 4-4 4"/><path d="M21 9H10a6 6 0 0 0 0 12h6"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
  copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"/>'),
  gallery: svg('<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  unlock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>'),
  arrowH: svg('<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>'),
  arrowV: svg('<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>'),
  search: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>'),
  canvas: svg('<rect x="3.500" y="3.500" width="17" height="17" rx="2.500"/><path d="M8 3.500v3M12 3.500v2M16 3.500v3M3.500 8h3M3.500 12h2M3.500 16h3"/>'),
  infinity: svg('<path d="M12 12c-2-3-3.500-4-5.500-4a4 4 0 0 0 0 8c2 0 3.500-1 5.500-4zm0 0c2 3 3.500 4 5.500 4a4 4 0 0 0 0-8c-2 0-3.500 1-5.500 4z"/>'),
  rect: svg('<rect x="3" y="6" width="18" height="12" rx="1.5"/>'),
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  contrast: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.500v17a8.500 8.500 0 0 0 0-17z" fill="currentColor"/>'),
  shapes: svg('<circle cx="7.500" cy="7.500" r="3.500"/><rect x="13.500" y="4" width="7" height="7" rx="1.200"/><path d="M7.500 13.500 11.200 20.500H3.800z"/><path d="m17 13.200 3.500 3.800-3.500 3.800-3.500-3.800z"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500v.5"/>'),
  shift: svg('<path d="M12 4 4 13h4.500v6h7v-6H20z"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  fit: svg('<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/><rect x="8.500" y="9" width="7" height="6" rx="1"/>'),
  imageUp: svg('<rect x="3" y="4" width="18" height="16" rx="2.500"/><circle cx="8.500" cy="9.500" r="1.800"/><path d="m3 17 5-4.500 4 3.500"/><path d="M17 17.500v-6M14.500 14l2.500-2.500 2.500 2.500"/>'),
  svgUp: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9.500 17.500 12 12l2.500 5.500z"/>'),
  download: svg('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/>'),
  send: svg('<path d="M3 11 21 3l-7 18-3-8z"/><path d="M11 13 21 3"/>'),
  picture: svg('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="m3 18 6-5 4 4 3-3 5 5"/>'),
  text: svg('<path d="M5 20 12 4l7 16M8 14h8"/>'),
  draw: svg('<circle cx="5" cy="18" r="1.600" fill="currentColor" stroke="none"/><path d="M5 18c5.500-.5 3.500-10 8.500-10s3.500 7 7.500 6"/>'),
  center: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>'),
  check: svg('<path d="m4 12 6 6L20 6"/>'),
  cross: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: svg('<path d="M12 4v16M4 12h16"/>'),
  back: svg('<path d="M15 5 8 12l7 7"/>'),
  warn: svg('<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18v.5"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
  rotate: svg('<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 3v5h-5"/>'),
  backspace: svg('<path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z"/><path d="m12 9 5 6M17 9l-5 6"/>'),
  space: svg('<path d="M4 10v5h16v-5"/>'),
  cloudOff: svg('<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1 0 8.5z"/><path d="M3 3l18 18"/>'),
  cloudOk: svg('<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1 0 8.5z"/><path d="m9.5 13.5 2 2 3.5-4"/>'),
  portrait: svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M19 8c2 1 3 2.500 3 4M4 16c-2-1-3-2.500-3-4"/>'),
  share: svg('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v8h14v-8"/>'),
  retry: svg('<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 3v5h-5"/>'),
};

/** Symbol einer Form: Fläche ca. gleich groß, damit Kreis, Stern und Pfeil gleich schwer wirken. */
function shapeIcon(id: ShapeId): string {
  const raw = baseShape(id);
  const b = bbox(raw);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const k = Math.min(19 / Math.max(w, h), Math.sqrt(235 / Math.max(Math.abs(shapeArea(raw)), 1e-6)));
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const d = shapeToPath(raw.map((r) => r.map(([x, y]) => [12 + (x - cx) * k, 12 + (y - cy) * k] as [number, number])), 2);
  return svg(`<path d="${d}" fill="currentColor" fill-opacity=".14" fill-rule="evenodd" stroke="none"/><path d="${d}" stroke-width="2"/>`);
}

export const SHAPE_ICONS = Object.fromEntries(SHAPE_IDS.map((id) => [id, shapeIcon(id)])) as Record<ShapeId, string>;

export const ANIMALS: { icon: string; name: string }[] = [
  { icon: '🦊', name: 'Fuchs' },
  { icon: '🐱', name: 'Katze' },
  { icon: '🐶', name: 'Hund' },
  { icon: '🐰', name: 'Hase' },
  { icon: '🐻', name: 'Bär' },
  { icon: '🦁', name: 'Löwe' },
  { icon: '🐧', name: 'Pinguin' },
  { icon: '🦉', name: 'Eule' },
  { icon: '🐸', name: 'Frosch' },
  { icon: '🐼', name: 'Panda' },
  { icon: '🐷', name: 'Schwein' },
  { icon: '🐯', name: 'Tiger' },
  { icon: '🐵', name: 'Affe' },
  { icon: '🦄', name: 'Einhorn' },
  { icon: '🐢', name: 'Schildkröte' },
  { icon: '🐙', name: 'Krake' },
];
