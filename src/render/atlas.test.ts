import { describe, expect, it } from 'vitest';
import { ALL_KINGS } from '../data/rules';
import { CONTENT } from '../game/cards/registry';
import {
  buildingFrame,
  cardArtFrame,
  fieldKey,
  fxFrame,
  iconFrame,
  packShelves,
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

  it('has the pulse, shield and stun effect frames', () => {
    for (const name of ['pulse', 'shield', 'stun']) expect(names.has(fxFrame(name)), name).toBe(true);
  });

  it('has the G2 icons', () => {
    for (const id of ['gold', 'level', 'enchant', 'reroll', 'sell', 'lock', 'conquer'] as const)
      expect(names.has(iconFrame(id)), id).toBe(true);
  });
});

describe('the G3 content in the atlas', () => {
  const list = spriteList(CONTENT);
  const byName = new Map(list.map((s) => [s.name, s]));

  it('has no duplicate frame names', () => {
    expect(byName.size).toBe(list.length);
  });

  it('draws every registered unit at exactly its UnitDef sprite size (bosses included)', () => {
    for (const unit of CONTENT.allUnits()) {
      for (const team of ['ally', 'foe'] as const) {
        const art = byName.get(unitFrame(unit.id, team, 'idle', 0))!.art;
        expect([art.width, art.height], `${unit.id} ${team}`).toEqual([unit.sprite.w, unit.sprite.h]);
      }
    }
    const bossDef = CONTENT.unit('boss_bog_ogre');
    const boss = byName.get(unitFrame('boss_bog_ogre', 'foe', 'idle', 0))!.art;
    expect([boss.width, boss.height]).toEqual([bossDef.sprite.w, bossDef.sprite.h]);
  });

  it('has the three bosses, the frog and the hornet', () => {
    for (const id of ['boss_bog_ogre', 'boss_hornet_queen', 'boss_crownless_king', 'frog', 'hornet'] as const) {
      expect(byName.has(unitFrame(id, 'foe', 'attack', 1)), id).toBe(true);
    }
  });

  it('has art for all 9 cards of each of the 9 kings and the neutral pool', () => {
    for (const king of ALL_KINGS) {
      const cards = CONTENT.allCards().filter((c) => c.owner === king && c.kind !== 'throne');
      expect(cards, king).toHaveLength(9);
      for (const card of cards) expect(byName.has(cardArtFrame(card.id)), card.id).toBe(true);
    }
    expect(CONTENT.allCards().filter((c) => c.owner !== 'neutral' && c.kind !== 'throne')).toHaveLength(81);
    for (const card of CONTENT.neutralPool()) expect(byName.has(cardArtFrame(card.id)), card.id).toBe(true);
  });

  it('packs into one sheet that fits a 4096 texture', () => {
    const { height } = packShelves(list, 512);
    expect(height).toBeLessThanOrEqual(4096);
  });
});
