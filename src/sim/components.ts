/**
 * ECS components (structure-of-arrays). Positions are continuous world pixels:
 * for doodads and units it is where they touch the ground, for buildings the centre
 * of their footprint.
 */
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

export const components = { Position, Doodad, Building } as const;
