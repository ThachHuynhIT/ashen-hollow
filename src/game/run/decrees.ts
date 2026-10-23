/** Sắc lệnh đã ban hành và các số thường trực suy ra từ chúng (spec §7.1, §7.4). Thuần. */
import { INTERVENTION } from '../../data/battle';
import { DECREES, DECREE_RULES, type DecreeDef } from '../../data/decrees';
import { REWARD, RUN, rerollCost } from '../../data/run';
import type { DecreeId } from '../../data/types';
import type { RunState } from './state';

const BY_ID = new Map<DecreeId, DecreeDef>(DECREES.map((d) => [d.id, d]));

export function decree(id: DecreeId): DecreeDef {
  const def = BY_ID.get(id);
  if (def === undefined) throw new Error(`Unknown decree ${id}`);
  return def;
}

export const hasDecree = (state: Pick<RunState, 'decrees'>, id: DecreeId): boolean =>
  state.decrees.includes(id);

/** Số thẻ rút đầu năm: `RUN.handSize`, hoặc 4 với Bàn Tay Thứ Tư. */
export const handLimit = (state: Pick<RunState, 'decrees'>): number =>
  hasDecree(state, 'decree_fourth_hand') ? DECREE_RULES.hand : RUN.handSize;

/** Số thẻ thưởng: `REWARD.choices`, hoặc 4 với Giao Thương. */
export const rewardCount = (state: Pick<RunState, 'decrees'>): number =>
  hasDecree(state, 'decree_trade') ? DECREE_RULES.reward : REWARD.choices;

/** Lần đổi bài miễn phí được cấp mỗi đầu năm. */
export const freeRerollsPerYear = (state: Pick<RunState, 'decrees'>): number =>
  hasDecree(state, 'decree_merchant_guild') ? DECREE_RULES.freeReroll : 0;

/** Giá lần đổi bài kế: 0 khi còn lượt miễn phí, rồi 1, 2, 4… theo số lần ĐÃ TRẢ phí trong năm. */
export const rerollPrice = (
  state: Pick<RunState, 'freeRerollsLeft' | 'paidRerollsThisYear'>,
): number => (state.freeRerollsLeft > 0 ? 0 : rerollCost(state.paidRerollsThisYear + 1));

/** Hồi chiêu sau khi giảm `reductionPct`%, trần giảm 60% (spec §7.4); làm tròn xuống tick nguyên. */
export const cooldownAfter = (reductionPct: number): number => {
  const cut = Math.min(Math.max(reductionPct, 0), DECREE_RULES.cooldownCapPct);
  return Math.floor((INTERVENTION.cooldownTicks * (100 - cut)) / 100);
};

export interface InterventionStats {
  dmgPct: number;
  radius: number;
  cooldownTicks: number;
}

/** Số của Can Thiệp chốt khi vào trận: sắc lệnh cộng với phần thưởng nhiệm vụ vĩnh viễn. */
export const interventionStats = (
  state: Pick<RunState, 'decrees' | 'interventionDmgPct'>,
): InterventionStats => ({
  dmgPct:
    state.interventionDmgPct + (hasDecree(state, 'decree_bigger_boulder') ? DECREE_RULES.boulderDmgPct : 0),
  radius: INTERVENTION.radius + (hasDecree(state, 'decree_bigger_boulder') ? DECREE_RULES.boulderRadius : 0),
  cooldownTicks: cooldownAfter(hasDecree(state, 'decree_quick_reflex') ? DECREE_RULES.cooldownPct : 0),
});

/** Hệ số tốc độ của địch: Hào Nước −10%. */
export const foeSpeedMult = (state: Pick<RunState, 'decrees'>): number =>
  hasDecree(state, 'decree_moat') ? (100 - DECREE_RULES.moatPct) / 100 : 1;
