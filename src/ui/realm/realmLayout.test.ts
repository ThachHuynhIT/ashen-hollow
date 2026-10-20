import { describe, expect, it } from 'vitest';
import { CARD_LIFT, type Rect, type Size } from '../hud/layout';
import {
  PLANNING_ZOOM,
  battleCamera,
  centerHand,
  battleLayout,
  battleWorldAt,
  battleZoom,
  cameraScroll,
  confirmFor,
  isDesktop,
  planningLayout,
  plotAtScreen,
  planningZoom,
  plotScreenRect,
  realmCamera,
  realmCameraMix,
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
    expect(l.board).toEqual({ x: 480, y: 200, w: 320, h: 320 });
    expect(l.zoom).toBe(2);
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
    expect(l.zoom).toBe(2);
    expect(l.hand).toHaveLength(3);
    expect(l.hand[0]).toEqual({ x: 18, y: 650, w: 108, h: 152 });
    expect(l.hand[1]!.x).toBe(134);
    expect(l.scout).toEqual({ x: 10, y: 508, w: 355, h: 130 });
  });

  for (const [name, screen] of [
    ['desktop', DESKTOP],
    ['mobile', MOBILE],
  ] as const) {
    it(`leaves room for a lifted selected card under the panels above the hand (${name})`, () => {
      const l = planningLayout(screen);
      for (const card of l.hand) {
        const lifted = { ...card, y: card.y - CARD_LIFT };
        expectSeparate({ lifted, scout: l.scout, board: l.board, skip: l.skip });
      }
    });
  }

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
      { w: 900, h: 600 },
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
    expect(plotScreenRect(l, 12)).toEqual({ x: 608, y: 328, w: 64, h: 64 });
    expect(plotScreenRect(l, 0)).toEqual({ x: l.board.x, y: l.board.y, w: 64, h: 64 });
    expect(plotScreenRect(l, 24)).toEqual({ x: 480 + 256, y: 200 + 256, w: 64, h: 64 });
  });
});

describe('centerHand', () => {
  for (const [name, screen] of [
    ['desktop', DESKTOP],
    ['mobile', MOBILE],
  ] as const) {
    it(`centres 1–3 cards on the hand row and keeps them apart and on screen (${name})`, () => {
      const slots = planningLayout(screen).hand;
      const rowCentre = (slots[0]!.x + slots[2]!.x + slots[2]!.w) / 2;
      expect(centerHand(slots, 3)).toEqual([...slots]);
      for (const n of [2, 1]) {
        const placed = centerHand(slots, n);
        expect(placed).toHaveLength(n);
        const left = placed[0]!.x;
        const right = placed[n - 1]!.x + placed[n - 1]!.w;
        expect(Math.abs((left + right) / 2 - rowCentre)).toBeLessThanOrEqual(0.5);
        placed.forEach((r, i) => {
          expect(r.y).toBe(slots[i]!.y);
          expect(r.w).toBe(slots[i]!.w);
          expect(inside(r, screen)).toBe(true);
        });
        if (n === 2) expect(placed[1]!.x - (placed[0]!.x + placed[0]!.w)).toBe(slots[1]!.x - (slots[0]!.x + slots[0]!.w));
      }
    });
  }

  it('returns no slots for an empty hand and never more than the row holds', () => {
    const slots = planningLayout(DESKTOP).hand;
    expect(centerHand(slots, 0)).toEqual([]);
    expect(centerHand(slots, 7)).toEqual([...slots]);
    expect(centerHand([], 2)).toEqual([]);
  });
});

describe('planningZoom / realmCamera', () => {
  it('uses the battle zoom on desktop and zoom 2 on mobile', () => {
    expect(planningZoom(DESKTOP)).toBe(2);
    expect(planningZoom({ w: 1920, h: 1080 })).toBe(3);
    expect(planningZoom(MOBILE)).toBe(PLANNING_ZOOM);
  });

  for (const screen of [DESKTOP, { w: 1920, h: 1080 }, { w: 1024, h: 768 }]) {
    it(`gives planning and battle the same camera on desktop ${screen.w}×${screen.h}`, () => {
      const planning = realmCamera(screen, 'planning');
      const battle = realmCamera(screen, 'battle');
      expect(planning.zoom).toBe(battle.zoom);
      expect(planning.scroll.x).toBeCloseTo(battle.scroll.x, 9);
      expect(planning.scroll.y).toBeCloseTo(battle.scroll.y, 9);
    });

    it(`centres the board on the screen and clear of the hand on ${screen.w}×${screen.h}`, () => {
      const l = planningLayout(screen);
      expect(l.board.x + l.board.w / 2).toBeCloseTo(screen.w / 2, 9);
      expect(l.board.y + l.board.h / 2).toBeCloseTo(screen.h / 2, 9);
      expect(l.board.y + l.board.h).toBeLessThanOrEqual(l.hand[0]!.y);
    });
  }

  it('keeps zoom 2 for planning and zoom 1 for the battle on mobile', () => {
    expect(realmCamera(MOBILE, 'planning').zoom).toBe(2);
    expect(realmCamera(MOBILE, 'battle').zoom).toBe(1);
  });

  it('puts the board centre (throne) where planningLayout drew the board', () => {
    for (const screen of [DESKTOP, MOBILE, { w: 1920, h: 1080 }]) {
      const l = planningLayout(screen);
      const cam = realmCamera(screen, 'planning');
      const p = screenToWorld({ x: l.board.x, y: l.board.y }, cam.scroll, screen, cam.zoom);
      expect(p.x).toBeCloseTo(112, 6); // BATTLE.boardOrigin: the board's top-left corner
      expect(p.y).toBeCloseTo(112, 6);
    }
  });
});

describe('realmCameraMix', () => {
  it('equals the planning camera at 0 and the battle camera at 1', () => {
    for (const screen of [DESKTOP, MOBILE]) {
      const start = realmCameraMix(screen, 'planning', 'battle', 0);
      const end = realmCameraMix(screen, 'planning', 'battle', 1);
      const planning = realmCamera(screen, 'planning');
      const battle = realmCamera(screen, 'battle');
      expect(start.zoom).toBeCloseTo(planning.zoom, 9);
      expect(start.scroll.x).toBeCloseTo(planning.scroll.x, 6);
      expect(start.scroll.y).toBeCloseTo(planning.scroll.y, 6);
      expect(end.zoom).toBeCloseTo(battle.zoom, 9);
      expect(end.scroll.x).toBeCloseTo(battle.scroll.x, 6);
      expect(end.scroll.y).toBeCloseTo(battle.scroll.y, 6);
    }
  });

  it('eases the zoom between 2 and 1 on mobile and keeps the throne on screen', () => {
    const mid = realmCameraMix(MOBILE, 'planning', 'battle', 0.5);
    expect(mid.zoom).toBeCloseTo(1.5, 9);
    const throne = screenToWorld({ x: MOBILE.w / 2, y: MOBILE.h / 2 }, mid.scroll, MOBILE, mid.zoom);
    expect(Math.abs(throne.x - 192)).toBeLessThan(200);
  });

  it('is constant on desktop where both phases share the camera', () => {
    const a = realmCameraMix(DESKTOP, 'planning', 'battle', 0.3);
    const b = realmCamera(DESKTOP, 'battle');
    expect(a.zoom).toBe(b.zoom);
    expect(a.scroll.x).toBeCloseTo(b.scroll.x, 6);
    expect(a.scroll.y).toBeCloseTo(b.scroll.y, 6);
  });
});

describe('plotAtScreen over every plot', () => {
  for (const screen of [DESKTOP, MOBILE, { w: 1920, h: 1080 }]) {
    it(`inverts plotScreenRect for plots 0..24 on ${screen.w}×${screen.h}`, () => {
      const l = planningLayout(screen);
      for (let plot = 0; plot < 25; plot++) {
        const r = plotScreenRect(l, plot);
        expect(plotAtScreen(l, { x: r.x + r.w / 2, y: r.y + r.h / 2 })).toBe(plot);
      }
    });
  }
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
      for (const b of [l.auto, l.waves, l.intervene]) {
        expect(b.w).toBeGreaterThanOrEqual(44);
        expect(b.h).toBeGreaterThanOrEqual(44);
      }
      expect(l.auto.x + l.auto.w).toBe(l.intervene.x + l.intervene.w); // right-aligned above Can Thiệp
      expect(l.auto.y + l.auto.h).toBeLessThanOrEqual(l.intervene.y);
      expect(l.waves.x + l.waves.w).toBe(l.foes.x + l.foes.w); // right-aligned below the foes panel
      expect(l.waves.y).toBeGreaterThanOrEqual(l.foes.y + l.foes.h);
      const all = {
        clock: l.clock,
        lives: l.lives,
        foes: l.foes,
        intervene: l.intervene,
        auto: l.auto,
        waves: l.waves,
      };
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

describe('battleCamera / battleWorldAt', () => {
  it('centres the throne (plot 12, world 192,192) on screen', () => {
    for (const screen of [DESKTOP, MOBILE]) {
      const mid = { x: screen.w / 2, y: screen.h / 2 };
      const p = battleWorldAt(mid, screen)!;
      expect(p.x).toBeCloseTo(192, 9);
      expect(p.y).toBeCloseTo(192, 9);
    }
    expect(battleCamera(DESKTOP).zoom).toBe(2);
    expect(battleCamera(MOBILE).zoom).toBe(1);
  });

  it('maps screen offsets by 1 / zoom and returns null off the field', () => {
    const p = battleWorldAt({ x: 640 + 100, y: 360 - 50 }, DESKTOP)!;
    expect(p.x).toBeCloseTo(242, 9);
    expect(p.y).toBeCloseTo(167, 9);
    // Desktop shows world x 192 ± 320: the screen's left edge is off the field.
    expect(battleWorldAt({ x: 0, y: 360 }, DESKTOP)).toBeNull();
    expect(battleWorldAt({ x: 187.5 - 192, y: 406 }, MOBILE)!.x).toBeCloseTo(0, 9);
    expect(battleWorldAt({ x: 187.5 - 193, y: 406 }, MOBILE)).toBeNull();
  });
});
