/** Hiệu ứng `custom` của Vua Phép Thuật (spec §6.5). */
import { RUN } from '../../../data/run';
import type { BuildingKind, Level, Scalar } from '../../../data/types';
import { copyEnchants, neighbours } from '../../run/board';
import type { BuildingState } from '../../run/state';
import type { Modifier, StatHandler, TomeHandler } from './types';

const at = (value: Scalar | undefined, level: Level): number =>
  value === undefined ? 0 : typeof value === 'number' ? value : value[level - 1]!;

const stacksOf = (b: BuildingState): number => b.enchants.reduce((n, e) => n + e.stacks, 0);

/**
 * Thư Viện: công trình lân cận có ≥ 1 Bùa nhận thêm `params.stacks` stack ảo của Bùa gắn đầu
 * tiên — thêm đúng các modifier `stat` của Bùa đó (lọc theo loại công trình đích). Stack ảo
 * không tính vào giới hạn stack (chỉ phép gắn mới kiểm giới hạn).
 */
export const libraryVirtualStacks: StatHandler = (ctx, params) => {
  if (!neighbours(ctx.source.plot).includes(ctx.target.plot)) return [];
  const first = ctx.target.building.enchants[0];
  if (!first) return [];
  const card = ctx.content.card(first.cardId);
  if (card.kind !== 'enchantment') return [];
  const kind = ctx.content.card(ctx.target.building.cardId).kind as BuildingKind;
  const virtual = at(params.stacks, ctx.source.level);
  const out: Modifier[] = [];
  for (const e of card.perStack) {
    if (e.type !== 'stat') continue;
    if (e.filter?.kinds && !e.filter.kinds.includes(kind)) continue;
    out.push({ stat: e.stat, mode: e.mode, value: at(e.value, 1) * virtual });
  }
  return out;
};

/** Tháp Đại Pháp Sư: +`pctPerStack`% sát thương cho mỗi stack Bùa trên toàn bàn cờ, tối đa `cap`%. */
export const archmageRamp: StatHandler = (ctx, params) => {
  if (ctx.source.plot !== ctx.target.plot) return [];
  let stacks = 0;
  for (const p of ctx.state.plots) if (p.building !== null) stacks += stacksOf(p.building);
  const per = at(params.pctPerStack, ctx.source.level);
  const cap = at(params.cap, ctx.source.level);
  return [{ stat: 'dmg', mode: 'pct', value: Math.min(stacks * per, cap) }];
};

/** Hòa Âm (Ngai): công trình có tổng ≥ 2 stack Bùa nhận +pct% máu (lính và công trình) và sát thương. */
export const arcaneHarmony: StatHandler = (ctx, params) => {
  if (stacksOf(ctx.target.building) < 2) return [];
  const pct = at(params.pct, ctx.source.level);
  return [
    { stat: 'hp', mode: 'pct', value: pct },
    { stat: 'structureHp', mode: 'pct', value: pct },
    { stat: 'dmg', mode: 'pct', value: pct },
  ];
};

/** Gương Chép Bùa: công trình thứ hai nhận bản sao mọi stack Bùa của công trình thứ nhất. */
export const mirrorEnchants: TomeHandler = (state, _content, _params, target) => {
  if (target.kind !== 'two') return 'badTarget';
  return { ...state, plots: copyEnchants(state.plots, target.first, target.second, RUN.maxEnchantStacks) };
};
