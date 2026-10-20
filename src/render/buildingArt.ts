import { PALETTE } from '../data/palette';
import { PixelCanvas, pixelHash } from './pixel';

export const BUILDING_SIZE = { w: 32, h: 40 } as const;
export const THRONE_SIZE = { w: 32, h: 48 } as const;

const O = PALETTE.outline;

/** Outlined stone block with a stable brick texture. */
const wall = (c: PixelCanvas, x: number, y: number, w: number, h: number, seed: number): void => {
  c.fillRect(x - 1, y - 1, w + 2, h + 2, O);
  c.fillRect(x, y, w, h, PALETTE.stone);
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      const r = pixelHash(xx, yy, seed);
      if (r < 0.15) c.set(xx, yy, PALETTE.stoneDark);
      else if (r > 0.9) c.set(xx, yy, PALETTE.stoneLight);
    }
  c.fillRect(x, y, w, 1, PALETTE.stoneLight);
};

const groundShadow = (c: PixelCanvas, w: number, h: number): void =>
  c.fillEllipse(w / 2, h - 3, w * 0.42, 2.5, PALETTE.shadow, 128);

/**
 * Troop: small house with an accent-coloured roof. Tower: stone column with an accent cap.
 * Economy: market stall with an accent awning. Support: low stone wall with an accent pennant.
 */
export const paintBuilding = (
  kind: 'troop' | 'tower' | 'economy' | 'support',
  accent: number,
): PixelCanvas => {
  const { w, h } = BUILDING_SIZE;
  const c = new PixelCanvas(w, h);
  groundShadow(c, w, h);
  if (kind === 'economy') {
    // Counter with crates, two posts and a striped awning.
    c.fillRect(4, 27, 24, 9, O);
    c.fillRect(5, 28, 22, 7, PALETTE.soil);
    c.fillRect(5, 28, 22, 1, PALETTE.path);
    c.fillRect(7, 22, 4, 6, O);
    c.fillRect(8, 23, 2, 5, PALETTE.wheat);
    c.fillRect(21, 22, 4, 6, O);
    c.fillRect(22, 23, 2, 5, PALETTE.wheatLight);
    c.fillRect(4, 10, 2, 18, O);
    c.fillRect(26, 10, 2, 18, O);
    c.fillRect(2, 9, 28, 9, O);
    for (let x = 3; x < 29; x += 4) {
      c.fillRect(x, 10, 2, 7, accent);
      c.fillRect(x + 2, 10, 2, 7, PALETTE.white);
    }
    c.fillRect(14, 30, 4, 3, PALETTE.gold);
  } else if (kind === 'support') {
    wall(c, 3, 20, 26, 16, 11);
    for (const x of [3, 10, 17, 24]) wall(c, x, 15, 5, 6, 12);
    // Pennant on a pole.
    c.fillRect(15, 4, 2, 16, O);
    c.fillRect(15, 5, 1, 14, PALETTE.soilDark);
    c.fillRect(17, 4, 9, 7, O);
    c.fillRect(17, 5, 8, 5, accent);
    c.fillRect(17, 5, 8, 1, PALETTE.white);
  } else if (kind === 'troop') {
    wall(c, 5, 20, 22, 16, 3);
    // Roof: stepped triangle, outline first so it frames the accent fill.
    for (let r = 0; r < 9; r++) {
      const half = 6 + r * 1.2;
      c.fillRect(Math.floor(16 - half) - 1, 11 + r, Math.ceil(half * 2) + 2, 1, O);
    }
    for (let r = 0; r < 9; r++) {
      const half = 6 + r * 1.2;
      c.fillRect(Math.floor(16 - half), 11 + r, Math.ceil(half * 2), 1, accent);
    }
    c.fillRect(10, 11, 12, 1, PALETTE.white);
    // Door and window.
    c.fillRect(13, 28, 6, 8, PALETTE.soilDark);
    c.fillRect(7, 24, 4, 4, PALETTE.waterLight);
  } else {
    wall(c, 9, 12, 14, 24, 5);
    // Battlement cap in the accent colour.
    c.fillRect(7, 6, 18, 7, O);
    c.fillRect(8, 7, 16, 5, accent);
    for (const x of [8, 13, 18, 22]) {
      c.fillRect(x, 3, 3, 4, O);
      c.fillRect(x, 4, 2, 3, accent);
    }
    // Arrow slit and door.
    c.fillRect(15, 18, 2, 5, O);
    c.fillRect(14, 29, 4, 7, PALETTE.soilDark);
  }
  return c;
};

/** Throne: stone dais with a gold seat and an accent cushion. */
export const paintThrone = (accent: number): PixelCanvas => {
  const { w, h } = THRONE_SIZE;
  const c = new PixelCanvas(w, h);
  groundShadow(c, w, h);
  wall(c, 3, 36, 26, 8, 7);
  wall(c, 7, 32, 18, 5, 8);
  // Back of the throne.
  c.fillRect(8, 6, 16, 27, O);
  c.fillRect(9, 7, 14, 25, PALETTE.gold);
  c.fillRect(9, 7, 14, 1, PALETTE.wheatLight);
  c.fillRect(9, 18, 14, 14, PALETTE.wheat);
  c.fillRect(11, 20, 10, 11, accent);
  // Arm rests and crown points.
  c.fillRect(6, 24, 3, 9, O);
  c.fillRect(7, 25, 1, 7, PALETTE.gold);
  c.fillRect(23, 24, 3, 9, O);
  c.fillRect(24, 25, 1, 7, PALETTE.gold);
  for (const x of [9, 15, 21]) {
    c.fillRect(x - 1, 2, 4, 5, O);
    c.fillRect(x, 3, 2, 4, PALETTE.gold);
  }
  return c;
};
