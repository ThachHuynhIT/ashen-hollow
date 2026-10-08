import type { Vec2 } from '../geom';
import { findPath } from '../nav/astar';
import type { NavGrid } from '../nav/NavGrid';
import { smoothPath } from '../nav/smooth';

/** Path-finding seam: synchronous now, swappable for a Web Worker later. */
export interface PathService {
  /** Smoothed waypoints from `from` to `to` (both included), or null if unreachable. */
  find(from: Vec2, to: Vec2): Vec2[] | null;
}

export class SyncPathService implements PathService {
  constructor(private readonly nav: NavGrid) {}

  find(from: Vec2, to: Vec2): Vec2[] | null {
    const raw = findPath(this.nav, from, to);
    return raw ? smoothPath(this.nav, raw, from, to) : null;
  }
}
