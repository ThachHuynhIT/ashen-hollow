import { terrainAt, terrainIndex, type TerrainDef } from '../../data/terrain';

export const TERRAIN_CELL = 16;

/** Outside the map counts as cliff: impassable, unbuildable. */
const OUTSIDE = terrainIndex('cliff');

/**
 * Ground type on a 16 px grid. Purely a storage/lookup structure — nothing in the
 * game snaps to it (buildings and units use continuous coordinates).
 */
export class TerrainGrid {
  readonly cells: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
    cells?: Uint8Array,
  ) {
    if (cells && cells.length !== width * height) {
      throw new Error(`Terrain size ${cells.length} ≠ ${width}×${height}`);
    }
    this.cells = cells ?? new Uint8Array(width * height);
  }

  get widthPx(): number {
    return this.width * TERRAIN_CELL;
  }

  get heightPx(): number {
    return this.height * TERRAIN_CELL;
  }

  inBounds(cx: number, cy: number): boolean {
    return cx >= 0 && cy >= 0 && cx < this.width && cy < this.height;
  }

  /** Terrain index at a cell, clamping to the map edge. */
  getClamped(cx: number, cy: number): number {
    const x = Math.max(0, Math.min(this.width - 1, cx));
    const y = Math.max(0, Math.min(this.height - 1, cy));
    return this.cells[y * this.width + x]!;
  }

  get(cx: number, cy: number): number {
    return this.inBounds(cx, cy) ? this.cells[cy * this.width + cx]! : OUTSIDE;
  }

  set(cx: number, cy: number, terrain: number): void {
    if (this.inBounds(cx, cy)) this.cells[cy * this.width + cx] = terrain;
  }

  /** Terrain under a world point. */
  indexAtWorld(x: number, y: number): number {
    return this.get(Math.floor(x / TERRAIN_CELL), Math.floor(y / TERRAIN_CELL));
  }

  atWorld(x: number, y: number): TerrainDef {
    return terrainAt(this.indexAtWorld(x, y));
  }
}
