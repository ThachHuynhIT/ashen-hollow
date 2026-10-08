import type { TerrainId } from './terrain';

/**
 * Free-placed world objects (trees, rocks, bones, mushrooms). Their position is the
 * point where they touch the ground; sprites are drawn upwards from there and
 * depth-sorted by that y.
 */
export interface DoodadDef {
  readonly id: DoodadId;
  readonly name: string;
  readonly nameVi: string;
  /** Ground collider radius (px). */
  readonly radius: number;
  /** Units can't walk through it and buildings can't overlap it. */
  readonly blocksMovement: boolean;
  readonly blocksSight: boolean;
  /** What it yields when harvested (Phase 1). */
  readonly yields: { readonly resource: string; readonly amount: number } | null;
  /** Placement: minimum spacing between doodads of this kind, and where they grow. */
  readonly spacing: number;
  readonly habitats: readonly TerrainId[];
  /** 0..1 chance a candidate point in a habitat is kept (scaled by a noise field). */
  readonly density: number;
}

export const DOODAD_IDS = ['deadTree', 'boulder', 'boneHeap', 'glowShroom'] as const;

export type DoodadId = (typeof DOODAD_IDS)[number];

export const DOODADS: Readonly<Record<DoodadId, DoodadDef>> = {
  deadTree: {
    id: 'deadTree',
    name: 'Dead Tree',
    nameVi: 'Cây Chết',
    radius: 4,
    blocksMovement: true,
    blocksSight: true,
    yields: { resource: 'wood', amount: 20 },
    spacing: 11,
    habitats: ['forestFloor', 'deadGrass'],
    density: 0.9,
  },
  boulder: {
    id: 'boulder',
    name: 'Boulder',
    nameVi: 'Tảng Đá',
    radius: 6,
    blocksMovement: true,
    blocksSight: false,
    yields: { resource: 'stone', amount: 30 },
    spacing: 26,
    habitats: ['hills', 'deadGrass'],
    density: 0.55,
  },
  boneHeap: {
    id: 'boneHeap',
    name: 'Bone Heap',
    nameVi: 'Đống Xương',
    radius: 4,
    blocksMovement: true,
    blocksSight: false,
    yields: { resource: 'bone', amount: 10 },
    spacing: 40,
    habitats: ['hills', 'cursedSoil'],
    density: 0.5,
  },
  glowShroom: {
    id: 'glowShroom',
    name: 'Glowcap',
    nameVi: 'Nấm Phát Quang',
    radius: 2,
    blocksMovement: false,
    blocksSight: false,
    yields: { resource: 'food', amount: 5 },
    spacing: 18,
    habitats: ['mud', 'forestFloor', 'cursedSoil'],
    density: 0.35,
  },
};

export const doodadIndex = (id: DoodadId): number => DOODAD_IDS.indexOf(id);

export const doodadAt = (index: number): DoodadDef => {
  const id = DOODAD_IDS[index];
  if (id === undefined) throw new Error(`Unknown doodad index ${index}`);
  return DOODADS[id];
};
