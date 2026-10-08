/** The three Phase 1 resources. Stock is a plain counter — there are no item piles. */
export const RESOURCE_IDS = ['wood', 'stone', 'food'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export interface ResourceDef {
  readonly id: ResourceId;
  readonly name: string;
  readonly nameVi: string;
}

export const RESOURCES: Readonly<Record<ResourceId, ResourceDef>> = {
  wood: { id: 'wood', name: 'Wood', nameVi: 'Gỗ' },
  stone: { id: 'stone', name: 'Stone', nameVi: 'Đá' },
  food: { id: 'food', name: 'Food', nameVi: 'Thức ăn' },
};

export const resourceIndex = (id: ResourceId): number => RESOURCE_IDS.indexOf(id);

/** What the colony starts with, so the player can build straight away. */
export const STARTING_STOCK: Readonly<Record<ResourceId, number>> = {
  wood: 30,
  stone: 10,
  food: 30,
};

/** Most a colonist can carry in one trip. */
export const CARRY_CAPACITY = 20;
