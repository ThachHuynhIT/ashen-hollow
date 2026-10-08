import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../data/buildings';
import { circleShape, rectShape, shapeBounds } from './geom';
import { footprintShape, magnetSnap, snapToGrid, validatePlacement } from './placement';
import { openTerrain, terrainFromAscii } from './testing/terrainFixture';

describe('snapToGrid', () => {
  it('rounds to the nearest 8 px by default', () => {
    expect([snapToGrid(3), snapToGrid(4), snapToGrid(13), snapToGrid(-5)]).toEqual([0, 8, 16, -8]);
  });
});

describe('footprintShape', () => {
  it('uses the building footprint size around the given centre', () => {
    expect(shapeBounds(footprintShape(BUILDINGS.tent, 100, 50))).toEqual({
      minX: 88,
      minY: 43,
      maxX: 112,
      maxY: 57,
    });
  });
});

describe('magnetSnap', () => {
  const neighbour = rectShape(50, 50, 20, 20); // [40,60]×[40,60]

  it('pulls an edge flush when within the magnet distance', () => {
    // Candidate [64,84]×[40,60]: 4 px gap to the neighbour's right edge.
    const snapped = magnetSnap(rectShape(74, 50, 20, 20), [neighbour]);
    expect(shapeBounds(snapped).minX).toBe(60);
  });

  it('leaves it alone when farther than the magnet distance', () => {
    const snapped = magnetSnap(rectShape(80, 50, 20, 20), [neighbour]); // 10 px gap
    expect(snapped).toEqual(rectShape(80, 50, 20, 20));
  });

  it('also lines up tops that are almost level', () => {
    // Flush horizontally after snap, top is 3 px lower than the neighbour's.
    const snapped = magnetSnap(rectShape(72, 53, 20, 20), [neighbour]);
    expect(shapeBounds(snapped)).toEqual({ minX: 60, minY: 40, maxX: 80, maxY: 60 });
  });

  it('fills an inner corner: snaps flush to a neighbour on each axis', () => {
    // Ghost [20,40]²; A to the right with a 5 px gap, B below with a 5 px gap.
    // Already-level edges (A's top, B's left) must not cancel the contact snaps.
    const a = rectShape(55, 30, 20, 20); // [45,65]×[20,40]
    const b = rectShape(30, 55, 20, 20); // [20,40]×[45,65]
    expect(shapeBounds(magnetSnap(rectShape(30, 30, 20, 20), [a, b]))).toEqual({
      minX: 25,
      minY: 25,
      maxX: 45,
      maxY: 45,
    });
  });

  it('ignores circular footprints', () => {
    const c = circleShape(70, 50, 5);
    expect(magnetSnap(c, [neighbour])).toBe(c);
  });
});

describe('validatePlacement', () => {
  const terrain = terrainFromAscii([
    '....', //
    '..~.',
    '....',
  ]);

  it('accepts open buildable ground', () => {
    expect(validatePlacement(rectShape(16, 8, 16, 8), terrain, [])).toEqual({
      ok: true,
      reason: null,
    });
  });

  it('rejects footprints touching unbuildable terrain', () => {
    // Water cell spans [32,48]×[16,32].
    expect(validatePlacement(rectShape(30, 20, 8, 8), terrain, []).reason).toBe('terrain');
  });

  it('rejects footprints sticking out of the map', () => {
    expect(validatePlacement(rectShape(2, 8, 8, 8), terrain, []).reason).toBe('outOfBounds');
  });

  it('reports which kind of obstacle is in the way', () => {
    const grass = openTerrain(8, 8);
    const shape = rectShape(40, 40, 16, 16);
    expect(
      validatePlacement(shape, grass, [{ shape: circleShape(46, 46, 4), type: 'doodad' }]).reason,
    ).toBe('doodad');
    // shape spans [32,48]; a building at [44,68] overlaps by 4 px.
    expect(
      validatePlacement(shape, grass, [{ shape: rectShape(56, 40, 24, 16), type: 'building' }])
        .reason,
    ).toBe('building');
    // A building at [48,56] only touches the edge: flush placement is allowed.
    expect(
      validatePlacement(shape, grass, [{ shape: rectShape(52, 40, 8, 16), type: 'building' }]).ok,
    ).toBe(true);
  });
});
