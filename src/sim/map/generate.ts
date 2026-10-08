import { hexDistance, hexSpiral, type Hex } from '../../hex';
import { terrainIndex, type TerrainId } from '../../data/terrain';
import { fractalNoise2D } from '../noise';
import { HexMap } from './HexMap';

export interface MapGenOptions {
  seed: number;
  width: number;
  height: number;
  /** Radius around the start hex that is forced to open ground. */
  clearingRadius?: number;
}

export interface GeneratedMap {
  map: HexMap;
  /** Where the colony's Hearthfire will stand. */
  start: Hex;
}

/**
 * Phase 0/1 generator: one "Dead Valley" biome built from three noise fields.
 *   elevation → water (low), hills and crags (high)
 *   moisture  → bog (wet lowland), dead forest (wet upland)
 *   blight    → cursed soil patches (the Veil bleeding through)
 * Edges of the map are pushed upwards so the valley is ringed by crags.
 */
export const generateMap = ({
  seed,
  width,
  height,
  clearingRadius = 3,
}: MapGenOptions): GeneratedMap => {
  const map = new HexMap(width, height);
  const start = map.center();
  const startIdx = map.indexOf(start);
  const startCol = startIdx % width;
  const startRow = Math.floor(startIdx / width);
  const maxEdgeDist = Math.min(width, height) / 2;

  map.forEach((_h, i) => {
    const col = i % width;
    const row = Math.floor(i / width);
    // Sample noise in "visual" space so odd-row offset doesn't distort the blobs.
    const nx = col + (row & 1) * 0.5;
    const ny = row * 0.75;

    const edgeDist = Math.min(col, row, width - 1 - col, height - 1 - row);
    const rim = Math.max(0, 1 - edgeDist / (maxEdgeDist * 0.35));

    const elevation =
      fractalNoise2D(seed, nx, ny, { octaves: 4, frequency: 0.08, persistence: 0.5 }) + rim * 0.45;
    const moisture = fractalNoise2D(seed + 101, nx, ny, {
      octaves: 3,
      frequency: 0.1,
      persistence: 0.5,
    });
    const blight = fractalNoise2D(seed + 202, nx, ny, {
      octaves: 2,
      frequency: 0.12,
      persistence: 0.5,
    });

    let id: TerrainId;
    if (elevation > 0.78) id = 'mountain';
    else if (elevation < 0.3) id = 'blackWater';
    else if (elevation > 0.64) id = moisture > 0.55 ? 'deadForest' : 'hills';
    else if (blight > 0.72) id = 'cursedSoil';
    else if (moisture > 0.62) id = elevation < 0.42 ? 'mud' : 'deadForest';
    else if (moisture > 0.52) id = 'deadForest';
    else id = 'deadGrass';

    // Keep the starting valley open and buildable.
    const d = Math.max(Math.abs(col - startCol), Math.abs(row - startRow));
    if (d <= clearingRadius + 2 && (id === 'mountain' || id === 'blackWater')) id = 'deadGrass';

    map.terrain[i] = terrainIndex(id);
  });

  const clearing = terrainIndex('deadGrass');
  for (const h of hexSpiral(start, clearingRadius)) {
    if (map.inBounds(h) && hexDistance(h, start) <= clearingRadius) {
      map.terrain[map.indexOf(h)] = clearing;
    }
  }

  return { map, start };
};
