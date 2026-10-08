import { needsSystem } from './colony/needs';
import type { GameWorld } from './GameWorld';
import { jobSystem } from './jobs/jobSystem';
import { movementSystem } from './movement/movement';

/**
 * One fixed simulation tick. Needs first (so jobs see current needs), then jobs
 * (which may set paths), then movement (which follows them).
 */
export const stepWorld = (world: GameWorld): void => {
  world.tick++;
  needsSystem(world);
  jobSystem(world);
  movementSystem(world);
};
