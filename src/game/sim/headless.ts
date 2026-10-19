/** Chạy trọn một ván không giao diện (spec §13.3): bot → applyCommand → mô phỏng trận. */
import { Rng, hashSeed } from '../../core/random';
import type { KingId } from '../../data/types';
import { simulateBattle } from '../battle/step';
import { CONTENT } from '../cards/registry';
import type { Content } from '../cards/registry';
import { buildBattleSetup } from '../run/battleSetup';
import { applyCommand } from '../run/commands';
import type { RunCommand, RunState } from '../run/state';
import { newRun } from '../run/yearFlow';
import { randomBot } from './bots/random';
import type { Bot } from './bots/random';

export interface HeadlessOptions {
  seed: number;
  kingId: KingId;
  bot?: Bot;
}

export interface HeadlessResult {
  state: RunState;
  commands: number;
}

const MAX_COMMANDS = 5000;

export function runHeadless(opts: HeadlessOptions, content: Content = CONTENT): HeadlessResult {
  const bot = opts.bot ?? randomBot;
  const rng = new Rng(hashSeed(`${opts.seed}:bot`));
  let state = newRun(opts.seed, opts.kingId, content);
  let commands = 0;

  const apply = (cmd: RunCommand): void => {
    const r = applyCommand(state, cmd, content);
    if ('error' in r) {
      throw new Error(`runHeadless: illegal command ${JSON.stringify(cmd)}: ${r.error}`);
    }
    state = r.state;
    commands += 1;
  };

  while (state.phase !== 'ended') {
    if (commands >= MAX_COMMANDS) throw new Error(`runHeadless: exceeded ${MAX_COMMANDS} commands`);
    const cmd = bot(state, content, rng);
    apply(cmd);
    if (cmd.type === 'startBattle') {
      const result = simulateBattle(buildBattleSetup(state, content), []);
      apply({ type: 'battleResult', result });
    }
  }
  return { state, commands };
}
