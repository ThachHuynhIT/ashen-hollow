import { describe, expect, it } from 'vitest';
import { separationPush, type SeparationBodies } from './steering';

interface Body {
  x: number;
  y?: number;
  r: number;
  fixed?: boolean;
  flying?: boolean;
}

const bodies = (list: readonly Body[]): SeparationBodies => ({
  count: list.length,
  x: list.map((b) => b.x),
  y: list.map((b) => b.y ?? 0),
  radius: list.map((b) => b.r),
  fixed: list.map((b) => (b.fixed ? 1 : 0)),
  flying: list.map((b) => (b.flying ? 1 : 0)),
});

/** Run separation and return the pushes as [dx, dy] per body (−0 normalised to 0). */
const push = (list: readonly Body[], pushMax = 10): [number, number][] => {
  const outX = new Float64Array(list.length);
  const outY = new Float64Array(list.length);
  separationPush(bodies(list), pushMax, outX, outY);
  return list.map((_, i) => [outX[i]! + 0, outY[i]! + 0]);
};

describe('separationPush', () => {
  it('pushes two overlapping units apart by half the overlap each', () => {
    expect(
      push([
        { x: 0, r: 4 },
        { x: 6, r: 4 },
      ]),
    ).toEqual([
      [-1, 0],
      [1, 0],
    ]);
  });

  it('caps each push at pushMax', () => {
    expect(
      push(
        [
          { x: 0, r: 4 },
          { x: 2, r: 4 },
        ],
        1,
      ),
    ).toEqual([
      [-1, 0],
      [1, 0],
    ]);
  });

  it('leaves bodies that only touch alone', () => {
    expect(
      push([
        { x: 0, r: 4 },
        { x: 8, r: 4 },
      ]),
    ).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('splits units on exactly the same spot along (1, 0)', () => {
    expect(
      push(
        [
          { x: 5, y: 5, r: 4 },
          { x: 5, y: 5, r: 4 },
        ],
        1,
      ),
    ).toEqual([
      [-1, 0],
      [1, 0],
    ]);
  });

  it('normalises the direction with a square root', () => {
    const [a, b] = push([
      { x: 0, y: 0, r: 4 },
      { x: 3, y: 4, r: 4 },
    ]);
    expect(a![0]).toBeCloseTo(-0.9);
    expect(a![1]).toBeCloseTo(-1.2);
    expect(b![0]).toBeCloseTo(0.9);
    expect(b![1]).toBeCloseTo(1.2);
  });

  it('computes every pair from the same snapshot (order of pairs does not leak)', () => {
    // Pairs (0,1) and (1,2) each overlap by 2; the middle unit is pushed both ways.
    expect(
      push([
        { x: 0, r: 4 },
        { x: 6, r: 4 },
        { x: 12, r: 4 },
      ]),
    ).toEqual([
      [-1, 0],
      [0, 0],
      [1, 0],
    ]);
  });

  it('gives mirrored pushes when the bodies are listed the other way round', () => {
    const forward = push([
      { x: 0, r: 4 },
      { x: 6, r: 4 },
    ]);
    const backward = push([
      { x: 6, r: 4 },
      { x: 0, r: 4 },
    ]);
    expect(backward).toEqual([forward[1], forward[0]]);
  });

  it('lets a structure push a ground unit fully out without moving itself', () => {
    expect(
      push(
        [
          { x: 0, r: 12, fixed: true },
          { x: 10, r: 4 },
        ],
        1,
      ),
    ).toEqual([
      [0, 0],
      [6, 0],
    ]);
    expect(
      push(
        [
          { x: 10, r: 4 },
          { x: 0, r: 12, fixed: true },
        ],
        1,
      ),
    ).toEqual([
      [6, 0],
      [0, 0],
    ]);
  });

  it('pushes a unit standing on a structure centre out along (1, 0)', () => {
    expect(
      push([
        { x: 0, r: 12, fixed: true },
        { x: 0, r: 4 },
      ]),
    ).toEqual([
      [0, 0],
      [16, 0],
    ]);
  });

  it('lets flying units pass over structures', () => {
    expect(
      push([
        { x: 0, r: 12, fixed: true },
        { x: 10, r: 4, flying: true },
      ]),
    ).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('never pushes two structures', () => {
    expect(
      push([
        { x: 0, r: 12, fixed: true },
        { x: 5, r: 12, fixed: true },
      ]),
    ).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('still separates flying units from each other', () => {
    expect(
      push([
        { x: 0, r: 4, flying: true },
        { x: 6, r: 4, flying: true },
      ]),
    ).toEqual([
      [-1, 0],
      [1, 0],
    ]);
  });

  it('clears stale values in the output arrays', () => {
    const outX = new Float64Array([9, 9]);
    const outY = new Float64Array([9, 9]);
    separationPush(
      bodies([
        { x: 0, r: 1 },
        { x: 50, r: 1 },
      ]),
      1,
      outX,
      outY,
    );
    expect([...outX, ...outY]).toEqual([0, 0, 0, 0]);
  });
});
