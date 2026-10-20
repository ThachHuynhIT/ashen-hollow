import type { CardDef } from '../../data/types';
import { adjacentToUnlocked, checkTargetStep, targetCount } from '../../game/run/board';
import type { IllegalReason, PlotState, RunState } from '../../game/run/state';
import { lockedPlotPrice } from '../realm/calendarModel';
import type { PlotHighlight } from '../../render/BoardRenderer';

/**
 * Outline of every plot while `card` is aimed with `targets` picked so far: picked plots are
 * `selected`, the rest `good`/`bad` for the next pick (a full target list re-picks its last);
 * a building card over a copy of itself is `levelUp`.
 */
export const plotHighlights = (
  plots: readonly PlotState[],
  card: CardDef,
  targets: readonly number[],
): Map<number, PlotHighlight> => {
  const chosen = targets.slice(0, Math.max(0, targetCount(card) - 1));
  const map = new Map<number, PlotHighlight>();
  const building =
    card.kind === 'troop' || card.kind === 'tower' || card.kind === 'economy' || card.kind === 'support';
  for (let plot = 0; plot < plots.length; plot++) {
    if (checkTargetStep(plots, card, chosen, plot) !== null) map.set(plot, 'bad');
    else map.set(plot, building && plots[plot]!.building?.cardId === card.id ? 'levelUp' : 'good');
  }
  for (const t of targets) map.set(t, 'selected');
  return map;
};

/** Why `plot` cannot be the next pick, or null when it is legal or already picked. */
export const plotIllegalReason = (
  plots: readonly PlotState[],
  card: CardDef,
  targets: readonly number[],
  plot: number,
): IllegalReason | null => {
  if (targets.includes(plot)) return null;
  const chosen = targets.slice(0, Math.max(0, targetCount(card) - 1));
  return checkTargetStep(plots, card, chosen, plot);
};

export type DropOutcome =
  | { action: 'play' }
  | { action: 'aim' }
  | { action: 'reject'; reason: IllegalReason };

/**
 * What dropping `card` on `plot` does: play it at once (one target, or none anywhere on the
 * board), start aiming a two-target card with this plot as its first pick, or reject it.
 */
export const dropOutcome = (plots: readonly PlotState[], card: CardDef, plot: number): DropOutcome => {
  const count = targetCount(card);
  if (count === 0) return { action: 'play' };
  const reason = checkTargetStep(plots, card, [], plot);
  if (reason !== null) return { action: 'reject', reason };
  return { action: count === 1 ? 'play' : 'aim' };
};

export type LockedPlotTap =
  | { kind: 'buy'; price: number }
  | { kind: 'target' }
  | { kind: 'ignore' };

/**
 * What a tap on `plot` means when it is locked: with no card aimed and an open neighbour it is a
 * purchase offer (price from `purchasedPlots`); while aiming a Khai Hoang tome it is that card's
 * target; anything else (open plot, no open neighbour, another card aimed) is ignored.
 */
export const lockedPlotTap = (
  state: Pick<RunState, 'plots' | 'purchasedPlots'>,
  plot: number,
  aiming: CardDef | null,
): LockedPlotTap => {
  const p = state.plots[plot];
  if (!p || p.unlocked) return { kind: 'ignore' };
  if (aiming !== null) {
    return aiming.kind === 'tome' && aiming.target === 'lockedPlot' ? { kind: 'target' } : { kind: 'ignore' };
  }
  return adjacentToUnlocked(state.plots, plot) ? { kind: 'buy', price: lockedPlotPrice(state) } : { kind: 'ignore' };
};
