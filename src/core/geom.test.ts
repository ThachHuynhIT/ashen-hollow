import { describe, expect, it } from 'vitest';
import { distance, distanceSq, vec } from './geom';

describe('geom', () => {
  it('builds vectors', () => {
    expect(vec(3, -4)).toEqual({ x: 3, y: -4 });
  });

  it('measures squared and plain distance', () => {
    expect(distanceSq(vec(0, 0), vec(3, 4))).toBe(25);
    expect(distance(vec(0, 0), vec(3, 4))).toBe(5);
    expect(distance(vec(-1, -1), vec(-1, -1))).toBe(0);
  });

  it('is symmetric', () => {
    expect(distance(vec(2, 7), vec(-5, 1))).toBe(distance(vec(-5, 1), vec(2, 7)));
  });
});
