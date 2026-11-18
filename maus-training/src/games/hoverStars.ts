// Welt 1, Level 1: nur bewegen. Sterne sammeln sich, sobald der Zeiger darüber fährt.
import { starArt } from '../art';
import { el } from '../dom';
import { dist, placeNonOverlapping } from '../geometry';
import { burst, num, placeAt } from './common';
import type { GameFactory } from './types';

export const hoverStars: GameFactory = (ctx) => {
  const count = num(ctx.p, 'count');
  const r = num(ctx.p, 'r') * ctx.scale;
  const pts = placeNonOverlapping(ctx.rng, count, r, ctx.play, 30);
  const stars = pts.map((pt, i) => {
    const d = el('div', 'piece star twinkle', starArt());
    d.style.animationDelay = (i % 4) * 0.35 + 's';
    placeAt(d, pt.x, pt.y, r * 2);
    ctx.area.appendChild(d);
    return { pt, d, got: false };
  });
  let got = 0;
  ctx.progress(0, count);

  ctx.dis.on(ctx.area, 'pointermove', (e: PointerEvent) => {
    const p = ctx.toStage(e);
    for (const s of stars) {
      if (s.got || dist(p, s.pt) > r * 0.92) continue;
      s.got = true;
      s.d.classList.add('collected');
      burst(ctx.area, s.pt.x, s.pt.y, '#FFD93B');
      got++;
      ctx.progress(got, count);
      if (got === count) ctx.win();
    }
  });
};
