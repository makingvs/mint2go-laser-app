// Startbildschirm: Wer spielt? Kinder wählen ihr Tier oder legen sich neu an.
import { icon, mascot } from '../art';
import { el, esc, longPress } from '../dom';
import { MAX_NAME, MAX_PROFILES, ANIMALS } from '../storage';
import { totalStars } from '../progress';
import { MAX_STARS } from '../levels';
import type { App, Screen } from './app';
import { bigButton, openModal } from './dialog';
import { openTeacher } from './teacher';

export function profilesScreen(app: App): Screen {
  const root = el('div', 'screen s-home');
  const logo = el('div', 'logo', `<div class="logo-mascot">${mascot('cheer')}</div><div class="logo-text"><b>Maus-Training</b><small>Spielend die Maus lernen</small></div><i class="ring"></i>`);
  longPress(logo, 1500, () => openTeacher(app, root, () => app.showProfiles()));
  const title = el('h1', 'home-title', 'Wer spielt heute?');
  const cards = el('div', 'cards');
  root.append(logo, title, cards);

  const last = app.store.data.last;
  const list = [...app.store.profiles].sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : a.created - b.created));
  for (const p of list) {
    const c = el('button', 'card kid', `<span class="avatar">${p.animal}</span><b>${esc(p.name)}</b><small>${icon('star')}${totalStars(p)} / ${MAX_STARS}</small>`);
    c.type = 'button';
    c.addEventListener('click', () => {
      app.store.setLast(p.id);
      app.showMap(p.id);
    });
    cards.appendChild(c);
  }
  if (app.store.profiles.length < MAX_PROFILES) {
    const add = el('button', 'card add' + (app.store.profiles.length === 0 ? ' pulse' : ''), `<span class="avatar">${icon('plus')}</span><b>Neu</b>`);
    add.type = 'button';
    add.addEventListener('click', () => newKid(app, root));
    cards.appendChild(add);
  }

  // Beim allerersten Start gleich fragen
  if (app.store.profiles.length === 0) window.setTimeout(() => newKid(app, root), 350);

  return { el: root };
}

function newKid(app: App, host: HTMLElement): void {
  openModal(host, (close) => {
    const box = el('div', 'newkid');
    box.appendChild(el('h2', '', 'Hallo! Wie heißt du?'));
    const input = el('input', 'name-input');
    input.type = 'text';
    input.maxLength = MAX_NAME;
    input.placeholder = 'Dein Name';
    input.autocomplete = 'off';
    input.spellcheck = false;
    box.appendChild(input);
    box.appendChild(el('p', 'pick-title', 'Suche dir ein Tier aus:'));
    const grid = el('div', 'animal-grid');
    const used = app.store.usedAnimals();
    let chosen = ANIMALS.find((a) => !used.includes(a)) ?? '';
    const buttons: HTMLButtonElement[] = [];
    for (const a of ANIMALS) {
      const b = el('button', 'animal', a);
      b.type = 'button';
      const taken = used.includes(a);
      b.disabled = taken;
      if (a === chosen) b.classList.add('sel');
      b.addEventListener('click', () => {
        chosen = a;
        buttons.forEach((x) => x.classList.toggle('sel', x === b));
        update();
      });
      buttons.push(b);
      grid.appendChild(b);
    }
    box.appendChild(grid);

    const row = el('div', 'actions');
    const ok = bigButton('ok', icon('check'), 'Los!', () => submit());
    const no = bigButton('no', icon('close'), 'Zurück', close);
    row.append(no, ok);
    box.appendChild(row);

    const update = (): void => {
      ok.disabled = input.value.trim() === '' || chosen === '';
    };
    const submit = (): void => {
      if (ok.disabled) return;
      const p = app.store.addProfile(input.value, chosen);
      if (!p) return;
      close();
      app.showMap(p.id);
    };
    input.addEventListener('input', update);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    update();
    window.setTimeout(() => input.focus(), 50);
    return box;
  });
}
