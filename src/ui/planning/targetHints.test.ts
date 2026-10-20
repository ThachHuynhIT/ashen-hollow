import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../game/cards/registry';
import { THRONE_PLOT, initialPlots, placeBuilding } from '../../game/run/board';
import type { BuildingState, PlotState } from '../../game/run/state';
import { plotHighlights, plotIllegalReason } from './targetHints';

const troop = CONTENT.card('neutral_barracks');
const move = CONTENT.card('neutral_move');
const clearLand = CONTENT.card('neutral_clear_land');

const bld = (uid: number, cardId: BuildingState['cardId'] = 'neutral_barracks'): BuildingState => ({
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
