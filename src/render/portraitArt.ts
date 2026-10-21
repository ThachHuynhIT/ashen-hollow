import { PALETTE } from '../data/palette';
import type { KingDef } from '../data/types';
import { UI_PALETTE } from '../data/uiPalette';
import { PixelCanvas, pixelHash } from './pixel';

export const PORTRAIT_SIZE = 48;

const P = UI_PALETTE;

/** FNV-style hash of the king id: each king gets a different face, beard and crown. */
const seedOf = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return h;
};

/**
 * Placeholder king portrait: robe in the king's colour, a cream face with a hash-picked beard
 * and eyes, and a gold crown. Only UI_PALETTE plus the king's own colour.
 */
export const paintPortrait = (king: KingDef): PixelCanvas => {
  const s = PORTRAIT_SIZE;
  const c = new PixelCanvas(s, s);
  const cloth = PALETTE[king.color];
  const seed = seedOf(king.id);
  c.fillRect(0, 0, s, s, P.creamDark);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) if (pixelHash(x, y, seed) < 0.06) c.set(x, y, P.cream);
  // Shoulders / robe.
  c.fillRect(6, 34, 36, 14, P.outline);
  c.fillRect(7, 35, 34, 13, cloth);
  c.fillRect(21, 34, 6, 14, P.creamLight);
  // Face.
  c.fillRect(13, 12, 22, 24, P.outline);
  c.fillRect(14, 13, 20, 22, P.creamLight);
  c.fillRect(14, 31, 20, 4, P.cream);
  // Eyes (spacing and size from the seed).
  const gap = 4 + (seed % 3);
  c.fillRect(24 - gap - 2, 21, 2 + (seed % 2), 2, P.outline);
  c.fillRect(24 + gap, 21, 2 + (seed % 2), 2, P.outline);
  // Beard: long, short or none.
  const beard = (seed >>> 4) % 3;
  if (beard === 0) {
    c.fillRect(15, 29, 18, 8, P.woodDark);
    c.fillRect(20, 27, 8, 2, P.woodDark);
  } else if (beard === 1) {
    c.fillRect(17, 30, 14, 4, P.wood);
  } else {
    c.fillRect(21, 29, 6, 1, P.woodDark);
  }
  // Crown.
  c.fillRect(13, 6, 22, 8, P.outline);
  c.fillRect(14, 8, 20, 5, P.gold);
  for (const x of [14, 22, 30]) {
    c.fillRect(x - 1, 3, 5, 6, P.outline);
    c.fillRect(x, 4, 3, 5, P.gold);
  }
  c.fillRect(22, 9, 4, 3, cloth);
  // Frame.
  c.fillRect(0, 0, s, 1, P.outline);
  c.fillRect(0, s - 1, s, 1, P.outline);
  c.fillRect(0, 0, 1, s, P.outline);
  c.fillRect(s - 1, 0, 1, s, P.outline);
  return c;
};
