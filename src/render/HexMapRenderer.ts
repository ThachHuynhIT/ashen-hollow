import type Phaser from 'phaser';
import { DEFAULT_LAYOUT, HEX_TILE_HEIGHT, HEX_TILE_WIDTH, type Hex } from '../hex';
import { TERRAIN_IDS } from '../data/terrain';
import type { HexMap } from '../sim/map/HexMap';
import { ATLAS_KEY, FRAMES, terrainFrame } from './atlas';
import { TERRAIN_VARIANTS } from './terrainArt';

/** Render depth bands. Higher draws on top. */
export const DEPTH = {
  terrain: 0,
  overlay: 10,
  entities: 20,
} as const;

/**
 * Draws the terrain layer: one Image per hex from a single atlas texture (one batch).
 * Phase 7 will switch to chunked baking into DynamicTextures for very large maps.
 */
export class HexMapRenderer {
  private readonly layer: Phaser.GameObjects.Layer;
  private readonly hover: Phaser.GameObjects.Image;
  private readonly select: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: HexMap,
  ) {
    this.layer = scene.add.layer().setDepth(DEPTH.terrain);
    this.drawTerrain();

    this.hover = scene.add
      .image(0, 0, ATLAS_KEY, FRAMES.hover)
      .setDepth(DEPTH.overlay)
      .setAlpha(0.8)
      .setVisible(false);
    this.select = scene.add
      .image(0, 0, ATLAS_KEY, FRAMES.select)
      .setDepth(DEPTH.overlay + 1)
      .setVisible(false);
  }

  /** World-space size of the rendered map in pixels. */
  get pixelWidth(): number {
    return this.map.width * HEX_TILE_WIDTH + HEX_TILE_WIDTH / 2;
  }

  get pixelHeight(): number {
    return (this.map.height - 1) * DEFAULT_LAYOUT.config.stepY + HEX_TILE_HEIGHT;
  }

  private drawTerrain(): void {
    this.map.forEach((h, i) => {
      const terrainId = TERRAIN_IDS[this.map.terrain[i]!]!;
      // Stable per-hex variant so the map looks the same every time it's drawn.
      const variant = Math.abs((h.q * 73856093) ^ (h.r * 19349663)) % TERRAIN_VARIANTS;
      const { x, y } = DEFAULT_LAYOUT.hexToPixel(h);
      const img = this.scene.add.image(x, y, ATLAS_KEY, terrainFrame(terrainId, variant));
      this.layer.add(img);
    });
  }

  setHover(h: Hex | null): void {
    if (!h || !this.map.inBounds(h)) {
      this.hover.setVisible(false);
      return;
    }
    const { x, y } = DEFAULT_LAYOUT.hexToPixel(h);
    this.hover.setPosition(x, y).setVisible(true);
  }

  setSelected(h: Hex | null): void {
    if (!h || !this.map.inBounds(h)) {
      this.select.setVisible(false);
      return;
    }
    const { x, y } = DEFAULT_LAYOUT.hexToPixel(h);
    this.select.setPosition(x, y).setVisible(true);
  }
}
