/** Luật bàn cờ 5×5 (spec §4.1, §4.4). Hàm thuần, trả mảng mới, không sửa đầu vào. */
import { RUN } from '../../data/run';
import type { BuildingKind, CardDef, CardId, Level, TomeCardDef } from '../../data/types';
import { CONTENT, type Content } from '../cards/registry';
import type { BuildingState, IllegalReason, PlayTarget, PlotState } from './state';

const SIZE = 5;
const COUNT = SIZE * SIZE;
export const THRONE_PLOT = 12;

export const plotCol = (plot: number): number => plot - Math.floor(plot / SIZE) * SIZE;
export const plotRow = (plot: number): number => Math.floor(plot / SIZE);

const validPlot = (plot: number): boolean => Number.isInteger(plot) && plot >= 0 && plot < COUNT;

/** Bắc, Đông, Nam, Tây; bỏ ô ngoài bàn. */
export function neighbours(plot: number): number[] {
  const c = plotCol(plot);
  const r = plotRow(plot);
  const out: number[] = [];
  if (r > 0) out.push(plot - SIZE);
  if (c < SIZE - 1) out.push(plot + 1);
  if (r < SIZE - 1) out.push(plot + SIZE);
  if (c > 0) out.push(plot - 1);
  return out;
}

export function initialPlots(): PlotState[] {
  const plots: PlotState[] = [];
  for (let i = 0; i < COUNT; i++) {
    const c = plotCol(i);
    const r = plotRow(i);
    plots.push({ unlocked: c >= 1 && c <= 3 && r >= 1 && r <= 3, building: null });
  }
  return plots;
}

/** Ô khoá kề (Bắc/Đông/Nam/Tây) một ô đã mở — luật mua ô bằng vàng (spec §3.11), không áp cho Khai Hoang. */
export const adjacentToUnlocked = (plots: readonly PlotState[], plot: number): boolean =>
  neighbours(plot).some((n) => plots[n]!.unlocked);

const stacksOf = (b: BuildingState): number => b.enchants.reduce((n, e) => n + e.stacks, 0);

/** Loại công trình (kể cả Ngai) của một công trình đang đứng trên bàn cờ. */
const kindOf = (b: BuildingState, content: Content): BuildingKind =>
  content.card(b.cardId).kind as BuildingKind;

const hasAction = (card: TomeCardDef, type: TomeCardDef['actions'][number]['type']): boolean =>
  card.actions.some((a) => a.type === type);

/** Số ô một thẻ nhắm tới: 0 (sách `none`), 1, hoặc 2 (Dời Nhà, Gương Chép Bùa). */
export const targetCount = (card: CardDef): 0 | 1 | 2 => {
  if (card.kind !== 'tome') return 1;
  if (card.target === 'none') return 0;
  return card.target === 'buildingThenPlot' || card.target === 'buildingThenBuilding' ? 2 : 1;
};

export function hasAnyTarget(
  plots: readonly PlotState[],
  card: CardDef,
  content: Content = CONTENT,
): boolean {
  switch (card.kind) {
    case 'throne':
      return false;
    case 'troop':
    case 'tower':
    case 'economy':
    case 'support':
      return plots.some(
        (p, i) =>
          p.unlocked &&
          i !== THRONE_PLOT &&
          (p.building === null || (p.building.cardId === card.id && p.building.level < RUN.maxLevel)),
      );
    case 'enchantment':
      return plots.some(
        (p) =>
          p.unlocked &&
          p.building !== null &&
          card.targets.includes(kindOf(p.building, content)) &&
          stacksOf(p.building) < RUN.maxEnchantStacks,
      );
    case 'tome':
      switch (card.target) {
        case 'none':
          return true;
        case 'lockedPlot':
          return plots.some((p) => !p.unlocked);
        case 'emptyPlot':
          return plots.some((p, i) => p.unlocked && p.building === null && i !== THRONE_PLOT);
        case 'building':
          return plots.some(
            (p, i) =>
              p.unlocked &&
              p.building !== null &&
              i !== THRONE_PLOT &&
              (!hasAction(card, 'levelUp') || p.building.level < RUN.maxLevel),
          );
        case 'buildingThenPlot':
          return (
            plots.some((p, i) => p.building !== null && i !== THRONE_PLOT) &&
            plots.filter((p) => p.unlocked).length >= 2
          );
        case 'buildingThenBuilding':
          return plots.filter((p) => p.unlocked && p.building !== null).length >= 2;
      }
  }
}

export function checkPlay(
  plots: readonly PlotState[],
  card: CardDef,
  target: PlayTarget,
  content: Content = CONTENT,
): IllegalReason | null {
  if (card.kind === 'throne') return 'badTarget';
  const count = targetCount(card);
  if (count === 0) {
    if (target.kind !== 'none') return 'badTarget';
  } else if (count === 2) {
    if (target.kind !== 'two') return 'badTarget';
    if (!validPlot(target.first) || !validPlot(target.second)) return 'badTarget';
  } else {
    if (target.kind !== 'plot') return 'badTarget';
    if (!validPlot(target.plot)) return 'badTarget';
  }
  if (!hasAnyTarget(plots, card, content)) return 'noTarget';

  if (target.kind === 'plot') {
    const plot = target.plot;
    const p = plots[plot]!;
    if (card.kind === 'tome') {
      if (card.target === 'lockedPlot') return p.unlocked ? 'badTarget' : null;
      if (!p.unlocked) return 'locked';
      if (card.target === 'emptyPlot') {
        if (plot === THRONE_PLOT) return 'throne';
        return p.building === null ? null : 'occupied';
      }
      // 'building'
      if (plot === THRONE_PLOT) return 'throne';
      if (p.building === null) return 'noBuilding';
      if (hasAction(card, 'levelUp') && p.building.level >= RUN.maxLevel) return 'maxLevel';
      return null;
    }
    if (!p.unlocked) return 'locked';
    if (card.kind === 'enchantment') {
      if (p.building === null) return 'noBuilding';
      if (!card.targets.includes(kindOf(p.building, content))) {
        return plot === THRONE_PLOT ? 'throne' : 'wrongKind';
      }
      return stacksOf(p.building) >= RUN.maxEnchantStacks ? 'stacksFull' : null;
    }
    if (plot === THRONE_PLOT) return 'throne';
    if (p.building === null) return null;
    if (p.building.cardId !== card.id) return 'occupied';
    return p.building.level >= RUN.maxLevel ? 'maxLevel' : null;
  }
  if (target.kind === 'two') {
    const { first, second } = target;
    const anyBuilding = card.kind === 'tome' && card.target === 'buildingThenBuilding';
    if (!anyBuilding && first === THRONE_PLOT) return 'throne';
    if (!plots[first]!.unlocked) return 'locked';
    if (plots[first]!.building === null) return 'noBuilding';
    if (!plots[second]!.unlocked) return 'locked';
    if (anyBuilding) {
      if (plots[second]!.building === null) return 'noBuilding';
    } else if (second === THRONE_PLOT) {
      return 'throne';
    }
    if (second === first) return 'badTarget';
    return null;
  }
  return null; // target.kind === 'none' for a 'none' tome that has a target
}

/**
 * Legality of picking `plot` as the next target of `card`, given the plots already
 * `chosen` (used while the player picks targets one by one). A first pick of a two-target
 * card is legal when some second plot completes a legal play.
 */
export function checkTargetStep(
  plots: readonly PlotState[],
  card: CardDef,
  chosen: readonly number[],
  plot: number,
  content: Content = CONTENT,
): IllegalReason | null {
  const count = targetCount(card);
  if (count === 0) return checkPlay(plots, card, { kind: 'none' }, content);
  if (count === 1) return checkPlay(plots, card, { kind: 'plot', plot }, content);
  const first = chosen[0];
  if (first !== undefined) return checkPlay(plots, card, { kind: 'two', first, second: plot }, content);
  for (let second = 0; second < COUNT; second++) {
    if (second === plot) continue;
    if (checkPlay(plots, card, { kind: 'two', first: plot, second }, content) === null) return null;
  }
  // No second plot works: report why `plot` fails as a first pick ('badTarget' if it is
  // a fine first pick with nowhere to go).
  return checkPlay(plots, card, { kind: 'two', first: plot, second: plot }, content);
}

const cloneBuilding = (b: BuildingState | null): BuildingState | null =>
  b ? { ...b, enchants: b.enchants.map((e) => ({ ...e })), permanent: { ...b.permanent } } : null;

const clonePlots = (plots: readonly PlotState[]): PlotState[] =>
  plots.map((p) => ({ unlocked: p.unlocked, building: cloneBuilding(p.building) }));

export function placeBuilding(
  plots: readonly PlotState[],
  plot: number,
  building: BuildingState,
): PlotState[] {
  const next = clonePlots(plots);
  next[plot]!.building = cloneBuilding(building);
  return next;
}

export function unlockPlot(plots: readonly PlotState[], plot: number): PlotState[] {
  const next = clonePlots(plots);
  next[plot]!.unlocked = true;
  return next;
}

/** Dời công trình `from` sang `to`; nếu `to` có công trình thì đổi chỗ. */
export function moveBuilding(plots: readonly PlotState[], from: number, to: number): PlotState[] {
  const next = clonePlots(plots);
  const a = next[from]!.building;
  next[from]!.building = next[to]!.building;
  next[to]!.building = a;
  return next;
}

/** +`amount` cấp cho công trình ở `plot`, tối đa `RUN.maxLevel`. */
export function levelUpBuilding(plots: readonly PlotState[], plot: number, amount: number): PlotState[] {
  const next = clonePlots(plots);
  const b = next[plot]!.building;
  if (b !== null) b.level = Math.min(RUN.maxLevel, b.level + amount) as Level;
  return next;
}

/** +1 stack của Bùa `cardId` lên công trình ở `plot` (thêm mục mới theo thứ tự gắn lần đầu). */
export function attachEnchant(
  plots: readonly PlotState[],
  plot: number,
  cardId: CardId,
  maxStacks: number,
): PlotState[] {
  const next = clonePlots(plots);
  const b = next[plot]!.building;
  if (b === null || stacksOf(b) >= maxStacks) return next;
  const entry = b.enchants.find((e) => e.cardId === cardId);
  if (entry) entry.stacks += 1;
  else b.enchants.push({ cardId, stacks: 1 });
  return next;
}

/** Xoá công trình ở `plot` cùng Bùa của nó; ô vẫn mở. */
export function sacrificeBuilding(plots: readonly PlotState[], plot: number): PlotState[] {
  const next = clonePlots(plots);
  next[plot]!.building = null;
  return next;
}

/** Chép mọi stack Bùa từ `from` sang `to` theo thứ tự gắn, dừng khi `to` đủ `maxStacks`. */
export function copyEnchants(
  plots: readonly PlotState[],
  from: number,
  to: number,
  maxStacks: number,
): PlotState[] {
  const source = plots[from]?.building;
  let next = clonePlots(plots);
  if (!source) return next;
  for (const entry of source.enchants) {
    for (let i = 0; i < entry.stacks; i++) {
      const target = next[to]!.building;
      if (target === null || stacksOf(target) >= maxStacks) return next;
      next = attachEnchant(next, to, entry.cardId, maxStacks);
    }
  }
  return next;
}
