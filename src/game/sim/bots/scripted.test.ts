import { describe, expect, it } from 'vitest';
import { Rng } from '../../../core/random';
import { RULES_FULL } from '../../../data/rules';
import type { KingId } from '../../../data/types';
import { simulateBattle } from '../../battle/step';
import { CONTENT } from '../../cards/registry';
import { buildBattleSetup } from '../../run/battleSetup';
import { applyCommand } from '../../run/commands';
import type { RunCommand, RunState } from '../../run/state';
import { newRun } from '../../run/yearFlow';
import { scriptedBot } from './scripted';

interface Trace {
  state: RunState;
  commands: RunCommand[];
  /** Years in which a battle was fought, in order. */
  fought: number[];
}

/** Plays a whole run with the scripted bot; every intent goes through applyCommand and is checked. */
const play = (seed: number, kingId: KingId): Trace => {
  const rng = new Rng(seed);
  let state = newRun(seed, kingId, CONTENT, RULES_FULL);
  const commands: RunCommand[] = [];
  const fought: number[] = [];
  const apply = (cmd: RunCommand): void => {
    const before = JSON.stringify(state);
    const r = applyCommand(state, cmd, CONTENT);
    if ('error' in r) throw new Error(`illegal ${JSON.stringify(cmd)} in ${state.phase} year ${state.year}: ${r.error}`);
    expect(JSON.stringify(state), 'applyCommand must not change its input').toBe(before);
    state = r.state;
    commands.push(cmd);
  };
  while (state.phase !== 'ended') {
    if (commands.length > 5000) throw new Error('scripted run did not finish');
    const snapshot = JSON.stringify(state);
    const cmd = scriptedBot(state, CONTENT, rng);
    expect(JSON.stringify(state), 'the bot must not change the state it reads').toBe(snapshot);
    apply(cmd);
    if (cmd.type === 'startBattle') {
      fought.push(state.year);
      apply({ type: 'battleResult', result: simulateBattle(buildBattleSetup(state, CONTENT), []) });
    }
  }
  return { state, commands, fought };
};

describe('scripted_legal_commands', () => {
  it('every command of a stone run is legal and leaves its input untouched', () => {
    const { state, commands } = play(1, 'stone');
    expect(state.phase).toBe('ended');
    expect(commands.length).toBeGreaterThan(10);
  }, 120_000);

  it('the same seed gives the same command trace and the same end state', () => {
    const a = play(2, 'wheat');
    const b = play(2, 'wheat');
    expect(JSON.stringify(a.commands)).toBe(JSON.stringify(b.commands));
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  }, 120_000);

  it('turns Tự bắn on once, never rerolls and never buys a plot', () => {
    const { commands } = play(1, 'stone');
    expect(commands.filter((c) => c.type === 'setAutoFire')).toHaveLength(1);
    expect(commands.some((c) => c.type === 'reroll' || c.type === 'unlockPlot')).toBe(false);
  }, 120_000);
});

describe('scripted bot on stone, seed 1 (diagnostic for the year-10 boss)', () => {
  it('reports how far the run got and whether boss 1 was fought', () => {
    const { state, fought } = play(1, 'stone');
    const reachedBoss1 = fought.includes(10);
    // Reported in the PR; not a gate: an early legal defeat is a valid outcome.
    console.info(
      `scripted stone seed 1: year ${state.year}, won ${String(state.won)}, boss 1 fought: ${String(reachedBoss1)}, bosses defeated: ${state.stats.bossesDefeated.length}`,
    );
    expect(state.year).toBeGreaterThanOrEqual(1);
    expect(state.year).toBeLessThanOrEqual(30);
  }, 120_000);
});
