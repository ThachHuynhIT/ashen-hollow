import type Phaser from 'phaser';
import type { BuildingId } from '../data/buildings';
import type { DoodadId } from '../data/doodads';
import { PixelCanvas } from './pixel';
import {
  paintBoneHeap,
  paintBoulder,
  paintDeadTree,
  paintGlowShroom,
  paintHearthfire,
  paintStorage,
  paintTent,
  paintTerrainTileset,
  paintWatchtower,
} from './terrainArt';

export const TERRAIN_TILESET_KEY = 'terrain-tiles';
export const SPRITES_KEY = 'sprites';

/** Visual variants per doodad kind (picked per entity by a stable hash). */
export const DOODAD_VARIANTS: Record<DoodadId, number> = {
  deadTree: 3,
  boulder: 1,
  boneHeap: 1,
  glowShroom: 1,
};

export const doodadFrame = (id: DoodadId, variant: number): string => `${id}_${variant}`;
export const buildingFrame = (id: BuildingId): string => `building_${id}`;

const toCanvas = (art: PixelCanvas): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = art.width;
  canvas.height = art.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.putImageData(new ImageData(art.data, art.width, art.height), 0, 0);
  return canvas;
};

/** Pack sprites left-to-right in shelves. Small and good enough for placeholder art. */
const packShelves = (sprites: { name: string; art: PixelCanvas }[], maxWidth = 256) => {
  let x = 0;
  let y = 0;
  let shelf = 0;
  const placed = sprites.map((s) => {
    if (x + s.art.width > maxWidth) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    const p = { ...s, x, y };
    x += s.art.width + 1;
    shelf = Math.max(shelf, s.art.height);
    return p;
  });
  return { placed, height: y + shelf };
};

/**
 * Generate all placeholder textures: the terrain tileset (used by the tilemap layers)
 * and one sprite atlas for doodads and buildings (one batch for the whole world).
 */
export const buildPlaceholderAtlas = (textures: Phaser.Textures.TextureManager): void => {
  if (!textures.exists(TERRAIN_TILESET_KEY)) {
    textures.addCanvas(TERRAIN_TILESET_KEY, toCanvas(paintTerrainTileset()));
  }
  if (textures.exists(SPRITES_KEY)) return;

  const sprites: { name: string; art: PixelCanvas }[] = [
    ...[0, 1, 2].map((v) => ({ name: doodadFrame('deadTree', v), art: paintDeadTree(v) })),
    { name: doodadFrame('boulder', 0), art: paintBoulder() },
    { name: doodadFrame('boneHeap', 0), art: paintBoneHeap() },
    { name: doodadFrame('glowShroom', 0), art: paintGlowShroom() },
    { name: buildingFrame('hearthfire'), art: paintHearthfire() },
    { name: buildingFrame('tent'), art: paintTent() },
    { name: buildingFrame('storage'), art: paintStorage() },
    { name: buildingFrame('watchtower'), art: paintWatchtower() },
    { name: buildingFrame('torch'), art: paintHearthfire() },
    { name: buildingFrame('wallStake'), art: paintHearthfire() },
  ];
  const width = 256;
  const { placed, height } = packShelves(sprites, width);
  const sheet = new PixelCanvas(width, height);
  for (const p of placed) sheet.blit(p.art, p.x, p.y);

  const texture = textures.addCanvas(SPRITES_KEY, toCanvas(sheet));
  if (!texture) throw new Error('Failed to create sprite atlas');
  for (const p of placed) texture.add(p.name, 0, p.x, p.y, p.art.width, p.art.height);
};
