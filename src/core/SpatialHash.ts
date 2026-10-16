import type { Bounds } from './geom';

/**
 * Uniform-grid spatial hash over world bounds. Stores numeric ids (entity ids) with an
 * AABB; queries return candidate ids whose AABB overlaps — callers do exact tests.
 */
export class SpatialHash {
  private readonly buckets = new Map<number, Set<number>>();
  private readonly itemCells = new Map<number, number[]>();
  private readonly itemBounds = new Map<number, Bounds>();

  constructor(readonly cellSize = 64) {}

  get size(): number {
    return this.itemCells.size;
  }

  private key(cx: number, cy: number): number {
    // Pack two signed 16-bit cell coords into one number key.
    return ((cx + 32768) << 16) | (cy + 32768);
  }

  private cellsFor(b: Bounds): number[] {
    const s = this.cellSize;
    const x0 = Math.floor(b.minX / s);
    const y0 = Math.floor(b.minY / s);
    const x1 = Math.floor((b.maxX - 1e-6) / s);
    const y1 = Math.floor((b.maxY - 1e-6) / s);
    const keys: number[] = [];
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) keys.push(this.key(cx, cy));
    }
    return keys;
  }

  insert(id: number, bounds: Bounds): void {
    if (this.itemCells.has(id)) this.remove(id);
    const cells = this.cellsFor(bounds);
    for (const k of cells) {
      let bucket = this.buckets.get(k);
      if (!bucket) {
        bucket = new Set();
        this.buckets.set(k, bucket);
      }
      bucket.add(id);
    }
    this.itemCells.set(id, cells);
    this.itemBounds.set(id, bounds);
  }

  remove(id: number): void {
    const cells = this.itemCells.get(id);
    if (!cells) return;
    for (const k of cells) {
      const bucket = this.buckets.get(k);
      bucket?.delete(id);
      if (bucket && bucket.size === 0) this.buckets.delete(k);
    }
    this.itemCells.delete(id);
    this.itemBounds.delete(id);
  }

  boundsOf(id: number): Bounds | undefined {
    return this.itemBounds.get(id);
  }

  /** Ids whose AABB overlaps `area`. */
  query(area: Bounds): number[] {
    const out = new Set<number>();
    for (const k of this.cellsFor(area)) {
      const bucket = this.buckets.get(k);
      if (!bucket) continue;
      for (const id of bucket) {
        const b = this.itemBounds.get(id)!;
        if (b.minX < area.maxX && b.maxX > area.minX && b.minY < area.maxY && b.maxY > area.minY) {
          out.add(id);
        }
      }
    }
    return [...out];
  }

  queryCircle(x: number, y: number, r: number): number[] {
    return this.query({ minX: x - r, minY: y - r, maxX: x + r, maxY: y + r });
  }
}
