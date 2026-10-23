import { describe, expect, it } from 'vitest';
import { pixelCircle } from './pixelCircle';

describe('pixelCircle', () => {
  it('returns only the origin for a radius rounded to zero', () => {
    expect(pixelCircle(0)).toEqual([{ x: 0, y: 0 }]);
    expect(pixelCircle(0.4)).toEqual([{ x: 0, y: 0 }]);
  });

  it('returns the four cardinal neighbours for radius one', () => {
    expect(pixelCircle(1)).toEqual([
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

  it.each([-1, -0.1, NaN, Infinity, -Infinity])('rejects invalid radius %s', (radius) => {
    expect(pixelCircle(radius)).toEqual([]);
  });

  it('rounds fractional radii for rasterization', () => {
    expect(pixelCircle(2.4)).toEqual(pixelCircle(2));
    expect(pixelCircle(2.5)).toEqual(pixelCircle(3));
  });

  it('returns a dense, unique, integer contour with eightfold symmetry', () => {
    const points = pixelCircle(64);
    const keys = new Set(points.map(({ x, y }) => `${x},${y}`));
    expect(keys.size).toBe(points.length);
    expect(points.length).toBeGreaterThanOrEqual(2 * Math.PI * 64 * 0.7);
    expect(keys.has('0,0')).toBe(false);
    for (const { x, y } of points) {
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
      expect(Math.abs(Math.sqrt(x * x + y * y) - 64)).toBeLessThanOrEqual(1);
      for (const [a, b] of [[x, y], [y, x]]) {
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            expect(keys.has(`${a! * sx},${b! * sy}`)).toBe(true);
          }
        }
      }
    }
    expect(points).toEqual([...points].sort((a, b) => a.y - b.y || a.x - b.x));
    expect(pixelCircle(64)).toEqual(points);
  });
});
