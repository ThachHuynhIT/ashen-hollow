/** Hiệu ứng `custom` của Vua Lúa Mì (spec §6.3). */
import type { CardDef } from '../../../data/types';
import type { RunState } from '../../run/state';
import type { Content } from '../registry';
import type { IncomeHandler, Modifier, StatHandler, TomeHandler } from './types';

const isFarm = (card: CardDef): boolean => card.tags.includes('farm');

/** Số công trình `farm` trên bàn cờ và tổng cấp của chúng. */
const farms = (state: RunState, content: Content): { count: number; levels: number } => {
  let count = 0;
  let levels = 0;
  for (const p of state.plots) {
    if (p.building === null || !isFarm(content.card(p.building.cardId))) continue;
    count += 1;
    levels += p.building.level;
  }
  return { count, levels };
};

/** Mùa Gặt (Ngai): +1 vàng mỗi 2 `farm` (làm tròn xuống); từ Ngai cấp 3: +1 mỗi `farm`. */
export const wheatHarvest: IncomeHandler = (ctx) => {
  const { count } = farms(ctx.state, ctx.content);
  return ctx.state.throneLevel >= 3 ? count : Math.floor(count / 2);
};

/** Khởi Nghĩa Nông Dân: +k × (số `farm`) lính, k theo cấp; chỉ áp cho chính công trình đó. */
export const peasantHorde: StatHandler = (ctx, params) => {
  if (ctx.source.plot !== ctx.target.plot) return [];
  const k = params.k;
  const perFarm = typeof k === 'number' ? k : (k?.[ctx.source.level - 1] ?? 0);
  const mod: Modifier = {
    stat: 'unitCount',
    mode: 'flat',
    value: perFarm * farms(ctx.state, ctx.content).count,
  };
  return [mod];
};

/** Lễ Hội Mùa Màng: nhận vàng bằng tổng cấp mọi `farm`, tối thiểu 2. */
export const harvestFestival: TomeHandler = (state, content) => {
  const gold = Math.max(2, farms(state, content).levels);
  return {
    ...state,
    gold: state.gold + gold,
    stats: { ...state.stats, goldEarned: state.stats.goldEarned + gold },
  };
};
