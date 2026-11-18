// Welt 2, Level 3: nur die roten Äpfel anklicken, die Birnen hängen lassen (Form UND Farbe unterscheiden sich).
import { appleArt, pearArt } from '../art';
import { el } from '../dom';
import { placeNonOverlapping, shuffle } from '../geometry';
import { burst, num, placeAt } from './common';
import type { GameFactory } from './types';

export const apples: GameFactory = (ctx) => {
  const good = num(ctx.p, 'good');
  const bad = num(ctx.p, 'bad');
  const r = num(ctx.p, 'r') * ctx.scale;
  const pts = placeNonOverlapping(ctx.rng, good + bad, r, ctx.play, 26);
  const kinds = shuffle(ctx.rng, [...Array(good).fill(true), ...Array(bad).fill(false)] as boolean[]);
  let picked = 0;
  ctx.progress(0, good);

  pts.forEach((pt, i) => {
    const isApple = kinds[i];
    const d = el('div', 'fruit ' + (isApple ? 'apple' : 'pear'), isApple ? appleArt() : pearArt());
    d.style.setProperty('--bob', ctx.rng() * 2.4 + 's');
    placeAt(d, pt.x, pt.y, r * 2);
    ctx.area.appendChild(d);

    d.addEventListener('mousedown', (e) => {
      if (e.button !== 0) {
        ctx.say('Nimm die linke Maustaste!');
        return;
      }
      if (d.classList.contains('picked')) return;
      if (isApple) {
        d.classList.add('picked');
        burst(ctx.area, pt.x, pt.y, '#E8283C');
        picked++;
        ctx.progress(picked, good);
        if (picked >= good) ctx.win();
      } else {
        d.classList.remove('nope');
        void d.offsetWidth;
        d.classList.add('nope');
        ctx.say('Das ist eine Birne. Nur rote Äpfel!');
        ctx.mistake();
      }
    });
  });
};
