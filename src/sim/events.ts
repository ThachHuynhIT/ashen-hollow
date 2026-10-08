import type { GameWorld } from './GameWorld';

/**
 * Things the renderer and HUD need to hear about. The sim appends; WorldScene drains
 * once per frame — so nothing has to scan the ECS every frame to notice changes.
 */
export type WorldEvent =
  | { type: 'entityRemoved'; eid: number }
  | { type: 'blueprintPlaced'; eid: number }
  | { type: 'buildingCompleted'; eid: number }
  | { type: 'designationChanged'; eids: number[] }
  | { type: 'stockChanged' }
  | { type: 'colonistDied'; eid: number; cause: 'hunger' | 'exhaustion' };

export const emit = (world: GameWorld, event: WorldEvent): void => {
  world.events.push(event);
};

/** Take and clear all pending events. */
export const drainEvents = (world: GameWorld): WorldEvent[] => world.events.splice(0);
