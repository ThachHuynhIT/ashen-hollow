import { describe, expect, it } from 'vitest';
import { PALETTE } from '../data/palette';
import { UI_COLORS } from '../data/uiPalette';
import { CONTENT } from '../game/cards/registry';
import { BUILDING_SIZE, THRONE_SIZE, paintBuilding, paintThrone } from './buildingArt';
import { CARD_ART, paintCardArt } from './cardArt';
import { FIELD_TERRAINS, generateField, paintField, paintFieldTile } from './fieldArt';
import {
  ARROW_DIRS,
  arrowDir,
  paintArrow,
  paintBoulder,
  paintBoulderShadow,
  paintSpark,
} from './fxArt';
import { ICON_IDS, paintIcon } from './iconArt';
import type { PixelCanvas } from './pixel';
import { PLOT_SIZE, paintPlot } from './plotArt';
import { paintUnit, unitCloth, type UnitAnim, type UnitTeam } from './unitArt';

const colorAt = (c: PixelCanvas, x: number, y: number): number => {
  const i = (y * c.width + x) * 4;
  return (c.data[i]! << 16) | (c.data[i + 1]! << 8) | c.data[i + 2]!;
};

const WORLD: readonly number[] = Object.values(PALETTE);

/** Opaque pixels whose colour is not in `colors`. */
const foreign = (c: PixelCanvas, colors: readonly number[]): string[] => {
  const bad: string[] = [];
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      if (c.alphaAt(x, y) === 0) continue;
      const color = colorAt(c, x, y);
      if (!colors.includes(color)) bad.push(`${x},${y}:#${color.toString(16)}`);
    }
  return bad;
};

const count = (c: PixelCanvas, color: number): number => {
  let n = 0;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) if (c.alphaAt(x, y) > 0 && colorAt(c, x, y) === color) n++;
  return n;
};

const same = (a: PixelCanvas, b: PixelCanvas): boolean =>
  a.width === b.width && a.height === b.height && a.data.every((v, i) => v === b.data[i]);

describe('unit art', () => {
  const teams: UnitTeam[] = ['ally', 'foe'];
  const anims: UnitAnim[] = ['idle', 'walk', 'attack'];

  it('paints every unit at its sprite size in PALETTE colours with team outlines', () => {
    for (const def of CONTENT.allUnits()) {
      const cloth = unitCloth(def);
      for (const team of teams)
        for (const anim of anims)
          for (const frame of [0, 1] as const) {
            const art = paintUnit(def, team, anim, frame, cloth);
            const tag = `${def.id} ${team} ${anim} ${frame}`;
            expect([art.width, art.height], tag).toEqual([def.sprite.w, def.sprite.h]);
            expect(foreign(art, WORLD), tag).toEqual([]);
            if (team === 'ally') {
              expect(count(art, PALETTE.outline), tag).toBeGreaterThan(0);
              expect(count(art, PALETTE.redDark), tag).toBe(0);
            } else {
              expect(count(art, PALETTE.redDark), tag).toBeGreaterThan(0);
              expect(count(art, PALETTE.red), tag).toBe(1);
            }
          }
    }
  });

  it('animates, tells teams apart and casts a shadow at the feet', () => {
    for (const def of CONTENT.allUnits()) {
      const cloth = unitCloth(def);
      const a0 = paintUnit(def, 'ally', 'idle', 0, cloth);
      const a1 = paintUnit(def, 'ally', 'idle', 1, cloth);
      expect(same(a0, a1), def.id).toBe(false);
      expect(same(a0, paintUnit(def, 'foe', 'idle', 0, cloth)), def.id).toBe(false);
      const w0 = paintUnit(def, 'ally', 'walk', 0, cloth);
      expect(same(w0, paintUnit(def, 'ally', 'walk', 1, cloth)), def.id).toBe(false);
      const k0 = paintUnit(def, 'ally', 'attack', 0, cloth);
      expect(same(k0, paintUnit(def, 'ally', 'attack', 1, cloth)), def.id).toBe(false);
      let shadow = 0;
      for (let x = 0; x < a0.width; x++) shadow += a0.alphaAt(x, a0.height - 1) > 0 ? 1 : 0;
      expect(shadow, def.id).toBeGreaterThan(0);
    }
  });

  it('gives different unit kinds different pictures and cloth', () => {
    const militia = paintUnit(CONTENT.unit('militia'), 'ally', 'idle', 0, PALETTE.wheat);
    const footman = paintUnit(CONTENT.unit('footman'), 'ally', 'idle', 0, PALETTE.blue);
    expect(same(militia, footman)).toBe(false);
    expect(unitCloth(CONTENT.unit('militia'))).toBe(PALETTE.wheat);
    expect(unitCloth(CONTENT.unit('footman'))).toBe(PALETTE.blue);
    expect(unitCloth(CONTENT.unit('bandit'))).toBe(PALETTE.soil);
  });
});

describe('buildings and plots', () => {
  it('paints troop, tower and throne at their sizes in PALETTE colours', () => {
    const troop = paintBuilding('troop', PALETTE.red);
    const tower = paintBuilding('tower', PALETTE.blue);
    const throne = paintThrone(PALETTE.gold);
    expect([troop.width, troop.height]).toEqual([BUILDING_SIZE.w, BUILDING_SIZE.h]);
    expect([tower.width, tower.height]).toEqual([32, 40]);
    expect([throne.width, throne.height]).toEqual([THRONE_SIZE.w, THRONE_SIZE.h]);
    expect([THRONE_SIZE.w, THRONE_SIZE.h]).toEqual([32, 48]);
    for (const art of [troop, tower, throne]) expect(foreign(art, WORLD)).toEqual([]);
    expect(same(troop, tower)).toBe(false);
  });

  it('paints three plot states at 32x32, open different from locked', () => {
    const open = paintPlot('open');
    const locked = paintPlot('locked');
    const throne = paintPlot('throne');
    for (const art of [open, locked, throne]) {
      expect([art.width, art.height]).toEqual([PLOT_SIZE, PLOT_SIZE]);
      expect(foreign(art, WORLD)).toEqual([]);
    }
    expect(PLOT_SIZE).toBe(32);
    expect(same(open, locked)).toBe(false);
  });
});

describe('field art', () => {
  it('generates a 24x24 field with a clear board area', () => {
    const f = generateField(1);
    expect(f.length).toBe(576);
    for (const v of f) expect(v).toBeLessThan(FIELD_TERRAINS.length);
    for (let row = 7; row <= 16; row++)
      for (let col = 7; col <= 16; col++) expect([0, 1]).toContain(f[row * 24 + col]);
  });

  it('is deterministic per seed and varies between seeds', () => {
    expect(generateField(7)).toEqual(generateField(7));
    const base = generateField(1);
    let differing = 0;
    for (let s = 2; s <= 11; s++) if (generateField(s).some((v, i) => v !== base[i])) differing++;
    expect(differing).toBeGreaterThan(0);
  });

  it('paints every terrain and mask tile at 16x16 in PALETTE colours', () => {
    for (let t = 0; t < FIELD_TERRAINS.length; t++)
      for (let mask = 0; mask <= 15; mask++) {
        const tile = paintFieldTile(t, mask, 3);
        expect([tile.width, tile.height]).toEqual([16, 16]);
        expect(foreign(tile, WORLD), `${t}/${mask}`).toEqual([]);
      }
  });

  it('paints the whole field opaque at 384x384, deterministically', () => {
    const f = paintField(1);
    expect([f.width, f.height]).toEqual([384, 384]);
    expect(foreign(f, WORLD)).toEqual([]);
    for (let i = 3; i < f.data.length; i += 4) if (f.data[i] !== 255) throw new Error(`hole at ${i}`);
    expect(same(f, paintField(1))).toBe(true);
  });
});

describe('icons and fx', () => {
  it('paints 7 icons at 16x16 in UI colours', () => {
    expect(ICON_IDS.length).toBe(7);
    for (const id of ICON_IDS) {
      const art = paintIcon(id);
      expect([art.width, art.height], id).toEqual([16, 16]);
      expect(foreign(art, UI_COLORS), id).toEqual([]);
    }
  });

  it('paints 8 distinct arrows at 8x8', () => {
    const arts = ARROW_DIRS.map((d) => paintArrow(d));
    for (const art of arts) {
      expect([art.width, art.height]).toEqual([8, 8]);
      expect(foreign(art, WORLD)).toEqual([]);
    }
    for (let i = 0; i < arts.length; i++)
      for (let j = i + 1; j < arts.length; j++)
        expect(same(arts[i]!, arts[j]!), `${i}/${j}`).toBe(false);
  });

  it('picks the arrow direction on a screen with y down', () => {
    expect(arrowDir(1, 0)).toBe('e');
    expect(arrowDir(0, -1)).toBe('n');
    expect(arrowDir(1, -1)).toBe('ne');
    expect(arrowDir(-1, 1)).toBe('sw');
    expect(arrowDir(0, 1)).toBe('s');
    expect(arrowDir(1, 0.3)).toBe('e');
    expect(arrowDir(0.3, 1)).toBe('s');
    expect(arrowDir(0, 0)).toBe('e');
    expect(arrowDir(-1, 0)).toBe('w');
    expect(arrowDir(-1, -1)).toBe('nw');
    expect(arrowDir(1, 1)).toBe('se');
  });

  it('paints boulder, shadow and spark', () => {
    const b = paintBoulder();
    const s = paintBoulderShadow();
    const k = paintSpark();
    expect([b.width, b.height]).toEqual([16, 16]);
    expect([s.width, s.height]).toEqual([24, 8]);
    expect([k.width, k.height]).toEqual([4, 4]);
    for (const art of [b, s, k]) expect(foreign(art, WORLD)).toEqual([]);
  });
});

describe('card art', () => {
  it('paints every card picture at 32x24 in PALETTE colours', () => {
    const cards = CONTENT.allCards();
    expect(cards.length).toBeGreaterThanOrEqual(7);
    for (const def of cards) {
      const art = paintCardArt(def, PALETTE.red);
      expect([art.width, art.height], def.id).toEqual([CARD_ART.w, CARD_ART.h]);
      expect(foreign(art, WORLD), def.id).toEqual([]);
    }
  });
});
