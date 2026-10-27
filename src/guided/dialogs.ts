// Fenster rund um die Laser-Werkstatt: Projekt-Infos, Laser-Regeln, Fertig-Fenster, Werte für die Lehrperson.
import { button, h, overlay } from '../dom';
import { ICONS } from '../icons';
import { LEVELS, MATERIAL } from './projects';
import type { Project } from './engine';

export const RULES: [string, string][] = [
  ['👩‍🏫', 'Nie allein lasern – immer mit einer erwachsenen Person.'],
  ['🔒', 'Der Deckel bleibt beim Lasern zu.'],
  ['👀', 'Zuschauen, solange der Laser arbeitet.'],
  ['⏳', 'Erst warten, bis der Laser fertig ist und der Rauch weg ist.'],
  ['✅', 'Nur Material nehmen, das die Lehrperson erlaubt hat.'],
];

export const pic = (p: Project): string => `werkstatt/pics/${String(p.n).padStart(2, '0')}.jpg`;

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Chips: Material, Bauzeit, Laserzeit, Schwierigkeit. */
export function chips(p: Project): string {
  const [mi, mn] = MATERIAL[p.mat] ?? ['📦', p.mat];
  const dots = Array.from({ length: 5 }, (_, i) => `<i class="${i < p.d ? 'on' : ''}"></i>`).join('');
  return `<span class="chip">${mi} ${esc(mn)}</span><span class="chip">🛠️ ${esc(p.bau)}</span><span class="chip">🔥 ${esc(p.laser)}</span><span class="chip dots" title="Schwierigkeit">${dots}</span>`;
}

function panel(cls: string): { o: ReturnType<typeof overlay>; box: HTMLElement; close: HTMLButtonElement } {
  const o = overlay('overlay-dim');
  const box = h('div', `panel guide-panel ${cls}`);
  const close = button('btn guide-close', ICONS.cross, () => o.close(), 'Schließen');
  box.append(close);
  o.root.append(box);
  return { o, box, close };
}

/** Infos zum Projekt: Warnung, Tipp, Profi-Wissen. */
export function openProjectInfo(p: Project): void {
  const { box } = panel('info');
  box.append(h('h2', '', `${p.n}. ${esc(p.title)}`), h('div', 'chips', chips(p)));
  if (p.warn) box.append(h('div', 'note warn', `⚠️ ${esc(p.warn)}`));
  box.append(h('div', 'note tip', `💡 ${esc(p.tip)}`), h('div', 'note pro', `🧠 Profi-Wissen: ${esc(p.pro)}`));
  box.append(button('btn labeled rules-btn', `<span class="ico">🛡️</span><span class="lbl">Laser-Regeln</span>`, openRules, 'Laser-Regeln'));
}

/** Die 5 Laser-Regeln. */
export function openRules(): void {
  const { box } = panel('rules');
  box.append(h('h2', '', '🛡️ 5 Laser-Regeln'));
  const ul = h('ol', 'rules');
  for (const [i, t] of RULES) ul.append(h('li', '', `<span class="r-ico">${i}</span><span>${esc(t)}</span>`));
  box.append(ul);
}

/** Einstellwerte für die Lehrperson (xTool S1). */
export function openLaserParams(p: Project): void {
  const { box } = panel('params');
  box.append(h('h2', '', `🧑‍🏫 Für die Lehrperson: ${p.n}. ${esc(p.title)}`));
  box.append(h('p', '', `<b>Material:</b> ${esc(p.lp.m)}`));
  if (p.lp.hw) box.append(h('p', '', `<b>Hinweis:</b> ${esc(p.lp.hw)}`));
  box.append(h('p', 'dim-note', 'Rot = Schneiden, Blau = Liniengravur, Schwarz = Flächengravur. Werte als Startwerte; vorher Materialtest.'));
  const t = h('table', 'lp-table');
  t.innerHTML = `<thead><tr><th>Art</th><th>Leistung</th><th>Tempo</th><th>Durchgänge</th></tr></thead>`;
  const body = h('tbody');
  for (const row of p.lp.e) body.append(h('tr', '', row.map((c) => `<td>${esc(c)}</td>`).join('')));
  t.append(body);
  box.append(t);
}

/** Geschafft: Konfetti, Ideen, Werte für die Lehrperson. */
export function openFinish(p: Project, onGallery: () => void): void {
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
  box.append(h('div', 'finish-ico', '🎉'), h('h2', '', 'Geschafft!'), h('p', 'finish-sub', esc(p.title)));
  box.append(h('div', 'note tip', `💡 Noch mehr Ideen: ${p.ich.map(esc).join(' · ')}`));
  const row = h('div', 'finish-row');
  row.append(
    button('btn labeled', `<span class="ico">🧑‍🏫</span><span class="lbl">Für die Lehrperson</span>`, () => openLaserParams(p), 'Werte für die Lehrperson'),
    button('btn labeled', `<span class="ico">✏️</span><span class="lbl">Weiter bauen</span>`, () => o.close(), 'Weiter bearbeiten'),
    button('btn labeled send', `<span class="ico">${ICONS.gallery}</span><span class="lbl">Galerie</span>`, () => {
      o.close();
      onGallery();
    }, 'Zur Galerie'),
  );
  box.append(row);
  o.root.append(confetti, box);
}

export const levelColor = (lv: number): string => LEVELS[lv]?.color ?? '#98c227';
