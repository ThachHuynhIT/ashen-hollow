import { CARD_LIFT, MARGIN, type Rect, type Size } from '../hud/layout';
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
  take: Rect;
}

const TITLE_H = 28;
const GAP_ABOVE_CARDS = 8;
const GAP_BELOW_CARDS = 16;
const BUTTON_GAP = 16;

/** "Nhận" (the same size in both layouts). */
export const REWARD_BUTTON = { w: 150, h: 48 } as const;
const REWARD_DESK = { card: { w: 150, h: 210, gap: 16 }, button: REWARD_BUTTON } as const;
const REWARD_PHONE = { card: { w: 108, h: 152, gap: 5 }, button: REWARD_BUTTON } as const;

/** §10.6 reward picker: title, `count` cards in a row, then "Nhận". */
export const rewardLayout = (screen: Size, inset: number, count = 3): RewardLayout => {
  const spec = isDesktop(screen.w) ? REWARD_DESK : REWARD_PHONE;
  const { card, button } = spec;
  const n = Math.max(1, count);
  const row = n * card.w + (n - 1) * card.gap;
  const w = Math.max(row, button.w) + 2 * inset;
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
  const bx = Math.round(panel.x + (panel.w - button.w) / 2);
  return { panel, title, cards, take: { x: bx, y: by, w: button.w, h: button.h } };
};

export interface ResultLayout {
  panel: Rect;
  title: Rect;
  /** One row per text line under the title. */
  lines: readonly Rect[];
  /** A centred row of buttons at the bottom. */
  buttons: readonly Rect[];
}

/** Buttons of the result panels ("Tiếp tục", "Về menu", "Ván mới"). */
export const RESULT_BUTTON = { w: 140, h: 52 } as const;
const RESULT = { w: 420, titleH: 40, lineH: 26, gapAboveLines: 8, gapAboveButtons: 20 } as const;

/**
 * A result panel (battle summary §10.7, run end §10.8): a title, `lineCount` text rows and
 * `buttonCount` buttons side by side, centred on screen; 420 px wide, narrower on phones.
 */
export const resultLayout = (
  screen: Size,
  inset: number,
  lineCount: number,
  buttonCount: number,
): ResultLayout => {
  const n = Math.max(1, buttonCount);
  const row = n * RESULT_BUTTON.w + (n - 1) * BUTTON_GAP;
  const w = Math.max(RESULT.w, row + 2 * inset);
  const h =
    inset +
    RESULT.titleH +
    RESULT.gapAboveLines +
    lineCount * RESULT.lineH +
    RESULT.gapAboveButtons +
    RESULT_BUTTON.h +
    inset;
  const panel = centredPanel(screen, w, h);
  const innerW = panel.w - 2 * inset;
  const title = { x: panel.x + inset, y: panel.y + inset, w: innerW, h: RESULT.titleH };
  const y0 = title.y + title.h + RESULT.gapAboveLines;
  const lines = Array.from({ length: lineCount }, (_, i) => ({
    x: title.x,
    y: y0 + i * RESULT.lineH,
    w: innerW,
    h: RESULT.lineH,
  }));
  const by = y0 + lineCount * RESULT.lineH + RESULT.gapAboveButtons;
  const bx = Math.round(panel.x + (panel.w - row) / 2);
  const buttons = Array.from({ length: n }, (_, i) => ({
    x: bx + i * (RESULT_BUTTON.w + BUTTON_GAP),
    y: by,
    w: RESULT_BUTTON.w,
    h: RESULT_BUTTON.h,
  }));
  return { panel, title, lines, buttons };
};

export interface CalendarModalLayout {
  panel: Rect;
  title: Rect;
  close: Rect;
  /** The 15 years, row-major in 5 columns. */
  cells: readonly Rect[];
}

const CAL_COLS = 5;
const CAL_ROWS = 3;

/** Whole-run calendar (§10.4 "L"): 15 years in a 5×3 grid under a title with a ✕. */
export const calendarModalLayout = (screen: Size, inset: number): CalendarModalLayout => {
  const desktop = isDesktop(screen.w);
  const cell = desktop ? 72 : 56;
  const gap = desktop ? 8 : 6;
  const gridW = CAL_COLS * cell + (CAL_COLS - 1) * gap;
  const gridH = CAL_ROWS * cell + (CAL_ROWS - 1) * gap;
  const w = gridW + 2 * inset;
  const h = inset + CLOSE_BUTTON + GAP_ABOVE_CARDS + gridH + inset;
  const panel = centredPanel(screen, w, h);
  const innerX = panel.x + inset;
  const innerW = panel.w - 2 * inset;
  const close = { x: innerX + innerW - CLOSE_BUTTON, y: panel.y + inset, w: CLOSE_BUTTON, h: CLOSE_BUTTON };
  const title = {
    x: innerX,
    y: panel.y + inset,
    w: Math.max(0, innerW - CLOSE_BUTTON - BUTTON_GAP),
    h: CLOSE_BUTTON,
  };
  const y0 = panel.y + inset + CLOSE_BUTTON + GAP_ABOVE_CARDS;
  const x0 = Math.round(panel.x + (panel.w - gridW) / 2);
  const cells = Array.from({ length: CAL_COLS * CAL_ROWS }, (_, i) => ({
    x: x0 + (i % CAL_COLS) * (cell + gap),
    y: y0 + Math.floor(i / CAL_COLS) * (cell + gap),
    w: cell,
    h: cell,
  }));
  return { panel, title, close, cells };
};

export interface DeckModalLayout {
  panel: Rect;
  title: Rect;
  close: Rect;
  /** Filter tabs (All, buildings, enchantments, tomes), left to right. */
  tabs: readonly Rect[];
  /** The scrolling area: only cards fully inside it are shown. */
  viewport: Rect;
  cols: number;
  /** Every card slot at its scrolled position (some are outside the viewport). */
  cards: readonly Rect[];
  scroll: number;
  maxScroll: number;
  /** Distance between two rows: the scroll step. */
  rowStep: number;
  /** Indices of the cards fully inside the viewport. */
  visible: readonly number[];
}

export const DECK_CARD = { w: 96, h: 134 } as const;
export const DECK_TAB_COUNT = 4;
const DECK_GAP = 8;
const DECK_TAB_H = 44;

/** Deck viewer (§10.4 "Bộ bài"): 6 columns on desktop, 3 on phones; `scroll` is clamped. */
export const deckModalLayout = (
  screen: Size,
  inset: number,
  count: number,
  scroll: number,
): DeckModalLayout => {
  const cols = isDesktop(screen.w) ? 6 : 3;
  const gridW = cols * DECK_CARD.w + (cols - 1) * DECK_GAP;
  const panelW = gridW + 2 * inset;
  const panelH = Math.min(640, screen.h - 2 * MARGIN);
  const panel = centredPanel(screen, panelW, panelH);
  const innerX = panel.x + inset;
  const innerW = panel.w - 2 * inset;
  const close = { x: innerX + innerW - CLOSE_BUTTON, y: panel.y + inset, w: CLOSE_BUTTON, h: CLOSE_BUTTON };
  const title = {
    x: innerX,
    y: panel.y + inset,
    w: Math.max(0, innerW - CLOSE_BUTTON - BUTTON_GAP),
    h: CLOSE_BUTTON,
  };
  const tabY = panel.y + inset + CLOSE_BUTTON + DECK_GAP;
  const tabW = Math.floor((innerW - (DECK_TAB_COUNT - 1) * DECK_GAP) / DECK_TAB_COUNT);
  const tabs = Array.from({ length: DECK_TAB_COUNT }, (_, i) => ({
    x: innerX + i * (tabW + DECK_GAP),
    y: tabY,
    w: tabW,
    h: DECK_TAB_H,
  }));
  const vy = tabY + DECK_TAB_H + DECK_GAP;
  const viewport = {
    x: Math.round(panel.x + (panel.w - gridW) / 2),
    y: vy,
    w: gridW,
    h: Math.max(0, panel.y + panel.h - inset - vy),
  };
  const rowStep = DECK_CARD.h + DECK_GAP;
  const rows = Math.ceil(count / cols);
  const contentH = rows === 0 ? 0 : rows * rowStep - DECK_GAP;
  const maxScroll = Math.max(0, contentH - viewport.h);
  const at = Math.max(0, Math.min(scroll, maxScroll));
  const cards = Array.from({ length: count }, (_, i) => ({
    x: viewport.x + (i % cols) * (DECK_CARD.w + DECK_GAP),
    y: viewport.y + Math.floor(i / cols) * rowStep - at,
    w: DECK_CARD.w,
    h: DECK_CARD.h,
  }));
  const visible = cards.flatMap((c, i) =>
    c.y >= viewport.y && c.y + c.h <= viewport.y + viewport.h ? [i] : [],
  );
  return { panel, title, close, tabs, viewport, cols, cards, scroll: at, maxScroll, rowStep, visible };
};
