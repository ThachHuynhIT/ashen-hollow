import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/random';
import { INCOMPATIBLE_RUN_TEXT, SAVE_FORMAT_VERSION } from '../../data/save';
import { RULES_FULL } from '../../data/rules';
import type { CardId, KingId } from '../../data/types';
import { buildBattleSetup } from '../run/battleSetup';
import { applyCommand } from '../run/commands';
import type { RunCommand, RunState } from '../run/state';
import { newRun } from '../run/yearFlow';
import { simulateBattle } from '../battle/step';
import { CONTENT } from '../cards/registry';
import { randomBot } from '../sim/bots/random';
import { contentWith, fakeKing, runState, unitStats } from '../testing/fixtures';
import { contentHash, decodeRun, encodeRun } from './codec';
import { MemorySaveStore } from './MemorySaveStore';

/** Every state a bot-played full run passes through, in order (the state after each command). */
const trail = (seed: number, king: KingId): RunState[] => {
  const rng = new Rng(seed * 7919);
  let state = newRun(seed, king, CONTENT, RULES_FULL);
  const out: RunState[] = [state];
  for (let i = 0; i < 2500 && state.phase !== 'ended'; i++) {
    const cmd: RunCommand = randomBot(state, CONTENT, rng);
    const r = applyCommand(state, cmd, CONTENT);
    if ('error' in r) throw new Error(`${cmd.type}: ${r.error}`);
    state = r.state;
    out.push(state);
    if (cmd.type === 'startBattle') {
      const result = simulateBattle(buildBattleSetup(state, CONTENT), []);
      const done = applyCommand(state, { type: 'battleResult', result }, CONTENT);
      if ('error' in done) throw new Error(done.error);
      state = done.state;
      out.push(state);
    }
  }
  return out;
};

const wire = (state: RunState): unknown => JSON.parse(JSON.stringify(encodeRun(state, CONTENT)));
const ok = (raw: unknown): RunState => {
  const r = decodeRun(raw, CONTENT);
  if (r.kind !== 'ok') throw new Error(`expected ok, got ${r.kind}`);
  return r.state;
};
const incompatible = (raw: unknown): boolean => decodeRun(raw, CONTENT).kind === 'incompatible';
const env = (state: RunState): { formatVersion: 1; version: number; contentHash: number; state: RunState } =>
  structuredClone(encodeRun(state, CONTENT));

describe('roundtrip', () => {
  const runs = [trail(1, 'wheat'), trail(2, 'stone'), trail(3, 'arcane')];
  const states = runs.flat();

  it('keeps every state of three full runs exactly, through JSON', () => {
    expect(states.length).toBeGreaterThan(100);
    for (const s of states) expect(ok(wire(s))).toEqual(s);
  });

  it('covers planning, battle, reward, council, quest, yearEnd and ended', () => {
    const phases = new Set(states.map((s) => s.phase));
    for (const p of ['planning', 'battle', 'reward', 'council', 'quest', 'yearEnd', 'ended'] as const) {
      expect(phases.has(p), p).toBe(true);
    }
  });

  it('keeps an open council with a half-made selection, and the queue behind an offer', () => {
    const council = states.find((s) => s.offers?.kind === 'council')!;
    const picked = {
      ...council,
      offers: {
        ...(council.offers as Extract<RunState['offers'], { kind: 'council' }>),
        selected: (council.offers as Extract<RunState['offers'], { kind: 'council' }>).decreeIds[0]!,
        selection: { plots: [1, 0], cardId: null, deckIndices: [2] },
      },
    } as RunState;
    expect(ok(wire(picked))).toEqual(picked);
    const queued = states.find((s) => s.pendingOffers.length > 0);
    if (queued) expect(ok(wire(queued)).pendingOffers).toEqual(queued.pendingOffers);
  });

  it('a conquest phase survives too', () => {
    const base = runState();
    const conquest: RunState = {
      ...base,
      phase: 'conquest',
      offers: { kind: 'conquest', cardIds: ['neutral_move' as CardId, 'neutral_well' as CardId], king: 'stone' },
    };
    expect(ok(wire(conquest))).toEqual(conquest);
  });

  it('encoding copies: later changes to the state do not reach the envelope', () => {
    const s = runState();
    const e = encodeRun(s, CONTENT);
    s.gold += 100;
    s.hand.push('neutral_move' as CardId);
    expect(e.state.gold).not.toBe(s.gold);
    expect(e.state.hand).not.toContain('neutral_move');
    expect(e).toMatchObject({ formatVersion: SAVE_FORMAT_VERSION, version: 4 });
  });

  it('decoding copies: changes to the result do not reach the raw data', () => {
    const raw = wire(runState());
    const first = ok(raw);
    first.gold = 999;
    expect(ok(raw).gold).not.toBe(999);
  });
});

describe('empty and unusable data', () => {
  it('null and undefined mean there is no saved run', () => {
    expect(decodeRun(null, CONTENT)).toEqual({ kind: 'empty' });
    expect(decodeRun(undefined, CONTENT)).toEqual({ kind: 'empty' });
  });

  it.each([['a string', 'oops'], ['a number', 7], ['an array', []], ['broken JSON text', '{"a":']])(
    '%s is incompatible with the Vietnamese notice',
    (_n, raw) => {
      expect(decodeRun(raw, CONTENT)).toEqual({ kind: 'incompatible', message: INCOMPATIBLE_RUN_TEXT });
    },
  );

  it('unknown_versions: state 1, 2, a future 5, an unknown format and a version that disagrees', () => {
    const e = env(runState());
    for (const version of [1, 2, 5, 99]) {
      expect(incompatible({ ...e, version, state: { ...e.state, version } }), `state ${version}`).toBe(true);
    }
    expect(incompatible({ ...e, formatVersion: 2 })).toBe(true);
    expect(incompatible({ ...e, version: 3 })).toBe(true); // envelope says 3 but the state is 4
  });
});

describe('content hash', () => {
  it('is stable and changes when an id is added', () => {
    expect(contentHash(CONTENT)).toBe(contentHash(CONTENT));
    const more = contentWith({ kings: [fakeKing('grove')], units: [unitStats({ unit: 'extra' })] as never });
    expect(contentHash(more)).not.toBe(contentHash(CONTENT));
  });

  it('a different hash is accepted when every reference still resolves (added ids)', () => {
    const e = env(runState());
    expect(ok({ ...e, contentHash: 123 })).toEqual(e.state);
  });

  it('a matching hash does not skip validation', () => {
    const e = env(runState());
    e.state.deck[0] = 'wheat_ghost' as CardId;
    expect(e.contentHash).toBe(contentHash(CONTENT));
    expect(incompatible(e)).toBe(true);
  });
});

describe('references to ids that no longer exist', () => {
  const bad = (mutate: (s: RunState) => void): boolean => {
    const e = env(runState());
    mutate(e.state);
    return incompatible(e);
  };
  const GHOST = 'wheat_ghost' as CardId;

  it.each([
    ['deck', (s: RunState) => void (s.deck[0] = GHOST)],
    ['hand', (s: RunState) => void (s.hand[0] = GHOST)],
    ['draw pile', (s: RunState) => void s.drawPile.push(GHOST)],
    ['discard pile', (s: RunState) => void s.discardPile.push(GHOST)],
    ['a building', (s: RunState) => void (s.plots[12]!.building!.cardId = GHOST)],
    ['an enchantment', (s: RunState) => void s.plots[12]!.building!.enchants.push({ cardId: GHOST, stacks: 1 })],
    ['an offer', (s: RunState) => void (s.offers = { kind: 'reward', cardIds: [GHOST] }, s.phase = 'reward')],
    ['the queue', (s: RunState) => void s.pendingOffers.push({ kind: 'reward', cardIds: [GHOST] })],
    ['a council decree', (s: RunState) => void (s.offers = { kind: 'council', decreeIds: ['decree_ghost' as never], selected: null, selection: { plots: [], cardId: null, deckIndices: [] } }, s.phase = 'council')],
    ['a council selection card', (s: RunState) => void (s.offers = { kind: 'council', decreeIds: ['decree_moat'], selected: 'decree_moat', selection: { plots: [], cardId: GHOST, deckIndices: [] } }, s.phase = 'council')],
    ['an owned decree', (s: RunState) => void s.decrees.push('decree_ghost' as never)],
    ['a quest', (s: RunState) => void s.quests.push({ id: 'quest_ghost' as never, offeredYear: 1, deadlineYear: 2, status: 'active', progress: {} })],
    ['an offered quest id', (s: RunState) => void s.offeredQuestIds.push('quest_ghost' as never)],
    ['a quest offer', (s: RunState) => void (s.offers = { kind: 'quest', questId: 'quest_ghost' as never }, s.phase = 'quest')],
    ['an enemy king', (s: RunState) => void s.enemyKings.push('ghost' as KingId)],
    ['the player king', (s: RunState) => void (s.kingId = 'ghost' as KingId)],
    ['an army unit', (s: RunState) => void (s.army!.waves[0]!.units as { unit: string; edge: string }[]).push({ unit: 'ghost', edge: 'N' })],
    ['an army boss', (s: RunState) => void (s.army = { ...s.army!, boss: 'boss_ghost' as never })],
    ['a defeated boss', (s: RunState) => void s.stats.bossesDefeated.push('boss_ghost' as never)],
  ])('rejects a missing id in %s (the whole run, not just the deck)', (_name, mutate) => {
    expect(bad(mutate)).toBe(true);
  });
});

describe('structure checks', () => {
  const bad = (mutate: (s: RunState) => void): boolean => {
    const e = env(runState());
    mutate(e.state);
    return incompatible(e);
  };

  it.each([
    ['24 plots', (s: RunState) => void s.plots.pop()],
    ['an empty throne plot', (s: RunState) => void (s.plots[12]!.building = null)],
    ['a duplicate uid', (s: RunState) => void (s.plots[6] = { unlocked: true, building: { ...structuredClone(s.plots[12]!.building!), level: 1 } })],
    ['nextUid not above the uids', (s: RunState) => void (s.nextUid = 0)],
    ['level 0', (s: RunState) => void (s.plots[12]!.building!.level = 0 as never)],
    ['level 6', (s: RunState) => void (s.plots[12]!.building!.level = 6 as never)],
    ['a throne level that disagrees with its building', (s: RunState) => void (s.throneLevel = 3)],
    ['0 stacks', (s: RunState) => void s.plots[12]!.building!.enchants.push({ cardId: 'neutral_sharpen' as CardId, stacks: 0 })],
    ['5 stacks', (s: RunState) => void s.plots[12]!.building!.enchants.push({ cardId: 'neutral_sharpen' as CardId, stacks: 5 })],
    ['negative gold', (s: RunState) => void (s.gold = -1)],
    ['fractional gold', (s: RunState) => void (s.gold = 1.5)],
    ['NaN gold', (s: RunState) => void (s.gold = Number.NaN)],
    ['year 31', (s: RunState) => void (s.year = 31)],
    ['year past the rules', (s: RunState) => void (s.year = s.rules.years + 1)],
    ['an unknown phase', (s: RunState) => void (s.phase = 'weird' as never)],
    ['5 lives', (s: RunState) => void (s.lives = 5)],
    ['a card missing from the piles', (s: RunState) => void s.hand.pop()],
    ['a card in the piles that is not in the deck', (s: RunState) => void s.deck.pop()],
    ['an rng outside uint32', (s: RunState) => void (s.rng.draw = -1)],
    ['a fractional rng', (s: RunState) => void (s.rng.quest = 1.5)],
    ['3 active quests', (s: RunState) => void s.quests.push(...(['quest_blitz', 'quest_hoard', 'quest_wager'] as const).map((id) => ({ id, offeredYear: 1, deadlineYear: 3, status: 'active' as const, progress: {} })))],
    ['4 attacks', (s: RunState) => void (s.enemies = { stone: { attacks: 4, status: 'pending' } })],
    ['a battle without an army', (s: RunState) => void (s.phase = 'battle', s.army = null)],
    ['a reward phase with no offer', (s: RunState) => void (s.phase = 'reward', s.offers = null)],
    ['a planning phase that still holds an offer', (s: RunState) => void (s.offers = { kind: 'reward', cardIds: [] })],
    ['an offer of the wrong phase', (s: RunState) => void (s.phase = 'council', s.offers = { kind: 'reward', cardIds: [] })],
    ['an edge that does not exist', (s: RunState) => void (s.army!.waves[0]!.units as { unit: string; edge: string }[]).push({ unit: 'bandit', edge: 'X' })],
  ])('rejects %s', (_name, mutate) => {
    expect(bad(mutate)).toBe(true);
  });

  it('a fresh state of each shipped rule set is accepted', () => {
    for (const rules of [RULES_FULL]) expect(ok(wire(newRun(4, 'stone', CONTENT, rules)))).toBeDefined();
    expect(ok(wire(runState()))).toBeDefined();
  });
});

describe('meta_untouched', () => {
  it('decoding or rejecting a run never reads or writes the meta store', async () => {
    const store = new MemorySaveStore();
    await store.saveMeta({ crowns: 42 });
    await store.saveRun(env(runState()));
    expect(ok(await store.loadRun())).toBeDefined();
    await store.saveRun({ ...env(runState()), formatVersion: 7 } as never);
    expect(decodeRun(await store.loadRun(), CONTENT).kind).toBe('incompatible');
    expect(await store.loadMeta()).toEqual({ crowns: 42 });
  });
});
