/**
 * ECS components (structure-of-arrays). Positions are continuous world pixels:
 * for doodads and units it is where they touch the ground, for buildings the centre
 * of their footprint.
 */
import { RESOURCE_IDS } from '../data/resources';

const MAX_ENTITIES = 20_000;

export const Position = {
  x: new Float32Array(MAX_ENTITIES),
  y: new Float32Array(MAX_ENTITIES),
};

/** Index into DOODAD_IDS. */
export const Doodad = {
  kind: new Uint8Array(MAX_ENTITIES),
};

/** Index into BUILDING_IDS. */
export const Building = {
  kind: new Uint8Array(MAX_ENTITIES),
};

/** An unfinished building: materials delivered / in transit, and work done (ticks). */
export const Blueprint = {
  progress: new Uint16Array(MAX_ENTITIES),
  delivered: RESOURCE_IDS.map(() => new Uint16Array(MAX_ENTITIES)),
  pending: RESOURCE_IDS.map(() => new Uint16Array(MAX_ENTITIES)),
};

export const components = { Position, Doodad, Building, Blueprint } as const;
