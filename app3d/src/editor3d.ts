// Editor der 3D-App: Körper-Leiste, 3D-Ansicht, Maße-Leiste, Rückgängig.
import { button, confirmDialog, h, lab, overlay } from '../../src/dom';
import { ICONS } from '../../src/icons';
import { formatNumber, openNumpad } from '../../src/numpad';
import type { Shape } from '../../src/geometry';
import type { PrinterSettings } from './bed';
import { openKindPicker, openShapePicker, openSketch, openTextDialog, pickSvg } from './dialogs3d';
import { History } from './history';
import { ICONS3D, KIND_ICONS } from './icons3d';
import type { PartKind } from './mesh';
import { MAX_SIZE, MIN_SIZE, applyDim, centered, cloneParts, createPart, duplicatePart, findFreeSpot, isOutside, makeOutlinePart, type DimField, type OutlineSize, type Part } from './model3d';
import { View3d } from './view3d';

const DIMS: { field: DimField; icon: string; unit: string; label: string }[] = [
  { field: 'w', icon: ICONS.arrowH, unit: 'mm', label: 'Breite' },
  { field: 'd', icon: ICONS3D.depth, unit: 'mm', label: 'Tiefe' },
  { field: 'h', icon: ICONS.arrowV, unit: 'mm', label: 'Höhe' },
  { field: 'rot', icon: ICONS.rotate, unit: '°', label: 'Drehung' },
  { field: 'z', icon: ICONS3D.lift, unit: 'mm', label: 'Abstand zum Bett' },
];

/** Kurzer Hinweis ohne Text: großes Symbol, verschwindet von selbst oder beim Antippen. */
function notify(iconHtml: string): void {
  const o = overlay('overlay-dim');
  o.root.append(h('div', 'confirm-card', `<div class="confirm-icon">${iconHtml}</div>`));
  const close = () => o.close();
  o.root.addEventListener('click', close);
  setTimeout(close, 1800);
}

export class Editor3d {
  readonly root = h('div', 'editor3d');
  private view: View3d;
  private parts: Part[] = [];
  private selectedId: string | null = null;
  private history = new History<Part[]>([]);
  private lock = true;
  private btn = {} as Record<'undo' | 'redo' | 'copy' | 'del', HTMLButtonElement>;
  private dimEls = new Map<DimField, HTMLElement>();
  private dims!: HTMLElement;
  private lockBtn!: HTMLButtonElement;
  private status!: HTMLElement;

  constructor(private printer: PrinterSettings) {
    const top = h('div', 'topbar');
    const logo = h('img', 'logo') as HTMLImageElement;
    logo.src = './mint2go-logo.png';
    logo.alt = '';
    this.btn.undo = button('btn labeled', lab(ICONS.undo, 'Zurück'), () => this.undo(), 'Rückgängig');
    this.btn.redo = button('btn labeled', lab(ICONS.redo, 'Vor'), () => this.redo(), 'Wiederholen');
    this.btn.copy = button('btn labeled', lab(ICONS.copy, 'Kopie'), () => this.duplicate(), 'Kopieren');
    this.btn.del = button('btn labeled danger', lab(ICONS.trash, 'Löschen'), () => void this.remove(), 'Löschen');
    this.status = h('div', 'status', ICONS.warn);
    const home = button('btn labeled', lab(ICONS3D.home, 'Ansicht'), () => this.view.resetView(), 'Ansicht zurücksetzen');
    const group = h('div', 'top-group');
    group.append(this.btn.undo, this.btn.redo, this.btn.copy, this.btn.del);
    const group2 = h('div', 'top-group');
    group2.append(this.status, home);
    top.append(logo, h('div', 'top-center'), group, group2);

    const body = h('div', 'editor-body');
    const rail = h('div', 'rail left-rail');
    // Körper aus der Auswahl; Zeichnen: Umriss festlegen, danach die Höhe geben
    rail.append(
      button('btn labeled tool', lab(KIND_ICONS.box, 'Körper'), () => void this.pickKind(), 'Körper'),
      h('div', 'rail-sep'),
      button('btn labeled tool', lab(ICONS.shapes, 'Formen'), () => void this.drawShape(), 'Formen'),
      button('btn labeled tool', lab(ICONS.draw, 'Freihand'), () => void this.drawSketch(), 'Freihand'),
      button('btn labeled tool', lab(ICONS.text, 'Text'), () => void this.drawText(), 'Text'),
      button('btn labeled tool', lab(ICONS.svgUp, 'SVG'), () => this.drawSvg(), 'SVG-Datei'),
    );

    const stage = h('div', 'stage');
    const host = h('div', 'view-host');
    stage.append(host, this.buildDims());
    body.append(rail, stage);
    this.root.append(top, body);

    this.view = new View3d(host, printer.bed, {
      select: (id) => this.select(id),
      update: (id, next) => this.replace(id, next),
      commit: () => this.commit(),
    });
    this.refresh();
  }

  destroy(): void {
    this.view.destroy();
  }

  // ---------- Maße-Leiste ----------
  private buildDims(): HTMLElement {
    this.dims = h('div', 'dims');
    for (const d of DIMS) {
      const b = button('dim', `<span class="dim-ico">${d.icon}</span><span class="dim-val"></span><span class="dim-unit">${d.unit}</span>`, () => void this.editDim(d.field), d.label);
      this.dimEls.set(d.field, b.querySelector('.dim-val')!);
      this.dims.append(b);
    }
    this.lockBtn = button('dim lock active', ICONS.lock, () => {
      this.lock = !this.lock;
      this.view.setLock(this.lock);
      this.refresh();
    }, 'Seitenverhältnis');
    const center = button('dim mitte', `<span class="dim-ico">${ICONS.center}</span><span class="dim-lbl">Mitte</span>`, () => this.centerSelected(), 'In die Mitte');
    this.dims.insertBefore(this.lockBtn, this.dims.children[3]); // Schloss gehört zu Breite/Tiefe/Höhe
    this.dims.append(center);
    return this.dims;
  }

  private async editDim(field: DimField): Promise<void> {
    const p = this.selected();
    if (!p) return;
    const meta = DIMS.find((d) => d.field === field)!;
    const range = field === 'rot' ? [0, 359.9] : field === 'z' ? [0, this.printer.bed.height] : [MIN_SIZE, MAX_SIZE];
    const v = await openNumpad({ icon: meta.icon, value: p[field], unit: meta.unit, min: range[0], max: range[1] });
    if (v === null) return;
    this.replace(p.id, applyDim(p, field, v, this.lock, this.printer.bed));
    this.commit();
  }

  // ---------- Zustand ----------
  private selected(): Part | undefined {
    return this.parts.find((p) => p.id === this.selectedId);
  }

  private select(id: string | null): void {
    if (id === this.selectedId) return;
    this.selectedId = id;
    this.refresh();
  }

  private replace(id: string, next: Part): void {
    this.parts = this.parts.map((p) => (p.id === id ? next : p));
    this.refresh();
  }

  private commit(): void {
    this.history.commit(this.parts);
    this.refresh();
  }

  private add(kind: PartKind): void {
    const spot = findFreeSpot(kind, this.parts, this.printer.bed);
    const p = createPart(kind, spot.x, spot.y);
    this.parts = [...this.parts, p];
    this.selectedId = p.id;
    this.commit();
  }

  private async pickKind(): Promise<void> {
    const kind = await openKindPicker();
    if (kind) this.add(kind);
  }

  // ---------- Zeichnen: Umriss -> Körper mit Höhe ----------
  private async drawShape(): Promise<void> {
    const r = await openShapePicker();
    if (r) await this.addDrawn(r.shape, { longest: 40 }, 10);
  }

  private async drawSketch(): Promise<void> {
    const shape = await openSketch();
    if (shape) await this.addDrawn(shape, { longest: 50 }, 8);
  }

  private async drawText(): Promise<void> {
    const r = await openTextDialog();
    if (r) await this.addDrawn(r.shape, { scale: r.scale }, 5);
  }

  private drawSvg(): void {
    pickSvg(
      (shape) => void this.addDrawn(shape, { longest: 50 }, 8),
      () => notify(ICONS.warn),
    );
  }

  /** Umriss als Körper auf freien Platz setzen, dann nach der Höhe fragen (Abbrechen behält die Starthöhe). */
  private async addDrawn(shape: Shape, size: OutlineSize, height: number): Promise<void> {
    const probe = makeOutlinePart(shape, size, height, this.printer.bed);
    if (!probe) return notify(ICONS.warn);
    const spot = findFreeSpot(probe, this.parts, this.printer.bed);
    const p = { ...probe, x: spot.x, y: spot.y };
    this.parts = [...this.parts, p];
    this.selectedId = p.id;
    this.refresh();
    const v = await openNumpad({ icon: ICONS.arrowV, value: p.h, unit: 'mm', min: MIN_SIZE, max: this.printer.bed.height });
    if (v !== null) this.replace(p.id, applyDim(p, 'h', v, false, this.printer.bed)); // nur die Höhe, nicht gleichmäßig
    this.commit();
  }

  private duplicate(): void {
    const p = this.selected();
    if (!p) return;
    const c = duplicatePart(p);
    this.parts = [...this.parts, c];
    this.selectedId = c.id;
    this.commit();
  }

  private async remove(): Promise<void> {
    const p = this.selected();
    if (!p || !(await confirmDialog(ICONS.trash))) return;
    this.parts = this.parts.filter((q) => q.id !== p.id);
    this.selectedId = null;
    this.commit();
  }

  private centerSelected(): void {
    const p = this.selected();
    if (!p) return;
    this.replace(p.id, centered(p));
    this.commit();
  }

  private restore(parts: Part[] | null): void {
    if (!parts) return;
    this.parts = cloneParts(parts);
    if (!this.selected()) this.selectedId = null;
    this.refresh();
  }

  private undo(): void {
    this.restore(this.history.undo());
  }

  private redo(): void {
    this.restore(this.history.redo());
  }

  private refresh(): void {
    const outside = new Set(this.parts.filter((p) => isOutside(p, this.printer.bed)).map((p) => p.id));
    this.view.setParts(this.parts, this.selectedId, outside);
    const sel = this.selected();
    this.dims.classList.toggle('off', !sel);
    for (const d of DIMS) this.dimEls.get(d.field)!.textContent = sel ? formatNumber(sel[d.field]) : '–';
    this.lockBtn.classList.toggle('active', this.lock);
    this.lockBtn.innerHTML = this.lock ? ICONS.lock : ICONS.unlock;
    this.btn.undo.disabled = !this.history.canUndo;
    this.btn.redo.disabled = !this.history.canRedo;
    this.btn.copy.disabled = !sel;
    this.btn.del.disabled = !sel;
    this.status.classList.toggle('bad', outside.size > 0);
  }
}
