import { describe, expect, it } from 'vitest';
import type { CardDef, DecreeId, Level } from '../../data/types';
import { createBattle, spawnWave, KIND_UNIT, TEAM_ALLY, TEAM_FOE, type BattleWorld } from '../../game/battle/world';
import { describeCard } from '../../game/cards/describe';
import { CONTENT } from '../../game/cards/registry';
import { buildBattleSetup } from '../../game/run/battleSetup';
import type { RunState } from '../../game/run/state';
import { runState, withBuilding } from '../../game/testing/fixtures';
import { buildingInfoModel, levelStars, unitInfoModel, unitPreviewModel } from './inspectionModel';

const militia = (level: Level = 3, over: Partial<RunState> = {}): RunState =>
  withBuilding({ ...runState(), ...over }, 6, 'wheat_militia', level);

const worldOf = (state: RunState): BattleWorld => createBattle(buildBattleSetup(state, CONTENT));
const allyUnit = (w: BattleWorld): number => {
  for (let i = 0; i < w.count; i++) if (w.kind[i] === KIND_UNIT && w.team[i] === TEAM_ALLY) return i;
  throw new Error('no ally unit');
};

describe('levelStars', () => {
  it('stars_1_to_5: filled 1..5 of 5 with a "Cấp N/5" label', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const s = levelStars(level);
      expect([s.filled, s.total, s.label]).toEqual([level, 5, `Cấp ${level}/5`]);
    }
  });
});

describe('buildingInfoModel', () => {
  it('effective_building_and_next_level: L3 militia is 225 HP with the L3 text, next shows the L4 gain', () => {
    const m = buildingInfoModel(militia(3), 6, CONTENT)!;
    expect(m.title).toBe('Dân Quân');
    expect(m.stars.filled).toBe(3);
    expect(m.hp).toBe(225);
    expect(m.description).toEqual(describeCard(CONTENT.card('wheat_militia'), 3).lines);
    expect(m.spawn!.hp).toBeGreaterThan(0);
    expect(m.next!.join('\n')).toContain('225');
    expect(m.next!.join('\n')).toContain('262.5');
  });

  it('has no next level at L5 and null for an empty plot', () => {
    expect(buildingInfoModel(militia(5), 6, CONTENT)!.next).toBeNull();
    expect(buildingInfoModel(runState(), 0, CONTENT)).toBeNull();
  });

  it('reads the throne level for the throne', () => {
    const base = runState();
    const l1 = buildingInfoModel(base, 12, CONTENT)!;
    const l3 = buildingInfoModel({ ...base, throneLevel: 3 }, 12, CONTENT)!;
    expect(l3.stars.filled).toBe(3);
    expect(l3.hp).toBeGreaterThan(l1.hp);
    expect(buildingInfoModel({ ...base, throneLevel: 5 }, 12, CONTENT)!.next).toBeNull();
  });

  it('gives every building kind an effective HP, not only troops and towers', () => {
    for (const kind of ['troop', 'tower', 'economy', 'support'] as const) {
      const card = CONTENT.allCards().find((c: CardDef) => c.kind === kind)!;
      const m = buildingInfoModel(withBuilding(runState(), 6, card.id, 1), 6, CONTENT)!;
      expect(m.hp, kind).toBeGreaterThan(0);
    }
  });

  it('age_and_enchants: age is year − placedYear + bonus with the bonus separate, and only real enchants are listed', () => {
    const grove = CONTENT.allCards().find((c: CardDef) => 'tags' in c && c.tags.includes('grove') && c.kind !== 'tome')!;
    const s = withBuilding({ ...runState(), year: 12 }, 6, grove.id, 1, { placedYear: 7, ageBonus: 2 });
    const m = buildingInfoModel(s, 6, CONTENT)!;
    expect(m.age).toEqual({ years: 7, bonus: 2 });
    expect(buildingInfoModel(militia(1), 6, CONTENT)!.age).toBeNull();
    const e = withBuilding(runState(), 6, 'wheat_militia', 1, {
      enchants: [{ cardId: 'neutral_sharpen', stacks: 3 }],
    });
    expect(buildingInfoModel(e, 6, CONTENT)!.enchants).toEqual([`${CONTENT.card('neutral_sharpen').nameVi} ×3`]);
  });

  it('separate_unit_model: the building text carries no unit stat block', () => {
    const m = buildingInfoModel(militia(3), 6, CONTENT)!;
    expect(m.description.join('\n')).not.toContain('Máu lính');
    expect(m.spawn).not.toBeNull();
    expect(buildingInfoModel(withBuilding(runState(), 6, 'neutral_archer_tower', 1), 6, CONTENT)!.spawn).toBeNull();
  });

  it('does not mutate the state', () => {
    const s = militia(3);
    const copy = structuredClone(s);
    buildingInfoModel(s, 6, CONTENT);
    expect(s).toEqual(copy);
  });
});

describe('unitInfoModel', () => {
  it('live_unit_stats_and_unknown_origin: an ally unit knows its source level, a foe does not', () => {
    const state = militia(4);
    const w = worldOf(state);
    const a = allyUnit(w);
    const m = unitInfoModel(w, a, state, CONTENT)!;
    expect(m.sourceLevel).toBe(4);
    expect(m.title).toBe('Dân Quân');
    expect(m.hp).toBe(Math.ceil(w.hp[a]!));
    expect(m.maxHp).toBe(Math.round(w.maxHp[a]!));
    expect(m.attacksPerSecond).toBeCloseTo(10 / w.interval[a]!, 9);
    const w2 = worldOf(state);
    spawnWave(w2, 0);
    let foe = -1;
    for (let i = 0; i < w2.count; i++) if (w2.kind[i] === KIND_UNIT && w2.team[i] === TEAM_FOE) foe = i;
    expect(foe).toBeGreaterThanOrEqual(0);
    expect(unitInfoModel(w2, foe, state, CONTENT)!.sourceLevel).toBeNull();
  });

  it('answers null for ids that are not live units', () => {
    const state = militia(2);
    const w = worldOf(state);
    for (const id of [-1, w.count, w.throneId]) expect(unitInfoModel(w, id, state, CONTENT)).toBeNull();
    const a = allyUnit(w);
    w.alive[a] = 0;
    expect(unitInfoModel(w, a, state, CONTENT)).toBeNull();
  });

  it('shows 0 attacks per second, not Infinity, for an interval of 0', () => {
    const state = militia(2);
    const w = worldOf(state);
    const a = allyUnit(w);
    w.interval[a] = 0;
    expect(unitInfoModel(w, a, state, CONTENT)!.attacksPerSecond).toBe(0);
  });
});

describe('unitPreviewModel', () => {
  it('describes a spawned unit from its setup stats', () => {
    const setup = buildBattleSetup(militia(3), CONTENT);
    const stats = setup.structures.find((s) => s.plot === 6)!.spawn!.stats;
    const m = unitPreviewModel(stats, CONTENT.unit('militia'), 3);
    expect([m.hp, m.maxHp, m.sourceLevel]).toEqual([stats.hp, stats.hp, 3]);
    expect(m.armorPct).toBe(Math.round(stats.armor * 100));
    expect(m.damageType.length).toBeGreaterThan(0);
  });

  it('royal archers decree stays out of troop stats', () => {
    const base = unitPreviewModel(
      buildBattleSetup(militia(3), CONTENT).structures[0]!.spawn!.stats,
      CONTENT.unit('militia'),
      3,
    );
    const decreed = unitPreviewModel(
      buildBattleSetup(militia(3, { decrees: ['decree_royal_archers' as DecreeId] }), CONTENT).structures[0]!.spawn!.stats,
      CONTENT.unit('militia'),
      3,
    );
    expect(decreed.range).toBe(base.range);
  });
});
