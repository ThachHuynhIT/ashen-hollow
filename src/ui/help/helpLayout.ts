/** Bố cục thuần của modal Trợ giúp (PC trước; điện thoại chỉ có lối lùi vừa màn, E8 tối ưu sau). */
import type { Rect, Size } from '../hud/layout';

export const HELP_TAB_COUNT = 8;
export const HELP_FILTER_COUNT = 4;

const MARGIN = 10;
const INSET = 12;
const GAP = 8;
const CLOSE = 48;
const ROW = 44;
const DETAIL_W = 340;

export interface HelpLayout {
  panel: Rect;
  close: Rect;
  title: Rect;
  tabs: readonly Rect[];
  /** Bộ lọc thẻ (chỉ tab Thẻ bài dùng). */
  filters: readonly Rect[];
  /** Vùng cuộn bên trái (lưới thẻ hoặc danh sách). */
  viewport: Rect;
  /** Vùng chi tiết bên phải (thẻ đang chọn). */
  detail: Rect;
  /** Viewport + detail liền nhau: các tab chữ dùng cả vùng này. */
  wide: Rect;
}

const maxPanel = (screen: Size): Size => (screen.w >= 1600 ? { w: 1440, h: 960 } : { w: 1120, h: 660 });

export const helpLayout = (screen: Size): HelpLayout => {
  const max = maxPanel(screen);
  const w = Math.min(max.w, screen.w - 2 * MARGIN);
  const h = Math.min(max.h, screen.h - 2 * MARGIN);
  const panel = { x: Math.round((screen.w - w) / 2), y: Math.round((screen.h - h) / 2), w, h };
  const innerX = panel.x + INSET;
  const innerW = panel.w - 2 * INSET;
  const close = { x: innerX + innerW - CLOSE, y: panel.y + INSET, w: CLOSE, h: CLOSE };
  const title = { x: innerX, y: panel.y + INSET, w: innerW - CLOSE - GAP, h: CLOSE };

  // Tab: một hàng khi đủ rộng, nếu không chia hai hàng để mỗi nút còn ≥ 44.
  const cols = innerW >= HELP_TAB_COUNT * (60 + GAP) ? HELP_TAB_COUNT : HELP_TAB_COUNT / 2;
  const tabW = Math.floor((innerW - (cols - 1) * GAP) / cols);
  const tabsY = title.y + CLOSE + GAP;
  const tabs = Array.from({ length: HELP_TAB_COUNT }, (_, i) => ({
    x: innerX + (i % cols) * (tabW + GAP),
    y: tabsY + Math.floor(i / cols) * (ROW + GAP),
    w: tabW,
    h: ROW,
  }));
  const tabRows = HELP_TAB_COUNT / cols;
  const filtersY = tabsY + tabRows * (ROW + GAP);
  const filterW = Math.floor((innerW - (HELP_FILTER_COUNT - 1) * GAP) / HELP_FILTER_COUNT);
  const filters = Array.from({ length: HELP_FILTER_COUNT }, (_, i) => ({
    x: innerX + i * (filterW + GAP),
    y: filtersY,
    w: filterW,
    h: ROW,
  }));
  const bodyY = filtersY + ROW + GAP;
  const bodyH = Math.max(0, panel.y + panel.h - INSET - bodyY);
  const wide = { x: innerX, y: bodyY, w: innerW, h: bodyH };
  const sideBySide = screen.w >= 768;
  const detailW = sideBySide ? Math.min(DETAIL_W, Math.floor(innerW * 0.4)) : innerW;
  const viewport = sideBySide
    ? { x: innerX, y: bodyY, w: innerW - detailW - GAP, h: bodyH }
    : { x: innerX, y: bodyY, w: innerW, h: Math.floor(bodyH * 0.6) };
  const detail = sideBySide
    ? { x: innerX + innerW - detailW, y: bodyY, w: detailW, h: bodyH }
    : { x: innerX, y: bodyY + viewport.h + GAP, w: innerW, h: Math.max(0, bodyH - viewport.h - GAP) };
  return { panel, close, title, tabs, filters, viewport, detail, wide };
};
