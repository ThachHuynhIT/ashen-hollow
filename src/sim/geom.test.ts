import { describe, expect, it } from 'vitest';
import {
  circleShape,
  inflateShape,
  rectShape,
  shapeBottom,
  shapeContains,
  shapesOverlap,
} from './geom';

describe('shapesOverlap', () => {
  it('rects that only touch edges do not overlap (buildings may sit flush)', () => {
    // [0,10]×[0,10] and [10,20]×[0,10]
    expect(shapesOverlap(rectShape(5, 5, 10, 10), rectShape(15, 5, 10, 10))).toBe(false);
  });

  it('rects sharing area overlap', () => {
    expect(shapesOverlap(rectShape(5, 5, 10, 10), rectShape(14, 5, 10, 10))).toBe(true);
  });

  it('circles overlap only when centres are closer than the radius sum', () => {
    expect(shapesOverlap(circleShape(0, 0, 5), circleShape(9, 0, 5))).toBe(true);
    expect(shapesOverlap(circleShape(0, 0, 5), circleShape(10, 0, 5))).toBe(false);
  });

  it('circle near a rect corner uses the true corner distance, not the AABB', () => {
    // Rect [0,10]×[0,10]; circle r=3 at (12,12): corner distance √8 ≈ 2.83 < 3 → overlap
    expect(shapesOverlap(rectShape(5, 5, 10, 10), circleShape(12, 12, 3))).toBe(true);
    // At (13,13): distance √18 ≈ 4.24 > 3 → AABBs overlap but shapes don't
    expect(shapesOverlap(rectShape(5, 5, 10, 10), circleShape(13, 13, 3))).toBe(false);
    // Order of arguments doesn't matter.
    expect(shapesOverlap(circleShape(13, 13, 3), rectShape(5, 5, 10, 10))).toBe(false);
  });
});

describe('shape helpers', () => {
  it('bottom is where a sprite stands', () => {
    expect(shapeBottom(rectShape(10, 20, 8, 6))).toBe(23);
    expect(shapeBottom(circleShape(10, 20, 4))).toBe(24);
  });

  it('contains points on the inside only', () => {
    expect(shapeContains(rectShape(0, 0, 10, 10), 4, -4)).toBe(true);
    expect(shapeContains(rectShape(0, 0, 10, 10), 6, 0)).toBe(false);
    expect(shapeContains(circleShape(0, 0, 5), 3, 4)).toBe(true);
    expect(shapeContains(circleShape(0, 0, 5), 4, 4)).toBe(false);
  });

  it('inflate grows every side', () => {
    expect(inflateShape(rectShape(0, 0, 10, 4), 2)).toEqual({
      kind: 'rect',
      cx: 0,
      cy: 0,
      hw: 7,
      hh: 4,
    });
    expect(inflateShape(circleShape(1, 2, 3), 1)).toEqual({ kind: 'circle', cx: 1, cy: 2, r: 4 });
  });
});
