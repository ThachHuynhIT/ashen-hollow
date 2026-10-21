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
    case 'economy':
    case 'support':
      c.blit(paintBuilding(def.kind, accent), 0, -8);
      break;
    case 'enchantment': {
      // A glowing rune stone with a spark of the king's colour.
      c.fillEllipse(16, 12, 7, 8, PALETTE.outline);
      c.fillEllipse(16, 12, 6, 7, PALETTE.stoneLight);
      c.fillRect(15, 6, 2, 12, accent);
      c.fillRect(11, 10, 10, 2, accent);
      c.fillRect(13, 14, 1, 1, PALETTE.gold);
      c.fillRect(19, 8, 1, 1, PALETTE.gold);
      break;
    }
  }
  sigil(c, def.id, accent);
  return c;
};

/** FNV-style hash of a card id, so every card has its own small mark. */
const hashId = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return h;
};

/** A 3×5 mirrored glyph in the top-right corner, derived from the card id (placeholder identity). */
const sigil = (c: PixelCanvas, id: string, accent: number): void => {
  const bits = hashId(id);
  const x0 = CARD_ART.w - 8;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (((bits >>> (row * 3 + col)) & 1) === 0) continue;
      c.set(x0 + col, 2 + row, accent);
      c.set(x0 + 5 - col, 2 + row, accent);
    }
    c.set(x0 + 2, 2 + row, ((bits >>> (15 + row)) & 1) === 1 ? PALETTE.white : PALETTE.outline);
  }
};
