import { describe, expect, it } from 'vitest';
import { SpatialHash } from './SpatialHash';

const box = (x: number, y: number, w: number, h: number) => ({
  minX: x,
  minY: y,
  maxX: x + w,
  maxY: y + h,
});

describe('SpatialHash', () => {
  it('finds items whose bounds overlap the query, across bucket borders', () => {
    const hash = new SpatialHash(64);
    hash.insert(1, box(60, 60, 10, 10)); // straddles four buckets
    hash.insert(2, box(200, 200, 5, 5));
    expect(hash.query(box(66, 66, 2, 2))).toEqual([1]);
    expect(hash.query(box(0, 0, 50, 50))).toEqual([]);
    expect(hash.queryCircle(202, 202, 1)).toEqual([2]);
  });

  it('returns each id once even when it spans several buckets', () => {
    const hash = new SpatialHash(16);
    hash.insert(7, box(0, 0, 100, 100));
    expect(hash.query(box(0, 0, 100, 100))).toEqual([7]);
  });

  it('forgets removed items', () => {
    const hash = new SpatialHash(64);
    hash.insert(1, box(0, 0, 10, 10));
    hash.remove(1);
    expect(hash.query(box(0, 0, 10, 10))).toEqual([]);
    expect(hash.size).toBe(0);
  });

  it('re-inserting an id moves it instead of duplicating it', () => {
    const hash = new SpatialHash(64);
    hash.insert(1, box(0, 0, 10, 10));
    hash.insert(1, box(500, 500, 10, 10));
    expect(hash.query(box(0, 0, 10, 10))).toEqual([]);
    expect(hash.query(box(500, 500, 10, 10))).toEqual([1]);
    expect(hash.size).toBe(1);
  });

  it('handles negative coordinates', () => {
    const hash = new SpatialHash(64);
    hash.insert(3, box(-100, -40, 10, 10));
    expect(hash.query(box(-95, -35, 1, 1))).toEqual([3]);
  });
});
