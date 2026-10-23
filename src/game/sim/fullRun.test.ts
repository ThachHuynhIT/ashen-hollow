import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from '../../core/random';
import { RULES_FULL } from '../../data/rules';
import type { KingId } from '../../data/types';
import type { BattleResult } from '../battle/types';
import { simulateBattle } from '../battle/step';
import { CONTENT } from '../cards/registry';
import { buildBattleSetup } from '../run/battleSetup';
import { applyCommand } from '../run/commands';
import type { RunCommand, RunState } from '../run/state';
import { fullRunFixture } from '../testing/fixtures';
import { scriptedBot } from './bots/scripted';
import { randomBot } from './bots/random';
import { runHeadless } from './headless';

const KINGS: KingId[] = ['wheat', 'stone', 'arcane'];
const SEEDS = [1, 2, 3];

const allFinite = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFinite);
  if (value !== null && typeof value === 'object') return Object.values(value).every(allFinite);
  return true;
};

interface Played {
  state: RunState;
  commands: number;
  capped: number;
  bossFights: number;
}

/** The same loop as runHeadless, keeping what a headless result does not carry (capped units, boss fights). */
const playReal = (seed: number, kingId: KingId): Played => {
  const rng = new Rng(hashSeed(`${seed}:bot`));
  let state = fullRunFixture(seed, kingId);
  let commands = 0;
  let capped = 0;
  let bossFights = 0;
  const apply = (cmd: RunCommand): void => {
    const r = applyCommand(state, cmd, CONTENT);
    if ('error' in r) throw new Error(`illegal ${JSON.stringify(cmd)}: ${r.error}`);
    state = r.state;
    commands += 1;
  };
  while (state.phase !== 'ended') {
    if (commands >= 5000) throw new Error('did not finish');
    const cmd = randomBot(state, CONTENT, rng);
    apply(cmd);
    if (cmd.type === 'startBattle') {
      if (state.army?.attacker === 'boss') bossFights += 1;
      const result = simulateBattle(buildBattleSetup(state, CONTENT), []);
      capped += result.capped;
      apply({ type: 'battleResult', result });
    }
  }
  return { state, commands, capped, bossFights };
};

describe('full_run_real_3x3', () => {
  const rows: string[] = [];

  for (const kingId of KINGS) {
    for (const seed of SEEDS) {
      it(`${kingId} seed ${seed}: a real run ends legally, in time, and again identically`, () => {
        const a = runHeadless({ seed, kingId, rules: RULES_FULL });
        const b = runHeadless({ seed, kingId, rules: RULES_FULL });
        const { state } = a;
        expect(state.phase).toBe('ended');
        expect(typeof state.won).toBe('boolean');
        expect(state.year).toBeLessThanOrEqual(30);
        expect(a.commands).toBeLessThan(5000);
        expect(allFinite(state)).toBe(true);
        expect(state.lives).toBeGreaterThanOrEqual(0);
        // deterministic: state and command count are the same the second time
        expect(JSON.stringify(b.state)).toBe(JSON.stringify(state));
        expect(b.commands).toBe(a.commands);
        // the two loops (headless and the reporting one) agree
        const real = playReal(seed, kingId);
        expect(JSON.stringify(real.state)).toBe(JSON.stringify(state));
        // deck, hand and piles still agree at the end
        expect([...state.hand, ...state.drawPile, ...state.discardPile].sort()).toEqual([...state.deck].sort());
        rows.push(
          `${kingId.padEnd(6)} seed ${seed}  year ${String(state.year).padStart(2)}  ${state.won ? 'won ' : 'lost'}  bosses ${state.stats.bossesDefeated.length}/${real.bossFights} fought  capped ${real.capped}`,
        );
      }, 120_000);
    }
  }

  it('reports the nine runs', () => {
    console.info(`full_run_real_3x3\n${rows.join('\n')}`);
    expect(rows).toHaveLength(9);
  });
});

const win = (over: Partial<BattleResult> = {}): BattleResult => ({
  won: true,
  ticks: 400,
  throneHpLostPct: 0,
  kills: 20,
  killsBySource: {},
  interventionsUsed: 0,
  unitsLost: 0,
  capped: 0,
  inputs: [],
  ...over,
});

describe('orchestration30 (reducer fixture, not evidence of real runs)', () => {
  it('thirty won battles: no year 31, five councils, at most six quests, bosses at 10, 20 and 30', () => {
    let state = fullRunFixture(1, 'wheat');
    const rng = new Rng(1);
    const councils: number[] = [];
    const quests: number[] = [];
    const bossYears: number[] = [];
    let commands = 0;
    const apply = (cmd: RunCommand): void => {
      const r = applyCommand(state, cmd, CONTENT);
      if ('error' in r) throw new Error(`illegal ${JSON.stringify(cmd)} in ${state.phase} year ${state.year}: ${r.error}`);
      state = r.state;
      if (++commands > 4000) throw new Error('did not finish');
    };
    while (state.phase !== 'ended') {
      expect(state.year).toBeLessThanOrEqual(30);
      if (state.phase === 'council' && state.offers?.kind === 'council' && state.offers.selected === null) councils.push(state.year);
      if (state.phase === 'quest') quests.push(state.year);
      const cmd = scriptedBot(state, CONTENT, rng);
      apply(cmd);
      if (cmd.type === 'startBattle') {
        const boss = state.army?.boss;
        if (boss !== undefined) bossYears.push(state.year);
        apply({ type: 'battleResult', result: win({ bossDefeated: boss }) });
      }
    }
    expect(state).toMatchObject({ phase: 'ended', won: true, year: 30 });
    expect(state.stats.completedYears).toBe(30);
    expect(councils).toEqual([5, 10, 15, 20, 25]);
    expect(quests.length).toBeLessThanOrEqual(6);
    expect(quests.every((y) => [3, 7, 12, 17, 22, 27].includes(y))).toBe(true);
    expect(bossYears).toEqual([10, 20, 30]);
    expect(state.stats.bossesDefeated).toEqual(['boss_bog_ogre', 'boss_hornet_queen', 'boss_crownless_king']);
    expect(state.stats.bossesWon).toBe(3);
  });

  it('keeps the default G1 rules and the explicit G2 rules working', () => {
    const g1 = runHeadless({ seed: 1, kingId: 'wheat' });
    expect(g1.state.rules.years).toBe(10);
    expect(g1.state.phase).toBe('ended');
    const g2 = runHeadless({ seed: 1, kingId: 'stone', rules: { years: 15, calendar: 'short', autoStart: false } });
    expect(g2.state.rules.years).toBe(15);
    expect(g2.state.phase).toBe('ended');
  });
});
