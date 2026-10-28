// Fenster zum Zeichnen von Umrissen: Formen, Freihand-Skizze, Text, SVG-Datei.
// Alle liefern eine Form in der Art der Laser-App (Ringe, y nach unten); daraus macht der Editor einen Körper mit Höhe.
import { button, h, lab, overlay } from '../../src/dom';
import { FONTS, fontStyle, fontTextShape, type FontChoice } from '../../src/fonts';
import { bbox, resample, shapeToPath, smooth, type Pt, type Shape } from '../../src/geometry';
import { ICONS, SHAPE_ICONS } from '../../src/icons';
import { buildKeyboard } from '../../src/keyboard';
import { SHAPE_GROUPS, SHAPE_LABELS, baseShape, type ShapeId } from '../../src/shapes';
import { svgToShape } from '../../src/svgImport';
import { GLYPH_HEIGHT, textShape } from '../../src/text';
import { grayFromRGBA, traceGray } from '../../src/trace';
import { ICONS3D, KIND_ICONS, SPECIAL_ICONS } from './icons3d';
import type { PrintCheck } from './printExport';
import type { ExportFormat } from './storage3d';
import { KIND_LABELS, PART_KINDS, type PartKind } from './mesh';

// ---------- Körper ----------
/** Sonderkörper neben den Grundkörpern: Röhre und Zahnrad */
export type SpecialKind = 'tube' | 'gear';

/** Auswahl der Körper (Würfel, Kugel, ..., Röhre, Zahnrad); liefert die Art oder null. */
export function openKindPicker(): Promise<PartKind | SpecialKind | null> {
  return new Promise((resolve) => {
    const o = overlay('overlay-dim');
    const panel = h('div', 'panel kind-panel');
    const done = (v: PartKind | SpecialKind | null) => {
      o.close();
      resolve(v);
    };
    const head = h('div', 'panel-head');
    head.append(button('btn', ICONS.cross, () => done(null), 'Schließen'));
    const grid = h('div', 'kind-grid');
    for (const k of PART_KINDS) grid.append(button('btn labeled tool', lab(KIND_ICONS[k], KIND_LABELS[k]), () => done(k), KIND_LABELS[k]));
    grid.append(
      button('btn labeled tool', lab(SPECIAL_ICONS.tube, 'Röhre'), () => done('tube'), 'Röhre'),
      button('btn labeled tool', lab(SPECIAL_ICONS.gear, 'Zahnrad'), () => done('gear'), 'Zahnrad'),
    );
    panel.append(head, grid);
    o.root.append(panel);
    o.root.addEventListener('click', (e) => {
      if (e.target === o.root) done(null);
    });
  });
}

// ---------- Formen ----------
/** Auswahl der fertigen Formen; liefert die Form oder null (zugetippt). */
export function openShapePicker(): Promise<{ id: ShapeId; shape: Shape } | null> {
  return new Promise((resolve) => {
    const o = overlay('overlay-dim');
    const panel = h('div', 'panel shape-panel');
    const head = h('div', 'panel-head');
    head.append(button('btn', ICONS.cross, () => done(null), 'Schließen'));
    const done = (v: { id: ShapeId; shape: Shape } | null) => {
      o.close();
      resolve(v);
    };
    const groups = h('div', 'shape-groups');
    for (const g of SHAPE_GROUPS) {
      const grid = h('div', 'shape-grid');
      for (const id of g.ids) grid.append(button('btn tool', SHAPE_ICONS[id], () => done({ id, shape: baseShape(id) }), SHAPE_LABELS[id]));
      groups.append(grid);
    }
    panel.append(head, groups);
    o.root.append(panel);
    o.root.addEventListener('click', (e) => {
      if (e.target === o.root) done(null);
    });
  });
}

// ---------- Freihand-Skizze ----------
const PAD_W = 120; // Zeichenfläche in "mm" (die Größe wird später im Editor festgelegt)
const PAD_H = 80;
const PX = 4; // Pixel pro mm beim Umwandeln in Umrisse
const LINE_WIDTHS = [4, 8, 14];

interface Stroke {
  pts: Pt[];
  line: boolean; // true = dicke Linie, false = ausgefüllte Fläche
  width: number;
}

function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale: number, style: 'screen' | 'trace'): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const s of strokes) {
    if (s.pts.length === 0) continue;
    ctx.beginPath();
    s.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * scale, y * scale) : ctx.lineTo(x * scale, y * scale)));
    if (s.line) {
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * scale + 0.01, s.pts[0][1] * scale);
      ctx.lineWidth = s.width * scale;
      ctx.strokeStyle = style === 'trace' ? '#000' : '#3757a9';
      ctx.stroke();
    } else {
      ctx.closePath();
      ctx.fillStyle = style === 'trace' ? '#000' : 'rgba(152,194,39,0.65)';
      ctx.fill();
      ctx.lineWidth = (style === 'trace' ? 1 : 1.5) * scale; // sehr dünne Krakel bekommen etwas Breite
      ctx.strokeStyle = style === 'trace' ? '#000' : '#7aa01a';
      ctx.stroke();
    }
  }
}

/** Freihand-Skizze: Flächen und dicke Linien zeichnen; Ergebnis = alle Striche zu Umrissen vereint (Einheit mm, y nach unten). */
export function openSketch(): Promise<Shape | null> {
  return new Promise((resolve) => {
    const o = overlay('overlay-dim');
    const panel = h('div', 'panel sketch-panel');
    const strokes: Stroke[] = [];
    let current: Stroke | null = null;
    let line = false;
    let width = LINE_WIDTHS[1];

    const canvas = h('canvas', 'sketch-pad');
    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    const render = () => {
      const ctx = canvas.getContext('2d')!;
      const k = canvas.width / PAD_W;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#e3e8f1';
      ctx.lineWidth = Math.max(1, k * 0.15);
      ctx.beginPath();
      for (let x = 10; x < PAD_W; x += 10) {
        ctx.moveTo(x * k, 0);
        ctx.lineTo(x * k, PAD_H * k);
      }
      for (let y = 10; y < PAD_H; y += 10) {
        ctx.moveTo(0, y * k);
        ctx.lineTo(PAD_W * k, y * k);
      }
      ctx.stroke();
      drawStrokes(ctx, current ? [...strokes, current] : strokes, k, 'screen');
      ok.disabled = strokes.length === 0;
      undo.disabled = strokes.length === 0;
    };

    const at = (e: PointerEvent): Pt => {
      const r = canvas.getBoundingClientRect();
      return [Math.min(PAD_W, Math.max(0, ((e.clientX - r.left) / r.width) * PAD_W)), Math.min(PAD_H, Math.max(0, ((e.clientY - r.top) / r.height) * PAD_H))];
    };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      current = { pts: [at(e)], line, width };
      render();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!current) return;
      const p = at(e);
      const last = current.pts[current.pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.4) return;
      current.pts.push(p);
      render();
    });
    const finish = () => {
      if (!current) return;
      let pts = current.pts;
      if (pts.length > 2) pts = smooth(resample(pts, 1.2, false), 3, false); // Zittern glätten
      strokes.push({ ...current, pts });
      current = null;
      render();
    };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);

    const done = (v: Shape | null) => {
      o.close();
      resolve(v);
    };
    const ok = button('btn key-ok', ICONS.check, () => {
      // Alle Striche in Schwarz-Weiß zeichnen und die Umrisse nachfahren (vereint Überlappungen, erhält Löcher)
      const c = document.createElement('canvas');
      c.width = PAD_W * PX;
      c.height = PAD_H * PX;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      drawStrokes(ctx, strokes, PX, 'trace');
      const rings = traceGray(grayFromRGBA(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height), { threshold: 128, minAreaFraction: 0.00002 });
      done(rings.length ? rings.map((r) => r.map(([x, y]) => [x / PX, y / PX] as Pt)) : null);
    }, 'Fertig');
    ok.disabled = true;
    const undo = button('btn', ICONS.undo, () => {
      strokes.pop();
      render();
    }, 'Letzten Strich zurück');
    const clear = button('btn danger', ICONS.trash, () => {
      strokes.length = 0;
      render();
    }, 'Alles löschen');

    // Stift: Fläche oder Linie in drei Breiten
    const tools = h('div', 'sketch-tools');
    const toolBtns: { btn: HTMLButtonElement; line: boolean; width: number }[] = [];
    const mark = () => toolBtns.forEach((t) => t.btn.classList.toggle('active', t.line === line && (!line || t.width === width)));
    const dot = (r: number) => `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="${r}" fill="currentColor"/></svg>`;
    const addTool = (html: string, isLine: boolean, w: number, label: string) => {
      const b = button('btn tool', html, () => {
        line = isLine;
        width = w;
        mark();
      }, label);
      toolBtns.push({ btn: b, line: isLine, width: w });
      tools.append(b);
    };
    addTool(ICONS.roller, false, 0, 'Fläche');
    LINE_WIDTHS.forEach((w, i) => addTool(dot(3 + i * 3), true, w, 'Linie'));
    mark();

    const head = h('div', 'panel-head');
    head.append(button('btn', ICONS.cross, () => done(null), 'Schließen'), tools, h('div', 'spacer'), undo, clear, ok);
    panel.append(head, canvas);
    o.root.append(panel);
    sizeCanvas();
    render();
    new ResizeObserver(() => {
      sizeCanvas();
      render();
    }).observe(canvas);
  });
}

// ---------- Text ----------
export interface TextResult {
  shape: Shape;
  /** Millimeter pro Einheit der Form (Großbuchstaben ca. 15 mm hoch) */
  scale: number;
}

const MAX_TEXT = 12;

async function buildText(text: string, font: FontChoice): Promise<TextResult | null> {
  if (!font.family) {
    const shape = textShape(text);
    return shape.length ? { shape, scale: 15 / GLYPH_HEIGHT } : null;
  }
  const busy = overlay('overlay-dim');
  busy.root.append(h('div', 'confirm-card', `<div class="spinner">${ICONS.text}</div>`));
  try {
    const ft = await fontTextShape(font, text);
    return ft.rings.length ? { shape: ft.rings, scale: 21 / ft.px } : null; // 1 em = 21 mm
  } catch {
    return null;
  } finally {
    busy.close();
  }
}

/** Text eintippen (Bildschirmtastatur) und Schrift wählen. */
export function openTextDialog(): Promise<TextResult | null> {
  return new Promise((resolve) => {
    const o = overlay('overlay-dim');
    const panel = h('div', 'panel text-panel');
    const preview = h('div', 'text-preview');
    const fontRow = h('div', 'font-row');
    let text = '';
    let font = FONTS[0];
    const close = (v: TextResult | null) => {
      o.close();
      resolve(v);
    };
    const ok = button('btn key-ok', ICONS.check, () => {
      const t = text.trim();
      const f = font;
      o.close();
      void buildText(t, f).then(resolve);
    }, 'Fertig');

    const refresh = () => {
      if (!font.family) {
        const rings = textShape(text);
        if (rings.length) {
          const b = bbox(rings);
          const vb = `${b.minX - 1} ${b.minY - 1} ${b.maxX - b.minX + 2} ${b.maxY - b.minY + 2}`;
          preview.innerHTML = `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet"><path d="${shapeToPath(rings, 2)}" fill="#333" fill-rule="evenodd"/></svg>`;
        } else preview.innerHTML = '<span class="cursor"></span>';
        ok.disabled = !rings.length;
      } else {
        preview.innerHTML = '';
        if (text) {
          const span = h('span', 'font-preview');
          span.setAttribute('style', fontStyle(font));
          span.textContent = text;
          preview.append(span);
          let size = 64;
          span.style.fontSize = `${size}px`;
          while (span.scrollWidth > preview.clientWidth - 24 && size > 18) {
            size -= 4;
            span.style.fontSize = `${size}px`;
          }
        } else preview.innerHTML = '<span class="cursor"></span>';
        ok.disabled = !text.trim();
      }
    };

    const chips: HTMLButtonElement[] = [];
    for (const f of FONTS) {
      const sample = f.family ? `<span style="${fontStyle(f)}">Abc</span>` : `<svg viewBox="-1 -1 22 10" preserveAspectRatio="xMidYMid meet"><path d="${shapeToPath(textShape('ABC'), 2)}" fill="currentColor" fill-rule="evenodd"/></svg>`;
      const chip = button('font-chip' + (f === font ? ' active' : ''), sample, () => {
        font = f;
        chips.forEach((c, i) => c.classList.toggle('active', FONTS[i] === f));
        refresh();
      }, f.label);
      chips.push(chip);
      fontRow.append(chip);
    }

    const press = (ch: string) => {
      if (text.length < MAX_TEXT) text += ch;
      refresh();
    };
    const keyboard = buildKeyboard({
      shift: true,
      onChar: press,
      onSpace: () => press(' '),
      onBackspace: () => {
        text = text.slice(0, -1);
        refresh();
      },
    });

    const head = h('div', 'panel-head');
    head.append(button('btn', ICONS.cross, () => close(null), 'Schließen'), preview, ok);
    panel.append(head, fontRow, keyboard.el);
    o.root.append(panel);
    refresh();
  });
}

// ---------- SVG-Datei ----------
/** Dateiauswahl für eine SVG-Datei; ruft onShape mit der Form auf (onBad, wenn nichts Brauchbares darin ist). */
export function pickSvg(onShape: (shape: Shape) => void, onBad: () => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.svg,image/svg+xml';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const shape = svgToShape(await file.text());
      if (shape.length) onShape(shape);
      else onBad();
    } catch {
      onBad();
    }
  });
  input.click();
}

// ---------- Export: Druckprüfung und Dateiart ----------
export type { ExportFormat };

/**
 * Druckprüfung ohne Text: je Prüfung ein Symbol mit grünem Haken (in Ordnung) oder orangem Warnzeichen,
 * dazu die Wahl STL / 3MF. Warnungen sperren nichts. Liefert die Dateiart oder null (Abbrechen).
 */
export function openExportPanel(check: PrintCheck, initial: ExportFormat): Promise<ExportFormat | null> {
  return new Promise((resolve) => {
    const o = overlay('overlay-dim');
    const panel = h('div', 'panel export-panel');
    let fmt = initial;
    const done = (v: ExportFormat | null) => {
      o.close();
      resolve(v);
    };
    const cards = h('div', 'chk-row');
    const card = (icon: string, warn: boolean, label: string) => {
      const c = h('div', `chk ${warn ? 'warn' : 'ok'}`, `<span class="chk-ico">${icon}</span><span class="badge">${warn ? ICONS.warn : ICONS.check}</span>`);
      c.setAttribute('role', 'img');
      c.setAttribute('aria-label', label + (warn ? ': Achtung' : ': in Ordnung'));
      cards.append(c);
    };
    card(ICONS3D.bed, check.outside, 'Bauraum');
    card(ICONS3D.lift, check.floating, 'Schwebt');
    card(ICONS3D.thin, check.thin, 'Dünne Stellen');

    const fmts = h('div', 'fmt-row');
    const chips: [ExportFormat, HTMLButtonElement][] = (['stl', '3mf'] as const).map((f) => [
      f,
      button('fmt-chip' + (f === fmt ? ' active' : ''), f.toUpperCase(), () => {
        fmt = f;
        chips.forEach(([k, b]) => b.classList.toggle('active', k === f));
      }, f.toUpperCase()),
    ]);
    chips.forEach(([, b]) => fmts.append(b));

    const head = h('div', 'panel-head');
    head.append(button('btn', ICONS.cross, () => done(null), 'Abbrechen'), h('div', 'spacer'), button('btn send', ICONS.check, () => done(fmt), 'Weiter'));
    panel.append(head, cards, fmts);
    o.root.append(panel);
  });
}

/** Kurzer Hinweis ohne Text: großes Symbol, verschwindet von selbst oder beim Antippen. */
export function notify(iconHtml: string): void {
  const o = overlay('overlay-dim');
  o.root.append(h('div', 'confirm-card', `<div class="confirm-icon">${iconHtml}</div>`));
  const close = () => o.close();
  o.root.addEventListener('click', close);
  setTimeout(close, 1800);
}
