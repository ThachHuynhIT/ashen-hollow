import { PixelCanvas } from './pixel';

/**
 * Small pixel art from text: one string per row, one char per pixel. '.' is
 * transparent; every other char must be in `colors`.
 */
export const paintBitmap = (
  rows: readonly string[],
  colors: Readonly<Record<string, number>>,
): PixelCanvas => {
  const width = rows[0]?.length ?? 0;
  const c = new PixelCanvas(width, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== width)
      throw new Error(`Bitmap row ${y} is ${row.length} wide, expected ${width}`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const color = colors[ch];
      if (color === undefined) throw new Error(`Bitmap char '${ch}' has no colour`);
      c.set(x, y, color);
    });
  });
  return c;
};
