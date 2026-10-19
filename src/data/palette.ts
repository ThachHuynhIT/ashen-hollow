/**
 * "Hearth 32" — the locked world palette. Every world pixel (field, plots, buildings,
 * units, card pictures) comes from this list; UI pixels come from UI_PALETTE
 * (src/data/uiPalette.ts). See docs/ART_STYLE.md.
 *
 * Visual language: warm, medium saturation, shadows in brown–plum (never black or cold
 * violet); blue = our side, red = the enemy.
 */
export const PALETTE = {
  // Darks / outlines
  outline: 0x2a1a14,
  shadow: 0x4a2f27,
  plum: 0x6b3f5a,
  // Plants
  leafDark: 0x2f5a35,
  grassDark: 0x3f6b2a,
  leaf: 0x4a8a3f,
  grass: 0x5d9b3a,
  grassLight: 0x8cc455,
  meadow: 0xb8d86a,
  // Earth
  soilDark: 0x6b4423,
  soil: 0x9a6634,
  path: 0xc89458,
  sand: 0xe8c68a,
  // Wheat
  wheat: 0xe8b84a,
  wheatLight: 0xf6dc7a,
  // Water
  waterDeep: 0x2f6f9a,
  water: 0x4a9ac8,
  waterLight: 0x8fd0e8,
  // Stone
  stoneDark: 0x5e5a66,
  stone: 0x8c8794,
  stoneLight: 0xc2bcc4,
  // Skin, light cloth
  skin: 0xf2c49b,
  skinShadow: 0xc98a64,
  cream: 0xfaf0d7,
  white: 0xfffbf0,
  // Accents
  red: 0xd04a3a,
  redDark: 0x8e2d2b,
  orange: 0xf08a3a,
  gold: 0xf6c445,
  blue: 0x4a6fc8,
  purple: 0x8a5ab8,
  teal: 0x3aa89a,
} as const;

export type PaletteColor = keyof typeof PALETTE;

export const toCss = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
