// Spielbildschirm: Kopfleiste, Startfenster, Spiel, Gewinn-Fenster.
import { icon, mascot, mouseIcon, trophyArt } from '../art';
import { Disposer, confetti, el, esc } from '../dom';
import { mulberry32 } from '../geometry';
import { GAMES } from '../games';
import { PLAY } from '../games/common';
import type { GameCtx } from '../games/types';
import { levelById, nextLevel, worldById } from '../levels';
import { completesWorld, starsFor, type Profile } from '../progress';
import { SIZE_SCALE } from '../storage';
import { STAGE_H, STAGE_W, toStage, type App, type Screen } from './app';
import { openCertificate } from './certificate';
import { bigButton } from './dialog';

export function levelScreen(app: App, profileId: string, levelId: number): Screen {
  const level = levelById(levelId);
  const profile = app.store.profile(profileId);
  if (!level || !profile) {
    app.showProfiles();
    return { el: el('div') };
  }
  const world = worldById(level.world)!;
  const root = el('div', `screen s-level w${world.id}`);
  root.style.setProperty('--wc', world.color);
  const area = el('div', 'game-area');

  const back = el('button', 'hbtn', icon('home'));
  back.type = 'button';
  back.title = 'Zur Karte';
  back.addEventListener('click', () => app.showMap(profileId));
  const titleBox = el(
    'div',
    'hud-title',
    `<span class="hud-mouse">${mouseIcon(level.mouse)}</span><div><b>Level ${level.id} · ${level.title}</b><small>${level.short}</small></div>`,
  );
  const bar = el('i');
  const count = el('span', '', '');
  const prog = el('div', 'hud-progress');
  prog.append(el('div', 'bar'), count);
  prog.firstElementChild!.appendChild(bar);
  const bubble = el('div', 'bubble');
  const mascotEl = el('div', 'mascot', mascot('happy'));
  const hudMascot = el('div', 'hud-mascot');
  hudMascot.append(bubble, mascotEl);
  const hud = el('div', 'hud');
  hud.append(back, titleBox, prog, hudMascot);
  root.append(area, hud);

  let dis: Disposer | null = null;
  const timers: number[] = [];
  let finished = false;
  let mistakes = 0;
  let startedAt = 0;
  let bubbleTimer = 0;
  let moodTimer = 0;

  const later = (fn: () => void, ms: number): void => {
    timers.push(window.setTimeout(fn, ms));
  };

  const say = (text: string): void => {
    bubble.textContent = text;
    bubble.classList.add('show');
    window.clearTimeout(bubbleTimer);
    bubbleTimer = window.setTimeout(() => bubble.classList.remove('show'), 3200);
  };

  const ctx = (): GameCtx => ({
    area,
    level,
    p: level.params,
    scale: SIZE_SCALE[app.store.settings.difficulty],
    rng: mulberry32((Math.random() * 4294967296) >>> 0),
    play: PLAY,
    dis: dis!,
    toStage: (e) => toStage(area, e),
    say,
    progress(done, total) {
      bar.style.width = (total > 0 ? Math.min(100, (done / total) * 100) : 0) + '%';
      count.textContent = level.game === 'path' ? '' : `${done}/${total}`;
    },
    mistake() {
      if (finished) return;
      mistakes++;
      root.classList.remove('oops');
      void root.offsetWidth;
      root.classList.add('oops');
      mascotEl.innerHTML = mascot('oops');
      window.clearTimeout(moodTimer);
      moodTimer = window.setTimeout(() => (mascotEl.innerHTML = mascot('happy')), 1100);
    },
    win() {
      if (finished) return;
      finished = true;
      const seconds = (performance.now() - startedAt) / 1000;
      const earned = starsFor(level, mistakes, seconds);
      const before: Profile = { ...profile, stars: { ...profile.stars } };
      app.store.recordResult(profileId, levelId, earned);
      const worldNew = completesWorld(before, profile, levelId);
      mascotEl.innerHTML = mascot('cheer');
      bubble.classList.remove('show');
      later(() => showWin(earned, worldNew), 900);
      later(() => dis?.dispose(), 1000);
    },
  });

  /* ---------- Startfenster ---------- */

  const intro = el('div', 'overlay intro');
  const card = el('div', 'card');
  card.innerHTML =
    `<div class="card-head"><span>Level ${level.id}</span><b>${level.title}</b></div>` +
    `<div class="intro-mouse">${mouseIcon(level.mouse)}</div>` +
    `<p class="intro-text">${level.intro}</p>`;
  const go = bigButton('ok', icon('next'), 'Los geht’s!', () => {
    intro.remove();
    dis = new Disposer();
    startedAt = performance.now();
    bar.style.width = '0%';
    GAMES[level.game](ctx());
  });
  go.classList.add('pulse');
  card.appendChild(go);
  intro.appendChild(card);
  root.appendChild(intro);

  /* ---------- Gewinn-Fenster ---------- */

  const showWin = (earned: number, worldNew: boolean): void => {
    const o = el('div', 'overlay win');
    const c = el('div', 'card');
    const hint =
      earned >= 3
        ? 'Perfekt!'
        : level.par && mistakes === 0
          ? 'Mit mehr Tempo gibt es mehr Sterne!'
          : 'Mit weniger Fehlern gibt es mehr Sterne!';
    c.innerHTML =
      `<div class="win-mascot">${mascot('cheer')}</div>` +
      `<h2>Super, ${esc(profile.name)}!</h2>` +
      `<div class="win-stars">${[1, 2, 3].map((i) => `<span class="st ${i <= earned ? 'on' : ''}" style="animation-delay:${0.25 + i * 0.28}s">${icon('star')}</span>`).join('')}</div>` +
      `<p class="win-hint">${hint}</p>`;
    const row = el('div', 'actions');
    row.append(bigButton('plain', icon('home'), 'Karte', () => app.showMap(profileId)));
    row.append(bigButton('plain', icon('replay'), 'Nochmal', () => app.showLevel(profileId, levelId)));
    const nl = nextLevel(levelId);
    row.append(
      bigButton('ok', icon('next'), nl ? 'Weiter' : 'Fertig', () => (nl ? app.showLevel(profileId, nl.id) : app.showMap(profileId))),
    );
    if (worldNew) {
      const t = el('div', 'world-win', `<span class="tr">${trophyArt()}</span><b>Welt „${world.title}“ geschafft!</b>`);
      const tb = bigButton('plain', icon('trophy'), 'Urkunde', () => openCertificate(app, root, profile, world.id));
      t.appendChild(tb);
      c.appendChild(t);
    }
    c.appendChild(row);
    o.appendChild(c);
    root.appendChild(o);
    confetti(root, worldNew ? 90 : 46);
  };

  // Maße der Bühne für die Spiele fest halten (falls CSS sich ändert)
  area.style.width = STAGE_W + 'px';
  area.style.height = STAGE_H + 'px';

  return {
    el: root,
    dispose() {
      dis?.dispose();
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(bubbleTimer);
      window.clearTimeout(moodTimer);
    },
  };
}
