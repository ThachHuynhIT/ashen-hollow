import { describe, expect, it } from 'vitest';
import type { Rect, Size } from '../hud/layout';
import {
  PLANNING_ZOOM,
  battleLayout,
  battleZoom,
  cameraScroll,
  confirmFor,
  isDesktop,
  planningLayout,
  plotAtScreen,
  plotScreenRect,
  screenToWorld,
} from './realmLayout';

const DESKTOP: Size = { w: 1280, h: 720 };
const MOBILE: Size = { w: 375, h: 812 };

const inside = (r: Rect, s: Size): boolean =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= s.w && r.y + r.h <= s.h;
/** Touching edges do not overlap. */
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const expectSeparate = (named: Record<string, Rect>): void => {
  const entries = Object.entries(named);
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const [na, a] = entries[i]!;
      const [nb, b] = entries[j]!;
      expect(overlaps(a, b), `${na} overlaps ${nb}`).toBe(false);
    }
};

describe('isDesktop', () => {
  it('uses the desktop rules from 768 px wide', () => {
    expect(isDesktop(767)).toBe(false);
    expect(isDesktop(768)).toBe(true);
    expect(isDesktop(1280)).toBe(true);
    expect(isDesktop(375)).toBe(false);
  });
});

describe('planningLayout', () => {
  it('lays out the desktop 1280×720 HUD (§10.4)', () => {
    const l = planningLayout(DESKTOP);
    expect(l.desktop).toBe(true);
    expect(l.lives).toEqual({ x: 10, y: 10, w: 120, h: 52 });
    expect(l.year).toEqual({ x: 560, y: 10, w: 160, h: 52 });
    expect(l.board).toEqual({ x: 480, y: 180, w: 320, h: 320 });
    expect(l.scout.x).toBe(1010);
    expect(l.scout.w).toBe(260);
    expect(l.hand).toHaveLength(3);
    expect(l.hand[0]).toEqual({ x: 448, y: 542, w: 120, h: 168 });
    expect(l.hand[2]!.x).toBe(448 + 2 * 132);
    expect(l.fight.w).toBe(200);
    expect(l.fight.h).toBe(56);
  });

  it('lays out the mobile 375×812 HUD (§10.4)', () => {
    const l = planningLayout(MOBILE);
    expect(l.desktop).toBe(false);
    expect(l.lives).toEqual({ x: 10, y: 10, w: 96, h: 48 });
    expect(l.year.x).toBe(110);
    expect(l.year.x + l.year.w).toBe(365);
    expect(l.board).toEqual({ x: 28, y: 124, w: 320, h: 320 });
    expect(l.hand).toHaveLength(3);
    expect(l.hand[0]).toEqual({ x: 18, y: 650, w: 108, h: 152 });
    expect(l.hand[1]!.x).toBe(134);
    expect(l.scout).toEqual({ x: 10, y: 508, w: 355, h: 134 });
  });

  for (const [name, screen] of [
    ['desktop', DESKTOP],
    ['mobile', MOBILE],
  ] as const) {
    it(`keeps every rect on screen, buttons ≥ 44 and parts apart (${name})`, () => {
      const l = planningLayout(screen);
      for (const r of [l.lives, l.year, l.board, l.scout, ...l.hand, l.skip, l.fight])
        expect(inside(r, screen), JSON.stringify(r)).toBe(true);
      for (const b of [l.skip, l.fight, l.confirm, l.cancel]) {
        expect(b.w).toBeGreaterThanOrEqual(44);
        expect(b.h).toBeGreaterThanOrEqual(44);
      }
      // `fight` replaces the hand once a card is played, so it is left out on purpose.
      expectSeparate({
        lives: l.lives,
        year: l.year,
        board: l.board,
        scout: l.scout,
        hand0: l.hand[0]!,
        hand1: l.hand[1]!,
        hand2: l.hand[2]!,
        skip: l.skip,
      });
    });
  }

  it('never throws for odd sizes', () => {
    for (const s of [
      { w: 0, h: 0 },
      { w: 100, h: 100 },
      { w: 768, h: 600 },
      { w: 1920, h: 1080 },
      { w: 600, h: 1400 },
    ])
      expect(() => planningLayout(s)).not.toThrow();
  });
});

describe('plotScreenRect', () => {
  it('maps plots to 64 px screen cells of the board', () => {
    const l = planningLayout(DESKTOP);
    expect(PLANNING_ZOOM).toBe(2);
    expect(plotScreenRect(l, 12)).toEqual({ x: 608, y: 308, w: 64, h: 64 });
    expect(plotScreenRect(l, 0)).toEqual({ x: l.board.x, y: l.board.y, w: 64, h: 64 });
    expect(plotScreenRect(l, 24)).toEqual({ x: 480 + 256, y: 180 + 256, w: 64, h: 64 });
  });
});

describe('plotAtScreen', () => {
  it('inverts plotScreenRect and returns null off the board', () => {
    for (const screen of [DESKTOP, MOBILE]) {
      const l = planningLayout(screen);
      for (const plot of [0, 7, 12, 24]) {
        const r = plotScreenRect(l, plot);
        expect(plotAtScreen(l, { x: r.x, y: r.y })).toBe(plot);
        expect(plotAtScreen(l, { x: r.x + r.w - 0.5, y: r.y + r.h - 0.5 })).toBe(plot);
      }
      expect(plotAtScreen(l, { x: l.board.x - 1, y: l.board.y })).toBeNull();
      expect(plotAtScreen(l, { x: l.board.x, y: l.board.y + l.board.h })).toBeNull();
    }
  });
});

describe('hint rect', () => {
  for (const [name, screen] of [
    ['desktop', DESKTOP],
    ['mobile', MOBILE],
  ] as const) {
    it(`sits above the board, clear of the HUD and ✓/✕ (${name})`, () => {
      const l = planningLayout(screen);
      expect(inside(l.hint, screen)).toBe(true);
      expect(l.hint.w).toBeGreaterThanOrEqual(100);
      expect(l.hint.h).toBeGreaterThanOrEqual(40);
      expectSeparate({
        hint: l.hint,
        lives: l.lives,
        year: l.year,
        board: l.board,
        scout: l.scout,
        ...(l.desktop ? {} : { confirm: l.confirm, cancel: l.cancel }),
      });
    });
  }
});

describe('confirmFor', () => {
  for (const [name, screen] of [
    ['desktop', DESKTOP],
    ['mobile', MOBILE],
  ] as const) {
    it(`keeps ✓/✕ on screen for edge plots (${name})`, () => {
      const l = planningLayout(screen);
      for (const plot of [0, 4, 10, 14, 20, 24]) {
        const cell = plotScreenRect(l, plot);
        const { confirm, cancel } = confirmFor(l, cell, screen);
        for (const b of [confirm, cancel]) {
          expect(inside(b, screen), `plot ${plot}: ${JSON.stringify(b)}`).toBe(true);
          expect(b.w).toBeGreaterThanOrEqual(44);
          expect(b.h).toBeGreaterThanOrEqual(44);
          expect(overlaps(b, cell), `plot ${plot} covered`).toBe(false);
        }
        expect(overlaps(confirm, cancel)).toBe(false);
      }
    });
  }

  it('flips to the left of a plot that has no room on the right', () => {
    const l = planningLayout(DESKTOP);
    const cell: Rect = { x: 1200, y: 300, w: 64, h: 64 };
    const { confirm, cancel } = confirmFor(l, cell, DESKTOP);
    expect(confirm.x + confirm.w).toBeLessThanOrEqual(cell.x);
    expect(cancel.x + cancel.w).toBeLessThanOrEqual(cell.x);
  });

  it('uses the row above the board on mobile', () => {
    const l = planningLayout(MOBILE);
    const { confirm, cancel } = confirmFor(l, plotScreenRect(l, 7), MOBILE);
    expect(confirm).toEqual(l.confirm);
    expect(cancel).toEqual(l.cancel);
    expect(confirm.y + confirm.h).toBeLessThanOrEqual(l.board.y);
  });
});

describe('battleZoom', () => {
  it('follows §10.7: max(1, floor(min(w, h + 96) / field))', () => {
    expect(battleZoom(1280, 720)).toBe(2);
    expect(battleZoom(375, 812)).toBe(1);
    // min(1920, 1176) / 384 = 3.06 → 3 (the brief listed 2; the spec formula gives 3).
    expect(battleZoom(1920, 1080)).toBe(3);
    expect(battleZoom(100, 100)).toBe(1);
  });
});

describe('battleLayout', () => {
  for (const [name, screen] of [
    ['desktop', DESKTOP],
    ['mobile', MOBILE],
  ] as const) {
    it(`places the battle HUD on screen without overlaps (${name})`, () => {
      const l = battleLayout(screen);
      expect(l.clock.w).toBe(260);
      expect(l.clock.h).toBe(52);
      expect(l.foes.w).toBe(140);
      expect(l.foes.h).toBe(52);
      expect(l.speed).toHaveLength(4);
      l.speed.forEach((b, i) => {
        expect(b.w).toBe(48);
        expect(b.h).toBe(48);
        if (i > 0) expect(b.x - (l.speed[i - 1]!.x + 48)).toBe(2);
        expect(b.y).toBe(l.speed[0]!.y);
      });
      expect(l.speed[0]!.x).toBe(10);
      expect(l.speed[0]!.y + 48).toBe(screen.h - 10);
      expect(l.intervene).toEqual({ x: screen.w - 10 - 72, y: screen.h - 10 - 72, w: 72, h: 72 });
      const all = { clock: l.clock, lives: l.lives, foes: l.foes, intervene: l.intervene };
      l.speed.forEach((b, i) => Object.assign(all, { [`speed${i}`]: b }));
      for (const r of Object.values(all)) expect(inside(r, screen), JSON.stringify(r)).toBe(true);
      expectSeparate(all);
    });
  }

  it('ends the intervene button 10 px from the bottom-right corner on desktop', () => {
    const { intervene } = battleLayout(DESKTOP);
    expect(intervene.x + intervene.w).toBe(1270);
    expect(intervene.y + intervene.h).toBe(710);
  });

  it('reuses the planning lives panel', () => {
    expect(battleLayout(DESKTOP).lives).toEqual(planningLayout(DESKTOP).lives);
    expect(battleLayout(MOBILE).lives).toEqual(planningLayout(MOBILE).lives);
  });
});

describe('cameraScroll / screenToWorld', () => {
  it('are inverses', () => {
    const world = { x: 192, y: 192 };
    const target = { x: 640, y: 340 };
    const scroll = cameraScroll(world, target, DESKTOP, 2);
    const back = screenToWorld(target, scroll, DESKTOP, 2);
    expect(Math.abs(back.x - world.x)).toBeLessThan(1e-9);
    expect(Math.abs(back.y - world.y)).toBeLessThan(1e-9);
  });

  it('matches Phaser: screen = mid + (p − scroll − mid) · zoom', () => {
    const world = { x: 100, y: 50 };
    const target = { x: 300, y: 600 };
    for (const zoom of [1, 2, 3]) {
      const s = cameraScroll(world, target, MOBILE, zoom);
      const mid = { x: MOBILE.w / 2, y: MOBILE.h / 2 };
      expect(mid.x + (world.x - s.x - mid.x) * zoom).toBeCloseTo(target.x, 9);
      expect(mid.y + (world.y - s.y - mid.y) * zoom).toBeCloseTo(target.y, 9);
    }
  });

  it('centres the world point with zoom 1 at screen mid', () => {
    expect(cameraScroll({ x: 192, y: 192 }, { x: 640, y: 360 }, DESKTOP, 1)).toEqual({
      x: 192 - 640,
      y: 192 - 360,
    });
  });
});
