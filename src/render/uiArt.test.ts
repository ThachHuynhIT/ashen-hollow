import { describe, expect, it } from 'vitest';
import { UI_COLORS, UI_PALETTE } from '../data/uiPalette';
import type { PixelCanvas } from './pixel';
import {
  HILL_LAYERS,
  HILL_W,
  MENU_SKY_H,
  UI_DECOR,
  UI_DECOR_IDS,
  UI_FRAMES,
  UI_FRAME_IDS,
  menuPixelScale,
  paintHills,
  paintSky,
  paintUiDecor,
  paintUiFrame,
  type UiFrame,
} from './uiArt';

const colorAt = (c: PixelCanvas, x: number, y: number): number => {
  const i = (y * c.width + x) * 4;
  return (c.data[i]! << 16) | (c.data[i + 1]! << 8) | c.data[i + 2]!;
};

/** Opaque pixels whose colour is not in UI_PALETTE, as "x,y:#rrggbb". */
const foreignColors = (c: PixelCanvas): string[] => {
  const bad: string[] = [];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (c.alphaAt(x, y) === 0) continue;
      const color = colorAt(c, x, y);
      if (!UI_COLORS.includes(color)) bad.push(`${x},${y}:#${color.toString(16)}`);
    }
  }
  return bad;
};

const CORE: Record<UiFrame, number> = {
  panel: UI_PALETTE.cream,
  button: UI_PALETTE.cream,
  buttonHover: UI_PALETTE.creamLight,
  buttonDown: UI_PALETTE.creamDark,
  buttonActive: UI_PALETTE.cream,
  slot: UI_PALETTE.cream,
  slotHover: UI_PALETTE.creamLight,
  slotSelected: UI_PALETTE.cream,
  tooltip: UI_PALETTE.creamLight,
  bar: UI_PALETTE.woodDark,
  card: UI_PALETTE.cream,
  cardUncommon: UI_PALETTE.cream,
  cardRare: UI_PALETTE.cream,
  cardSelected: UI_PALETTE.cream,
};

describe('uiArt frames', () => {
  it('paints every frame at its declared size with a stretchable middle', () => {
    for (const id of UI_FRAME_IDS) {
      const def = UI_FRAMES[id];
      const art = paintUiFrame(id);
      expect([art.width, art.height], id).toEqual([def.w, def.h]);
      expect(def.slice * 2, id).toBeLessThan(Math.min(def.w, def.h));
      expect(def.border, id).toBeLessThanOrEqual(def.slice);
    }
  });

  it('fills each core with the right cream (or the empty bar colour)', () => {
    for (const id of UI_FRAME_IDS) {
      const art = paintUiFrame(id);
      const cx = Math.floor(art.width / 2);
      const cy = Math.floor(art.height / 2);
      expect(art.alphaAt(cx, cy), id).toBe(255);
      expect(colorAt(art, cx, cy), id).toBe(CORE[id]);
    }
  });

  it('cuts the outer corners of the wood frames', () => {
    for (const id of ['panel', 'button', 'buttonHover', 'buttonDown', 'buttonActive'] as const) {
      const art = paintUiFrame(id);
      const w = art.width - 1;
      const h = art.height - 1;
      const cut = [
        [0, 0], [1, 0], [0, 1],
        [w, 0], [w - 1, 0], [w, 1],
        [0, h], [1, h], [0, h - 1],
        [w, h], [w - 1, h], [w, h - 1],
      ];
      for (const [x, y] of cut) expect(art.alphaAt(x!, y!), `${id} ${x},${y}`).toBe(0);
      expect(colorAt(art, 2, 0), id).toBe(UI_PALETTE.outline);
      expect(colorAt(art, 1, 1), id).toBe(UI_PALETTE.outline);
    }
  });

  it('uses only UI_PALETTE colours', () => {
    for (const id of UI_FRAME_IDS) expect(foreignColors(paintUiFrame(id)), id).toEqual([]);
    for (const id of UI_DECOR_IDS) expect(foreignColors(paintUiDecor(id)), id).toEqual([]);
  });

  it('slot and slotSelected share the core but not the edge', () => {
    const slot = paintUiFrame('slot');
    const selected = paintUiFrame('slotSelected');
    for (let y = 3; y < 15; y++) {
      for (let x = 3; x < 15; x++) expect(colorAt(selected, x, y)).toBe(colorAt(slot, x, y));
    }
    expect(colorAt(slot, 0, 9)).toBe(UI_PALETTE.woodDark);
    expect(colorAt(selected, 0, 9)).toBe(UI_PALETTE.select);
    expect(colorAt(selected, 1, 9)).toBe(UI_PALETTE.select);
  });

  it('lights the pressed button from the bottom-right', () => {
    const up = paintUiFrame('button');
    const down = paintUiFrame('buttonDown');
    expect(colorAt(up, 1, 8)).toBe(UI_PALETTE.woodLight);
    expect(colorAt(down, 1, 8)).toBe(UI_PALETTE.woodDark);
    expect(colorAt(down, 14, 8)).toBe(UI_PALETTE.woodLight);
  });

  it('rings the active button core in gold', () => {
    const active = paintUiFrame('buttonActive');
    expect(colorAt(active, 4, 8)).toBe(UI_PALETTE.gold);
    expect(colorAt(active, 11, 8)).toBe(UI_PALETTE.gold);
  });
});

describe('card frames', () => {
  it('marks rarity and selection on the border', () => {
    expect(colorAt(paintUiFrame('card'), 1, 16)).toBe(UI_PALETTE.woodLight);
    expect(colorAt(paintUiFrame('cardUncommon'), 4, 16)).toBe(UI_PALETTE.woodLight);
    expect(colorAt(paintUiFrame('cardRare'), 4, 16)).toBe(UI_PALETTE.gold);
    const selected = paintUiFrame('cardSelected');
    expect(colorAt(selected, 0, 16)).toBe(UI_PALETTE.select);
    expect(colorAt(selected, 1, 16)).toBe(UI_PALETTE.select);
    expect(UI_FRAMES.cardSelected.border).toBe(5);
  });
});

describe('uiArt decorations', () => {
  it('paints decorations at their declared size', () => {
    for (const id of UI_DECOR_IDS) {
      const art = paintUiDecor(id);
      expect([art.width, art.height], id).toEqual([UI_DECOR[id].w, UI_DECOR[id].h]);
    }
  });

  it('gives the firefly a gold heart and a soft halo', () => {
    const fly = paintUiDecor('firefly');
    expect(colorAt(fly, 1, 1)).toBe(UI_PALETTE.gold);
    expect(colorAt(fly, 1, 0)).toBe(UI_PALETTE.woodLight);
    expect(fly.alphaAt(0, 0)).toBe(0);
  });
});

describe('menu backdrop', () => {
  it('picks a whole pixel size so the sky always covers the screen', () => {
    expect(menuPixelScale(400)).toBe(2);
    expect(menuPixelScale(720)).toBe(3);
    expect(menuPixelScale(812)).toBe(4);
    for (const h of [300, 720, 812, 1080, 1440]) {
      expect(MENU_SKY_H * menuPixelScale(h)).toBeGreaterThanOrEqual(h);
    }
  });

  it('paints four sky bands from top to bottom in UI colours', () => {
    const sky = paintSky();
    expect([sky.width, sky.height]).toEqual([4, MENU_SKY_H]);
    expect(colorAt(sky, 0, 0)).toBe(UI_PALETTE.sky[0]);
    expect(colorAt(sky, 0, MENU_SKY_H / 2 - 20)).toBe(UI_PALETTE.sky[1]);
    expect(colorAt(sky, 0, MENU_SKY_H - 1)).toBe(UI_PALETTE.sky[3]);
    expect(foreignColors(sky)).toEqual([]);
  });

  it('dithers between bands instead of a hard edge', () => {
    const sky = paintSky();
    const lastRowOfFirstBand = MENU_SKY_H / 4 - 1;
    const row = [0, 1, 2, 3].map((x) => colorAt(sky, x, lastRowOfFirstBand));
    expect(new Set(row)).toEqual(new Set([UI_PALETTE.sky[0], UI_PALETTE.sky[1]]));
  });

  it('paints three hill layers: transparent sky on top, solid ground at the bottom', () => {
    HILL_LAYERS.forEach((layer, i) => {
      const hills = paintHills(i);
      expect([hills.width, hills.height], `layer ${i}`).toEqual([HILL_W, layer.height]);
      for (let x = 0; x < HILL_W; x++) {
        expect(hills.alphaAt(x, 0), `layer ${i} x ${x}`).toBe(0);
        expect(hills.alphaAt(x, layer.height - 1), `layer ${i} x ${x}`).toBe(255);
      }
      expect(foreignColors(hills), `layer ${i}`).toEqual([]);
    });
  });

  it('rejects unknown hill layers', () => {
    expect(() => paintHills(HILL_LAYERS.length)).toThrow();
  });
});
