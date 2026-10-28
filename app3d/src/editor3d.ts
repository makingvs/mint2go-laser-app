// Editor der 3D-App: Körper-Leiste, 3D-Ansicht, Maße-Leiste, Rückgängig.
import { button, confirmDialog, h, lab } from '../../src/dom';
import { ICONS } from '../../src/icons';
import { formatNumber, openNumpad } from '../../src/numpad';
import type { Shape } from '../../src/geometry';
import { combine } from './csg';
import { notify, openKindPicker, openShapePicker, openSketch, openTextDialog, pickSvg } from './dialogs3d';
import { createDesign, packDesign, unpackDesign } from './designIO';
import { busyOverlay, exportParts } from './exportFlow';
import { History } from './history';
import { ICONS3D, KIND_ICONS, SPECIAL_ICONS } from './icons3d';
import { MAX_TEETH, MIN_TEETH } from './shapes3d';
import { alignCenter, copyOffset, mirrorPart, tiltPart } from './transform';
import { Coach } from './werkstatt/coach3d';
import { openFinish } from './werkstatt/dialogs3dw';
import type { GuideState, Highlight, Snapshot } from './werkstatt/engine3d';
import { projectByNumber } from './werkstatt/projects3d';
import type { PartKind } from './mesh';
import { MAX_SIZE, MIN_SIZE, applyDim, centered, cloneParts, createPart, findFreeSpot, isOutside, makeGearPart, makeOutlinePart, makeTubePart, newId, type DimField, type OutlineSize, type Part } from './model3d';
import { storage, type Design, type ExportFormat, type Profile, type Settings } from './storage3d';
import { restOn, supportHeight } from './support';
import { View3d } from './view3d';

export interface EditorOptions {
  profile: Profile;
  /** gespeicherte Arbeit oder null = neue Arbeit */
  design: Design | null;
  settings: Settings;
  onExit: () => void;
  /** zur Werkstatt-Auswahl (Fertig-Fenster) */
  onWerkstatt?: () => void;
  /** zur Galerie (Fertig-Fenster) */
  onGallery?: () => void;
}

const DIMS: { field: DimField; icon: string; unit: string; label: string }[] = [
  { field: 'w', icon: ICONS.arrowH, unit: 'mm', label: 'Breite' },
  { field: 'd', icon: ICONS3D.depth, unit: 'mm', label: 'Tiefe' },
  { field: 'h', icon: ICONS.arrowV, unit: 'mm', label: 'Höhe' },
  { field: 'rot', icon: ICONS.rotate, unit: '°', label: 'Drehung' },
  { field: 'z', icon: ICONS3D.lift, unit: 'mm', label: 'Abstand zum Bett' },
];

export class Editor3d {
  readonly root = h('div', 'editor3d');
  private view: View3d;
  private parts: Part[] = [];
  private selectedId: string | null = null;
  private history: History<Part[]>;
  private design: Design;
  private printer: Settings;
  private dirty = false;
  private everSaved: boolean;
  private saveTimer: number | undefined;
  private saving: Promise<void> = Promise.resolve();
  private lock = true;
  private btn = {} as Record<'undo' | 'redo' | 'copy' | 'del' | 'hole' | 'merge' | 'export', HTMLButtonElement>;
  private format: ExportFormat;
  private dimEls = new Map<DimField, HTMLElement>();
  private dims!: HTMLElement;
  private lockBtn!: HTMLButtonElement;
  private status!: HTMLElement;
  private stage!: HTMLElement;
  private coach: Coach | null = null;
  private exported = false;
  /** Welche Kopie stammt von welchem Körper (für "Kopie merkt den Abstand") */
  private copyOf = new Map<string, string>();
  private railBtn = {} as Record<'body' | 'shapes' | 'draw' | 'text' | 'svg' | 'tilt' | 'mirror' | 'align', HTMLButtonElement>;
  private dimBtns = new Map<DimField, HTMLButtonElement>();
  private tiltPanel: HTMLElement | null = null;
  private tiltStep = 15;

  constructor(private o: EditorOptions) {
    this.printer = o.settings;
    this.format = o.settings.format;
    this.design = o.design ?? createDesign();
    this.everSaved = !!o.design;
    this.parts = unpackDesign(this.design);
    this.history = new History<Part[]>(this.parts);
    const top = h('div', 'topbar');
    const back = button('btn labeled', lab(ICONS.gallery, 'Galerie'), () => void this.exit(), 'Galerie');
    this.btn.undo = button('btn labeled', lab(ICONS.undo, 'Zurück'), () => this.undo(), 'Rückgängig');
    this.btn.redo = button('btn labeled', lab(ICONS.redo, 'Vor'), () => this.redo(), 'Wiederholen');
    this.btn.copy = button('btn labeled', lab(ICONS.copy, 'Kopie'), () => this.duplicate(), 'Kopieren');
    this.btn.del = button('btn labeled danger', lab(ICONS.trash, 'Löschen'), () => void this.remove(), 'Löschen');
    this.btn.hole = button('btn labeled', lab(ICONS3D.hole, 'Loch'), () => this.toggleHole(), 'Loch');
    this.btn.merge = button('btn labeled', lab(ICONS3D.merge, 'Vereinen'), () => void this.merge(), 'Vereinen');
    this.btn.export = button('btn send labeled', lab(ICONS.share, 'Export'), () => void this.exportModel(), 'Exportieren');
    this.status = h('div', 'status', ICONS.warn);
    const home = button('btn labeled', lab(ICONS3D.home, 'Ansicht'), () => this.view.resetView(), 'Ansicht zurücksetzen');
    const group = h('div', 'top-group');
    group.append(this.btn.undo, this.btn.redo, this.btn.copy, this.btn.del);
    const groupCombine = h('div', 'top-group');
    groupCombine.append(this.btn.hole, this.btn.merge);
    const group2 = h('div', 'top-group');
    group2.append(this.status, home, this.btn.export);
    top.append(back, h('div', 'top-center'), groupCombine, group, group2);

    const body = h('div', 'editor-body');
    const rail = h('div', 'rail left-rail');
    // Körper aus der Auswahl; Zeichnen: Umriss festlegen, danach die Höhe geben
    this.railBtn.body = button('btn labeled tool', lab(KIND_ICONS.box, 'Körper'), () => void this.pickKind(), 'Körper');
    this.railBtn.shapes = button('btn labeled tool', lab(ICONS.shapes, 'Formen'), () => void this.drawShape(), 'Formen');
    this.railBtn.draw = button('btn labeled tool', lab(ICONS.draw, 'Freihand'), () => void this.drawSketch(), 'Freihand');
    this.railBtn.text = button('btn labeled tool', lab(ICONS.text, 'Text'), () => void this.drawText(), 'Text');
    this.railBtn.svg = button('btn labeled tool', lab(ICONS.svgUp, 'SVG'), () => this.drawSvg(), 'SVG-Datei');
    rail.append(this.railBtn.body, h('div', 'rail-sep'), this.railBtn.shapes, this.railBtn.draw, this.railBtn.text, this.railBtn.svg);

    // rechte Leiste: Körper umformen
    const right = h('div', 'rail right-rail');
    this.railBtn.tilt = button('btn labeled tool', lab(ICONS3D.tilt, 'Kippen'), () => this.toggleTilt(), 'Kippen');
    this.railBtn.mirror = button('btn labeled tool', lab(ICONS3D.mirror, 'Spiegeln'), () => this.mirror(), 'Spiegeln');
    this.railBtn.align = button('btn labeled tool', lab(ICONS3D.align, 'Ausrichten'), () => this.align(), 'Ausrichten');
    right.append(this.railBtn.tilt, this.railBtn.mirror, this.railBtn.align);

    const stage = h('div', 'stage');
    this.stage = stage;
    const host = h('div', 'view-host');
    stage.append(host, this.buildDims());
    body.append(rail, stage, right);
    this.root.append(top, body);

    this.view = new View3d(host, this.printer.bed, {
      select: (id) => this.select(id),
      update: (id, next) => this.replace(id, next),
      commit: () => this.commit(),
    });
    this.refresh();
    this.startGuide();
    // Beim Wechseln der App/Schließen sofort sichern
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
  }

  destroy(): void {
    this.coach?.destroy();
    clearTimeout(this.saveTimer);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onHide);
    this.view.destroy();
  }

  // ---------- Speichern (automatisch nach jeder Änderung) ----------
  private onHide = (): void => {
    if (document.visibilityState === 'hidden' || document.visibilityState === undefined) void this.saveNow();
  };

  private scheduleSave(): void {
    this.dirty = true;
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.saveNow(), 600);
  }

  /** Arbeit sichern (mit Vorschaubild). Mehrere Aufrufe laufen nacheinander. */
  saveNow(): Promise<void> {
    clearTimeout(this.saveTimer);
    this.saving = this.saving.then(async () => {
      if (!this.dirty) return;
      if (this.parts.length === 0 && !this.everSaved) {
        this.dirty = false;
        return;
      }
      this.dirty = false;
      try {
        const thumb = this.view.snapshot() ?? undefined;
        this.design = packDesign({ id: this.design.id, created: this.design.created, thumb, guide: this.design.guide }, this.parts);
        await storage.saveDesign(this.o.profile.id, this.design);
        this.everSaved = true;
      } catch {
        this.dirty = true;
        this.saveTimer = window.setTimeout(() => void this.saveNow(), 5000); // später nochmal versuchen
      }
    });
    return this.saving;
  }

  /** Zur Galerie: erst sichern. */
  private async exit(): Promise<void> {
    await this.saveNow();
    this.o.onExit();
  }

  // ---------- Maße-Leiste ----------
  private buildDims(): HTMLElement {
    this.dims = h('div', 'dims');
    for (const d of DIMS) {
      const b = button('dim', `<span class="dim-ico">${d.icon}</span><span class="dim-val"></span><span class="dim-unit">${d.unit}</span>`, () => void this.editDim(d.field), d.label);
      this.dimEls.set(d.field, b.querySelector('.dim-val')!);
      this.dimBtns.set(d.field, b);
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
    this.scheduleSave();
  }

  private add(kind: PartKind): void {
    const spot = findFreeSpot(kind, this.parts, this.printer.bed);
    const p = createPart(kind, spot.x, spot.y);
    this.parts = [...this.parts, p];
    this.selectedId = p.id;
    this.commit();
  }

  // ---------- Kombinieren ----------
  /** Voll <-> Loch: ein Loch wird nicht gedruckt, sondern schneidet beim Vereinen aus. */
  private toggleHole(): void {
    const p = this.selected();
    if (!p) return;
    this.replace(p.id, { ...p, hole: !p.hole });
    this.commit();
  }

  /** Den gewählten Körper mit allen, die ihn berühren, zu einem Teil vereinen (Löcher schneiden aus). */
  private async merge(): Promise<void> {
    const p = this.selected();
    if (!p) return;
    const busy = busyOverlay();
    const r = await combine(p.id, this.parts).catch(() => ({ kind: 'error' as const }));
    busy.close();
    if (r.kind !== 'ok') return notify(ICONS.warn); // nichts berührt den Körper, oder ein Körper ist nicht in Ordnung
    this.parts = [...this.parts.filter((q) => !r.ids.includes(q.id)), ...(r.part ? [r.part] : [])];
    this.selectedId = r.part?.id ?? null;
    this.commit();
  }

  // ---------- Exportieren ----------
  /** Druckprüfung zeigen, Dateiart wählen, Dateiname vom Kind tippen lassen, speichern (STL/3MF). */
  private async exportModel(): Promise<void> {
    const f = await exportParts(this.parts, this.printer, this.format);
    if (f) {
      this.format = f;
      this.exported = true; // für die Werkstatt: abgeschickt
      this.coach?.update(true);
    }
  }

  private async pickKind(): Promise<void> {
    const kind = await openKindPicker();
    if (kind === 'tube') this.addSpecial(makeTubePart(this.printer.bed, 24, 60));
    else if (kind === 'gear') {
      const n = await openNumpad({ icon: SPECIAL_ICONS.gear, value: 10, unit: 'Zähne', min: MIN_TEETH, max: MAX_TEETH });
      if (n !== null) this.addSpecial(makeGearPart(n, 5, this.printer.bed));
    } else if (kind) this.add(kind);
  }

  /** Röhre oder Zahnrad auf einen freien Platz setzen. */
  private addSpecial(part: Part): void {
    const spot = findFreeSpot(part, this.parts, this.printer.bed);
    const p = { ...part, x: spot.x, y: spot.y };
    this.parts = [...this.parts, p];
    this.selectedId = p.id;
    this.commit();
  }

  // ---------- Zeichnen: Umriss -> Körper mit Höhe ----------
  private async drawShape(): Promise<void> {
    const r = await openShapePicker();
    if (r) await this.addDrawn(r.shape, { longest: 40 }, 10, `shape:${r.id}`);
  }

  private async drawSketch(): Promise<void> {
    const shape = await openSketch();
    if (shape) await this.addDrawn(shape, { longest: 50 }, 8, 'sketch');
  }

  private async drawText(): Promise<void> {
    const r = await openTextDialog();
    if (r) await this.addDrawn(r.shape, { scale: r.scale }, 5, 'text');
  }

  private drawSvg(): void {
    pickSvg(
      (shape) => void this.addDrawn(shape, { longest: 50 }, 8, 'svg'),
      () => notify(ICONS.warn),
    );
  }

  /** Umriss als Körper auf freien Platz setzen, dann nach der Höhe fragen (Abbrechen behält die Starthöhe). */
  private async addDrawn(shape: Shape, size: OutlineSize, height: number, tag?: string): Promise<void> {
    const probe = makeOutlinePart(shape, size, height, this.printer.bed, 0, 0, tag);
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
    // Wurde dieser Körper selbst als Kopie gemacht und verschoben, springt die neue Kopie gleich weit
    const srcId = this.copyOf.get(p.id);
    const [dx, dy, dz] = copyOffset(p, srcId ? this.parts.find((q) => q.id === srcId) : undefined);
    const c: Part = { ...p, id: newId(), x: p.x + dx, y: p.y + dy, z: p.z + dz };
    this.copyOf.set(c.id, p.id);
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
    // lag der Körper auf etwas (z. B. Text auf einem Quader), landet er in der Mitte auf dem, was dort ist
    const others = this.parts.filter((q) => q.id !== p.id);
    const resting = Math.abs(p.z - supportHeight(p, others, p)) < 0.05;
    const moved = centered(p);
    this.replace(p.id, resting ? restOn(moved, others, p) : moved);
    this.commit();
  }

  private restore(parts: Part[] | null): void {
    if (!parts) return;
    this.parts = cloneParts(parts);
    if (!this.selected()) this.selectedId = null;
    this.refresh();
    this.scheduleSave();
  }

  private undo(): void {
    this.restore(this.history.undo());
  }

  private redo(): void {
    this.restore(this.history.redo());
  }

  private refresh(): void {
    const outside = new Set(this.parts.filter((p) => !p.hole && isOutside(p, this.printer.bed)).map((p) => p.id)); // Löcher werden nicht gedruckt
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
    this.btn.hole.disabled = !sel;
    this.btn.hole.classList.toggle('active', !!sel?.hole);
    this.btn.merge.disabled = !sel;
    for (const k of ['tilt', 'mirror', 'align'] as const) this.railBtn[k].disabled = !sel;
    if (!sel && this.tiltPanel) this.closeTilt();
    this.status.classList.toggle('bad', outside.size > 0);
    this.coach?.update();
  }

  // ---------- Umformen: Kippen, Spiegeln, Ausrichten ----------
  /** Kipp-Fenster auf/zu: Pfeile kippen den gewählten Körper um die gewählte Gradzahl. */
  private toggleTilt(): void {
    if (this.tiltPanel) return this.closeTilt();
    if (!this.selected()) return;
    const panel = h('div', 'tilt-panel');
    const arrow = (txt: string, label: string, axis: 'x' | 'y', sign: 1 | -1, cls: string) =>
      button(`tilt-arrow ${cls}`, txt, () => this.tilt(axis, sign * this.tiltStep), label);
    const steps = h('div', 'tilt-steps');
    const chips: HTMLButtonElement[] = [];
    for (const d of [5, 15, 45, 90]) {
      const c = button('tilt-chip' + (d === this.tiltStep ? ' active' : ''), `${d}°`, () => {
        this.tiltStep = d;
        chips.forEach((x, i) => x.classList.toggle('active', [5, 15, 45, 90][i] === d));
      }, `${d} Grad`);
      chips.push(c);
      steps.append(c);
    }
    const pad = h('div', 'tilt-pad');
    // oben = nach hinten kippen (Oberseite wandert nach hinten), unten = nach vorn, links/rechts entsprechend
    pad.append(arrow('⬆️', 'Nach hinten kippen', 'x', -1, 'up'), arrow('⬅️', 'Nach links kippen', 'y', -1, 'left'), arrow('➡️', 'Nach rechts kippen', 'y', 1, 'right'), arrow('⬇️', 'Nach vorn kippen', 'x', 1, 'down'));
    panel.append(pad, steps, button('tilt-close', ICONS.check, () => this.closeTilt(), 'Fertig'));
    this.stage.append(panel);
    this.tiltPanel = panel;
    this.railBtn.tilt.classList.add('active');
  }

  private closeTilt(): void {
    this.tiltPanel?.remove();
    this.tiltPanel = null;
    this.railBtn.tilt.classList.remove('active');
  }

  private tilt(axis: 'x' | 'y', deg: number): void {
    const p = this.selected();
    if (!p) return;
    this.replace(p.id, tiltPart(p, axis, deg));
    this.commit();
  }

  /** Links und rechts vertauschen. */
  private mirror(): void {
    const p = this.selected();
    if (!p) return;
    this.replace(p.id, mirrorPart(p));
    this.commit();
  }

  /** Mitte auf Mitte mit dem Körper, auf/neben dem er liegt. */
  private align(): void {
    const p = this.selected();
    if (!p) return;
    const a = alignCenter(p, this.parts);
    if (!a) return notify(ICONS.warn); // nichts in der Nähe
    this.replace(p.id, a);
    this.commit();
  }

  // ---------- 3D-Werkstatt: Coach ----------
  private startGuide(): void {
    const g = this.design.guide;
    const project = g ? projectByNumber(g.project) : undefined;
    if (!g || !project) return;
    this.coach = new Coach(project, g as GuideState, {
      snapshot: () => this.snapshot(),
      targets: (k) => this.targets(k),
      changed: () => {
        this.design.guide = g;
        this.scheduleSave();
      },
      finished: () => openFinish(project, { onGallery: () => void this.exitTo(this.o.onGallery), onWerkstatt: () => void this.exitTo(this.o.onWerkstatt) }),
    });
    this.stage.prepend(this.coach.el);
  }

  private async exitTo(fn?: () => void): Promise<void> {
    await this.saveNow();
    (fn ?? this.o.onExit)();
  }

  /** Stand für die Prüfung der Schritte. */
  snapshot(): Snapshot {
    return { parts: this.parts, selected: this.selected() ?? null, exported: this.exported, bed: this.printer.bed };
  }

  /** Tasten und Felder, die der Coach hervorheben kann. */
  private targets(k: Highlight): HTMLElement[] {
    const dim = (f: DimField): HTMLElement[] => (this.dimBtns.get(f) ? [this.dimBtns.get(f)!] : []);
    switch (k) {
      case 'body': return [this.railBtn.body];
      case 'shapes': return [this.railBtn.shapes];
      case 'draw': return [this.railBtn.draw];
      case 'text': return [this.railBtn.text];
      case 'svg': return [this.railBtn.svg];
      case 'tilt': return [this.railBtn.tilt];
      case 'mirror': return [this.railBtn.mirror];
      case 'align': return [this.railBtn.align];
      case 'hole': return [this.btn.hole];
      case 'merge': return [this.btn.merge];
      case 'copy': return [this.btn.copy];
      case 'delete': return [this.btn.del];
      case 'undo': return [this.btn.undo];
      case 'export': return [this.btn.export];
      case 'lock': return [this.lockBtn];
      case 'width': return dim('w');
      case 'depth': return dim('d');
      case 'height': return dim('h');
      case 'rot': return dim('rot');
      case 'z': return dim('z');
      default: return [];
    }
  }

}
