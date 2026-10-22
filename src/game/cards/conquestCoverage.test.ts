import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/random';
import type { CardDef, KingId } from '../../data/types';
import type { PlayTarget } from '../run/state';
import { checkPlay } from '../run/board';
import { applyCommand } from '../run/commands';
import { rollConquestCards } from '../run/rewards';
import { runState, withBuilding } from '../testing/fixtures';
import { CONTENT } from './registry';

/** The 54 conquest-only cards of spec 6.6-6.11, as literal ids (not read from the data under test). */
const EXPECTED: Record<string, string[]> = {
  grove: ['wolf_den', 'sapling', 'spring', 'deep_roots', 'thorn_tower', 'bear_cave', 'spring_rain', 'spirit_stags', 'treant'],
  tide: ['pirates', 'cannon', 'harbor', 'undertow_rune', 'wave_tower', 'treasure', 'hookmen', 'privateers', 'kraken'],
  forge: ['swordsmen', 'flame_tower', 'smithy', 'ember_rune', 'master_hammer', 'bombardiers', 'blast_furnace', 'armory', 'iron_drake'],
  clock: ['windup_soldiers', 'gear_tower', 'spring_workshop', 'tick_rune', 'bell_tower', 'spiders', 'rewind', 'steam_cannon', 'colossus'],
  moon: ['crypt', 'shadow_spire', 'blood_pact', 'blood_moon_rune', 'altar', 'vampires', 'summoning_circle', 'eclipse_pact', 'reaper_shrine'],
  nomad: ['riders', 'horse_archers', 'stables', 'relocate', 'bazaar', 'wind_rune', 'watchtower', 'caravan', 'khan_guard'],
};
const KINGS = Object.keys(EXPECTED) as KingId[];
const ids = (king: string): string[] => EXPECTED[king]!.map((n) => `${king}_${n}`);

const sources = import.meta.glob<string>('./*Conquest.test.ts', { query: '?raw', import: 'default', eager: true });
const testOf = (king: string): string => sources[`./${king}Conquest.test.ts`] ?? '';

describe('all54_have_effect_tests', () => {
  it('has 54 expected ids, six kings of nine', () => {
    expect(KINGS.flatMap(ids)).toHaveLength(54);
    expect(new Set(KINGS.flatMap(ids)).size).toBe(54);
  });

  it.each(KINGS)('%s: the content has exactly these nine cards, each named in that king own effect test', (king) => {
    expect(CONTENT.conquestCards(king).map((c) => c.id).sort()).toEqual([...ids(king)].sort());
    const text = testOf(king);
    expect(text.length).toBeGreaterThan(0);
    for (const id of ids(king)) {
      expect(text.includes(`'${id}'`), `${id} is not exercised in ${king}Conquest.test.ts`).toBe(true);
    }
  });
});

describe('all9_conquest_pools', () => {
  it.each(KINGS)('%s: nine unique cards, no throne, three random picks are unique members', (king) => {
    const cards = CONTENT.conquestCards(king);
    expect(new Set(cards.map((c) => c.id)).size).toBe(9);
    expect(cards.some((c) => c.kind === 'throne')).toBe(false);
    for (let seed = 1; seed <= 20; seed++) {
      const pick = rollConquestCards(new Rng(seed), cards);
      expect(pick).toHaveLength(3);
      expect(new Set(pick).size).toBe(3);
      for (const id of pick) expect(ids(king)).toContain(id);
    }
  });

  it('only the three first kings can be played; no Nomad throne, perk or free move exists', () => {
    expect(CONTENT.kings().map((k) => k.id)).toEqual(['wheat', 'stone', 'arcane']);
    expect(CONTENT.allCards().some((c) => c.kind === 'throne' && !['wheat', 'stone', 'arcane'].includes(c.owner))).toBe(false);
    expect('freeMovesLeft' in runState()).toBe(false);
  });

  /** A board with one of each building kind and free squares, to try every card on. */
  const board = () => {
    let s = { ...runState(), lives: 3, gold: 50 };
    s = withBuilding(s, 6, 'wheat_militia', 1); // troop
    s = withBuilding(s, 7, 'neutral_archer_tower', 1); // tower
    s = withBuilding(s, 8, 'neutral_well', 1); // economy
    s = withBuilding(s, 11, 'wheat_granary', 1); // support
    return s;
  };
  const targetFor = (card: CardDef): PlayTarget => {
    if (card.kind === 'tome') {
      if (card.target === 'none') return { kind: 'none' };
      if (card.target === 'building') return { kind: 'plot', plot: 6 };
      if (card.target === 'buildingThenPlot') return { kind: 'two', first: 6, second: 16 };
      return { kind: 'plot', plot: 16 };
    }
    if (card.kind === 'enchantment') {
      return { kind: 'plot', plot: card.targets.includes('troop') ? 6 : card.targets.includes('tower') ? 7 : 12 };
    }
    return { kind: 'plot', plot: 16 };
  };

  it('every one of the 54 cards can be taken as a reward and played at once', () => {
    for (const king of KINGS) {
      for (const card of CONTENT.conquestCards(king)) {
        const s = board();
        expect(checkPlay(s.plots, card, targetFor(card), CONTENT), card.id).toBeNull();
        const taken = { ...s, deck: [...s.deck, card.id], hand: [card.id, ...s.hand.slice(1)] };
        const r = applyCommand(taken, { type: 'play', handIndex: 0, target: targetFor(card) }, CONTENT);
        expect('error' in r ? r.error : 'ok', card.id).toBe('ok');
      }
    }
  });
});
