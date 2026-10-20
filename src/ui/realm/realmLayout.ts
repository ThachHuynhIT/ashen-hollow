import { BATTLE } from '../../data/battle';
import { plotCenter } from '../../game/battle/world';
import { THRONE_PLOT, plotCol, plotRow } from '../../game/run/board';
import { GAP, MARGIN, SPEED_GAP, type Point, type Rect, type Size } from '../hud/layout';

/**
 * Pure layout maths of the realm screens (no Phaser): the planning HUD (§10.4), the battle
 * HUD (§10.7) and the camera scroll/zoom maths. Rects are logical screen px. Laid out for
 * the two canonical sizes (desktop 1280×720, mobile 375×812; `width ≥ 768` uses desktop
 * rules); other sizes are best effort and never throw.
 */

/** §10.1: from 768 px wide the desktop layout is used. */
export const isDesktop = (width: number): boolean => width >= 768;

/** Planning camera zoom in both layouts: one 32 px plot = 64 screen px. */
export const PLANNING_ZOOM = 2;
const CELL = BATTLE.plot * PLANNING_ZOOM;
/** The board is 5×5 plots (spec §4.1, `src/game/run/board.ts`). */
const BOARD_SIDE = 5;
const BOARD_PX = CELL * BOARD_SIDE;

/** §10.7: the field may be cropped up to 48 px top and bottom. */
export const battleZoom = (width: number, height: number): number =>
  Math.max(1, Math.floor(Math.min(width, height + 96) / BATTLE.field));

const BUTTON = 48;
const BUTTON_GAP = 8;

const DESK = {
  top: { lives: 120, year: 160, h: 52 },
  boardCentreY: 340,
  scout: { w: 260, y: 92, bottom: 520 },
  card: { w: 120, h: 168, gap: 12 },
  skip: { w: 140, h: 52 },
} as const;

const PHONE = {
  top: { lives: 96, h: 48 },
  boardY: 124,
  // Ends 12 px above the hand (y 650) so a lifted selected card (CARD_LIFT) clears it.
  scout: { y: 508, h: 130 },
  card: { w: 108, h: 152, gap: 8 },
  skip: { w: 84, h: 48, y: 452 },
} as const;

const FIGHT = { w: 200, h: 56 } as const;
const HAND_BOTTOM = 10;

export interface PlanningLayout {
  desktop: boolean;
  lives: Rect;
  year: Rect;
  board: Rect;
  scout: Rect;
  hand: readonly Rect[];
  skip: Rect;
  fight: Rect;
  /** Default ✓/✕ spot: the row above the board on mobile, beside the centre plot on desktop. */
  confirm: Rect;
  cancel: Rect;
  /** Room for the play hint (a `tooltip` box): above the board, clear of ✓/✕ on mobile. */
  hint: Rect;
}

const handRow = (screen: Size, card: { w: number; h: number; gap: number }): Rect[] => {
  const total = 3 * card.w + 2 * card.gap;
  const x0 = Math.round((screen.w - total) / 2);
  const y = screen.h - card.h - HAND_BOTTOM;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (card.w + card.gap), y, w: card.w, h: card.h }));
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

const desktopLayout = (screen: Size): PlanningLayout => {
  const { w, h } = screen;
  const lives = { x: MARGIN, y: MARGIN, w: DESK.top.lives, h: DESK.top.h };
  const year = {
    x: Math.round((w - DESK.top.year) / 2),
    y: MARGIN,
    w: DESK.top.year,
    h: DESK.top.h,
  };
  const board = {
    x: Math.round(w / 2 - BOARD_PX / 2),
    y: Math.round(DESK.boardCentreY - BOARD_PX / 2),
    w: BOARD_PX,
    h: BOARD_PX,
  };
  const scout = {
    x: w - MARGIN - DESK.scout.w,
    y: DESK.scout.y,
    w: DESK.scout.w,
    h: DESK.scout.bottom - DESK.scout.y,
  };
  const hand = handRow(screen, DESK.card);
  const first = hand[0]!;
  const skip = {
    x: first.x - DESK.card.gap - DESK.skip.w,
    y: h - HAND_BOTTOM - DESK.skip.h,
    w: DESK.skip.w,
    h: DESK.skip.h,
  };
  const mid = Math.floor(BOARD_SIDE / 2) * CELL;
  const centre = { x: board.x + mid, y: board.y + mid, w: CELL, h: CELL };
  return {
    desktop: true,
    lives,
    year,
    board,
    scout,
    hand,
    skip,
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

const mobileLayout = (screen: Size): PlanningLayout => {
  const { w } = screen;
  const lives = { x: MARGIN, y: MARGIN, w: PHONE.top.lives, h: PHONE.top.h };
  const yearX = MARGIN + PHONE.top.lives + GAP;
  const year = { x: yearX, y: MARGIN, w: Math.max(0, w - MARGIN - yearX), h: PHONE.top.h };
  const board = {
    x: Math.round((w - BOARD_PX) / 2),
    y: PHONE.boardY,
    w: BOARD_PX,
    h: BOARD_PX,
  };
  const scout = {
    x: MARGIN,
    y: PHONE.scout.y,
    w: Math.max(0, w - 2 * MARGIN),
    h: PHONE.scout.h,
  };
  const hand = handRow(screen, PHONE.card);
  const pair = aboveBoard(screen, board);
  const skip = {
    x: w - MARGIN - PHONE.skip.w,
    y: PHONE.skip.y,
    w: PHONE.skip.w,
    h: PHONE.skip.h,
  };
  return {
    desktop: false,
    lives,
    year,
    board,
    scout,
    hand,
    skip,
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

/** §10.4 (G1 parts only). */
export const planningLayout = (screen: Size): PlanningLayout =>
  isDesktop(screen.w) ? desktopLayout(screen) : mobileLayout(screen);

/** Screen cell of `plot` (row-major 5×5, plot 0 = top-left of the board). */
export const plotScreenRect = (layout: PlanningLayout, plot: number): Rect => ({
  x: layout.board.x + plotCol(plot) * CELL,
  y: layout.board.y + plotRow(plot) * CELL,
  w: CELL,
  h: CELL,
});

/** Plot under a screen point (the inverse of plotScreenRect), null off the board. */
export const plotAtScreen = (layout: PlanningLayout, p: Point): number | null => {
  const col = Math.floor((p.x - layout.board.x) / CELL);
  const row = Math.floor((p.y - layout.board.y) / CELL);
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
  foes: Rect;
  speed: readonly Rect[];
  intervene: Rect;
}

const CLOCK = { w: 260, h: 52 } as const;
const FOES = { w: 140, h: 52 } as const;
const INTERVENE = 72;

/** §10.7. On mobile the clock drops to a second row (the top row holds lives and foes). */
export const battleLayout = (screen: Size): BattleLayout => {
  const { w, h } = screen;
  const desktop = isDesktop(w);
  const lives = planningLayout(screen).lives;
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
  return { clock, lives, foes, speed, intervene };
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
