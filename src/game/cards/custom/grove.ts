/** Hiệu ứng riêng của thẻ chinh phục Vua Rừng Xanh (spec §6.6). */
import { RUN } from '../../../data/run';
import type { Level } from '../../../data/types';
import { levelUpBuilding } from '../../run/board';
import type { BuildingState, RunState } from '../../run/state';
import type { Content } from '../registry';
import type { FullRunCardHooks } from './fullRunTypes';
import type { TomeHandler } from './types';

const SAPLING = 'grove_sapling';
const ROOTS = 'grove_deep_roots';
const SAPLING_YEARS = 3;
const ROOTS_PCT_PER_STACK = 3;
const ROOTS_CAP = 90;

/** Tuổi công trình (năm) = `year − placedYear + ageBonus` (spec §6.6). */
export const ageOf = (b: BuildingState, year: number): number => year - b.placedYear + b.ageBonus;

/** Mưa Xuân: mọi công trình `grove` +2 năm tuổi và mọi Cây Mầm +1 cấp. */
export const springRain: TomeHandler = (state, content, params) => {
  const years = typeof params.years === 'number' ? params.years : 0;
  let plots = state.plots.map((p) => ({ ...p, building: p.building ? { ...p.building } : null }));
  const saplings: number[] = [];
  plots.forEach((p, plot) => {
    const b = p.building;
    if (b === null || !content.card(b.cardId).tags.includes('grove')) return;
    b.ageBonus += years;
    if (b.cardId === SAPLING) saplings.push(plot);
  });
  for (const plot of saplings) plots = levelUpBuilding(plots, plot, 1);
  return { ...state, plots };
};

/**
 * Tăng trưởng đầu năm: Cây Mầm lên 1 cấp mỗi khi tuổi chia hết cho 3; Bùa Rễ Sâu cộng vĩnh viễn
 * +3% HP và DMG mỗi stack (tối đa +90% từ bùa này mỗi công trình). Tính từ năm và `placedYear`
 * nên tải lại ván không tăng hai lần.
 */
const yearGrowth = (state: RunState, _content: Content): RunState => {
  let changed = false;
  let plots = state.plots.map((p) => ({ ...p, building: p.building ? structuredClone(p.building) : null }));
  plots.forEach((p, plot) => {
    const b = p.building;
    if (b === null) return;
    const age = ageOf(b, state.year);
    if (b.cardId === SAPLING && age > 0 && age % SAPLING_YEARS === 0 && b.level < RUN.maxLevel) {
      plots = levelUpBuilding(plots, plot, 1);
      changed = true;
    }
    const roots = b.enchants.find((e) => e.cardId === ROOTS);
    const applied = b.counters.rootsPct ?? 0;
    if (roots && applied < ROOTS_CAP) {
      const add = Math.min(ROOTS_PCT_PER_STACK * roots.stacks, ROOTS_CAP - applied);
      const target = plots[plot]!.building!;
      for (const key of ['hp', 'structureHp', 'dmg'] as const) target.permanent[key] = (target.permanent[key] ?? 0) + add;
      target.counters.rootsPct = applied + add;
      changed = true;
    }
  });
  return changed ? { ...state, plots } : state;
};

export const GROVE_HOOKS: Partial<FullRunCardHooks> = { yearGrowth };

/** Cấp tối đa của một Cây Mầm theo `Level`. */
export const SAPLING_MAX: Level = 5;
