import { describe, expect, it } from 'vitest';
import type { Rect, Size } from './hud/layout';
import { KING_CARD, kingCardRow, kingSelectLayout } from './kingSelectLayout';

const SIZES: [string, Size][] = [
  ['desktop 1280×720', { w: 1280, h: 720 }],
  ['mobile 375×812', { w: 375, h: 812 }],
  ['odd 900×600', { w: 900, h: 600 }],
];

const inside = (r: Rect, s: Size): boolean => r.x >= 0 && r.y >= 0 && r.x + r.w <= s.w && r.y + r.h <= s.h;
const within = (outer: Rect, r: Rect): boolean =>
  r.x >= outer.x && r.y >= outer.y && r.x + r.w <= outer.x + outer.w && r.y + r.h <= outer.y + outer.h;
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('kingSelectLayout', () => {
  for (const [name, screen] of SIZES) {
    it(`keeps every part on screen, touch targets ≥ 44 and parts apart (${name})`, () => {
      const l = kingSelectLayout(screen, 12);
      const touch: Record<string, Rect> = {
        ...Object.fromEntries(l.slots.map((r, i) => [`slot${i}`, r])),
        back: l.back,
        reroll: l.reroll,
        start: l.start,
        seed: l.seed,
      };
      expect(l.slots).toHaveLength(3);
      for (const [n, r] of Object.entries(touch)) {
        expect(inside(r, screen), `${n} ${JSON.stringify(r)}`).toBe(true);
        expect(r.w, n).toBeGreaterThanOrEqual(44);
        expect(r.h, n).toBeGreaterThanOrEqual(44);
      }
      for (const r of [l.title, l.detail]) expect(inside(r, screen), JSON.stringify(r)).toBe(true);
      const parts: Record<string, Rect> = { ...touch, detail: l.detail, title: l.title };
      const entries = Object.entries(parts);
      for (let i = 0; i < entries.length; i++)
        for (let j = i + 1; j < entries.length; j++)
          expect(overlaps(entries[i]![1], entries[j]![1]), `${entries[i]![0]} vs ${entries[j]![0]}`).toBe(false);
    });

    it(`puts the text area and the card row inside the detail panel (${name})`, () => {
      const l = kingSelectLayout(screen, 12);
      expect(within(l.detail, l.text)).toBe(true);
      expect(within(l.detail, l.cards)).toBe(true);
      expect(l.text.h).toBeGreaterThan(80);
      expect(l.cards.h).toBeGreaterThanOrEqual(KING_CARD.h);
      expect(overlaps(l.text, l.cards)).toBe(false);
    });
  }

  it('uses a 96×96 slot column on desktop and a row of 100×100 slots on phones', () => {
    const d = kingSelectLayout({ w: 1280, h: 720 }, 12);
    expect(d.slots.every((s) => s.w === 96 && s.h === 96)).toBe(true);
    expect(d.slots[0]!.x).toBe(d.slots[2]!.x);
    expect(d.start).toMatchObject({ w: 200, h: 52 });
    const m = kingSelectLayout({ w: 375, h: 812 }, 12);
    expect(m.slots.every((s) => s.w === 100 && s.h === 100)).toBe(true);
    expect(m.slots[0]!.y).toBe(m.slots[2]!.y);
    expect(m.start).toMatchObject({ w: 355, h: 56 });
    expect(m.start.y + m.start.h).toBe(812 - 10);
  });

  it('never throws for odd sizes', () => {
    for (const s of [
      { w: 0, h: 0 },
      { w: 320, h: 400 },
      { w: 768, h: 500 },
      { w: 1920, h: 1080 },
    ])
      expect(() => kingSelectLayout(s, 12)).not.toThrow();
  });
});

describe('kingCardRow', () => {
  const viewport: Rect = { x: 100, y: 300, w: 320, h: 100 };

  it('lays 72×100 cards in a row and clamps the scroll', () => {
    const row = kingCardRow(viewport, 9, 0);
    expect(row.cards).toHaveLength(9);
    expect(row.cards[0]).toEqual({ x: 100, y: 300, w: KING_CARD.w, h: KING_CARD.h });
    expect(row.cards[1]!.x).toBe(100 + KING_CARD.w + KING_CARD.gap);
    expect(row.maxScroll).toBe(9 * KING_CARD.w + 8 * KING_CARD.gap - 320);
    expect(kingCardRow(viewport, 9, -10).scroll).toBe(0);
    expect(kingCardRow(viewport, 9, 99999).scroll).toBe(row.maxScroll);
  });

  it('lists only the cards fully inside the viewport', () => {
    const first = kingCardRow(viewport, 9, 0);
    expect(first.visible).toEqual([0, 1, 2, 3]);
    const last = kingCardRow(viewport, 9, 99999);
    expect(last.visible).toContain(8);
    expect(last.visible).not.toContain(0);
  });

  it('needs no scrolling when every card fits', () => {
    const row = kingCardRow({ ...viewport, w: 700 }, 9, 50);
    expect(row.maxScroll).toBe(0);
    expect(row.scroll).toBe(0);
    expect(row.visible).toHaveLength(9);
  });
});
