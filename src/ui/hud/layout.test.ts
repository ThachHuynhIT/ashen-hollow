import { describe, expect, it } from 'vitest';
import {
  clampScroll,
  ellipsize,
  fitHotbar,
  hotbarSlotX,
  hotbarWidth,
  iconScale,
  overlapsX,
  placeAbove,
  placeTooltip,
  pushToast,
  textContent,
  toastText,
  uiScaleFor,
  type ToastEntry,
} from './layout';

/** Fake text measure: every character is 10 px wide. */
const chars = (s: string): number => s.length * 10;

describe('uiScaleFor', () => {
  it('uses 2× borders only when the short side is at least 600 px', () => {
    expect(uiScaleFor(1280, 720)).toBe(2);
    expect(uiScaleFor(600, 600)).toBe(2);
    expect(uiScaleFor(375, 812)).toBe(1);
    expect(uiScaleFor(812, 375)).toBe(1);
  });

  it('switches exactly at 600 px on either side', () => {
    expect(uiScaleFor(599, 1000)).toBe(1);
    expect(uiScaleFor(1000, 599)).toBe(1);
    expect(uiScaleFor(600, 1000)).toBe(2);
  });
});

describe('toasts', () => {
  it('adds new toasts at the bottom', () => {
    let list: ToastEntry[] = [];
    list = pushToast(list, 'a', 0, 1).list;
    list = pushToast(list, 'b', 10, 2).list;
    expect(list.map((t) => t.text)).toEqual(['a', 'b']);
  });

  it('merges the same text into ×2 and restarts its timer', () => {
    const first = pushToast([], 'Đã mở ô mới.', 0, 1);
    const second = pushToast(first.list, 'Đã mở ô mới.', 1000, 2);
    expect(second.merged).toBe(true);
    expect(second.list).toHaveLength(1);
    expect(second.list[0]).toMatchObject({ id: 1, count: 2, shownAt: 1000 });
    expect(toastText(second.list[0]!, 1000, chars)).toBe('Đã mở ô mới. ×2');
  });

  it('keeps at most four and drops the oldest at once', () => {
    let list: ToastEntry[] = [];
    for (let i = 1; i <= 4; i++) list = pushToast(list, `t${i}`, i, i).list;
    const r = pushToast(list, 't5', 5, 5);
    expect(r.list.map((t) => t.text)).toEqual(['t2', 't3', 't4', 't5']);
    expect(r.dropped.map((t) => t.id)).toEqual([1]);
  });

  it('merging into the oldest of a full stack drops nothing', () => {
    let list: ToastEntry[] = [];
    for (let i = 1; i <= 4; i++) list = pushToast(list, `t${i}`, i, i).list;
    const r = pushToast(list, 't1', 9, 5);
    expect(r.merged).toBe(true);
    expect(r.dropped).toEqual([]);
    expect(r.list.map((t) => [t.text, t.count])).toEqual([
      ['t1', 2],
      ['t2', 1],
      ['t3', 1],
      ['t4', 1],
    ]);
  });

  it('leaves text that fits and cuts the rest with …', () => {
    expect(ellipsize('Kho', 100, chars)).toBe('Kho');
    expect(ellipsize('abcdefghij', 50, chars)).toBe('abcd…');
  });

  it('keeps the ×N suffix when the text is cut', () => {
    const t: ToastEntry = { id: 1, text: 'Quân địch nổi cơn cuồng nộ!', count: 3, shownAt: 0 };
    const out = toastText(t, 150, chars);
    expect(out.endsWith('… ×3')).toBe(true);
    expect(chars(out)).toBeLessThanOrEqual(150);
  });
});

describe('tooltip placement', () => {
  const screen = { w: 1280, h: 720 };
  const size = { w: 200, h: 80 };

  it('sits below-right of the pointer', () => {
    expect(placeTooltip({ x: 100, y: 100 }, size, screen)).toEqual({ x: 116, y: 116 });
  });

  it('flips left at the right edge and up at the bottom edge', () => {
    expect(placeTooltip({ x: 1200, y: 100 }, size, screen)).toEqual({ x: 984, y: 116 });
    expect(placeTooltip({ x: 100, y: 700 }, size, screen)).toEqual({ x: 116, y: 604 });
  });

  it('clamps to the edge when neither side fits', () => {
    expect(placeTooltip({ x: 200, y: 100 }, { w: 300, h: 80 }, { w: 375, h: 812 })).toEqual({
      x: 71,
      y: 116,
    });
  });

  it('sticks to the edge when it is bigger than the screen', () => {
    expect(placeTooltip({ x: 150, y: 150 }, { w: 400, h: 900 }, { w: 320, h: 640 })).toEqual({
      x: 4,
      y: 4,
    });
  });

  it('puts a long-press tooltip above the control, or below when there is no room', () => {
    const phone = { w: 375, h: 812 };
    const tip = { w: 120, h: 40 };
    expect(placeAbove({ x: 100, y: 700, w: 48, h: 48 }, tip, phone)).toEqual({ x: 64, y: 654 });
    expect(placeAbove({ x: 0, y: 700, w: 48, h: 48 }, tip, phone)).toEqual({ x: 4, y: 654 });
    expect(placeAbove({ x: 100, y: 10, w: 48, h: 48 }, tip, phone)).toEqual({ x: 64, y: 64 });
  });
});

describe('hotbar', () => {
  it('uses 48 px slots and 4 px gaps when there is room', () => {
    expect(fitHotbar(6, 400)).toEqual({ slot: 48, gap: 4, width: 314, scroll: false });
  });

  it('tightens the gaps first, then shrinks slots to 44 px', () => {
    expect(fitHotbar(6, 310)).toEqual({ slot: 48, gap: 2, width: 302, scroll: false });
    expect(fitHotbar(6, 290)).toEqual({ slot: 44, gap: 2, width: 278, scroll: false });
  });

  it('scrolls instead of going under 44 px', () => {
    expect(fitHotbar(6, 250)).toEqual({ slot: 44, gap: 2, width: 278, scroll: true });
  });

  it('puts a divider after the tab slot', () => {
    expect(hotbarSlotX(0, 48, 4)).toBe(0);
    expect(hotbarSlotX(1, 48, 4)).toBe(58);
    expect(hotbarSlotX(2, 48, 4)).toBe(110);
    expect(hotbarWidth(3, 48, 4)).toBe(hotbarSlotX(2, 48, 4) + 48);
  });

  it('clamps the scroll offset to the content', () => {
    expect(clampScroll(50, 278, 250)).toBe(28);
    expect(clampScroll(-5, 278, 250)).toBe(0);
    expect(clampScroll(10, 200, 250)).toBe(0);
  });

  it('scales icons by the largest whole factor that fits 32 px, never below 1', () => {
    expect(iconScale(8, 8)).toBe(4);
    expect(iconScale(16, 16)).toBe(2);
    expect(iconScale(24, 20)).toBe(1);
    expect(iconScale(16, 40)).toBe(1);
  });
});

describe('helpers', () => {
  it('detects horizontal overlap (touching is not overlap)', () => {
    expect(overlapsX({ x: 0, w: 10 }, { x: 10, w: 5 })).toBe(false);
    expect(overlapsX({ x: 0, w: 11 }, { x: 10, w: 5 })).toBe(true);
  });

  it('turns description lines into tooltip content (first line = title)', () => {
    expect(textContent(['Tháp Cung', 'Bắn tên vào địch gần Ngai nhất.'])).toEqual({
      title: 'Tháp Cung',
      lines: [[{ text: 'Bắn tên vào địch gần Ngai nhất.' }]],
    });
    expect(textContent([])).toEqual({ title: undefined, lines: [] });
  });
});
