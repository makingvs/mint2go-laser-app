// 3D-Ansicht (three.js): Druckbett, Körper, Auswahl mit Griffen, Kamera per Touch.
// Gesten: Finger auf einem Körper = auswählen/verschieben, auf einem Griff = Größe/Höhe/Drehen,
// auf leerer Fläche = Ansicht drehen, zwei Finger = zoomen/verschieben.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Bed } from './bed';
import { closestZOnVertical, liftHandleXY, liftZ, rayPlaneZ, resizeFromGround, resizeHeight, rotateFromGround } from './gizmo';
import { meshOf, partBounds, snap, type Part } from './model3d';
import { snapToCenters, supportHeight } from './support';
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
  hole: 0xf0a030,
  hSize: 0xf0a030,
  hHeight: 0x38b8e8,
  hRotate: 0xe01070,
  hLift: 0x3a9d23,
};

const HANDLE_PX = 18; // sichtbarer Radius der Griffe in Pixeln
const HIT_PX = 44; // Trefferradius (Finger sind dick)
// Abstände der Griffe vom Körper in Bildschirm-Pixeln: So liegen sie auch bei kleinen Körpern weit genug auseinander
const GAP_HEIGHT = 56; // Höhen-Griff über der Oberseite
const GAP_SIZE = 40; // Größen-Griff außerhalb der Ecke
const GAP_LIFT = 64; // Anheben-Griff links neben dem Körper
const RING_MIN = 92; // kleinster Radius des Dreh-Rings

/** Gleiche Schlüssel = gleiche Form (Grundkörper nach Art, gezeichnete Körper nach Umriss-Nummer). */
const geometryKey = (p: Part): string => (p.kind === 'extrude' ? `x:${p.outline?.id}` : p.kind === 'mesh' ? `m:${p.meshId}` : p.kind);

type DragKind = 'move' | 'size' | 'height' | 'rotate' | 'lift';

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
  grabZ: number; // Höhe auf der senkrechten Linie beim Start (Höhen- und Anheben-Griff)
  liftExtra: number; // Abstand des Anheben-Griffs beim Start des Ziehens
  resting: boolean; // Verschieben: liegt der Körper auf dem, was unter ihm ist? Dann fällt er beim Schieben auf die neue Auflage
  offset: [number, number]; // Verschieben: Abstand zwischen Mitte und Bodenpunkt
}

export class View3d {
  readonly canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 1, 5000);
  private bedGroup = new THREE.Group();
  private frame: THREE.LineSegments | null = null;
  private partGroup = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  private geometries = new Map<string, THREE.BufferGeometry>();
  private mats = {
    part: new THREE.MeshStandardMaterial({ color: COLORS.part, roughness: 0.55 }),
    selected: new THREE.MeshStandardMaterial({ color: COLORS.selected, roughness: 0.55 }),
    outside: new THREE.MeshStandardMaterial({ color: COLORS.outside, roughness: 0.55, transparent: true, opacity: 0.85 }),
    // Löcher: durchscheinend, damit man sieht, was sie später ausschneiden
    hole: new THREE.MeshStandardMaterial({ color: COLORS.hole, roughness: 0.6, transparent: true, opacity: 0.45, depthWrite: false }),
    holeSelected: new THREE.MeshStandardMaterial({ color: COLORS.selected, roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false }),
  };
  private handles = new THREE.Group();
  private hSize!: THREE.Mesh;
  private hHeight!: THREE.Mesh;
  private hRotate!: THREE.Mesh;
  private hLift!: THREE.Mesh;
  private liftLine!: THREE.Line;
  private liftExtra = 0; // Abstand des Anheben-Griffs von der Seitenwand (mm), zuletzt gezeichnet
  private hitLift!: THREE.Mesh;
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
        m = new THREE.Mesh(this.geometryFor(p), this.mats.part);
        m.userData.id = p.id;
        m.userData.key = geometryKey(p);
        this.meshes.set(p.id, m);
        this.partGroup.add(m);
      }
      if (m.userData.key !== geometryKey(p)) {
        m.geometry = this.geometryFor(p);
        m.userData.key = geometryKey(p);
      }
      m.position.set(p.x, p.y, p.z);
      m.rotation.z = (p.rot * Math.PI) / 180;
      m.scale.set(p.w, p.d, p.h);
      m.material = p.hole
        ? p.id === selectedId
          ? this.mats.holeSelected
          : this.mats.hole
        : outside.has(p.id)
          ? this.mats.outside
          : p.id === selectedId
            ? this.mats.selected
            : this.mats.part;
      m.renderOrder = p.hole ? 2 : 0; // Löcher zuletzt, damit sie über den Körpern liegen
    }
    this.invalidate();
  }

  /**
   * Vorschaubild der ganzen Arbeit für die Galerie (JPEG als data-URL, 4:3), null wenn nichts da ist.
   * Zeigt alle Körper ohne Auswahl und Griffe; die Ansicht bleibt danach unverändert.
   */
  snapshot(width = 320, height = 240): string | null {
    if (!this.parts.length) return null;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const p of this.parts) {
      const b = partBounds(p);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], b.min[k]);
        max[k] = Math.max(max[k], b.max[k]);
      }
    }
    const radius = Math.max(10, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
    const saved = { orbit: this.orbit, handles: this.handles.visible, frame: this.frame?.visible ?? true, mats: new Map<THREE.Mesh, THREE.Material | THREE.Material[]>() };
    const plain = new Map<THREE.Material, THREE.Material>([[this.mats.selected, this.mats.part], [this.mats.holeSelected, this.mats.hole]]);
    for (const m of this.meshes.values()) {
      saved.mats.set(m, m.material);
      const swap = plain.get(m.material as THREE.Material);
      if (swap) m.material = swap;
    }
    try {
      const home = defaultOrbit(this.bed);
      const aspect = this.canvas.width / Math.max(1, this.canvas.height);
      const dist = (radius / Math.sin(((FOV_DEG / 2) * Math.PI) / 180)) * 1.15 * Math.max(1, (4 / 3) / aspect);
      const orbit: Orbit = { ...home, dist, target: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2] };
      const [px, py, pz] = cameraPosition(orbit);
      this.camera.position.set(px, py, pz);
      this.camera.lookAt(orbit.target[0], orbit.target[1], orbit.target[2]);
      this.camera.updateMatrixWorld();
      this.handles.visible = false;
      if (this.frame) this.frame.visible = false;
      this.renderer.render(this.scene, this.camera);
      // 4:3 aus der Mitte ausschneiden und verkleinern (toDataURL gleich nach dem Zeichnen, sonst ist der Puffer leer)
      const src = this.canvas;
      const sw = Math.min(src.width, (src.height * width) / height);
      const sh = (sw * height) / width;
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      c.getContext('2d')!.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, width, height);
      return c.toDataURL('image/jpeg', 0.75);
    } catch {
      return null;
    } finally {
      for (const [m, mat] of saved.mats) m.material = mat;
      this.handles.visible = saved.handles;
      if (this.frame) this.frame.visible = saved.frame;
      this.orbit = saved.orbit;
      this.invalidate();
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.dispose();
    this.canvas.remove();
  }

  // ---------- Aufbau ----------
  private geometryFor(p: Part): THREE.BufferGeometry {
    const key = geometryKey(p);
    let g = this.geometries.get(key);
    if (!g) {
      const m = meshOf(p);
      const base = new THREE.BufferGeometry();
      base.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3));
      base.setIndex(m.idx);
      g = toCreasedNormals(base, (35 * Math.PI) / 180); // Kanten bleiben scharf, Rundungen glatt
      base.dispose();
      this.geometries.set(key, g);
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
    this.frame = frame;
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
    this.hLift = ball(COLORS.hLift);
    this.hitLift = hit();
    // Linie vom Anheben-Griff zum Bett: zeigt, wie hoch der Körper schwebt
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3));
    this.liftLine = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: COLORS.hLift, transparent: true, opacity: 0.7, depthTest: false }));
    this.liftLine.renderOrder = 9;
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
    this.handles.add(this.ring, this.liftLine, this.hSize, this.hHeight, this.hRotate, this.hLift, this.hitSize, this.hitHeight, this.hitRotate, this.hitLift);
    this.handles.visible = false;
  }

  /** Griffe an den gewählten Körper setzen. Größe und Abstand in Pixeln bleiben immer gleich (auch bei kleinen Körpern und beim Zoomen). */
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
    const mid = new THREE.Vector3(p.x, p.y, p.z + p.h / 2);
    const k = pxToWorld(mid); // mm pro Pixel in Höhe des Körpers
    // Höhe: über der Mitte
    const top = new THREE.Vector3(p.x, p.y, p.z + p.h);
    top.z += GAP_HEIGHT * pxToWorld(top);
    put(this.hHeight, this.hitHeight, top);
    // Größe: Ecke (+w/2, +d/2) auf dem Bett, ein Stück nach außen (Diagonale)
    const out = (GAP_SIZE * k) / Math.SQRT2;
    put(this.hSize, this.hitSize, local(p.w / 2 + out, p.d / 2 + out, p.z));
    // Drehen: auf einem Ring vor dem Körper, mindestens RING_MIN Pixel Radius
    const R = Math.max(Math.hypot(p.w, p.d) / 2 + 16 * k, RING_MIN * k);
    this.ring.position.set(p.x, p.y, p.z + 0.05);
    this.ring.scale.set(R, R, 1);
    put(this.hRotate, this.hitRotate, local(0, -R, p.z + 0.05));
    // Anheben: links neben dem Körper auf halber Höhe; die Linie führt von dort zum Bett
    this.liftExtra = GAP_LIFT * k;
    const [lx, ly] = liftHandleXY(p, this.liftExtra);
    put(this.hLift, this.hitLift, new THREE.Vector3(lx, ly, p.z + p.h / 2));
    const pos = this.liftLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, lx, ly, 0.05);
    pos.setXYZ(1, lx, ly, p.z + p.h / 2);
    pos.needsUpdate = true;
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
    const hits = this.raycaster.intersectObjects([this.hitSize, this.hitHeight, this.hitRotate, this.hitLift], false);
    if (!hits.length) return null;
    const o = hits[0].object;
    return o === this.hitSize ? 'size' : o === this.hitHeight ? 'height' : o === this.hitLift ? 'lift' : 'rotate';
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
    const [vx, vy] = kind === 'lift' ? liftHandleXY(p, this.liftExtra) : [p.x, p.y]; // senkrechte Linie, an der gezogen wird
    const gz = closestZOnVertical(ray.o, ray.d, vx, vy) ?? p.z + p.h;
    const start = { ...p };
    // Löcher sind Schneidwerkzeuge: sie fallen nicht auf andere Körper, sondern bleiben, wo man sie hinsetzt
    const resting = kind === 'move' && !p.hole && Math.abs(p.z - supportHeight(start, this.others(p.id), start)) < 0.05;
    this.drag = { kind, id: p.id, start, grab: g, grabZ: gz, liftExtra: this.liftExtra, resting, offset: [p.x - g[0], p.y - g[1]] };
  }

  private others(id: string): Part[] {
    return this.parts.filter((q) => q.id !== id);
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
    } else if (dr.kind === 'lift') {
      const ray = this.setRay(e.clientX, e.clientY);
      const [vx, vy] = liftHandleXY(s, dr.liftExtra);
      const z = closestZOnVertical(ray.o, ray.d, vx, vy);
      if (z !== null) next = { ...s, z: liftZ(s.z, z - dr.grabZ, s.h, supportHeight(s, this.others(s.id), s), this.bed.height) };
    } else {
      const g = this.groundAt(e.clientX, e.clientY, s.z);
      if (!g) return;
      if (dr.kind === 'move') {
        const others = this.others(s.id);
        // auf ganze mm, Mitte auf Mitte einrasten, und falls er auflag: auf die neue Auflage fallen (z. B. Text auf einen Quader)
        next = snapToCenters({ ...s, x: snap(g[0] + dr.offset[0]), y: snap(g[1] + dr.offset[1]) }, others);
        if (dr.resting) next = { ...next, z: supportHeight(next, others, s) };
      }
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
