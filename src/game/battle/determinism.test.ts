/** Deterministic (spec §13.2): băm từng tick, đổi lệnh can thiệp, đổi thứ tự công trình. */
import { describe, expect, it } from 'vitest';
import { BATTLE } from '../../data/battle';
import { attackStats, battleSetup, structure, unitStats } from '../testing/fixtures';
import { hashWorld } from './hash';
import { battleResult, simulateBattle, stepBattle } from './step';
import type { BattleInput, BattleSetup, Edge, StructureSetup, UnitStats } from './types';
import { createBattle, drainEvents, type BattleWorld } from './world';

const militia = unitStats({ unit: 'militia', hp: 32, dmg: 5, speed: 1 });
const bandit = unitStats({ unit: 'bandit', hp: 30, dmg: 5, speed: 0.9 });
/** Kỵ nhanh để đợt đầu đã tới vùng tảng đá (192, 100) ở tick 36. */
const boar = unitStats({ unit: 'boar_rider', hp: 50, dmg: 8, speed: 3, radius: 5, armor: 0.1 });

const troop = (plot: number): StructureSetup =>
  structure(plot, { cardId: 'wheat_militia', spawn: { stats: militia, count: 5 } });
const tower = (plot: number): StructureSetup =>
  structure(plot, {
    cardId: 'neutral_archer_tower',
    kind: 'tower',
    attack: attackStats({ dmg: 7, range: 88, interval: 12, projectileSpeed: 8 }),
    targeting: 'closestToThrone',
  });

/** 30 địch, chia đều hai mép, xen kẽ thổ phỉ và kỵ lợn. */
const wave = (spawnTick: number, a: Edge, b: Edge) => ({
  spawnTick,
  spawns: Array.from({ length: 30 }, (_, i) => ({
    stats: (i % 3 === 0 ? boar : bandit) as UnitStats,
    edge: i % 2 === 0 ? a : b,
  })),
});

const STRUCTURES: readonly StructureSetup[] = [
  troop(6),
  troop(7),
  troop(8),
  troop(16),
  troop(17),
  troop(18),
  tower(2),
  tower(10),
  tower(14),
];

const SETUP: BattleSetup = battleSetup({
  year: 3,
  structures: STRUCTURES,
  waves: [wave(0, 'N', 'E'), wave(120, 'S', 'W')],
});

const INPUTS: readonly BattleInput[] = [{ tick: 30, x: 192, y: 100 }];

const step = (w: BattleWorld, inputs: readonly BattleInput[]): void => {
  const tick = w.tick;
  stepBattle(
    w,
    inputs.filter((i) => i.tick === tick),
  );
  drainEvents(w);
};

/** Chạy tới khi có kết quả; trả băm cuối. */
const finalHash = (setup: BattleSetup, inputs: readonly BattleInput[]): number => {
  const w = createBattle(setup);
  for (let i = 0; i <= BATTLE.hardLimitTick && battleResult(w) === null; i++) step(w, inputs);
  expect(battleResult(w)).not.toBeNull();
  return hashWorld(w);
};

describe('battle determinism', () => {
  it('two worlds with the same setup and inputs hash equal at every tick', () => {
    const a = createBattle(SETUP);
    const b = createBattle(SETUP);
    expect(hashWorld(a)).toBe(hashWorld(b));
    let ticks = 0;
    let knocked = 0;
    while (battleResult(a) === null) {
      step(a, INPUTS);
      step(b, INPUTS);
      ticks += 1;
      if (a.tick - 1 === INPUTS[0]!.tick + 6) {
        // tảng đá thực sự trúng địch (đẩy lùi vừa bắt đầu)
        for (let i = 0; i < a.count; i++) if (a.kbTicks[i] === BATTLE.knockbackTicks - 1) knocked++;
      }
      expect(hashWorld(a), `tick ${a.tick - 1}`).toBe(hashWorld(b));
      expect(ticks).toBeLessThanOrEqual(BATTLE.hardLimitTick + 1);
    }
    expect(knocked).toBeGreaterThan(0);
    expect(battleResult(b)).toEqual(battleResult(a));
    expect(battleResult(a)!.interventionsUsed).toBe(1);
    expect(battleResult(a)!.inputs).toEqual(INPUTS);
  });

  it('a different intervention point changes the final hash', () => {
    const moved: BattleInput[] = [{ ...INPUTS[0]!, x: 100 }];
    expect(finalHash(SETUP, moved)).not.toBe(finalHash(SETUP, INPUTS));
  });

  it('does not depend on the order of structures in the setup', () => {
    const reversed: BattleSetup = { ...SETUP, structures: [...STRUCTURES].reverse() };
    expect(finalHash(reversed, INPUTS)).toBe(finalHash(SETUP, INPUTS));
    expect(simulateBattle(reversed, INPUTS)).toEqual(simulateBattle(SETUP, INPUTS));
  });
});
