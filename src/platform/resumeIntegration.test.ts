/**
 * Reload matrix (spec §9.3, G3d D6): every kind of state a run can stop in is written through the
 * real coordinator to a fake IndexedDB, read back by a brand-new session and driven by a brand-new
 * controller with the same future inputs; the result must be what the uninterrupted run gives.
 * IndexedDB here is `fake-indexeddb`; the real browser path is checked by hand (see the PR).
 * It lives in src/platform because it needs the session composition, which src/game must not import.
 */
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { Rng } from '../core/random';
import { INCOMPATIBLE_RUN_TEXT } from '../data/save';
import type { CardId, KingId } from '../data/types';
import { createSession } from './session';
import { simulateBattle } from '../game/battle/step';
import { CONTENT } from '../game/cards/registry';
import { createGameBus } from '../game/events';
import { buildBattleSetup } from '../game/run/battleSetup';
import { applyCommand } from '../game/run/commands';
import { RunController } from '../game/run/RunController';
import type { RunCommand, RunState } from '../game/run/state';
import { randomBot } from '../game/sim/bots/random';
import { scriptedBot } from '../game/sim/bots/scripted';
import { contentWith, fakeKing, fullRunFixture, unitStats } from '../game/testing/fixtures';
import { contentHash, decodeRun, encodeRun } from '../game/save/codec';

interface Sample {
  label: string;
  state: RunState;
  /** The command the player sends next from this state. */
  next: RunCommand;
}

const LABELS = [
  'planning before play',
  'planning after play',
  'planning after reroll',
  'battle entry',
  'reward',
  'conquest',
  'council open',
  'council selected',
  'council with a sub-selection',
  'quest',
  'questReward',
  'yearEnd',
];

/** Plays bots over several seeds and keeps the first state of every kind we want to reload. */
const collect = (): Sample[] => {
  const wanted = new Map<string, Sample>();
  const keep = (label: string, state: RunState, next: RunCommand): void => {
    if (!wanted.has(label)) wanted.set(label, { label, state, next });
  };
  const classify = (s: RunState, next: RunCommand): string | null => {
    switch (s.phase) {
      case 'planning':
        if (s.year === 1 && !s.played && s.rerollsThisYear === 0 && next.type !== 'startBattle') return 'planning before play';
        if (s.played) return 'planning after play';
        if (s.rerollsThisYear > 0) return 'planning after reroll';
        return null;
      case 'battle':
        return 'battle entry';
      case 'reward':
        return s.offers?.kind === 'questReward' ? 'questReward' : 'reward';
      case 'conquest':
        return 'conquest';
      case 'council':
        if (s.offers?.kind !== 'council') return null;
        if (s.offers.selected === null) return 'council open';
        if (s.offers.selection.plots.length + s.offers.selection.deckIndices.length > 0 || s.offers.selection.cardId !== null) {
          return 'council with a sub-selection';
        }
        return 'council selected';
      case 'quest':
        return 'quest';
      case 'yearEnd':
        return 'yearEnd';
      default:
        return null;
    }
  };
  const complete = (): boolean => LABELS.every((label) => wanted.has(label));
  for (const kingId of ['wheat', 'stone', 'arcane'] as KingId[]) {
    for (let seed = 1; seed <= 12 && !complete(); seed++) {
      for (const [name, bot] of [['random', randomBot], ['scripted', scriptedBot]] as const) {
        if (complete()) break;
        const rng = new Rng(seed * 31 + name.length);
        let state = fullRunFixture(seed, kingId);
        for (let i = 0; i < 3000 && state.phase !== 'ended' && !complete(); i++) {
          const next = bot(state, CONTENT, rng);
          const label = classify(state, next);
          if (label !== null) keep(label, state, next);
          const r = applyCommand(state, next, CONTENT);
          if ('error' in r) throw new Error(`${name} illegal ${JSON.stringify(next)}: ${r.error}`);
          state = r.state;
          if (next.type === 'startBattle') {
            keep('battle entry', state, { type: 'battleResult', result: simulateBattle(buildBattleSetup(state, CONTENT), []) });
            const done = applyCommand(state, { type: 'battleResult', result: simulateBattle(buildBattleSetup(state, CONTENT), []) }, CONTENT);
            if ('error' in done) throw new Error(done.error);
            state = done.state;
          }
        }
      }
    }
  }
  return [...wanted.values()];
};

const SAMPLES = collect();
const reload = async (disk: IDBFactory) => createSession(disk, () => undefined, CONTENT);

describe('resume_matrix', () => {
  it('found every kind of state to reload', () => {
    const found = SAMPLES.map((s) => s.label);
    for (const label of LABELS) expect(found, label).toContain(label);
  });

  for (const label of LABELS) {
    it(`${label}: write → new session → same state, same next state`, async () => {
      const sample = SAMPLES.find((s) => s.label === label);
      if (!sample) throw new Error(`no sample for ${label}`);
      const disk = new IDBFactory();
      const first = await reload(disk);
      await first.persistence.checkpoint(sample.state);

      const second = await reload(disk); // a reload: nothing survives but the disk
      const loaded = await second.load();
      expect(loaded.kind).toBe('ok');
      if (loaded.kind !== 'ok') return;
      expect(loaded.state).toEqual(sample.state);

      if (label === 'battle entry') {
        // A loaded battle restarts at tick 0 with the setup of the entry; the result is the same fight.
        const bus = createGameBus();
        const controller = new RunController(bus, CONTENT, loaded.state, second.persistence);
        const setups: unknown[] = [];
        bus.on('battle:started', ({ setup }) => setups.push(setup));
        controller.kickoff();
        await controller.whenIdle();
        expect(setups).toEqual([buildBattleSetup(sample.state, CONTENT)]);
        expect(controller.runner!.world.tick).toBe(0);
        const direct = simulateBattle(buildBattleSetup(sample.state, CONTENT), []);
        let result: { won: boolean; ticks: number; kills: number } | null = null;
        bus.on('battle:ended', ({ result: r }) => (result = r));
        for (let i = 0; i < 3000 && result === null; i++) controller.update(1000);
        await controller.whenIdle();
        expect(result).toMatchObject({ won: direct.won, ticks: direct.ticks, kills: direct.kills });
        return;
      }

      const bus = createGameBus();
      const controller = new RunController(bus, CONTENT, loaded.state, second.persistence);
      bus.emit('ui:command', { command: sample.next });
      await controller.whenIdle();
      const expected = applyCommand(sample.state, sample.next, CONTENT);
      if ('error' in expected) throw new Error(expected.error);
      expect(controller.state).toEqual(expected.state);
      // The step after the reload was written too, and reads back as the same state.
      const third = await reload(disk);
      const after = await third.load();
      expect(after).toEqual({ kind: 'ok', state: expected.state });
    }, 60_000);
  }

  it('ten reloads of a reward and of a council change nothing: no tax, draw or second reward', async () => {
    for (const label of ['reward', 'council with a sub-selection', 'quest']) {
      const sample = SAMPLES.find((s) => s.label === label)!;
      const disk = new IDBFactory();
      await (await reload(disk)).persistence.checkpoint(sample.state);
      let current = sample.state;
      for (let i = 0; i < 10; i++) {
        const session = await reload(disk);
        const loaded = await session.load();
        expect(loaded.kind).toBe('ok');
        if (loaded.kind !== 'ok') return;
        const bus = createGameBus();
        const controller = new RunController(bus, CONTENT, loaded.state, session.persistence);
        controller.kickoff(); // opening the scene again: no command, no write
        await controller.whenIdle();
        current = controller.state;
        expect(current, `${label} reload ${i + 1}`).toEqual(sample.state);
      }
      expect(current.gold).toBe(sample.state.gold);
      expect(current.hand).toEqual(sample.state.hand);
    }
  });

  it('an ended run clears the saved run after the pending write, and the profile stays', async () => {
    const disk = new IDBFactory();
    const session = await reload(disk);
    await session.store.saveMeta({ crowns: 3 });
    const sample = SAMPLES.find((s) => s.label === 'planning before play')!;
    const writes = session.persistence.checkpoint(sample.state);
    const clear = session.persistence.checkpoint({ ...sample.state, phase: 'ended', won: false, offers: null });
    await Promise.all([writes, clear]);
    const again = await reload(disk);
    expect(await again.load()).toEqual({ kind: 'empty' });
    expect(await again.store.loadMeta()).toEqual({ crowns: 3 });
  });

  it('a content set with extra ids still loads; one missing a used card is refused and cleared', async () => {
    const sample = SAMPLES.find((s) => s.label === 'reward')!;
    const disk = new IDBFactory();
    await (await reload(disk)).persistence.checkpoint(sample.state);

    const more = contentWith({ kings: [fakeKing('grove')], units: [unitStats({ unit: 'extra' })] as never });
    expect(contentHash(more)).not.toBe(contentHash(CONTENT));
    const stored = (await (await reload(disk)).store.loadRun()) as ReturnType<typeof encodeRun>;
    expect(decodeRun(stored, CONTENT).kind).toBe('ok');
    // a loader whose registry lacks a card the deck uses must refuse the run
    const gone = sample.state.deck[0]!;
    const swap = (cards: readonly CardId[]): CardId[] => cards.map((c) => (c === gone ? ('wheat_removed' as CardId) : c));
    const broken: RunState = {
      ...sample.state,
      deck: swap(sample.state.deck),
      hand: swap(sample.state.hand),
      drawPile: swap(sample.state.drawPile),
      discardPile: swap(sample.state.discardPile),
    };
    // the piles agree with the deck, so only the id that no registry knows any more is wrong
    expect(decodeRun(encodeRun(broken, CONTENT), CONTENT)).toEqual({ kind: 'incompatible', message: INCOMPATIBLE_RUN_TEXT });
  });
});
