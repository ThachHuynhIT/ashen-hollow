import { describe, expect, it } from 'vitest';
import { CONTENT } from '../cards/registry';
import {
  THRONE_PLOT,
  checkPlay,
  hasAnyTarget,
  initialPlots,
  moveBuilding,
  neighbours,
  placeBuilding,
  unlockPlot,
} from './board';
import type { BuildingState, PlotState } from './state';

const troop = CONTENT.card('neutral_barracks');
const clearLand = CONTENT.card('neutral_clear_land');
const move = CONTENT.card('neutral_move');

const bld = (uid: number, cardId: BuildingState['cardId'] = 'neutral_barracks'): BuildingState => ({
  uid,
  cardId,
  level: 1,
  placedYear: 1,
});

const withThrone = (): PlotState[] =>
  placeBuilding(initialPlots(), THRONE_PLOT, bld(0, CONTENT.king('wheat').throne.id));

describe('neighbours', () => {
  it('lists N, E, S, W and drops off-board cells', () => {
    expect(neighbours(12)).toEqual([7, 13, 17, 11]);
    expect(neighbours(0)).toEqual([1, 5]);
    expect(neighbours(4)).toEqual([9, 3]);
    expect(neighbours(24)).toEqual([19, 23]);
  });
});

describe('initialPlots', () => {
  it('opens the inner 3x3 and holds no buildings', () => {
    const plots = initialPlots();
    expect(plots).toHaveLength(25);
    expect(plots.filter((p) => p.unlocked)).toHaveLength(9);
    for (const i of [6, 7, 8, 11, 12, 13, 16, 17, 18]) expect(plots[i]!.unlocked).toBe(true);
    expect(plots[0]!.unlocked).toBe(false);
    expect(plots[24]!.unlocked).toBe(false);
    expect(plots.every((p) => p.building === null)).toBe(true);
  });
});

describe('checkPlay troop', () => {
  const plots = placeBuilding(withThrone(), 7, bld(1));
  const at = (plot: number) => checkPlay(plots, troop, { kind: 'plot', plot });
  it('applies plot rules', () => {
    expect(at(0)).toBe('locked');
    expect(at(12)).toBe('throne');
    expect(at(7)).toBe('occupied');
    expect(at(6)).toBeNull();
    expect(at(99)).toBe('badTarget');
    expect(checkPlay(plots, troop, { kind: 'none' })).toBe('badTarget');
  });
  it('reports noTarget when nothing is free', () => {
    let full = withThrone();
    for (let i = 0; i < 25; i++) {
      if (full[i]!.unlocked && i !== THRONE_PLOT) full = placeBuilding(full, i, bld(i + 1));
    }
    expect(hasAnyTarget(full, troop)).toBe(false);
    expect(checkPlay(full, troop, { kind: 'plot', plot: 6 })).toBe('noTarget');
  });
});

describe('checkPlay lockedPlot (clear land)', () => {
  const plots = withThrone();
  it('requires a locked plot next to an unlocked one', () => {
    expect(checkPlay(plots, clearLand, { kind: 'plot', plot: 0 })).toBe('notAdjacent');
    expect(checkPlay(plots, clearLand, { kind: 'plot', plot: 1 })).toBeNull();
    expect(checkPlay(plots, clearLand, { kind: 'plot', plot: 6 })).toBe('badTarget');
  });
  it('has no target when all plots are open', () => {
    const open = plots.map((p) => ({ ...p, unlocked: true }));
    expect(hasAnyTarget(open, clearLand)).toBe(false);
  });
});

describe('checkPlay buildingThenPlot (move)', () => {
  const plots = placeBuilding(withThrone(), 7, bld(1));
  const two = (first: number, second: number) => checkPlay(plots, move, { kind: 'two', first, second });
  it('applies source and destination rules', () => {
    expect(two(12, 6)).toBe('throne');
    expect(two(6, 8)).toBe('noBuilding');
    expect(two(0, 6)).toBe('locked');
    expect(two(7, 0)).toBe('locked');
    expect(two(7, 12)).toBe('throne');
    expect(two(7, 7)).toBe('badTarget');
    expect(two(7, 6)).toBeNull();
  });
  it('rejects the wrong target kind', () => {
    expect(checkPlay(plots, move, { kind: 'plot', plot: 7 })).toBe('badTarget');
  });
  it('has no target without a non-throne building', () => {
    expect(hasAnyTarget(withThrone(), move)).toBe(false);
    expect(hasAnyTarget(plots, move)).toBe(true);
  });
});

describe('board mutations', () => {
  it('moveBuilding swaps when destination is occupied and does not mutate', () => {
    let plots = placeBuilding(initialPlots(), 6, bld(1));
    plots = placeBuilding(plots, 7, bld(2));
    const before = structuredClone(plots);
    const next = moveBuilding(plots, 6, 7);
    expect(plots).toEqual(before);
    expect(next[6]!.building!.uid).toBe(2);
    expect(next[7]!.building!.uid).toBe(1);
  });
  it('moveBuilding to an empty plot empties the source', () => {
    const plots = placeBuilding(initialPlots(), 6, bld(1));
    const next = moveBuilding(plots, 6, 8);
    expect(next[6]!.building).toBeNull();
    expect(next[8]!.building!.uid).toBe(1);
  });
  it('unlockPlot and placeBuilding return new arrays', () => {
    const plots = initialPlots();
    const before = structuredClone(plots);
    const a = unlockPlot(plots, 0);
    const b = placeBuilding(plots, 6, bld(1));
    expect(plots).toEqual(before);
    expect(a[0]!.unlocked).toBe(true);
    expect(b[6]!.building!.uid).toBe(1);
  });
});
