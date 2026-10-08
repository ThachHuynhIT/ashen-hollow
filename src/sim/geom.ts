/**
 * Continuous 2D geometry in world pixels. Everything in the world lives at float
 * coordinates; grids (terrain 16 px, nav 8 px) are only acceleration structures.
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

/** A footprint/collider shape centred on (cx, cy). Rects are axis-aligned (no rotation). */
export type Shape =
  | { kind: 'rect'; cx: number; cy: number; hw: number; hh: number }
  | { kind: 'circle'; cx: number; cy: number; r: number };

export const vec = (x: number, y: number): Vec2 => ({ x, y });

export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export const distanceSq = (a: Vec2, b: Vec2): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export const rectShape = (cx: number, cy: number, w: number, h: number): Shape => ({
  kind: 'rect',
  cx,
  cy,
  hw: w / 2,
  hh: h / 2,
});

export const circleShape = (cx: number, cy: number, r: number): Shape => ({
  kind: 'circle',
  cx,
  cy,
  r,
});

export const moveShape = (s: Shape, cx: number, cy: number): Shape => ({ ...s, cx, cy });

export const shapeBounds = (s: Shape): Bounds =>
  s.kind === 'rect'
    ? { minX: s.cx - s.hw, minY: s.cy - s.hh, maxX: s.cx + s.hw, maxY: s.cy + s.hh }
    : { minX: s.cx - s.r, minY: s.cy - s.r, maxX: s.cx + s.r, maxY: s.cy + s.r };

/** Lowest point of the shape: where a sprite standing on it touches the ground. */
export const shapeBottom = (s: Shape): number => (s.kind === 'rect' ? s.cy + s.hh : s.cy + s.r);

export const boundsOverlap = (a: Bounds, b: Bounds): boolean =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Strict overlap test (touching edges do not count as overlap). */
export const shapesOverlap = (a: Shape, b: Shape): boolean => {
  if (a.kind === 'rect' && b.kind === 'rect') return boundsOverlap(shapeBounds(a), shapeBounds(b));
  if (a.kind === 'circle' && b.kind === 'circle') {
    const r = a.r + b.r;
    return (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2 < r * r;
  }
  const circle = a.kind === 'circle' ? a : (b as Extract<Shape, { kind: 'circle' }>);
  const rect = a.kind === 'rect' ? a : (b as Extract<Shape, { kind: 'rect' }>);
  const nx = clamp(circle.cx, rect.cx - rect.hw, rect.cx + rect.hw);
  const ny = clamp(circle.cy, rect.cy - rect.hh, rect.cy + rect.hh);
  return (circle.cx - nx) ** 2 + (circle.cy - ny) ** 2 < circle.r * circle.r;
};

/** Does the shape contain the point? */
export const shapeContains = (s: Shape, x: number, y: number): boolean =>
  s.kind === 'rect'
    ? Math.abs(x - s.cx) <= s.hw && Math.abs(y - s.cy) <= s.hh
    : (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r * s.r;

/** Grow a shape by `margin` on every side. */
export const inflateShape = (s: Shape, margin: number): Shape =>
  s.kind === 'rect' ? { ...s, hw: s.hw + margin, hh: s.hh + margin } : { ...s, r: s.r + margin };
