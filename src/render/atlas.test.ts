import { describe, expect, it } from 'vitest';
import {
  buildingFrame,
  cardArtFrame,
  fieldKey,
  fxFrame,
  iconFrame,
  plotFrame,
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
