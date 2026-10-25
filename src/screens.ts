// Profil-Auswahl und Galerie.
import { cdLineMarkup, gearsMarkup } from './decor';
import { button, confirmDialog, h, onLongPress, overlay } from './dom';
import { buildZip, saveFile, saveSvg, zipName } from './exporter';
import { ANIMALS, ICONS } from './icons';
import { thumbnailSvg } from './render';
import { storage, type Profile } from './storage';
import { openTeacher } from './teacher';
import type { Design, Settings } from './model';

function errorBox(retry: () => void): HTMLElement {
  const box = h('div', 'error-box', `<div class="fail-icon">⚠️</div>`);
  box.append(button('big-btn yes', ICONS.retry, retry, 'Nochmal'));
  return box;
}

export function profileScreen(
  root: HTMLElement,
  settings: Settings,
  onPick: (p: Profile) => void,
  onSettings: (s: Settings) => void,
): void {
  root.innerHTML = '';
  const screen = h('div', 'screen profile-screen');
  const logo = h('div', 'logo', '<img class="logo-img" src="mint2go-logo.png" alt="MINT2Go – MINT erleben" draggable="false">');
  screen.append(h('div', 'decor tl', gearsMarkup()), h('div', 'decor br', gearsMarkup()));
  onLongPress(logo, 1500, () => openTeacher(settings, onSettings));
  const grid = h('div', 'card-grid');
  screen.append(logo);
  if (!storage.persistent) {
    screen.append(h('div', 'warn-banner', '⚠️ Speichern ist in diesem Browser nicht möglich – Arbeiten gehen beim Schließen verloren. Bitte die App im normalen Safari-Fenster bzw. vom Home-Bildschirm öffnen.'));
  }
  screen.append(grid);
  root.append(screen);

  const load = async () => {
    try {
      const list = await storage.listProfiles();
      grid.innerHTML = '';
      for (const p of list) {
        grid.append(button('card profile-card', `<span class="emoji">${p.icon}</span><span class="cap">${p.name.replace(/_/g, ' ')}</span>`, () => onPick(p), p.name));
      }
      grid.append(button('card add-card', ICONS.plus, () => newProfile(onPick), 'Neu'));
    } catch {
      grid.innerHTML = '';
      grid.append(errorBox(() => void load()));
    }
  };
  void load();
}

function newProfile(onPick: (p: Profile) => void): void {
  const o = overlay('overlay-dim');
  const panel = h('div', 'panel');
  const head = h('div', 'panel-head');
  const name = h('input', 'name-input');
  name.type = 'text';
  name.maxLength = 20;
  name.placeholder = '…';
  name.autocomplete = 'off';
  let chosen = ANIMALS[0];
  const ok = button('btn send', ICONS.check, async () => {
    try {
      const p = await storage.createProfile(name.value.trim() || chosen.name, chosen.icon);
      o.close();
      onPick(p);
    } catch {
      ok.classList.add('shake');
    }
  }, 'Fertig');
  head.append(button('btn', ICONS.cross, () => o.close(), 'Schließen'), name, ok);
  const grid = h('div', 'pick-grid animals');
  for (const a of ANIMALS) {
    const b = button('pick-item' + (a === chosen ? ' active' : ''), `<span class="emoji">${a.icon}</span>`, () => {
      chosen = a;
      grid.querySelectorAll('.pick-item').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    }, a.name);
    grid.append(b);
  }
  panel.append(head, grid);
  o.root.append(panel);
}

export function galleryScreen(
  root: HTMLElement,
  profile: Profile,
  settings: Settings,
  onBack: () => void,
  onOpen: (d: Design | null) => void,
): void {
  root.innerHTML = '';
  const screen = h('div', 'screen gallery-screen');
  const head = h('div', 'gallery-head');
  const exportAll = button('btn', ICONS.download, async () => {
    const designs = (await storage.listAllDesigns()).filter((d) => d.profile === profile.id);
    if (!designs.some((d) => d.elements.length)) {
      exportAll.classList.remove('shake');
      void exportAll.offsetWidth;
      exportAll.classList.add('shake');
      return;
    }
    await saveFile(zipName(profile.name), buildZip(designs, [profile], settings), 'application/zip');
  }, 'Alle exportieren');
  head.append(button('btn big', ICONS.back, onBack, 'Zurück'), h('div', 'who', profile.icon), h('div', 'spacer'), exportAll);
  const grid = h('div', 'card-grid');
  screen.append(h('div', 'decor br', gearsMarkup()), head, h('div', 'cd-wrap', cdLineMarkup()), grid);
  root.append(screen);

  const load = async () => {
    try {
      const list = await storage.listDesigns(profile.id);
      grid.innerHTML = '';
      grid.append(button('card add-card wide', ICONS.plus, () => onOpen(null), 'Neu'));
      for (const d of list) {
        const card = h('div', 'card work-card');
        const open = button('work-open', thumbnailSvg(d, settings), () => onOpen(d), 'Öffnen');
        const del = button('work-del', ICONS.trash, async () => {
          if (!(await confirmDialog(ICONS.trash))) return;
          try {
            await storage.deleteDesign(profile.id, d.id);
          } catch {
            /* wird beim nächsten Laden sichtbar */
          }
          void load();
        }, 'Löschen');
        const exp = button('work-export', ICONS.download, () => void saveSvg(profile, d, settings), 'Exportieren');
        card.append(open, del, exp);
        grid.append(card);
      }
    } catch {
      grid.innerHTML = '';
      grid.append(errorBox(() => void load()));
    }
  };
  void load();
}
