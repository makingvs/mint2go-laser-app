// Dialog "Dateiname festlegen": Vor jedem Export/Download muss der Benutzer selbst einen Namen für die
// Datei eintippen (es gibt keinen Vorschlag; ohne Namen ist Speichern nicht möglich).
// Die Speicherung wird direkt im Tipp auf ✓ gestartet, weil das Teilen-Menü (iPad) nur aus einer
// Benutzeraktion heraus geöffnet werden darf.
import { button, h, overlay } from './dom';
import { ICONS } from './icons';
import { sanitizeFileName } from './names';

export interface SaveDialogOptions {
  /** Dateiendung ohne Punkt, z. B. "svg" oder "zip" */
  ext: 'svg' | 'zip';
  /** Symbol im Kopf des Dialogs */
  icon?: string;
  /** Wird mit dem vollständigen Dateinamen (inkl. Endung) aufgerufen */
  onSave: (fileName: string) => void | Promise<void>;
}

export function openSaveDialog(o: SaveDialogOptions): void {
  const dlg = overlay('overlay-dim');
  const panel = h('div', 'panel save-panel');
  const head = h('div', 'panel-head');
  const input = h('input', 'name-input');
  input.type = 'text';
  input.maxLength = 80;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Dateiname');
  input.value = ''; // bewusst leer: Der Benutzer muss immer selbst einen Namen festlegen
  input.placeholder = 'Dateiname';
  const suffix = h('span', 'save-ext', `.${o.ext}`);

  const ok = button('btn send', ICONS.check, () => confirm(), 'Speichern');
  const refresh = () => {
    ok.disabled = !sanitizeFileName(input.value, o.ext);
  };
  const confirm = () => {
    const name = sanitizeFileName(input.value, o.ext);
    if (!name) {
      input.classList.remove('shake');
      void input.offsetWidth;
      input.classList.add('shake');
      return;
    }
    dlg.close();
    void o.onSave(name);
  };
  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirm();
    }
  });

  head.append(button('btn', ICONS.cross, () => dlg.close(), 'Abbrechen'), h('div', 'save-ico', o.icon ?? ICONS.download), input, suffix, ok);
  panel.append(head);
  dlg.root.append(panel);
  refresh();
  setTimeout(() => {
    input.focus();
    input.select();
  }, 60);
}
