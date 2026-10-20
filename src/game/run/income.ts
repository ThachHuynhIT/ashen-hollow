/** Vàng đầu năm từ công trình (spec §3.3, §5.5 bước 2, 4). Thuần, không sửa đầu vào. */
import type { CustomEffectId, EffectDef, Scalar } from '../../data/types';
import { CUSTOM_INCOME_HANDLERS } from '../cards/custom';
import type { IncomeHandler, StatCtx } from '../cards/custom/types';
import type { Content } from '../cards/registry';
import { THRONE_PLOT, neighbours } from './board';
import { collectStatSheet } from './modifiers';
import type { RunState } from './state';

const resolve = (value: Scalar, level: number): number =>
  typeof value === 'number' ? value : value[level - 1]!;

export interface YearIncome {
  /** Tổng vàng thêm vào (đã trừ phí duy trì); chưa gồm thuế. */
  delta: number;
  /** Uid công trình không trả được phí duy trì. */
  idleUids: number[];
}

/** Ngai trước, rồi plot 0..24 (bỏ Ngai), theo spec §5.5. */
const plotOrder = (): number[] => {
  const order = [THRONE_PLOT];
  for (let plot = 0; plot < 25; plot++) if (plot !== THRONE_PLOT) order.push(plot);
  return order;
};

/**
 * Vàng thu/chi đầu năm của mọi công trình. Phí duy trì (handler `custom` trả số âm) chỉ được trừ
 * khi vàng đang có (`goldBefore` trừ các phí đã trả, chưa tính thuế/thu nhập) đủ; không đủ thì vào
 * `idleUids` và bị bỏ qua cả năm. Hiệu ứng `gold` và `goldPerNeighbour` cộng theo cấp.
 */
export function yearIncome(
  state: RunState,
  content: Content,
  goldBefore: number,
  handlers: Partial<Record<CustomEffectId, IncomeHandler>> = CUSTOM_INCOME_HANDLERS,
): YearIncome {
  // Phí duy trì được kiểm với vàng có trước thuế và thu nhập (spec §5.5: bước 2 trước bước 4).
  let spendable = goldBefore;
  let delta = 0;
  const idleUids: number[] = [];

  for (const plot of plotOrder()) {
    const building = state.plots[plot]!.building;
    if (building === null) continue;
    const card = content.card(building.cardId);
    const level = plot === THRONE_PLOT ? state.throneLevel : building.level;
    const effects: readonly EffectDef[] =
      card.kind === 'throne' ? card.passive : card.kind === 'tome' || card.kind === 'enchantment' ? [] : card.effects;
    const ctx: StatCtx = {
      state,
      content,
      source: { plot, level, stacks: 0 },
      target: { plot, building },
    };

    // Customs first: a negative result is an upkeep that must be affordable.
    const customs = effects.flatMap((e) => {
      if (e.type !== 'custom') return [];
      const handler = handlers[e.id];
      return handler ? [handler(ctx, e.params ?? {})] : [];
    });
    const upkeep = customs.filter((v) => v < 0).reduce((sum, v) => sum + v, 0);
    if (upkeep < 0 && spendable + upkeep < 0) {
      idleUids.push(building.uid);
      continue;
    }

    let gained = upkeep + customs.filter((v) => v > 0).reduce((sum, v) => sum + v, 0);
    for (const e of effects) {
      if (e.type === 'gold') gained += resolve(e.amount, level);
      else if (e.type === 'goldPerNeighbour') {
        const count = neighbours(plot).filter(
          (n) => state.plots[n]!.building?.cardId === e.cardId,
        ).length;
        gained += resolve(e.amount, level) * count;
      }
    }
    gained += collectStatSheet(state, content, plot).gold.flat; // Bùa Phân Bón, v.v.
    delta += gained;
    spendable += upkeep;
  }
  return { delta, idleUids };
}
