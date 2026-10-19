import { MARGIN, type Rect, type Size } from '../hud/layout';
import { isDesktop } from '../realm/realmLayout';

/**
 * Pure layout of the realm modals (§10.5, §10.6): a centred `panel` over a dimming overlay.
 * `inset` is the panel's border plus padding at the current uiScale (screen px).
 */

/** ✕ close button of every side panel (§10.5). */
export const CLOSE_BUTTON = 48;

/** A `w`×`h` panel centred on screen, shrunk to fit inside the margins. */
export const centredPanel = (screen: Size, w: number, h: number): Rect => {
  const pw = Math.max(0, Math.min(w, screen.w - 2 * MARGIN));
  const ph = Math.max(0, Math.min(h, screen.h - 2 * MARGIN));
  return {
    x: Math.round((screen.w - pw) / 2),
    y: Math.round((screen.h - ph) / 2),
    w: pw,
    h: ph,
  };
};

export interface RewardLayout {
  panel: Rect;
  title: Rect;
  /** Card slots at rest; a selected card lifts 12 px into the gap above. */
  cards: readonly Rect[];
  skip: Rect;
  take: Rect;
}

const TITLE_H = 28;
const CARD_LIFT = 12;
const GAP_ABOVE_CARDS = 8;
const GAP_BELOW_CARDS = 16;
const BUTTON_GAP = 16;

/** "Bỏ qua" / "Nhận" (the same size in both layouts). */
export const REWARD_BUTTON = { w: 150, h: 48 } as const;
const REWARD_DESK = { card: { w: 150, h: 210, gap: 16 }, button: REWARD_BUTTON } as const;
const REWARD_PHONE = { card: { w: 108, h: 152, gap: 5 }, button: REWARD_BUTTON } as const;

/** §10.6 reward picker: title, `count` cards in a row, then "Bỏ qua" and "Nhận". */
export const rewardLayout = (screen: Size, inset: number, count = 3): RewardLayout => {
  const spec = isDesktop(screen.w) ? REWARD_DESK : REWARD_PHONE;
  const { card, button } = spec;
  const n = Math.max(1, count);
  const row = n * card.w + (n - 1) * card.gap;
  const buttons = 2 * button.w + BUTTON_GAP;
  const w = Math.max(row, buttons) + 2 * inset;
  const h =
    inset + TITLE_H + GAP_ABOVE_CARDS + CARD_LIFT + card.h + GAP_BELOW_CARDS + button.h + inset;
  const panel = centredPanel(screen, w, h);
  const title = { x: panel.x + inset, y: panel.y + inset, w: panel.w - 2 * inset, h: TITLE_H };
  const cardY = title.y + TITLE_H + GAP_ABOVE_CARDS + CARD_LIFT;
  const x0 = Math.round(panel.x + (panel.w - row) / 2);
  const cards = Array.from({ length: n }, (_, i) => ({
    x: x0 + i * (card.w + card.gap),
    y: cardY,
    w: card.w,
    h: card.h,
  }));
  const by = cardY + card.h + GAP_BELOW_CARDS;
  const bx = Math.round(panel.x + (panel.w - buttons) / 2);
  return {
    panel,
    title,
    cards,
    skip: { x: bx, y: by, w: button.w, h: button.h },
    take: { x: bx + button.w + BUTTON_GAP, y: by, w: button.w, h: button.h },
  };
};
