/**
 * Buildings are placed freely. The footprint is the ground area they occupy (used for
 * overlap checks and nav blocking); the sprite is drawn upwards from the footprint's
 * bottom edge and can be taller than the footprint.
 */
export type Footprint =
  | { readonly kind: 'rect'; readonly w: number; readonly h: number }
  | { readonly kind: 'circle'; readonly r: number };

export interface BuildingDef {
  readonly id: BuildingId;
  readonly name: string;
  readonly nameVi: string;
  readonly footprint: Footprint;
  /** Only the Hearthfire is placed by the game, not the player. */
  readonly playerBuildable: boolean;
  /** Keyboard shortcut while in build mode. */
  readonly hotkey?: string;
}

export const BUILDING_IDS = ['hearthfire', 'tent', 'storage', 'watchtower'] as const;

export type BuildingId = (typeof BUILDING_IDS)[number];

export const BUILDINGS: Readonly<Record<BuildingId, BuildingDef>> = {
  hearthfire: {
    id: 'hearthfire',
    name: 'Hearthfire',
    nameVi: 'Lửa Thiêng',
    footprint: { kind: 'circle', r: 8 },
    playerBuildable: false,
  },
  tent: {
    id: 'tent',
    name: 'Tent',
    nameVi: 'Lều',
    footprint: { kind: 'rect', w: 24, h: 14 },
    playerBuildable: true,
    hotkey: 'Z',
  },
  storage: {
    id: 'storage',
    name: 'Storehouse',
    nameVi: 'Kho',
    footprint: { kind: 'rect', w: 32, h: 18 },
    playerBuildable: true,
    hotkey: 'X',
  },
  watchtower: {
    id: 'watchtower',
    name: 'Watchtower',
    nameVi: 'Tháp Canh',
    footprint: { kind: 'rect', w: 16, h: 12 },
    playerBuildable: true,
    hotkey: 'C',
  },
};

export const PLAYER_BUILDINGS = BUILDING_IDS.filter((id) => BUILDINGS[id].playerBuildable);

export const buildingIndex = (id: BuildingId): number => BUILDING_IDS.indexOf(id);

export const buildingAt = (index: number): BuildingDef => {
  const id = BUILDING_IDS[index];
  if (id === undefined) throw new Error(`Unknown building index ${index}`);
  return BUILDINGS[id];
};
