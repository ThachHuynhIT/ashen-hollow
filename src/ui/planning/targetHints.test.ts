import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../game/cards/registry';
import { THRONE_PLOT, initialPlots, placeBuilding } from '../../game/run/board';
import type { BuildingState, PlotState } from '../../game/run/state';
import { dropOutcome, plotHighlights, plotIllegalReason } from './targetHints';

const troop = CONTENT.card('neutral_barracks');
const move = CONTENT.card('neutral_move');
const clearLand = CONTENT.card('neutral_clear_land');

const bld = (uid: number, cardId: BuildingState['cardId'] = 'wheat_scarecrow'): BuildingState => ({
  uid,
  cardId,
  level: 1,
  enchants: [], placedYear: 1, permanent: {}
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
