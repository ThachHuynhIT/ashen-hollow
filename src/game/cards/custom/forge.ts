/** Hiệu ứng riêng của thẻ chinh phục Vua Lò Rèn (spec §6.8). */
import { RUN } from '../../../data/run';
import { THRONE_PLOT, levelUpBuilding, neighbours } from '../../run/board';
import type { FullRunCardHooks } from './fullRunTypes';
import type { Modifier, StatHandler, TomeHandler } from './types';

const ARMORY = 'forge_armory';

/**
 * Búa Thợ Cả: +1 cấp cho công trình được chọn, rồi +1 cấp cho công trình lân cận có cấp thấp nhất
 * chưa tối đa (hoà: Bắc, Đông, Nam, Tây; Ngai bị bỏ qua).
 */
export const masterHammer: TomeHandler = (state, _content, _params, target) => {
  if (target.kind !== 'plot') return 'badTarget';
  let plots = levelUpBuilding(state.plots, target.plot, 1);
  let pick = -1;
  for (const n of neighbours(target.plot)) {
    const b = plots[n]!.building;
    if (n === THRONE_PLOT || b === null || b.level >= RUN.maxLevel) continue;
    if (pick < 0 || b.level < plots[pick]!.building!.level) pick = n;
  }
  if (pick >= 0) plots = levelUpBuilding(plots, pick, 1);
  return { ...state, plots };
};

/** Kho Giáp: mọi lính trên bàn cờ +giáp; nhiều Kho Giáp chỉ lấy cái cao nhất (hoà: ô nhỏ nhất). */
export const armoryArmor: StatHandler = (ctx, params) => {
  if (ctx.content.card(ctx.target.building.cardId).kind !== 'troop') return [];
  const at = (level: number): number => {
    const v = params.armor;
    return typeof v === 'number' ? v : (v?.[level - 1] ?? 0);
  };
  let best = -1;
  let bestValue = -1;
  ctx.state.plots.forEach((p, plot) => {
    if (p.building?.cardId !== ARMORY) return;
    const value = at(p.building.level);
    if (value > bestValue) {
      best = plot;
      bestValue = value;
    }
  });
  if (best !== ctx.source.plot) return [];
  const mod: Modifier = { stat: 'armor', mode: 'flat', value: bestValue };
  return [mod];
};

/** Lò Rèn không có móc theo thời điểm: mọi hiệu ứng nằm ở chỉ số, đòn đánh và tome. */
export const FORGE_HOOKS: Partial<FullRunCardHooks> = {};
