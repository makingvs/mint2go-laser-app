// Box-Generator: Maße eingeben, Steckbox mit Zinken erzeugen (Schnittbreite des Lasers ausgeglichen).
import { BOX_DEFAULTS, S1_BED, boxPanels, fitTestSheet, fitsBed, layout, type BoxParams, type LidKind, type Pt } from './boxgen';
import { button, h, overlay } from './dom';
import { bbox } from './geometry';
import { ICONS } from './icons';
import { makeElement, type El, type Op, type Settings, type Surface } from './model';
import { formatNumber, openNumpad } from './numpad';
import { rectSurface } from './surface';

export interface BoxDone {
  surface: Surface;
  elements: El[];
}

const KEY = 'laser.box';

function loadParams(): BoxParams {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<BoxParams>;
    const p: BoxParams = { ...BOX_DEFAULTS };
    for (const k of ['w', 'd', 'h', 'thickness', 'finger', 'kerf', 'fit'] as const) if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) p[k] = raw[k] as number;
    if (typeof raw.inner === 'boolean') p.inner = raw.inner;
    if (raw.lid === 'none' || raw.lid === 'loose' || raw.lid === 'fingers') p.lid = raw.lid;
    return p;
  } catch {
    return { ...BOX_DEFAULTS };
  }
}

function saveParams(p: BoxParams): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignorieren */
  }
}

const num = (n: number, dec = 1) => formatNumber(n, dec);

/** Teile auf einer neuen Platte: je Teil ein gesperrtes Schneide-Teil (gesperrt, damit die Passung nicht versehentlich verzogen wird). */
function toElements(parts: { rings: Pt[][]; op: Op; ref: string; locked?: boolean }[], w: number, h: number): BoxDone {
  const elements = parts.map((p) => {
    const b = bbox(p.rings);
    const bw = Math.max(b.maxX - b.minX, 0.01);
    const bh = Math.max(b.maxY - b.minY, 0.01);
    const el = makeElement({ kind: 'graphic', ref: p.ref, rings: p.rings, op: p.op, size: Math.max(bw, bh), x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, exact: { w: bw, h: bh } });
    if (p.locked) el.locked = true;
    return el;
  });
  return { surface: rectSurface(Math.min(1000, Math.max(10, Math.ceil(w))), Math.min(1000, Math.max(10, Math.ceil(h)))), elements };
}

export function openBoxDialog(opts: { settings: Pick<Settings, 'plate' | 'colors'>; onDone: (r: BoxDone) => void }): void {
  const p = loadParams();
  const dlg = overlay('overlay-dim');
  const panel = h('div', 'panel box-panel');
  const head = h('div', 'panel-head');
  const ok = button('btn send', ICONS.check, () => create(), 'Box erzeugen');
  head.append(button('btn', ICONS.cross, () => dlg.close(), 'Schließen'), h('h2', 'box-title', '📦 Box'), h('div', 'spacer'), ok);

  const form = h('div', 'box-form');
  const preview = h('div', 'box-preview');
  const info = h('div', 'box-info');
  const body = h('div', 'box-body');
  body.append(form, h('div', 'box-right'));
  const right = body.querySelector('.box-right') as HTMLElement;
  right.append(preview, info);

  type NumKey = 'w' | 'd' | 'h' | 'thickness' | 'finger' | 'kerf' | 'fit';
  const fieldBtns: Partial<Record<NumKey, HTMLButtonElement>> = {};
  const field = (key: NumKey, label: string, unit: string, min: number, max: number, dec = 1, icon = '📏'): HTMLButtonElement => {
    const b = button('box-field', '', async () => {
      const v = await openNumpad({ icon, value: p[key], unit, min, max, decimals: dec });
      if (v !== null) {
        p[key] = v;
        refresh();
      }
    }, label);
    fieldBtns[key] = b;
    return b;
  };
  const seg = <T extends string>(items: [T, string, string][], get: () => T, set: (v: T) => void): HTMLElement => {
    const row = h('div', 'box-seg');
    const bs = items.map(([v, icon, text]) => {
      const b = button('box-opt', `<span class="bo-i">${icon}</span><span class="bo-t">${text}</span>`, () => {
        set(v);
        refresh();
      }, text);
      b.dataset.v = v;
      return b;
    });
    row.append(...bs);
    (row as HTMLElement & { sync?: () => void }).sync = () => bs.forEach((b) => b.classList.toggle('active', b.dataset.v === get()));
    return row;
  };
  const sizeRow = h('div', 'box-row');
  sizeRow.append(field('w', 'Breite', 'mm', 20, 600, 1, ICONS.arrowH), field('d', 'Tiefe', 'mm', 20, 600, 1, '↔️'), field('h', 'Höhe', 'mm', 15, 600, 1, ICONS.arrowV));
  const innerSeg = seg<'inner' | 'outer'>([['inner', '🫙', 'Innen'], ['outer', '📦', 'Außen']], () => (p.inner ? 'inner' : 'outer'), (v) => (p.inner = v === 'inner'));
  const lidSeg = seg<LidKind>([['none', '📭', 'Offen'], ['loose', '🔲', 'Lose'], ['fingers', '🔒', 'Fest']], () => p.lid, (v) => (p.lid = v));
  const pro = h('details', 'box-pro');
  pro.append(h('summary', '', '🔧 Profi: Material und Laser'));
  const proRow = h('div', 'box-row');
  proRow.append(field('thickness', 'Material', 'mm', 1, 10, 1, '🪵'), field('finger', 'Zinken', 'mm', 4, 40, 1, '🧩'), field('kerf', 'Schnittbreite', 'mm', 0, 1, 2, '🔥'), field('fit', 'Passung', 'mm', -0.5, 0.5, 2, '🤝'));
  pro.append(proRow, h('p', 'box-note', 'Schnittbreite: so viel Holz nimmt der Laser-Strahl weg (xTool S1 40 W, Pappelsperrholz 3 mm: Startwert 0,15 mm). Die Passprobe zeigt den richtigen Wert für dein Gerät. Passung: größer = lockerer, kleiner = strammer. Material immer nachmessen!'));
  const test = button('btn labeled box-test', '<span class="ico">🧪</span><span class="lbl">Passprobe</span>', () => {
    saveParams(p);
    const sheet = fitTestSheet(p.thickness, [0.05, 0.1, 0.15, 0.2, 0.25], p.fit);
    dlg.close();
    opts.onDone(toElements(sheet.parts, sheet.w, sheet.h));
  }, 'Passprobe schneiden');
  pro.append(test);
  form.append(h('div', 'box-label', 'Maße'), sizeRow, h('div', 'box-label', 'Maße gelten'), innerSeg, h('div', 'box-label', 'Deckel'), lidSeg, pro);
  panel.append(head, body);
  dlg.root.append(panel);

  let current: BoxDone | null = null;

  function refresh(): void {
    saveParams(p);
    for (const [k, b] of Object.entries(fieldBtns) as [NumKey, HTMLButtonElement][]) {
      const label = b.getAttribute('aria-label') ?? '';
      const dec = k === 'kerf' || k === 'fit' ? 2 : 1;
      b.innerHTML = `<span class="bf-l">${label}</span><span class="bf-v">${num(p[k], dec)}<small> mm</small></span>`;
    }
    for (const row of [innerSeg, lidSeg] as (HTMLElement & { sync?: () => void })[]) row.sync?.();
    const r = boxPanels(p);
    current = null;
    ok.disabled = !r.ok;
    if (!r.ok) {
      preview.innerHTML = '<div class="box-empty">📦</div>';
      info.className = 'box-info bad';
      info.textContent = `⚠️ ${r.error}`;
      return;
    }
    const maxW = Math.max(opts.settings.plate.width, ...r.panels.map((q) => q.a + 12));
    const l = layout(r.panels, maxW, 4 + Math.max(0, p.kerf));
    const paths = l.placed.map((q) => `<path d="M${q.ring.map((pt) => `${pt[0].toFixed(2)} ${pt[1].toFixed(2)}`).join('L')}Z" fill="rgba(240,160,48,.25)" stroke="${opts.settings.colors.cut}" stroke-width="1.2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`).join('');
    preview.innerHTML = `<svg viewBox="0 0 ${l.w.toFixed(1)} ${l.h.toFixed(1)}" preserveAspectRatio="xMidYMid meet">${paths}</svg>`;
    const fits = fitsBed(l.w, l.h);
    info.className = 'box-info' + (fits ? '' : ' warn');
    info.innerHTML = `<b>${r.panels.length} Teile</b> · Außen ${num(r.outer.w)} × ${num(r.outer.d)} × ${num(r.outer.h)} mm<br>Platte ${Math.ceil(l.w)} × ${Math.ceil(l.h)} mm ${fits ? '✅' : `⚠️ größer als die S1-Fläche (${S1_BED.w} × ${S1_BED.h} mm)`}`;
    current = toElements(l.placed.map((q) => ({ rings: [q.ring], op: 'cut' as const, ref: `box:${q.panel.id}`, locked: true })), l.w, l.h);
  }

  function create(): void {
    if (!current) return;
    const done = current;
    dlg.close();
    opts.onDone(done);
  }

  refresh();
}
