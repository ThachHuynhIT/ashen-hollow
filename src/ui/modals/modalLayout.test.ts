import { describe, expect, it } from 'vitest';
import type { Rect, Size } from '../hud/layout';
import {
  calendarModalLayout,
  centredPanel,
  deckModalLayout,
  resultLayout,
  rewardLayout,
} from './modalLayout';

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
    it(`fits title, 3 cards and the take button inside the panel (${name})`, () => {
      const l = rewardLayout(screen, inset);
      expect(contains({ x: 0, y: 0, ...screen }, l.panel)).toBe(true);
      expect(l.cards).toHaveLength(3);
      const inner = {
        x: l.panel.x + inset,
        y: l.panel.y + inset,
        w: l.panel.w - 2 * inset,
        h: l.panel.h - 2 * inset,
      };
      for (const r of [l.title, ...l.cards, l.take]) {
        expect(contains(inner, r), JSON.stringify(r)).toBe(true);
      }
      for (const c of l.cards) {
        expect(c.w).toBe(card.w);
        expect(c.h).toBe(card.h);
        // A selected card lifts 12 px: still below the title.
        expect(c.y - 12).toBeGreaterThanOrEqual(l.title.y + l.title.h);
      }
      for (const b of [l.take]) {
        expect(b.w).toBeGreaterThanOrEqual(44);
        expect(b.h).toBeGreaterThanOrEqual(44);
      }
      const parts = [l.title, ...l.cards, l.take];
      expect('skip' in l).toBe(false);
      expect(l.take.x + l.take.w / 2).toBeCloseTo(l.panel.x + l.panel.w / 2, 0);
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

describe('calendarModalLayout', () => {
  for (const [name, screen, inset] of [
    ['desktop', DESKTOP, 24],
    ['mobile', MOBILE, 10],
    ['odd 900×600', { w: 900, h: 600 }, 24],
  ] as const) {
    it(`fits a 5×3 grid of 15 years, a title and ✕ inside the panel (${name})`, () => {
      const l = calendarModalLayout(screen, inset);
      expect(contains({ x: 0, y: 0, ...screen }, l.panel)).toBe(true);
      expect(l.cells).toHaveLength(15);
      const inner = {
        x: l.panel.x + inset,
        y: l.panel.y + inset,
        w: l.panel.w - 2 * inset,
        h: l.panel.h - 2 * inset,
      };
      for (const r of [l.title, ...l.cells, l.close]) expect(contains(inner, r), JSON.stringify(r)).toBe(true);
      for (const c of l.cells) {
        expect(c.w).toBeGreaterThanOrEqual(44);
        expect(c.h).toBeGreaterThanOrEqual(44);
      }
      expect(l.close.w).toBeGreaterThanOrEqual(44);
      expect(l.close.h).toBeGreaterThanOrEqual(44);
      const parts = [l.title, ...l.cells, l.close];
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++) expect(overlaps(parts[i]!, parts[j]!)).toBe(false);
      // Row-major: year 1..5 on the first row.
      expect(l.cells[0]!.y).toBe(l.cells[4]!.y);
      expect(l.cells[5]!.y).toBeGreaterThan(l.cells[0]!.y);
    });
  }
});

describe('deckModalLayout', () => {
  for (const [name, screen, inset, cols] of [
    ['desktop', DESKTOP, 24, 6],
    ['mobile', MOBILE, 10, 3],
  ] as const) {
    it(`has ${cols} columns of 96×134 cards in a viewport inside the panel (${name})`, () => {
      const l = deckModalLayout(screen, inset, 20, 0);
      expect(contains({ x: 0, y: 0, ...screen }, l.panel)).toBe(true);
      expect(l.cols).toBe(cols);
      expect(l.cards).toHaveLength(20);
      for (const c of l.cards) {
        expect(c.w).toBe(96);
        expect(c.h).toBe(134);
        // Horizontally always inside the viewport.
        expect(c.x).toBeGreaterThanOrEqual(l.viewport.x);
        expect(c.x + c.w).toBeLessThanOrEqual(l.viewport.x + l.viewport.w);
      }
      expect(l.tabs.length).toBeGreaterThanOrEqual(3);
      for (const t of [...l.tabs, l.close]) {
        expect(t.w).toBeGreaterThanOrEqual(44);
        expect(t.h).toBeGreaterThanOrEqual(44);
        expect(contains(l.panel, t)).toBe(true);
      }
      for (const t of l.tabs) expect(overlaps(t, l.viewport)).toBe(false);
      expect(l.maxScroll).toBeGreaterThan(0); // 20 cards do not fit
    });

    it(`scrolls: visible cards follow the offset and the offset is clamped (${name})`, () => {
      const top = deckModalLayout(screen, inset, 20, 0);
      const moved = deckModalLayout(screen, inset, 20, 40);
      expect(moved.cards[0]!.y).toBe(top.cards[0]!.y - 40);
      const past = deckModalLayout(screen, inset, 20, 99999);
      expect(past.scroll).toBe(top.maxScroll);
      const before = deckModalLayout(screen, inset, 20, -50);
      expect(before.scroll).toBe(0);
      // The last card ends exactly at the viewport bottom when fully scrolled.
      expect(past.cards[19]!.y + past.cards[19]!.h).toBeLessThanOrEqual(past.viewport.y + past.viewport.h);
      expect(past.visible).toContain(19);
      expect(top.visible).toContain(0);
      expect(top.visible).not.toContain(19);
    });
  }

  it('needs no scrolling for a handful of cards', () => {
    const l = deckModalLayout(DESKTOP, 24, 5, 0);
    expect(l.maxScroll).toBe(0);
    expect(l.visible).toEqual([0, 1, 2, 3, 4]);
  });

  it('copes with an empty deck', () => {
    const l = deckModalLayout(MOBILE, 10, 0, 0);
    expect(l.cards).toEqual([]);
    expect(l.maxScroll).toBe(0);
  });
});
