import type { Rng } from '../../core/random';
import type { CardId } from '../../data/types';

export interface HandPiles {
  hand: CardId[];
  drawPile: CardId[];
  discardPile: CardId[];
}

/** Xáo trộn Fisher–Yates trên bản sao. */
function shuffled(cards: readonly CardId[], rng: Rng): CardId[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Rút thêm cho đủ `size` lá: giữ nguyên tay hiện có, rút từ đầu `drawPile`; hết chồng rút thì
 * xáo `discardPile` làm chồng rút mới (spec §3.4). Cả hai chồng rỗng thì dừng với tay ngắn hơn.
 * Không sửa đầu vào.
 */
export function refillHand(
  hand: readonly CardId[],
  drawPile: readonly CardId[],
  discardPile: readonly CardId[],
  rng: Rng,
  size: number,
): HandPiles {
  const nextHand = [...hand];
  let draw = [...drawPile];
  let discard = [...discardPile];
  while (nextHand.length < size) {
    if (draw.length === 0) {
      if (discard.length === 0) break;
      draw = shuffled(discard, rng);
      discard = [];
    }
    nextHand.push(draw.shift()!);
  }
  return { hand: nextHand, drawPile: draw, discardPile: discard };
}
