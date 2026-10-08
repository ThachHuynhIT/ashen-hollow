import { describe, expect, it } from 'vitest';
import { hexDistance, hexSpiral } from '../../hex';
import { TERRAIN_IDS } from '../../data/terrain';
import { generateMap } from './generate';
import { HexMap } from './HexMap';

describe('generateMap', () => {
  const opts = { seed: 1234, width: 64, height: 64 };

  it('is deterministic for a given seed', () => {
    const a = generateMap(opts);
    const b = generateMap(opts);
    expect(Array.from(a.map.terrain)).toEqual(Array.from(b.map.terrain));
    expect(a.start).toEqual(b.start);
  });

  it('differs between seeds', () => {
    const a = generateMap(opts);
    const b = generateMap({ ...opts, seed: 99 });
    expect(Array.from(a.map.terrain)).not.toEqual(Array.from(b.map.terrain));
  });

  it('only produces known terrain', () => {
    const { map } = generateMap(opts);
    for (const t of map.terrain) expect(t).toBeLessThan(TERRAIN_IDS.length);
  });

  it('keeps a passable clearing around the start', () => {
    for (const seed of [1, 2, 3, 42, 777]) {
      const { map, start } = generateMap({ ...opts, seed });
      for (const h of hexSpiral(start, 3)) {
        expect(hexDistance(h, start)).toBeLessThanOrEqual(3);
        expect(map.isPassable(h)).toBe(true);
        expect(map.terrainOf(h).id).toBe('deadGrass');
      }
    }
  });

  it('produces a varied landscape', () => {
    const { map } = generateMap(opts);
    const kinds = new Set(map.terrain);
    expect(kinds.size).toBeGreaterThanOrEqual(5);
  });
});

describe('HexMap', () => {
  it('maps hexes to indices and back', () => {
    const map = new HexMap(10, 7);
    map.forEach((h, i) => {
      expect(map.indexOf(h)).toBe(i);
      expect(map.inBounds(h)).toBe(true);
    });
    expect(map.indexOf({ q: -50, r: 0 })).toBe(-1);
    expect(map.inBounds({ q: 0, r: 7 })).toBe(false);
  });

  it('rejects mismatched layer sizes', () => {
    expect(() => new HexMap(4, 4, new Uint8Array(3))).toThrow();
  });
});
