import { COLONIST_RADIUS, MOVEMENT } from '../../data/colonists';
import type { GameWorld } from '../GameWorld';
import { inflateShape, shapeBounds, shapeContains, type Shape, type Vec2 } from '../geom';
import { NAV_CELL } from '../nav/NavGrid';

/**
 * Where to stand to work on `target`: the walkable nav-cell centre nearest to `from`
 * that is outside the target (plus a colonist's radius). Searched ring by ring up to
 * MOVEMENT.approachRings cells out; null if nothing is free.
 */
export const approachPoint = (world: GameWorld, target: Shape, from: Vec2): Vec2 | null => {
  const { nav } = world;
  const keepOut = inflateShape(target, COLONIST_RADIUS);
  for (let ring = 1; ring <= MOVEMENT.approachRings; ring++) {
    const area = shapeBounds(inflateShape(target, ring * NAV_CELL));
    const x0 = Math.max(0, Math.floor(area.minX / NAV_CELL));
    const y0 = Math.max(0, Math.floor(area.minY / NAV_CELL));
    const x1 = Math.min(nav.width - 1, Math.floor(area.maxX / NAV_CELL));
    const y1 = Math.min(nav.height - 1, Math.floor(area.maxY / NAV_CELL));
    let best: Vec2 | null = null;
    let bestDist = Infinity;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!nav.walkable(cx, cy)) continue;
        const c = nav.cellCenter(cx, cy);
        if (shapeContains(keepOut, c.x, c.y)) continue;
        const d = (c.x - from.x) ** 2 + (c.y - from.y) ** 2;
        if (d < bestDist) {
          best = c;
          bestDist = d;
        }
      }
    }
    if (best) return best;
  }
  return null;
};
