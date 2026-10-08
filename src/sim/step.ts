import { needsSystem } from './colony/needs';
import type { GameWorld } from './GameWorld';
import { movementSystem } from './movement/movement';

/**
 * One fixed simulation tick. Order matters: needs first (so jobs see current needs),
 * then jobs (which may set paths), then movement (which follows them).
 */
export const stepWorld = (world: GameWorld): void => {
  world.tick++;
  needsSystem(world);
  movementSystem(world);
};
