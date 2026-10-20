import { describe, expect, it } from 'vitest';
import { CONTENT } from '../game/cards/registry';
import {
  buildingFrame,
  cardArtFrame,
  fieldKey,
  fxFrame,
  iconFrame,
  plotFrame,
  spriteList,
  unitFrame,
} from './atlas';

describe('atlas frame names', () => {
  it('names unit, building, plot, card art and icon frames', () => {
    expect(unitFrame('militia', 'ally', 'walk', 1)).toBe('unit_militia_ally_walk1');
    expect(buildingFrame('wheat_throne')).toBe('building_wheat_throne');
    expect(plotFrame('locked')).toBe('plot_locked');
    expect(cardArtFrame('neutral_barracks')).toBe('card_art_neutral_barracks');
    expect(iconFrame('crown')).toBe('icon_crown');
  });

  it('names fx frames and the per-seed field texture', () => {
    expect(fxFrame('arrow_ne')).toBe('fx_arrow_ne');
    expect(fxFrame('boulder_shadow')).toBe('fx_boulder_shadow');
    expect(fieldKey(42)).toBe('field-42');
  });
});

describe('spriteList for the content', () => {
  const names = new Set(spriteList(CONTENT).map((s) => s.name));

  it('has card art for every card and a building frame for every placeable building', () => {
    for (const card of CONTENT.allCards()) {
      expect(names.has(cardArtFrame(card.id)), card.id).toBe(true);
      if (['throne', 'troop', 'tower', 'economy', 'support'].includes(card.kind))
        expect(names.has(buildingFrame(card.id)), card.id).toBe(true);
    }
  });

  it('has idle, walk and attack frames of every unit for both teams', () => {
    for (const unit of CONTENT.allUnits())
      for (const team of ['ally', 'foe'] as const)
        for (const anim of ['idle', 'walk', 'attack'] as const)
          expect(names.has(unitFrame(unit.id, team, anim, 0)), `${unit.id} ${team} ${anim}`).toBe(true);
  });

  it('has the G2 icons', () => {
    for (const id of ['gold', 'level', 'enchant', 'reroll', 'sell', 'lock', 'conquer'] as const)
      expect(names.has(iconFrame(id)), id).toBe(true);
  });
});
