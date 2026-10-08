import { axialToOffset, offsetToAxial, type Hex } from '../../hex';
import { terrainAt, type TerrainDef } from '../../data/terrain';

/**
 * A rectangular hex map (odd-r offset layout) with packed per-hex layers.
 * Only plain typed arrays live here so the map serialises trivially and can be shared
 * with a pathfinding worker later.
 */
export class HexMap {
  readonly terrain: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
    terrain?: Uint8Array,
  ) {
    if (terrain && terrain.length !== width * height) {
      throw new Error(`Terrain layer size ${terrain.length} ≠ ${width}×${height}`);
    }
    this.terrain = terrain ?? new Uint8Array(width * height);
  }

  get size(): number {
    return this.width * this.height;
  }

  inBounds(h: Hex): boolean {
    const { col, row } = axialToOffset(h);
    return col >= 0 && row >= 0 && col < this.width && row < this.height;
  }

  /** Flat array index for a hex, or -1 when outside the map. */
  indexOf(h: Hex): number {
    const { col, row } = axialToOffset(h);
    if (col < 0 || row < 0 || col >= this.width || row >= this.height) return -1;
    return row * this.width + col;
  }

  hexAt(index: number): Hex {
    return offsetToAxial(index % this.width, Math.floor(index / this.width));
  }

  terrainIndexAt(h: Hex): number {
    const i = this.indexOf(h);
    if (i < 0) throw new Error(`Hex ${h.q},${h.r} is outside the map`);
    return this.terrain[i]!;
  }

  terrainOf(h: Hex): TerrainDef {
    return terrainAt(this.terrainIndexAt(h));
  }

  isPassable(h: Hex): boolean {
    return this.inBounds(h) && this.terrainOf(h).moveCost !== null;
  }

  /** Visit every hex in row-major order. */
  forEach(fn: (h: Hex, index: number) => void): void {
    for (let i = 0; i < this.size; i++) fn(this.hexAt(i), i);
  }

  /** The hex nearest the middle of the map. */
  center(): Hex {
    return offsetToAxial(Math.floor(this.width / 2), Math.floor(this.height / 2));
  }
}
