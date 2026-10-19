import { describe, expect, it } from 'vitest';
import { computeDualGrid, type TerrainSource } from './dualGrid';

/** Test terrains, lowest priority first (index = priority). */
const W = 0; // water
const G = 1; // grass
const C = 2; // cliff
const LEGEND: Record<string, number> = { '~': W, '.': G, '#': C };
const priorityOf = (t: number): number => t;

/** One char per data cell; reads outside the grid clamp to the nearest cell. */
const gridFromAscii = (rows: readonly string[]): TerrainSource => {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const cells = rows.map((row) =>
    [...row].map((ch) => {
      const t = LEGEND[ch];
      if (t === undefined) throw new Error(`Unknown terrain char '${ch}'`);
      return t;
    }),
  );
  return {
    width,
    height,
    getClamped: (cx, cy) =>
      cells[Math.max(0, Math.min(height - 1, cy))]![Math.max(0, Math.min(width - 1, cx))]!,
  };
};

/** Mask at display tile (x, y) for terrain t, or -1. */
const maskAt = (dg: ReturnType<typeof computeDualGrid>, t: number, x: number, y: number) =>
  dg.layers.get(t)?.[y * dg.width + x] ?? -1;

describe('computeDualGrid', () => {
  it('has one more display tile than data cells on each axis', () => {
    const dg = computeDualGrid(gridFromAscii(['..', '..']), priorityOf);
    expect([dg.width, dg.height]).toEqual([3, 3]);
  });

  it('a uniform area is a full tile (mask 15) of that terrain only', () => {
    const dg = computeDualGrid(gridFromAscii(['..', '..']), priorityOf);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) expect(maskAt(dg, G, x, y)).toBe(15);
    expect([...dg.layers.keys()]).toEqual([G]);
  });

  it('a boundary draws the lower terrain full and the higher one on its corners', () => {
    // Cells: water | grass.  Display tile (1,0) corners: TL=water TR=grass BL=water BR=grass.
    const dg = computeDualGrid(gridFromAscii(['~.']), priorityOf);
    expect(maskAt(dg, W, 1, 0)).toBe(15);
    expect(maskAt(dg, G, 1, 0)).toBe(2 | 8);
    // Edge tiles clamp to the nearest cell.
    expect(maskAt(dg, W, 0, 0)).toBe(15);
    expect(maskAt(dg, G, 0, 0)).toBe(-1);
    expect(maskAt(dg, G, 2, 1)).toBe(15);
    expect(maskAt(dg, W, 2, 1)).toBe(-1);
  });

  it('a higher layer also covers corners of even higher terrain (no holes underneath)', () => {
    // Corners around display tile (1,1): TL=water TR=grass BL=cliff BR=grass.
    const dg = computeDualGrid(gridFromAscii(['~.', '#.']), priorityOf);
    expect(maskAt(dg, W, 1, 1)).toBe(15);
    expect(maskAt(dg, G, 1, 1)).toBe(2 | 4 | 8);
    expect(maskAt(dg, C, 1, 1)).toBe(4);
  });
});
