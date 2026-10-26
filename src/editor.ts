// Die Arbeitsfläche: Formen setzen, verschieben, drehen, skalieren, zeichnen, exportieren.
import { storage, type Profile } from './storage';
import { openTraceDialog } from './imageDialog';
import { saveSvg } from './exporter';
import { openSaveDialog } from './saveDialog';
import { exportFileName } from './names';
import { svgToShape } from './svgImport';
import { bbox, dist, resample, shapeToPath, simplify, smooth, transformPoint, type Pt, type Ring, type Shape } from './geometry';
import { ICONS, SHAPE_ICONS } from './icons';
import { History, isTooThin, makeElement, newId, normalizeBase, pickElement, type Design, type El, type Op, type Settings, type Surface, worldShape } from './model';
import { canvasBackground, elementMarkup } from './render';
import { MAX_ZOOM, defaultSurface, isFree, isOutside, surfaceKey, surfaceSize, viewFor, zoomedView, type View } from './surface';
import { openSurfaceDialog } from './surfaceDialog';
import { SHAPE_GROUPS, SHAPE_LABELS, baseShape, type ShapeId } from './shapes';
import { GLYPH_HEIGHT, textShape } from './text';
import { FONTS, fontStyle, fontTextShape, textInfo, type FontChoice } from './fonts';
import { button, confirmDialog, h, lab, onLongPress, overlay } from './dom';
import { openTeacher } from './teacher';
import { cdLineMarkup } from './decor';
import { formatNumber, openNumpad } from './numpad';
import { openOnlineSearch } from './onlineSearch';

export interface EditorOpts {
  profile: Profile;
  design: Design;
  settings: Settings;
  saved: boolean;
  onExit: () => void;
}

type Gesture =
  | { t: 'move'; id: string; start: Pt; ox: number; oy: number }
  | { t: 'scale'; id: string; c: Pt; d0: number; w0: number; h0: number }
  | { t: 'rotate'; id: string; c: Pt; a0: number; rot0: number }
  | { t: 'pinch'; id: string; d0: number; a0: number; m0: Pt; w0: number; h0: number; rot0: number; x0: number; y0: number }
  | { t: 'draw'; pts: Pt[] }
  | { t: 'pan'; sx: number; sy: number; c0: Pt; k0: number };

const OP_ICON: Record<Op, string> = { cut: ICONS.scissors, engrave: ICONS.pen, fill: ICONS.roller };
const OP_LABEL: Record<Op, string> = { cut: 'Schneiden', engrave: 'Gravieren', fill: 'Fläche gravieren' };
const OP_SHORT: Record<Op, string> = { cut: 'Schneiden', engrave: 'Gravieren', fill: 'Füllen' };

export class Editor {
  readonly root = h('div', 'editor');
  private svg!: SVGSVGElement;
  private history: History;
  private selectedId: string | null = null;
  private currentOp: Op = 'cut';
  private drawMode = false;
  private gesture: Gesture | null = null;
  private pointers = new Map<number, Pt>();
  private changed = false;
  private raf = 0;
  private thinCache = new Map<string, boolean>();
  private outsideCache = new Map<string, boolean>();
  private view!: View;
  private zoom = 1;
  private zoomCenter: Pt | null = null;
  private zoomLabel!: HTMLElement;
  private saveTimer = 0;
  private dirty = false;
  private everSaved: boolean;
  private nextOffset = 0;
  private btn: Record<string, HTMLButtonElement> = {};
  private status!: HTMLElement;
  private stage!: HTMLElement;
  private dims!: HTMLElement;
  private dimVal: Record<'w' | 'h' | 'rot', HTMLElement> = {} as never;
  private lockAspect = true;
  private lockBtn!: HTMLButtonElement;
  private onResize = () => this.render();
  private onHide = () => {
    if (document.visibilityState === 'hidden') void this.saveNow();
  };

  constructor(private o: EditorOpts) {
    this.everSaved = o.saved;
    if (!o.design.surface) o.design.surface = defaultSurface(o.settings);
    this.history = new History(o.design.elements);
    this.view = viewFor(o.design.surface, o.design.elements, null);
    this.build();
    this.setStatus(storage.persistent);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
    requestAnimationFrame(() => this.render());
  }

  private get els(): El[] {
    return this.o.design.elements;
  }
  private set els(v: El[]) {
    this.o.design.elements = v;
  }
  private get settings(): Settings {
    return this.o.settings;
  }
  private get surface(): Surface {
    return this.o.design.surface!;
  }
  /** Kantenlänge für Standardgrößen neuer Teile (kleinere Seite der Zeichenfläche). */
  private baseSize(): number {
    const a = surfaceSize(this.surface);
    return Math.min(a.w, a.h);
  }
  /** Bereich, in dem der Mittelpunkt eines Teils liegen darf. */
  private bounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const s = this.surface;
    if (isFree(s)) return { minX: this.view.x, maxX: this.view.x + this.view.w, minY: this.view.y, maxY: this.view.y + this.view.h };
    return { minX: 0, maxX: s.w, minY: 0, maxY: s.h };
  }
  /** Sichtbereich neu berechnen (bei unendlicher Fläche wächst er mit dem Inhalt). */
  private updateView(): void {
    this.view = viewFor(this.surface, this.els, this.view);
  }
  private get selected(): El | null {
    return this.els.find((e) => e.id === this.selectedId) ?? null;
  }

  // ---------- Aufbau ----------
  private build(): void {
    const top = h('div', 'topbar');
    const left = h('div', 'top-group');
    this.btn.gallery = button('btn labeled', lab(ICONS.gallery, 'Galerie'), () => void this.exit(), 'Galerie');
    this.btn.undo = button('btn labeled', lab(ICONS.undo, 'Zurück'), () => this.undo(), 'Rückgängig');
    this.btn.redo = button('btn labeled', lab(ICONS.redo, 'Vor'), () => this.redo(), 'Wiederholen');
    this.btn.surface = button('btn labeled', lab(ICONS.canvas, 'Fläche'), () => this.changeSurface(), 'Zeichenfläche');
    left.append(this.btn.gallery, this.btn.undo, this.btn.redo, this.btn.surface);

    const center = h('div', 'top-center');
    this.status = h('div', 'status', ICONS.cloudOk);
    center.append(this.status);
    onLongPress(center, 1500, () =>
      openTeacher(this.settings, (s) => {
        this.o.settings = s;
        this.thinCache.clear();
        this.updateView();
        this.setViewBox();
        this.render();
      }),
    );

    const right = h('div', 'top-group');
    this.btn.dup = button('btn labeled', lab(ICONS.copy, 'Kopie'), () => this.duplicate(), 'Kopieren');
    this.btn.del = button('btn labeled danger', lab(ICONS.trash, 'Löschen'), () => void this.remove(), 'Löschen');
    this.btn.export = button('btn labeled send', lab(ICONS.download, 'Export'), () => void this.exportNow(), 'Exportieren');
    this.btn.font = button('btn labeled', lab(ICONS.text, 'Schrift'), () => this.editText(), 'Schrift ändern');
    right.append(this.btn.font, this.btn.dup, this.btn.del, this.btn.export);
    top.append(left, center, right, h('div', 'cd-wrap top-line', cdLineMarkup()));

    const body = h('div', 'editor-body');
    const rail = h('div', 'rail left-rail');
    const group = (accent: string, ...items: HTMLElement[]): HTMLElement => {
      const g = h('div', 'rail-group');
      g.style.setProperty('--g', accent);
      g.append(...items);
      return g;
    };
    const pickFile = (accept: string, onFile: (f: File) => void): HTMLInputElement => {
      const input = h('input');
      input.type = 'file';
      input.accept = accept;
      input.hidden = true;
      input.addEventListener('change', () => {
        const f = input.files?.[0];
        input.value = '';
        if (f) onFile(f);
      });
      this.root.append(input);
      return input;
    };
    // Gruppe 1: Formen (alle in einer Auswahl) und Freihand direkt darunter
    this.btn.shapes = button('btn labeled tool', lab(ICONS.shapes, 'Formen'), () => this.openShapes(), 'Formen');
    this.btn.draw = button('btn labeled tool', lab(ICONS.draw, 'Freihand'), () => this.toggleDraw(), 'Zeichnen');
    // Gruppe 2: Bilder (hochladen, SVG, Suche im Internet)
    const imageInput = pickFile('image/*', (f) => void this.importImage(f));
    const svgInput = pickFile('.svg,image/svg+xml', (f) => void this.importSvg(f));
    this.btn.image = button('btn labeled tool', lab(ICONS.imageUp, 'Bild'), () => imageInput.click(), 'Bild hochladen');
    this.btn.svgfile = button('btn labeled tool', lab(ICONS.svgUp, 'SVG'), () => svgInput.click(), 'SVG hochladen');
    this.btn.search = button('btn labeled tool', lab(ICONS.search, 'Suche'), () => this.openSearch(), 'Suchen');
    this.btn.search.hidden = true;
    void storage.getSearchConfig().then((c) => {
      this.btn.search.hidden = !c.enabled;
    });
    // Gruppe 3: Text
    rail.append(
      group('var(--m-green)', this.btn.shapes, this.btn.draw),
      group('var(--m-blue)', this.btn.image, this.btn.svgfile, this.btn.search),
      group('var(--m-pink)', button('btn labeled tool', lab(ICONS.text, 'Text'), () => this.openText(), 'Text')),
    );

    this.stage = h('div', 'stage');
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'canvas');
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.stage.append(this.svg, this.buildDims());
    this.setViewBox();
    this.svg.addEventListener('pointerdown', (e) => this.pointerDown(e));
    this.svg.addEventListener('pointermove', (e) => this.pointerMove(e));
    this.svg.addEventListener('pointerup', (e) => this.pointerUp(e));
    this.svg.addEventListener('pointercancel', (e) => this.pointerUp(e));

    const opRail = h('div', 'rail right-rail');
    for (const op of ['cut', 'engrave', 'fill'] as Op[]) {
      const b = button(`btn labeled op op-${op}`, lab(OP_ICON[op], OP_SHORT[op]), () => this.setOp(op), OP_LABEL[op]);
      this.btn[`op-${op}`] = b;
      opRail.append(b);
    }
    const zoomBox = h('div', 'zoom-box');
    this.btn.zoomIn = button('btn labeled zoom', lab(ICONS.plus, 'Größer'), () => this.zoomBy(1.5), 'Vergrößern');
    this.btn.zoomOut = button('btn labeled zoom', lab(ICONS.minus, 'Kleiner'), () => this.zoomBy(1 / 1.5), 'Verkleinern');
    this.btn.zoomFit = button('btn labeled zoom', lab(ICONS.fit, 'Alles'), () => this.zoomFit(), 'Ganze Fläche');
    this.zoomLabel = h('div', 'zoom-label');
    zoomBox.append(this.btn.zoomIn, this.btn.zoomOut, this.btn.zoomFit, this.zoomLabel);
    opRail.append(zoomBox);
    body.append(rail, this.stage, opRail);
    this.root.append(top, body);
  }

  /** Leiste unter der Fläche: Breite, Höhe (mm), Seitenverhältnis sperren, Drehung. */
  private buildDims(): HTMLElement {
    this.dims = h('div', 'dims');
    const field = (kind: 'w' | 'h' | 'rot', icon: string, unit: string, label: string) => {
      const b = button('dim', `<span class="dim-ico">${icon}</span><span class="dim-val"></span><span class="dim-unit">${unit}</span>`, () => void this.editDim(kind), label);
      this.dimVal[kind] = b.querySelector('.dim-val') as HTMLElement;
      return b;
    };
    this.lockBtn = button('dim lock active', ICONS.lock, () => {
      this.lockAspect = !this.lockAspect;
      this.lockBtn.innerHTML = this.lockAspect ? ICONS.lock : ICONS.unlock;
      this.lockBtn.classList.toggle('active', this.lockAspect);
    }, 'Seitenverhältnis');
    this.dims.append(field('w', ICONS.arrowH, 'mm', 'Breite'), this.lockBtn, field('h', ICONS.arrowV, 'mm', 'Höhe'), field('rot', ICONS.rotate, '°', 'Drehung'));
    return this.dims;
  }

  private updateDims(): void {
    const sel = this.selected;
    this.dims.classList.toggle('off', !sel);
    this.dimVal.w.textContent = sel ? formatNumber(sel.w) : '–';
    this.dimVal.h.textContent = sel ? formatNumber(sel.h) : '–';
    this.dimVal.rot.textContent = sel ? formatNumber(((sel.rot % 360) + 360) % 360) : '–';
  }

  /** Maß per Zahlentastatur ändern. */
  private async editDim(kind: 'w' | 'h' | 'rot'): Promise<void> {
    const el = this.selected;
    if (!el) return;
    const area = surfaceSize(this.surface);
    const maxSize = Math.max(area.w, area.h) * 3;
    const value = kind === 'rot' ? ((el.rot % 360) + 360) % 360 : el[kind];
    const v = await openNumpad({
      icon: kind === 'w' ? ICONS.arrowH : kind === 'h' ? ICONS.arrowV : ICONS.rotate,
      value,
      unit: kind === 'rot' ? '°' : 'mm',
      min: kind === 'rot' ? 0 : 1,
      max: kind === 'rot' ? 359.9 : maxSize,
    });
    const cur = this.selected;
    if (v === null || !cur || cur.id !== el.id) return;
    if (kind === 'rot') {
      cur.rot = ((((v + 180) % 360) + 360) % 360) - 180;
    } else if (this.lockAspect) {
      const f0 = v / cur[kind];
      // beide Seiten mindestens 1 mm und höchstens maxSize
      const f = Math.min(maxSize / Math.max(cur.w, cur.h), Math.max(f0, 1 / cur.w, 1 / cur.h));
      cur.w *= f;
      cur.h *= f;
    } else {
      cur[kind] = v;
    }
    this.commit();
  }

  /** Sichtbarer Ausschnitt: ganze Fläche oder herangezoomt (Maße in mm bleiben unverändert). */
  private effView(): View {
    return zoomedView(this.view, this.zoom, this.zoomCenter);
  }

  private setViewBox(): void {
    const v = this.effView();
    this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  }

  /** Zoom um den Faktor f; Mitte = ausgewähltes Teil, sonst der aktuelle Ausschnitt. */
  private zoomBy(f: number): void {
    const cur = this.effView();
    const sel = this.selected;
    const c: Pt = sel ? [sel.x, sel.y] : [cur.x + cur.w / 2, cur.y + cur.h / 2];
    this.zoom = Math.min(MAX_ZOOM, Math.max(1, this.zoom * f));
    if (this.zoom < 1.01) this.zoomFit();
    else {
      this.zoomCenter = c;
      this.render();
    }
  }

  /** Wieder die ganze Arbeitsfläche zeigen. */
  private zoomFit(): void {
    this.zoom = 1;
    this.zoomCenter = null;
    this.render();
  }

  // ---------- Bilder hochladen ----------
  private flash(b: HTMLElement): void {
    b.classList.remove('shake');
    void b.offsetWidth;
    b.classList.add('shake');
  }

  /** Foto/Bild -> Schwarz-Weiß-Umrisse (Vektor), Einstellung im Dialog. */
  private async importImage(file: File): Promise<void> {
    const rings = await openTraceDialog(file);
    if (rings && rings.length) this.addImported(rings, 'upload:bild');
    else if (rings) this.flash(this.btn.image);
  }

  /** SVG-Datei einfügen. */
  private async importSvg(file: File): Promise<void> {
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('zu groß');
      const rings = svgToShape(await file.text());
      if (!rings.length) throw new Error('leer');
      this.addImported(rings, 'upload:svg');
    } catch {
      this.flash(this.btn.svgfile);
    }
  }

  private addImported(rings: Shape, ref: string): void {
    const [x, y] = this.center();
    const size = this.baseSize() * 0.4;
    this.add(makeElement({ kind: 'graphic', ref, rings, op: this.currentOp, size, x, y }));
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onHide);
    cancelAnimationFrame(this.raf);
    clearTimeout(this.saveTimer);
    this.root.remove();
  }

  // ---------- Darstellung ----------
  private k(): number {
    const m = this.svg.getScreenCTM();
    return m && m.a > 0 ? 1 / m.a : 0.25;
  }

  private requestRender(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  private thin(e: El): boolean {
    const key = `${e.id}|${e.w.toFixed(1)}|${e.h.toFixed(1)}|${e.op}|${e.open ? 1 : 0}|${this.settings.minSize}`;
    let v = this.thinCache.get(key);
    if (v === undefined) {
      v = isTooThin(e, this.settings.minSize);
      if (this.thinCache.size > 500) this.thinCache.clear();
      this.thinCache.set(key, v);
    }
    return v;
  }

  /** Steht das Teil über das Werkstück hinaus? (gemerkt, damit das Ziehen flüssig bleibt) */
  private outside(e: El): boolean {
    if (isFree(this.surface)) return false;
    const key = `${e.id}|${e.x.toFixed(1)}|${e.y.toFixed(1)}|${e.w.toFixed(1)}|${e.h.toFixed(1)}|${e.rot.toFixed(0)}|${surfaceKey(this.surface)}`;
    let v = this.outsideCache.get(key);
    if (v === undefined) {
      v = isOutside(e, this.surface);
      if (this.outsideCache.size > 800) this.outsideCache.clear();
      this.outsideCache.set(key, v);
    }
    return v;
  }

  render(): void {
    this.setViewBox();
    const k = this.k();
    let out = canvasBackground(this.view, this.surface);
    for (const e of this.els) out += elementMarkup(e, this.settings.colors, 3);
    const sel = this.selected;
    for (const e of this.els) {
      const b = bbox(worldShape(e));
      if (this.outside(e)) {
        out += `<g transform="translate(${b.minX - 2 * k} ${b.minY - 2 * k}) scale(${k})"><path d="M0 -14 13 10H-13Z" fill="#ff5252" stroke="#7a1010" stroke-width="2" stroke-linejoin="round"/><path d="M0 -5v8M0 6.5v.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></g>`;
      }
      if (!this.thin(e)) continue;
      out += `<g transform="translate(${b.maxX + 2 * k} ${b.minY - 2 * k}) scale(${k})"><path d="M0 -14 13 10H-13Z" fill="#ffb300" stroke="#7a4b00" stroke-width="2" stroke-linejoin="round"/><path d="M0 -5v8M0 6.500v.5" stroke="#7a4b00" stroke-width="2.600" stroke-linecap="round"/></g>`;
    }
    if (sel && !this.drawMode) out += this.selectionMarkup(sel, k);
    const g = this.gesture;
    if (g && g.t === 'draw' && g.pts.length > 1) {
      out += `<path d="M${g.pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L')}" fill="none" stroke="${this.settings.colors[this.currentOp]}" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    this.svg.innerHTML = out;
    this.svg.classList.toggle('drawing', this.drawMode);
    this.updateButtons();
  }

  private handles(e: El, k: number) {
    const pad = 4 * k;
    const hw = e.w / 2 + pad;
    const hh = e.h / 2 + pad;
    const to = (lx: number, ly: number): Pt => transformPoint([lx / (e.w || 1), ly / (e.h || 1)], e);
    return {
      corners: [to(-hw, -hh), to(hw, -hh), to(hw, hh), to(-hw, hh)],
      rotate: to(0, -hh - 40 * k),
      top: to(0, -hh),
    };
  }

  private selectionMarkup(e: El, k: number): string {
    const hd = this.handles(e, k);
    const poly = hd.corners.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
    let s = `<polygon points="${poly}" fill="none" stroke="#3757a9" stroke-width="2.5" stroke-dasharray="7 5" vector-effect="non-scaling-stroke"/>`;
    s += `<line x1="${hd.top[0]}" y1="${hd.top[1]}" x2="${hd.rotate[0]}" y2="${hd.rotate[1]}" stroke="#3757a9" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
    for (const c of hd.corners) {
      s += `<g transform="translate(${c[0]} ${c[1]}) scale(${k})"><circle r="14" fill="#fff" stroke="#3757a9" stroke-width="4"/></g>`;
    }
    s += `<g transform="translate(${hd.rotate[0]} ${hd.rotate[1]}) scale(${k})"><circle r="19" fill="#38b8e8"/><g transform="translate(-12 -12)" stroke="#fff" stroke-width="2.200" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.500-5.800"/><path d="M20 3v5h-5"/></g></g>`;
    return s;
  }

  private updateButtons(): void {
    const sel = this.selected;
    this.btn.undo.disabled = !this.history.canUndo;
    this.btn.redo.disabled = !this.history.canRedo;
    this.btn.dup.disabled = !sel;
    this.btn.font.disabled = !sel || sel.kind !== 'text';
    this.btn.del.disabled = !sel;
    this.btn.draw.classList.toggle('active', this.drawMode);
    this.btn.zoomIn.disabled = this.zoom >= MAX_ZOOM - 0.01;
    this.btn.zoomOut.disabled = this.zoom <= 1.01;
    this.btn.zoomFit.disabled = this.zoom <= 1.01;
    this.zoomLabel.textContent = this.zoom > 1.01 ? `${Math.round(this.zoom * 100)} %` : '';
    this.updateDims();
    const op = sel ? sel.op : this.currentOp;
    for (const o of ['cut', 'engrave', 'fill'] as Op[]) this.btn[`op-${o}`].classList.toggle('active', o === op);
  }

  // ---------- Zeigerereignisse ----------
  private toMM(ev: PointerEvent): Pt {
    const m = this.svg.getScreenCTM();
    if (!m) return [0, 0];
    const pt = this.svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(m.inverse());
    return [p.x, p.y];
  }

  private pointerDown(ev: PointerEvent): void {
    ev.preventDefault();
    try {
      this.svg.setPointerCapture(ev.pointerId);
    } catch {
      /* ignorieren */
    }
    const p = this.toMM(ev);
    this.pointers.set(ev.pointerId, p);
    const k = this.k();
    const sel = this.selected;

    if (this.pointers.size === 2 && sel && !this.drawMode) {
      const [a, b] = [...this.pointers.values()];
      this.gesture = {
        t: 'pinch',
        id: sel.id,
        d0: Math.max(dist(a, b), 1e-3),
        a0: Math.atan2(b[1] - a[1], b[0] - a[0]),
        m0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        w0: sel.w,
        h0: sel.h,
        rot0: sel.rot,
        x0: sel.x,
        y0: sel.y,
      };
      this.changed = true;
      return;
    }
    if (this.pointers.size > 1) return;

    if (this.drawMode) {
      this.gesture = { t: 'draw', pts: [p] };
      return;
    }
    if (sel) {
      const hd = this.handles(sel, k);
      const reach = 28 * k;
      if (dist(p, hd.rotate) <= reach) {
        this.gesture = { t: 'rotate', id: sel.id, c: [sel.x, sel.y], a0: Math.atan2(p[1] - sel.y, p[0] - sel.x), rot0: sel.rot };
        return;
      }
      if (hd.corners.some((c) => dist(p, c) <= reach)) {
        this.gesture = { t: 'scale', id: sel.id, c: [sel.x, sel.y], d0: Math.max(dist(p, [sel.x, sel.y]), 1e-3), w0: sel.w, h0: sel.h };
        return;
      }
    }
    const hit = pickElement(this.els, p, 3 * k);
    if (hit) {
      this.selectedId = hit.id;
      this.currentOp = hit.op;
      this.gesture = { t: 'move', id: hit.id, start: p, ox: hit.x, oy: hit.y };
    } else {
      this.selectedId = null;
      this.gesture = null;
      if (this.zoom > 1) {
        const v = this.effView();
        this.gesture = { t: 'pan', sx: ev.clientX, sy: ev.clientY, c0: this.zoomCenter ?? [v.x + v.w / 2, v.y + v.h / 2], k0: k };
      }
    }
    this.requestRender();
  }

  private pointerMove(ev: PointerEvent): void {
    if (!this.pointers.has(ev.pointerId)) return;
    const p = this.toMM(ev);
    this.pointers.set(ev.pointerId, p);
    const g = this.gesture;
    if (!g) return;
    if (g.t === 'draw') {
      const last = g.pts[g.pts.length - 1];
      if (dist(last, p) > 0.4) g.pts.push(p);
      this.requestRender();
      return;
    }
    if (g.t === 'pan') {
      this.zoomCenter = [g.c0[0] - (ev.clientX - g.sx) * g.k0, g.c0[1] - (ev.clientY - g.sy) * g.k0];
      this.requestRender();
      return;
    }
    const el = this.els.find((e) => e.id === g.id);
    if (!el) return;
    const bd = this.bounds();
    const area = surfaceSize(this.surface);
    const maxSize = Math.max(area.w, area.h) * 2;
    const clampX = (x: number) => Math.min(bd.maxX, Math.max(bd.minX, x));
    const clampY = (y: number) => Math.min(bd.maxY, Math.max(bd.minY, y));
    const clampScale = (w0: number, h0: number, f: number) => {
      const longest = Math.max(w0, h0);
      const nf = Math.min(maxSize / longest, Math.max(4 / longest, f));
      el.w = w0 * nf;
      el.h = h0 * nf;
    };
    if (g.t === 'move') {
      el.x = clampX(g.ox + p[0] - g.start[0]);
      el.y = clampY(g.oy + p[1] - g.start[1]);
      this.changed = this.changed || dist(p, g.start) > 0.5;
    } else if (g.t === 'scale') {
      clampScale(g.w0, g.h0, dist(p, g.c) / g.d0);
      this.changed = true;
    } else if (g.t === 'rotate') {
      let rot = g.rot0 + ((Math.atan2(p[1] - g.c[1], p[0] - g.c[0]) - g.a0) * 180) / Math.PI;
      rot = ((((rot + 180) % 360) + 360) % 360) - 180;
      const snapped = Math.round(rot / 15) * 15;
      if (Math.abs(rot - snapped) < 4) rot = snapped;
      el.rot = rot;
      this.changed = true;
    } else if (g.t === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      clampScale(g.w0, g.h0, dist(a, b) / g.d0);
      el.rot = g.rot0 + ((Math.atan2(b[1] - a[1], b[0] - a[0]) - g.a0) * 180) / Math.PI;
      el.x = clampX(g.x0 + (a[0] + b[0]) / 2 - g.m0[0]);
      el.y = clampY(g.y0 + (a[1] + b[1]) / 2 - g.m0[1]);
      this.changed = true;
    }
    this.requestRender();
  }

  private pointerUp(ev: PointerEvent): void {
    if (!this.pointers.has(ev.pointerId)) return;
    this.pointers.delete(ev.pointerId);
    const g = this.gesture;
    if (g && g.t === 'draw') {
      this.gesture = null;
      this.finishStroke(g.pts);
      return;
    }
    if (g && g.t === 'pinch') {
      // ein Finger bleibt liegen: Geste beenden, ohne weiter zu verschieben
      this.gesture = null;
    } else if (this.pointers.size === 0) {
      this.gesture = null;
    }
    if (this.pointers.size === 0) {
      if (this.changed) this.commit();
      this.changed = false;
      this.requestRender();
    }
  }

  // ---------- Änderungen ----------
  private commit(): void {
    this.updateView();
    if (this.history.commit(this.els)) {
      this.o.design.updated = Date.now();
      this.scheduleSave();
    }
    this.requestRender();
  }

  private undo(): void {
    const s = this.history.undo();
    if (!s) return;
    this.els = s;
    if (!this.selected) this.selectedId = null;
    this.updateView();
    this.scheduleSave();
    this.render();
  }

  private redo(): void {
    const s = this.history.redo();
    if (!s) return;
    this.els = s;
    if (!this.selected) this.selectedId = null;
    this.updateView();
    this.scheduleSave();
    this.render();
  }

  private center(): Pt {
    const bd = this.bounds();
    const v = this.effView();
    const j = ((this.nextOffset++ % 5) - 2) * 9 / this.zoom;
    const cx = Math.min(bd.maxX, Math.max(bd.minX, v.x + v.w / 2));
    const cy = Math.min(bd.maxY, Math.max(bd.minY, v.y + v.h / 2));
    return [cx + j, cy + j];
  }

  private add(el: El): void {
    this.drawMode = false;
    this.els.push(el);
    this.selectedId = el.id;
    this.commit();
  }

  /** Alle Formen in einer aufklappenden Auswahl neben der Leiste. */
  private openShapes(): void {
    this.drawMode = false;
    this.render();
    const anchor = this.btn.shapes.getBoundingClientRect();
    const o = overlay('overlay-clear');
    const fly = h('div', 'flyout');
    fly.style.left = `${anchor.right + 14}px`;
    fly.style.top = `${Math.max(8, anchor.top - 8)}px`;
    for (const g of SHAPE_GROUPS) {
      const grid = h('div', 'fly-grid');
      for (const id of g.ids) {
        grid.append(button('btn tool', SHAPE_ICONS[id], () => {
          o.close();
          this.btn.shapes.classList.remove('active');
          this.addShape(id);
        }, SHAPE_LABELS[id]));
      }
      fly.append(grid);
    }
    o.root.addEventListener('click', (e) => {
      if (e.target === o.root) {
        o.close();
        this.btn.shapes.classList.remove('active');
      }
    });
    this.btn.shapes.classList.add('active');
    o.root.append(fly);
    // im Fenster halten: nach oben schieben, wenn unten nicht genug Platz ist
    // offsetHeight statt getBoundingClientRect: unabhängig von der Einblend-Animation (Skalierung)
    const top = Math.max(8, Math.min(parseFloat(fly.style.top), window.innerHeight - fly.offsetHeight - 10));
    fly.style.top = `${top}px`;
    fly.style.maxHeight = `${window.innerHeight - 16}px`;
  }

  private addShape(id: ShapeId): void {
    const [x, y] = this.center();
    const size = this.baseSize() * 0.28;
    this.add(makeElement({ kind: 'shape', ref: id, rings: baseShape(id), op: this.currentOp, size, x, y }));
  }

  /** Text zeichnen: Block = eigene Strichschrift (Vektor), sonst Webschrift -> Umrisse. */
  private async buildText(text: string, font: FontChoice): Promise<{ rings: Shape; nw: number; nh: number; scale: number } | null> {
    let rings: Shape;
    let scale: number;
    if (!font.family) {
      rings = textShape(text);
      scale = 26 / GLYPH_HEIGHT; // Höhe der Großbuchstaben ca. 26 mm
    } else {
      const busy = overlay('overlay-dim');
      busy.root.append(h('div', 'send-card', `<div class="spinner">${ICONS.text}</div>`));
      try {
        const ft = await fontTextShape(font, text);
        rings = ft.rings;
        scale = 36 / ft.px; // 1 em = 36 mm (Großbuchstaben ca. 25 mm)
      } catch {
        return null;
      } finally {
        busy.close();
      }
    }
    if (!rings.length) return null;
    const b = bbox(rings);
    return { rings, nw: b.maxX - b.minX, nh: b.maxY - b.minY, scale };
  }

  /** Neuen Text einfügen. */
  private async addText(text: string, font: FontChoice): Promise<void> {
    const clean = text.trim();
    if (!clean) return;
    const t = await this.buildText(clean, font);
    if (!t) return;
    let scale = t.scale;
    const maxW = surfaceSize(this.surface).w * 0.9;
    if (t.nw * scale > maxW) scale = maxW / t.nw;
    const [x, y] = this.center();
    const el = makeElement({ kind: 'text', ref: `${font.id}:${clean}`, rings: t.rings, op: this.currentOp, size: 0, x, y, exact: { w: t.nw * scale, h: t.nh * scale } });
    el.text = { font: font.id, value: clean, w0: t.nw * scale, h0: t.nh * scale };
    this.add(el);
  }

  /** Schrift und/oder Wortlaut eines vorhandenen Textes ändern; Lage, Drehung, Bearbeitungsart und vom Kind gewählte Größe bleiben. */
  private async replaceText(el: El, text: string, font: FontChoice): Promise<void> {
    const clean = text.trim();
    if (!clean) return;
    const t = await this.buildText(clean, font);
    if (!t) return;
    const cur = this.els.find((e) => e.id === el.id);
    if (!cur) return;
    // Faktor, um den das Kind den Text vergrößert/verkleinert hat
    const k = cur.text ? (cur.w / cur.text.w0 + cur.h / cur.text.h0) / 2 : 1;
    const area = surfaceSize(this.surface);
    const cap = Math.max(area.w, area.h) * 3;
    let f = k;
    if (Math.max(t.nw, t.nh) * t.scale * f > cap) f = cap / (Math.max(t.nw, t.nh) * t.scale);
    cur.base = normalizeBase(t.rings).base;
    cur.w = t.nw * t.scale * f;
    cur.h = t.nh * t.scale * f;
    cur.ref = `${font.id}:${clean}`;
    cur.text = { font: font.id, value: clean, w0: t.nw * t.scale, h0: t.nh * t.scale };
    this.thinCache.clear();
    this.outsideCache.clear();
    this.selectedId = cur.id;
    this.commit();
  }

  /** Taste "Schrift": Dialog mit dem vorhandenen Text und der aktuellen Schrift öffnen. */
  private editText(): void {
    const sel = this.selected;
    if (sel && sel.kind === 'text') this.openText(sel);
  }

  private setOp(op: Op): void {
    this.currentOp = op;
    const sel = this.selected;
    if (sel && sel.op !== op) {
      sel.op = op;
      this.commit();
    }
    this.requestRender();
  }

  private duplicate(): void {
    const sel = this.selected;
    if (!sel) return;
    const copy: El = { ...JSON.parse(JSON.stringify(sel)), id: newId(), x: Math.min(this.bounds().maxX, sel.x + 10), y: Math.min(this.bounds().maxY, sel.y + 10) };
    this.add(copy);
  }

  private async remove(): Promise<void> {
    const sel = this.selected;
    if (!sel) return;
    if (!(await confirmDialog(ICONS.trash))) return;
    this.els = this.els.filter((e) => e.id !== sel.id);
    this.selectedId = null;
    this.commit();
  }

  /** Zeichenfläche (Werkstück) wechseln, z. B. von unendlich auf rund. Wird vom Rückgängig nicht erfasst. */
  private changeSurface(): void {
    openSurfaceDialog({
      current: this.surface,
      settings: this.settings,
      onDone: (surface) => {
        this.o.design.surface = surface;
        this.o.design.updated = Date.now();
        this.outsideCache.clear();
        this.view = viewFor(surface, this.els, null);
        // Teile außerhalb der neuen Fläche bleiben erhalten und bekommen ein Warnzeichen
        this.scheduleSave();
        this.render();
      },
    });
  }

  private toggleDraw(): void {
    this.drawMode = !this.drawMode;
    if (this.drawMode) this.selectedId = null;
    this.render();
  }

  /** Strich glätten, vereinfachen, fast geschlossene Linien schließen. */
  private finishStroke(raw: Pt[]): void {
    let length = 0;
    for (let i = 1; i < raw.length; i++) length += dist(raw[i - 1], raw[i]);
    if (raw.length < 3 || length < 8) {
      this.requestRender();
      return;
    }
    const nearClosed = dist(raw[0], raw[raw.length - 1]) < Math.max(8, length * 0.2);
    const closed = nearClosed || this.currentOp === 'fill';
    let pts = resample(raw, 1.5, false);
    let ring: Ring;
    if (closed) {
      if (pts.length > 3 && dist(pts[0], pts[pts.length - 1]) < 4) pts = pts.slice(0, -1);
      pts = smooth(pts, 5, true);
      const s = simplify([...pts, pts[0]], 0.25);
      s.pop();
      ring = s;
    } else {
      ring = simplify(smooth(pts, 5, false), 0.25);
    }
    if (ring.length < (closed ? 3 : 2)) {
      this.requestRender();
      return;
    }
    const b = bbox([ring]);
    const w = b.maxX - b.minX;
    const hh = b.maxY - b.minY;
    const el = makeElement({
      kind: 'free',
      ref: '',
      rings: [ring],
      op: this.currentOp,
      size: 0,
      x: (b.minX + b.maxX) / 2,
      y: (b.minY + b.maxY) / 2,
      open: !closed,
      exact: { w: Math.max(w, 0.5), h: Math.max(hh, 0.5) },
    });
    this.els.push(el);
    this.selectedId = null; // im Zeichenmodus bleiben, kein Auswahlrahmen
    this.commit();
  }

  // ---------- Bildersuche und Text ----------
  /** Suche nach Bildern im Internet (Iconify). */
  private openSearch(): void {
    this.drawMode = false;
    void storage.getSearchConfig().then((cfg) =>
      openOnlineSearch(cfg, async (svg, ref) => {
        const rings = svgToShape(svg);
        if (!rings.length) return false;
        const [x, y] = this.center();
        const size = this.baseSize() * 0.4;
        this.add(makeElement({ kind: 'graphic', ref, rings, op: this.currentOp, size, x, y }));
        return true;
      }),
    );
  }

  private openText(edit?: El): void {
    this.drawMode = false;
    const o = overlay('overlay-dim');
    const panel = h('div', 'panel text-panel');
    const preview = h('div', 'text-preview');
    const fontRow = h('div', 'font-row');
    const keys = h('div', 'keys');
    const info = edit ? textInfo(edit) : null;
    let text = info?.value ?? '';
    let font = info?.font ?? FONTS[0];
    let upper = true;
    const ok = button('btn key-ok', ICONS.check, () => {
      const t = text;
      const f = font;
      o.close();
      void (edit ? this.replaceText(edit, t, f) : this.addText(t, f));
    }, 'Fertig');

    const refresh = () => {
      if (!font.family) {
        const rings = textShape(text);
        if (rings.length) {
          const b = bbox(rings);
          const pad = 1;
          const vb = `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + 2 * pad} ${b.maxY - b.minY + 2 * pad}`;
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
      const sample = f.family ? `<span style="${fontStyle(f)}">Abc</span>` : `<svg viewBox="-1 -1 22 10" preserveAspectRatio="xMidYMid meet"><path d="${shapeToPath(textShape('ABC'), 2)}" fill="currentColor" fill-rule="evenodd" transform="scale(1)"/></svg>`;
      const chip = button('font-chip' + (f === font ? ' active' : ''), sample, () => {
        font = f;
        chips.forEach((c, i) => c.classList.toggle('active', FONTS[i] === f));
        refresh();
      }, f.label);
      chips.push(chip);
      fontRow.append(chip);
    }

    const MAX_TEXT = 14;
    const press = (ch: string) => {
      if (text.length < MAX_TEXT) text += ch;
      refresh();
    };
    const letterKeys: { btn: HTMLButtonElement; ch: string }[] = [];
    const caseOf = (ch: string) => (ch === 'ß' ? ch : upper ? ch.toUpperCase() : ch.toLowerCase());
    const addKey = (ch: string, cased: boolean) => {
      const k = button('key', cased ? caseOf(ch) : ch, () => press(cased ? caseOf(ch) : ch), ch);
      if (cased) letterKeys.push({ btn: k, ch });
      keys.append(k);
    };
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') addKey(ch, true);
    for (const ch of 'ÄÖÜß') addKey(ch, true);
    for (const ch of '0123456789.!?-,:') addKey(ch, false);
    const shift = button('key wide shift active', ICONS.shift, () => {
      upper = !upper;
      shift.classList.toggle('active', upper);
      for (const { btn, ch } of letterKeys) {
        btn.textContent = caseOf(ch);
        btn.setAttribute('aria-label', ch);
      }
    }, 'Groß/Klein');
    keys.append(
      shift,
      button('key wide', ICONS.space, () => press(' '), 'Leerzeichen'),
      button('key wide', ICONS.backspace, () => {
        text = text.slice(0, -1);
        refresh();
      }, 'Löschen'),
    );

    const head = h('div', 'panel-head');
    head.append(button('btn', ICONS.cross, () => o.close(), 'Schließen'), preview, ok);
    panel.append(head, fontRow, keys);
    o.root.append(panel);
    refresh();
  }

  // ---------- Speichern, Exportieren, Verlassen ----------
  private setStatus(ok: boolean): void {
    this.status.innerHTML = ok ? ICONS.cloudOk : ICONS.cloudOff;
    this.status.classList.toggle('bad', !ok);
  }

  private scheduleSave(): void {
    this.dirty = true;
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.saveNow(), 600);
  }

  async saveNow(): Promise<boolean> {
    clearTimeout(this.saveTimer);
    if (!this.dirty) return true;
    if (this.els.length === 0 && !this.everSaved) {
      this.dirty = false;
      return true;
    }
    try {
      await storage.saveDesign(this.o.profile.id, this.o.design);
      this.everSaved = true;
      this.dirty = false;
      this.setStatus(storage.persistent);
      return true;
    } catch {
      this.setStatus(false);
      this.saveTimer = window.setTimeout(() => void this.saveNow(), 5000);
      return false;
    }
  }

  async exit(): Promise<void> {
    await this.saveNow();
    if (this.els.length === 0 && this.everSaved) {
      try {
        await storage.deleteDesign(this.o.profile.id, this.o.design.id);
      } catch {
        /* egal */
      }
    }
    this.o.onExit();
  }

  /** SVG exportieren und speichern (Teilen-Menü bzw. Download). */
  private async exportNow(): Promise<void> {
    if (!this.els.length) {
      this.btn.export.classList.remove('shake');
      void this.btn.export.offsetWidth;
      this.btn.export.classList.add('shake');
      return;
    }
    this.selectedId = null;
    this.render();
    // Der Benutzer legt den Dateinamen fest; gespeichert wird direkt aus dem Tipp auf ✓ (Teilen-Menü).
    openSaveDialog({
      defaultName: exportFileName(this.o.profile.name),
      ext: 'svg',
      onSave: async (fileName) => {
        const result = await saveSvg(this.o.profile, this.o.design, this.settings, fileName);
        void this.saveNow();
        if (result === 'cancelled') return;
        const o = overlay('overlay-dim');
        const card = h('div', 'send-card', `<div class="sent"><div class="plane drop">${ICONS.download}</div><div class="ok">${ICONS.check}</div></div>`);
        o.root.append(card);
        const close = () => o.close();
        o.root.addEventListener('click', close);
        setTimeout(close, 2200);
      },
    });
  }
}
