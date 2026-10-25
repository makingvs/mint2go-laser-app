// Auswahl der Zeichenfläche: unendlich oder Werkstück (Rechteck, Kreis/Oval, Form, eigener Umriss) mit Maßen.
import { button, h, overlay } from './dom';
import { shapeToPath } from './geometry';
import { ICONS, SHAPE_ICONS } from './icons';
import type { Settings, Surface } from './model';
import { formatNumber, openNumpad } from './numpad';
import { storage } from './storage';
import { svgToShape } from './svgImport';
import {
  MAX_SIDE,
  MIN_SIDE,
  builtinShapeSurface,
  ellipseSurface,
  freeSurface,
  isFree,
  rectSurface,
  shapeSurface,
  surfaceShape,
} from './surface';
import type { ShapeId } from './shapes';

type Tile = 'free' | 'rect' | 'ellipse' | ShapeId | 'custom';

const TILES: { id: Tile; icon: string; label: string }[] = [
  { id: 'free', icon: ICONS.infinity, label: 'Unendlich' },
  { id: 'rect', icon: ICONS.rect, label: 'Rechteck' },
  { id: 'ellipse', icon: SHAPE_ICONS.circle, label: 'Kreis / Oval' },
  { id: 'triangle', icon: SHAPE_ICONS.triangle, label: 'Dreieck' },
  { id: 'star', icon: SHAPE_ICONS.star, label: 'Stern' },
  { id: 'heart', icon: SHAPE_ICONS.heart, label: 'Herz' },
  { id: 'custom', icon: ICONS.folder, label: 'Eigene Form' },
];

function tileOf(s: Surface): Tile {
  if (s.kind === 'free') return 'free';
  if (s.kind === 'rect') return 'rect';
  if (s.kind === 'ellipse') return 'ellipse';
  return ['triangle', 'star', 'heart'].includes(s.ref) ? (s.ref as Tile) : 'custom';
}

/**
 * Öffnet die Auswahl. current = bisherige Fläche (beim Ändern), defaults = Standardmaße der Lehrkraft.
 * onDone bekommt die gewählte Fläche; mit ✗ passiert nichts.
 */
export function openSurfaceDialog(opts: { current?: Surface; settings: Pick<Settings, 'plate'>; onDone: (s: Surface) => void }): void {
  const dlg = overlay('overlay-dim');
  const panel = h('div', 'panel surface-panel');
  const head = h('div', 'panel-head');
  const tiles = h('div', 'tiles');
  const preview = h('div', 'surface-preview');
  const dims = h('div', 'dims surface-dims');

  const def = opts.settings.plate;
  let surface: Surface = opts.current ?? rectSurface(def.width, def.height);
  let tile: Tile = tileOf(surface);
  // letzte Maße je Art merken, damit Hin-und-her-Wechseln nichts verwirft
  let w = isFree(surface) ? def.width : surface.w;
  let hh = isFree(surface) ? def.height : surface.h;
  let lock = surface.kind !== 'rect';
  let custom: Surface | null = tile === 'custom' ? surface : null;

  const build = (): Surface => {
    if (tile === 'free') return freeSurface();
    if (tile === 'rect') return rectSurface(w, hh);
    if (tile === 'ellipse') return ellipseSurface(w, hh);
    if (tile === 'custom' && custom) return { ...custom, w, h: hh };
    if (tile === 'custom') return rectSurface(w, hh);
    const b = builtinShapeSurface(tile as ShapeId);
    return { ...b, w, h: hh };
  };

  const refresh = () => {
    surface = build();
    tiles.querySelectorAll('.tile').forEach((t, i) => t.classList.toggle('active', TILES[i].id === tile));
    dims.classList.toggle('off', tile === 'free');
    wVal.textContent = formatNumber(w);
    hVal.textContent = formatNumber(hh);
    lockBtn.innerHTML = lock ? ICONS.lock : ICONS.unlock;
    lockBtn.classList.toggle('active', lock);
    if (isFree(surface)) {
      preview.innerHTML = `<div class="free-mark">${ICONS.infinity}</div>`;
    } else {
      const d = shapeToPath(surfaceShape(surface), 2);
      const m = Math.max(surface.w, surface.h) * 0.04;
      preview.innerHTML = `<svg viewBox="${-m} ${-m} ${surface.w + 2 * m} ${surface.h + 2 * m}" preserveAspectRatio="xMidYMid meet"><path d="${d}" fill="#f1dcb9" fill-rule="evenodd" stroke="#b98f55" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
    }
  };

  const choose = async (t: Tile) => {
    if (t === 'custom') {
      const picked = await pickCustom();
      if (!picked) return;
      custom = picked;
      tile = 'custom';
      w = picked.w;
      hh = picked.h;
      lock = true;
      refresh();
      return;
    }
    const prev = tile;
    tile = t;
    if (t === 'ellipse') {
      if (prev !== 'ellipse') {
        hh = w = Math.min(w, hh); // zuerst ein Kreis
        lock = true;
      }
    } else if (t === 'rect') {
      if (prev !== 'rect') lock = false;
      if (surface.kind === 'shape') {
        w = def.width;
        hh = def.height;
      }
    } else if (t !== 'free') {
      // Form mit festem Seitenverhältnis: längste Seite behalten
      const b = builtinShapeSurface(t as ShapeId, Math.max(w, hh));
      w = b.w;
      hh = b.h;
      lock = true;
    }
    refresh();
  };

  for (const t of TILES) {
    tiles.append(button('tile', t.icon, () => void choose(t.id), t.label));
  }

  const edit = async (which: 'w' | 'h') => {
    const v = await openNumpad({ icon: which === 'w' ? ICONS.arrowH : ICONS.arrowV, value: which === 'w' ? w : hh, unit: 'mm', min: MIN_SIDE, max: MAX_SIDE });
    if (v === null) return;
    const ratio = which === 'w' ? hh / w : w / hh;
    if (which === 'w') {
      w = v;
      if (lock) hh = Math.min(MAX_SIDE, Math.max(MIN_SIDE, v * ratio));
    } else {
      hh = v;
      if (lock) w = Math.min(MAX_SIDE, Math.max(MIN_SIDE, v * ratio));
    }
    refresh();
  };
  const field = (kind: 'w' | 'h', icon: string): [HTMLButtonElement, HTMLElement] => {
    const b = button('dim', `<span class="dim-ico">${icon}</span><span class="dim-val"></span><span class="dim-unit">mm</span>`, () => void edit(kind), kind === 'w' ? 'Breite' : 'Höhe');
    return [b, b.querySelector('.dim-val') as HTMLElement];
  };
  const [wBtn, wVal] = field('w', ICONS.arrowH);
  const [hBtn, hVal] = field('h', ICONS.arrowV);
  const lockBtn = button('dim lock', ICONS.lock, () => {
    lock = !lock;
    refresh();
  }, 'Seitenverhältnis');
  dims.append(wBtn, lockBtn, hBtn);

  const ok = button('btn send', ICONS.check, () => {
    dlg.close();
    opts.onDone(surface);
  }, 'Fertig');
  head.append(button('btn', ICONS.cross, () => dlg.close(), 'Schließen'), h('div', 'surface-title', ICONS.canvas), ok);
  panel.append(head, tiles, preview, dims);
  dlg.root.append(panel);
  refresh();
}

/** Eigene Form aus der Bibliothek (SVG-Umrisse, z. B. vom Lehrer hinzugefügt) wählen. */
function pickCustom(): Promise<Surface | null> {
  return new Promise((resolve) => {
    const dlg = overlay('overlay-dim');
    const panel = h('div', 'panel');
    const head = h('div', 'panel-head');
    const grid = h('div', 'pick-grid');
    const done = (s: Surface | null) => {
      dlg.close();
      resolve(s);
    };
    head.append(button('btn', ICONS.cross, () => done(null), 'Schließen'), h('div', 'surface-title', ICONS.folder));
    panel.append(head, grid);
    dlg.root.append(panel);
    grid.innerHTML = '<div class="search-msg"><div class="spinner">' + ICONS.folder + '</div></div>';
    void storage.listLibrary().then((themes) => {
      grid.innerHTML = '';
      const files = themes.flatMap((t) => t.files);
      if (!files.length) {
        grid.innerHTML = `<div class="search-msg"><div class="big-emoji">📂</div></div>`;
        return;
      }
      for (const f of files) {
        const item = button('pick-item', `<img src="${f.thumb}" alt="" draggable="false">`, async () => {
          try {
            const rings = svgToShape(await f.load());
            if (!rings.length) throw new Error('leer');
            done(shapeSurface(`lib:${f.key}`, rings, 200));
          } catch {
            item.classList.remove('shake');
            void item.offsetWidth;
            item.classList.add('shake');
          }
        }, f.name);
        grid.append(item);
      }
    });
  });
}
