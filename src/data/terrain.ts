import { PALETTE } from './palette';

/**
 * Terrain definitions. Data-driven: gameplay numbers live here, not in systems.
 * `moveCost` follows the Civ-style model (1 = open ground); `null` = impassable.
 * In real-time play the cost scales how long a unit takes to cross the hex.
 */
export interface TerrainDef {
  readonly id: TerrainId;
  readonly name: string;
  readonly nameVi: string;
  readonly moveCost: number | null;
  /** Combat Strength bonus for a defender standing on this terrain. */
  readonly defenseBonus: number;
  /** Blocks line of sight for ranged attacks passing through. */
  readonly blocksSight: boolean;
  /** Placeholder art: base colour + up to two detail colours. */
  readonly colors: readonly [number, number, number];
}

export const TERRAIN_IDS = [
  'deadGrass',
  'mud',
  'deadForest',
  'hills',
  'mountain',
  'blackWater',
  'cursedSoil',
] as const;

export type TerrainId = (typeof TERRAIN_IDS)[number];

export const TERRAIN: Readonly<Record<TerrainId, TerrainDef>> = {
  deadGrass: {
    id: 'deadGrass',
    name: 'Dead Grass',
    nameVi: 'Cỏ Chết',
    moveCost: 1,
    defenseBonus: 0,
    blocksSight: false,
    colors: [PALETTE.deadGrass, PALETTE.driedMoss, PALETTE.peat],
  },
  mud: {
    id: 'mud',
    name: 'Rot Bog',
    nameVi: 'Đầm Thối',
    moveCost: 3,
    defenseBonus: -2,
    blocksSight: false,
    colors: [PALETTE.swampGreen, PALETTE.mud, PALETTE.mossDark],
  },
  deadForest: {
    id: 'deadForest',
    name: 'Dead Forest',
    nameVi: 'Rừng Chết',
    moveCost: 2,
    defenseBonus: 3,
    blocksSight: true,
    colors: [PALETTE.mossDark, PALETTE.pineDark, PALETTE.pine],
  },
  hills: {
    id: 'hills',
    name: 'Bone Hills',
    nameVi: 'Đồi Xương',
    moveCost: 2,
    defenseBonus: 3,
    blocksSight: true,
    colors: [PALETTE.peat, PALETTE.driedMoss, PALETTE.rotBrown],
  },
  mountain: {
    id: 'mountain',
    name: 'Crag',
    nameVi: 'Vách Đá',
    moveCost: null,
    defenseBonus: 0,
    blocksSight: true,
    colors: [PALETTE.slate, PALETTE.stoneLight, PALETTE.slateDark],
  },
  blackWater: {
    id: 'blackWater',
    name: 'Black Water',
    nameVi: 'Nước Đen',
    moveCost: null,
    defenseBonus: 0,
    blocksSight: false,
    colors: [PALETTE.blackWater, PALETTE.deepWater, PALETTE.waterSheen],
  },
  cursedSoil: {
    id: 'cursedSoil',
    name: 'Cursed Soil',
    nameVi: 'Đất Nguyền',
    moveCost: 1,
    defenseBonus: 0,
    blocksSight: false,
    colors: [PALETTE.nightViolet, PALETTE.shadowPlum, PALETTE.veilViolet],
  },
};

/** Numeric index used in packed map storage (Uint8Array). */
export const terrainIndex = (id: TerrainId): number => TERRAIN_IDS.indexOf(id);

export const terrainAt = (index: number): TerrainDef => {
  const id = TERRAIN_IDS[index];
  if (id === undefined) throw new Error(`Unknown terrain index ${index}`);
  return TERRAIN[id];
};
