import { terrainIndex, type TerrainId } from '../../data/terrain';
import { TerrainGrid } from '../map/TerrainGrid';

/** Test-only helper: build a terrain grid from ASCII rows (one char per 16 px cell). */
const LEGEND: Record<string, TerrainId> = {
  '.': 'deadGrass',
  '~': 'blackWater',
  m: 'mud',
  f: 'forestFloor',
  h: 'hills',
  c: 'cursedSoil',
  '#': 'cliff',
};

export const terrainFromAscii = (rows: readonly string[]): TerrainGrid => {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const grid = new TerrainGrid(width, height);
  rows.forEach((row, y) => {
    if (row.length !== width)
      throw new Error(`Row ${y} has length ${row.length}, expected ${width}`);
    [...row].forEach((ch, x) => {
      const id = LEGEND[ch];
      if (!id) throw new Error(`Unknown terrain char '${ch}'`);
      grid.set(x, y, terrainIndex(id));
    });
  });
  return grid;
};

/** An all-grass map of the given size in cells. */
export const openTerrain = (width: number, height: number): TerrainGrid =>
  terrainFromAscii(Array.from({ length: height }, () => '.'.repeat(width)));
