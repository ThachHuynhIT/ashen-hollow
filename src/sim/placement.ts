import type { BuildingDef } from '../data/buildings';
import { TERRAIN_CELL, type TerrainGrid } from './map/TerrainGrid';
import { terrainAt } from '../data/terrain';
import { circleShape, moveShape, rectShape, shapeBounds, shapesOverlap, type Shape } from './geom';

/** Optional placement snap (hold Shift). */
export const SNAP_STEP = 8;
/** Edges closer than this to a neighbour's edge get pulled flush ("magnet"). */
export const MAGNET_DISTANCE = 6;

export const snapToGrid = (value: number, step = SNAP_STEP): number =>
  Math.round(value / step) * step;

export const footprintShape = (def: BuildingDef, cx: number, cy: number): Shape =>
  def.footprint.kind === 'rect'
    ? rectShape(cx, cy, def.footprint.w, def.footprint.h)
    : circleShape(cx, cy, def.footprint.r);

/**
 * Snap a rect footprint flush against nearby rect neighbours: if one of its edges is
 * within `distance` of a neighbour's opposite edge (and they overlap on the other
 * axis), slide it to touch. Also aligns tops/bottoms or lefts/rights that are nearly
 * level, so rows of buildings line up without a visible grid.
 */
export const magnetSnap = (
  shape: Shape,
  neighbours: readonly Shape[],
  distance = MAGNET_DISTANCE,
): Shape => {
  if (shape.kind !== 'rect') return shape;
  const a = shapeBounds(shape);

  /** Smallest-magnitude offset within the magnet distance, or null. */
  const closest = (offsets: number[]): number | null => {
    let best: number | null = null;
    for (const d of offsets) {
      if (Math.abs(d) <= distance && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
    return best;
  };

  const contactX: number[] = [];
  const contactY: number[] = [];
  const alignX: number[] = [];
  const alignY: number[] = [];
  for (const n of neighbours) {
    if (n.kind !== 'rect') continue;
    const b = shapeBounds(n);
    const nearY = a.minY < b.maxY + distance && a.maxY > b.minY - distance;
    const nearX = a.minX < b.maxX + distance && a.maxX > b.minX - distance;
    if (nearY) {
      // Contact: my left to their right, or my right to their left.
      contactX.push(b.maxX - a.minX, b.minX - a.maxX);
      // Alignment: tops or bottoms level with a side-by-side neighbour.
      alignY.push(b.minY - a.minY, b.maxY - a.maxY);
    }
    if (nearX) {
      contactY.push(b.maxY - a.minY, b.minY - a.maxY);
      alignX.push(b.minX - a.minX, b.maxX - a.maxX);
    }
  }

  // Contact wins over alignment on each axis; an already-level edge (offset 0) is
  // "no change", not a reason to ignore a nearby contact on the same axis.
  const dx = closest(contactX) ?? closest(alignX.filter((d) => d !== 0)) ?? 0;
  const dy = closest(contactY) ?? closest(alignY.filter((d) => d !== 0)) ?? 0;
  return moveShape(shape, shape.cx + dx, shape.cy + dy);
};

export type PlacementProblem = 'outOfBounds' | 'terrain' | 'building' | 'doodad';

export interface Obstacle {
  shape: Shape;
  type: 'building' | 'doodad';
}

export interface PlacementResult {
  ok: boolean;
  reason: PlacementProblem | null;
}

/**
 * Is `shape` a legal place to build? Checks map bounds, that every terrain cell under
 * the footprint is buildable, and that it doesn't overlap any obstacle.
 */
export const validatePlacement = (
  shape: Shape,
  terrain: TerrainGrid,
  obstacles: readonly Obstacle[],
): PlacementResult => {
  const b = shapeBounds(shape);
  if (b.minX < 0 || b.minY < 0 || b.maxX > terrain.widthPx || b.maxY > terrain.heightPx) {
    return { ok: false, reason: 'outOfBounds' };
  }
  const x0 = Math.floor(b.minX / TERRAIN_CELL);
  const y0 = Math.floor(b.minY / TERRAIN_CELL);
  const x1 = Math.floor((b.maxX - 1e-6) / TERRAIN_CELL);
  const y1 = Math.floor((b.maxY - 1e-6) / TERRAIN_CELL);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const cell = rectShape(
        (cx + 0.5) * TERRAIN_CELL,
        (cy + 0.5) * TERRAIN_CELL,
        TERRAIN_CELL,
        TERRAIN_CELL,
      );
      if (shapesOverlap(shape, cell) && !terrainAt(terrain.get(cx, cy)).buildable) {
        return { ok: false, reason: 'terrain' };
      }
    }
  }
  for (const o of obstacles) {
    if (shapesOverlap(shape, o.shape)) return { ok: false, reason: o.type };
  }
  return { ok: true, reason: null };
};
