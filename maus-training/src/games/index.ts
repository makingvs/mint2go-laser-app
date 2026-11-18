import type { GameKind } from '../levels';
import { apples } from './apples';
import { balloons } from './balloons';
import { dbl } from './dbl';
import { drag } from './drag';
import { hoverStars } from './hoverStars';
import { path } from './path';
import { rotate } from './rotate';
import { targets } from './targets';
import type { GameFactory } from './types';

export const GAMES: Record<GameKind, GameFactory> = {
  hoverStars,
  path,
  balloons,
  targets,
  apples,
  dbl,
  drag,
  rotate,
};
