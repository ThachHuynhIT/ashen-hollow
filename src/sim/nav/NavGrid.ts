import { terrainAt } from '../../data/terrain';
import { shapeBounds, shapesOverlap, rectShape, type Shape } from '../geom';
import type { TerrainGrid } from '../map/TerrainGrid';

export const NAV_CELL = 8;

/**
 * Hidden 8 px navigation grid. Never shown to the player (except the F3 debug view);
 * it exists so free-moving units can path-find around terrain, doodads and buildings.
 *
 * Blockers are reference-counted so overlapping obstacles can be added and removed in
 * any order (chop a tree under a wall and the wall still blocks).
 */
export class NavGrid {
  readonly width: number;
  readonly height: number;
  /** 1 if the ground itself is passable. */
  private readonly ground: Uint8Array;
  /** Walk-speed multiplier from terrain. */
  readonly speed: Float32Array;
  /** Number of obstacles covering each cell. */
  private readonly blockers: Uint16Array;

  constructor(terrain: TerrainGrid) {
    const ratio = terrain.widthPx / NAV_CELL / terrain.width;
    this.width = terrain.width * ratio;
    this.height = terrain.height * ratio;
    const n = this.width * this.height;
    this.ground = new Uint8Array(n);
    this.speed = new Float32Array(n);
    this.blockers = new Uint16Array(n);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = terrainAt(terrain.get(Math.floor(x / ratio), Math.floor(y / ratio)));
        const i = y * this.width + x;
        this.ground[i] = t.passable ? 1 : 0;
        this.speed[i] = t.passable ? t.speed : 0;
      }
    }
  }

  inBounds(cx: number, cy: number): boolean {
    return cx >= 0 && cy >= 0 && cx < this.width && cy < this.height;
  }

  walkable(cx: number, cy: number): boolean {
    if (!this.inBounds(cx, cy)) return false;
    const i = cy * this.width + cx;
    return this.ground[i] === 1 && this.blockers[i] === 0;
  }

  /** Cost to enter a cell (inverse of terrain speed); Infinity when blocked. */
  cost(cx: number, cy: number): number {
    if (!this.walkable(cx, cy)) return Infinity;
    return 1 / this.speed[cy * this.width + cx]!;
  }

  blockerCount(cx: number, cy: number): number {
    return this.inBounds(cx, cy) ? this.blockers[cy * this.width + cx]! : 0;
  }

  cellOf(x: number, y: number): { cx: number; cy: number } {
    return { cx: Math.floor(x / NAV_CELL), cy: Math.floor(y / NAV_CELL) };
  }

  cellCenter(cx: number, cy: number): { x: number; y: number } {
    return { x: (cx + 0.5) * NAV_CELL, y: (cy + 0.5) * NAV_CELL };
  }

  /** Is the ground itself passable (ignoring obstacles)? */
  groundPassable(cx: number, cy: number): boolean {
    return this.inBounds(cx, cy) && this.ground[cy * this.width + cx] === 1;
  }

  /** Flat indices (cy·width + cx) of every cell the shape strictly overlaps. */
  cellsUnder(shape: Shape): number[] {
    const b = shapeBounds(shape);
    const x0 = Math.max(0, Math.floor(b.minX / NAV_CELL));
    const y0 = Math.max(0, Math.floor(b.minY / NAV_CELL));
    const x1 = Math.min(this.width - 1, Math.floor((b.maxX - 1e-6) / NAV_CELL));
    const y1 = Math.min(this.height - 1, Math.floor((b.maxY - 1e-6) / NAV_CELL));
    const cells: number[] = [];
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = rectShape((cx + 0.5) * NAV_CELL, (cy + 0.5) * NAV_CELL, NAV_CELL, NAV_CELL);
        if (shapesOverlap(shape, cell)) cells.push(cy * this.width + cx);
      }
    }
    return cells;
  }

  /** Add (+1) or remove (−1) an obstacle covering every cell the shape overlaps. */
  private stamp(shape: Shape, delta: 1 | -1): void {
    for (const i of this.cellsUnder(shape)) {
      this.blockers[i] = Math.max(0, this.blockers[i]! + delta);
    }
  }

  block(shape: Shape): void {
    this.stamp(shape, 1);
  }

  unblock(shape: Shape): void {
    this.stamp(shape, -1);
  }
}
