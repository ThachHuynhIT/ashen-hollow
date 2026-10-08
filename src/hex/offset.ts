import { hex, type Hex } from './hex';

/**
 * "odd-r" offset coordinates: rows are horizontal, odd rows are shoved right by half a hex.
 * Used to store and iterate rectangular maps; convert to axial for any hex math.
 */
export interface OffsetCoord {
  readonly col: number;
  readonly row: number;
}

export const axialToOffset = (h: Hex): OffsetCoord => ({
  col: h.q + (h.r - (h.r & 1)) / 2,
  row: h.r,
});

export const offsetToAxial = (col: number, row: number): Hex =>
  hex(col - (row - (row & 1)) / 2, row);
