import { PALETTE } from './palette';

/**
 * Ground types. The world is continuous; terrain is stored on a 16 px grid and drawn
 * with dual-grid blending so the grid is never visible.
 *
 * `speed` multiplies a unit's walk speed while standing on this ground (Civ-style
 * movement cost, but continuous). `priority` sets the dual-grid layering order:
 * higher-priority ground is drawn over (and its edges bleed onto) lower ground.
 */
export interface TerrainDef {
  readonly id: TerrainId;
  readonly name: string;
  readonly nameVi: string;
  readonly passable: boolean;
  readonly buildable: boolean;
  /** Walk-speed multiplier (ignored when impassable). */
  readonly speed: number;
  /** Combat Strength bonus for a defender standing here. */
  readonly defenseBonus: number;
  readonly blocksSight: boolean;
  readonly priority: number;
  /** Placeholder art palette: [base, detail, dark, rim]. */
  readonly colors: readonly [number, number, number, number];
}

/** Index order = storage value in the terrain grid. Sorted by priority for clarity. */
export const TERRAIN_IDS = [
  'blackWater',
  'mud',
  'deadGrass',
  'forestFloor',
  'hills',
  'cursedSoil',
  'cliff',
] as const;

export type TerrainId = (typeof TERRAIN_IDS)[number];

export const TERRAIN: Readonly<Record<TerrainId, TerrainDef>> = {
  blackWater: {
    id: 'blackWater',
    name: 'Black Water',
    nameVi: 'Nước Đen',
    passable: false,
    buildable: false,
    speed: 0,
    defenseBonus: 0,
    blocksSight: false,
    priority: 0,
    colors: [PALETTE.blackWater, PALETTE.waterSheen, PALETTE.deepWater, PALETTE.deepWater],
  },
  mud: {
    id: 'mud',
    name: 'Rot Bog',
    nameVi: 'Đầm Thối',
    passable: true,
    buildable: false,
    speed: 0.45,
    defenseBonus: -3,
    blocksSight: false,
    priority: 1,
    colors: [PALETTE.swampGreen, PALETTE.mud, PALETTE.blackWater, PALETTE.mossDark],
  },
  deadGrass: {
    id: 'deadGrass',
    name: 'Dead Grass',
    nameVi: 'Cỏ Chết',
    passable: true,
    buildable: true,
    speed: 1,
    defenseBonus: 0,
    blocksSight: false,
    priority: 2,
    colors: [PALETTE.deadGrass, PALETTE.driedMoss, PALETTE.peat, PALETTE.peat],
  },
  forestFloor: {
    id: 'forestFloor',
    name: 'Forest Floor',
    nameVi: 'Nền Rừng',
    passable: true,
    buildable: true,
    speed: 0.8,
    defenseBonus: 3,
    blocksSight: false,
    priority: 3,
    colors: [PALETTE.mossDark, PALETTE.pine, PALETTE.pineDark, PALETTE.pineDark],
  },
  hills: {
    id: 'hills',
    name: 'Bone Hills',
    nameVi: 'Đồi Xương',
    passable: true,
    buildable: true,
    speed: 0.7,
    defenseBonus: 3,
    blocksSight: false,
    priority: 4,
    colors: [PALETTE.peat, PALETTE.driedMoss, PALETTE.rotBrown, PALETTE.rotBrown],
  },
  cursedSoil: {
    id: 'cursedSoil',
    name: 'Cursed Soil',
    nameVi: 'Đất Nguyền',
    passable: true,
    buildable: true,
    speed: 1,
    defenseBonus: 0,
    blocksSight: false,
    priority: 5,
    colors: [PALETTE.nightViolet, PALETTE.veilViolet, PALETTE.shadowPlum, PALETTE.ink],
  },
  cliff: {
    id: 'cliff',
    name: 'Crag',
    nameVi: 'Vách Đá',
    passable: false,
    buildable: false,
    speed: 0,
    defenseBonus: 0,
    blocksSight: true,
    priority: 6,
    colors: [PALETTE.slate, PALETTE.stoneLight, PALETTE.slateDark, PALETTE.ink],
  },
};

/** Numeric index used in packed grid storage (Uint8Array). */
export const terrainIndex = (id: TerrainId): number => TERRAIN_IDS.indexOf(id);

export const terrainAt = (index: number): TerrainDef => {
  const id = TERRAIN_IDS[index];
  if (id === undefined) throw new Error(`Unknown terrain index ${index}`);
  return TERRAIN[id];
};
