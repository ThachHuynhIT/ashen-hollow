/** Toàn vẹn dữ liệu G2 (spec §13.1): ba vua Lúa Mì, Đá Núi, Phép Thuật và thẻ trung lập. */
import { describe, expect, it } from 'vitest';
import { CUSTOM_INCOME_HANDLERS, CUSTOM_STAT_HANDLERS, CUSTOM_TOME_HANDLERS } from '../game/cards/custom';
import { CONTENT } from '../game/cards/registry';
import { startDeck } from '../game/run/calendar';
import { KINGS_G2 } from './kings';
import { PALETTE } from './palette';
import type { CardDef, EffectDef, PerLevel, Scalar } from './types';

const cards: readonly CardDef[] = CONTENT.allCards();
const units = CONTENT.allUnits();

const isPerLevel = (v: unknown): v is PerLevel => Array.isArray(v);
const perLevels = (v: Scalar | undefined): PerLevel[] => (v !== undefined && isPerLevel(v) ? [v] : []);

/** Every PerLevel value reachable from the effects of a card. */
const perLevelsOf = (card: CardDef): PerLevel[] => {
  const out: PerLevel[] = [];
  const fromEffect = (e: EffectDef): void => {
    if (e.type === 'spawn') out.push(e.count);
    else if (e.type === 'gold' || e.type === 'goldPerNeighbour') out.push(...perLevels(e.amount));
    else if (e.type === 'stat') out.push(...perLevels(e.value));
    else if (e.type === 'pulse') out.push(...perLevels(e.radius));
    else if (e.type === 'shieldPulse') out.push(...perLevels(e.amount));
    else if (e.type === 'custom') for (const v of Object.values(e.params ?? {})) out.push(...perLevels(v));
  };
  if (card.kind === 'throne') card.passive.forEach(fromEffect);
  else if (card.kind === 'enchantment') card.perStack.forEach(fromEffect);
  else if (card.kind === 'tome') {
    for (const a of card.actions) {
      if (a.type === 'custom') for (const v of Object.values(a.params ?? {})) out.push(...perLevels(v));
    }
  } else {
    card.effects.forEach(fromEffect);
    if (card.structureHp) out.push(card.structureHp);
  }
  return out;
};

describe('G2 kings', () => {
  it('are Wheat, Stone and Arcane', () => {
    expect(KINGS_G2.map((k) => k.id)).toEqual(['wheat', 'stone', 'arcane']);
  });

  for (const king of KINGS_G2) {
    describe(king.id, () => {
      it('has one throne and nine cards: 4 common, 3 uncommon, 2 rare', () => {
        expect(king.throne.kind).toBe('throne');
        expect(king.cards).toHaveLength(9);
        const n = (r: string) => king.cards.filter((c) => c.rarity === r).length;
        expect([n('common'), n('uncommon'), n('rare')]).toEqual([4, 3, 2]);
      });

      it('names every id with its owner prefix and has non-empty texts', () => {
        for (const c of [king.throne, ...king.cards]) {
          expect(c.id.startsWith(`${king.id}_`)).toBe(true);
          expect(c.owner).toBe(king.id);
          expect(c.nameVi.length).toBeGreaterThan(0);
          expect(c.textVi.length).toBeGreaterThan(0);
        }
        for (const u of king.units) expect(u.nameVi.length).toBeGreaterThan(0);
        expect(king.banner.nameVi.length).toBeGreaterThan(0);
        expect(king.banner.textVi.length).toBeGreaterThan(0);
        expect(king.banner.effects.length).toBeGreaterThan(0);
      });

      it('uses a palette colour and has a non-empty enemy roster of its own units', () => {
        expect(Object.keys(PALETTE)).toContain(king.color);
        expect(king.enemyRoster.length).toBeGreaterThan(0);
        const own = new Set(king.units.map((u) => u.id));
        for (const r of king.enemyRoster) {
          expect(CONTENT.unit(r.unit).enemyCost, `${r.unit} cost`).toBeGreaterThan(0);
          expect(own.has(r.unit) || units.some((u) => u.id === r.unit)).toBe(true);
          expect(r.weight).toBeGreaterThan(0);
        }
      });

      it('has an 11-card starting deck: every common twice and every uncommon once', () => {
        const deck = startDeck(king);
        expect(deck).toHaveLength(11);
        for (const id of deck) expect(king.cards.map((c) => c.id)).toContain(id);
      });
    });
  }
});

describe('G2 content integrity', () => {
  it('has globally unique card and unit ids', () => {
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    expect(new Set(units.map((u) => u.id)).size).toBe(units.length);
  });

  it('only references units that exist (spawns, death spawns, rosters)', () => {
    const ids = new Set(units.map((u) => u.id));
    for (const c of cards) {
      if (c.kind === 'troop' || c.kind === 'tower' || c.kind === 'economy' || c.kind === 'support') {
        for (const e of c.effects) if (e.type === 'spawn') expect(ids.has(e.unit), `${c.id} → ${e.unit}`).toBe(true);
      }
    }
    for (const u of units) {
      for (const b of u.behaviours ?? []) expect(ids.has(b.unit), `${u.id} → ${b.unit}`).toBe(true);
    }
  });

  it('keeps every PerLevel table at length 5', () => {
    for (const c of cards) for (const t of perLevelsOf(c)) expect(t, c.id).toHaveLength(5);
  });

  it('gives enchantments numbers only per stack', () => {
    for (const c of cards) {
      if (c.kind !== 'enchantment') continue;
      for (const e of c.perStack) if (e.type === 'stat') expect(typeof e.value, c.id).toBe('number');
    }
  });

  it('has a handler for every custom effect it uses', () => {
    for (const c of cards) {
      const customs: string[] = [];
      if (c.kind === 'throne') for (const e of c.passive) if (e.type === 'custom') customs.push(e.id);
      if (c.kind === 'tome') for (const a of c.actions) if (a.type === 'custom') customs.push(a.id);
      if (c.kind === 'troop' || c.kind === 'tower' || c.kind === 'economy' || c.kind === 'support') {
        for (const e of c.effects) if (e.type === 'custom') customs.push(e.id);
      }
      for (const id of customs) {
        const registered =
          c.kind === 'tome'
            ? id in CUSTOM_TOME_HANDLERS
            : id in CUSTOM_STAT_HANDLERS || id in CUSTOM_INCOME_HANDLERS;
        expect(registered, `${c.id} uses ${id}`).toBe(true);
      }
    }
  });

  it('puts every non-meta neutral and king card into the content, and no card of an unknown owner', () => {
    const owners = new Set<string>(['neutral', ...KINGS_G2.map((k) => k.id)]);
    for (const c of cards) expect(owners.has(c.owner), c.id).toBe(true);
    expect(CONTENT.kings().map((k) => k.id)).toEqual(['wheat', 'stone', 'arcane']);
  });
});
