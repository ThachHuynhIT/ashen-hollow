import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../game/cards/registry';
import { THRONE_PLOT, initialPlots, placeBuilding } from '../../game/run/board';
import type { BuildingState, PlotState } from '../../game/run/state';
import { dropOutcome, lockedPlotTap, plotHighlights, plotIllegalReason } from './targetHints';

const troop = CONTENT.card('neutral_barracks');
const move = CONTENT.card('neutral_move');
const clearLand = CONTENT.card('neutral_clear_land');

const bld = (uid: number, cardId: BuildingState['cardId'] = 'wheat_scarecrow'): BuildingState => ({
  uid,
  cardId,
  level: 1,
  enchants: [], placedYear: 1, permanent: {}, ageBonus: 0, counters: {}, movedYear: null
});

/** Throne on 12 and a barracks on 7 (both in the opening 3×3). */
const board = (): PlotState[] =>
  placeBuilding(
    placeBuilding(initialPlots(), THRONE_PLOT, bld(0, CONTENT.king('wheat').throne.id)),
    7,
    bld(1),
  );

describe('plotHighlights for Khai Hoang', () => {
  it('marks every locked plot good and every open plot bad', () => {
    const plots = board();
    const map = plotHighlights(plots, clearLand, []);
    plots.forEach((p, i) => expect(map.get(i)).toBe(p.unlocked ? 'bad' : 'good'));
    expect(map.get(0)).toBe('good'); // corner, not next to an open plot
  });
});

describe('plotHighlights', () => {
  it('outlines legal and illegal plots before any pick', () => {
    const map = plotHighlights(board(), troop, []);
    expect(map.size).toBe(25);
    expect(map.get(6)).toBe('good');
    expect(map.get(7)).toBe('bad'); // occupied
    expect(map.get(0)).toBe('bad'); // locked
  });

  it('marks the Dời Nhà source as selected, not good, after the first pick', () => {
    const map = plotHighlights(board(), move, [7]);
    expect(map.get(7)).toBe('selected');
    expect(map.get(6)).toBe('good');
    expect(map.get(THRONE_PLOT)).toBe('bad');
  });

  it('marks both picks of a full target list as selected', () => {
    const map = plotHighlights(board(), move, [7, 6]);
    expect(map.get(7)).toBe('selected');
    expect(map.get(6)).toBe('selected');
  });
});

describe('plotIllegalReason', () => {
  it('gives no red reason for a plot that is already picked', () => {
    expect(plotIllegalReason(board(), move, [7], 7)).toBeNull();
    expect(plotIllegalReason(board(), move, [7], THRONE_PLOT)).toBe('throne');
    expect(plotIllegalReason(board(), move, [], 6)).toBe('noBuilding');
    expect(plotIllegalReason(board(), troop, [], 7)).toBe('occupied');
  });
});

describe('dropOutcome', () => {
  it('plays a one-target card dropped on a legal plot', () => {
    expect(dropOutcome(board(), troop, 6)).toEqual({ action: 'play' });
  });

  it('rejects a drop on an illegal plot with its reason', () => {
    const out = dropOutcome(board(), troop, 7); // occupied
    expect(out).toEqual({ action: 'reject', reason: plotIllegalReason(board(), troop, [], 7) });
    expect('reason' in out && out.reason).toBeTruthy();
  });

  it('starts aiming a two-target card instead of playing it', () => {
    expect(dropOutcome(board(), move, 7)).toEqual({ action: 'aim' });
  });

  it('rejects a bad first pick of a two-target card', () => {
    expect(dropOutcome(board(), move, 6).action).toBe('reject'); // no building to move
  });

  it('plays a no-target card wherever on the board it is dropped', () => {
    const none = CONTENT.allCards().find((c) => c.kind === 'tome' && c.target === 'none')!;
    expect(dropOutcome(board(), none, 0)).toEqual({ action: 'play' });
  });
});

describe('plotHighlights for every card kind', () => {
  const militia = CONTENT.card('wheat_militia');
  const sharpen = CONTENT.card('neutral_sharpen');
  const mirror = CONTENT.card('arcane_mirror');

  const withMilitia = (level: BuildingState['level'], enchants: BuildingState['enchants'] = []): PlotState[] =>
    placeBuilding(board(), 8, { ...bld(2, 'wheat_militia'), level, enchants });

  it('marks an open empty plot good and a copy of the same card below level 5 levelUp', () => {
    const map = plotHighlights(withMilitia(2), militia, []);
    expect(map.get(6)).toBe('good');
    expect(map.get(8)).toBe('levelUp');
    expect(map.get(7)).toBe('bad'); // another building
  });

  it('marks a level 5 copy bad', () => {
    expect(plotHighlights(withMilitia(5), militia, []).get(8)).toBe('bad');
  });

  it('marks only buildings an enchantment fits (and with room) good', () => {
    const map = plotHighlights(withMilitia(1), sharpen, []);
    expect(map.get(8)).toBe('good');
    expect(map.get(6)).toBe('bad'); // empty plot
    expect(map.get(THRONE_PLOT)).toBe('good'); // sharpen targets the throne too
    const full = plotHighlights(withMilitia(1, [{ cardId: 'neutral_sharpen', stacks: 4 }]), sharpen, []);
    expect(full.get(8)).toBe('bad');
  });

  it('highlights the second step of a building-then-building tome', () => {
    const plots = withMilitia(1, [{ cardId: 'neutral_sharpen', stacks: 1 }]);
    const first = plotHighlights(plots, mirror, []);
    expect(first.get(8)).toBe('good');
    expect(first.get(6)).toBe('bad');
    const second = plotHighlights(plots, mirror, [8]);
    expect(second.get(8)).toBe('selected');
    expect(second.get(7)).toBe('good'); // the other building
    expect(second.get(6)).toBe('bad');
  });
});

describe('lockedPlotTap', () => {
  const state = (purchasedPlots = 0) => ({ plots: board(), purchasedPlots });

  it('offers to buy a locked plot next to an open one when no card is aimed', () => {
    expect(lockedPlotTap(state(), 2, null)).toEqual({ kind: 'buy', price: 4 }); // above the open 3×3
    expect(lockedPlotTap(state(3), 2, null)).toEqual({ kind: 'buy', price: 10 });
  });

  it('ignores open plots and locked plots that touch no open plot', () => {
    expect(lockedPlotTap(state(), 6, null)).toEqual({ kind: 'ignore' }); // open
    expect(lockedPlotTap(state(), 0, null)).toEqual({ kind: 'ignore' }); // corner, no open neighbour
  });

  it('ignores a locked plot while another kind of card is aimed', () => {
    expect(lockedPlotTap(state(), 2, troop)).toEqual({ kind: 'ignore' });
    expect(lockedPlotTap(state(), 2, move)).toEqual({ kind: 'ignore' });
  });

  it('lets a Khai Hoang tome target any locked plot instead of buying it', () => {
    expect(lockedPlotTap(state(), 2, clearLand)).toEqual({ kind: 'target' });
    expect(lockedPlotTap(state(), 0, clearLand)).toEqual({ kind: 'target' });
    expect(lockedPlotTap(state(), 6, clearLand)).toEqual({ kind: 'ignore' }); // open plot is not a target
  });
});
