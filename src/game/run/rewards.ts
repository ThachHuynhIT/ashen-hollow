/** Thẻ thưởng sau trận thắng (spec §3.8). Thuần: chỉ đọc đầu vào, ngẫu nhiên qua `Rng`. */
import { REWARD, rewardRarityWeights } from '../../data/run';
import type { CardDef, CardId, Rarity } from '../../data/types';
import type { Rng } from '../../core/random';

export interface RewardPools {
  /** Thẻ của vua người chơi (không gồm Ngai). */
  king: readonly CardDef[];
  /** Bể trung lập đã mở khoá. */
  neutral: readonly CardDef[];
}

const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare'];

const rollRarity = (rng: Rng, year: number): Rarity => {
  const weights = rewardRarityWeights(year);
  const total = weights[0] + weights[1] + weights[2];
  let r = rng.next() * total;
  for (let i = 0; i < RARITIES.length; i++) {
    if (r < weights[i]!) return RARITIES[i]!;
    r -= weights[i]!;
  }
  return 'rare';
};

/** Bốc `count` (mặc định REWARD.choices) CardId khác nhau; ít hơn nếu không đủ thẻ. */
export function rollOffers(
  rng: Rng,
  year: number,
  pools: RewardPools,
  count: number = REWARD.choices,
): CardId[] {
  const picked: CardId[] = [];
  const avail = (pool: readonly CardDef[], rarity: Rarity): CardDef[] =>
    pool.filter((c) => c.rarity === rarity && !picked.includes(c.id));

  for (let n = 0; n < count; n++) {
    const first = rng.next() < REWARD.kingShare ? pools.king : pools.neutral;
    const second = first === pools.king ? pools.neutral : pools.king;
    const rarityIdx = RARITIES.indexOf(rollRarity(rng, year));

    let candidates: CardDef[] = [];
    // §3.8: hạ độ hiếm trong nguồn đã chọn, rồi đổi nguồn và hạ tương tự.
    for (const pool of [first, second]) {
      for (let i = rarityIdx; i >= 0 && candidates.length === 0; i--) {
        candidates = avail(pool, RARITIES[i]!);
      }
      if (candidates.length > 0) break;
    }
    // Không còn thẻ ở độ hiếm này hoặc thấp hơn: lấy độ hiếm cao hơn thay vì bỏ trống.
    for (const pool of [first, second]) {
      for (let i = rarityIdx + 1; i < RARITIES.length && candidates.length === 0; i++) {
        candidates = avail(pool, RARITIES[i]!);
      }
      if (candidates.length > 0) break;
    }
    if (candidates.length === 0) break;
    picked.push(candidates[Math.floor(rng.next() * candidates.length)]!.id);
  }
  return picked;
}
