import { fractalNoise2D, valueNoise2D } from '../core/noise';
import { PALETTE } from '../data/palette';
import {
  MASK_BL,
  MASK_BR,
  MASK_TL,
  MASK_TR,
  computeDualGrid,
  type TerrainSource,
} from './dualGrid';
import { PixelCanvas, pixelHash } from './pixel';

/** Terrain names; the index is the data value and the blend priority (higher draws on top). */
export const FIELD_TERRAINS = ['grass', 'flowers', 'path', 'sand', 'water'] as const;

const N = 24;
const TILE = 16;
const [GRASS, FLOWERS, PATH, SAND, WATER] = [0, 1, 2, 3, 4];
const inBoard = (col: number, row: number): boolean => col >= 7 && col <= 16 && row >= 7 && row <= 16;

/** 24x24 terrain indices (row-major). The 10x10 board area is always grass or flowers. */
export const generateField = (seed: number): Uint8Array => {
  const f = new Uint8Array(N * N).fill(GRASS);
  const at = (col: number, row: number): number => row * N + col;

  for (let row = 0; row < N; row++)
    for (let col = 0; col < N; col++)
      if (fractalNoise2D(seed, col, row, { octaves: 2, frequency: 0.35, persistence: 0.5 }) > 0.72)
        f[at(col, row)] = FLOWERS;

  // A cross of paths along the middle row/column, only outside the board.
  for (let i = 0; i < N; i++) {
    if (!inBoard(12, i)) f[at(12, i)] = PATH;
    if (!inBoard(i, 12)) f[at(i, 12)] = PATH;
  }

  // A pond in one of the four outer corners, ringed with sand.
  const pcx = valueNoise2D(seed, 1.5, 2.5) < 0.5 ? 3 : 20;
  const pcy = valueNoise2D(seed, 4.5, 7.5) < 0.5 ? 3 : 20;
  for (let row = 0; row < N; row++)
    for (let col = 0; col < N; col++) {
      const dx = col - pcx;
      const dy = row - pcy;
      const d2 = dx * dx + dy * dy;
      const wobble = valueNoise2D(seed, col * 0.7, row * 0.7);
      if (d2 <= 4 + wobble * 2) f[at(col, row)] = WATER;
      else if (d2 <= 9 + wobble * 3) f[at(col, row)] = SAND;
    }

  for (let row = 7; row <= 16; row++)
    for (let col = 7; col <= 16; col++)
      if (f[at(col, row)]! > FLOWERS) f[at(col, row)] = GRASS;
  return f;
};

interface TerrainLook {
  readonly base: number;
  readonly speck: readonly number[];
  readonly density: number;
}

const LOOKS: readonly TerrainLook[] = [
  { base: PALETTE.grass, speck: [PALETTE.grassLight, PALETTE.grassDark], density: 0.18 },
  { base: PALETTE.grass, speck: [PALETTE.white, PALETTE.gold, PALETTE.red, PALETTE.grassLight], density: 0.14 },
  { base: PALETTE.path, speck: [PALETTE.soil, PALETTE.sand], density: 0.14 },
  { base: PALETTE.sand, speck: [PALETTE.wheatLight, PALETTE.path], density: 0.12 },
  { base: PALETTE.water, speck: [PALETTE.waterLight, PALETTE.waterDeep], density: 0.16 },
];

/**
 * One 16x16 dual-grid tile of a terrain: the four 8x8 quadrants named by `mask` (TL=1, TR=2,
 * BL=4, BR=8) are painted, with a ragged edge along the midlines; the rest is transparent.
 */
export const paintFieldTile = (terrain: number, mask: number, seed: number): PixelCanvas => {
  const look = LOOKS[terrain];
  if (!look) throw new Error(`Unknown terrain ${terrain}`);
  const c = new PixelCanvas(TILE, TILE);
  const half = TILE / 2;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      // Jitter the lookup near the midlines so seams between terrains are not straight.
      const near = Math.abs(x - 7.5) < 2.5 || Math.abs(y - 7.5) < 2.5;
      const jx = near ? Math.round((pixelHash(x, y, seed + 5) - 0.5) * 3) : 0;
      const jy = near ? Math.round((pixelHash(y, x, seed + 6) - 0.5) * 3) : 0;
      const qx = Math.min(TILE - 1, Math.max(0, x + jx)) >= half ? 1 : 0;
      const qy = Math.min(TILE - 1, Math.max(0, y + jy)) >= half ? 1 : 0;
      const bit = qy === 0 ? (qx === 0 ? MASK_TL : MASK_TR) : qx === 0 ? MASK_BL : MASK_BR;
      if ((mask & bit) === 0) continue;
      const r = pixelHash(x, y, seed);
      const color =
        r < look.density
          ? look.speck[Math.floor((r / look.density) * look.speck.length)]!
          : look.base;
      c.set(x, y, color);
    }
  return c;
};

/**
 * The whole 384x384 field: 24x24 data cells blended through the dual grid. The 25x25 display
 * tiles are drawn half a tile up-left so the picture is cropped to the data grid.
 */
export const paintField = (seed: number): PixelCanvas => {
  const data = generateField(seed);
  const source: TerrainSource = {
    width: N,
    height: N,
    getClamped: (cx, cy) =>
      data[Math.min(N - 1, Math.max(0, cy)) * N + Math.min(N - 1, Math.max(0, cx))]!,
  };
  const dual = computeDualGrid(source, (t) => t);
  const out = new PixelCanvas(N * TILE, N * TILE);
  const terrains = [...dual.layers.keys()].sort((a, b) => a - b);
  for (const t of terrains) {
    const layer = dual.layers.get(t)!;
    for (let ty = 0; ty < dual.height; ty++)
      for (let tx = 0; tx < dual.width; tx++) {
        const mask = layer[ty * dual.width + tx]!;
        if (mask < 0) continue;
        const tileSeed = seed + tx * 7919 + ty * 104729;
        out.blit(paintFieldTile(t, mask, tileSeed), tx * TILE - TILE / 2, ty * TILE - TILE / 2);
      }
  }
  return out;
};

/** A plain, fully painted grass tile; tiled under the field so the ground fills the whole screen. */
export const paintGroundTile = (): PixelCanvas => paintFieldTile(0, 15, 0);
