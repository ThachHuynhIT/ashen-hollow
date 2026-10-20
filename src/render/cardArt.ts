import { PALETTE } from '../data/palette';
import type { CardDef } from '../data/types';
import { PixelCanvas, pixelHash } from './pixel';
import { paintBuilding, paintThrone } from './buildingArt';

export const CARD_ART = { w: 32, h: 24 } as const;

/** Picture on a card: meadow sky over a leaf-green strip, with the card's subject on it. */
export const paintCardArt = (def: CardDef, accent: number): PixelCanvas => {
  const { w, h } = CARD_ART;
  const c = new PixelCanvas(w, h);
  c.fillRect(0, 0, w, 15, PALETTE.meadow);
  c.fillRect(0, 15, w, h - 15, PALETTE.leaf);
  for (let x = 0; x < w; x++) {
    if (pixelHash(x, 15, 21) < 0.5) c.set(x, 15, PALETTE.grass);
    for (let y = 16; y < h; y++) if (pixelHash(x, y, 22) < 0.15) c.set(x, y, PALETTE.leafDark);
  }
  switch (def.kind) {
    case 'troop':
    case 'tower': {
      // Crop the 32x40 building to its upper part so it fits the 24 px picture.
      c.blit(paintBuilding(def.kind, accent), 0, def.kind === 'troop' ? -10 : -4);
      break;
    }
    case 'throne':
      c.blit(paintThrone(accent), 0, -3);
      break;
    case 'tome': {
      c.fillRect(8, 6, 16, 13, PALETTE.outline);
      c.fillRect(9, 7, 14, 11, PALETTE.purple);
      c.fillRect(10, 8, 5, 9, PALETTE.cream);
      c.fillRect(17, 8, 5, 9, PALETTE.cream);
      c.fillRect(15, 7, 2, 11, accent);
      break;
    }
    default: {
      // Economy / support / enchantment: a bushel of wheat in the accent colour.
      for (let i = 0; i < 5; i++) {
        const x = 8 + i * 4;
        c.fillRect(x, 9, 1, 11, PALETTE.soilDark);
        c.fillRect(x - 1, 5 + (i % 2), 3, 5, PALETTE.wheat);
        c.set(x, 4 + (i % 2), accent);
      }
    }
  }
  return c;
};
