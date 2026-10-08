/**
 * Dual-grid terrain blending.
 *
 * Display tiles are offset by half a cell from the data grid, so each display tile sits
 * over the meeting point of four data cells. Its look depends only on those four
 * corners, which means each terrain needs just 16 corner-mask tiles (instead of 47
 * classic autotiles) and edges between ground types fall *inside* tiles — the grid is
 * never visible.
 *
 * Mask bits: TL = 1, TR = 2, BL = 4, BR = 8.
 *
 * Layering: the lowest-priority terrain among the four corners is drawn as a full tile;
 * every higher terrain present is drawn on top covering the corners whose priority is
 * ≥ its own (so there are never holes under an even-higher terrain).
 */
export const MASK_TL = 1;
export const MASK_TR = 2;
export const MASK_BL = 4;
export const MASK_BR = 8;
export const MASK_FULL = 15;

export interface TerrainSource {
  readonly width: number;
  readonly height: number;
  getClamped(cx: number, cy: number): number;
}

export interface DualGrid {
  /** Display tiles: one more than data cells on each axis. */
  width: number;
  height: number;
  /** Per terrain index: mask per display tile, −1 where that terrain isn't drawn. */
  layers: Map<number, Int8Array>;
}

export const computeDualGrid = (
  grid: TerrainSource,
  priorityOf: (terrain: number) => number,
): DualGrid => {
  const width = grid.width + 1;
  const height = grid.height + 1;
  const layers = new Map<number, Int8Array>();
  const layerFor = (t: number): Int8Array => {
    let layer = layers.get(t);
    if (!layer) {
      layer = new Int8Array(width * height).fill(-1);
      layers.set(t, layer);
    }
    return layer;
  };

  const corners = [0, 0, 0, 0];
  const bits = [MASK_TL, MASK_TR, MASK_BL, MASK_BR];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      corners[0] = grid.getClamped(x - 1, y - 1);
      corners[1] = grid.getClamped(x, y - 1);
      corners[2] = grid.getClamped(x - 1, y);
      corners[3] = grid.getClamped(x, y);

      let lowest = corners[0]!;
      for (const c of corners) if (priorityOf(c) < priorityOf(lowest)) lowest = c;
      const i = y * width + x;
      layerFor(lowest)[i] = MASK_FULL;

      for (const t of new Set(corners)) {
        if (t === lowest) continue;
        const p = priorityOf(t);
        let mask = 0;
        for (let k = 0; k < 4; k++) if (priorityOf(corners[k]!) >= p) mask |= bits[k]!;
        layerFor(t)[i] = mask;
      }
    }
  }
  return { width, height, layers };
};
