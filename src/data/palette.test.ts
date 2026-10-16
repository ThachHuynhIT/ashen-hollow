import { describe, expect, it } from 'vitest';
import { PALETTE, toCss } from './palette';

describe('Hearth 32 palette', () => {
  it('has exactly 32 distinct 24-bit colours', () => {
    const colors = Object.values(PALETTE);
    expect(colors).toHaveLength(32);
    expect(new Set(colors).size).toBe(32);
    for (const c of colors) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('keeps the outline, ally blue and enemy red the spec relies on', () => {
    expect(PALETTE.outline).toBe(0x2a1a14);
    expect(PALETTE.blue).toBe(0x4a6fc8);
    expect(PALETTE.red).toBe(0xd04a3a);
    expect(PALETTE.redDark).toBe(0x8e2d2b);
  });
});

describe('toCss', () => {
  it('pads to six hex digits', () => {
    expect(toCss(PALETTE.outline)).toBe('#2a1a14');
    expect(toCss(0x00000a)).toBe('#00000a');
  });
});
