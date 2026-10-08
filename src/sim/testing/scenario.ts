import type { ResourceId } from '../../data/resources';
import { createGameWorld, type GameWorld } from '../GameWorld';
import type { DoodadSpawn } from '../map/generate';
import type { TerrainGrid } from '../map/TerrainGrid';
import { stepWorld } from '../step';
import { openTerrain } from './terrainFixture';

/** Test-only: a 512×512 px world (Hearthfire at 256,256) with chosen doodads and stock. */
export const scenarioWorld = ({
  doodads = [],
  colonists = 1,
  stock,
  terrain,
}: {
  doodads?: DoodadSpawn[];
  colonists?: number;
  stock?: Partial<Record<ResourceId, number>>;
  terrain?: TerrainGrid;
} = {}): GameWorld =>
  createGameWorld({
    seed: 1,
    colonists,
    stock,
    map: { terrain: terrain ?? openTerrain(32, 32), doodads, start: { x: 256, y: 256 } },
  });

/** Step up to `max` ticks, stopping early when `until` holds. Returns ticks run. */
export const runTicks = (world: GameWorld, max: number, until?: () => boolean): number => {
  for (let i = 1; i <= max; i++) {
    stepWorld(world);
    if (until?.()) return i;
  }
  return max;
};
