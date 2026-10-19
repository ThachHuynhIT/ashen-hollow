import { UI_PALETTE } from '../data/uiPalette';
import { PixelCanvas } from './pixel';

export const ICON_IDS = ['troop', 'tower', 'tome', 'throne', 'crown', 'boulder', 'skull'] as const;
export type IconId = (typeof ICON_IDS)[number];

const P = UI_PALETTE;

/** Outlined rect: outline ring, fill inside. */
const box = (c: PixelCanvas, x: number, y: number, w: number, h: number, fill: number): void => {
  c.fillRect(x, y, w, h, P.outline);
  c.fillRect(x + 1, y + 1, w - 2, h - 2, fill);
};

/** Small 16x16 UI icons (UI_PALETTE only), drawn with rects and ellipses. */
export const paintIcon = (id: IconId): PixelCanvas => {
  const c = new PixelCanvas(16, 16);
  switch (id) {
    case 'troop': {
      // House with a roof.
      box(c, 3, 8, 10, 7, P.creamDark);
      for (let r = 0; r < 5; r++) c.fillRect(7 - r, 3 + r, 2 + r * 2, 1, P.outline);
      for (let r = 1; r < 5; r++) c.fillRect(8 - r, 3 + r, r * 2, 1, P.select);
      c.fillRect(7, 11, 3, 4, P.woodDark);
      break;
    }
    case 'tower': {
      box(c, 5, 5, 6, 10, P.creamDark);
      for (const x of [4, 7, 10]) c.fillRect(x, 2, 2, 4, P.outline);
      c.fillRect(5, 5, 6, 1, P.wood);
      c.fillRect(7, 8, 2, 3, P.outline);
      break;
    }
    case 'tome': {
      box(c, 3, 3, 10, 11, P.wood);
      c.fillRect(4, 4, 1, 9, P.woodLight);
      c.fillRect(6, 5, 5, 6, P.cream);
      c.fillRect(7, 7, 3, 1, P.gold);
      c.fillRect(7, 9, 3, 1, P.woodDark);
      break;
    }
    case 'throne': {
      box(c, 4, 2, 8, 9, P.gold);
      box(c, 2, 8, 12, 3, P.woodLight);
      box(c, 3, 11, 10, 4, P.wood);
      c.fillRect(6, 4, 4, 4, P.select);
      break;
    }
    case 'crown': {
      c.fillRect(2, 5, 12, 9, P.outline);
      c.fillRect(3, 8, 10, 5, P.gold);
      for (const x of [3, 7, 11]) {
        c.fillRect(x - 1, 3, 4, 5, P.outline);
        c.fillRect(x, 4, 2, 4, P.gold);
      }
      c.set(5, 10, P.select);
      c.set(8, 10, P.good);
      c.set(10, 10, P.select);
      break;
    }
    case 'boulder': {
      c.fillEllipse(8, 8, 7, 6.5, P.outline);
      c.fillEllipse(8, 8, 6, 5.5, P.creamDark);
      c.fillEllipse(6.5, 6.5, 2.5, 2, P.creamLight);
      c.fillEllipse(10, 10, 3, 2.5, P.wood);
      break;
    }
    case 'skull': {
      c.fillEllipse(8, 7, 6.5, 6, P.outline);
      c.fillEllipse(8, 7, 5.5, 5, P.creamLight);
      box(c, 5, 11, 6, 4, P.creamLight);
      c.fillRect(4, 6, 3, 3, P.outline);
      c.fillRect(9, 6, 3, 3, P.outline);
      c.fillRect(5, 7, 1, 1, P.bad);
      c.fillRect(10, 7, 1, 1, P.bad);
      c.fillRect(7, 12, 1, 3, P.outline);
      c.fillRect(9, 12, 1, 3, P.outline);
      break;
    }
  }
  return c;
};
