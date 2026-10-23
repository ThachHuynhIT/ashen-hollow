/** Chỗ đặt bảng thông tin nhà/lính và phép tính cuộn (thuần, không Phaser). */
import { DRAG_SLOP, type Point, type Rect, type Size } from '../hud/layout';

const MARGIN = 10;
const MAX_W = 320;
const MAX_H = 480;
const MIN_H = 160;
const GAP = 12;
const CLOSE = 48;
const UNIT_BUTTON = { w: 140, h: 44 } as const;

/** px kéo ứng với một dòng cuộn. */
const LINE_PX = 14;
/** dy của một nấc lăn chuột chuẩn (120) = 3 dòng. */
const WHEEL_PX_PER_LINE = 40;

export interface InspectionRects {
  panel: Rect;
  /** Vùng chứa nội dung cuộn (dưới hàng nút đóng). */
  viewport: Rect;
  close: Rect;
  /** Nút "Xem lính" / "Về công trình"; null khi bảng không có. */
  unitButton: Rect | null;
}

const hits = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const clampRect = (r: Rect, screen: Size): Rect => ({
  ...r,
  x: Math.max(MARGIN, Math.min(r.x, screen.w - MARGIN - r.w)),
  y: Math.max(MARGIN, Math.min(r.y, screen.h - MARGIN - r.h)),
});

const finish = (panel: Rect, withUnitButton: boolean): InspectionRects => {
  const close = { x: panel.x + panel.w - CLOSE, y: panel.y, w: CLOSE, h: CLOSE };
  const footer = withUnitButton ? UNIT_BUTTON.h + 6 : 0;
  const viewport = {
    x: panel.x,
    y: panel.y + CLOSE,
    w: panel.w,
    h: Math.max(0, panel.h - CLOSE - footer),
  };
  const unitButton = withUnitButton
    ? { x: panel.x + 8, y: panel.y + panel.h - UNIT_BUTTON.h - 6, w: UNIT_BUTTON.w, h: UNIT_BUTTON.h }
    : null;
  return { panel, viewport, close, unitButton };
};

/**
 * Bảng cỡ tối đa 320 × 480 (và vừa màn trừ lề 10), mở cạnh `anchor`, không đè `reserved` (các nút điều khiển).
 * Thử các vị trí kề điểm bấm rồi các ô ở rìa màn; không chỗ nào vừa thì hạ chiều cao tới 160; vẫn không có thì
 * đặt giữa màn (như modal chặn, có cuộn) — luôn nằm trong màn.
 */
export const inspectionLayout = (
  screen: Size,
  anchor: Point,
  measured: Size,
  reserved: readonly Rect[],
  withUnitButton = false,
): InspectionRects => {
  const w = Math.min(MAX_W, screen.w - 2 * MARGIN, Math.max(measured.w, 200));
  const room = screen.h - 2 * MARGIN;
  const wanted = Math.min(MAX_H, room, measured.h + CLOSE + (withUnitButton ? UNIT_BUTTON.h + 6 : 0));
  for (let h = wanted; ; h = Math.max(MIN_H, h - 40)) {
    const size = { w, h: Math.min(h, room) };
    const spots: Point[] = [
      { x: anchor.x + GAP, y: anchor.y + GAP },
      { x: anchor.x - GAP - size.w, y: anchor.y + GAP },
      { x: anchor.x + GAP, y: anchor.y - GAP - size.h },
      { x: anchor.x - GAP - size.w, y: anchor.y - GAP - size.h },
      { x: MARGIN, y: MARGIN },
      { x: screen.w - MARGIN - size.w, y: MARGIN },
      { x: MARGIN, y: screen.h - MARGIN - size.h },
      { x: screen.w - MARGIN - size.w, y: screen.h - MARGIN - size.h },
      { x: (screen.w - size.w) / 2, y: MARGIN },
      { x: MARGIN, y: (screen.h - size.h) / 2 },
      { x: screen.w - MARGIN - size.w, y: (screen.h - size.h) / 2 },
    ];
    for (const spot of spots) {
      const panel = clampRect({ x: Math.round(spot.x), y: Math.round(spot.y), ...size }, screen);
      if (reserved.every((r) => !hits(panel, r))) return finish(panel, withUnitButton);
    }
    if (h <= MIN_H) break;
  }
  const size = { w, h: Math.min(Math.max(MIN_H, wanted), room) };
  return finish(
    clampRect({ x: (screen.w - size.w) / 2, y: (screen.h - size.h) / 2, ...size }, screen),
    withUnitButton,
  );
};

/** Số dòng cuộn cho một sự kiện lăn chuột (dy dương = xuống). */
export const scrollLinesForWheel = (dy: number): number =>
  dy === 0 ? 0 : Math.sign(dy) * Math.max(1, Math.round(Math.abs(dy) / WHEEL_PX_PER_LINE));

/**
 * Kéo bảng: cộng `dy` vào phần dư `carry`. Chưa quá DRAG_SLOP thì còn là bấm (không cuộn, không coi là kéo);
 * quá rồi thì đổi từng LINE_PX thành một dòng (kéo xuống = cuộn lên) và giữ phần dư.
 */
export const scrollLinesForDrag = (
  carry: number,
  dy: number,
): { lines: number; remainder: number; dragging: boolean } => {
  const total = carry + dy;
  if (Math.abs(total) <= DRAG_SLOP) return { lines: 0, remainder: total, dragging: false };
  return { lines: 0 - Math.trunc(total / LINE_PX), remainder: total % LINE_PX, dragging: true };
};
