import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, HEX_TILE_HEIGHT, HEX_TILE_WIDTH, hex } from '../hex';
import { isHexTileEdge, isInsideHexTile } from './pixel';

describe('hex tile pixel mask', () => {
  it('partitions the plane exactly when tiles are laid out on the grid', () => {
    // Paint a patch of hexes into a coverage buffer and check every pixel
    // in the interior is covered exactly once.
    const coverage = new Map<string, number>();
    for (let q = -4; q <= 6; q++) {
      for (let r = -2; r <= 6; r++) {
        const c = DEFAULT_LAYOUT.hexToPixel(hex(q, r));
        const left = c.x - HEX_TILE_WIDTH / 2;
        const top = c.y - HEX_TILE_HEIGHT / 2;
        for (let y = 0; y < HEX_TILE_HEIGHT; y++) {
          for (let x = 0; x < HEX_TILE_WIDTH; x++) {
            if (!isInsideHexTile(x, y)) continue;
            const key = `${left + x},${top + y}`;
            coverage.set(key, (coverage.get(key) ?? 0) + 1);
          }
        }
      }
    }
    for (let y = 40; y < 120; y++) {
      for (let x = 40; x < 140; x++) {
        expect(coverage.get(`${x},${y}`), `pixel ${x},${y}`).toBe(1);
      }
    }
  });

  it('agrees with pixelToHex away from the edges', () => {
    const h = hex(1, 1);
    const c = DEFAULT_LAYOUT.hexToPixel(h);
    const left = c.x - 16;
    const top = c.y - 16;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (!isInsideHexTile(x, y) || isHexTileEdge(x, y)) continue;
        expect(DEFAULT_LAYOUT.pixelToHex(left + x + 0.5, top + y + 0.5)).toEqual(h);
      }
    }
  });

  it('has a symmetric-looking shape with 2:1 diagonals', () => {
    expect(isInsideHexTile(15, 1)).toBe(true);
    expect(isInsideHexTile(13, 1)).toBe(false);
    expect(isInsideHexTile(0, 8)).toBe(true);
    expect(isInsideHexTile(31, 23)).toBe(true);
    expect(isInsideHexTile(15, 31)).toBe(true);
    expect(isInsideHexTile(13, 31)).toBe(false);
  });
});
