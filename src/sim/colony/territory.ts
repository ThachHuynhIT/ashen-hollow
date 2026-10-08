import { TERRITORY_RADIUS } from '../../data/colonists';
import type { GameWorld } from '../GameWorld';

/** Phase 1 territory: a fixed circle around the Hearthfire. */
export const inTerritory = (world: GameWorld, x: number, y: number): boolean =>
  (x - world.start.x) ** 2 + (y - world.start.y) ** 2 <= TERRITORY_RADIUS * TERRITORY_RADIUS;
