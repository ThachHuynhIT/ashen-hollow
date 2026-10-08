import { describe, expect, it } from 'vitest';
import { Rng } from '../random';
import { poissonDisk } from './poisson';

describe('poissonDisk', () => {
  const sample = (seed: number) => poissonDisk(new Rng(seed), 200, 120, 10);

  it('never places two points closer than the minimum distance', () => {
    const pts = sample(1);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y)).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('stays inside the area', () => {
    for (const p of sample(2)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(200);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(120);
    }
  });

  it('fills the area densely (not just a few points)', () => {
    // Max packing of 10 px disks in 200×120 is ~277; Bridson typically reaches 65–75% of that.
    expect(sample(3).length).toBeGreaterThan(150);
  });

  it('is deterministic for a seed', () => {
    expect(sample(4)).toEqual(sample(4));
    expect(sample(4)).not.toEqual(sample(5));
  });
});
