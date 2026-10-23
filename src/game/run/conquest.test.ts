import { describe, expect, it } from 'vitest';
import { RULES_G2 } from '../../data/rules';
import { RUN, battleGold } from '../../data/run';
import type { BattleResult } from '../battle/types';
import { CONTENT } from '../cards/registry';
import { contentWith, fakeKing, fakeKingCards, runState } from '../testing/fixtures';
import { applyCommand } from './commands';
import type { CommandResult } from './commands';
import { cardOffer } from './flow';
import type { IllegalReason, RunCommand, RunState } from './state';

const content = contentWith({
  kings: [fakeKing('stone', { cards: fakeKingCards('stone') }), fakeKing('arcane', { cards: fakeKingCards('arcane') })],
});

const ok = (r: CommandResult) => {
  if ('error' in r) throw new Error(`unexpected ${r.error}`);
  return r.state;
};
const errorOf = (s: RunState, cmd: RunCommand): IllegalReason => {
  const before = structuredClone(s);
  const r = applyCommand(s, cmd, content);
  expect(s).toEqual(before);
  if (!('error' in r)) throw new Error('expected an error');
  return r.error;
};

const result = (won: boolean): BattleResult => ({
  won,
  ticks: 100,
  throneHpLostPct: 0,
  kills: 3,
  killsBySource: {},
  interventionsUsed: 0,
  unitsLost: 0,
  capped: 0,
  inputs: [],
});

/** Battle against `king` (their `attacks`-th previous attack already counted). */
const fight = (attacks: number, over: Partial<RunState> = {}): RunState => {
  const s = runState({
    rules: RULES_G2,
    phase: 'battle',
    hand: [],
    played: true,
    year: 9,
    gold: 10,
    enemyKings: ['stone', 'arcane'],
    enemies: { stone: { attacks, status: 'pending' }, arcane: { attacks: 0, status: 'pending' } },
    ...over,
  });
  return {
    ...s,
    army: { attacker: 'stone', attackNo: (attacks + 1) as 1 | 2 | 3, budget: 10, level: 1, statMult: 1, waves: [] },
  };
};

const RAIDERS = { attacker: 'raiders' as const, budget: 10, level: 1 as const, statMult: 1, waves: [] };

describe('attack counters', () => {
  it('counts every battle against a king, won or lost, and leaves others and raiders alone', () => {
    for (const won of [true, false]) {
      const s = ok(applyCommand(fight(0), { type: 'battleResult', result: result(won) }, content));
      expect(s.enemies.stone).toEqual({ attacks: 1, status: 'pending' });
      expect(s.enemies.arcane).toEqual({ attacks: 0, status: 'pending' });
    }
    const raiders = { ...fight(0), army: RAIDERS };
    const after = ok(applyCommand(raiders, { type: 'battleResult', result: result(true) }, content));
    expect(after.enemies.stone!.attacks).toBe(0);
    expect(after.enemies.arcane!.attacks).toBe(0);
  });
});

describe('conquering a king (spec §3.7)', () => {
  const won = (): RunState => ok(applyCommand(fight(2), { type: 'battleResult', result: result(true) }, content));

  it('a win at the third attack conquers the king, pays gold and goes to the reward first', () => {
    const s = won();
    expect(s.enemies.stone).toEqual({ attacks: 3, status: 'conquered' });
    expect(s.stats.conquered).toBe(1);
    expect(s.gold).toBe(10 + battleGold(9) + RUN.conquestGold);
    expect(s.phase).toBe('reward');
    expect(s.offers!.kind).toBe('reward');
  });

  it('after the reward comes a mandatory conquest pick of 3 distinct cards of that king', () => {
    const afterReward = ok(applyCommand(won(), { type: 'pickOffer', index: 0 }, content));
    expect(afterReward.phase).toBe('conquest');
    const offers = cardOffer(afterReward)!;
    expect(offers.kind).toBe('conquest');
    expect(offers.king).toBe('stone');
    expect(offers.cardIds).toHaveLength(3);
    expect(new Set(offers.cardIds).size).toBe(3);
    const stoneCards = content.king('stone').cards.map((c) => c.id);
    for (const id of offers.cardIds) expect(stoneCards).toContain(id);
    for (const id of offers.cardIds) expect(id).not.toBe(content.king('stone').throne.id);
  });

  it('skipping the reward still leads to the conquest pick', () => {
    const s = ok(applyCommand(won(), { type: 'pickOffer', index: null }, content));
    expect(s.phase).toBe('conquest');
  });

  it('refuses to skip the conquest pick and a bad index', () => {
    const s = ok(applyCommand(won(), { type: 'pickOffer', index: 0 }, content));
    expect(errorOf(s, { type: 'pickOffer', index: null })).toBe('badTarget');
    expect(errorOf(s, { type: 'pickOffer', index: 7 })).toBe('badTarget');
  });

  it('adds the chosen card to the deck and discard pile and starts the next year', () => {
    const s = ok(applyCommand(won(), { type: 'pickOffer', index: 0 }, content));
    const chosen = cardOffer(s)!.cardIds[1]!;
    const next = ok(applyCommand(s, { type: 'pickOffer', index: 1 }, content));
    expect(next.phase).toBe('planning');
    expect(next.year).toBe(s.year + 1);
    expect(next.deck.filter((c) => c === chosen)).toHaveLength(s.deck.filter((c) => c === chosen).length + 1);
    expect([...next.hand, ...next.drawPile, ...next.discardPile].filter((c) => c === chosen)).toHaveLength(
      next.deck.filter((c) => c === chosen).length,
    );
    expect(next.offers).toBeNull();
  });

  it('is deterministic for the same state', () => {
    const a = ok(applyCommand(won(), { type: 'pickOffer', index: 0 }, content));
    const b = ok(applyCommand(won(), { type: 'pickOffer', index: 0 }, content));
    expect(a.offers).toEqual(b.offers);
  });

  it('a win at the first or second attack conquers nobody', () => {
    for (const attacks of [0, 1]) {
      const s = ok(applyCommand(fight(attacks), { type: 'battleResult', result: result(true) }, content));
      expect(s.enemies.stone!.status).toBe('pending');
      expect(s.stats.conquered).toBe(0);
      expect(s.gold).toBe(10 + battleGold(9));
    }
  });

  it('a loss at the third attack makes the king flee: no conquest, no more attacks counted as conquest', () => {
    const s = ok(applyCommand(fight(2), { type: 'battleResult', result: result(false) }, content));
    expect(s.enemies.stone).toEqual({ attacks: 3, status: 'fled' });
    expect(s.stats.conquered).toBe(0);
    expect(s.phase).toBe('yearEnd');
    expect(s.gold).toBe(10);
  });
});

describe('end of the run follows state.rules.years', () => {
  it('a battle in the last year of the G2 rules ends the run, an earlier year does not', () => {
    const last = ok(
      applyCommand(
        { ...fight(0), army: RAIDERS, year: RULES_G2.years },
        { type: 'battleResult', result: result(true) },
        content,
      ),
    );
    expect(last.phase).toBe('ended');
    expect(last.won).toBe(true);
    const mid = ok(applyCommand(fight(0, { year: 10 }), { type: 'battleResult', result: result(true) }, content));
    expect(mid.phase).toBe('reward');
  });
});

describe('conquering a king that cannot be played (G3)', () => {
  const real = runState({
    rules: RULES_G2,
    phase: 'battle',
    hand: [],
    played: true,
    year: 9,
    enemyKings: ['nomad', 'grove'],
    enemies: { nomad: { attacks: 2, status: 'pending' }, grove: { attacks: 0, status: 'pending' } },
  });
  const nomadFight: RunState = {
    ...real,
    army: { attacker: 'nomad', attackNo: 3, budget: 10, level: 1, statMult: 1, waves: [] },
  };

  it('offers three of the nine Nomad cards without ever looking the king up as a playable one', () => {
    const won = ok(applyCommand(nomadFight, { type: 'battleResult', result: result(true) }, CONTENT));
    const afterReward = ok(applyCommand(won, { type: 'pickOffer', index: 0 }, CONTENT));
    expect(afterReward.phase).toBe('conquest');
    const offer = cardOffer(afterReward)!;
    expect(offer).toMatchObject({ kind: 'conquest', king: 'nomad' });
    expect(new Set(offer.cardIds).size).toBe(3);
    const nomad = CONTENT.conquestCards('nomad').map((c) => c.id);
    for (const id of offer.cardIds) expect(nomad).toContain(id);
    const picked = ok(applyCommand(afterReward, { type: 'pickOffer', index: 0 }, CONTENT));
    expect(picked.deck).toContain(offer.cardIds[0]);
  });
});
