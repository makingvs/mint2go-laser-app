// Symbole der 3D-App (Inline-SVG wie in src/icons.ts; gemeinsame Symbole kommen von dort).
import { gearPath } from '../../src/decor';
import type { PartKind } from './mesh';

const svg = (inner: string) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const FILL = 'fill="currentColor" fill-opacity=".14"';

export const KIND_ICONS: Record<PartKind, string> = {
  box: svg(`<path d="M12 3 20 7.500v9L12 21 4 16.500v-9z" ${FILL}/><path d="M4 7.500 12 12l8-4.500M12 12v9"/>`),
  sphere: svg(`<circle cx="12" cy="12" r="8.500" ${FILL}/><path d="M3.500 12c0 2 3.800 3.500 8.500 3.500s8.500-1.500 8.500-3.500"/>`),
  cylinder: svg(`<path d="M5 6v12c0 1.700 3.100 3 7 3s7-1.300 7-3V6" ${FILL}/><ellipse cx="12" cy="6" rx="7" ry="3" ${FILL}/>`),
  cone: svg(`<path d="M12 3 5 17c0 1.700 3.100 3 7 3s7-1.300 7-3z" ${FILL}/><path d="M5 17c0 1.700 3.100 3 7 3s7-1.300 7-3"/>`),
  pyramid: svg(`<path d="M12 3 4 16l8 5 8-5z" ${FILL}/><path d="M12 3v18M4 16l8-2.500 8 2.500"/>`),
  roof: svg(`<path d="M3 19 9 7l6 12z" ${FILL}/><path d="M9 7l8-3 4 12-6 3M17 4"/>`),
  dome: svg(`<path d="M3 17a9 9 0 0 1 18 0z" ${FILL}/><path d="M3 17c0 2 4 3.500 9 3.500s9-1.500 9-3.500"/>`),
  ring: svg(`<ellipse cx="12" cy="12" rx="9" ry="5.500" ${FILL}/><ellipse cx="12" cy="12" rx="4" ry="1.800"/>`),
};

export const ICONS3D = {
  depth: svg('<path d="M5 19 19 5M5 19v-5M5 19h5M19 5v5M19 5h-5"/>'),
  lift: svg('<path d="M12 4v11M8 8l4-4 4 4"/><path d="M4 20h16"/>'),
  hole: svg('<rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="3.500 3"/><circle cx="12" cy="12" r="3.500"/>'),
  merge: svg('<circle cx="9" cy="12" r="6" fill="currentColor" fill-opacity=".14"/><circle cx="15" cy="12" r="6" fill="currentColor" fill-opacity=".14"/>'),
  bed: svg('<path d="M3 17h18v3H3z"/><path d="M6 17V8h12v9"/><path d="M10 12h4"/>'),
  thin: svg('<path d="M3 12h6M21 12h-6M9 8l-3 4 3 4M15 8l3 4-3 4"/>'),
  home: svg('<path d="M3 11 12 3l9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>'),
  tilt: svg('<path d="M7 17 5 9l8-2 2 8z" fill="currentColor" fill-opacity=".14"/><path d="M4 20h16"/>'),
  mirror: svg('<path d="M12 3v18" stroke-dasharray="2.5 2.5"/><path d="M9 7 4 17h5zM15 7l5 10h-5z" fill="currentColor" fill-opacity=".14"/>'),
  align: svg('<path d="M12 3v18"/><rect x="4.5" y="6" width="15" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>'),
};

/** Sonderkörper in der Körper-Auswahl: Röhre und Zahnrad */
export const SPECIAL_ICONS = {
  tube: svg('<ellipse cx="12" cy="6" rx="7" ry="3" fill="currentColor" fill-opacity=".14"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><ellipse cx="12" cy="6" rx="3.5" ry="1.4"/>'),
  gear: svg(`<path d="${gearPath(12, 12, 9.5, 9, 0.3)}" fill="currentColor" fill-opacity=".14" fill-rule="evenodd"/>`),
};
