import { createWorld, type World } from 'bitecs';
import { components } from './components';
import { generateMap } from './map/generate';
import type { HexMap } from './map/HexMap';
import { Rng } from './random';
import { SimClock } from './SimClock';
import type { Hex } from '../hex';

export const DEFAULT_MAP_WIDTH = 64;
export const DEFAULT_MAP_HEIGHT = 64;

export interface WorldContext {
  readonly components: typeof components;
}

export interface GameWorld {
  readonly seed: number;
  readonly ecs: World<WorldContext>;
  readonly map: HexMap;
  readonly start: Hex;
  readonly rng: Rng;
  readonly clock: SimClock;
}

export interface NewWorldOptions {
  seed: number;
  width?: number;
  height?: number;
}

/** Create a brand-new game: generate the map and an empty ECS world. */
export const createGameWorld = ({
  seed,
  width = DEFAULT_MAP_WIDTH,
  height = DEFAULT_MAP_HEIGHT,
}: NewWorldOptions): GameWorld => {
  const { map, start } = generateMap({ seed, width, height });
  return {
    seed,
    ecs: createWorld<WorldContext>({ components }),
    map,
    start,
    // Separate stream from map generation so gameplay randomness doesn't shift the map.
    rng: new Rng(seed ^ 0x9e3779b9),
    clock: new SimClock(),
  };
};

/** Run one fixed simulation tick. Systems get added here phase by phase. */
export const stepWorld = (_world: GameWorld): void => {
  // Phase 1: jobSystem, needsSystem, movementSystem...
};
