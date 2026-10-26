// Profil-Auswahl und Galerie.
import { cdLineMarkup, gearsMarkup } from './decor';
import { openLicenses } from './licenses';
import { button, confirmDialog, h, onLongPress, overlay } from './dom';
import { buildZip, saveFile, saveSvg, zipName } from './exporter';
import { ANIMALS, ICONS } from './icons';
import { thumbnailSvg } from './render';
import { safeName } from './names';
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
  screen.append(grid, button('btn info-btn', ICONS.info, openLicenses, 'Lizenzen'));
  root.append(screen);

  const load = async () => {
    try {
      const list = await storage.listProfiles();
      grid.innerHTML = '';
      for (const p of list) {
        grid.append(button('card profile-card', `<span class="emoji">${p.icon}</span><span class="cap">${p.name.replace(/_/g, ' ')}</span>`, () => onPick(p), p.name));
      }
      grid.append(button('card add-card', ICONS.plus, () => newProfile(onPick, list), 'Neu'));
    } catch {
      grid.innerHTML = '';
      grid.append(errorBox(() => void load()));
    }
  };
  void load();
}

/**
 * Neuen Benutzer anlegen. Tier-Symbole, die schon ein Benutzer hat, sind gesperrt; sie werden erst
 * wieder frei, wenn dieser Benutzer gelöscht wurde. Ebenso muss der Name neu sein.
 */
function newProfile(onPick: (p: Profile) => void, existing: Profile[]): void {
  const used = new Set(existing.map((p) => p.icon));
  const o = overlay('overlay-dim');
  const panel = h('div', 'panel');
  const head = h('div', 'panel-head');
  const name = h('input', 'name-input');
  name.type = 'text';
  name.maxLength = 20;
  name.placeholder = '…';
  name.autocomplete = 'off';
  let chosen = ANIMALS.find((a) => !used.has(a.icon)) ?? null;
  const shake = (el: HTMLElement) => {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  };
  const ok = button('btn send', ICONS.check, async () => {
    if (!chosen) return shake(ok);
    const id = safeName(name.value.trim() || chosen.name);
    if (existing.some((p) => p.id === id)) return shake(name); // Name schon vergeben
    try {
      const p = await storage.createProfile(name.value.trim() || chosen.name, chosen.icon);
      o.close();
      onPick(p);
    } catch {
      shake(ok);
    }
  }, 'Fertig');
  ok.disabled = !chosen;
  head.append(button('btn', ICONS.cross, () => o.close(), 'Schließen'), name, ok);
  const grid = h('div', 'pick-grid animals');
  for (const a of ANIMALS) {
    const taken = used.has(a.icon);
    const b = button('pick-item' + (a === chosen ? ' active' : '') + (taken ? ' used' : ''), `<span class="emoji">${a.icon}</span>`, () => {
      if (taken) return;
      chosen = a;
      ok.disabled = false;
      grid.querySelectorAll('.pick-item').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    }, a.name);
    b.disabled = taken;
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
  const deleteUser = button('btn danger', ICONS.trash, async () => {
    if (!(await confirmDialog(ICONS.trash))) return;
    try {
      await storage.deleteProfile(profile.id);
    } catch {
      return;
    }
    onBack();
  }, 'Benutzer löschen');
  head.append(button('btn big', ICONS.back, onBack, 'Zurück'), h('div', 'who', profile.icon), h('div', 'spacer'), exportAll, deleteUser);
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
