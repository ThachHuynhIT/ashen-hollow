/**
 * ECS components (structure-of-arrays). Every unit, colonist and monster lives on
 * exactly one hex at a time — movement is hex-to-hex, never "between" tiles.
 */
const MAX_ENTITIES = 10_000;

export const HexPosition = {
  q: new Int16Array(MAX_ENTITIES),
  r: new Int16Array(MAX_ENTITIES),
};

export const components = { HexPosition } as const;
