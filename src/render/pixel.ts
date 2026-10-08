import { HEX_TILE_HEIGHT, HEX_TILE_WIDTH } from '../hex';

/** A tiny RGBA framebuffer for generating placeholder pixel art in code. */
export class PixelCanvas {
  readonly data: Uint8ClampedArray<ArrayBuffer>;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  set(x: number, y: number, color: number, alpha = 255): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = (color >> 16) & 0xff;
    this.data[i + 1] = (color >> 8) & 0xff;
    this.data[i + 2] = color & 0xff;
    this.data[i + 3] = alpha;
  }

  alphaAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.data[(y * this.width + x) * 4 + 3]!;
  }

  /** Copy another canvas into this one at (dx, dy), skipping transparent pixels. */
  blit(src: PixelCanvas, dx: number, dy: number): void {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const si = (y * src.width + x) * 4;
        if (src.data[si + 3] === 0) continue;
        const tx = dx + x;
        const ty = dy + y;
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) continue;
        const ti = (ty * this.width + tx) * 4;
        this.data[ti] = src.data[si]!;
        this.data[ti + 1] = src.data[si + 1]!;
        this.data[ti + 2] = src.data[si + 2]!;
        this.data[ti + 3] = src.data[si + 3]!;
      }
    }
  }
}

/**
 * Which pixels of the 32×32 tile belong to the hex.
 *
 * The rows are chosen so that tiles laid out with stepX = 32 / stepY = 24 partition the
 * plane exactly — every screen pixel belongs to exactly one hex, no gaps, no overlap:
 *   rows 0–7   top cap, half-width 2·y          (row 0 is empty)
 *   rows 8–23  full width (the vertical sides)
 *   rows 24–31 bottom cap, half-width 64 − 2·y
 * The diagonals are clean 2:1 pixel stairs.
 */
export const isInsideHexTile = (x: number, y: number): boolean => {
  if (x < 0 || y < 0 || x >= HEX_TILE_WIDTH || y >= HEX_TILE_HEIGHT) return false;
  const cx = HEX_TILE_WIDTH / 2;
  let halfWidth: number;
  if (y < 8) halfWidth = 2 * y;
  else if (y < 24) halfWidth = cx;
  else halfWidth = 64 - 2 * y;
  return x >= cx - halfWidth && x < cx + halfWidth;
};

/** True if the pixel is inside the hex and touches the outside (4-neighbourhood). */
export const isHexTileEdge = (x: number, y: number): boolean =>
  isInsideHexTile(x, y) &&
  (!isInsideHexTile(x - 1, y) ||
    !isInsideHexTile(x + 1, y) ||
    !isInsideHexTile(x, y - 1) ||
    !isInsideHexTile(x, y + 1));

export const createHexTile = (): PixelCanvas => new PixelCanvas(HEX_TILE_WIDTH, HEX_TILE_HEIGHT);

/** Fill the hex shape, picking a colour per pixel. */
export const fillHex = (canvas: PixelCanvas, colorAt: (x: number, y: number) => number): void => {
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (isInsideHexTile(x, y)) canvas.set(x, y, colorAt(x, y));
    }
  }
};

/** Set a pixel only if it lies inside the hex (keeps decorations from leaking). */
export const setInHex = (canvas: PixelCanvas, x: number, y: number, color: number): void => {
  if (isInsideHexTile(Math.floor(x), Math.floor(y))) canvas.set(x, y, color);
};
