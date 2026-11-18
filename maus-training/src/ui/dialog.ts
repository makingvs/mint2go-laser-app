import { icon } from '../art';
import { el } from '../dom';

/** Öffnet ein Fenster über der Bühne. build() liefert den Inhalt, close() schließt es. */
export function openModal(host: HTMLElement, build: (close: () => void) => HTMLElement, cls = ''): () => void {
  const back = el('div', 'modal-back');
  const card = el('div', 'modal ' + cls);
  const close = (): void => back.remove();
  card.appendChild(build(close));
  back.appendChild(card);
  host.appendChild(back);
  return close;
}

export function bigButton(kind: 'ok' | 'no' | 'plain', iconSvg: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'bigbtn ' + kind, `${iconSvg}<span>${label}</span>`);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** Ja/Nein-Frage mit zwei großen Tasten. */
export function confirmDialog(host: HTMLElement, text: string): Promise<boolean> {
  return new Promise((resolve) => {
    openModal(host, (close) => {
      const box = el('div', 'confirm');
      box.appendChild(el('p', 'confirm-text', text));
      const row = el('div', 'actions');
      row.append(
        bigButton('no', icon('close'), 'Nein', () => {
          close();
          resolve(false);
        }),
        bigButton('ok', icon('check'), 'Ja', () => {
          close();
          resolve(true);
        }),
      );
      box.appendChild(row);
      return box;
    });
  });
}
