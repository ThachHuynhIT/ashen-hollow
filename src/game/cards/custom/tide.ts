/** Hiệu ứng riêng của thẻ chinh phục Vua Thuỷ Triều (spec §6.7). */
import { THRONE_PLOT } from '../../run/board';
import type { RunState } from '../../run/state';
import type { FullRunCardHooks } from './fullRunTypes';
import type { IncomeHandler, TomeHandler } from './types';

const GOLD_STEP = 5;

/** Rương Châu Báu: đầu năm +1 vàng cho mỗi 5 vàng đang có, tối đa `cap` theo cấp. */
export const treasureChest: IncomeHandler = (ctx, params) => {
  const cap = typeof params.cap === 'number' ? params.cap : (params.cap?.[ctx.source.level - 1] ?? 0);
  return Math.min(cap, Math.floor(ctx.state.gold / GOLD_STEP));
};

/**
 * Hợp Đồng Lính Đánh Thuê: trả toàn bộ vàng (tối đa `maxPay`, không âm) và ghi
 * `floor(trả / perMercenary)` lính đánh thuê vào `counters.privateers` của Ngai cho trận năm nay.
 */
export const privateers: TomeHandler = (state, _content, params) => {
  const maxPay = typeof params.maxPay === 'number' ? params.maxPay : 0;
  const per = typeof params.perMercenary === 'number' ? params.perMercenary : 2;
  const pay = Math.max(0, Math.min(state.gold, maxPay));
  const plots = state.plots.map((p) => ({ ...p, building: p.building ? structuredClone(p.building) : null }));
  const throne = plots[THRONE_PLOT]!.building!;
  throne.counters.privateers = (throne.counters.privateers ?? 0) + Math.floor(pay / per);
  return { ...state, gold: state.gold - pay, plots };
};

/** Đầu năm: lính đánh thuê của năm trước đã hết hiệu lực. */
const yearGrowth = (state: RunState): RunState => {
  const throne = state.plots[THRONE_PLOT]?.building;
  if (!throne || (throne.counters.privateers ?? 0) === 0) return state;
  const plots = state.plots.map((p) => ({ ...p, building: p.building ? structuredClone(p.building) : null }));
  plots[THRONE_PLOT]!.building!.counters.privateers = 0;
  return { ...state, plots };
};

export const TIDE_HOOKS: Partial<FullRunCardHooks> = { yearGrowth };
