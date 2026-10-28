// Profil-Auswahl und Galerie der 3D-App (gleiches Aussehen und gleiche Bedienung wie die Laser-App).
import { cdLineMarkup, gearsMarkup } from '../../src/decor';
import { button, confirmDialog, h, onLongPress, overlay } from '../../src/dom';
import { saveFile } from '../../src/exporter';
import { ANIMALS, ICONS } from '../../src/icons';
import { safeName } from '../../src/names';
import { openSaveDialog } from '../../src/saveDialog';
import { buildZip3d, unpackDesign } from './designIO';
import { exportParts } from './exportFlow';
import { KIND_ICONS } from './icons3d';
import { openLicenses } from './licenses3d';
import { openTeacher } from './teacher3d';
import { projectByNumber } from './werkstatt/projects3d';
import { storage, type Design, type Profile, type Settings } from './storage3d';

function errorBox(retry: () => void): HTMLElement {
  const box = h('div', 'error-box', `<div class="fail-icon">⚠️</div>`);
  box.append(button('big-btn yes', ICONS.retry, retry, 'Nochmal'));
  return box;
}

const shake = (el: HTMLElement): void => {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
};

export function profileScreen(root: HTMLElement, settings: Settings, onPick: (p: Profile) => void, onSettings: (s: Settings) => void): void {
  root.innerHTML = '';
  const screen = h('div', 'screen profile-screen');
  const logo = h('div', 'logo', '<span class="logo-wrap"><img class="logo-img" src="mint2go-logo.png" alt="MINT2Go – MINT erleben" draggable="false"><span class="badge3d" aria-label="3D-Druck">' + KIND_ICONS.box + '</span></span>');
  screen.append(h('div', 'decor tl', gearsMarkup()), h('div', 'decor br', gearsMarkup()));
  onLongPress(logo, 1500, () => openTeacher(settings, onSettings)); // Lehrkraft-Bereich: langer Druck auf das Logo
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
  onWerkstatt?: () => void,
): void {
  root.innerHTML = '';
  const screen = h('div', 'screen gallery-screen');
  const head = h('div', 'gallery-head');
  const exportAll = button('btn', ICONS.download, async () => {
    const designs = (await storage.listAllDesigns()).filter((d) => d.profile === profile.id && d.parts.length);
    const busy = overlay('overlay-dim');
    busy.root.append(h('div', 'confirm-card', `<div class="spinner">${ICONS.gear}</div>`));
    const zip = designs.length ? await buildZip3d(designs, [profile], settings, settings.format).catch(() => null) : null;
    busy.close();
    if (!zip) return shake(exportAll); // nichts Druckbares da
    openSaveDialog({
      ext: 'zip',
      onSave: (fileName) => void saveFile(fileName, zip, 'application/zip'),
    });
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
      if (onWerkstatt) grid.append(button('card werk-entry wide', '<span class="emoji">🛠️</span><span class="cap">3D-Werkstatt</span>', onWerkstatt, '3D-Werkstatt'));
      for (const d of list) {
        const card = h('div', 'card work-card');
        const thumb = d.thumb ? `<img class="thumb" src="${d.thumb}" alt="" draggable="false">` : `<span class="thumb thumb-empty">${KIND_ICONS.box}</span>`;
        const open = button('work-open', thumb, () => onOpen(d), 'Öffnen');
        const del = button('work-del', ICONS.trash, async () => {
          if (!(await confirmDialog(ICONS.trash))) return;
          try {
            await storage.deleteDesign(profile.id, d.id);
          } catch {
            /* wird beim nächsten Laden sichtbar */
          }
          void load();
        }, 'Löschen');
        const exp = button('work-export', ICONS.download, async () => {
          if (!d.parts.length) return shake(exp);
          await exportParts(unpackDesign(d), settings, settings.format);
        }, 'Exportieren');
        if (d.guide) card.append(h('div', 'work-badge' + (d.guide.done ? ' done' : ''), `${d.guide.done ? '⭐' : '🛠️'} ${projectByNumber(d.guide.project)?.emoji ?? d.guide.project}`));
        const actions = h('div', 'work-actions');
        actions.append(exp, del);
        card.append(open, actions);
        grid.append(card);
      }
    } catch {
      grid.innerHTML = '';
      grid.append(errorBox(() => void load()));
    }
  };
  void load();
}
