import type { CardDef } from '../../data/types';
import { checkTargetStep, targetCount } from '../../game/run/board';
import type { IllegalReason, PlotState } from '../../game/run/state';
import type { PlotHighlight } from '../../render/BoardRenderer';

/**
 * Outline of every plot while `card` is aimed with `targets` picked so far: picked plots are
 * `selected`, the rest `good`/`bad` for the next pick (a full target list re-picks its last).
 */
export const plotHighlights = (
  plots: readonly PlotState[],
  card: CardDef,
  targets: readonly number[],
): Map<number, PlotHighlight> => {
  const chosen = targets.slice(0, Math.max(0, targetCount(card) - 1));
  const map = new Map<number, PlotHighlight>();
  for (let plot = 0; plot < plots.length; plot++) {
    map.set(plot, checkTargetStep(plots, card, chosen, plot) === null ? 'good' : 'bad');
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
