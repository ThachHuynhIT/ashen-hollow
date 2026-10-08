import type { Vec2 } from '../geom';
import type { NavGrid } from './NavGrid';

const SQRT2 = Math.SQRT2;
const DIRS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

/** Minimal binary min-heap of cell indices keyed by a numeric priority. */
export class MinHeap {
  private items: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, key: number): void {
    this.items.push(item);
    this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p]! <= this.keys[i]!) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.items[0]!;
    const lastItem = this.items.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.keys[l]! < this.keys[m]!) m = l;
        if (r < this.items.length && this.keys[r]! < this.keys[m]!) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b]!, this.items[a]!];
    [this.keys[a], this.keys[b]] = [this.keys[b]!, this.keys[a]!];
  }
}

export interface PathOptions {
  /** Safety cap on expanded nodes. */
  maxExpanded?: number;
}

/**
 * 8-directional A* on the nav grid, weighted by terrain cost. Diagonal moves are only
 * allowed when both adjacent orthogonal cells are walkable (no corner cutting).
 * Returns cell-centre waypoints from start to goal (inclusive), or null if unreachable.
 */
export const findPath = (
  nav: NavGrid,
  from: Vec2,
  to: Vec2,
  { maxExpanded = 60_000 }: PathOptions = {},
): Vec2[] | null => {
  const s = nav.cellOf(from.x, from.y);
  const g = nav.cellOf(to.x, to.y);
  if (!nav.walkable(s.cx, s.cy) || !nav.walkable(g.cx, g.cy)) return null;

  const w = nav.width;
  const start = s.cy * w + s.cx;
  const goal = g.cy * w + g.cx;
  if (start === goal) return [nav.cellCenter(s.cx, s.cy)];

  const n = w * nav.height;
  const gScore = new Float64Array(n).fill(Infinity);
  const cameFrom = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  // Cheapest possible step cost keeps the heuristic admissible on fast terrain.
  const minCost = 1 / 1.3;
  const h = (cx: number, cy: number): number => {
    const dx = Math.abs(cx - g.cx);
    const dy = Math.abs(cy - g.cy);
    return (dx + dy + (SQRT2 - 2) * Math.min(dx, dy)) * minCost;
  };

  const open = new MinHeap();
  gScore[start] = 0;
  open.push(start, h(s.cx, s.cy));
  let expanded = 0;

  while (open.size > 0) {
    const current = open.pop();
    if (current === goal) break;
    if (closed[current]) continue;
    closed[current] = 1;
    if (++expanded > maxExpanded) return null;

    const cx = current % w;
    const cy = (current - cx) / w;
    for (const [dx, dy, len] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!nav.walkable(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!nav.walkable(cx + dx, cy) || !nav.walkable(cx, cy + dy))) {
        continue;
      }
      const ni = ny * w + nx;
      if (closed[ni]) continue;
      const tentative = gScore[current]! + len * nav.cost(nx, ny);
      if (tentative < gScore[ni]!) {
        gScore[ni] = tentative;
        cameFrom[ni] = current;
        open.push(ni, tentative + h(nx, ny));
      }
    }
  }

  if (cameFrom[goal] === -1) return null;
  const path: Vec2[] = [];
  for (let c = goal; c !== -1; c = cameFrom[c]!) {
    const cx = c % w;
    path.push(nav.cellCenter(cx, (c - cx) / w));
    if (c === start) break;
  }
  return path.reverse();
};
