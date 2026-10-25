// Darstellung von Elementen und Entwürfen als SVG-Text (Editor, Galerie, Auswahl).
import { shapeToPath, ringToPath } from './geometry';
import { worldShape, type Design, type El, type Op, type Settings, type Surface } from './model';
import { defaultSurface, isFree, surfaceShape, viewFor, type View } from './surface';

export function elementPath(e: El): string {
  const ws = worldShape(e);
  if (e.open && e.op !== 'fill') return ws.map((r) => ringToPath(r, false, 2)).join('');
  return shapeToPath(ws, 2);
}

export function elementMarkup(e: El, colors: Settings['colors'], strokePx: number, nonScaling = true): string {
  const d = elementPath(e);
  const ns = nonScaling ? ' vector-effect="non-scaling-stroke"' : '';
  const c = colors[e.op as Op];
  if (e.op === 'fill') {
    return `<path d="${d}" fill="${c}" fill-rule="evenodd" stroke="${c}" stroke-width="${strokePx}"${ns} stroke-linejoin="round"/>`;
  }
  const fill = e.open ? 'none' : c;
  const fo = e.open ? '' : e.op === 'cut' ? ' fill-opacity=".10"' : ' fill-opacity=".04"';
  return `<path d="${d}" fill="${fill}"${fo} fill-rule="evenodd" stroke="${c}" stroke-width="${strokePx}"${ns} stroke-linejoin="round" stroke-linecap="round"/>`;
}

let uid = 0;

/** Gitterlinien alle 10 mm (bei sehr großen Flächen gröber), innerhalb von [x0,x1]×[y0,y1]. */
function gridPath(x0: number, y0: number, x1: number, y1: number): string {
  const span = Math.max(x1 - x0, y1 - y0);
  const step = span <= 1000 ? 10 : span <= 5000 ? 50 : 250;
  let d = '';
  for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) d += `M${x} ${y0}V${y1}`;
  for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) d += `M${x0} ${y}H${x1}`;
  return d;
}

/** Hintergrund der Arbeitsfläche: Werkstück (mit Umriss) oder endloses Gitter. */
export function canvasBackground(view: View, surface: Surface): string {
  const grid = (x0: number, y0: number, x1: number, y1: number) =>
    `<path d="${gridPath(x0, y0, x1, y1)}" stroke="#d9bd90" stroke-width="1" vector-effect="non-scaling-stroke" opacity=".7" fill="none"/>`;
  if (isFree(surface)) {
    return `<rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" fill="#f1dcb9"/>${grid(view.x, view.y, view.x + view.w, view.y + view.h)}`;
  }
  const d = shapeToPath(surfaceShape(surface), 2);
  const id = `sf${++uid}`;
  return (
    `<rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" fill="#dfe5f0"/>` +
    `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="#f1dcb9" fill-rule="evenodd"/>` +
    `<g clip-path="url(#${id})">${grid(0, 0, surface.w, surface.h)}</g>` +
    `<path d="${d}" fill="none" stroke="#b98f55" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`
  );
}

/** Vorschaubild einer Arbeit für die Galerie. */
export function thumbnailSvg(design: Pick<Design, 'elements' | 'surface'>, s: Settings): string {
  const surface = design.surface ?? defaultSurface(s);
  const view = viewFor(surface, design.elements, null);
  const els = design.elements.map((e) => elementMarkup(e, s.colors, 1.6)).join('');
  return `<svg viewBox="${view.x} ${view.y} ${view.w} ${view.h}" preserveAspectRatio="xMidYMid meet" class="thumb">${canvasBackground(view, surface)}${els}</svg>`;
}
