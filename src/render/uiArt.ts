import { UI_PALETTE } from '../data/uiPalette';
import { PixelCanvas, pixelHash } from './pixel';

/**
 * Procedural UI art in the Stardew style: thick wood frames around a cream core, lit from
 * the top-left. Pure TS (no Phaser) so it is unit-tested; colours only from UI_PALETTE.
 * Every frame is a nine-slice source. To switch to hand-drawn art, load an Aseprite atlas
 * under UI_KEY with the same frame names and edit UI_FRAMES — nothing in the HUD changes.
 */

export const UI_FRAME_IDS = [
  'panel',
  'button',
  'buttonHover',
  'buttonDown',
  'buttonActive',
  'slot',
  'slotHover',
  'slotSelected',
  'tooltip',
  'bar',
  'card',
  'cardUncommon',
  'cardRare',
  'cardSelected',
] as const;
export type UiFrame = (typeof UI_FRAME_IDS)[number];

export interface UiFrameDef {
  /** Source size in texture pixels. */
  readonly w: number;
  readonly h: number;
  /** Nine-slice corner size, the same on all four sides. */
  readonly slice: number;
  /** Thickness of the decorative edge (texture px); content starts this far in. */
  readonly border: number;
}

export const UI_FRAMES: Readonly<Record<UiFrame, UiFrameDef>> = {
  panel: { w: 24, h: 24, slice: 8, border: 6 },
  button: { w: 16, h: 16, slice: 5, border: 4 },
  buttonHover: { w: 16, h: 16, slice: 5, border: 4 },
  buttonDown: { w: 16, h: 16, slice: 5, border: 4 },
  buttonActive: { w: 16, h: 16, slice: 5, border: 4 },
  slot: { w: 18, h: 18, slice: 4, border: 2 },
  slotHover: { w: 18, h: 18, slice: 4, border: 2 },
  slotSelected: { w: 18, h: 18, slice: 4, border: 3 },
  tooltip: { w: 12, h: 12, slice: 4, border: 2 },
  bar: { w: 8, h: 6, slice: 2, border: 1 },
  card: { w: 24, h: 32, slice: 8, border: 4 },
  cardUncommon: { w: 24, h: 32, slice: 8, border: 4 },
  cardRare: { w: 24, h: 32, slice: 8, border: 4 },
  cardSelected: { w: 24, h: 32, slice: 8, border: 5 },
};

/** Decorations drawn unstretched. */
export const UI_DECOR_IDS = ['clockDial', 'firefly'] as const;
export type UiDecor = (typeof UI_DECOR_IDS)[number];

export const UI_DECOR: Readonly<Record<UiDecor, { readonly w: number; readonly h: number }>> = {
  clockDial: { w: 28, h: 28 },
  firefly: { w: 3, h: 3 },
};

/** The dial's half disc: centre of its flat bottom edge, face radius, painted height. */
export const DIAL = { cx: 14, cy: 15, faceR: 9, height: 21 } as const;

const P = UI_PALETTE;

const strokeRect = (
  c: PixelCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
): void => {
  c.fillRect(x, y, w, 1, color);
  c.fillRect(x, y + h - 1, w, 1, color);
  c.fillRect(x, y, 1, h, color);
  c.fillRect(x + w - 1, y, 1, h, color);
};

/** Cut each outer corner (corner pixel + its two neighbours) and close it diagonally. */
const roundCorners = (c: PixelCanvas): void => {
  const w = c.width - 1;
  const h = c.height - 1;
  const corners: [number, number, number, number][] = [
    [0, 0, 1, 1],
    [w, 0, -1, 1],
    [0, h, 1, -1],
    [w, h, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    c.set(x, y, 0, 0);
    c.set(x + dx, y, 0, 0);
    c.set(x, y + dy, 0, 0);
    c.set(x + dx, y + dy, P.outline);
  }
};

interface WoodFrame {
  readonly w: number;
  readonly h: number;
  /** Wood thickness between the outline and the groove. */
  readonly wood: number;
  readonly core: number;
  /** Bevel lit from the bottom-right instead of the top-left (pressed look). */
  readonly pressed?: boolean;
  /** 1 px gold ring just inside the groove (active button). */
  readonly gold?: boolean;
  /** 1 px woodLight ring just inside the groove (uncommon card). */
  readonly lightRing?: boolean;
  /** Recolour the outer 2 px (outline + first wood row) in the selection red. */
  readonly selectRing?: boolean;
  readonly seed: number;
}

/** Short horizontal woodDark grain dashes (2–4 px) inside the wood band. */
const paintGrain = (c: PixelCanvas, f: WoodFrame): void => {
  const groove = 1 + f.wood;
  const inBand = (x: number, y: number): boolean => {
    const insideOuter = x >= 2 && y >= 2 && x <= f.w - 3 && y <= f.h - 3;
    const insideGroove = x >= groove && y >= groove && x <= f.w - 1 - groove && y <= f.h - 1 - groove;
    return insideOuter && !insideGroove;
  };
  for (let y = 2; y <= f.h - 3; y++) {
    for (let x = 2; x <= f.w - 3; x++) {
      if (!inBand(x, y) || pixelHash(x, y, f.seed) >= 0.12) continue;
      const len = 2 + Math.floor(pixelHash(y, x, f.seed + 1) * 3);
      for (let i = 0; i < len && inBand(x + i, y); i++) c.set(x + i, y, P.woodDark);
      x += len;
    }
  }
};

/** outline → wood (lit edge, grain, shaded edge) → groove → core with an inner shadow. */
const paintWoodFrame = (f: WoodFrame): PixelCanvas => {
  const c = new PixelCanvas(f.w, f.h);
  c.fillRect(0, 0, f.w, f.h, P.wood);
  if (f.wood >= 3) paintGrain(c, f);
  const lit = f.pressed ? P.woodDark : P.woodLight;
  const shade = f.pressed ? P.woodLight : P.woodDark;
  c.fillRect(1, 1, f.w - 2, 1, lit);
  c.fillRect(1, 1, 1, f.h - 2, lit);
  c.fillRect(1, f.h - 2, f.w - 2, 1, shade);
  c.fillRect(f.w - 2, 1, 1, f.h - 2, shade);
  strokeRect(c, 0, 0, f.w, f.h, P.outline);
  const g = 1 + f.wood;
  strokeRect(c, g, g, f.w - 2 * g, f.h - 2 * g, P.woodDark);
  const k = g + 1;
  c.fillRect(k, k, f.w - 2 * k, f.h - 2 * k, f.core);
  if (f.lightRing) {
    strokeRect(c, k, k, f.w - 2 * k, f.h - 2 * k, P.woodLight);
  } else if (f.gold) {
    strokeRect(c, k, k, f.w - 2 * k, f.h - 2 * k, P.gold);
  } else {
    c.fillRect(k, k, f.w - 2 * k, 1, P.creamDark);
    c.fillRect(k, k, 1, f.h - 2 * k, P.creamDark);
  }
  roundCorners(c);
  if (f.selectRing) {
    for (let i = 0; i < 2; i++) {
      for (let x = i; x < f.w - i; x++)
        for (const y of [i, f.h - 1 - i]) if (c.alphaAt(x, y) > 0) c.set(x, y, P.select);
      for (let y = i; y < f.h - i; y++)
        for (const x of [i, f.w - 1 - i]) if (c.alphaAt(x, y) > 0) c.set(x, y, P.select);
    }
  }
  return c;
};

/** Hotbar slot: thin outer ring (1 or 2 px), creamDark inner edge, flat core. */
const paintSlot = (outer: number, outerWidth: number, core: number): PixelCanvas => {
  const { w, h } = UI_FRAMES.slot;
  const c = new PixelCanvas(w, h);
  c.fillRect(0, 0, w, h, core);
  for (let i = 0; i < outerWidth; i++) strokeRect(c, i, i, w - 2 * i, h - 2 * i, outer);
  strokeRect(c, outerWidth, outerWidth, w - 2 * outerWidth, h - 2 * outerWidth, P.creamDark);
  return c;
};

const paintTooltip = (): PixelCanvas => {
  const { w, h } = UI_FRAMES.tooltip;
  const c = new PixelCanvas(w, h);
  c.fillRect(0, 0, w, h, P.creamLight);
  strokeRect(c, 0, 0, w, h, P.outline);
  strokeRect(c, 1, 1, w - 2, h - 2, P.woodDark);
  return c;
};

const paintBar = (): PixelCanvas => {
  const { w, h } = UI_FRAMES.bar;
  const c = new PixelCanvas(w, h);
  c.fillRect(0, 0, w, h, P.woodDark);
  strokeRect(c, 0, 0, w, h, P.outline);
  return c;
};

const wood = (frame: UiFrame, rest: Omit<WoodFrame, 'w' | 'h'>): PixelCanvas =>
  paintWoodFrame({ w: UI_FRAMES[frame].w, h: UI_FRAMES[frame].h, ...rest });

export const paintUiFrame = (frame: UiFrame): PixelCanvas => {
  switch (frame) {
    case 'panel':
      return wood(frame, { wood: 4, core: P.cream, seed: 1 });
    case 'button':
      return wood(frame, { wood: 2, core: P.cream, seed: 2 });
    case 'buttonHover':
      return wood(frame, { wood: 2, core: P.creamLight, seed: 2 });
    case 'buttonDown':
      return wood(frame, { wood: 2, core: P.creamDark, pressed: true, seed: 2 });
    case 'buttonActive':
      return wood(frame, { wood: 2, core: P.cream, gold: true, seed: 2 });
    case 'slot':
      return paintSlot(P.woodDark, 1, P.cream);
    case 'slotHover':
      return paintSlot(P.woodDark, 1, P.creamLight);
    case 'slotSelected':
      return paintSlot(P.select, 2, P.cream);
    case 'tooltip':
      return paintTooltip();
    case 'bar':
      return paintBar();
    case 'card':
      return wood(frame, { wood: 2, core: P.cream, seed: 3 });
    case 'cardUncommon':
      return wood(frame, { wood: 2, core: P.cream, lightRing: true, seed: 3 });
    case 'cardRare':
      return wood(frame, { wood: 2, core: P.cream, gold: true, seed: 3 });
    case 'cardSelected':
      return wood(frame, { wood: 3, core: P.cream, selectRing: true, seed: 3 });
  }
};

/** Wooden half disc on a plank, a sun on the morning side and a moon on the evening side. */
const paintClockDial = (): PixelCanvas => {
  const { w, h } = UI_DECOR.clockDial;
  const c = new PixelCanvas(w, h);
  const { cx, cy, faceR } = DIAL;
  for (let y = 0; y <= cy; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > 13) continue;
      let color: number;
      if (d > 12) color = P.outline;
      else if (d > faceR + 1) color = x + y < cx + cy - 6 ? P.woodLight : P.wood;
      else if (d > faceR) color = P.woodDark;
      else color = P.creamLight;
      c.set(x, y, color);
    }
  }
  // Plank under the disc.
  c.fillRect(1, cy + 1, w - 2, 4, P.wood);
  c.fillRect(1, cy + 1, w - 2, 1, P.woodLight);
  c.fillRect(1, cy + 4, w - 2, 1, P.woodDark);
  strokeRect(c, 0, cy, w, 6, P.outline);
  // Sun (morning, left) and crescent moon (evening, right) on the face.
  c.fillRect(7, cy - 4, 2, 2, P.gold);
  c.set(21, cy - 5, P.creamDark);
  c.set(20, cy - 4, P.creamDark);
  c.set(20, cy - 3, P.creamDark);
  c.set(21, cy - 2, P.creamDark);
  return c;
};

const paintFirefly = (): PixelCanvas => {
  const c = new PixelCanvas(UI_DECOR.firefly.w, UI_DECOR.firefly.h);
  c.set(1, 0, P.woodLight);
  c.set(0, 1, P.woodLight);
  c.set(2, 1, P.woodLight);
  c.set(1, 2, P.woodLight);
  c.set(1, 1, P.gold);
  return c;
};

export const paintUiDecor = (decor: UiDecor): PixelCanvas => {
  switch (decor) {
    case 'clockDial':
      return paintClockDial();
    case 'firefly':
      return paintFirefly();
  }
};

// --- main menu backdrop ------------------------------------------------------------------

/** Sky texture height (texture px); four bands of 64 rows. */
export const MENU_SKY_H = 256;

/** Whole pixel size for the menu backdrop: the sky texture always covers the screen. */
export const menuPixelScale = (screenHeight: number): number =>
  Math.max(2, Math.ceil(screenHeight / MENU_SKY_H));

const DITHER_ROWS = 6;
const BAYER = [
  [0, 2],
  [3, 1],
] as const;

/** Ordered 2×2 dither: `level` 1..DITHER_ROWS → more and more pixels of the next band. */
const ditherOn = (x: number, y: number, level: number): boolean =>
  (BAYER[y % 2]![x % 2]! + 0.5) / 4 < level / (DITHER_ROWS + 1);

/** Four flat sky bands (UI_PALETTE.sky, top → bottom) joined by dither; tiles horizontally. */
export const paintSky = (): PixelCanvas => {
  const bands = P.sky.length;
  const band = MENU_SKY_H / bands;
  const c = new PixelCanvas(4, MENU_SKY_H);
  for (let y = 0; y < MENU_SKY_H; y++) {
    const i = Math.floor(y / band);
    const own = P.sky[i]!;
    const next = P.sky[Math.min(i + 1, bands - 1)]!;
    const level = y - i * band - (band - DITHER_ROWS);
    for (let x = 0; x < 4; x++) c.set(x, y, level > 0 && ditherOn(x, y, level) ? next : own);
  }
  return c;
};

export interface HillLayer {
  /** Texture height. */
  readonly height: number;
  /** Mean ridge height above the bottom edge. */
  readonly base: number;
  /** Two sine waves (whole periods over HILL_W, so the layer tiles seamlessly). */
  readonly amp: readonly [number, number];
  readonly freq: readonly [number, number];
  readonly color: number;
  /** Chance per column of a pine silhouette on the ridge. */
  readonly trees: number;
}

/** Far → near: lower, darker, more trees. */
export const HILL_LAYERS: readonly HillLayer[] = [
  { height: 120, base: 70, amp: [14, 8], freq: [1, 3], color: P.woodDark, trees: 0 },
  { height: 90, base: 46, amp: [10, 6], freq: [2, 5], color: P.text, trees: 0.04 },
  { height: 60, base: 26, amp: [8, 4], freq: [3, 7], color: P.outline, trees: 0.07 },
];

export const HILL_W = 128;

export const paintHills = (layer: number): PixelCanvas => {
  const L = HILL_LAYERS[layer];
  if (!L) throw new Error(`Unknown hill layer ${layer}`);
  const c = new PixelCanvas(HILL_W, L.height);
  const ridge: number[] = [];
  for (let x = 0; x < HILL_W; x++) {
    const t = (x / HILL_W) * Math.PI * 2;
    const y = Math.round(
      L.height -
        L.base -
        L.amp[0] * Math.sin(t * L.freq[0] + layer) -
        L.amp[1] * Math.sin(t * L.freq[1] + layer * 2),
    );
    ridge.push(y);
    c.fillRect(x, y, 1, L.height - y, L.color);
  }
  // Pointed pines standing on the ridge (wrapping, so the seam stays invisible).
  for (let x = 0; x < HILL_W; x++) {
    if (pixelHash(x, layer, 77) >= L.trees) continue;
    const tall = 6 + Math.floor(pixelHash(layer, x, 78) * 7);
    const top = ridge[x]! - tall;
    for (let r = 0; r <= tall; r++) {
      const half = Math.floor(r / 3);
      for (let dx = -half; dx <= half; dx++) c.set((x + dx + HILL_W) % HILL_W, top + r, L.color);
    }
  }
  return c;
};
