import { describe, expect, it } from 'vitest';
import type { Rect, Size } from '../hud/layout';
import { centredPanel, resultLayout, rewardLayout } from './modalLayout';

const DESKTOP: Size = { w: 1280, h: 720 };
const MOBILE: Size = { w: 375, h: 812 };

const contains = (outer: Rect, r: Rect): boolean =>
  r.x >= outer.x &&
  r.y >= outer.y &&
  r.x + r.w <= outer.x + outer.w &&
  r.y + r.h <= outer.y + outer.h;
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('centredPanel', () => {
  it('centres and shrinks to the margins', () => {
    expect(centredPanel(DESKTOP, 400, 200)).toEqual({ x: 440, y: 260, w: 400, h: 200 });
    expect(centredPanel(MOBILE, 600, 300)).toEqual({ x: 10, y: 256, w: 355, h: 300 });
  });
});

describe('rewardLayout', () => {
  for (const [name, screen, inset, card] of [
    ['desktop', DESKTOP, 24, { w: 150, h: 210 }],
    ['mobile', MOBILE, 10, { w: 108, h: 152 }],
  ] as const) {
    it(`fits title, 3 cards and 2 buttons inside the panel (${name})`, () => {
      const l = rewardLayout(screen, inset);
      expect(contains({ x: 0, y: 0, ...screen }, l.panel)).toBe(true);
      expect(l.cards).toHaveLength(3);
      const inner = {
        x: l.panel.x + inset,
        y: l.panel.y + inset,
        w: l.panel.w - 2 * inset,
        h: l.panel.h - 2 * inset,
      };
      for (const r of [l.title, ...l.cards, l.skip, l.take]) {
        expect(contains(inner, r), JSON.stringify(r)).toBe(true);
      }
      for (const c of l.cards) {
        expect(c.w).toBe(card.w);
        expect(c.h).toBe(card.h);
        // A selected card lifts 12 px: still below the title.
        expect(c.y - 12).toBeGreaterThanOrEqual(l.title.y + l.title.h);
      }
      for (const b of [l.skip, l.take]) {
        expect(b.w).toBeGreaterThanOrEqual(44);
        expect(b.h).toBeGreaterThanOrEqual(44);
      }
      const parts = [l.title, ...l.cards, l.skip, l.take];
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++)
          expect(overlaps(parts[i]!, parts[j]!)).toBe(false);
    });
  }
});

describe('resultLayout', () => {
  for (const [name, screen, inset] of [
    ['desktop', DESKTOP, 28],
    ['mobile', MOBILE, 22],
  ] as const) {
    for (const buttons of [1, 2]) {
      it(`fits title, 3 lines and ${buttons} button(s) inside the panel (${name})`, () => {
        const l = resultLayout(screen, inset, 3, buttons);
        expect(contains({ x: 0, y: 0, ...screen }, l.panel)).toBe(true);
        expect(l.lines).toHaveLength(3);
        expect(l.buttons).toHaveLength(buttons);
        const inner = {
          x: l.panel.x + inset,
          y: l.panel.y + inset,
          w: l.panel.w - 2 * inset,
          h: l.panel.h - 2 * inset,
        };
        const parts = [l.title, ...l.lines, ...l.buttons];
        for (const r of parts) expect(contains(inner, r), JSON.stringify(r)).toBe(true);
        for (const b of l.buttons) {
          expect(b.w).toBeGreaterThanOrEqual(44);
          expect(b.h).toBeGreaterThanOrEqual(44);
        }
        for (let i = 0; i < parts.length; i++)
          for (let j = i + 1; j < parts.length; j++)
            expect(overlaps(parts[i]!, parts[j]!)).toBe(false);
      });
    }
  }
});
