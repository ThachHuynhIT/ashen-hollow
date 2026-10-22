/** Hiệu ứng riêng của thẻ chinh phục Vua Du Mục (spec §6.11). */
import type { BuildingKind } from '../../../data/types';
import { neighbours } from '../../run/board';
import type { FullRunCardHooks } from './fullRunTypes';
import type { IncomeHandler, StatHandler } from './types';

const KINDS: readonly BuildingKind[] = ['troop', 'tower', 'economy', 'support'];
const CARAVAN = 'nomad_caravan';
const CARAVAN_MAX_PER_YEAR = 3;

/** Chợ Phiên: +1 vàng cho mỗi loại công trình (lính / tháp / kinh tế / hỗ trợ) khác nhau ở lân cận. */
export const bazaarKinds: IncomeHandler = (ctx) => {
  const seen = new Set<BuildingKind>();
  for (const n of neighbours(ctx.source.plot)) {
    const b = ctx.state.plots[n]?.building;
    if (b === null || b === undefined) continue;
    const kind = ctx.content.card(b.cardId).kind as BuildingKind;
    if (KINDS.includes(kind)) seen.add(kind);
  }
  return seen.size;
};

/** Chòi Canh: +`pct`% sát thương cho mỗi ô lân cận đã mở mà còn trống (chỉ cho chính nó). */
export const watchtowerOpen: StatHandler = (ctx, params) => {
  if (ctx.source.plot !== ctx.target.plot) return [];
  const pct = typeof params.pct === 'number' ? params.pct : 0;
  const open = neighbours(ctx.source.plot).filter((n) => {
    const p = ctx.state.plots[n]!;
    return p.unlocked && p.building === null;
  }).length;
  return open > 0 ? [{ stat: 'dmg', mode: 'pct', value: pct * open }] : [];
};

/**
 * Đoàn Lữ Hành: mỗi hành động dời công trình (kể cả đổi chỗ, chỉ tính một lần) cho +1 vàng ngay,
 * tối đa 3 mỗi năm cho mỗi đoàn; bộ đếm nằm trong `counters` của đoàn.
 */
const afterMove: FullRunCardHooks['afterMove'] = (state) => {
  if (!state.plots.some((p) => p.building?.cardId === CARAVAN)) return state;
  let gold = 0;
  const plots = state.plots.map((p) => ({ ...p, building: p.building ? structuredClone(p.building) : null }));
  for (const p of plots) {
    const b = p.building;
    if (b?.cardId !== CARAVAN) continue;
    if (b.counters.caravanYear !== state.year) {
      b.counters.caravanYear = state.year;
      b.counters.caravanMoves = 0;
    }
    if (b.counters.caravanMoves! < CARAVAN_MAX_PER_YEAR) {
      b.counters.caravanMoves = b.counters.caravanMoves! + 1;
      gold += 1;
    }
  }
  return { ...state, plots, gold: state.gold + gold, stats: { ...state.stats, goldEarned: state.stats.goldEarned + gold } };
};

export const NOMAD_HOOKS: Partial<FullRunCardHooks> = { afterMove };
