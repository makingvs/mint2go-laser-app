// Urkunde zum Ausdrucken (A4 quer). Die Druckansicht blendet alles andere aus (siehe style.css, @media print).
import { icon, mascot, trophyArt } from '../art';
import { el, esc } from '../dom';
import { WORLDS, worldById } from '../levels';
import { totalStars, worldStars, type Profile } from '../progress';
import type { App } from './app';
import { bigButton } from './dialog';

export function certificateText(profile: Profile, scope: number | 'all'): { headline: string; line: string; got: number; max: number } {
  if (scope === 'all') {
    const max = WORLDS.reduce((n, w) => n + w.levels.length * 3, 0);
    return {
      headline: 'Maus-Profi',
      line: 'hat das ganze Maus-Training gemeistert: Zeigen, Klicken, Doppelklick, Ziehen und Mausrad.',
      got: totalStars(profile),
      max,
    };
  }
  const w = worldById(scope)!;
  return {
    headline: w.title,
    line: `hat im Maus-Training die Welt „${w.title}“ gemeistert.`,
    got: worldStars(profile, w),
    max: w.levels.length * 3,
  };
}

export function openCertificate(_app: App, _host: HTMLElement, profile: Profile, scope: number | 'all'): void {
  const t = certificateText(profile, scope);
  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const wrap = el('div', 'cert-wrap');
  const sheet = el('div', 'cert');
  sheet.innerHTML =
    `<div class="cert-border">` +
    `<div class="cert-mascot l">${mascot('cheer')}</div><div class="cert-mascot r">${mascot('cheer')}</div>` +
    `<div class="cert-trophy">${trophyArt()}</div>` +
    `<h1>Urkunde</h1>` +
    `<p class="cert-for">für</p>` +
    `<div class="cert-name"><span>${profile.animal}</span>${esc(profile.name)}</div>` +
    `<p class="cert-line">${esc(t.line)}</p>` +
    `<div class="cert-stars">${icon('star')}<b>${t.got}</b> von ${t.max} Sternen</div>` +
    `<div class="cert-foot"><div><span>${date}</span><small>Datum</small></div><div><span>&nbsp;</span><small>Unterschrift</small></div></div>` +
    `</div>`;
  const actions = el('div', 'cert-actions');
  const close = (): void => {
    wrap.remove();
    document.body.classList.remove('cert-open');
  };
  actions.append(
    bigButton('no', icon('close'), 'Zurück', close),
    bigButton('ok', icon('print'), 'Drucken', () => window.print()),
  );
  wrap.append(sheet, actions);
  document.body.appendChild(wrap);
  document.body.classList.add('cert-open');
}
