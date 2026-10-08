import { describe, expect, it } from 'vitest';
import { paintBitmap } from './bitmap';

describe('paintBitmap', () => {
  it('paints mapped characters and leaves "." transparent', () => {
    const c = paintBitmap(['.a', 'b.'], { a: 0xff0000, b: 0x0000ff });
    expect([c.width, c.height]).toEqual([2, 2]);
    expect(c.alphaAt(0, 0)).toBe(0);
    expect(Array.from(c.data.slice(4, 8))).toEqual([255, 0, 0, 255]);
    expect(Array.from(c.data.slice(8, 12))).toEqual([0, 0, 255, 255]);
  });

  it('rejects ragged rows and unknown characters', () => {
    expect(() => paintBitmap(['..', '.'], {})).toThrow();
    expect(() => paintBitmap(['x'], {})).toThrow();
  });
});
