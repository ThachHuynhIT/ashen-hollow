import type { ResourceId } from './resources';

/**
 * Buildings are placed freely. The footprint is the ground area they occupy (used for
 * overlap checks and nav blocking); the sprite is drawn upwards from the footprint's
 * bottom edge and can be taller than the footprint.
 */
export type Footprint =
  | { readonly kind: 'rect'; readonly w: number; readonly h: number }
  | { readonly kind: 'circle'; readonly r: number };

/** What a finished building is for. */
export type BuildingRole = 'drop' | 'sleep' | 'light' | 'wall' | 'defense';

export interface BuildingDef {
  readonly id: BuildingId;
  readonly name: string;
  readonly nameVi: string;
  readonly footprint: Footprint;
  /** Only the Hearthfire is placed by the game, not the player. */
  readonly playerBuildable: boolean;
  /** Keyboard shortcut while in build mode. */
  readonly hotkey?: string;
  readonly cost: Readonly<Partial<Record<ResourceId, number>>>;
  /** Work ticks a colonist spends building it once all materials are delivered. */
  readonly buildTicks: number;
  readonly role: BuildingRole;
  /** Beds (only for role 'sleep'). */
  readonly sleepCapacity: number;
}

/** Append only — indices are stored in the ECS. */
export const BUILDING_IDS = [
  'hearthfire',
  'tent',
  'storage',
  'watchtower',
  'torch',
  'wallStake',
] as const;

export type BuildingId = (typeof BUILDING_IDS)[number];

export const BUILDINGS: Readonly<Record<BuildingId, BuildingDef>> = {
  hearthfire: {
    id: 'hearthfire',
    name: 'Hearthfire',
    nameVi: 'Lửa Thiêng',
    footprint: { kind: 'circle', r: 8 },
    playerBuildable: false,
    cost: {},
    buildTicks: 0,
    role: 'drop',
    sleepCapacity: 0,
  },
  tent: {
    id: 'tent',
    name: 'Tent',
    nameVi: 'Lều',
    footprint: { kind: 'rect', w: 24, h: 14 },
    playerBuildable: true,
    hotkey: 'Z',
    cost: { wood: 10 },
    buildTicks: 100,
    role: 'sleep',
    sleepCapacity: 2,
  },
  storage: {
    id: 'storage',
    name: 'Storehouse',
    nameVi: 'Kho',
    footprint: { kind: 'rect', w: 32, h: 18 },
    playerBuildable: true,
    hotkey: 'X',
    cost: { wood: 20 },
    buildTicks: 150,
    role: 'drop',
    sleepCapacity: 0,
  },
  watchtower: {
    id: 'watchtower',
    name: 'Watchtower',
    nameVi: 'Tháp Canh',
    footprint: { kind: 'rect', w: 16, h: 12 },
    playerBuildable: true,
    hotkey: 'C',
    cost: { wood: 15, stone: 10 },
    buildTicks: 200,
    role: 'defense',
    sleepCapacity: 0,
  },
  torch: {
    id: 'torch',
    name: 'Torch',
    nameVi: 'Đuốc',
    footprint: { kind: 'circle', r: 3 },
    playerBuildable: true,
    hotkey: 'V',
    cost: { wood: 2 },
    buildTicks: 30,
    role: 'light',
    sleepCapacity: 0,
  },
  wallStake: {
    id: 'wallStake',
    name: 'Wall stake',
    nameVi: 'Cọc tường',
    footprint: { kind: 'circle', r: 4 },
    playerBuildable: true,
    cost: { wood: 1 },
    buildTicks: 20,
    role: 'wall',
    sleepCapacity: 0,
  },
};

/** Buildings on the build bar (wall stakes are placed with the wall tool instead). */
export const PLAYER_BUILDINGS = BUILDING_IDS.filter(
  (id) => BUILDINGS[id].playerBuildable && id !== 'wallStake',
);

export const buildingIndex = (id: BuildingId): number => BUILDING_IDS.indexOf(id);

export const buildingAt = (index: number): BuildingDef => {
  const id = BUILDING_IDS[index];
  if (id === undefined) throw new Error(`Unknown building index ${index}`);
  return BUILDINGS[id];
};
