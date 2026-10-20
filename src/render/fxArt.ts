import { PALETTE } from '../data/palette';
import { paintBitmap } from './bitmap';
import { PixelCanvas } from './pixel';

export const ARROW_DIRS = ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'] as const;
export type ArrowDir = (typeof ARROW_DIRS)[number];

/** Screen direction (y down) to one of 8 arrow bitmaps; (0, 0) points east. */
export const arrowDir = (dx: number, dy: number): ArrowDir => {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax === 0 && ay === 0) return 'e';
  if (ay * 5 < ax * 2) return dx > 0 ? 'e' : 'w';
  if (ax * 5 < ay * 2) return dy < 0 ? 'n' : 's';
  if (dy < 0) return dx > 0 ? 'ne' : 'nw';
  return dx > 0 ? 'se' : 'sw';
};

/** s = shaft, h = head, f = fletching. Each direction is drawn by hand; sprites never rotate. */
const ARROWS: Readonly<Record<ArrowDir, readonly string[]>> = {
  e: [
    '........',
    '........',
    '......h.',
    'fsssshhh',
    '......h.',
    '........',
    '........',
    '........',
  ],
  w: [
    '........',
    '........',
    '.h......',
    'hhhssssf',
    '.h......',
    '........',
    '........',
    '........',
  ],
  n: [
    '...h....',
    '..hhh...',
    '...s....',
    '...s....',
    '...s....',
    '...s....',
    '...s....',
    '...f....',
  ],
  s: [
    '...f....',
    '...s....',
    '...s....',
    '...s....',
    '...s....',
    '...s....',
    '..hhh...',
    '...h....',
  ],
  ne: [
    '.....hhh',
    '......hh',
    '.....s.h',
    '....s...',
    '...s....',
    '..s.....',
    '.f......',
    '........',
  ],
  nw: [
    'hhh.....',
    'hh......',
    'h.s.....',
    '...s....',
    '....s...',
    '.....s..',
    '......f.',
    '........',
  ],
  se: [
    '........',
    '.f......',
    '..s.....',
    '...s....',
    '....s...',
    '.....s.h',
    '......hh',
    '.....hhh',
  ],
  sw: [
    '........',
    '......f.',
    '.....s..',
    '....s...',
    '...s....',
    'h.s.....',
    'hh......',
    'hhh.....',
  ],
};

const ARROW_COLORS = { s: PALETTE.soilDark, h: PALETTE.stoneLight, f: PALETTE.cream };

export const paintArrow = (dir: ArrowDir): PixelCanvas => paintBitmap(ARROWS[dir], ARROW_COLORS);

/** 16x16 siege boulder: outlined grey rock lit from the top-left. */
export const paintBoulder = (): PixelCanvas => {
  const c = new PixelCanvas(16, 16);
  c.fillEllipse(8, 8, 7.5, 7.5, PALETTE.outline);
  c.fillEllipse(8, 8, 6.5, 6.5, PALETTE.stone);
  c.fillEllipse(9.5, 9.5, 4.5, 4.5, PALETTE.stoneDark);
  c.fillEllipse(6.5, 6, 3, 2.5, PALETTE.stoneLight);
  c.set(10, 5, PALETTE.stoneDark);
  c.set(5, 10, PALETTE.stoneDark);
  return c;
};

/** 24x8 translucent ground shadow for the boulder in flight. */
export const paintBoulderShadow = (): PixelCanvas => {
  const c = new PixelCanvas(24, 8);
  c.fillEllipse(12, 4, 11.5, 3.5, PALETTE.shadow, 128);
  return c;
};

/** 4x4 hit spark. */
export const paintSpark = (): PixelCanvas =>
  paintBitmap(['.hh.', 'hwwh', 'hwwh', '.hh.'], { h: PALETTE.gold, w: PALETTE.white });
