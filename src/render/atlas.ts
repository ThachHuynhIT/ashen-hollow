import type Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import { TERRAIN_IDS, type TerrainId } from '../data/terrain';
import { PixelCanvas } from './pixel';
import { TERRAIN_VARIANTS, paintHearthfire, paintHexOutline, paintTerrainTile } from './terrainArt';

export const ATLAS_KEY = 'placeholder-atlas';

export const terrainFrame = (id: TerrainId, variant: number): string => `${id}_${variant}`;

export const FRAMES = {
  hover: 'hex-hover',
  select: 'hex-select',
  hearthfire: 'hearthfire',
} as const;

interface Placed {
  name: string;
  art: PixelCanvas;
  x: number;
  y: number;
}

/**
 * Paint all placeholder art into a single texture so the whole map renders in one batch.
 * Replaced by a packed Aseprite atlas (public/assets/atlases) once real art exists.
 */
export const buildPlaceholderAtlas = (textures: Phaser.Textures.TextureManager): void => {
  if (textures.exists(ATLAS_KEY)) return;

  const placed: Placed[] = [];
  TERRAIN_IDS.forEach((id, row) => {
    for (let v = 0; v < TERRAIN_VARIANTS; v++) {
      placed.push({
        name: terrainFrame(id, v),
        art: paintTerrainTile(id, v),
        x: v * 32,
        y: row * 32,
      });
    }
  });
  const extraRow = TERRAIN_IDS.length * 32;
  placed.push({ name: FRAMES.hover, art: paintHexOutline(PALETTE.candle, 1), x: 0, y: extraRow });
  placed.push({ name: FRAMES.select, art: paintHexOutline(PALETTE.flame, 2), x: 32, y: extraRow });
  placed.push({ name: FRAMES.hearthfire, art: paintHearthfire(), x: 64, y: extraRow });

  const sheet = new PixelCanvas(TERRAIN_VARIANTS * 32, extraRow + 32);
  for (const p of placed) sheet.blit(p.art, p.x, p.y);

  const canvas = document.createElement('canvas');
  canvas.width = sheet.width;
  canvas.height = sheet.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.putImageData(new ImageData(sheet.data, sheet.width, sheet.height), 0, 0);

  const texture = textures.addCanvas(ATLAS_KEY, canvas);
  if (!texture) throw new Error('Failed to create placeholder atlas');
  for (const p of placed) texture.add(p.name, 0, p.x, p.y, p.art.width, p.art.height);
};
