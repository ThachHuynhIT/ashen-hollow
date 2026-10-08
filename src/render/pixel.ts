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

  fillRect(x: number, y: number, w: number, h: number, color: number, alpha = 255): void {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, color, alpha);
  }

  /** Filled pixel ellipse centred at (cx, cy) — used for ground shadows. */
  fillEllipse(cx: number, cy: number, rx: number, ry: number, color: number, alpha = 255): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, color, alpha);
      }
    }
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

/** Deterministic per-pixel hash in [0, 1) — stable "random" detail for generated art. */
export const pixelHash = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
