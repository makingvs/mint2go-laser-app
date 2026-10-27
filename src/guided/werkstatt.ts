// Laser-Werkstatt: 20 geführte Projekte in 4 Stufen. Die Zeichnungen entstehen direkt in der App.
import { cdLineMarkup, gearsMarkup } from '../decor';
import { button, h, overlay } from '../dom';
import { ICONS } from '../icons';
import type { Design } from '../model';
import { chips, openRules, pic } from './dialogs';
import type { Project } from './engine';
import { LEVELS, PROJECTS } from './projects';

export interface WerkstattHandlers {
  onBack: () => void;
  /** existing = angefangene Arbeit zum Weitermachen, sonst neu starten */
  onStart: (p: Project, existing: Design | null) => void;
}

/** Fortschritt eines Projekts: Anteil der erledigten Schritte (0..1) */
export const progressOf = (p: Project, d: Design | undefined): number => (!d?.guide ? 0 : d.guide.done ? 1 : d.guide.step / p.steps.length);

export function werkstattScreen(root: HTMLElement, designs: Design[], on: WerkstattHandlers): void {
  root.innerHTML = '';
  const screen = h('div', 'screen werkstatt-screen');
  const head = h('div', 'gallery-head');
  head.append(
    button('btn big', ICONS.back, on.onBack, 'Zurück'),
    h('div', 'werk-title', '<span>🛠️</span><b>Laser-Werkstatt</b>'),
    h('div', 'spacer'),
    button('btn', '🛡️', openRules, 'Laser-Regeln'),
  );
  const list = h('div', 'werk-list');
  const latest = new Map<number, Design>();
  for (const d of designs) {
    if (!d.guide) continue;
    const prev = latest.get(d.guide.project);
    if (!prev || prev.updated < d.updated) latest.set(d.guide.project, d);
  }
  for (const lv of [1, 2, 3, 4] as const) {
    const sec = h('section', 'werk-level');
    sec.style.setProperty('--lv', LEVELS[lv].color);
    sec.append(h('h2', '', `<span class="lv-n">${lv}</span> ${LEVELS[lv].name}`));
    const grid = h('div', 'werk-grid');
    for (const p of PROJECTS.filter((x) => x.lv === lv)) {
      const d = latest.get(p.n);
      const pr = progressOf(p, d);
      const card = button(
        'werk-card' + (pr >= 1 ? ' done' : pr > 0 ? ' going' : ''),
        `<span class="werk-pic"><img src="${pic(p)}" alt="" draggable="false" loading="lazy"><b class="werk-num">${p.n}</b>${pr >= 1 ? '<i class="werk-tick">✓</i>' : ''}</span>` +
          `<span class="werk-name">${p.title.replace(/^Mein(e|en)? /, '')}</span>` +
          (pr > 0 && pr < 1 ? `<span class="werk-bar"><i style="width:${Math.round(pr * 100)}%"></i></span>` : ''),
        () => openProject(p, d, on),
        p.title,
      );
      grid.append(card);
    }
    sec.append(grid);
    list.append(sec);
  }
  screen.append(h('div', 'decor br', gearsMarkup()), head, h('div', 'cd-wrap', cdLineMarkup()), list);
  root.append(screen);
}

function openProject(p: Project, existing: Design | undefined, on: WerkstattHandlers): void {
  const o = overlay('overlay-dim');
  const box = h('div', 'panel guide-panel start');
  box.style.setProperty('--lv', LEVELS[p.lv].color);
  const going = existing?.guide && !existing.guide.done;
  box.append(
    button('btn guide-close', ICONS.cross, () => o.close(), 'Schließen'),
    h('div', 'start-pic', `<img src="${pic(p)}" alt="" draggable="false">`),
    h('div', 'start-main'),
  );
  const main = box.querySelector('.start-main') as HTMLElement;
  main.append(h('div', 'start-lv', `Stufe ${p.lv} · ${LEVELS[p.lv].name}`), h('h2', '', `${p.n}. ${p.title}`), h('p', 'start-k', p.k), h('div', 'chips', chips(p)));
  if (p.warn) main.append(h('div', 'note warn', `⚠️ ${p.warn}`));
  const row = h('div', 'start-row');
  const start = (d: Design | null) => {
    o.close();
    on.onStart(p, d);
  };
  if (going) {
    row.append(
      button('btn labeled', `<span class="ico">🔁</span><span class="lbl">Neu</span>`, () => start(null), 'Neu anfangen'),
      button('btn labeled send', `<span class="ico">▶️</span><span class="lbl">Weiter</span>`, () => start(existing!), 'Weitermachen'),
    );
  } else {
    row.append(button('btn labeled send', `<span class="ico">▶️</span><span class="lbl">Los geht's</span>`, () => start(null), 'Los geht’s'));
  }
  main.append(row);
  o.root.append(box);
}
