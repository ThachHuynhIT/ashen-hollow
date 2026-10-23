import { describe, expect, it } from 'vitest';
import { BATTLE } from '../../data/battle';
import { RUN, battleGold } from '../../data/run';
import type { Rules } from '../../data/rules';
import type { BossId } from '../../data/types';
import { bossWorld, realBoss } from '../battle/bossKit';
import { battleResult, stepBattle } from '../battle/step';
import type { BattleResult } from '../battle/types';
import { CONTENT } from '../cards/registry';
import { attackStats, throneSetup } from '../testing/fixtures';
import { applyCommand } from './commands';
import type { RunState } from './state';
import { newRun } from './yearFlow';

const FULL: Rules = { years: 30, calendar: 'full', autoStart: false };
const BOSSES: [1 | 2 | 3, BossId][] = [
  [1, 'boss_bog_ogre'],
  [2, 'boss_hornet_queen'],
  [3, 'boss_crownless_king'],
];

const result = (won: boolean, over: Partial<BattleResult> = {}): BattleResult => ({
  won,
  ticks: 500,
  throneHpLostPct: 10,
  kills: 20,
  killsBySource: {},
  interventionsUsed: 0,
  unitsLost: 0,
  capped: 0,
  inputs: [],
  ...over,
});

/** A battle of boss `ordinal` (year 10, 20, 30) about to end. */
const bossFight = (ordinal: 1 | 2 | 3, over: Partial<RunState> = {}): RunState => {
  const year = ordinal * 10;
  const id = BOSSES[ordinal - 1]![1];
  return {
    ...newRun(5, 'wheat', CONTENT, FULL),
    year,
    phase: 'battle',
    played: true,
    gold: 3,
    army: { attacker: 'boss', boss: id, bossOrdinal: ordinal, budget: 10, level: 1, statMult: 1, waves: [] },
    ...over,
  };
};
const run = (s: RunState, r: BattleResult): RunState => {
  const out = applyCommand(s, { type: 'battleResult', result: r }, CONTENT);
  if ('error' in out) throw new Error(out.error);
  return out.state;
};

describe('the boss prize', () => {
  it.each([
    [1, 12],
    [2, 18],
    [3, 24],
  ] as const)('winning boss %i pays the doubled battle gold: %i', (ordinal, prize) => {
    expect(battleGold(ordinal * 10) * RUN.bossGoldMult).toBe(prize);
    const s = bossFight(ordinal);
    const next = run(s, result(true));
    expect(next.gold).toBe(s.gold + prize);
    expect(next.stats.goldEarned).toBe(s.stats.goldEarned + prize);
  });

  it('an ordinary year still pays the single prize and a lost boss battle pays nothing', () => {
    const ordinary = { ...bossFight(1), year: 9, army: { ...bossFight(1).army!, attacker: 'raiders' as const, boss: undefined, bossOrdinal: undefined } };
    expect(run(ordinary, result(true)).gold).toBe(3 + battleGold(9));
    expect(run(bossFight(1, { lives: 3 }), result(false)).gold).toBe(3);
  });

  it('goldDelta is taken first and gold never goes below 0 before the prize is added', () => {
    const next = run(bossFight(1, { gold: 2 }), { ...result(true), goldDelta: -9 });
    expect(next.gold).toBe(0 + 12);
  });
});

describe('throne_promotion', () => {
  it.each([
    [1, 1, 2],
    [1, 4, 5],
    [1, 5, 5],
    [2, 2, 3],
    [2, 5, 5],
  ] as const)('winning boss %i with the Ngai at level %i leaves it at %i, also on the board', (ordinal, from, to) => {
    const s = bossFight(ordinal, { throneLevel: from });
    s.plots[12]!.building!.level = from;
    const next = run(s, result(true));
    expect(next.throneLevel).toBe(to);
    expect(next.plots[12]!.building!.level).toBe(to);
  });

  it('a lost battle, boss 3 and an ordinary year give no level', () => {
    expect(run(bossFight(1, { throneLevel: 2 }), result(false)).throneLevel).toBe(2);
    expect(run(bossFight(3, { throneLevel: 2 }), result(true)).throneLevel).toBe(2);
    const ordinary = bossFight(1, { year: 9, throneLevel: 2 });
    ordinary.army = { ...ordinary.army!, attacker: 'raiders', boss: undefined, bossOrdinal: undefined };
    expect(run(ordinary, result(true)).throneLevel).toBe(2);
  });
});

describe('boss statistics: only a boss that really died counts', () => {
  it('records bossesWon and bossesDefeated once for a kill', () => {
    const next = run(bossFight(1), result(true, { bossDefeated: 'boss_bog_ogre' }));
    expect(next.stats.bossesWon).toBe(1);
    expect(next.stats.bossesDefeated).toEqual(['boss_bog_ogre']);
    const again = run({ ...next, phase: 'battle', year: 20 }, result(true, { bossDefeated: 'boss_bog_ogre' }));
    expect(again.stats.bossesDefeated).toEqual(['boss_bog_ogre']); // never listed twice
  });

  it('surviving until the time limit wins the battle but is not a boss win', () => {
    const next = run(bossFight(3), result(true));
    expect(next.stats.bossesWon).toBe(0);
    expect(next.stats.bossesDefeated).toEqual([]);
    expect(next.stats.battlesWon).toBe(1);
  });

  it('a kill on the very tick the Ngai falls is still recorded, while the battle is lost', () => {
    const next = run(bossFight(1, { lives: 3 }), result(false, { bossDefeated: 'boss_bog_ogre' }));
    expect(next.stats.bossesDefeated).toEqual(['boss_bog_ogre']);
    expect(next.lives).toBe(2);
  });

  it('completedYears counts the battle exactly once', () => {
    const s = bossFight(1);
    expect(run(s, result(true, { bossDefeated: 'boss_bog_ogre' })).stats.completedYears).toBe(s.stats.completedYears + 1);
  });

  it('a second result in the same state is refused', () => {
    const next = run(bossFight(1), result(true));
    expect(applyCommand(next, { type: 'battleResult', result: result(true) }, CONTENT)).toEqual({ error: 'wrongPhase' });
  });
});

describe('the run after a boss', () => {
  it('year 30 with lives left ends the run as a win, with the golden crown only if boss 3 died', () => {
    const killed = run(bossFight(3), result(true, { bossDefeated: 'boss_crownless_king' }));
    expect(killed).toMatchObject({ phase: 'ended', won: true, year: 30 });
    expect(killed.stats.bossesDefeated).toContain('boss_crownless_king');
    const survived = run(bossFight(3), result(true));
    expect(survived).toMatchObject({ phase: 'ended', won: true, year: 30 });
    expect(survived.stats.bossesDefeated).not.toContain('boss_crownless_king');
  });

  it('losing the last life at a boss ends the run at once, with no reward to rescue it', () => {
    const next = run(bossFight(1, { lives: 1 }), result(false));
    expect(next).toMatchObject({ phase: 'ended', won: false });
    expect(next.offers).toBeNull();
  });

  it('a boss win in year 10 still opens the council that follows (year 10 is a council year)', () => {
    const next = run(bossFight(1), result(true, { bossDefeated: 'boss_bog_ogre' }));
    expect(next.offers?.kind).toBe('reward');
    expect(next.pendingOffers.map((o) => o.kind)).toEqual(['council']);
  });
});

describe('timeout_vs_kill (battle level)', () => {
  const quietBoss = () => {
    const boss = realBoss(1);
    return {
      ...boss,
      stats: { ...boss.stats, speed: 0, dmg: 0, interval: 0 },
    };
  };

  it('at the 900-tick limit with the Ngai alive and the boss alive the battle is won with no boss kill', () => {
    const w = bossWorld(1, [], { x: 40, y: 40 }, quietBoss(), { throne: throneSetup({ attack: null, hp: 5000 }) });
    for (let i = 0; i < 905 && !w.ended; i++) stepBattle(w, []);
    expect(w.ended).toBe(true);
    const r = battleResult(w)!;
    expect(r.won).toBe(true);
    expect(r.bossDefeated).toBeUndefined();
  });

  it('killing the boss reports bossDefeated', () => {
    const weak = { ...quietBoss(), stats: { ...quietBoss().stats, hp: 1 } };
    const w = bossWorld(1, [], { x: 150, y: 192 }, weak, { throne: throneSetup({ attack: attackStats({ dmg: 50, range: 72, interval: 5 }) }) });
    for (let i = 0; i < 300 && !w.ended; i++) stepBattle(w, []);
    const r = battleResult(w)!;
    expect(r).toMatchObject({ won: true, bossDefeated: 'boss_bog_ogre' });
  });

  it('the boss dying on the tick the Ngai falls is a loss that still names the dead boss', () => {
    const w = bossWorld(1, [], { x: 150, y: 192 }, quietBoss(), { throne: throneSetup({ attack: null }) });
    w.hp[w.bossId] = 0;
    w.hp[w.throneId] = 0;
    stepBattle(w, []);
    const r = battleResult(w)!;
    expect(r.won).toBe(false);
    expect(r.bossDefeated).toBe('boss_bog_ogre');
  });

  it('the cap constants add up for the biggest battle', () => {
    expect(BATTLE.playerUnitCap + 120 + 25 + 1 + BATTLE.bossSummonCap).toBeLessThanOrEqual(BATTLE.entityCap);
  });
});
