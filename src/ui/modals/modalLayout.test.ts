import { describe, expect, it } from 'vitest';
import type { Rect, Size } from '../hud/layout';
import {
  calendarModalLayout,
  centredPanel,
  councilLayout,
  deckModalLayout,
  questLayout,
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

const TABLET: Size = { w: 900, h: 600 };
const SCREENS: readonly [string, Size, number][] = [
  ['desktop', DESKTOP, 24],
  ['mobile', MOBILE, 10],
  ['900x600', TABLET, 24],
];
const inside = (screen: Size, r: Rect): boolean => contains({ x: 0, y: 0, ...screen }, r);

describe('rewardLayout with 4 cards', () => {
  it('is one row of 150×210 cards on desktop', () => {
    const l = rewardLayout(DESKTOP, 24, 4);
    expect(l.cards).toHaveLength(4);
    expect(new Set(l.cards.map((c) => c.y)).size).toBe(1);
    expect(l.cards.every((c) => c.w === 150 && c.h === 210)).toBe(true);
    expect(inside(DESKTOP, l.panel)).toBe(true);
  });

  it('is a 2×2 grid of 108×152 cards on mobile, all inside the panel and the screen, none overlapping', () => {
    const inset = 10;
    const l = rewardLayout(MOBILE, inset, 4);
    expect(new Set(l.cards.map((c) => c.x)).size).toBe(2);
    expect(new Set(l.cards.map((c) => c.y)).size).toBe(2);
    expect(l.cards.every((c) => c.w === 108 && c.h === 152)).toBe(true);
    expect(inside(MOBILE, l.panel)).toBe(true);
    const inner = { x: l.panel.x + inset, y: l.panel.y + inset, w: l.panel.w - 2 * inset, h: l.panel.h - 2 * inset };
    for (const r of [l.title, ...l.cards, l.take]) expect(contains(inner, r), JSON.stringify(r)).toBe(true);
    for (let i = 0; i < l.cards.length; i++) {
      for (let j = i + 1; j < l.cards.length; j++) expect(overlaps(l.cards[i]!, l.cards[j]!)).toBe(false);
      expect(overlaps(l.cards[i]!, l.take)).toBe(false);
      // a selected card lifts 12 px and must stay under the title
      expect(l.cards[i]!.y - 12).toBeGreaterThanOrEqual(l.title.y + l.title.h);
    }
  });

  it('3 cards keep the old single row on mobile', () => {
    const l = rewardLayout(MOBILE, 10, 3);
    expect(new Set(l.cards.map((c) => c.y)).size).toBe(1);
  });
});

describe('councilLayout', () => {
  it('desktop: three decree cards side by side, 300×120', () => {
    const l = councilLayout(DESKTOP, 24);
    expect(l.choices.every((c) => c.w === 300 && c.h === 120)).toBe(true);
    expect(new Set(l.choices.map((c) => c.y)).size).toBe(1);
  });

  it('mobile: three decree cards stacked, 110 high, as wide as the panel allows (355 minus the inset)', () => {
    const inset = 10;
    const l = councilLayout(MOBILE, inset);
    expect(l.choices.every((c) => c.h === 110 && c.w === 355 - 2 * inset)).toBe(true);
    expect(new Set(l.choices.map((c) => c.x)).size).toBe(1);
    expect(l.choices[1]!.y).toBeGreaterThan(l.choices[0]!.y + 109);
  });

  for (const [name, screen, inset] of SCREENS) {
    it(`keeps title, choices, area and Ban hành inside the panel, apart, with ≥44 touch targets (${name})`, () => {
      const l = councilLayout(screen, inset);
      expect(inside(screen, l.panel), 'panel').toBe(true);
      const inner = { x: l.panel.x + inset, y: l.panel.y + inset, w: l.panel.w - 2 * inset, h: l.panel.h - 2 * inset };
      const parts = [l.title, ...l.choices, l.area, l.enact];
      for (const r of parts) expect(contains(inner, r), JSON.stringify(r)).toBe(true);
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) expect(overlaps(parts[i]!, parts[j]!), `${i}/${j}`).toBe(false);
      }
      for (const r of [...l.choices, l.enact]) {
        expect(r.w).toBeGreaterThanOrEqual(44);
        expect(r.h).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

describe('questLayout', () => {
  for (const [name, screen, inset] of SCREENS) {
    it(`fits body and both buttons inside the panel, apart (${name})`, () => {
      const l = questLayout(screen, inset);
      expect(inside(screen, l.panel)).toBe(true);
      const inner = { x: l.panel.x + inset, y: l.panel.y + inset, w: l.panel.w - 2 * inset, h: l.panel.h - 2 * inset };
      for (const r of [l.title, l.body, l.accept, l.decline]) expect(contains(inner, r), JSON.stringify(r)).toBe(true);
      expect(overlaps(l.accept, l.decline)).toBe(false);
      expect(overlaps(l.body, l.accept)).toBe(false);
      for (const b of [l.accept, l.decline]) {
        expect(b.w).toBeGreaterThanOrEqual(44);
        expect(b.h).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

describe('calendarModalLayout for 30 years', () => {
  for (const [name, screen, inset] of [
    ['desktop', DESKTOP, 24],
    ['mobile', MOBILE, 10],
    ['900×600', TABLET, 24],
  ] as const) {
    it(`is a 6×5 grid whose cells stay inside the panel, apart, ≥44 px (${name})`, () => {
      const l = calendarModalLayout(screen, inset, 30);
      expect(contains({ x: 0, y: 0, ...screen }, l.panel)).toBe(true);
      expect(l.cells).toHaveLength(30);
      expect(new Set(l.cells.map((c) => c.x)).size).toBe(6);
      expect(new Set(l.cells.map((c) => c.y)).size).toBe(5);
      const inner = { x: l.panel.x + inset, y: l.panel.y + inset, w: l.panel.w - 2 * inset, h: l.panel.h - 2 * inset };
      for (const r of [l.title, ...l.cells, l.close]) expect(contains(inner, r), JSON.stringify(r)).toBe(true);
      for (const c of l.cells) {
        expect(c.w).toBeGreaterThanOrEqual(44);
        expect(c.h).toBeGreaterThanOrEqual(44);
      }
      const parts = [l.title, ...l.cells, l.close];
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++) expect(overlaps(parts[i]!, parts[j]!), `${i}/${j}`).toBe(false);
      // Row-major: years 1..6 on the first row, year 7 starts the second.
      expect(l.cells[0]!.y).toBe(l.cells[5]!.y);
      expect(l.cells[6]!.y).toBeGreaterThan(l.cells[0]!.y);
    });
  }
});

describe('councilLayout on short phones', () => {
  for (const screen of [{ w: 375, h: 667 }, { w: 390, h: 664 }, { w: 375, h: 635 }] as Size[]) {
    it(`keeps Ban hành and the detail area on screen (${screen.w}×${screen.h})`, () => {
      const inset = 9;
      const l = councilLayout(screen, inset);
      for (const r of [l.panel, l.area, l.enact, ...l.choices]) expect(inside(screen, r), JSON.stringify(r)).toBe(true);
      expect(contains(l.panel, l.enact)).toBe(true);
      const parts = [l.title, ...l.choices, l.area, l.enact];
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++) expect(overlaps(parts[i]!, parts[j]!), `${i}/${j}`).toBe(false);
      for (const c of l.choices) expect(c.h).toBeGreaterThanOrEqual(60);
    });
  }
});
