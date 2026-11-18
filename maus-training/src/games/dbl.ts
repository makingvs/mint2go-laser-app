// Welt 3: Doppelklick. Eier (2 Klicks), Schatzkisten (2 Klicks), Blumen (1 Klick).
// Der Doppelklick wird vom Browser erkannt, so gilt automatisch die Geschwindigkeit,
// die in den Mauseinstellungen des Computers eingestellt ist.
import { budArt, chestArt, chickArt, eggArt } from '../art';
import { el } from '../dom';
import { placeNonOverlapping, shuffle } from '../geometry';
import { burst, clickBadge, num, placeAt, str } from './common';
import type { GameFactory } from './types';

type Kind = 'egg' | 'chest' | 'bud';

export const dbl: GameFactory = (ctx) => {
  const mode = str(ctx.p, 'mode');
  const count = num(ctx.p, 'count');
  const r = num(ctx.p, 'r') * ctx.scale;

  const kinds: Kind[] =
    mode === 'eggs'
      ? Array(count).fill('egg')
      : mode === 'chests'
        ? Array(count).fill('chest')
        : shuffle(ctx.rng, [...Array(Math.ceil(count / 2)).fill('egg'), ...Array(Math.floor(count / 2)).fill('bud')] as Kind[]);

  const pts = placeNonOverlapping(ctx.rng, count, r, ctx.play, 30);
  let done = 0;
  ctx.progress(0, count);

  pts.forEach((pt, i) => {
    const kind = kinds[i];
    const need = kind === 'bud' ? 1 : 2;
    const d = el('div', 'piece clickable ' + kind);
    d.innerHTML = kind === 'egg' ? eggArt() : kind === 'chest' ? chestArt(false) : budArt(false);
    placeAt(d, pt.x, pt.y, r * 2);
    d.appendChild(clickBadge(need as 1 | 2));
    ctx.area.appendChild(d);

    let finished = false;
    let pending = 0;

    const open = (): void => {
      if (finished) return;
      finished = true;
      window.clearTimeout(pending);
      const badge = d.querySelector('.badge');
      badge?.remove();
      d.classList.add('opened');
      if (kind === 'egg') {
        d.innerHTML = chickArt();
        burst(ctx.area, pt.x, pt.y, '#FFD93B');
      } else if (kind === 'chest') {
        d.innerHTML = chestArt(true);
        burst(ctx.area, pt.x, pt.y - r * 0.3, '#38B8E8', 12);
      } else {
        d.innerHTML = budArt(true);
        burst(ctx.area, pt.x, pt.y - r * 0.3, '#E01070');
      }
      done++;
      ctx.progress(done, count);
      if (done >= count) ctx.win();
    };

    d.addEventListener('mousedown', (e) => {
      if (e.button !== 0 && !finished) ctx.say('Nimm die linke Maustaste!');
    });

    d.addEventListener('click', (e) => {
      if (finished) return;
      if (need === 1) {
        open();
        return;
      }
      if (e.detail === 1) {
        d.classList.remove('wobble');
        void d.offsetWidth;
        d.classList.add('wobble');
        ctx.say('Zweimal ganz schnell klicken!');
        // Kam kein Doppelklick, zählt der Versuch als Fehler (großzügig bewertet)
        pending = window.setTimeout(() => {
          if (!finished) ctx.mistake();
        }, 900);
        ctx.dis.add(() => window.clearTimeout(pending));
      }
    });

    d.addEventListener('dblclick', () => {
      if (!finished && need === 2) open();
    });
  });
};
