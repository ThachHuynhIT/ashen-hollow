/**
 * "Ashen 32" — the locked game palette. Every pixel in the game (art and placeholder
 * art alike) should come from this list. See docs/ART_STYLE.md for usage rules.
 *
 * Visual language: cold desaturated violets/greens for darkness, warm oranges for fire
 * and safety, blood red and ghost green as rare accents.
 */
export const PALETTE = {
  // Darks / void
  void: 0x0b0a10,
  ink: 0x15131c,
  nightViolet: 0x221d2e,
  dusk: 0x332b40,
  shadowPlum: 0x4a3b54,
  ashGrey: 0x6b6470,
  boneGrey: 0x9a9196,
  bone: 0xcfc4b8,
  parchment: 0xe9dfcc,

  // Earth / dead vegetation
  rotBrown: 0x2e2420,
  mud: 0x4a3a2c,
  peat: 0x5e4a35,
  deadGrass: 0x6e6a43,
  driedMoss: 0x8a8550,
  swampGreen: 0x2f3b2c,
  mossDark: 0x3c4a33,
  pineDark: 0x1f2a24,
  pine: 0x2d3d31,

  // Stone
  slateDark: 0x2b2c33,
  slate: 0x44464f,
  stone: 0x63656e,
  stoneLight: 0x868893,

  // Water
  blackWater: 0x141a22,
  deepWater: 0x1f2b38,
  waterSheen: 0x3a4d5e,

  // Accents
  emberDark: 0x7a2e12,
  ember: 0xc8541c,
  flame: 0xf0a040,
  candle: 0xffe1a0,
  blood: 0x8c1c24,
  ghostGreen: 0x6fd3a0,
  veilViolet: 0x8a5cc8,
} as const;

export type PaletteColor = keyof typeof PALETTE;

export const toCss = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
