// Fenster rund um die 3D-Werkstatt: Projekt-Infos, Druck-Regeln, Fertig-Fenster.
import { button, h, overlay } from '../../../src/dom';
import { ICONS } from '../../../src/icons';
import type { Project } from './engine3d';
import { LEVELS } from './projects3d';

/** Die 5 Druck-Regeln der Werkstatt (Symbol, kurzer Satz). */
export const RULES: [string, string][] = [
  ['⬇️', 'Flach unten: Die Unterseite liegt ganz auf dem Bett.'],
  ['📏', 'Höchstens 10 cm groß: Nicht größer als 100 mal 100 mal 100 mm.'],
  ['🧱', 'Wände mindestens 2 mm dick: Dünnere Teile brechen leicht ab.'],
  ['🚫', 'Nichts in der Luft: Jedes Teil braucht etwas darunter.'],
  ['📄', 'Datei: STL. Nur diese Datei kann der Drucker lesen.'],
];

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function panel(cls: string): { o: ReturnType<typeof overlay>; box: HTMLElement } {
  const o = overlay('overlay-dim');
  const box = h('div', `panel guide-panel ${cls}`);
  box.append(button('btn guide-close', ICONS.cross, () => o.close(), 'Schließen'));
  o.root.append(box);
  return { o, box };
}

/** Chips: Bauzeit, Druckzeit, Schwierigkeit. */
export function chips(p: Project): string {
  const dots = Array.from({ length: 5 }, (_, i) => `<i class="${i < p.d ? 'on' : ''}"></i>`).join('');
  return `<span class="chip">🛠️ ${esc(p.bau)}</span><span class="chip">🖨️ ${esc(p.druck)}</span><span class="chip dots" title="Schwierigkeit">${dots}</span>`;
}

/** Die 5 Druck-Regeln. */
export function openRules(): void {
  const { box } = panel('rules');
  box.append(h('h2', '', '🛡️ 5 Druck-Regeln'));
  const ul = h('ol', 'rules');
  for (const [i, t] of RULES) ul.append(h('li', '', `<span class="r-ico">${i}</span><span>${esc(t)}</span>`));
  box.append(ul);
}

/** Infos zum Projekt: Warnung, Tipp, Profi-Wissen. */
export function openProjectInfo(p: Project): void {
  const { box } = panel('info');
  box.append(h('h2', '', `${p.emoji} ${p.n}. ${esc(p.title)}`), h('div', 'chips', chips(p)));
  if (p.warn) box.append(h('div', 'note warn', `⚠️ ${esc(p.warn)}`));
  box.append(h('div', 'note tip', `💡 ${esc(p.tip)}`), h('div', 'note pro', `🧠 Profi-Wissen: ${esc(p.pro)}`));
  box.append(button('btn labeled rules-btn', `<span class="ico">🛡️</span><span class="lbl">Druck-Regeln</span>`, openRules, 'Druck-Regeln'));
}

/** Geschafft: Konfetti, Stern, Ideen. */
export function openFinish(p: Project, handlers: { onGallery: () => void; onWerkstatt: () => void }): void {
  const o = overlay('overlay-dim');
  const box = h('div', 'panel guide-panel finish');
  const confetti = h('div', 'confetti');
  const colors = ['#98c227', '#f0a030', '#e01070', '#38b8e8', '#3757a9'];
  for (let i = 0; i < 36; i++) {
    const c = h('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 1.2}s`;
    c.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
    confetti.append(c);
  }
  box.append(h('div', 'finish-ico', '⭐'), h('h2', '', 'Geschafft!'), h('p', 'finish-sub', `${p.emoji} ${esc(p.title)}`));
  box.append(h('div', 'note tip', `💡 Noch mehr Ideen: ${p.ich.map(esc).join(' · ')}`));
  const row = h('div', 'finish-row');
  row.append(
    button('btn labeled', `<span class="ico">✏️</span><span class="lbl">Weiter bauen</span>`, () => o.close(), 'Weiter bauen'),
    button('btn labeled', `<span class="ico">🛠️</span><span class="lbl">Werkstatt</span>`, () => {
      o.close();
      handlers.onWerkstatt();
    }, 'Zur Werkstatt'),
    button('btn labeled send', `<span class="ico">${ICONS.gallery}</span><span class="lbl">Galerie</span>`, () => {
      o.close();
      handlers.onGallery();
    }, 'Zur Galerie'),
  );
  box.append(row);
  o.root.append(confetti, box);
}

export const levelColor = (lv: number): string => LEVELS[lv]?.color ?? '#98c227';
