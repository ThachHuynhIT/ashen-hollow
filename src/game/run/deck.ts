import type { Rng } from '../../core/random';
import type { CardId } from '../../data/types';

/** Rút `size` thẻ: Fisher–Yates bán phần trên bản sao; không sửa `deck`. */
export function drawHand(deck: readonly CardId[], rng: Rng, size: number): CardId[] {
  const copy = [...deck];
  const n = Math.min(size, copy.length);
  for (let i = 0; i < n; i++) {
    const j = rng.int(i, copy.length - 1);
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy.slice(0, n);
}
