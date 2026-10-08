import type { Vec2 } from '../geom';
import { NAV_CELL, type NavGrid } from './NavGrid';

/**
 * True if a straight walk from a to b only crosses walkable cells.
 * Supercover traversal (Amanatides & Woo): visits every cell the segment touches, and
 * when it passes exactly through a corner both side cells must be walkable.
 */
export const lineWalkable = (nav: NavGrid, a: Vec2, b: Vec2): boolean => {
  let cx = Math.floor(a.x / NAV_CELL);
  let cy = Math.floor(a.y / NAV_CELL);
  const ex = Math.floor(b.x / NAV_CELL);
  const ey = Math.floor(b.y / NAV_CELL);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const tDeltaX = stepX !== 0 ? NAV_CELL / Math.abs(dx) : Infinity;
  const tDeltaY = stepY !== 0 ? NAV_CELL / Math.abs(dy) : Infinity;
  const nextBoundX = stepX > 0 ? (cx + 1) * NAV_CELL : cx * NAV_CELL;
  const nextBoundY = stepY > 0 ? (cy + 1) * NAV_CELL : cy * NAV_CELL;
  let tMaxX = stepX !== 0 ? (nextBoundX - a.x) / dx : Infinity;
  let tMaxY = stepY !== 0 ? (nextBoundY - a.y) / dy : Infinity;

  if (!nav.walkable(cx, cy)) return false;
  // Walk boundary crossings strictly inside the segment (t < 1). A crossing exactly at
  // t = 1 means the segment ends on a cell edge/corner, so stepping would overshoot.
  while (Math.min(tMaxX, tMaxY) < 1 - 1e-9) {
    if (Math.abs(tMaxX - tMaxY) < 1e-9) {
      // Passing through a corner: don't squeeze between two diagonal blockers.
      if (!nav.walkable(cx + stepX, cy) || !nav.walkable(cx, cy + stepY)) return false;
      cx += stepX;
      cy += stepY;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    } else if (tMaxX < tMaxY) {
      cx += stepX;
      tMaxX += tDeltaX;
    } else {
      cy += stepY;
      tMaxY += tDeltaY;
    }
    if (!nav.walkable(cx, cy)) return false;
  }
  return nav.walkable(ex, ey);
};

/**
 * String-pulling: drop intermediate waypoints whenever a straight line already works.
 * Turns a staircase grid path into a few clean segments for free movement.
 * The exact start/goal points replace the first/last cell centres.
 */
export const smoothPath = (nav: NavGrid, path: Vec2[], from: Vec2, to: Vec2): Vec2[] => {
  if (path.length === 0) return [];
  const points = [from, ...path.slice(1, -1), to];
  const out: Vec2[] = [from];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let next = points.length - 1;
    while (next > anchor + 1 && !lineWalkable(nav, points[anchor]!, points[next]!)) next--;
    out.push(points[next]!);
    anchor = next;
  }
  return out;
};
