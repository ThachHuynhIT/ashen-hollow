import { PALETTE } from '../data/palette';
import { TERRAIN, TERRAIN_IDS, type TerrainId } from '../data/terrain';
import { MASK_BL, MASK_BR, MASK_TL, MASK_TR } from './dualGrid';
import { paintBitmap } from './bitmap';
import { PixelCanvas, pixelHash } from './pixel';

/**
 * Procedural placeholder art. Temporary — real art comes from Aseprite — but it already
 * follows docs/ART_STYLE.md: palette-only colours, light from the top-left, 1 px detail,
 * no anti-aliasing, sprites anchored at their feet.
 */
export const TILE = 16;

/** Tileset layout: one row per terrain; columns 0–15 = corner masks, 16–17 = extra full variants. */
export const TILESET_COLUMNS = 18;
export const FULL_VARIANTS = [15, 16, 17] as const;

export const tileIndex = (terrain: number, column: number): number =>
  terrain * TILESET_COLUMNS + column;

// --- terrain tiles ---------------------------------------------------------------------

/** Base ground colour at a pixel (speckled, with per-terrain accents). */
const groundColor = (id: TerrainId, x: number, y: number, variant: number): number => {
  const [base, detail, dark] = TERRAIN[id].colors;
  const seed = TERRAIN_IDS.indexOf(id) * 31 + variant * 7;
  const r = pixelHash(x, y, seed);
  switch (id) {
    case 'blackWater': {
      // Short horizontal sheen dashes.
      const dash = pixelHash(Math.floor(x / 3), y, seed + 1);
      if (y % 4 === 1 && dash < 0.18) return detail;
      return r < 0.08 ? dark : base;
    }
    case 'deadGrass': {
      // Tufts: a lighter pixel with a darker root below it.
      if (pixelHash(x, y + 1, seed) < 0.06) return dark;
      if (r < 0.07) return detail;
      return r > 0.96 ? PALETTE.boneGrey : base;
    }
    case 'forestFloor':
      // Leaf litter clumps.
      if (pixelHash(x >> 1, y >> 1, seed + 2) < 0.14) return r < 0.5 ? dark : detail;
      return base;
    case 'hills':
      // Soft diagonal contour strokes, lit from the top-left.
      if ((x + y * 2 + variant * 3) % 9 === 0 && r < 0.7) return detail;
      return r < 0.06 ? dark : r > 0.97 ? PALETTE.bone : base;
    case 'cursedSoil':
      // Mostly dull violet earth; glowing specks stay rare so they read as an accent.
      if (r < 0.006) return PALETTE.ghostGreen;
      if (r < 0.025) return detail;
      return r < 0.11 ? dark : base;
    case 'cliff': {
      // Faceted rock: light top-left faces, dark bottom-right faces.
      const facet = pixelHash(Math.floor((x + y) / 5), Math.floor((x - y + 32) / 5), seed);
      if (facet < 0.35) return detail;
      if (facet > 0.75) return dark;
      return base;
    }
    case 'mud': {
      // Small round puddles (not block-aligned, so the tile repeat doesn't show).
      const puddle = pixelHash(Math.floor((x + (y >> 1)) / 3), y >> 1, seed + 3);
      if (puddle < 0.06) return dark;
      return r < 0.08 ? detail : base;
    }
  }
};

/**
 * Smooth "inside" field for a corner mask: bilinear blend of the four corners plus a
 * little pixel jitter, so edges come out organic and dithered instead of square.
 */
const maskValue = (mask: number, x: number, y: number): number => {
  const u = (x + 0.5) / TILE;
  const v = (y + 0.5) / TILE;
  const tl = mask & MASK_TL ? 1 : 0;
  const tr = mask & MASK_TR ? 1 : 0;
  const bl = mask & MASK_BL ? 1 : 0;
  const br = mask & MASK_BR ? 1 : 0;
  const top = tl + (tr - tl) * u;
  const bottom = bl + (br - bl) * u;
  return top + (bottom - top) * v + (pixelHash(x, y, 999) - 0.5) * 0.3;
};

const isInside = (mask: number, x: number, y: number): boolean =>
  mask === 15 || maskValue(mask, Math.max(0, Math.min(15, x)), Math.max(0, Math.min(15, y))) > 0.5;

export const paintTerrainTile = (id: TerrainId, mask: number, variant = 0): PixelCanvas => {
  const c = new PixelCanvas(TILE, TILE);
  if (mask === 0) return c;
  const rim = TERRAIN[id].colors[3];
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (!isInside(mask, x, y)) continue;
      // Rim on the edge where this ground meets lower ground.
      const edge =
        mask !== 15 &&
        (!isInside(mask, x - 1, y) ||
          !isInside(mask, x + 1, y) ||
          !isInside(mask, x, y - 1) ||
          !isInside(mask, x, y + 1));
      c.set(x, y, edge ? rim : groundColor(id, x, y, variant));
    }
  }
  return c;
};

/** The whole terrain tileset as one canvas (rows = terrains, columns = masks + variants). */
export const paintTerrainTileset = (): PixelCanvas => {
  const sheet = new PixelCanvas(TILESET_COLUMNS * TILE, TERRAIN_IDS.length * TILE);
  TERRAIN_IDS.forEach((id, row) => {
    for (let mask = 1; mask <= 15; mask++)
      sheet.blit(paintTerrainTile(id, mask), mask * TILE, row * TILE);
    sheet.blit(paintTerrainTile(id, 15, 1), 16 * TILE, row * TILE);
    sheet.blit(paintTerrainTile(id, 15, 2), 17 * TILE, row * TILE);
  });
  return sheet;
};

// --- doodads -----------------------------------------------------------------------------

const SHADOW_ALPHA = 110;

export const paintDeadTree = (variant: number): PixelCanvas => {
  const c = new PixelCanvas(16, 24);
  c.fillEllipse(8, 22, 5, 1.8, PALETTE.void, SHADOW_ALPHA);
  const lean = variant === 1 ? 1 : 0;
  const top = 6 + variant;
  for (let y = 22; y >= top; y--) {
    const x = 7 + (y < 14 ? lean : 0);
    c.set(x, y, PALETTE.rotBrown);
    c.set(x + 1, y, y > 16 ? PALETTE.mud : PALETTE.rotBrown);
  }
  // Roots.
  c.set(6, 22, PALETTE.rotBrown);
  c.set(9, 22, PALETTE.rotBrown);
  // Crooked bare branches.
  const branches: [number, number][] = [
    [6, 12],
    [5, 11],
    [4, 10],
    [4, 9],
    [9 + lean, 10],
    [10 + lean, 9],
    [11 + lean, 8],
    [11 + lean, 7],
    [6 + lean, 8],
    [5 + lean, 7],
    [9 + lean, 14],
    [10 + lean, 13],
  ];
  for (const [x, y] of branches) c.set(x, y, PALETTE.rotBrown);
  // Sparse dead needles, lit from the top-left.
  for (let i = 0; i < 9; i++) {
    const x = 3 + Math.floor(pixelHash(i, variant, 41) * 10);
    const y = top + Math.floor(pixelHash(variant, i, 43) * 7);
    c.set(x, y, pixelHash(i, i, 47) < 0.5 ? PALETTE.pine : PALETTE.mossDark);
  }
  return c;
};

export const paintBoulder = (): PixelCanvas => {
  const c = new PixelCanvas(16, 12);
  c.fillEllipse(8, 10.5, 7, 1.6, PALETTE.void, SHADOW_ALPHA);
  c.fillEllipse(8, 6.5, 6.5, 4.5, PALETTE.slate);
  c.fillEllipse(6.5, 5, 3.5, 2.5, PALETTE.stone);
  c.set(5, 3, PALETTE.stoneLight);
  c.set(6, 3, PALETTE.stoneLight);
  c.set(4, 4, PALETTE.stoneLight);
  for (let x = 4; x < 14; x++) c.set(x, 10, PALETTE.slateDark);
  c.set(13, 8, PALETTE.slateDark);
  c.set(12, 9, PALETTE.slateDark);
  c.set(9, 6, PALETTE.slateDark); // crack
  c.set(10, 7, PALETTE.slateDark);
  return c;
};

export const paintBoneHeap = (): PixelCanvas => {
  const c = new PixelCanvas(12, 8);
  c.fillEllipse(6, 7, 5, 1.2, PALETTE.void, SHADOW_ALPHA);
  for (let x = 1; x <= 9; x++) c.set(x, 5 + (x % 3 === 0 ? -1 : 0), PALETTE.bone);
  for (let x = 3; x <= 10; x++) c.set(x, 3 + (x > 6 ? 1 : 0), PALETTE.boneGrey);
  // Skull.
  c.fillRect(6, 1, 3, 3, PALETTE.bone);
  c.set(6, 2, PALETTE.void);
  c.set(8, 2, PALETTE.void);
  c.set(1, 4, PALETTE.parchment);
  c.set(9, 6, PALETTE.boneGrey);
  return c;
};

export const paintGlowShroom = (): PixelCanvas => {
  const c = new PixelCanvas(8, 8);
  c.fillEllipse(4, 7, 3, 0.9, PALETTE.void, SHADOW_ALPHA);
  c.set(2, 6, PALETTE.boneGrey);
  c.set(2, 5, PALETTE.boneGrey);
  c.set(5, 6, PALETTE.boneGrey);
  c.fillRect(1, 3, 3, 2, PALETTE.ghostGreen);
  c.set(1, 3, PALETTE.candle);
  c.fillRect(4, 4, 3, 2, PALETTE.ghostGreen);
  c.set(4, 4, PALETTE.candle);
  return c;
};

// --- buildings ---------------------------------------------------------------------------

export const paintHearthfire = (): PixelCanvas => {
  const c = new PixelCanvas(16, 16);
  c.fillEllipse(8, 13, 7, 2.5, PALETTE.void, SHADOW_ALPHA);
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
  for (let x = 5; x <= 11; x++) c.set(x, 12, PALETTE.rotBrown);
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

export const paintTent = (): PixelCanvas => {
  const c = new PixelCanvas(24, 20);
  c.fillEllipse(12, 18, 12, 2, PALETTE.void, SHADOW_ALPHA);
  // A-frame canvas: left face lit, right face shaded.
  for (let y = 3; y <= 18; y++) {
    const half = Math.floor((y - 3) * 0.72) + 1;
    for (let dx = -half; dx <= half; dx++) {
      const color = dx < 0 ? PALETTE.boneGrey : dx === 0 ? PALETTE.bone : PALETTE.ashGrey;
      c.set(12 + dx, y, color);
    }
  }
  // Dark doorway.
  for (let y = 11; y <= 18; y++) {
    const half = Math.floor((y - 11) * 0.5);
    for (let dx = -half; dx <= half; dx++) c.set(12 + dx, y, PALETTE.ink);
  }
  // Ridge pole and pegs.
  c.set(12, 2, PALETTE.rotBrown);
  c.set(12, 1, PALETTE.rotBrown);
  c.set(1, 18, PALETTE.rotBrown);
  c.set(22, 18, PALETTE.rotBrown);
  return c;
};

export const paintStorage = (): PixelCanvas => {
  const c = new PixelCanvas(32, 24);
  c.fillEllipse(16, 22, 16, 2, PALETTE.void, SHADOW_ALPHA);
  // Plank walls.
  c.fillRect(2, 9, 28, 13, PALETTE.peat);
  for (let x = 2; x < 30; x += 4) for (let y = 9; y < 22; y++) c.set(x, y, PALETTE.rotBrown);
  for (let x = 2; x < 30; x++) c.set(x, 21, PALETTE.rotBrown);
  // Slate roof, lit from the left.
  for (let y = 2; y <= 9; y++) {
    const inset = 9 - y;
    for (let x = 1 + inset; x <= 30 - inset; x++) {
      c.set(x, y, x < 16 ? PALETTE.stone : PALETTE.slate);
    }
  }
  for (let x = 1; x <= 30; x++) c.set(x, 9, PALETTE.slateDark);
  // Door.
  c.fillRect(13, 14, 6, 8, PALETTE.ink);
  c.set(17, 18, PALETTE.flame);
  return c;
};

export const paintWatchtower = (): PixelCanvas => {
  const c = new PixelCanvas(16, 40);
  c.fillEllipse(8, 38, 8, 2, PALETTE.void, SHADOW_ALPHA);
  // Four legs with cross braces.
  for (let y = 14; y <= 38; y++) {
    c.set(2, y, PALETTE.rotBrown);
    c.set(13, y, PALETTE.rotBrown);
    c.set(5, y, PALETTE.peat);
    c.set(10, y, PALETTE.peat);
  }
  for (let i = 0; i < 9; i++) {
    c.set(3 + i, 20 + i, PALETTE.rotBrown);
    c.set(12 - i, 20 + i, PALETTE.rotBrown);
  }
  // Platform + rail.
  c.fillRect(0, 12, 16, 3, PALETTE.peat);
  for (let x = 0; x < 16; x++) c.set(x, 14, PALETTE.rotBrown);
  c.fillRect(1, 8, 14, 4, PALETTE.mud);
  for (let x = 1; x < 15; x += 3) c.set(x, 8, PALETTE.rotBrown);
  // Pointed roof.
  for (let y = 1; y <= 7; y++) {
    const half = y + 1;
    for (let dx = -half; dx <= half; dx++) c.set(8 + dx, y, dx < 0 ? PALETTE.stone : PALETTE.slate);
  }
  // Lantern.
  c.set(8, 10, PALETTE.flame);
  c.set(8, 9, PALETTE.candle);
  return c;
};

// --- Phase 1: icons, colonists, small buildings -------------------------------------

export const ICON_IDS = [
  'wood',
  'stone',
  'food',
  'chop',
  'mine',
  'forage',
  'clear',
  'wall',
] as const;
export type IconId = (typeof ICON_IDS)[number];

const ICONS: Record<IconId, { rows: string[]; colors: Record<string, number> }> = {
  wood: {
    rows: [
      '........',
      '........',
      '.LLLLLR.',
      'LLLLLLRR',
      'DDDDDDRR',
      '.DDDDDR.',
      '........',
      '........',
    ],
    colors: { L: PALETTE.peat, D: PALETTE.rotBrown, R: PALETTE.driedMoss },
  },
  stone: {
    rows: [
      '........',
      '...HH...',
      '..HSSS..',
      '.HSSSSS.',
      '.SSSSSD.',
      '..SSSDD.',
      '...DDD..',
      '........',
    ],
    colors: { H: PALETTE.stoneLight, S: PALETTE.stone, D: PALETTE.slateDark },
  },
  food: {
    rows: [
      '........',
      '..GGGG..',
      '.GCGGGG.',
      'GGGGGGGG',
      '...SS...',
      '...SS...',
      '..SSSS..',
      '........',
    ],
    colors: { G: PALETTE.ghostGreen, C: PALETTE.candle, S: PALETTE.boneGrey },
  },
  chop: {
    rows: [
      '.....HH.',
      '....HHHH',
      '.....HD.',
      '....D...',
      '...D....',
      '..D.....',
      '.D......',
      'D.......',
    ],
    colors: { H: PALETTE.stoneLight, D: PALETTE.peat },
  },
  mine: {
    rows: [
      '.HHHHH..',
      'H..D..H.',
      '...D....',
      '...D....',
      '...D....',
      '...D....',
      '...D....',
      '........',
    ],
    colors: { H: PALETTE.stoneLight, D: PALETTE.peat },
  },
  forage: {
    rows: [
      '..G..G..',
      '.GGG.GG.',
      '........',
      '.BBBBBB.',
      '.BDBDBB.',
      '.BBBBBB.',
      '..BBBB..',
      '........',
    ],
    colors: { G: PALETTE.ghostGreen, B: PALETTE.peat, D: PALETTE.rotBrown },
  },
  clear: {
    rows: [
      'X......X',
      '.X....X.',
      '..X..X..',
      '...XX...',
      '...XX...',
      '..X..X..',
      '.X....X.',
      'X......X',
    ],
    colors: { X: PALETTE.ember },
  },
  wall: {
    rows: [
      '.T..T..T',
      '.S..S..S',
      '.S..S..S',
      '.SSSSSSS',
      '.S..S..S',
      '.S..S..S',
      '.S..S..S',
      '........',
    ],
    colors: { T: PALETTE.bone, S: PALETTE.peat },
  },
};

export const paintIcon = (id: IconId): PixelCanvas => paintBitmap(ICONS[id].rows, ICONS[id].colors);

export const paintGrave = (): PixelCanvas =>
  paintBitmap(
    [
      '....BBBB....',
      '....BSSB....',
      '..BBBSSBBB..',
      '..BSSSSSSB..',
      '..BBBSSBBB..',
      '....BSSB....',
      '....BSSB....',
      '....BSSB....',
      '....BSSB....',
      '...BBSSBB...',
      '..MMMMMMMM..',
      '.MMMMMMMMMM.',
      '.VVVVVVVVVV.',
      '............',
    ],
    { B: PALETTE.slateDark, S: PALETTE.stone, M: PALETTE.mud, V: PALETTE.ink },
  );

export const paintTorch = (): PixelCanvas =>
  paintBitmap(
    [
      '..CC..',
      '.CFFC.',
      '.FFEF.',
      '..EE..',
      '..DD..',
      '..PP..',
      '..PP..',
      '..PP..',
      '..PP..',
      '..PP..',
      '..PP..',
      '..PP..',
      '..PP..',
      '..PP..',
      '.PPPP.',
      '.VVVV.',
    ],
    {
      C: PALETTE.candle,
      F: PALETTE.flame,
      E: PALETTE.ember,
      D: PALETTE.emberDark,
      P: PALETTE.peat,
      V: PALETTE.ink,
    },
  );

export const paintWallStake = (): PixelCanvas =>
  paintBitmap(
    [
      '...BB...',
      '..BPPB..',
      '..PPPD..',
      '..PPPD..',
      '..PPPD..',
      '..PPPD..',
      '..PPPD..',
      '..PPPD..',
      '..PPPD..',
      '..PPPD..',
      '.MMMMMM.',
      '..VVVV..',
    ],
    { B: PALETTE.driedMoss, P: PALETTE.peat, D: PALETTE.rotBrown, M: PALETTE.mud, V: PALETTE.ink },
  );

export const SHIRT_COLORS = [
  PALETTE.blood,
  PALETTE.pine,
  PALETTE.shadowPlum,
  PALETTE.emberDark,
] as const;
export type ColonistPose = 'stand' | 'walk' | 'work' | 'sleep';
export const COLONIST_POSES: readonly ColonistPose[] = ['stand', 'walk', 'work', 'sleep'];

/** 16×24 colonist standing on the bottom row, lit from the top-left. */
export const paintColonist = (shirt: number, pose: ColonistPose): PixelCanvas => {
  const c = new PixelCanvas(16, 24);
  c.fillEllipse(8, 22.5, 4, 1.2, PALETTE.void, 110);
  if (pose === 'sleep') {
    // Lying down, head to the left, on a bedroll.
    c.fillRect(2, 20, 13, 2, PALETTE.mud);
    c.fillRect(4, 18, 10, 3, shirt);
    c.fillRect(1, 17, 3, 3, PALETTE.bone);
    c.set(1, 17, PALETTE.rotBrown);
    c.fillRect(13, 19, 2, 2, PALETTE.rotBrown);
    return c;
  }
  const stride = pose === 'walk' ? 1 : 0;
  c.fillRect(6 - stride, 18, 2, 4, PALETTE.rotBrown); // legs
  c.fillRect(9 + stride, 18, 2, 4, PALETTE.rotBrown);
  c.fillRect(5, 11, 7, 8, shirt); // body
  c.fillRect(11, 11, 1, 8, PALETTE.ink); // shaded side
  if (pose === 'work') {
    c.fillRect(12, 9, 2, 2, PALETTE.bone); // raised arm + tool
    c.fillRect(13, 4, 1, 6, PALETTE.peat);
    c.fillRect(12, 3, 3, 2, PALETTE.stoneLight);
    c.fillRect(4, 12, 1, 5, PALETTE.bone);
  } else {
    c.fillRect(4, 12, 1, 5, PALETTE.bone);
    c.fillRect(12, 12, 1, 5, PALETTE.bone);
  }
  c.fillRect(6, 5, 5, 6, PALETTE.bone); // head
  c.fillRect(6, 4, 5, 2, PALETTE.rotBrown); // hair
  c.set(7, 8, PALETTE.ink);
  c.set(9, 8, PALETTE.ink);
  return c;
};
