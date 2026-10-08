import { PALETTE } from '../data/palette';
import { TERRAIN, type TerrainId } from '../data/terrain';
import { Rng } from '../sim/random';
import {
  PixelCanvas,
  createHexTile,
  fillHex,
  isHexTileEdge,
  isInsideHexTile,
  setInHex,
} from './pixel';

/**
 * Procedural placeholder art for terrain hexes. This is temporary — the real tiles will
 * be drawn in Aseprite — but it already follows ART_STYLE.md: palette-only colours,
 * light from the top-left, 1 px details, no anti-aliasing.
 */
export const TERRAIN_VARIANTS = 3;

type Painter = (c: PixelCanvas, rng: Rng) => void;

/** Base fill: mostly the main colour with sparse dithered speckles. */
const baseFill = (c: PixelCanvas, rng: Rng, [base, detail, dark]: readonly number[]): void => {
  fillHex(c, () => {
    const roll = rng.next();
    if (roll < 0.06) return detail!;
    if (roll < 0.1) return dark!;
    return base!;
  });
};

/** Subtle bevel: light on the upper-left rim, dark on the lower-right rim. */
const bevel = (c: PixelCanvas, light: number, dark: number): void => {
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (!isHexTileEdge(x, y)) continue;
      const upperLeft = !isInsideHexTile(x - 1, y) || !isInsideHexTile(x, y - 1);
      c.set(x, y, upperLeft ? light : dark);
    }
  }
};

/** Random point comfortably inside the hex. */
const spot = (rng: Rng, margin = 4): { x: number; y: number } => {
  for (let i = 0; i < 20; i++) {
    const x = rng.int(margin, 31 - margin);
    const y = rng.int(margin + 2, 31 - margin);
    if (isInsideHexTile(x - margin, y) && isInsideHexTile(x + margin, y)) return { x, y };
  }
  return { x: 16, y: 16 };
};

const paintGrass: Painter = (c, rng) => {
  const t = TERRAIN.deadGrass.colors;
  baseFill(c, rng, t);
  for (let i = 0; i < 9; i++) {
    const { x, y } = spot(rng, 2);
    setInHex(c, x, y, PALETTE.driedMoss);
    setInHex(c, x, y - 1, PALETTE.driedMoss);
    if (rng.next() < 0.5) setInHex(c, x + 1, y - 2, PALETTE.boneGrey);
  }
  bevel(c, PALETTE.driedMoss, PALETTE.peat);
};

const paintMud: Painter = (c, rng) => {
  baseFill(c, rng, TERRAIN.mud.colors);
  for (let i = 0; i < 3; i++) {
    const { x, y } = spot(rng, 5);
    const w = rng.int(3, 5);
    for (let dx = -w; dx <= w; dx++) {
      setInHex(c, x + dx, y, PALETTE.blackWater);
      if (Math.abs(dx) < w - 1) setInHex(c, x + dx, y + 1, PALETTE.blackWater);
    }
    setInHex(c, x - w + 1, y, PALETTE.waterSheen);
  }
  bevel(c, PALETTE.mossDark, PALETTE.rotBrown);
};

const drawDeadTree = (c: PixelCanvas, x: number, y: number, rng: Rng): void => {
  const h = rng.int(6, 8);
  for (let i = 0; i < h; i++) setInHex(c, x, y - i, PALETTE.rotBrown);
  // Crooked bare branches.
  setInHex(c, x - 1, y - h + 2, PALETTE.rotBrown);
  setInHex(c, x - 2, y - h + 1, PALETTE.rotBrown);
  setInHex(c, x + 1, y - h + 3, PALETTE.rotBrown);
  setInHex(c, x + 2, y - h + 2, PALETTE.rotBrown);
  setInHex(c, x + 1, y - h, PALETTE.rotBrown);
  // Sparse dark needles.
  for (let i = 0; i < 4; i++) {
    setInHex(c, x + rng.int(-2, 2), y - h + rng.int(0, 3), PALETTE.pine);
  }
  // Shadow at the foot.
  setInHex(c, x + 1, y + 1, PALETTE.pineDark);
  setInHex(c, x + 2, y + 1, PALETTE.pineDark);
};

const paintForest: Painter = (c, rng) => {
  baseFill(c, rng, TERRAIN.deadForest.colors);
  bevel(c, PALETTE.pine, PALETTE.pineDark);
  const trees = rng.int(3, 4);
  const spots = Array.from({ length: trees }, () => spot(rng, 4)).sort((a, b) => a.y - b.y);
  for (const { x, y } of spots) drawDeadTree(c, x, Math.min(y + 4, 27), rng);
};

const paintHills: Painter = (c, rng) => {
  baseFill(c, rng, TERRAIN.hills.colors);
  bevel(c, PALETTE.driedMoss, PALETTE.rotBrown);
  const mounds = [spot(rng, 7), spot(rng, 7)].sort((a, b) => a.y - b.y);
  for (const { x, y } of mounds) {
    const r = rng.int(5, 7);
    for (let dx = -r; dx <= r; dx++) {
      const top = Math.round(Math.sqrt(r * r - dx * dx) * 0.6);
      for (let dy = 0; dy <= top; dy++) {
        const color = dx < 0 && dy > top - 2 ? PALETTE.driedMoss : PALETTE.peat;
        setInHex(c, x + dx, y - dy, color);
      }
      setInHex(c, x + dx, y + 1, PALETTE.rotBrown);
    }
    // A bleached bone or two.
    if (rng.next() < 0.7) {
      setInHex(c, x + 1, y - 1, PALETTE.bone);
      setInHex(c, x + 2, y - 1, PALETTE.bone);
    }
  }
};

const paintMountain: Painter = (c, rng) => {
  baseFill(c, rng, [PALETTE.slateDark, PALETTE.slate, PALETTE.ink]);
  const peakX = 16 + rng.int(-2, 2);
  const peakY = 5;
  const baseY = 26;
  for (let y = peakY; y <= baseY; y++) {
    const half = Math.floor((y - peakY) * 0.75);
    for (let dx = -half; dx <= half; dx++) {
      let color: number = dx < 0 ? PALETTE.stoneLight : PALETTE.slate;
      if (y - peakY < 4)
        color = PALETTE.bone; // snow/ash cap
      else if (dx > half - 2) color = PALETTE.slateDark;
      setInHex(c, peakX + dx, y, color);
    }
  }
  // A crack down the face.
  for (let y = peakY + 6; y < baseY - 2; y += 1) {
    setInHex(c, peakX + Math.floor((y - peakY) / 5) - 1, y, PALETTE.slateDark);
  }
  bevel(c, PALETTE.stone, PALETTE.ink);
};

const paintWater: Painter = (c, rng) => {
  fillHex(c, () => (rng.next() < 0.08 ? PALETTE.deepWater : PALETTE.blackWater));
  for (let i = 0; i < 4; i++) {
    const { x, y } = spot(rng, 4);
    const len = rng.int(2, 4);
    for (let dx = 0; dx < len; dx++) setInHex(c, x + dx, y, PALETTE.waterSheen);
  }
  bevel(c, PALETTE.deepWater, PALETTE.void);
};

const paintCursed: Painter = (c, rng) => {
  baseFill(c, rng, TERRAIN.cursedSoil.colors);
  // Glowing cracks.
  let { x, y } = spot(rng, 6);
  for (let i = 0; i < 10; i++) {
    setInHex(c, x, y, PALETTE.veilViolet);
    x += rng.int(-1, 1);
    y += rng.pick([0, 1]);
  }
  for (let i = 0; i < 4; i++) {
    const p = spot(rng, 3);
    setInHex(c, p.x, p.y, rng.next() < 0.3 ? PALETTE.ghostGreen : PALETTE.veilViolet);
  }
  bevel(c, PALETTE.shadowPlum, PALETTE.ink);
};

const PAINTERS: Record<TerrainId, Painter> = {
  deadGrass: paintGrass,
  mud: paintMud,
  deadForest: paintForest,
  hills: paintHills,
  mountain: paintMountain,
  blackWater: paintWater,
  cursedSoil: paintCursed,
};

export const paintTerrainTile = (id: TerrainId, variant: number): PixelCanvas => {
  const c = createHexTile();
  PAINTERS[id](c, new Rng(1000 + variant * 7919 + id.length * 31));
  return c;
};

/** Hex outline used for hover / selection highlights. */
export const paintHexOutline = (color: number, thickness: 1 | 2): PixelCanvas => {
  const c = createHexTile();
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (!isInsideHexTile(x, y)) continue;
      const edge = isHexTileEdge(x, y);
      const inner =
        thickness === 2 &&
        !edge &&
        (isHexTileEdge(x - 1, y) ||
          isHexTileEdge(x + 1, y) ||
          isHexTileEdge(x, y - 1) ||
          isHexTileEdge(x, y + 1));
      if (edge || inner) c.set(x, y, color);
    }
  }
  return c;
};

/** Placeholder Hearthfire (the colony's starting fire) — 16×16 sprite. */
export const paintHearthfire = (): PixelCanvas => {
  const c = new PixelCanvas(16, 16);
  // Stone ring.
  for (const [x, y] of [
    [3, 12],
    [4, 13],
    [6, 14],
    [8, 14],
    [10, 14],
    [12, 13],
    [13, 12],
    [4, 11],
    [12, 11],
  ] as const) {
    c.set(x, y, PALETTE.stone);
    c.set(x + 1, y, PALETTE.slate);
  }
  // Logs.
  for (let x = 5; x <= 11; x++) c.set(x, 12, PALETTE.rotBrown);
  // Flame (3 tiers).
  const flame: [number, number, number][] = [
    [8, 4, PALETTE.candle],
    [7, 5, PALETTE.flame],
    [8, 5, PALETTE.candle],
    [7, 6, PALETTE.flame],
    [8, 6, PALETTE.candle],
    [9, 6, PALETTE.flame],
    [6, 7, PALETTE.ember],
    [7, 7, PALETTE.flame],
    [8, 7, PALETTE.candle],
    [9, 7, PALETTE.flame],
    [6, 8, PALETTE.ember],
    [7, 8, PALETTE.flame],
    [8, 8, PALETTE.flame],
    [9, 8, PALETTE.ember],
    [5, 9, PALETTE.emberDark],
    [6, 9, PALETTE.ember],
    [7, 9, PALETTE.flame],
    [8, 9, PALETTE.flame],
    [9, 9, PALETTE.ember],
    [10, 9, PALETTE.emberDark],
    [6, 10, PALETTE.emberDark],
    [7, 10, PALETTE.ember],
    [8, 10, PALETTE.ember],
    [9, 10, PALETTE.ember],
    [10, 10, PALETTE.emberDark],
    [7, 11, PALETTE.emberDark],
    [8, 11, PALETTE.emberDark],
    [9, 11, PALETTE.emberDark],
  ];
  for (const [x, y, color] of flame) c.set(x, y, color);
  return c;
};
