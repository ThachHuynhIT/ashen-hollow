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

/**
 * §10.6 reward picker: title, `count` cards, then "Nhận". Cards share one row, except on a
 * phone with 4 or more cards, which wrap into rows of two so the panel stays inside the screen.
 */
export const rewardLayout = (screen: Size, inset: number, count = 3): RewardLayout => {
  const desktop = isDesktop(screen.w);
  const spec = desktop ? REWARD_DESK : REWARD_PHONE;
  const { card, button } = spec;
  const n = Math.max(1, count);
  const cols = !desktop && n >= 4 ? 2 : n;
  const rows = Math.ceil(n / cols);
  const row = cols * card.w + (cols - 1) * card.gap;
  const grid = rows * card.h + (rows - 1) * card.gap;
  const w = Math.max(row, button.w) + 2 * inset;
  const h = inset + TITLE_H + GAP_ABOVE_CARDS + CARD_LIFT + grid + GAP_BELOW_CARDS + button.h + inset;
  const panel = centredPanel(screen, w, h);
  const title = { x: panel.x + inset, y: panel.y + inset, w: panel.w - 2 * inset, h: TITLE_H };
  const cardY = title.y + TITLE_H + GAP_ABOVE_CARDS + CARD_LIFT;
  const x0 = Math.round(panel.x + (panel.w - row) / 2);
  const cards = Array.from({ length: n }, (_, i) => ({
    x: x0 + (i % cols) * (card.w + card.gap),
    y: cardY + Math.floor(i / cols) * (card.h + card.gap),
    w: card.w,
    h: card.h,
  }));
  const by = cardY + grid + GAP_BELOW_CARDS;
  const bx = Math.round(panel.x + (panel.w - button.w) / 2);
  return { panel, title, cards, take: { x: bx, y: by, w: button.w, h: button.h } };
};

export interface CouncilLayout {
  panel: Rect;
  title: Rect;
  /** The three decree cards: a row on desktop, a column on phones. */
  choices: readonly Rect[];
  /** Detail of the chosen decree and its extra step (plots, cards, deck). */
  area: Rect;
  /** "Ban hành". */
  enact: Rect;
}

const COUNCIL_DESK = { choice: { w: 300, h: 120 }, gap: 12, area: 260 } as const;
const COUNCIL_PHONE = { choice: { w: 355, h: 110 }, gap: 6, area: 260 } as const;
const COUNCIL_TITLE_H = 36;
/** "Ban hành", "Nhận" and "Từ chối". */
export const COUNCIL_BUTTON = { w: 150, h: 48 } as const;

/** §3.9 royal council: title, three decrees, the chosen decree's detail area, then "Ban hành". */
export const councilLayout = (screen: Size, inset: number): CouncilLayout => {
  const desktop = isDesktop(screen.w);
  const spec = desktop ? COUNCIL_DESK : COUNCIL_PHONE;
  const inner = desktop ? 3 * spec.choice.w + 2 * spec.gap : spec.choice.w;
  const w = inner + 2 * inset;
  const fixed = 2 * inset + COUNCIL_TITLE_H + 3 * GAP_ABOVE_CARDS + COUNCIL_BUTTON.h;
  const room = screen.h - 2 * MARGIN - fixed; // what the choices and the detail area may share
  // A short screen first squeezes the phone's stacked decree cards (down to 64), then the detail area.
  let choiceH: number = spec.choice.h;
  let areaH: number = spec.area;
  const stackOf = (ch: number): number => (desktop ? ch : 3 * ch + 2 * spec.gap);
  if (stackOf(choiceH) + areaH > room) {
    if (!desktop) choiceH = Math.max(64, Math.min(choiceH, Math.floor((room - areaH - 2 * spec.gap) / 3)));
    if (stackOf(choiceH) + areaH > room) areaH = Math.max(200, room - stackOf(choiceH));
  }
  const stack = stackOf(choiceH);
  const h = fixed + stack + areaH;
  const panel = centredPanel(screen, w, h);
  const innerW = panel.w - 2 * inset;
  const title = { x: panel.x + inset, y: panel.y + inset, w: innerW, h: COUNCIL_TITLE_H };
  const y0 = title.y + COUNCIL_TITLE_H + GAP_ABOVE_CARDS;
  const choiceW = desktop
    ? Math.min(spec.choice.w, Math.floor((innerW - 2 * spec.gap) / 3))
    : Math.min(spec.choice.w, innerW);
  const used = desktop ? 3 * choiceW + 2 * spec.gap : choiceW;
  const x0 = Math.round(panel.x + (panel.w - used) / 2);
  const choices = Array.from({ length: 3 }, (_, i) => ({
    x: desktop ? x0 + i * (choiceW + spec.gap) : x0,
    y: desktop ? y0 : y0 + i * (choiceH + spec.gap),
    w: choiceW,
    h: choiceH,
  }));
  const areaY = y0 + stack + GAP_ABOVE_CARDS;
  const area = { x: panel.x + inset, y: areaY, w: innerW, h: areaH };
  const enact = {
    x: Math.round(panel.x + (panel.w - COUNCIL_BUTTON.w) / 2),
    y: areaY + areaH + GAP_ABOVE_CARDS,
    w: COUNCIL_BUTTON.w,
    h: COUNCIL_BUTTON.h,
  };
  return { panel, title, choices, area, enact };
};

export interface QuestLayout {
  panel: Rect;
  title: Rect;
  body: Rect;
  accept: Rect;
  decline: Rect;
}

const QUEST = { w: 440, body: 170, titleH: 36 } as const;

/** §3.10 quest offer: a title, the condition / deadline / reward text, then "Nhận" and "Từ chối". */
export const questLayout = (screen: Size, inset: number): QuestLayout => {
  const row = 2 * COUNCIL_BUTTON.w + BUTTON_GAP;
  const w = Math.max(QUEST.w, row + 2 * inset);
  const h = inset + QUEST.titleH + GAP_ABOVE_CARDS + QUEST.body + GAP_ABOVE_CARDS + COUNCIL_BUTTON.h + inset;
  const panel = centredPanel(screen, w, h);
  const innerW = panel.w - 2 * inset;
  const title = { x: panel.x + inset, y: panel.y + inset, w: innerW, h: QUEST.titleH };
  const body = { x: title.x, y: title.y + QUEST.titleH + GAP_ABOVE_CARDS, w: innerW, h: QUEST.body };
  const by = body.y + QUEST.body + GAP_ABOVE_CARDS;
  const bx = Math.round(panel.x + (panel.w - row) / 2);
  const accept = { x: bx, y: by, w: COUNCIL_BUTTON.w, h: COUNCIL_BUTTON.h };
  const decline = { x: bx + COUNCIL_BUTTON.w + BUTTON_GAP, y: by, w: COUNCIL_BUTTON.w, h: COUNCIL_BUTTON.h };
  return { panel, title, body, accept, decline };
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
  /** Every year, row-major (5 columns up to 15 years, 6 beyond). */
  cells: readonly Rect[];
}

/** Whole-run calendar (§10.4 "L"): one cell per year, 5 columns for up to 15 years, 6 beyond. */
export const calendarModalLayout = (screen: Size, inset: number, years = 15): CalendarModalLayout => {
  const desktop = isDesktop(screen.w);
  const cols = years > 15 ? 6 : 5;
  const rows = Math.ceil(years / cols);
  const cell = desktop ? 72 : years > 15 ? 48 : 56;
  const gap = desktop ? 8 : 4;
  const gridW = cols * cell + (cols - 1) * gap;
  const gridH = rows * cell + (rows - 1) * gap;
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
  const cells = Array.from({ length: years }, (_, i) => ({
    x: x0 + (i % cols) * (cell + gap),
    y: y0 + Math.floor(i / cols) * (cell + gap),
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
