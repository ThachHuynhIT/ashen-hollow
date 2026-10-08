import { hexRound, type Hex } from './hex';

/**
 * Pixel layout for the pixel-art hex grid.
 *
 * Tiles are pointy-top hexes drawn in a 32×32 px cell with 2:1 diagonal edges
 * (clean pixel stair-steps). That shape is a non-uniformly scaled regular hex, so the
 * standard axial math still applies — we just use different horizontal/vertical steps:
 *
 *   x = stepX * (q + r / 2)
 *   y = stepY * r
 *
 * With stepX = 32 and stepY = 24, neighbouring rows overlap by 8 px (the diagonal caps).
 */
export interface HexLayoutConfig {
  /** Horizontal distance between centres of neighbouring hexes in the same row. */
  readonly stepX: number;
  /** Vertical distance between rows. */
  readonly stepY: number;
  /** Full bounding size of one hex tile. */
  readonly tileWidth: number;
  readonly tileHeight: number;
  /** Pixel position of hex (0, 0)'s centre. */
  readonly originX: number;
  readonly originY: number;
}

export interface Point {
  x: number;
  y: number;
}

export class HexLayout {
  constructor(readonly config: HexLayoutConfig) {}

  hexToPixel(h: Hex): Point {
    const { stepX, stepY, originX, originY } = this.config;
    return {
      x: originX + stepX * (h.q + h.r / 2),
      y: originY + stepY * h.r,
    };
  }

  /** The hex containing the given pixel (world space). */
  pixelToHex(x: number, y: number): Hex {
    const { stepX, stepY, originX, originY } = this.config;
    const r = (y - originY) / stepY;
    const q = (x - originX) / stepX - r / 2;
    return hexRound(q, r);
  }

  /**
   * Polygon corners relative to the hex centre, clockwise from the top point.
   * Useful for outlines, selection highlights and debug drawing.
   */
  cornerOffsets(): Point[] {
    const hw = this.config.tileWidth / 2;
    const hh = this.config.tileHeight / 2;
    // The cap height equals the row overlap: tileHeight - stepY.
    const cap = this.config.tileHeight - this.config.stepY;
    const side = hh - cap;
    return [
      { x: 0, y: -hh },
      { x: hw, y: -side },
      { x: hw, y: side },
      { x: 0, y: hh },
      { x: -hw, y: side },
      { x: -hw, y: -side },
    ];
  }

  corners(h: Hex): Point[] {
    const c = this.hexToPixel(h);
    return this.cornerOffsets().map((o) => ({ x: c.x + o.x, y: c.y + o.y }));
  }
}

export const HEX_TILE_WIDTH = 32;
export const HEX_TILE_HEIGHT = 32;
export const HEX_STEP_X = 32;
export const HEX_STEP_Y = 24;

/** Default layout: hex (0, 0)'s tile sits with its top-left corner at the world origin. */
export const DEFAULT_LAYOUT = new HexLayout({
  stepX: HEX_STEP_X,
  stepY: HEX_STEP_Y,
  tileWidth: HEX_TILE_WIDTH,
  tileHeight: HEX_TILE_HEIGHT,
  originX: HEX_TILE_WIDTH / 2,
  originY: HEX_TILE_HEIGHT / 2,
});
