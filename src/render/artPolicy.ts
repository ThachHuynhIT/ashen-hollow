import type { PixelCanvas } from './pixel';

/**
 * Pixel-art contract (G3e): any RGB is allowed, but edges stay crisp and sizes follow metadata.
 * Sprite alpha is 0 or 255; a declared ground shadow may use 128. One world atlas, each side ≤ 4096.
 */
export const ART_POLICY = {
  maxAtlasSide: 4096,
  allowedSpriteAlpha: [0, 255],
  shadowAlpha: 128,
} as const;

const MAX_REPORTED = 4;

const isPositiveInt = (n: number): boolean => Number.isInteger(n) && n > 0;

/** Problems of one frame: wrong size, or anti-aliased edge pixels. Empty when the frame is fine. */
export const checkArtFrame = (
  name: string,
  art: PixelCanvas,
  expected: { readonly w: number; readonly h: number },
  shadow: boolean,
): readonly string[] => {
  if (!isPositiveInt(expected.w) || !isPositiveInt(expected.h))
    return [`${name}: expected size ${expected.w}x${expected.h} is not a positive integer`];
  if (art.width !== expected.w || art.height !== expected.h)
    return [`${name}: is ${art.width}x${art.height}, expected ${expected.w}x${expected.h}`];
  const errors: string[] = [];
  let bad = 0;
  for (let y = 0; y < art.height; y++)
    for (let x = 0; x < art.width; x++) {
      const a = art.alphaAt(x, y);
      if (a === 0 || a === 255 || (shadow && a === ART_POLICY.shadowAlpha)) continue;
      bad++;
      if (errors.length < MAX_REPORTED) errors.push(`${name}: soft alpha ${a} at ${x},${y}`);
    }
  if (bad > errors.length) errors.push(`${name}: ${bad - errors.length} more soft pixels`);
  return errors;
};

/** Camera zoom and sprite scale must be whole numbers ≥ 1, or pixels blur. */
export const isIntegerDisplayScale = (scale: number): boolean => isPositiveInt(scale);
