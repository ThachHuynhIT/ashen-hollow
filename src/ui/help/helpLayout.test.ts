import { describe, expect, it } from 'vitest';
import type { Rect, Size } from '../hud/layout';
import { HELP_TAB_COUNT, helpLayout } from './helpLayout';

const hits = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r: Rect, outer: Rect): boolean =>
  r.x >= outer.x && r.y >= outer.y && r.x + r.w <= outer.x + outer.w && r.y + r.h <= outer.y + outer.h;

const pcSizes: Size[] = [
  { w: 1280, h: 720 },
  { w: 1920, h: 1080 },
];

describe('help_layout_inside_screen', () => {
  it('fits the screen with a 10 px margin and the declared maxima', () => {
    const a = helpLayout(pcSizes[0]!);
    expect(a.panel.w).toBeLessThanOrEqual(1120);
    expect(a.panel.h).toBeLessThanOrEqual(660);
    expect(a.panel.x).toBeGreaterThanOrEqual(10);
    expect(a.panel.y).toBeGreaterThanOrEqual(10);
    const b = helpLayout(pcSizes[1]!);
    expect(b.panel.w).toBeLessThanOrEqual(1440);
    expect(b.panel.h).toBeLessThanOrEqual(960);
    expect(b.panel.w).toBeGreaterThan(a.panel.w);
  });

  it('keeps every part inside the panel, none overlapping, hit areas at least 44 and close 48', () => {
    for (const screen of pcSizes) {
      const l = helpLayout(screen);
      const parts: Record<string, Rect> = {
        close: l.close,
        viewport: l.viewport,
        detail: l.detail,
        ...Object.fromEntries(l.tabs.map((t, i) => [`tab${i}`, t])),
        ...Object.fromEntries(l.filters.map((f, i) => [`filter${i}`, f])),
      };
      expect(l.tabs).toHaveLength(HELP_TAB_COUNT);
      expect(l.close.w).toBeGreaterThanOrEqual(48);
      expect(l.close.h).toBeGreaterThanOrEqual(48);
      const names = Object.keys(parts);
      for (const n of names) {
        expect(inside(parts[n]!, l.panel), `${screen.w} ${n} inside`).toBe(true);
        if (n.startsWith('tab') || n.startsWith('filter')) {
          expect(parts[n]!.w, n).toBeGreaterThanOrEqual(44);
          expect(parts[n]!.h, n).toBeGreaterThanOrEqual(44);
        }
      }
      for (let i = 0; i < names.length; i++)
        for (let j = i + 1; j < names.length; j++)
          expect(hits(parts[names[i]!]!, parts[names[j]!]!), `${screen.w} ${names[i]} vs ${names[j]}`).toBe(false);
      expect(l.viewport.h).toBeGreaterThan(200);
      expect(inside(l.wide, l.panel)).toBe(true);
    }
  });

  it('still produces an on-screen panel on a phone-sized screen', () => {
    const l = helpLayout({ w: 375, h: 812 });
    expect(inside(l.panel, { x: 0, y: 0, w: 375, h: 812 })).toBe(true);
    expect(l.close.w).toBeGreaterThanOrEqual(48);
  });
});
