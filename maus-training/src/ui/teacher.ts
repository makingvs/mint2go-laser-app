// Lehrkraft-Bereich (versteckt hinter langem Druck auf das Maskottchen).
import { icon } from '../art';
import { el, esc } from '../dom';
import { MAX_STARS } from '../levels';
import { totalStars } from '../progress';
import type { Difficulty } from '../storage';
import type { App } from './app';
import { bigButton, confirmDialog, openModal } from './dialog';

export const applySettings = (app: App): void => {
  document.body.classList.toggle('big-cursor', app.store.settings.bigCursor);
};

export function openTeacher(app: App, host: HTMLElement, onClose: () => void): void {
  openModal(
    host,
    (close) => {
      const box = el('div', 'teacher');
      const render = (): void => {
        const s = app.store.settings;
        box.innerHTML = '';
        box.appendChild(el('h2', '', `${icon('lock')}<span>Lehrkraft-Bereich</span>`));

        const seg = <T extends string | boolean>(label: string, hint: string, options: [T, string][], value: T, set: (v: T) => void): void => {
          const row = el('div', 'trow', `<div class="tlabel"><b>${label}</b><small>${hint}</small></div>`);
          const g = el('div', 'seg');
          for (const [v, t] of options) {
            const b = el('button', 'segbtn' + (v === value ? ' sel' : ''), t);
            b.type = 'button';
            b.addEventListener('click', () => {
              set(v);
              render();
            });
            g.appendChild(b);
          }
          row.appendChild(g);
          box.appendChild(row);
        };

        seg<Difficulty>(
          'Größe der Ziele',
          'Leicht: große Ziele, Schwer: kleine Ziele',
          [['easy', 'Leicht'], ['normal', 'Normal'], ['hard', 'Schwer']],
          s.difficulty,
          (v) => app.store.setSettings({ difficulty: v }),
        );
        seg<boolean>(
          'Mauszeiger',
          'Ein großer Zeiger ist leichter zu finden',
          [[false, 'Normal'], [true, 'Groß']],
          s.bigCursor,
          (v) => {
            app.store.setSettings({ bigCursor: v });
            applySettings(app);
          },
        );
        seg<boolean>(
          'Alle Levels offen',
          'Sonst wird jedes Level erst nach dem vorigen frei',
          [[false, 'Aus'], [true, 'An']],
          s.unlockAll,
          (v) => app.store.setSettings({ unlockAll: v }),
        );

        box.appendChild(el('h3', '', 'Kinder'));
        const list = el('div', 'tkids');
        if (app.store.profiles.length === 0) list.appendChild(el('p', 'tnone', 'Noch kein Kind angelegt.'));
        for (const p of app.store.profiles) {
          const r = el('div', 'tkid', `<span class="avatar">${p.animal}</span><b>${esc(p.name)}</b><small>${icon('star')} ${totalStars(p)} / ${MAX_STARS}</small>`);
          const reset = el('button', 'sqbtn', icon('reset'));
          reset.type = 'button';
          reset.title = 'Sterne zurücksetzen';
          reset.addEventListener('click', async () => {
            if (await confirmDialog(host, `Sterne von ${p.name} löschen?`)) {
              app.store.resetProgress(p.id);
              render();
            }
          });
          const del = el('button', 'sqbtn danger', icon('trash'));
          del.type = 'button';
          del.title = 'Kind löschen';
          del.addEventListener('click', async () => {
            if (await confirmDialog(host, `${p.name} ganz löschen?`)) {
              app.store.removeProfile(p.id);
              render();
            }
          });
          r.append(reset, del);
          list.appendChild(r);
        }
        box.appendChild(list);

        const row = el('div', 'actions');
        row.appendChild(
          bigButton('ok', icon('check'), 'Fertig', () => {
            close();
            onClose();
          }),
        );
        box.appendChild(row);
      };
      render();
      return box;
    },
    'wide',
  );
}
