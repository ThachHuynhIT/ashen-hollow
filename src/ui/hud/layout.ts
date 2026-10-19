/**
 * Pure UI maths shared by every screen (no Phaser) so it can be unit-tested: border scale,
 * toast merging, tooltip placement, slot-row fitting and scrolling. Sizes are logical
 * screen px.
 */

/** Minimum touch target (Apple/Google guidance). */
export const TOUCH_TARGET = 44;
export const MARGIN = 10;
export const GAP = 4;
/** Gap between the speed buttons of a speed row (pause/1×/2×/3×). */
export const SPEED_GAP = 2;
export const LONG_PRESS_MS = 400;
export const MAP_DWELL_MS = 300;
/** A press that moved further than this (screen px) is a drag, not a click. */
export const DRAG_SLOP = 8;
export const TOOLTIP_MAX_W = 220;
export const TOOLTIP_OFFSET = 16;
export const TOOLTIP_EDGE = 4;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Size {
  w: number;
  h: number;
}
export interface Point {
  x: number;
  y: number;
}

// --- tooltip content ---------------------------------------------------------------------

export interface TooltipPart {
  readonly text: string;
  readonly color?: number;
  readonly icon?: { readonly key: string; readonly frame: string };
}
export type TooltipLine = readonly TooltipPart[];
export interface TooltipContent {
  readonly title?: string;
  readonly lines: readonly TooltipLine[];
}

/** Description lines → tooltip content; the first line becomes the title. */
export const textContent = (lines: readonly string[]): TooltipContent => ({
  title: lines[0],
  lines: lines.slice(1).map((text) => [{ text }]),
});

// --- scale ---------------------------------------------------------------------------------

/** 2× pixel borders when the short side has room for them, 1× on phones. */
export const uiScaleFor = (width: number, height: number): 1 | 2 =>
  Math.min(width, height) >= 600 ? 2 : 1;

// --- toasts --------------------------------------------------------------------------------

export const TOAST = {
  max: 4,
  holdMs: 5_000,
  slideMs: 200,
  fadeMs: 400,
  height: 32,
  gap: 4,
  maxWidth: 320,
} as const;

/** Space kept for a full toast stack (so the panel above it doesn't jump). */
export const TOAST_STACK_H = TOAST.max * (TOAST.height + TOAST.gap);

export interface ToastEntry {
  readonly id: number;
  readonly text: string;
  readonly count: number;
  readonly shownAt: number;
}

export interface ToastPush {
  /** Oldest first; the newest is drawn at the bottom. */
  list: ToastEntry[];
  /** The toast that was added, or the one that absorbed the repeat. */
  entry: ToastEntry;
  merged: boolean;
  /** Toasts pushed out by the fifth one (remove at once, no fade). */
  dropped: ToastEntry[];
}

export const pushToast = (
  list: readonly ToastEntry[],
  text: string,
  now: number,
  id: number,
): ToastPush => {
  const same = list.find((t) => t.text === text);
  if (same) {
    const entry: ToastEntry = { ...same, count: same.count + 1, shownAt: now };
    return { list: list.map((t) => (t === same ? entry : t)), entry, merged: true, dropped: [] };
  }
  const entry: ToastEntry = { id, text, count: 1, shownAt: now };
  const all = [...list, entry];
  const dropped = all.slice(0, Math.max(0, all.length - TOAST.max));
  return { list: all.slice(dropped.length), entry, merged: false, dropped };
};

/** Longest prefix of `text` + "…" that measures ≤ maxWidth (unchanged if it already fits). */
export const ellipsize = (
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string => {
  if (measure(text) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(`${text.slice(0, mid).trimEnd()}…`) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo).trimEnd()}…`;
};

/** One-line toast label: the text cut to fit, keeping the " ×N" repeat suffix. */
export const toastText = (
  t: ToastEntry,
  maxWidth: number,
  measure: (s: string) => number,
): string => {
  const suffix = t.count > 1 ? ` ×${t.count}` : '';
  return ellipsize(t.text, maxWidth - (suffix ? measure(suffix) : 0), measure) + suffix;
};

// --- tooltip placement ---------------------------------------------------------------------

const placeAxis = (pointer: number, size: number, screen: number): number => {
  const after = pointer + TOOLTIP_OFFSET;
  if (after + size <= screen - TOOLTIP_EDGE) return after;
  const before = pointer - TOOLTIP_OFFSET - size;
  if (before >= TOOLTIP_EDGE) return before;
  return Math.max(TOOLTIP_EDGE, Math.min(after, screen - TOOLTIP_EDGE - size));
};

/** Below-right of the pointer; flips left/up at the edges; clamps when neither side fits. */
export const placeTooltip = (pointer: Point, size: Size, screen: Size): Point => ({
  x: Math.round(placeAxis(pointer.x, size.w, screen.w)),
  y: Math.round(placeAxis(pointer.y, size.h, screen.h)),
});

/** Centred above a control (touch long-press); below it when there is no room above. */
export const placeAbove = (anchor: Rect, size: Size, screen: Size): Point => {
  const centred = anchor.x + anchor.w / 2 - size.w / 2;
  const x = Math.max(TOOLTIP_EDGE, Math.min(centred, screen.w - TOOLTIP_EDGE - size.w));
  const above = anchor.y - 6 - size.h;
  const y =
    above >= TOOLTIP_EDGE
      ? above
      : Math.max(TOOLTIP_EDGE, Math.min(anchor.y + anchor.h + 6, screen.h - TOOLTIP_EDGE - size.h));
  return { x: Math.round(x), y: Math.round(y) };
};

// --- hotbar --------------------------------------------------------------------------------

export const HOTBAR = { slot: 48, minSlot: 44, gap: 4, minGap: 2, divider: 2 } as const;

/** Row width: `count` slots, gaps, and a divider (+ one more gap) after the tab slot. */
export const hotbarWidth = (count: number, slot: number, gap: number): number =>
  count * slot + (count - 1) * gap + HOTBAR.divider + gap;

/** Left edge of slot `index` inside the row. */
export const hotbarSlotX = (index: number, slot: number, gap: number): number =>
  index * (slot + gap) + (index > 0 ? HOTBAR.divider + gap : 0);

export interface HotbarFit {
  slot: number;
  gap: number;
  /** Content width at this slot/gap (wider than the view when scrolling). */
  width: number;
  scroll: boolean;
}

/** 48/4 → 48/2 → 44/2 → 44/2 with horizontal scrolling. Never below 44 px. */
export const fitHotbar = (count: number, available: number): HotbarFit => {
  const tries: [number, number][] = [
    [HOTBAR.slot, HOTBAR.gap],
    [HOTBAR.slot, HOTBAR.minGap],
    [HOTBAR.minSlot, HOTBAR.minGap],
  ];
  for (const [slot, gap] of tries) {
    const width = hotbarWidth(count, slot, gap);
    if (width <= available) return { slot, gap, width, scroll: false };
  }
  return {
    slot: HOTBAR.minSlot,
    gap: HOTBAR.minGap,
    width: hotbarWidth(count, HOTBAR.minSlot, HOTBAR.minGap),
    scroll: true,
  };
};

export const clampScroll = (offset: number, content: number, view: number): number =>
  Math.max(0, Math.min(offset, Math.max(0, content - view)));

/** Largest whole scale that fits `box` px, but never below 1 (pixel art is never shrunk). */
export const iconScale = (w: number, h: number, box = 32): number =>
  Math.max(1, Math.floor(box / Math.max(w, h)));

// --- misc ----------------------------------------------------------------------------------

/** Horizontal spans overlap (touching edges do not). */
export const overlapsX = (a: Pick<Rect, 'x' | 'w'>, b: Pick<Rect, 'x' | 'w'>): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w;
