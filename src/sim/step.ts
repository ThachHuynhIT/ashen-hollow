import { needsSystem } from './colony/needs';
import type { GameWorld } from './GameWorld';

/**
 * One fixed simulation tick. Order matters: needs first (so jobs see current needs),
 * then jobs (which may set paths), then movement (which follows them).
 */
export const stepWorld = (world: GameWorld): void => {
  world.tick++;
  needsSystem(world);
};
