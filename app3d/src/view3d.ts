// 3D-Ansicht (three.js): Druckbett, Körper, Auswahl mit Griffen, Kamera per Touch.
// Gesten: Finger auf einem Körper = auswählen/verschieben, auf einem Griff = Größe/Höhe/Drehen,
// auf leerer Fläche = Ansicht drehen, zwei Finger = zoomen/verschieben.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Bed } from './bed';
import { closestZOnVertical, rayPlaneZ, resizeFromGround, resizeHeight, rotateFromGround } from './gizmo';
import { unitMesh, type PartKind } from './mesh';
import { snap, type Part } from './model3d';
import { FOV_DEG, cameraPosition, defaultOrbit, orbitPan, orbitRotate, orbitZoom, type Orbit, type Vec3 } from './orbit';

const COLORS = {
  bg: 0xf3f6fb,
  plate: 0xdfe6f2,
  grid: 0xc3cde0,
  grid10: 0xaab6d0,
  volume: 0x38b8e8,
  part: 0x98c227,
  selected: 0x38b8e8,
  outside: 0xe01070,
  hSize: 0xf0a030,
  hHeight: 0x38b8e8,
  hRotate: 0xe01070,
};

const HANDLE_PX = 15; // sichtbarer Radius der Griffe in Pixeln
const HIT_PX = 34; // Trefferradius (Finger sind dick)

type DragKind = 'move' | 'size' | 'height' | 'rotate';

export interface ViewHooks {
  select(id: string | null): void;
  /** Körper während des Ziehens ändern (noch nicht für Rückgängig festhalten). */
  update(id: string, next: Part): void;
  /** Ziehen beendet. */
  commit(): void;
}

interface Drag {
  kind: DragKind;
  id: string;
  start: Part;
  grab: [number, number]; // Bodenpunkt beim Start (Ebene z = start.z)
  grabZ: number; // Höhe auf der senkrechten Linie beim Start (Höhen-Griff)
  offset: [number, number]; // Verschieben: Abstand zwischen Mitte und Bodenpunkt
}

export class View3d {
  readonly canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 1, 5000);
  private bedGroup = new THREE.Group();
  private partGroup = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  private geometries = new Map<PartKind, THREE.BufferGeometry>();
  private mats = {
    part: new THREE.MeshStandardMaterial({ color: COLORS.part, roughness: 0.55 }),
    selected: new THREE.MeshStandardMaterial({ color: COLORS.selected, roughness: 0.55 }),
    outside: new THREE.MeshStandardMaterial({ color: COLORS.outside, roughness: 0.55, transparent: true, opacity: 0.85 }),
  };
  private handles = new THREE.Group();
  private hSize!: THREE.Mesh;
  private hHeight!: THREE.Mesh;
  private hRotate!: THREE.Mesh;
  private ring!: THREE.LineLoop;
  private hitSize!: THREE.Mesh;
  private hitHeight!: THREE.Mesh;
  private hitRotate!: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private orbit: Orbit;
  private bed: Bed;
  private parts: Part[] = [];
  private selectedId: string | null = null;
  private lock = true;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: Drag | null = null;
  private camMode = false; // Kamera bewegen statt Körper
  private moved = 0;
  private dirty = true;
  private raf = 0;
  private ro: ResizeObserver;

  constructor(private host: HTMLElement, bed: Bed, private hooks: ViewHooks) {
    this.bed = bed;
    this.orbit = defaultOrbit(bed);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(COLORS.bg);
    this.camera.up.set(0, 0, 1); // z zeigt nach oben
    this.scene.add(this.bedGroup, this.partGroup, this.handles);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa7c4, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-150, -250, 400);
    this.scene.add(sun);

    this.buildBed();
    this.buildHandles();
    host.append(this.canvas);
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block';
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop();
  }

  /** Neues Druckbett (z. B. nach Änderung der Einstellungen). */
  setBed(bed: Bed): void {
    this.bed = bed;
    this.buildBed();
    this.resetView();
  }

  resetView(): void {
    this.orbit = defaultOrbit(this.bed);
    this.invalidate();
  }

  /** Seitenverhältnis-Sperre (Schloss) für das Ziehen an den Griffen. */
  setLock(lock: boolean): void {
    this.lock = lock;
  }

  /** Körper, Auswahl und die Körper außerhalb des Bauraums (rot) anzeigen. */
  setParts(parts: Part[], selectedId: string | null, outside: Set<string>): void {
    this.parts = parts;
    this.selectedId = selectedId;
    const live = new Set(parts.map((p) => p.id));
    for (const [id, m] of this.meshes)
      if (!live.has(id)) {
        this.partGroup.remove(m);
        this.meshes.delete(id);
      }
    for (const p of parts) {
      let m = this.meshes.get(p.id);
      if (!m) {
        m = new THREE.Mesh(this.geometryFor(p.kind), this.mats.part);
        m.userData.id = p.id;
        m.userData.kind = p.kind;
        this.meshes.set(p.id, m);
        this.partGroup.add(m);
      }
      if (m.userData.kind !== p.kind) {
        m.geometry = this.geometryFor(p.kind);
        m.userData.kind = p.kind;
      }
      m.position.set(p.x, p.y, p.z);
      m.rotation.z = (p.rot * Math.PI) / 180;
      m.scale.set(p.w, p.d, p.h);
      m.material = outside.has(p.id) ? this.mats.outside : p.id === selectedId ? this.mats.selected : this.mats.part;
    }
    this.invalidate();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.dispose();
    this.canvas.remove();
  }

  // ---------- Aufbau ----------
  private geometryFor(kind: PartKind): THREE.BufferGeometry {
    let g = this.geometries.get(kind);
    if (!g) {
      const m = unitMesh(kind);
      const base = new THREE.BufferGeometry();
      base.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3));
      base.setIndex(m.idx);
      g = toCreasedNormals(base, (35 * Math.PI) / 180); // Kanten bleiben scharf, Rundungen glatt
      base.dispose();
      this.geometries.set(kind, g);
    }
    return g;
  }

  private buildBed(): void {
    const { width: w, depth: d, height: h } = this.bed;
    for (const c of [...this.bedGroup.children]) {
      this.bedGroup.remove(c);
      (c as THREE.Mesh).geometry?.dispose();
    }
    // Platte (dünn, knapp unter z = 0)
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, d, 2), new THREE.MeshStandardMaterial({ color: COLORS.plate, roughness: 0.9 }));
    plate.position.z = -1.05;
    this.bedGroup.add(plate);
    // Raster alle 10 mm, jede 5. Linie (50 mm) kräftiger
    const pts: number[] = [];
    const strong: number[] = [];
    for (let x = Math.ceil(-w / 2 / 10) * 10; x <= w / 2; x += 10) (x % 50 === 0 ? strong : pts).push(x, -d / 2, 0.02, x, d / 2, 0.02);
    for (let y = Math.ceil(-d / 2 / 10) * 10; y <= d / 2; y += 10) (y % 50 === 0 ? strong : pts).push(-w / 2, y, 0.02, w / 2, y, 0.02);
    for (const [arr, color] of [[pts, COLORS.grid], [strong, COLORS.grid10]] as const) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      this.bedGroup.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color })));
    }
    // Bauraum als dünner Rahmen
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, d, h));
    const frame = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: COLORS.volume, transparent: true, opacity: 0.45 }));
    frame.position.z = h / 2;
    this.bedGroup.add(frame);
  }

  private buildHandles(): void {
    const ball = (color: number): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color, depthTest: false }));
      m.renderOrder = 10;
      return m;
    };
    const hit = (): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      return m;
    };
    this.hSize = ball(COLORS.hSize);
    this.hHeight = ball(COLORS.hHeight);
    this.hRotate = ball(COLORS.hRotate);
    this.hitSize = hit();
    this.hitHeight = hit();
    this.hitRotate = hit();
    const seg = 64;
    const rp: number[] = [];
    for (let i = 0; i < seg; i++) rp.push(Math.cos((i / seg) * Math.PI * 2), Math.sin((i / seg) * Math.PI * 2), 0);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    this.ring = new THREE.LineLoop(rg, new THREE.LineBasicMaterial({ color: COLORS.hRotate, transparent: true, opacity: 0.6, depthTest: false }));
    this.ring.renderOrder = 9;
    this.handles.add(this.ring, this.hSize, this.hHeight, this.hRotate, this.hitSize, this.hitHeight, this.hitRotate);
    this.handles.visible = false;
  }

  /** Griffe an den gewählten Körper setzen; Größe in Pixeln bleibt immer gleich. */
  private placeHandles(): void {
    const p = this.parts.find((q) => q.id === this.selectedId);
    this.handles.visible = !!p;
    if (!p) return;
    const camPos = this.camera.position;
    const pxToWorld = (at: THREE.Vector3): number => {
      const dist = camPos.distanceTo(at);
      return (2 * Math.tan((FOV_DEG * Math.PI) / 360) * dist) / Math.max(1, this.host.clientHeight);
    };
    const c = Math.cos((p.rot * Math.PI) / 180);
    const s = Math.sin((p.rot * Math.PI) / 180);
    const local = (lx: number, ly: number, z: number): THREE.Vector3 => new THREE.Vector3(p.x + lx * c - ly * s, p.y + lx * s + ly * c, z);
    const put = (vis: THREE.Mesh, hit: THREE.Mesh, at: THREE.Vector3): void => {
      const k = pxToWorld(at);
      vis.position.copy(at);
      vis.scale.setScalar(HANDLE_PX * k);
      hit.position.copy(at);
      hit.scale.setScalar(HIT_PX * k);
    };
    // Größe: untere Ecke (+w/2, +d/2); Höhe: über der Mitte; Drehen: auf dem Ring vor dem Körper
    put(this.hSize, this.hitSize, local(p.w / 2, p.d / 2, p.z));
    const top = new THREE.Vector3(p.x, p.y, p.z + p.h);
    top.z += HANDLE_PX * 2.2 * pxToWorld(top);
    put(this.hHeight, this.hitHeight, top);
    const R = Math.hypot(p.w, p.d) / 2 + 8;
    this.ring.position.set(p.x, p.y, p.z + 0.05);
    this.ring.scale.set(R, R, 1);
    put(this.hRotate, this.hitRotate, local(0, -R, p.z + 0.05));
  }

  private invalidate(): void {
    this.dirty = true;
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  // Nur zeichnen, wenn sich etwas geändert hat (schont den Akku).
  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.dirty) return;
    this.dirty = false;
    const [px, py, pz] = cameraPosition(this.orbit);
    this.camera.position.set(px, py, pz);
    this.camera.lookAt(this.orbit.target[0], this.orbit.target[1], this.orbit.target[2]);
    this.camera.updateMatrixWorld();
    this.placeHandles();
    this.renderer.render(this.scene, this.camera);
  };

  // ---------- Strahlen ----------
  private setRay(clientX: number, clientY: number): { o: Vec3; d: Vec3 } {
    const r = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), this.camera);
    const { origin, direction } = this.raycaster.ray;
    return { o: [origin.x, origin.y, origin.z], d: [direction.x, direction.y, direction.z] };
  }

  private groundAt(clientX: number, clientY: number, z: number): [number, number] | null {
    const { o, d } = this.setRay(clientX, clientY);
    return rayPlaneZ(o, d, z);
  }

  private pickHandle(): DragKind | null {
    if (!this.handles.visible) return null;
    const hits = this.raycaster.intersectObjects([this.hitSize, this.hitHeight, this.hitRotate], false);
    if (!hits.length) return null;
    const o = hits[0].object;
    return o === this.hitSize ? 'size' : o === this.hitHeight ? 'height' : 'rotate';
  }

  private pickPart(): string | null {
    const hits = this.raycaster.intersectObjects([...this.meshes.values()], false);
    return hits.length ? (hits[0].object.userData.id as string) : null;
  }

  // ---------- Gesten ----------
  private onDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size > 1) {
      // zweiter Finger: Körper-Ziehen abbrechen, ab jetzt bewegt sich die Kamera
      if (this.drag) this.endDrag();
      this.camMode = true;
      return;
    }
    this.moved = 0;
    this.camMode = false;
    this.setRay(e.clientX, e.clientY);
    const handle = this.pickHandle();
    const sel = this.parts.find((p) => p.id === this.selectedId);
    if (handle && sel) return this.beginDrag(handle, sel, e);
    const id = this.pickPart();
    if (id && !e.shiftKey && (e.buttons & 2) === 0) {
      this.hooks.select(id);
      const p = this.parts.find((q) => q.id === id);
      if (p) this.beginDrag('move', p, e);
      return;
    }
    this.camMode = true; // leere Fläche: Ansicht drehen
  };

  private beginDrag(kind: DragKind, p: Part, e: PointerEvent): void {
    const g = this.groundAt(e.clientX, e.clientY, p.z) ?? [p.x, p.y];
    const ray = this.setRay(e.clientX, e.clientY);
    const gz = closestZOnVertical(ray.o, ray.d, p.x, p.y) ?? p.z + p.h;
    this.drag = { kind, id: p.id, start: { ...p }, grab: g, grabZ: gz, offset: [p.x - g[0], p.y - g[1]] };
  }

  private endDrag(): void {
    if (this.drag) this.hooks.commit();
    this.drag = null;
  }

  private onMove = (e: PointerEvent): void => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    this.moved += Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const h = this.host.clientHeight;
    if (this.drag && this.pointers.size === 1) {
      this.dragTo(e);
    } else if (this.pointers.size === 1 && this.camMode) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      // Maus: Umschalttaste oder rechte Taste = verschieben; sonst drehen
      this.orbit = e.shiftKey || (e.buttons & 2) !== 0 ? orbitPan(this.orbit, dx, dy, h, this.bed) : orbitRotate(this.orbit, dx, dy);
    } else if (this.pointers.size === 2) {
      const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
      const mx = (cur.x - prev.x) / 2; // Mittelpunkt wandert um die halbe Bewegung dieses Fingers
      const my = (cur.y - prev.y) / 2;
      if (d0 > 0 && d1 > 0) this.orbit = orbitZoom(this.orbit, d1 / d0, this.bed);
      this.orbit = orbitPan(this.orbit, mx, my, h, this.bed);
    }
    this.pointers.set(e.pointerId, cur);
    this.invalidate();
  };

  private dragTo(e: PointerEvent): void {
    const dr = this.drag!;
    const s = dr.start;
    let next: Part | null = null;
    if (dr.kind === 'height') {
      const ray = this.setRay(e.clientX, e.clientY);
      const z = closestZOnVertical(ray.o, ray.d, s.x, s.y);
      if (z !== null) next = resizeHeight(s, z - dr.grabZ, this.lock);
    } else {
      const g = this.groundAt(e.clientX, e.clientY, s.z);
      if (!g) return;
      if (dr.kind === 'move') next = { ...s, x: snap(g[0] + dr.offset[0]), y: snap(g[1] + dr.offset[1]) };
      else if (dr.kind === 'size') next = resizeFromGround(s, dr.grab, g, this.lock);
      else next = rotateFromGround(s, dr.grab, g);
    }
    if (next) {
      next = { ...next, w: Math.round(next.w * 10) / 10, d: Math.round(next.d * 10) / 10, h: Math.round(next.h * 10) / 10 };
      this.hooks.update(dr.id, next);
    }
  }

  private onUp = (e: PointerEvent): void => {
    const wasSingle = this.pointers.size === 1;
    this.pointers.delete(e.pointerId);
    if (this.drag) this.endDrag();
    // Antippen der leeren Fläche (ohne Ziehen) wählt ab
    if (wasSingle && this.camMode && this.moved < 6 && e.type === 'pointerup') this.hooks.select(null);
    if (this.pointers.size === 0) this.camMode = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.orbit = orbitZoom(this.orbit, Math.exp(-e.deltaY * 0.0015), this.bed);
    this.invalidate();
  };
}
