import { describe, expect, it } from 'vitest';
import { battleLayout, planningLayout } from '../realm/realmLayout';
import type { Point, Rect, Size } from '../hud/layout';
import { inspectionLayout, scrollLinesForDrag, scrollLinesForWheel } from './inspectionLayout';

const SCREENS: Size[] = [
  { w: 1280, h: 720 },
  { w: 1920, h: 1080 },
];

/** Every Rect the layout object holds (arrays and nested objects included). */
const rectsOf = (value: unknown, skip: readonly string[] = []): Rect[] => {
  if (Array.isArray(value)) return value.flatMap((v) => rectsOf(v, skip));
  if (value === null || typeof value !== 'object') return [];
  const o = value as Record<string, unknown>;
  if (['x', 'y', 'w', 'h'].every((k) => typeof o[k] === 'number')) return [o as unknown as Rect];
  return Object.entries(o).flatMap(([k, v]) => (skip.includes(k) ? [] : rectsOf(v, skip)));
};

const hits = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r: Rect, s: Size): boolean => r.x >= 0 && r.y >= 0 && r.x + r.w <= s.w && r.y + r.h <= s.h;

const corners = (s: Size): Point[] => [
  { x: 4, y: 4 },
  { x: s.w - 4, y: 4 },
  { x: 4, y: s.h - 4 },
  { x: s.w - 4, y: s.h - 4 },
  { x: s.w / 2, y: s.h / 2 },
];

describe('inspectionLayout', () => {
  it('inspection_layout_avoids_controls: long content stays on screen and off every control, in both PC sizes', () => {
    for (const screen of SCREENS) {
      const reserved = [
        ...rectsOf(planningLayout(screen, 4), ['board', 'hint', 'scout', 'decreePanel']),
        ...rectsOf(battleLayout(screen)),
      ];
      for (const anchor of corners(screen)) {
        const out = inspectionLayout(screen, anchor, { w: 400, h: 2000 }, reserved, true);
        const tag = `${screen.w}x${screen.h} @${anchor.x},${anchor.y}`;
        expect(inside(out.panel, screen), tag).toBe(true);
        expect(inside(out.close, screen), tag).toBe(true);
        expect(out.panel.w, tag).toBeLessThanOrEqual(320);
        expect(out.panel.h, tag).toBeLessThanOrEqual(480);
        expect(out.close.w, tag).toBeGreaterThanOrEqual(48);
        expect(out.close.h, tag).toBeGreaterThanOrEqual(48);
        for (const r of reserved) expect(hits(out.panel, r), `${tag} ${JSON.stringify(r)}`).toBe(false);
        expect(out.viewport.h, tag).toBeGreaterThan(0);
        expect(out.unitButton, tag).not.toBeNull();
        expect(inside(out.unitButton!, screen), tag).toBe(true);
      }
    }
  });

  it('keeps the panel as small as its content when the content is short', () => {
    const screen = SCREENS[0]!;
    const out = inspectionLayout(screen, { x: 200, y: 200 }, { w: 200, h: 100 }, [], false);
    expect(out.panel.h).toBeLessThan(200);
    expect(out.unitButton).toBeNull();
  });
});

describe('scroll input maths', () => {
  it('turns wheel notches into whole lines and ignores zero', () => {
    expect(scrollLinesForWheel(120)).toBe(3);
    expect(scrollLinesForWheel(-120)).toBe(-3);
    expect(scrollLinesForWheel(0)).toBe(0);
  });

  it('turns a drag into lines only past the click slop, and keeps the remainder', () => {
    expect(scrollLinesForDrag(0, 4)).toEqual({ lines: 0, remainder: 4, dragging: false });
    const moved = scrollLinesForDrag(0, 30);
    expect(moved.dragging).toBe(true);
    expect(moved.lines).toBe(-Math.trunc(30 / 14));
    expect(moved.remainder).toBe(30 % 14);
  });
});
