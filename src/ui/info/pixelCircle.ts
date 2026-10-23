/** Vẽ đường viền bằng midpoint nguyên, rồi sắp theo hàng và cột. */
export const pixelCircle = (
  radius: number,
): readonly { readonly x: number; readonly y: number }[] => {
  if (!Number.isFinite(radius) || radius < 0) return [];
  const r = Math.round(radius);
  if (r === 0) return [{ x: 0, y: 0 }];

  const points = new Map<string, { readonly x: number; readonly y: number }>();
  const add = (x: number, y: number): void => {
    // Chuẩn hoá số không âm để các điểm trên trục chỉ xuất hiện một lần.
    const px = x === 0 ? 0 : x;
    const py = y === 0 ? 0 : y;
    points.set(`${px},${py}`, { x: px, y: py });
  };
  let x = r;
  let y = 0;
  let error = 1 - r;
  while (y <= x) {
    add(x, y);
    add(-x, y);
    add(x, -y);
    add(-x, -y);
    add(y, x);
    add(-y, x);
    add(y, -x);
    add(-y, -x);
    y += 1;
    if (error < 0) {
      error += 2 * y + 1;
    } else {
      x -= 1;
      error += 2 * (y - x) + 1;
    }
  }
  return [...points.values()].sort((a, b) => a.y - b.y || a.x - b.x);
};
