import type { Vec2 } from '../geom';
import type { Rng } from '../random';

/**
 * Bridson's Poisson-disk sampling: evenly spread random points with a minimum spacing.
 * Natural-looking placement for trees and rocks — no clumps, no grid.
 */
export const poissonDisk = (
  rng: Rng,
  width: number,
  height: number,
  minDist: number,
  attempts = 20,
): Vec2[] => {
  const cell = minDist / Math.SQRT2;
  const gw = Math.ceil(width / cell);
  const gh = Math.ceil(height / cell);
  const grid = new Int32Array(gw * gh).fill(-1);
  const points: Vec2[] = [];
  const active: number[] = [];

  const add = (p: Vec2) => {
    const idx = points.length;
    points.push(p);
    active.push(idx);
    grid[Math.floor(p.y / cell) * gw + Math.floor(p.x / cell)] = idx;
  };

  const fits = (p: Vec2): boolean => {
    if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) return false;
    const gx = Math.floor(p.x / cell);
    const gy = Math.floor(p.y / cell);
    for (let y = Math.max(0, gy - 2); y <= Math.min(gh - 1, gy + 2); y++) {
      for (let x = Math.max(0, gx - 2); x <= Math.min(gw - 1, gx + 2); x++) {
        const i = grid[y * gw + x]!;
        if (i < 0) continue;
        const q = points[i]!;
        if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < minDist * minDist) return false;
      }
    }
    return true;
  };

  add({ x: rng.next() * width, y: rng.next() * height });
  while (active.length > 0) {
    const ai = Math.floor(rng.next() * active.length);
    const origin = points[active[ai]!]!;
    let placed = false;
    for (let k = 0; k < attempts; k++) {
      const angle = rng.next() * Math.PI * 2;
      const radius = minDist * (1 + rng.next());
      const p = { x: origin.x + Math.cos(angle) * radius, y: origin.y + Math.sin(angle) * radius };
      if (fits(p)) {
        add(p);
        placed = true;
        break;
      }
    }
    if (!placed) {
      active[ai] = active[active.length - 1]!;
      active.pop();
    }
  }
  return points;
};
