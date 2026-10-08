import { describe, expect, it } from 'vitest';
import {
  HEX_DIRECTIONS,
  hex,
  hexDistance,
  hexEquals,
  hexKey,
  hexLine,
  hexNeighbor,
  hexNeighbors,
  hexRing,
  hexRound,
  hexSpiral,
  parseHexKey,
} from './hex';
import { axialToOffset, offsetToAxial } from './offset';
import { DEFAULT_LAYOUT } from './layout';

describe('hex basics', () => {
  it('has six unit directions whose opposites cancel out', () => {
    expect(HEX_DIRECTIONS).toHaveLength(6);
    for (let i = 0; i < 3; i++) {
      const a = HEX_DIRECTIONS[i]!;
      const b = HEX_DIRECTIONS[i + 3]!;
      expect(a.q + b.q).toBe(0);
      expect(a.r + b.r).toBe(0);
    }
  });

  it('neighbours are all distance 1', () => {
    const c = hex(3, -2);
    const ns = hexNeighbors(c);
    expect(ns).toHaveLength(6);
    for (const n of ns) expect(hexDistance(c, n)).toBe(1);
    expect(new Set(ns.map(hexKey)).size).toBe(6);
  });

  it('computes distance', () => {
    expect(hexDistance(hex(0, 0), hex(0, 0))).toBe(0);
    expect(hexDistance(hex(0, 0), hex(3, 0))).toBe(3);
    expect(hexDistance(hex(0, 0), hex(2, -5))).toBe(5);
    expect(hexDistance(hex(-1, 2), hex(2, -1))).toBe(3);
  });

  it('round-trips keys', () => {
    const h = hex(-7, 12);
    expect(hexEquals(parseHexKey(hexKey(h)), h)).toBe(true);
    expect(() => parseHexKey('nope')).toThrow();
  });

  it('rounds fractional coordinates to the nearest hex', () => {
    expect(hexRound(0.1, -0.1)).toEqual(hex(0, 0));
    expect(hexRound(0.9, 0.05)).toEqual(hex(1, 0));
    expect(hexRound(-0.2, 1.1)).toEqual(hex(0, 1));
  });
});

describe('rings, spirals and lines', () => {
  it('ring k has 6k hexes all at distance k', () => {
    const c = hex(2, 2);
    expect(hexRing(c, 0)).toEqual([c]);
    for (const k of [1, 2, 5]) {
      const ring = hexRing(c, k);
      expect(ring).toHaveLength(6 * k);
      expect(new Set(ring.map(hexKey)).size).toBe(6 * k);
      for (const h of ring) expect(hexDistance(c, h)).toBe(k);
    }
  });

  it('spiral of radius n has 3n(n+1)+1 hexes', () => {
    for (const n of [0, 1, 3]) {
      expect(hexSpiral(hex(0, 0), n)).toHaveLength(3 * n * (n + 1) + 1);
    }
  });

  it('line is contiguous and has distance+1 hexes', () => {
    const a = hex(0, 0);
    const b = hex(4, -7);
    const line = hexLine(a, b);
    expect(line).toHaveLength(hexDistance(a, b) + 1);
    expect(line[0]).toEqual(a);
    expect(line[line.length - 1]).toEqual(b);
    for (let i = 1; i < line.length; i++) {
      expect(hexDistance(line[i - 1]!, line[i]!)).toBe(1);
    }
  });

  it('neighbour in a direction', () => {
    expect(hexNeighbor(hex(0, 0), 0)).toEqual(hex(1, 0));
    expect(hexNeighbor(hex(0, 0), 6)).toEqual(hex(1, 0));
    expect(hexNeighbor(hex(0, 0), -1)).toEqual(hex(0, 1));
  });
});

describe('offset coordinates (odd-r)', () => {
  it('round-trips axial ↔ offset', () => {
    for (let row = -4; row <= 4; row++) {
      for (let col = -4; col <= 4; col++) {
        const h = offsetToAxial(col, row);
        expect(axialToOffset(h)).toEqual({ col, row });
      }
    }
  });

  it('shoves odd rows right', () => {
    const even = DEFAULT_LAYOUT.hexToPixel(offsetToAxial(0, 0));
    const odd = DEFAULT_LAYOUT.hexToPixel(offsetToAxial(0, 1));
    expect(odd.x - even.x).toBe(16);
    expect(odd.y - even.y).toBe(24);
  });
});

describe('pixel layout', () => {
  it('places hex (0,0) at the tile centre', () => {
    expect(DEFAULT_LAYOUT.hexToPixel(hex(0, 0))).toEqual({ x: 16, y: 16 });
  });

  it('round-trips hex → pixel → hex', () => {
    for (let q = -6; q <= 6; q++) {
      for (let r = -6; r <= 6; r++) {
        const h = hex(q, r);
        const p = DEFAULT_LAYOUT.hexToPixel(h);
        expect(DEFAULT_LAYOUT.pixelToHex(p.x, p.y)).toEqual(h);
      }
    }
  });

  it('picks the right hex near (but inside) the edges', () => {
    const h = hex(2, 3);
    const c = DEFAULT_LAYOUT.hexToPixel(h);
    // Points well inside the flat vertical sides and the pointy caps.
    expect(DEFAULT_LAYOUT.pixelToHex(c.x - 15, c.y)).toEqual(h);
    expect(DEFAULT_LAYOUT.pixelToHex(c.x + 15, c.y + 7)).toEqual(h);
    expect(DEFAULT_LAYOUT.pixelToHex(c.x, c.y - 15)).toEqual(h);
    expect(DEFAULT_LAYOUT.pixelToHex(c.x, c.y + 15)).toEqual(h);
    // Just across the right edge belongs to the east neighbour.
    expect(DEFAULT_LAYOUT.pixelToHex(c.x + 17, c.y)).toEqual(hexNeighbor(h, 0));
  });

  it('has six corners forming the 32×32 pointy-top shape', () => {
    expect(DEFAULT_LAYOUT.cornerOffsets()).toEqual([
      { x: 0, y: -16 },
      { x: 16, y: -8 },
      { x: 16, y: 8 },
      { x: 0, y: 16 },
      { x: -16, y: 8 },
      { x: -16, y: -8 },
    ]);
  });
});
