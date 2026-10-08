/**
 * Axial hex coordinates for a pointy-top hex grid.
 *
 * Axial (q, r) is the canonical coordinate system for everything in the simulation:
 * pathfinding, distance, range, line of sight and storage keys. Offset coordinates
 * (see offset.ts) are only used to lay out rectangular maps.
 *
 * Reference: https://www.redblobgames.com/grids/hexagons/
 */
export interface Hex {
  readonly q: number;
  readonly r: number;
}

export const hex = (q: number, r: number): Hex => ({ q, r });

/** Third cube coordinate, derived (q + r + s = 0). */
export const hexS = (h: Hex): number => -h.q - h.r;

export const hexEquals = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

export const hexAdd = (a: Hex, b: Hex): Hex => hex(a.q + b.q, a.r + b.r);

export const hexSub = (a: Hex, b: Hex): Hex => hex(a.q - b.q, a.r - b.r);

export const hexScale = (a: Hex, k: number): Hex => hex(a.q * k, a.r * k);

/** Stable string key, handy for Map/Set lookups. */
export const hexKey = (h: Hex): string => `${h.q},${h.r}`;

export const parseHexKey = (key: string): Hex => {
  const [q, r] = key.split(',').map(Number);
  if (q === undefined || r === undefined || Number.isNaN(q) || Number.isNaN(r)) {
    throw new Error(`Invalid hex key: ${key}`);
  }
  return hex(q, r);
};

/**
 * The six neighbour directions, clockwise starting from east.
 * Index order matters: direction i and (i + 3) % 6 are opposites.
 */
export const HEX_DIRECTIONS: readonly Hex[] = [
  hex(1, 0), // E
  hex(1, -1), // NE
  hex(0, -1), // NW
  hex(-1, 0), // W
  hex(-1, 1), // SW
  hex(0, 1), // SE
];

export const hexDirection = (dir: number): Hex => HEX_DIRECTIONS[((dir % 6) + 6) % 6]!;

export const hexNeighbor = (h: Hex, dir: number): Hex => hexAdd(h, hexDirection(dir));

export const hexNeighbors = (h: Hex): Hex[] => HEX_DIRECTIONS.map((d) => hexAdd(h, d));

export const hexLength = (h: Hex): number =>
  (Math.abs(h.q) + Math.abs(h.r) + Math.abs(hexS(h))) / 2;

/** Number of steps between two hexes. */
export const hexDistance = (a: Hex, b: Hex): number => hexLength(hexSub(a, b));

/** Round fractional axial coordinates to the nearest hex. */
export const hexRound = (q: number, r: number): Hex => {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  // Normalise -0 to 0 so keys and equality behave.
  return hex(rq + 0, rr + 0);
};

/** All hexes exactly `radius` steps from `center` (radius 0 → just the center). */
export const hexRing = (center: Hex, radius: number): Hex[] => {
  if (radius === 0) return [center];
  const results: Hex[] = [];
  // Start at the hex `radius` steps in direction 4 (SW), then walk each side.
  let current = hexAdd(center, hexScale(hexDirection(4), radius));
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push(current);
      current = hexNeighbor(current, side);
    }
  }
  return results;
};

/** All hexes within `radius` steps of `center`, ordered from the center outwards. */
export const hexSpiral = (center: Hex, radius: number): Hex[] => {
  const results: Hex[] = [];
  for (let k = 0; k <= radius; k++) results.push(...hexRing(center, k));
  return results;
};

/**
 * Hexes on the straight line from `a` to `b`, inclusive.
 * A tiny epsilon nudge keeps the line from landing exactly on hex edges.
 */
export const hexLine = (a: Hex, b: Hex): Hex[] => {
  const n = hexDistance(a, b);
  if (n === 0) return [a];
  const eps = 1e-6;
  const aq = a.q + eps;
  const ar = a.r + eps;
  const bq = b.q + eps;
  const br = b.r + eps;
  const results: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    results.push(hexRound(aq + (bq - aq) * t, ar + (br - ar) * t));
  }
  return results;
};
