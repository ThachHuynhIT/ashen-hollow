import { describe, expect, it } from 'vitest';
import { ART_POLICY, checkArtFrame, isIntegerDisplayScale } from './artPolicy';
import { PixelCanvas } from './pixel';

const solid = (w: number, h: number, color = 0x123456, alpha = 255): PixelCanvas => {
  const c = new PixelCanvas(w, h);
  c.fillRect(0, 0, w, h, color, alpha);
  return c;
};

describe('art policy', () => {
  it('exposes the contract numbers', () => {
    expect(ART_POLICY).toEqual({ maxAtlasSide: 4096, allowedSpriteAlpha: [0, 255], shadowAlpha: 128 });
  });

  it('accepts_extended_rgb: any colour is fine at the right size and alpha', () => {
    expect(checkArtFrame('f', solid(8, 8, 0x123456), { w: 8, h: 8 }, false)).toEqual([]);
  });

  it('rejects a frame of the wrong size, naming it', () => {
    const errs = checkArtFrame('unit/x', solid(8, 8), { w: 16, h: 8 }, false);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('unit/x');
  });

  it('rejects a non positive or fractional expected size', () => {
    expect(checkArtFrame('f', solid(8, 8), { w: 8.5, h: 8 }, false)).not.toEqual([]);
    expect(checkArtFrame('f', solid(8, 8), { w: 0, h: 8 }, false)).not.toEqual([]);
  });

  it('rejects_aa_edge: alpha 127 is an error that names frame and pixel', () => {
    const c = solid(4, 4);
    c.set(2, 1, 0xffffff, 127);
    const errs = checkArtFrame('f', c, { w: 4, h: 4 }, false);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('f');
    expect(errs[0]).toContain('2,1');
  });

  it('allows alpha 128 only for frames that declare a shadow', () => {
    const c = solid(4, 4);
    c.set(0, 0, 0x000000, 128);
    expect(checkArtFrame('f', c, { w: 4, h: 4 }, false)).not.toEqual([]);
    expect(checkArtFrame('f', c, { w: 4, h: 4 }, true)).toEqual([]);
  });

  it('reports at most a few offending pixels so the output stays readable', () => {
    const c = solid(8, 8, 0, 100);
    expect(checkArtFrame('f', c, { w: 8, h: 8 }, false).length).toBeLessThanOrEqual(5);
  });
});

describe('integer display scale', () => {
  it('art_contract_rejects_fractional_scale', () => {
    for (const s of [1, 2, 3]) expect(isIntegerDisplayScale(s)).toBe(true);
    for (const s of [1.5, 0, -1, Number.NaN, Infinity]) expect(isIntegerDisplayScale(s)).toBe(false);
  });
});
