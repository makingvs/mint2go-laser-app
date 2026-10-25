// Import beliebiger SVG-Dateien aus der offenen Bibliothek in unser Datenmodell.
// Die Datei wird nie als HTML eingebettet: aus dem XML wird nur ein kleiner Baum
// (Tag, Attribute, Kinder) übernommen, Pfade/Formen/Transformationen werden selbst
// ausgewertet. So bleiben Ecken exakt und gemeinsame Kanten fallen zusammen.
// Unterstützt: path (M L H V C S Q T A Z, absolut und relativ), rect (auch rx/ry), circle,
// ellipse, polygon, polyline, g/svg/a mit transform. Übersprungen: use, clipPath, mask,
// Bilder, Text, Verläufe, Filter; weiß gefüllte Formen gelten als Hintergrund.
import { bbox, normalizeShape, simplify, unionShapes, type Pt, type Ring, type Shape } from './geometry';

export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const NUM_RE = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const SKIP = new Set(['defs', 'symbol', 'clippath', 'mask', 'pattern', 'marker', 'metadata', 'title', 'desc', 'style', 'script', 'foreignobject', 'image', 'text', 'use', 'filter', 'lineargradient', 'radialgradient']);
const CONTAINERS = new Set(['g', 'svg', 'a']);

// ---------- Transformationen ----------
const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

export function parseTransform(text: string | undefined): Matrix {
  let m = IDENTITY;
  if (!text) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  for (let t = re.exec(text); t; t = re.exec(text)) {
    const a = (t[2].match(NUM_RE) ?? []).map(Number);
    const rad = (deg: number) => (deg * Math.PI) / 180;
    let n: Matrix = IDENTITY;
    switch (t[1]) {
      case 'matrix':
        if (a.length >= 6) n = [a[0], a[1], a[2], a[3], a[4], a[5]];
        break;
      case 'translate':
        n = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0];
        break;
      case 'scale':
        n = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0];
        break;
      case 'rotate': {
        const c = Math.cos(rad(a[0] ?? 0));
        const s = Math.sin(rad(a[0] ?? 0));
        n = [c, s, -s, c, 0, 0];
        if (a.length >= 3) n = mul(mul([1, 0, 0, 1, a[1], a[2]], n), [1, 0, 0, 1, -a[1], -a[2]]);
        break;
      }
      case 'skewX':
        n = [1, 0, Math.tan(rad(a[0] ?? 0)), 1, 0, 0];
        break;
      case 'skewY':
        n = [1, Math.tan(rad(a[0] ?? 0)), 0, 1, 0, 0];
        break;
    }
    m = mul(m, n);
  }
  return m;
}

const apply = (m: Matrix, p: Pt): Pt => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

// ---------- Pfade ----------
const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

function arcPoints(p0: Pt, rx: number, ry: number, phiDeg: number, large: boolean, sweep: boolean, p1: Pt): Pt[] {
  if (p0[0] === p1[0] && p0[1] === p1[1]) return [];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0) return [p1];
  const phi = (phiDeg * Math.PI) / 180;
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2;
  const dy = (p0[1] - p1[1]) / 2;
  const x1 = cp * dx + sp * dy;
  const y1 = -sp * dx + cp * dy;
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) {
    const s = Math.sqrt(lam);
    rx *= s;
    ry *= s;
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1) / ry;
  const cyp = (-co * ry * x1) / rx;
  const cx = cp * cxp - sp * cyp + (p0[0] + p1[0]) / 2;
  const cy = sp * cxp + cp * cyp + (p0[1] + p1[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const th1 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let dth = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sweep && dth > 0) dth -= 2 * Math.PI;
  if (sweep && dth < 0) dth += 2 * Math.PI;
  const n = Math.max(4, Math.ceil(Math.abs(dth) / (Math.PI / 48)));
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = th1 + (dth * i) / n;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    out.push([cp * x - sp * y + cx, sp * x + cp * y + cy]);
  }
  out[out.length - 1] = p1;
  return out;
}

const bez = (n: number, f: (t: number) => Pt): Pt[] => Array.from({ length: n }, (_, i) => f((i + 1) / n));

/** Pfaddaten in Teilpfade (Punktlisten) umwandeln; Kurven werden fein in Strecken zerlegt. */
export function parsePath(d: string): Ring[] {
  const subs: Ring[] = [];
  let cur: Ring = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lastCtrl: Pt | null = null;
  let lastCmd = '';
  let i = 0;
  const n = d.length;
  const skipSep = () => {
    while (i < n && /[\s,]/.test(d[i])) i++;
  };
  const readNum = (): number | null => {
    skipSep();
    NUM_RE.lastIndex = i;
    const m = NUM_RE.exec(d);
    if (!m || m.index !== i) return null;
    i = NUM_RE.lastIndex;
    return Number(m[0]);
  };
  const readFlag = (): number | null => {
    skipSep();
    if (d[i] === '0' || d[i] === '1') return Number(d[i++]);
    return null;
  };
  const flush = () => {
    if (cur.length) subs.push(cur);
    cur = [];
  };
  let cmd = '';
  while (i < n) {
    skipSep();
    if (i >= n) break;
    if (/[A-Za-z]/.test(d[i])) cmd = d[i++];
    else if (!cmd) break;
    const lower = cmd.toLowerCase();
    const rel = cmd === lower;
    if (lower === 'z') {
      if (cur.length) {
        x = sx;
        y = sy;
        flush();
      }
      lastCtrl = null;
      lastCmd = 'z';
      cmd = '';
      continue;
    }
    const need = ARGS[lower];
    if (need === undefined) break;
    const a: number[] = [];
    for (let k = 0; k < need; k++) {
      const v = lower === 'a' && (k === 3 || k === 4) ? readFlag() : readNum();
      if (v === null) break;
      a.push(v);
    }
    if (a.length < need) break;
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (lower) {
      case 'm':
        flush();
        x = a[0] + ox;
        y = a[1] + oy;
        sx = x;
        sy = y;
        cur = [[x, y]];
        cmd = rel ? 'l' : 'L'; // weitere Paare sind Linien
        lastCtrl = null;
        break;
      case 'l':
      case 'h':
      case 'v':
        if (!cur.length) cur = [[x, y]];
        if (lower === 'l') {
          x = a[0] + ox;
          y = a[1] + oy;
        } else if (lower === 'h') x = a[0] + ox;
        else y = a[0] + oy;
        cur.push([x, y]);
        lastCtrl = null;
        break;
      case 'c':
      case 's': {
        if (!cur.length) cur = [[x, y]];
        const p0: Pt = [x, y];
        let c1: Pt;
        let c2: Pt;
        let p3: Pt;
        if (lower === 'c') {
          c1 = [a[0] + ox, a[1] + oy];
          c2 = [a[2] + ox, a[3] + oy];
          p3 = [a[4] + ox, a[5] + oy];
        } else {
          c1 = lastCtrl && /[cs]/i.test(lastCmd) ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : p0;
          c2 = [a[0] + ox, a[1] + oy];
          p3 = [a[2] + ox, a[3] + oy];
        }
        cur.push(
          ...bez(24, (t) => {
            const u = 1 - t;
            return [
              u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
              u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
            ];
          }),
        );
        x = p3[0];
        y = p3[1];
        lastCtrl = c2;
        break;
      }
      case 'q':
      case 't': {
        if (!cur.length) cur = [[x, y]];
        const p0: Pt = [x, y];
        let c: Pt;
        let p2: Pt;
        if (lower === 'q') {
          c = [a[0] + ox, a[1] + oy];
          p2 = [a[2] + ox, a[3] + oy];
        } else {
          c = lastCtrl && /[qt]/i.test(lastCmd) ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : p0;
          p2 = [a[0] + ox, a[1] + oy];
        }
        cur.push(
          ...bez(20, (t) => {
            const u = 1 - t;
            return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]];
          }),
        );
        x = p2[0];
        y = p2[1];
        lastCtrl = c;
        break;
      }
      case 'a': {
        if (!cur.length) cur = [[x, y]];
        const end: Pt = [a[5] + ox, a[6] + oy];
        cur.push(...arcPoints([x, y], a[0], a[1], a[2], a[3] !== 0, a[4] !== 0, end));
        x = end[0];
        y = end[1];
        lastCtrl = null;
        break;
      }
    }
    lastCmd = lower;
  }
  flush();
  return subs;
}

// ---------- Formen ----------
const num = (s: string | undefined, d = 0): number => {
  const v = s === undefined ? NaN : parseFloat(s);
  return Number.isFinite(v) ? v : d;
};

function shapeToRings(node: SvgNode): Ring[] {
  const a = node.attrs;
  switch (node.tag) {
    case 'path':
      return parsePath(a.d ?? '');
    case 'rect': {
      const x = num(a.x);
      const y = num(a.y);
      const w = num(a.width);
      const h = num(a.height);
      if (w <= 0 || h <= 0) return [];
      let rx = a.rx !== undefined ? num(a.rx) : a.ry !== undefined ? num(a.ry) : 0;
      let ry = a.ry !== undefined ? num(a.ry) : rx;
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      if (rx <= 0 || ry <= 0) return [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]];
      return parsePath(
        `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`,
      );
    }
    case 'circle':
    case 'ellipse': {
      const cx = num(a.cx);
      const cy = num(a.cy);
      const rx = node.tag === 'circle' ? num(a.r) : num(a.rx);
      const ry = node.tag === 'circle' ? num(a.r) : num(a.ry);
      if (rx <= 0 || ry <= 0) return [];
      return parsePath(`M${cx + rx} ${cy}A${rx} ${ry} 0 1 1 ${cx - rx} ${cy}A${rx} ${ry} 0 1 1 ${cx + rx} ${cy}Z`);
    }
    case 'polygon':
    case 'polyline': {
      const v = (a.points?.match(NUM_RE) ?? []).map(Number);
      const pts: Ring = [];
      for (let i = 0; i + 1 < v.length; i += 2) pts.push([v[i], v[i + 1]]);
      return pts.length >= 3 ? [pts] : [];
    }
  }
  return [];
}

function styleProp(node: SvgNode, name: string): string | undefined {
  const style = node.attrs.style;
  if (style) {
    const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(style);
    if (m) return m[1].trim().toLowerCase();
  }
  return node.attrs[name]?.trim().toLowerCase();
}

const isWhite = (c: string) => /^(#fff|#ffffff|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/.test(c);

/** Baum aus SVG-Knoten in eine vereinigte Form umwandeln (Einheiten wie in der Datei, auf 0..100 skaliert). */
export function nodeToShape(root: SvgNode): Shape {
  const groups: Ring[][] = [];
  const walk = (node: SvgNode, m: Matrix, fill: string, stroke: string, depth: number): void => {
    if (depth > 24) return;
    for (const child of node.children) {
      const tag = child.tag;
      if (SKIP.has(tag)) continue;
      if (styleProp(child, 'display') === 'none' || styleProp(child, 'visibility') === 'hidden') continue;
      const cm = mul(m, parseTransform(child.attrs.transform));
      const f = styleProp(child, 'fill') ?? fill;
      const s = styleProp(child, 'stroke') ?? stroke;
      if (CONTAINERS.has(tag)) {
        walk(child, cm, f, s, depth + 1);
        continue;
      }
      const hasFill = f !== 'none' && f !== 'transparent';
      const hasStroke = s !== 'none';
      if (!hasFill && !hasStroke) continue;
      if (hasFill && isWhite(f) && !hasStroke) continue;
      const rings = shapeToRings(child)
        .map((r) => r.map((p) => apply(cm, p)))
        .filter((r) => r.length >= 3);
      if (rings.length) groups.push(rings);
    }
  };
  walk(root, parseTransform(root.attrs.transform), styleProp(root, 'fill') ?? '#000', styleProp(root, 'stroke') ?? 'none', 0);
  if (!groups.length) return [];

  // Auf festen Rahmen 0..100 bringen, vereinfachen und auf feines Raster runden,
  // damit gemeinsame Kanten exakt zusammenfallen.
  const all = bbox(groups.flat());
  const k = 100 / Math.max(all.maxX - all.minX, all.maxY - all.minY, 1e-9);
  const grid = 0.01;
  const shapes: Shape[] = groups.map((g) =>
    normalizeShape(
      g.map((r) => {
        const pts = r.map(([x, y]): Pt => [Math.round(((x - all.minX) * k) / grid) * grid, Math.round(((y - all.minY) * k) / grid) * grid]);
        const s = simplify([...pts, pts[0]], 0.02);
        s.pop();
        return s;
      }),
    ),
  );
  const usable = shapes.filter((s) => s.length > 0);
  if (!usable.length) return [];
  return usable.length === 1 ? usable[0] : unionShapes(usable);
}

// ---------- Browser-Adapter ----------
function toNode(el: Element, depth = 0): SvgNode {
  const attrs: Record<string, string> = {};
  for (const name of ['d', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'points', 'transform', 'fill', 'stroke', 'style', 'display', 'visibility']) {
    const v = el.getAttribute(name);
    if (v !== null) attrs[name] = v;
  }
  const children: SvgNode[] = [];
  if (depth < 30) for (const c of Array.from(el.children)) children.push(toNode(c, depth + 1));
  return { tag: el.localName.toLowerCase(), attrs, children };
}

/** Liest SVG-Text und liefert die Form (leer, wenn nichts Brauchbares enthalten ist). */
export function svgToShape(text: string): Shape {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.localName !== 'svg' || doc.querySelector('parsererror')) return [];
  try {
    return nodeToShape(toNode(root));
  } catch {
    return [];
  }
}
