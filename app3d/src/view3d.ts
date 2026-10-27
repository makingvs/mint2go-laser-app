// 3D-Ansicht (three.js): Druckbett, Bauraum, Licht, Kamera per Touch (ein Finger drehen, zwei Finger zoomen/verschieben).
import * as THREE from 'three';
import type { Bed } from './bed';
import { FOV_DEG, cameraPosition, defaultOrbit, orbitPan, orbitRotate, orbitZoom, type Orbit } from './orbit';

const COLORS = { bg: 0xf3f6fb, plate: 0xdfe6f2, grid: 0xc3cde0, grid10: 0xaab6d0, volume: 0x38b8e8, part: 0x98c227 };

export class View3d {
  readonly canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 1, 5000);
  private bedGroup = new THREE.Group();
  private parts = new THREE.Group();
  private orbit: Orbit;
  private bed: Bed;
  private pointers = new Map<number, { x: number; y: number }>();
  private dirty = true;
  private raf = 0;
  private ro: ResizeObserver;

  constructor(private host: HTMLElement, bed: Bed) {
    this.bed = bed;
    this.orbit = defaultOrbit(bed);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(COLORS.bg);
    this.camera.up.set(0, 0, 1); // z zeigt nach oben
    this.scene.add(this.bedGroup, this.parts);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa7c4, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-150, -250, 400);
    this.scene.add(sun);

    this.buildBed();
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

  /** Einfacher Testkörper (nur Phase 1): ein Würfel mit 30 mm Kantenlänge in der Mitte. */
  addDemoCube(size = 30): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshStandardMaterial({ color: COLORS.part, roughness: 0.6 }));
    mesh.position.set(0, 0, size / 2);
    this.parts.add(mesh);
    this.invalidate();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.dispose();
    this.canvas.remove();
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
    this.renderer.render(this.scene, this.camera);
  };

  // ---------- Gesten ----------
  private onDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  private onMove = (e: PointerEvent): void => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    const h = this.host.clientHeight;
    if (this.pointers.size === 1) {
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

  private onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.orbit = orbitZoom(this.orbit, Math.exp(-e.deltaY * 0.0015), this.bed);
    this.invalidate();
  };
}
