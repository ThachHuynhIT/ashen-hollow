/** Hiệu ứng riêng của thẻ chinh phục Vua Ánh Trăng (spec §6.10). */
import { RUN } from '../../../data/run';
import type { BuildingKind } from '../../../data/types';
import { THRONE_PLOT, attachEnchant, levelUpBuilding, sacrificeBuilding } from '../../run/board';
import type { BuildingState } from '../../run/state';
import type { FullRunCardHooks } from './fullRunTypes';
import type { TomeHandler } from './types';

const stacksOf = (b: BuildingState): number => b.enchants.reduce((n, e) => n + e.stacks, 0);

/**
 * Khế Ước Máu: hiến tế công trình (không phải Ngai): `goldPerLevel` × cấp vàng; mọi stack Bùa của nó
 * chuyển sang Ngai theo thứ tự gắn, dừng khi Ngai đủ `maxEnchantStacks` hoặc Bùa không gắn được lên Ngai.
 */
export const bloodPact: TomeHandler = (state, content, params, target) => {
  if (target.kind !== 'plot' || target.plot === THRONE_PLOT) return 'badTarget';
  const b = state.plots[target.plot]?.building;
  if (!b) return 'badTarget';
  const per = typeof params.goldPerLevel === 'number' ? params.goldPerLevel : 0;
  const gold = per * b.level;
  let plots = state.plots;
  for (const e of b.enchants) {
    const card = content.card(e.cardId);
    if (card.kind !== 'enchantment' || !card.targets.includes('throne' as BuildingKind)) continue;
    for (let k = 0; k < e.stacks; k++) {
      if (stacksOf(plots[THRONE_PLOT]!.building!) >= RUN.maxEnchantStacks) break;
      plots = attachEnchant(plots, THRONE_PLOT, e.cardId, RUN.maxEnchantStacks);
    }
  }
  plots = sacrificeBuilding(plots, target.plot);
  return { ...state, plots, gold: state.gold + gold, stats: { ...state.stats, goldEarned: state.stats.goldEarned + gold } };
};

/** Giao Ước Nguyệt Thực: mất 1 mạng (không hợp lệ khi chỉ còn 1), công trình +2 cấp (tới 5), nhận vàng. */
export const eclipsePact: TomeHandler = (state, _content, params, target) => {
  if (target.kind !== 'plot') return 'badTarget';
  if (state.lives <= 1) return 'lastLife';
  const levels = typeof params.levels === 'number' ? params.levels : 0;
  const gold = typeof params.gold === 'number' ? params.gold : 0;
  return {
    ...state,
    lives: state.lives - 1,
    plots: levelUpBuilding(state.plots, target.plot, levels),
    gold: state.gold + gold,
    stats: { ...state.stats, goldEarned: state.stats.goldEarned + gold },
  };
};

/** Đàn Tế ghi một lễ vật vĩnh viễn mỗi khi một thẻ `sacrifice` được chơi (kể cả thẻ trung lập). */
const afterPlay: FullRunCardHooks['afterPlay'] = (_before, after, card) => {
  if (!card.tags.includes('sacrifice')) return after;
  if (!after.plots.some((p) => p.building?.cardId === 'moon_altar')) return after;
  const plots = after.plots.map((p) => ({ ...p, building: p.building ? structuredClone(p.building) : null }));
  for (const p of plots) {
    if (p.building?.cardId === 'moon_altar') p.building.counters.offerings = (p.building.counters.offerings ?? 0) + 1;
  }
  return { ...after, plots };
};

export const MOON_HOOKS: Partial<FullRunCardHooks> = { afterPlay };
