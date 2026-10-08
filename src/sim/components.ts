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

/** A doodad the player marked for harvesting: index into DESIGNATION_KINDS. */
export const Designation = {
  kind: new Uint8Array(MAX_ENTITIES),
};

/** A person. `nameIndex` → COLONIST_NAMES; `shirt` picks the sprite colour. */
export const Colonist = {
  nameIndex: new Uint8Array(MAX_ENTITIES),
  shirt: new Uint8Array(MAX_ENTITIES),
};

/** 0–100; 100 = fed / rested / healthy. */
export const Needs = {
  hunger: new Float32Array(MAX_ENTITIES),
  rest: new Float32Array(MAX_ENTITIES),
  health: new Float32Array(MAX_ENTITIES),
};

/** Free movement state. The path itself lives in world.paths. */
export const Mover = {
  speed: new Float32Array(MAX_ENTITIES),
  stuckTicks: new Uint16Array(MAX_ENTITIES),
  repaths: new Uint8Array(MAX_ENTITIES),
};

/** What a colonist carries: resource index (−1 = nothing) and amount. */
export const Carry = {
  resource: new Int8Array(MAX_ENTITIES),
  amount: new Uint16Array(MAX_ENTITIES),
};

/** Asleep; `inTent` 1 = proper bed (full restore speed). */
export const Sleeping = {
  inTent: new Uint8Array(MAX_ENTITIES),
};

/** Tag: died. The entity stays (drawn as a grave). */
export const Dead = {};

export const components = {
  Position,
  Doodad,
  Building,
  Blueprint,
  Designation,
  Colonist,
  Needs,
  Mover,
  Carry,
  Sleeping,
  Dead,
} as const;
