import type Phaser from 'phaser';
import { TERRAIN, TERRAIN_IDS } from '../data/terrain';
import type { TerrainGrid } from '../sim/map/TerrainGrid';
import { TERRAIN_TILESET_KEY } from './atlas';
import { computeDualGrid, MASK_FULL } from './dualGrid';
import { pixelHash } from './pixel';
import { FULL_VARIANTS, TILE, tileIndex } from './terrainArt';

export const TERRAIN_DEPTH = -1_000_000;

const priorityOf = (t: number): number => TERRAIN[TERRAIN_IDS[t]!].priority;

/**
 * Seamless terrain: one tilemap layer per ground type, stacked by priority, each filled
 * with dual-grid corner masks. The display grid is offset by half a tile so edges fall
 * inside tiles and no grid is visible.
 */
export class TerrainRenderer {
  private readonly map: Phaser.Tilemaps.Tilemap;

  constructor(scene: Phaser.Scene, terrain: TerrainGrid) {
    const dual = computeDualGrid(terrain, priorityOf);
    this.map = scene.make.tilemap({
      tileWidth: TILE,
      tileHeight: TILE,
      width: dual.width,
      height: dual.height,
    });
    const tileset = this.map.addTilesetImage(
      TERRAIN_TILESET_KEY,
      TERRAIN_TILESET_KEY,
      TILE,
      TILE,
      0,
      0,
    );
    if (!tileset) throw new Error('Terrain tileset missing — was buildPlaceholderAtlas called?');

    const order = [...dual.layers.keys()].sort((a, b) => priorityOf(a) - priorityOf(b));
    order.forEach((terrainIdx, i) => {
      const layer = this.map.createBlankLayer(
        TERRAIN_IDS[terrainIdx]!,
        tileset,
        -TILE / 2,
        -TILE / 2,
      );
      if (!layer) throw new Error(`Could not create terrain layer ${terrainIdx}`);
      layer.setDepth(TERRAIN_DEPTH + i);
      const masks = dual.layers.get(terrainIdx)!;
      for (let y = 0; y < dual.height; y++) {
        for (let x = 0; x < dual.width; x++) {
          const mask = masks[y * dual.width + x]!;
          if (mask <= 0) continue;
          // Full tiles pick one of several variants so large areas don't look tiled.
          const column =
            mask === MASK_FULL
              ? FULL_VARIANTS[Math.floor(pixelHash(x, y, 77) * FULL_VARIANTS.length)]!
              : mask;
          layer.putTileAt(tileIndex(terrainIdx, column), x, y, false);
        }
      }
    });
  }

  destroy(): void {
    this.map.destroy();
  }
}
