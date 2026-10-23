import { BATTLE } from '../../data/battle';
import { plotCenter } from '../../game/battle/world';
import { THRONE_PLOT, plotCol, plotRow } from '../../game/run/board';
import { CARD_LIFT, GAP, MARGIN, SPEED_GAP, type Point, type Rect, type Size } from '../hud/layout';

/**
 * Pure layout maths of the realm screens (no Phaser): the planning HUD (§10.4), the battle
 * HUD (§10.7) and the camera scroll/zoom maths. Rects are logical screen px. Laid out for
 * the two canonical sizes (desktop 1280×720, mobile 375×812; `width ≥ 768` uses desktop
 * rules); other sizes are best effort and never throw.
 */

/** §10.1: from 768 px wide the desktop layout is used. */
export const isDesktop = (width: number): boolean => width >= 768;

/** Planning zoom on mobile: one 32 px plot = 64 screen px (touch targets stay ≥ 44 px). */
export const PLANNING_ZOOM = 2;
/** The board is 5×5 plots (spec §4.1, `src/game/run/board.ts`). */
const BOARD_SIDE = 5;

/** §10.7: the field may be cropped up to 48 px top and bottom. */
export const battleZoom = (width: number, height: number): number =>
  Math.max(1, Math.floor(Math.min(width, height + 96) / BATTLE.field));

/**
 * Planning camera zoom (§10.4): on desktop the battle zoom, so both phases share one camera;
 * on mobile `PLANNING_ZOOM`, and the camera eases to the battle zoom when the battle starts.
 */
export const planningZoom = (screen: Size): number =>
  isDesktop(screen.w) ? battleZoom(screen.w, screen.h) : PLANNING_ZOOM;

const BUTTON = 48;
const BUTTON_GAP = 8;

const DESK = {
  top: { lives: 120, gold: 120, year: 160, h: 52 },
  scout: { w: 260, y: 92, bottom: 520 },
  card: { w: 120, h: 168, gap: 12 },
  button: { w: 140, h: 52 },
} as const;

/** A calendar cell: the year, an attacker badge and attack dots (§10.4). */
const CELL = 52;
const CALENDAR_CELLS = 5;

const PHONE = {
  top: { lives: 96, gold: 96, h: 48 },
  /** Second row: calendar + scout button (y 64..116). */
  rowY: 64,
  /** Below the calendar row and the ✓/✕ row above the board. */
  boardY: 180,
  /** Deck / reroll / sell, one row under the board; ends well above the hand (y 650). */
  buttons: { w: 84, h: 48, y: 508 },
  card: { w: 108, h: 152, gap: 8 },
} as const;

const FIGHT = { w: 200, h: 56 } as const;
const HAND_BOTTOM = 10;

export interface PlanningLayout {
  desktop: boolean;
  /** Camera zoom of the planning phase: one plot is `BATTLE.plot × zoom` screen px. */
  zoom: number;
  lives: Rect;
  gold: Rect;
  /** The "Trợ giúp" button, just right of the gold box. */
  help: Rect;
  year: Rect;
  /** Five 52×52 cells: this year and the next four. */
  calendar: readonly Rect[];
  board: Rect;
  /** The scouting report column (desktop); null on mobile, where `scoutButton` opens it. */
  scout: Rect | null;
  scoutButton: Rect | null;
  /** The decrees-and-quests column (wide desktop); null elsewhere, where `decreeButton` opens it. */
  decreePanel: Rect | null;
  decreeButton: Rect | null;
  hand: readonly Rect[];
  /** "Đổi bài", "Bán bài" and "Bộ bài". */
  reroll: Rect;
  sell: Rect;
  deck: Rect;
  fight: Rect;
  /** Default ✓/✕ spot: the row above the board on mobile, beside the centre plot on desktop. */
  confirm: Rect;
  cancel: Rect;
  /** Room for the play hint (a `tooltip` box): above the board, clear of ✓/✕ on mobile. */
  hint: Rect;
}

/**
 * The hand row for `count` cards. A fourth card (Bàn Tay Thứ Tư) that would not fit the screen
 * shrinks every card, keeping the aspect ratio, so the row fits between the margins.
 */
const handRow = (screen: Size, card: { w: number; h: number; gap: number }, count = 3): Rect[] => {
  const n = Math.max(1, count);
  const avail = screen.w - 2 * MARGIN;
  let { w, h } = card;
  if (n * w + (n - 1) * card.gap > avail) {
    w = Math.max(1, Math.floor((avail - (n - 1) * card.gap) / n));
    h = Math.round((card.h * w) / card.w);
  }
  const total = n * w + (n - 1) * card.gap;
  const x0 = Math.round((screen.w - total) / 2);
  const y = screen.h - h - HAND_BOTTOM;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (w + card.gap), y, w, h }));
};

/**
 * Slots for the first `count` cards of a hand that may hold fewer than the row's slots: the
 * same size, spacing and y, shifted so the cards sit centred on the row.
 */
export const centerHand = (slots: readonly Rect[], count: number): Rect[] => {
  const n = Math.max(0, Math.min(count, slots.length));
  if (n === 0) return [];
  const first = slots[0]!;
  const last = slots[slots.length - 1]!;
  const rowCentre = (first.x + last.x + last.w) / 2;
  const used = slots.slice(0, n);
  const left = used[0]!.x;
  const right = used[n - 1]!.x + used[n - 1]!.w;
  const shift = Math.round(rowCentre - (left + right) / 2);
  return used.map((r) => ({ ...r, x: r.x + shift }));
};

/** The 200×56 "Ra trận" button, centred on the hand row it replaces. */
const fightOver = (screen: Size, hand: readonly Rect[]): Rect => {
  const row = hand[0] ?? { x: 0, y: screen.h - FIGHT.h - HAND_BOTTOM, w: 0, h: FIGHT.h };
  return {
    x: Math.round((screen.w - FIGHT.w) / 2),
    y: Math.round(row.y + (row.h - FIGHT.h) / 2),
    w: FIGHT.w,
    h: FIGHT.h,
  };
};

/** Mobile ✓/✕: a centred pair in the gap above the board (✕ left, ✓ right). */
const aboveBoard = (screen: Size, board: Rect): { confirm: Rect; cancel: Rect } => {
  const y = Math.max(0, board.y - BUTTON - GAP);
  const mid = screen.w / 2;
  return {
    cancel: { x: Math.round(mid - BUTTON_GAP / 2 - BUTTON), y, w: BUTTON, h: BUTTON },
    confirm: { x: Math.round(mid + BUTTON_GAP / 2), y, w: BUTTON, h: BUTTON },
  };
};

/** Desktop ✓/✕: side by side right of the plot (✓ nearest), flipped left if it would overflow. */
const besidePlot = (cell: Rect, screen: Size): { confirm: Rect; cancel: Rect } => {
  const y = Math.max(
    MARGIN,
    Math.min(Math.round(cell.y + (cell.h - BUTTON) / 2), screen.h - MARGIN - BUTTON),
  );
  const rightX = cell.x + cell.w + GAP;
  if (rightX + 2 * BUTTON + GAP <= screen.w - MARGIN)
    return {
      confirm: { x: rightX, y, w: BUTTON, h: BUTTON },
      cancel: { x: rightX + BUTTON + GAP, y, w: BUTTON, h: BUTTON },
    };
  const leftX = Math.max(0, cell.x - GAP - BUTTON);
  return {
    confirm: { x: leftX, y, w: BUTTON, h: BUTTON },
    cancel: { x: Math.max(0, leftX - GAP - BUTTON), y, w: BUTTON, h: BUTTON },
  };
};

/** `count` cells in a row from `x`, `CELL` wide with `GAP` between. */
const cellRow = (x: number, y: number): Rect[] =>
  Array.from({ length: CALENDAR_CELLS }, (_, i) => ({ x: x + i * (CELL + GAP), y, w: CELL, h: CELL }));

/** From this width the decree / quest column fits between the board and the screen edge. */
const WIDE_DESKTOP = 1100;
const DECREE_PANEL_W = 260;

/** Help button next to the gold box (same height); 52 wide, so it is a comfortable touch target too. */
const helpRect = (gold: Rect): Rect => ({ x: gold.x + gold.w + GAP, y: gold.y, w: 52, h: gold.h });

const desktopLayout = (screen: Size, handSize: number): PlanningLayout => {
  const { w, h } = screen;
  const zoom = planningZoom(screen);
  const cell = BATTLE.plot * zoom;
  const boardPx = cell * BOARD_SIDE;
  const lives = { x: MARGIN, y: MARGIN, w: DESK.top.lives, h: DESK.top.h };
  const gold = { x: lives.x + lives.w + GAP, y: MARGIN, w: DESK.top.gold, h: DESK.top.h };
  const year = {
    x: Math.round((w - DESK.top.year) / 2),
    y: MARGIN,
    w: DESK.top.year,
    h: DESK.top.h,
  };
  const wide = w >= WIDE_DESKTOP;
  const calendarW = CALENDAR_CELLS * CELL + (CALENDAR_CELLS - 1) * GAP;
  const calendar = cellRow(w - MARGIN - calendarW, MARGIN);
  const hand = handRow(screen, DESK.card, handSize);
  const first = hand[0]!;
  const last = hand[hand.length - 1]!;
  // Centred like the battle camera's throne, lowered no further than the hand allows.
  const centreY = Math.min(h / 2, first.y - GAP - boardPx / 2);
  const board = {
    x: Math.round(w / 2 - boardPx / 2),
    y: Math.round(centreY - boardPx / 2),
    w: boardPx,
    h: boardPx,
  };
  // Ends above a lifted selected card too, so a narrow desktop window never overlaps the hand.
  const scoutBottom = Math.min(DESK.scout.bottom, first.y - CARD_LIFT - GAP);
  const scout = {
    x: w - MARGIN - DESK.scout.w,
    y: DESK.scout.y,
    w: DESK.scout.w,
    h: Math.max(0, scoutBottom - DESK.scout.y),
  };
  const bottomY = h - HAND_BOTTOM - DESK.button.h;
  // Left of the hand: "Đổi bài" over "Bán bài". Right of it: "Bộ bài".
  const left = first.x - DESK.card.gap - DESK.button.w;
  const sell = { x: left, y: bottomY, w: DESK.button.w, h: DESK.button.h };
  const reroll = { ...sell, y: bottomY - GAP * 2 - DESK.button.h };
  const deck = { x: last.x + last.w + DESK.card.gap, y: bottomY, w: DESK.button.w, h: DESK.button.h };
  const mid = Math.floor(BOARD_SIDE / 2) * cell;
  const centre = { x: board.x + mid, y: board.y + mid, w: cell, h: cell };
  return {
    desktop: true,
    zoom,
    lives,
    gold,
    help: helpRect(gold),
    year,
    calendar,
    board,
    scout,
    scoutButton: null,
    decreePanel: wide
      ? { x: MARGIN, y: DESK.scout.y, w: DECREE_PANEL_W, h: Math.max(0, scoutBottom - DESK.scout.y) }
      : null,
    decreeButton: wide ? null : { x: MARGIN, y: lives.y + lives.h + GAP * 2, w: DESK.button.w, h: BUTTON },
    hand,
    reroll,
    sell,
    deck,
    fight: fightOver(screen, hand),
    ...besidePlot(centre, screen),
    hint: {
      x: board.x,
      y: year.y + year.h + MARGIN,
      w: board.w,
      h: Math.max(0, board.y - GAP - (year.y + year.h + MARGIN)),
    },
  };
};

const mobileLayout = (screen: Size, handSize: number): PlanningLayout => {
  const { w } = screen;
  const boardPx = BATTLE.plot * PLANNING_ZOOM * BOARD_SIDE;
  const lives = { x: MARGIN, y: MARGIN, w: PHONE.top.lives, h: PHONE.top.h };
  const gold = { x: lives.x + lives.w + GAP, y: MARGIN, w: PHONE.top.gold, h: PHONE.top.h };
  const yearX = gold.x + gold.w + GAP;
  const year = { x: yearX, y: MARGIN, w: Math.max(0, w - MARGIN - yearX), h: PHONE.top.h };
  const calendar = cellRow(MARGIN, PHONE.rowY);
  const scoutButton = { x: w - MARGIN - CELL, y: PHONE.rowY, w: CELL, h: CELL };
  const board = {
    x: Math.round((w - boardPx) / 2),
    y: PHONE.boardY,
    w: boardPx,
    h: boardPx,
  };
  const hand = handRow(screen, PHONE.card, handSize);
  const pair = aboveBoard(screen, board);
  const b = PHONE.buttons;
  const sell = { x: w - MARGIN - b.w, y: b.y, w: b.w, h: b.h };
  const reroll = { x: sell.x - GAP - b.w, y: b.y, w: b.w, h: b.h };
  const deck = { x: reroll.x - GAP - b.w, y: b.y, w: b.w, h: b.h };
  return {
    desktop: false,
    zoom: PLANNING_ZOOM,
    lives,
    gold,
    help: helpRect(gold),
    year,
    calendar,
    board,
    scout: null,
    scoutButton,
    decreePanel: null,
    decreeButton: { x: MARGIN, y: b.y, w: b.w, h: b.h },
    hand,
    reroll,
    sell,
    deck,
    fight: fightOver(screen, hand),
    ...pair,
    hint: {
      x: MARGIN,
      y: pair.cancel.y,
      w: Math.max(0, pair.cancel.x - GAP - MARGIN),
      h: Math.max(0, board.y - GAP - pair.cancel.y),
    },
  };
};

/** §10.4. */
export const planningLayout = (screen: Size, handSize = 3): PlanningLayout =>
  isDesktop(screen.w) ? desktopLayout(screen, handSize) : mobileLayout(screen, handSize);

/** Screen cell of `plot` (row-major 5×5, plot 0 = top-left of the board). */
export const plotScreenRect = (layout: PlanningLayout, plot: number): Rect => {
  const cell = layout.board.w / BOARD_SIDE;
  return {
    x: layout.board.x + plotCol(plot) * cell,
    y: layout.board.y + plotRow(plot) * cell,
    w: cell,
    h: cell,
  };
};

/** Plot under a screen point (the inverse of plotScreenRect), null off the board. */
export const plotAtScreen = (layout: PlanningLayout, p: Point): number | null => {
  const cell = layout.board.w / BOARD_SIDE;
  const col = Math.floor((p.x - layout.board.x) / cell);
  const row = Math.floor((p.y - layout.board.y) / cell);
  if (col < 0 || col >= BOARD_SIDE || row < 0 || row >= BOARD_SIDE) return null;
  return row * BOARD_SIDE + col;
};

/** ✓/✕ for a chosen plot: beside it on desktop, the row above the board on mobile. */
export const confirmFor = (
  layout: PlanningLayout,
  plotRect: Rect,
  screen: Size,
): { confirm: Rect; cancel: Rect } =>
  layout.desktop
    ? besidePlot(plotRect, screen)
    : { confirm: { ...layout.confirm }, cancel: { ...layout.cancel } };

export interface BattleLayout {
  clock: Rect;
  lives: Rect;
  gold: Rect;
  help: Rect;
  foes: Rect;
  speed: readonly Rect[];
  intervene: Rect;
  /** "Tự bắn: Bật/Tắt" (§7.4): right-aligned just above the Can Thiệp button. */
  auto: Rect;
  /** "Địch": opens the full scout report of this year's army; just below the foes panel. */
  waves: Rect;
}

const CLOCK = { w: 260, h: 52 } as const;
const FOES = { w: 140, h: 52 } as const;
const INTERVENE = 72;
const AUTO = { w: 104, h: 48 } as const;
const WAVES = { w: 44, h: 44 } as const;

/** §10.7. On mobile the clock drops to a second row (the top row holds lives and foes). */
export const battleLayout = (screen: Size): BattleLayout => {
  const { w, h } = screen;
  const desktop = isDesktop(w);
  const { lives, gold, help } = planningLayout(screen);
  const clock = {
    x: Math.round((w - CLOCK.w) / 2),
    y: desktop ? MARGIN : MARGIN + Math.max(lives.h, FOES.h) + GAP,
    w: CLOCK.w,
    h: CLOCK.h,
  };
  const foes = { x: w - MARGIN - FOES.w, y: MARGIN, w: FOES.w, h: FOES.h };
  const speed = [0, 1, 2, 3].map((i) => ({
    x: MARGIN + i * (BUTTON + SPEED_GAP),
    y: h - MARGIN - BUTTON,
    w: BUTTON,
    h: BUTTON,
  }));
  const intervene = {
    x: w - MARGIN - INTERVENE,
    y: h - MARGIN - INTERVENE,
    w: INTERVENE,
    h: INTERVENE,
  };
  const auto = {
    x: intervene.x + intervene.w - AUTO.w,
    y: intervene.y - GAP - AUTO.h,
    w: AUTO.w,
    h: AUTO.h,
  };
  const waves = {
    x: foes.x + foes.w - WAVES.w,
    y: foes.y + foes.h + GAP,
    w: WAVES.w,
    h: WAVES.h,
  };
  return { clock, lives, gold, help, foes, speed, intervene, auto, waves };
};

/**
 * Camera scroll that shows world point `world` at screen point `target`.
 *
 * Phaser 4 (Camera#preRender, origin 0.5): matrix = translate(mid) · scale(zoom) ·
 * translate(−scroll − mid), i.e. world point p is drawn at `mid + (p − scroll − mid)·zoom`
 * with `mid = screen/2`. Solving for scroll gives `world − mid − (target − mid)/zoom`.
 */
export const cameraScroll = (world: Point, target: Point, screen: Size, zoom: number): Point => {
  const mx = screen.w / 2;
  const my = screen.h / 2;
  return {
    x: world.x - mx - (target.x - mx) / zoom,
    y: world.y - my - (target.y - my) / zoom,
  };
};

/** Inverse of the camera transform above: `p = scroll + mid + (screen − mid)/zoom`. */
export const screenToWorld = (p: Point, scroll: Point, screen: Size, zoom: number): Point => {
  const mx = screen.w / 2;
  const my = screen.h / 2;
  return {
    x: scroll.x + mx + (p.x - mx) / zoom,
    y: scroll.y + my + (p.y - my) / zoom,
  };
};

/** §10.7 battle camera: zoom `battleZoom`, the throne at the screen centre. */
export const battleCamera = (screen: Size): { zoom: number; scroll: Point } => {
  const zoom = battleZoom(screen.w, screen.h);
  const scroll = cameraScroll(
    plotCenter(THRONE_PLOT),
    { x: screen.w / 2, y: screen.h / 2 },
    screen,
    zoom,
  );
  return { zoom, scroll };
};

/** World point under screen point `p` in the battle view, null outside the field. */
export const battleWorldAt = (p: Point, screen: Size): Point | null => {
  const { zoom, scroll } = battleCamera(screen);
  const w = screenToWorld(p, scroll, screen, zoom);
  if (w.x < 0 || w.x > BATTLE.field || w.y < 0 || w.y > BATTLE.field) return null;
  return w;
};

/** Centre of the 5×5 board in world px: the throne's plot centre (the board spans boardOrigin … +5 plots). */
const BOARD_CENTRE = plotCenter(THRONE_PLOT);

/**
 * The one camera of the realm (§10.4, §10.7). Planning puts the board centre where
 * `planningLayout` drew the board; battle centres the throne. On desktop both are the same
 * camera, on mobile they differ in zoom (the scene eases between them).
 */
export type RealmPhase = 'planning' | 'battle';

/** Zoom and the screen point where the throne/board centre sits in `phase`. */
const anchorOf = (screen: Size, phase: RealmPhase): { zoom: number; point: Point } => {
  if (phase === 'battle') {
    return { zoom: battleZoom(screen.w, screen.h), point: { x: screen.w / 2, y: screen.h / 2 } };
  }
  const board = planningLayout(screen).board;
  return {
    zoom: planningZoom(screen),
    point: { x: board.x + board.w / 2, y: board.y + board.h / 2 },
  };
};

export const realmCamera = (screen: Size, phase: RealmPhase): { zoom: number; scroll: Point } => {
  const a = anchorOf(screen, phase);
  return { zoom: a.zoom, scroll: cameraScroll(BOARD_CENTRE, a.point, screen, a.zoom) };
};

/** The camera `k` (0..1) of the way from `from` to `to`: zoom and the throne's screen point ease linearly. */
export const realmCameraMix = (
  screen: Size,
  from: RealmPhase,
  to: RealmPhase,
  k: number,
): { zoom: number; scroll: Point } => {
  const a = anchorOf(screen, from);
  const b = anchorOf(screen, to);
  const zoom = a.zoom + (b.zoom - a.zoom) * k;
  const point = {
    x: a.point.x + (b.point.x - a.point.x) * k,
    y: a.point.y + (b.point.y - a.point.y) * k,
  };
  return { zoom, scroll: cameraScroll(BOARD_CENTRE, point, screen, zoom) };
};
