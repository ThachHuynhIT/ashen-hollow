import { MARGIN, type Rect, type Size } from './hud/layout';
import { isDesktop } from './realm/realmLayout';

/**
 * Pure layout of the king-select screen (§10.3): a title, three king slots, a detail panel
 * (name, blurb, throne, banner, the king's nine cards in a horizontally scrolling row), the
 * seed row and **Bắt đầu**. Desktop puts the slots in a column left of the panel; phones put
 * them in a row on top and pin the start button to the bottom. Rects are logical screen px.
 */

/** A mini card in the detail panel's row. */
export const KING_CARD = { w: 72, h: 100, gap: 6 } as const;

export interface KingSelectLayout {
  desktop: boolean;
  title: Rect;
  back: Rect;
  slots: readonly Rect[];
  detail: Rect;
  /** Name, blurb, throne and banner text, at the top of the detail panel. */
  text: Rect;
  /** The horizontal viewport of the card row, at the bottom of the detail panel. */
  cards: Rect;
  seed: Rect;
  reroll: Rect;
  start: Rect;
}

const GAP = 12;
const ROW_H = 44;
const SLOTS = 3;

export const kingSelectLayout = (screen: Size, inset: number): KingSelectLayout => {
  const { w, h } = screen;
  const desktop = isDesktop(w);
  const back = { x: MARGIN, y: MARGIN, w: desktop ? 120 : 96, h: 48 };
  let title: Rect;
  let slots: Rect[];
  let detail: Rect;
  let seed: Rect;
  let reroll: Rect;
  let start: Rect;

  if (desktop) {
    start = { x: Math.round((w - 200) / 2), y: Math.max(0, h - 24 - 52), w: 200, h: 52 };
    const seedY = start.y - GAP - ROW_H;
    const colW = 96 + 24 + 560;
    const x0 = Math.max(MARGIN, Math.round((w - colW) / 2));
    const detailY = 100;
    detail = {
      x: x0 + 96 + 24,
      y: detailY,
      w: Math.min(560, Math.max(0, w - x0 - 96 - 24 - MARGIN)),
      h: Math.max(0, Math.min(420, seedY - GAP - detailY)),
    };
    title = { x: back.x + back.w + GAP, y: 20, w: Math.max(0, w - 2 * (back.x + back.w + GAP)), h: 44 };
    slots = Array.from({ length: SLOTS }, (_, i) => ({ x: x0, y: detailY + i * (96 + GAP), w: 96, h: 96 }));
    reroll = { x: detail.x + detail.w - 160, y: seedY, w: 160, h: ROW_H };
    seed = { x: detail.x, y: seedY, w: Math.max(0, detail.w - 160 - GAP), h: ROW_H };
  } else {
    start = { x: MARGIN, y: Math.max(0, h - MARGIN - 56), w: Math.max(0, w - 2 * MARGIN), h: 56 };
    const seedY = start.y - 8 - ROW_H;
    title = { x: back.x + back.w + GAP, y: 14, w: Math.max(0, w - 2 * (back.x + back.w + GAP)), h: 40 };
    const rowW = SLOTS * 100 + (SLOTS - 1) * 8;
    const sx = Math.round((w - rowW) / 2);
    slots = Array.from({ length: SLOTS }, (_, i) => ({ x: sx + i * 108, y: 72, w: 100, h: 100 }));
    const detailY = 72 + 100 + GAP;
    detail = { x: MARGIN, y: detailY, w: Math.max(0, w - 2 * MARGIN), h: Math.max(0, seedY - 8 - detailY) };
    reroll = { x: MARGIN + detail.w - 120, y: seedY, w: 120, h: ROW_H };
    seed = { x: MARGIN, y: seedY, w: Math.max(0, detail.w - 120 - 8), h: ROW_H };
  }

  const cards = {
    x: detail.x + inset,
    y: detail.y + detail.h - inset - KING_CARD.h,
    w: Math.max(0, detail.w - 2 * inset),
    h: KING_CARD.h,
  };
  const text = {
    x: detail.x + inset,
    y: detail.y + inset,
    w: Math.max(0, detail.w - 2 * inset),
    h: Math.max(0, cards.y - GAP - (detail.y + inset)),
  };
  return { desktop, title, back, slots, detail, text, cards, seed, reroll, start };
};

export interface KingCardRow {
  /** Every card slot at its scrolled position. */
  cards: readonly Rect[];
  scroll: number;
  maxScroll: number;
  /** Indices of the cards fully inside the viewport. */
  visible: readonly number[];
}

/** `count` mini cards in a row inside `viewport`, scrolled by `scroll` px (clamped). */
export const kingCardRow = (viewport: Rect, count: number, scroll: number): KingCardRow => {
  const step = KING_CARD.w + KING_CARD.gap;
  const total = count === 0 ? 0 : count * step - KING_CARD.gap;
  const maxScroll = Math.max(0, total - viewport.w);
  const at = Math.max(0, Math.min(scroll, maxScroll));
  const cards = Array.from({ length: count }, (_, i) => ({
    x: viewport.x + i * step - at,
    y: viewport.y,
    w: KING_CARD.w,
    h: KING_CARD.h,
  }));
  const visible = cards.flatMap((c, i) =>
    c.x >= viewport.x && c.x + c.w <= viewport.x + viewport.w ? [i] : [],
  );
  return { cards, scroll: at, maxScroll, visible };
};
