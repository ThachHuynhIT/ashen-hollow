/** Luật bàn cờ 5×5 (spec §4.1, §4.4). Hàm thuần, trả mảng mới, không sửa đầu vào. */
import type { CardDef } from '../../data/types';
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

export function hasAnyTarget(plots: readonly PlotState[], card: CardDef): boolean {
  switch (card.kind) {
    case 'troop':
    case 'tower':
      return plots.some((p, i) => p.unlocked && p.building === null && i !== THRONE_PLOT);
    case 'tome':
      if (card.target === 'lockedPlot') {
        return plots.some((p) => !p.unlocked);
      }
      return (
        plots.some((p, i) => p.building !== null && i !== THRONE_PLOT) &&
        plots.filter((p) => p.unlocked).length >= 2
      );
    default:
      return false;
  }
}

export function checkPlay(
  plots: readonly PlotState[],
  card: CardDef,
  target: PlayTarget,
): IllegalReason | null {
  if (card.kind === 'throne') return 'badTarget';
  const needsTwo = card.kind === 'tome' && card.target === 'buildingThenPlot';
  if (needsTwo) {
    if (target.kind !== 'two') return 'badTarget';
    if (!validPlot(target.first) || !validPlot(target.second)) return 'badTarget';
  } else {
    if (target.kind !== 'plot') return 'badTarget';
    if (!validPlot(target.plot)) return 'badTarget';
  }
  if (!hasAnyTarget(plots, card)) return 'noTarget';

  if (target.kind === 'plot') {
    const plot = target.plot;
    const p = plots[plot]!;
    if (card.kind === 'tome') {
      return p.unlocked ? 'badTarget' : null;
    }
    if (!p.unlocked) return 'locked';
    if (plot === THRONE_PLOT) return 'throne';
    if (p.building !== null) return 'occupied';
    return null;
  }
  if (target.kind === 'two') {
    const { first, second } = target;
    if (first === THRONE_PLOT) return 'throne';
    if (!plots[first]!.unlocked) return 'locked';
    if (plots[first]!.building === null) return 'noBuilding';
    if (!plots[second]!.unlocked) return 'locked';
    if (second === THRONE_PLOT) return 'throne';
    if (second === first) return 'badTarget';
    return null;
  }
  return 'badTarget';
}

/** How many plots a card targets: 2 for the building-then-plot tome (Dời Nhà), else 1. */
export const targetCount = (card: CardDef): 1 | 2 =>
  card.kind === 'tome' && card.target === 'buildingThenPlot' ? 2 : 1;

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
): IllegalReason | null {
  if (targetCount(card) === 1) return checkPlay(plots, card, { kind: 'plot', plot });
  const first = chosen[0];
  if (first !== undefined) return checkPlay(plots, card, { kind: 'two', first, second: plot });
  for (let second = 0; second < COUNT; second++) {
    if (second === plot) continue;
    if (checkPlay(plots, card, { kind: 'two', first: plot, second }) === null) return null;
  }
  // No second plot works: report why `plot` fails as a first pick ('badTarget' if it is
  // a fine first pick with nowhere to go).
  return checkPlay(plots, card, { kind: 'two', first: plot, second: plot });
}

const cloneBuilding = (b: BuildingState | null): BuildingState | null => (b ? { ...b } : null);

const clonePlots = (plots: readonly PlotState[]): PlotState[] =>
  plots.map((p) => ({ unlocked: p.unlocked, building: cloneBuilding(p.building) }));

export function placeBuilding(
  plots: readonly PlotState[],
  plot: number,
  building: BuildingState,
): PlotState[] {
  const next = clonePlots(plots);
  next[plot]!.building = { ...building };
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
