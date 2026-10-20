import { KINGS_G2 } from '../../data/kings';
import { NEUTRAL_CARDS, NEUTRAL_UNITS } from '../../data/neutral';
import { RAIDER_ROSTER, RAIDER_UNITS } from '../../data/raiders';
import type { CardDef, CardId, KingDef, KingId, UnitDef, UnitId } from '../../data/types';

export interface Content {
  card(id: CardId): CardDef;
  unit(id: UnitId): UnitDef;
  king(id: KingId): KingDef;
  raiderRoster(): readonly { unit: UnitDef; weight: number }[];
  /** Mọi vua có nội dung (theo thứ tự đăng ký). */
  kings(): readonly KingDef[];
  /** Roster địch của một vua (đơn vị đã tra cứu, kèm trọng số). */
  enemyRoster(king: KingId): readonly { unit: UnitDef; weight: number }[];
  neutralPool(): readonly CardDef[];
  /** Mọi thẻ (Ngai, thẻ vua, thẻ trung lập), sắp theo id. */
  allCards(): readonly CardDef[];
  /** Mọi đơn vị (vua, trung lập, phỉ), sắp theo id. */
  allUnits(): readonly UnitDef[];
}

const byId = <T extends { readonly id: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

function buildContent(): Content {
  const cards = byId([
    ...KINGS_G2.flatMap((k) => [k.throne, ...k.cards]),
    ...NEUTRAL_CARDS,
  ]);
  const units = byId([...KINGS_G2.flatMap((k) => k.units), ...NEUTRAL_UNITS, ...RAIDER_UNITS]);
  const cardMap = new Map<string, CardDef>(cards.map((c) => [c.id, c]));
  const unitMap = new Map<string, UnitDef>(units.map((u) => [u.id, u]));
  const kingMap = new Map<string, KingDef>(KINGS_G2.map((k) => [k.id, k]));

  const need = <T>(map: Map<string, T>, id: string, what: string): T => {
    const v = map.get(id);
    if (v === undefined) throw new Error(`Unknown ${what} id: ${id}`);
    return v;
  };

  const roster = RAIDER_ROSTER.map((r) => ({ unit: need(unitMap, r.unit, 'unit'), weight: r.weight }));

  return {
    card: (id) => need(cardMap, id, 'card'),
    unit: (id) => need(unitMap, id, 'unit'),
    king: (id) => need(kingMap, id, 'king'),
    raiderRoster: () => roster,
    kings: () => KINGS_G2,
    enemyRoster: (id) =>
      need(kingMap, id, 'king').enemyRoster.map((r) => ({
        unit: need(unitMap, r.unit, 'unit'),
        weight: r.weight,
      })),
    neutralPool: () => NEUTRAL_CARDS,
    allCards: () => cards,
    allUnits: () => units,
  };
}

export const CONTENT: Content = buildContent();
