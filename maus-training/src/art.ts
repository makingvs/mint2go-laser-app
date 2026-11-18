// Alle Bilder des Spiels als selbst gezeichnete SVG-Texte (keine Fremd-Grafiken, keine Lizenzfragen).
import type { IconKey, MouseKind } from './levels';

export const C = {
  green: '#98C227',
  orange: '#F0A030',
  pink: '#E01070',
  sky: '#38B8E8',
  blue: '#3757A9',
  slate: '#4D597C',
  yellow: '#FFD93B',
  red: '#E8283C',
  brown: '#8B5A2B',
};

const svg = (vb: string, inner: string, cls = ''): string =>
  `<svg class="${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

/** Punkte eines regelmäßigen Sterns/Vielecks (Mittelpunkt 50|50). */
export function polyPoints(n: number, outer: number, inner = outer, rot = -90): string {
  const pts: string[] = [];
  const total = inner === outer ? n : n * 2;
  for (let i = 0; i < total; i++) {
    const r = inner === outer ? outer : i % 2 === 0 ? outer : inner;
    const a = ((rot + (360 / total) * i) * Math.PI) / 180;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/* ---------- Spielfiguren ---------- */

export const starArt = (fill = '#FFD93B', face = true): string =>
  svg(
    '0 0 100 100',
    `<polygon points="${polyPoints(5, 47, 21)}" fill="${fill}" stroke="#E59E00" stroke-width="4" stroke-linejoin="round"/>` +
      (face
        ? `<circle cx="42" cy="49" r="3.6" fill="${C.slate}"/><circle cx="58" cy="49" r="3.6" fill="${C.slate}"/>` +
          `<path d="M43 58 Q50 65 57 58" fill="none" stroke="${C.slate}" stroke-width="3.2" stroke-linecap="round"/>`
        : ''),
  );

export const balloonArt = (color: string): string =>
  svg(
    '0 0 100 150',
    `<path d="M50 90 Q42 108 52 122 T50 148" fill="none" stroke="#9aa4bd" stroke-width="2.5"/>` +
      `<ellipse cx="50" cy="44" rx="38" ry="44" fill="${color}"/>` +
      `<polygon points="43,86 57,86 50,98" fill="${color}"/>` +
      `<ellipse cx="36" cy="26" rx="9" ry="14" fill="#fff" opacity=".35" transform="rotate(25 36 26)"/>`,
    'overflow',
  );

export const targetArt = (): string =>
  svg(
    '0 0 100 100',
    `<circle cx="50" cy="50" r="48" fill="${C.pink}"/><circle cx="50" cy="50" r="38" fill="#fff"/>` +
      `<circle cx="50" cy="50" r="28" fill="${C.pink}"/><circle cx="50" cy="50" r="18" fill="#fff"/>` +
      `<circle cx="50" cy="50" r="8" fill="${C.pink}"/>`,
  );

export const appleArt = (): string =>
  svg(
    '0 0 100 100',
    `<path d="M50 30 C30 14 6 34 13 62 C18 85 36 96 50 90 C64 96 82 85 87 62 C94 34 70 14 50 30Z" fill="${C.red}" stroke="#B51426" stroke-width="3"/>` +
      `<ellipse cx="32" cy="46" rx="6" ry="11" fill="#fff" opacity=".35" transform="rotate(20 32 46)"/>` +
      `<path d="M50 30 Q50 16 57 8" fill="none" stroke="${C.brown}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M54 18 Q70 6 80 17 Q66 28 54 18Z" fill="${C.green}" stroke="#6c8f17" stroke-width="2"/>`,
  );

export const pearArt = (): string =>
  svg(
    '0 0 100 100',
    `<path d="M50 8 C60 8 62 22 58 32 C82 44 86 70 75 84 C64 97 36 97 25 84 C14 70 18 44 42 32 C38 22 40 8 50 8Z" fill="#C8D84A" stroke="#8da01f" stroke-width="3"/>` +
      `<ellipse cx="36" cy="64" rx="5" ry="12" fill="#fff" opacity=".35"/>` +
      `<path d="M52 10 Q62 2 70 8 Q62 16 52 10Z" fill="${C.green}" stroke="#6c8f17" stroke-width="2"/>`,
  );

export const eggArt = (spot = C.pink): string =>
  svg(
    '0 0 100 100',
    `<ellipse cx="50" cy="56" rx="34" ry="42" fill="#FFF6E0" stroke="#E0C9A0" stroke-width="3"/>` +
      `<circle cx="38" cy="46" r="6" fill="${spot}" opacity=".8"/><circle cx="60" cy="38" r="4.5" fill="${C.sky}" opacity=".8"/>` +
      `<circle cx="58" cy="64" r="7" fill="${C.green}" opacity=".8"/><circle cx="36" cy="72" r="4" fill="${C.orange}" opacity=".9"/>` +
      `<ellipse cx="34" cy="34" rx="5" ry="9" fill="#fff" opacity=".7" transform="rotate(20 34 34)"/>`,
  );

export const chickArt = (): string =>
  svg(
    '0 0 100 100',
    `<circle cx="50" cy="52" r="32" fill="${C.yellow}" stroke="#E59E00" stroke-width="3"/>` +
      `<circle cx="39" cy="46" r="4.5" fill="${C.slate}"/><circle cx="61" cy="46" r="4.5" fill="${C.slate}"/>` +
      `<circle cx="40.5" cy="44.5" r="1.4" fill="#fff"/><circle cx="62.5" cy="44.5" r="1.4" fill="#fff"/>` +
      `<polygon points="43,54 57,54 50,64" fill="${C.orange}"/>` +
      `<path d="M50 20 Q46 8 40 10 M50 20 Q52 6 60 8" fill="none" stroke="#E59E00" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M10 74 L24 64 L34 76 L50 64 L66 76 L76 64 L90 74 L84 92 Q50 104 16 92Z" fill="#FFF6E0" stroke="#E0C9A0" stroke-width="3" stroke-linejoin="round"/>`,
  );

const gem = (x: number, y: number, c: string): string =>
  `<polygon points="${x},${y - 9} ${x + 9},${y} ${x},${y + 9} ${x - 9},${y}" fill="${c}" stroke="#fff" stroke-width="2"/>`;

export const chestArt = (open: boolean): string =>
  open
    ? svg(
        '0 0 100 100',
        `<circle cx="50" cy="44" r="30" fill="#FFE27A" opacity=".55"/>` +
          `<path d="M16 34 Q16 6 50 6 Q84 6 84 34 L76 40 L24 40Z" fill="#C97A2E" stroke="#8B4F14" stroke-width="3" stroke-linejoin="round"/>` +
          `<rect x="12" y="46" width="76" height="42" rx="6" fill="#B5651D" stroke="#8B4F14" stroke-width="3"/>` +
          `<rect x="14" y="46" width="72" height="9" fill="#5b3510"/>` +
          gem(34, 44, C.pink) + gem(52, 38, C.sky) + gem(68, 45, C.green) +
          `<rect x="44" y="46" width="12" height="42" fill="#E9B949"/>`,
      )
    : svg(
        '0 0 100 100',
        `<rect x="12" y="46" width="76" height="42" rx="6" fill="#B5651D" stroke="#8B4F14" stroke-width="3"/>` +
          `<path d="M12 48 Q12 18 50 18 Q88 18 88 48Z" fill="#C97A2E" stroke="#8B4F14" stroke-width="3" stroke-linejoin="round"/>` +
          `<rect x="44" y="20" width="12" height="68" fill="#E9B949"/>` +
          `<circle cx="50" cy="52" r="7" fill="#FFD93B" stroke="#B88A12" stroke-width="2"/>` +
          `<rect x="48.5" y="52" width="3" height="8" fill="#B88A12"/>`,
      );

export const budArt = (open: boolean): string =>
  open
    ? svg(
        '0 0 100 100',
        `<path d="M50 56 L50 96" stroke="#6FA81F" stroke-width="6" stroke-linecap="round"/>` +
          `<path d="M50 80 Q72 70 82 82 Q66 92 50 80Z" fill="${C.green}"/>` +
          [0, 1, 2, 3, 4, 5]
            .map((i) => {
              const a = (i * 60 * Math.PI) / 180;
              return `<circle cx="${(50 + 19 * Math.cos(a)).toFixed(1)}" cy="${(40 + 19 * Math.sin(a)).toFixed(1)}" r="13" fill="${i % 2 ? C.pink : '#F46AA6'}"/>`;
            })
            .join('') +
          `<circle cx="50" cy="40" r="11" fill="${C.yellow}" stroke="#E59E00" stroke-width="2"/>`,
      )
    : svg(
        '0 0 100 100',
        `<path d="M50 52 L50 96" stroke="#6FA81F" stroke-width="6" stroke-linecap="round"/>` +
          `<path d="M50 80 Q72 70 82 82 Q66 92 50 80Z" fill="${C.green}"/>` +
          `<path d="M50 16 C70 26 72 48 50 58 C28 48 30 26 50 16Z" fill="#F46AA6" stroke="${C.pink}" stroke-width="3"/>` +
          `<path d="M50 20 C42 32 42 46 50 56" fill="none" stroke="${C.pink}" stroke-width="2.5" opacity=".6"/>`,
      );

/* ---------- Formen (Sortieren, Puzzle) ---------- */

export type ShapeKind = 'circle' | 'square' | 'triangle' | 'star' | 'heart' | 'hexagon';
export const SHAPE_KINDS: ShapeKind[] = ['circle', 'square', 'triangle', 'star', 'heart', 'hexagon'];

function shapeInner(kind: ShapeKind, attrs: string): string {
  switch (kind) {
    case 'circle':
      return `<circle cx="50" cy="50" r="40" ${attrs}/>`;
    case 'square':
      return `<rect x="12" y="12" width="76" height="76" rx="9" ${attrs}/>`;
    case 'triangle':
      return `<polygon points="50,9 92,87 8,87" stroke-linejoin="round" ${attrs}/>`;
    case 'star':
      return `<polygon points="${polyPoints(5, 46, 21)}" stroke-linejoin="round" ${attrs}/>`;
    case 'heart':
      return `<path d="M50 88 C12 60 8 34 27 22 C40 14 50 25 50 33 C50 25 60 14 73 22 C92 34 88 60 50 88Z" stroke-linejoin="round" ${attrs}/>`;
    case 'hexagon':
      return `<polygon points="${polyPoints(6, 44)}" stroke-linejoin="round" ${attrs}/>`;
  }
}

export const shapeArt = (kind: ShapeKind, fill: string): string =>
  svg('0 0 100 100', shapeInner(kind, `fill="${fill}" stroke="rgba(0,0,0,.18)" stroke-width="4"`) +
    `<ellipse cx="34" cy="30" rx="8" ry="5" fill="#fff" opacity=".3" transform="rotate(-30 34 30)"/>`);

/** Umriss-Silhouette (Loch im Puzzle, Symbol am Korb). */
export const shapeHole = (kind: ShapeKind, stroke = C.slate): string =>
  svg('0 0 100 100', shapeInner(kind, `fill="rgba(77,89,124,.18)" stroke="${stroke}" stroke-width="4" stroke-dasharray="9 7"`));

/* ---------- Bilder, die nur richtig herum gut aussehen (Mausrad-Welt) ---------- */

export type UprightKind = 'house' | 'rocket' | 'tree' | 'icecream';
export const UPRIGHT_KINDS: UprightKind[] = ['house', 'rocket', 'tree', 'icecream'];

export function uprightArt(kind: UprightKind): string {
  switch (kind) {
    case 'house':
      return svg(
        '0 0 100 100',
        `<rect x="20" y="46" width="60" height="44" fill="#F4C27A" stroke="#C99445" stroke-width="3"/>` +
          `<polygon points="10,50 50,12 90,50" fill="${C.pink}" stroke="#a80b52" stroke-width="3" stroke-linejoin="round"/>` +
          `<rect x="42" y="64" width="16" height="26" rx="3" fill="${C.brown}"/>` +
          `<rect x="25" y="56" width="13" height="13" fill="${C.sky}" stroke="#fff" stroke-width="2"/>` +
          `<rect x="62" y="56" width="13" height="13" fill="${C.sky}" stroke="#fff" stroke-width="2"/>` +
          `<rect x="66" y="20" width="9" height="18" fill="#9a6a3a"/>`,
      );
    case 'rocket':
      return svg(
        '0 0 100 100',
        `<path d="M36 62 L18 84 L36 78Z M64 62 L82 84 L64 78Z" fill="${C.pink}"/>` +
          `<path d="M42 78 L50 98 L58 78Z" fill="${C.orange}"/>` +
          `<path d="M50 6 C70 22 72 54 66 78 L34 78 C28 54 30 22 50 6Z" fill="#fff" stroke="${C.slate}" stroke-width="3"/>` +
          `<path d="M50 6 C58 14 62 22 64 32 L36 32 C38 22 42 14 50 6Z" fill="${C.pink}"/>` +
          `<circle cx="50" cy="50" r="9" fill="${C.sky}" stroke="${C.slate}" stroke-width="3"/>`,
      );
    case 'tree':
      return svg(
        '0 0 100 100',
        `<rect x="44" y="64" width="12" height="30" fill="${C.brown}"/>` +
          `<polygon points="50,6 80,42 20,42" fill="#6FA81F" stroke="#4f7d14" stroke-width="2" stroke-linejoin="round"/>` +
          `<polygon points="50,24 86,66 14,66" fill="${C.green}" stroke="#6c8f17" stroke-width="2" stroke-linejoin="round"/>` +
          `<circle cx="40" cy="52" r="4" fill="${C.pink}"/><circle cx="62" cy="58" r="4" fill="${C.yellow}"/><circle cx="52" cy="38" r="3.5" fill="${C.sky}"/>`,
      );
    case 'icecream':
      return svg(
        '0 0 100 100',
        `<polygon points="28,50 72,50 50,96" fill="#E8B060" stroke="#B9873A" stroke-width="3" stroke-linejoin="round"/>` +
          `<path d="M36 62 L58 62 M42 74 L54 74 M33 50 L54 90 M50 50 L40 82 M67 50 L46 90" stroke="#B9873A" stroke-width="2" opacity=".6"/>` +
          `<circle cx="50" cy="38" r="24" fill="#F9A8D4" stroke="#E07BB0" stroke-width="3"/>` +
          `<circle cx="42" cy="32" r="3" fill="#fff" opacity=".6"/>` +
          `<circle cx="50" cy="12" r="7" fill="${C.red}" stroke="#B51426" stroke-width="2"/><path d="M50 6 Q54 0 60 2" stroke="#6c8f17" stroke-width="2.5" fill="none"/>`,
      );
  }
}

/** Umriss eines aufrechten Bildes (Loch in der Dreh-und-zieh-Aufgabe). */
export function uprightHole(kind: UprightKind): string {
  return uprightArt(kind).replace('<svg ', '<svg style="filter:grayscale(1) brightness(.35) opacity(.45)" ');
}

/* ---------- Symbole ---------- */

export const ICONS = {
  back: '<path d="M64 18 L30 50 L64 82" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>',
  next: '<path d="M30 14 L82 50 L30 86Z" fill="currentColor" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>',
  replay:
    '<path d="M78 50 A28 28 0 1 1 64 25.6" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/><path d="M52 12 L72 28 L50 38Z" fill="currentColor" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>',
  home: '<path d="M14 52 L50 20 L86 52" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 48 V82 H42 V62 H58 V82 H76 V48" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>',
  people:
    '<circle cx="36" cy="34" r="14" fill="currentColor"/><path d="M10 80 C10 58 62 58 62 80Z" fill="currentColor"/><circle cx="68" cy="40" r="11" fill="currentColor" opacity=".7"/><path d="M52 80 C54 64 92 64 92 80Z" fill="currentColor" opacity=".7"/>',
  plus: '<path d="M50 18 V82 M18 50 H82" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round"/>',
  check: '<path d="M18 52 L40 74 L84 26" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M22 22 L78 78 M78 22 L22 78" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round"/>',
  trash:
    '<path d="M22 28 H78 M40 28 V18 H60 V28 M28 28 L33 86 H67 L72 28" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="22" y="44" width="56" height="42" rx="9" fill="currentColor"/><path d="M33 44 V32 A17 17 0 0 1 67 32 V44" fill="none" stroke="currentColor" stroke-width="9"/>',
  star: `<polygon points="${polyPoints(5, 46, 21)}" fill="currentColor" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>`,
  trophy:
    '<path d="M30 12 H70 V38 C70 56 60 64 50 64 C40 64 30 56 30 38Z" fill="currentColor"/><path d="M30 20 H16 C16 40 24 46 32 46 M70 20 H84 C84 40 76 46 68 46" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><rect x="44" y="62" width="12" height="16" fill="currentColor"/><rect x="30" y="78" width="40" height="11" rx="4" fill="currentColor"/>',
  print:
    '<rect x="26" y="12" width="48" height="28" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/><rect x="12" y="38" width="76" height="34" rx="8" fill="currentColor"/><rect x="28" y="58" width="44" height="30" fill="#fff" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>',
  reset:
    '<path d="M22 50 A28 28 0 1 0 36 25.6" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round"/><path d="M50 12 L30 28 L52 38Z" fill="currentColor" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>',
} as const;
export type IconName = keyof typeof ICONS;
export const icon = (name: IconName): string => svg('0 0 100 100', ICONS[name], 'icon');

/** Bild für eine Welt (Kopf der Spalte). */
export function worldIcon(key: IconKey): string {
  switch (key) {
    case 'star':
      return starArt();
    case 'balloon':
      return balloonArt(C.pink);
    case 'egg':
      return eggArt();
    case 'puzzle':
      return svg(
        '0 0 100 100',
        shapeInner('circle', `transform="translate(-14 -14) scale(.62)" fill="${C.orange}"`) +
          shapeInner('square', `transform="translate(44 4) scale(.62)" fill="${C.sky}"`) +
          shapeInner('triangle', `transform="translate(-4 46) scale(.62)" fill="${C.green}"`) +
          shapeInner('heart', `transform="translate(44 44) scale(.62)" fill="${C.pink}"`),
      );
    case 'rocket':
      return uprightArt('rocket');
  }
}

/* ---------- Maus-Bild (zeigt, welche Taste gebraucht wird) ---------- */

/**
 * Gezeichnete Maus. Der gebrauchte Teil leuchtet und pulsiert (CSS in style.css, .mi-*).
 */
export function mouseIcon(kind: MouseKind): string {
  const left = 'M50 6 C26 6 14 22 14 46 L14 64 H50Z';
  const right = 'M50 6 C74 6 86 22 86 46 V64 H50Z';
  const leftCls = kind === 'click' ? 'mi-hit' : kind === 'dblclick' ? 'mi-hit2' : kind === 'drag' || kind === 'wheeldrag' ? 'mi-hold' : '';
  const wheelCls = kind === 'wheelclick' ? 'mi-hit' : kind === 'wheelscroll' ? 'mi-spin' : kind === 'wheeldrag' ? 'mi-spin' : '';
  const extra =
    kind === 'move'
      ? `<g class="mi-lines" stroke="${C.sky}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M-6 50 H4 M-10 70 H0 M-6 90 H4"/></g>`
      : kind === 'drag' || kind === 'wheeldrag'
        ? `<g class="mi-arrow" fill="none" stroke="${C.orange}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M96 78 H118 M110 68 L120 78 L110 88"/></g>`
        : kind === 'wheelscroll'
          ? `<g class="mi-chev" fill="none" stroke="${C.orange}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M42 20 L50 12 L58 20"/><path d="M42 68 L50 76 L58 68"/></g>`
          : '';
  return svg(
    '-14 0 140 140',
    `<g class="mi-body ${kind === 'move' ? 'mi-slide' : ''}">` +
      `<path d="M50 6 C26 6 14 22 14 46 L14 92 C14 120 30 134 50 134 C70 134 86 120 86 92 L86 46 C86 22 74 6 50 6Z" fill="#fff" stroke="${C.slate}" stroke-width="5"/>` +
      `<path class="${leftCls}" d="${left}" fill="#e9edf7" stroke="${C.slate}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="${right}" fill="#e9edf7" stroke="${C.slate}" stroke-width="4" stroke-linejoin="round"/>` +
      `<rect class="${wheelCls}" x="42" y="24" width="16" height="30" rx="8" fill="#cfd6e6" stroke="${C.slate}" stroke-width="4"/>` +
      `</g>` +
      extra,
    'mouse-icon',
  );
}

/* ---------- Maskottchen ---------- */

export type Mood = 'happy' | 'cheer' | 'oops';

export function mascot(mood: Mood = 'happy'): string {
  const mouth =
    mood === 'cheer'
      ? `<path d="M38 72 Q50 88 62 72Z" fill="#7a1f3d"/><path d="M42 78 Q50 84 58 78" fill="#ff7aa8"/>`
      : mood === 'oops'
        ? `<path d="M42 78 Q50 70 58 78" fill="none" stroke="${C.slate}" stroke-width="3.5" stroke-linecap="round"/>`
        : `<path d="M40 72 Q50 82 60 72" fill="none" stroke="${C.slate}" stroke-width="3.5" stroke-linecap="round"/>`;
  return svg(
    '0 0 100 100',
    `<circle cx="22" cy="28" r="17" fill="#c7cfe3" stroke="${C.slate}" stroke-width="3"/><circle cx="22" cy="28" r="10" fill="#F9A8D4"/>` +
      `<circle cx="78" cy="28" r="17" fill="#c7cfe3" stroke="${C.slate}" stroke-width="3"/><circle cx="78" cy="28" r="10" fill="#F9A8D4"/>` +
      `<ellipse cx="50" cy="58" rx="36" ry="33" fill="#dfe5f3" stroke="${C.slate}" stroke-width="3"/>` +
      `<circle cx="37" cy="50" r="5" fill="${C.slate}"/><circle cx="63" cy="50" r="5" fill="${C.slate}"/>` +
      `<circle cx="38.6" cy="48.4" r="1.6" fill="#fff"/><circle cx="64.6" cy="48.4" r="1.6" fill="#fff"/>` +
      `<ellipse cx="50" cy="62" rx="6" ry="4.5" fill="${C.pink}"/>` +
      mouth +
      `<path d="M14 62 H28 M14 70 L28 67 M86 62 H72 M86 70 L72 67" stroke="${C.slate}" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="28" cy="66" r="5" fill="#F9A8D4" opacity=".6"/><circle cx="72" cy="66" r="5" fill="#F9A8D4" opacity=".6"/>`,
    'mascot-svg',
  );
}

export const trophyArt = (): string =>
  svg(
    '0 0 100 100',
    `<path d="M28 10 H72 V38 C72 58 62 68 50 68 C38 68 28 58 28 38Z" fill="#FFD93B" stroke="#E59E00" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M28 18 H14 C14 40 24 48 34 48 M72 18 H86 C86 40 76 48 66 48" fill="none" stroke="#E59E00" stroke-width="6" stroke-linecap="round"/>` +
      `<rect x="44" y="66" width="12" height="14" fill="#E59E00"/><rect x="30" y="80" width="40" height="12" rx="4" fill="#E59E00"/>` +
      `<polygon points="${polyPoints(5, 14, 6)}" transform="translate(0 -14) translate(0 20)" fill="#fff" opacity=".85"/>` +
      `<ellipse cx="38" cy="30" rx="4" ry="10" fill="#fff" opacity=".4"/>`,
  );
