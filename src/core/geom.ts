/**
 * Continuous 2D geometry in world pixels. Only + − × ÷ and Math.sqrt, so results are
 * bit-identical on every JS engine (spec §8.12).
 */
export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned bounds, inclusive min / exclusive max. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });

export const distanceSq = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const distance = (a: Vec2, b: Vec2): number => Math.sqrt(distanceSq(a, b));
