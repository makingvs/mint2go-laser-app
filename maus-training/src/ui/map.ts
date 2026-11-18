// Weltkarte: 5 Welten mit je 3 Levels, Sterne, Urkunden.
import { icon, mascot, worldIcon } from '../art';
import { el, esc, longPress } from '../dom';
import { MAX_STARS, WORLDS } from '../levels';
import { allDone, isUnlocked, nextToPlay, starsOf, totalStars, worldDone, worldStars } from '../progress';
import type { App, Screen } from './app';
import { openCertificate } from './certificate';
import { openTeacher } from './teacher';

const stars = (n: number): string =>
  [1, 2, 3].map((i) => `<span class="st ${i <= n ? 'on' : ''}">${icon('star')}</span>`).join('');

export function mapScreen(app: App, profileId: string): Screen {
  const profile = app.store.profile(profileId);
  if (!profile) {
    app.showProfiles();
    return { el: el('div') };
  }
  const unlockAll = app.store.settings.unlockAll;
  const root = el('div', 'screen s-map');

  const kid = el('button', 'kidchip', `<span class="avatar">${profile.animal}</span><b>${esc(profile.name)}</b>${icon('people')}`);
  kid.type = 'button';
  kid.title = 'Anderes Kind';
  kid.addEventListener('click', () => app.showProfiles());

  const total = el('div', 'totalstars', `${icon('star')}<b>${totalStars(profile)}</b><small>/ ${MAX_STARS}</small>`);

  const mascotEl = el('div', 'hud-mascot', `<div class="mascot">${mascot('happy')}</div><i class="ring"></i>`);
  longPress(mascotEl, 1500, () => openTeacher(app, root, () => app.showMap(profileId)));

  const top = el('div', 'topbar');
  top.append(kid, total, mascotEl);

  const worlds = el('div', 'worlds');
  const next = nextToPlay(profile);
  for (const w of WORLDS) {
    const col = el('div', 'world');
    col.style.setProperty('--wc', w.color);
    col.appendChild(el('div', 'world-head', `<div class="world-icon">${worldIcon(w.icon)}</div><b>${w.title}</b>`));
    const lv = el('div', 'levels');
    for (const l of w.levels) {
      const open = isUnlocked(profile, l.id, unlockAll);
      const n = starsOf(profile, l.id);
      const b = el(
        'button',
        'level' + (open ? '' : ' locked') + (next?.id === l.id ? ' next' : '') + (n > 0 ? ' done' : ''),
        `<span class="num">${open ? l.id : icon('lock')}</span><span class="stars">${stars(n)}</span><small>${l.title}</small>`,
      );
      b.type = 'button';
      b.disabled = !open;
      b.addEventListener('click', () => app.showLevel(profileId, l.id));
      lv.appendChild(b);
    }
    col.appendChild(lv);
    const done = worldDone(profile, w);
    const foot = el('div', 'world-foot');
    if (done) {
      const t = el('button', 'cert-btn', `${icon('trophy')}<span>Urkunde</span>`);
      t.type = 'button';
      t.addEventListener('click', () => openCertificate(app, root, profile, w.id));
      foot.appendChild(t);
    } else {
      foot.innerHTML = `<small class="wstars">${icon('star')} ${worldStars(profile, w)} / 9</small>`;
    }
    col.appendChild(foot);
    worlds.appendChild(col);
  }

  const bottom = el('div', 'bottombar');
  if (allDone(profile)) {
    const m = el('button', 'bigbtn ok master', `${icon('trophy')}<span>Maus-Profi-Urkunde</span>`);
    m.type = 'button';
    m.addEventListener('click', () => openCertificate(app, root, profile, 'all'));
    bottom.appendChild(m);
  } else if (next) {
    const go = el('button', 'bigbtn ok go', `${icon('next')}<span>${starsOf(profile, 1) === 0 && totalStars(profile) === 0 ? 'Start' : 'Weiter'}</span>`);
    go.type = 'button';
    go.addEventListener('click', () => app.showLevel(profileId, next.id));
    bottom.appendChild(go);
  }

  root.append(top, worlds, bottom);
  return { el: root };
}
