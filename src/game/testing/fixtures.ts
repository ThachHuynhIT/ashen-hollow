/** Dựng setup trận nhỏ cho test (không dùng trong mã chạy thật). */
import type { BannerDef, CardDef, KingDef, KingId, UnitDef } from '../../data/types';
import { CONTENT, type Content } from '../cards/registry';
import { newRun } from '../run/yearFlow';
import type { RunState } from '../run/state';
import type { AttackStats, BattleSetup, StructureSetup, UnitStats } from '../battle/types';

/** Đòn cận chiến tức thời: dmg 5, tầm 2, 10 tick/đòn. */
export const attackStats = (over: Partial<AttackStats> = {}): AttackStats => ({
  dmg: 5,
  dmgType: 'physical',
  range: 2,
  minRange: 0,
  interval: 10,
  projectileSpeed: 0,
  cleave: 1,
  slowPct: 0,
  slowTicks: 0,
  ...over,
});

/** Lính cận chiến: hp 40, dmg 5, tầm 2, interval 10, speed 1, radius 4, armor 0. */
export const unitStats = (over: Partial<UnitStats> = {}): UnitStats => ({
  ...attackStats(),
  unit: 'test_unit',
  hp: 40,
  speed: 1,
  radius: 4,
  armor: 0,
  siege: false,
  sprite: { w: 16, h: 16 },
  ...over,
});

/** Công trình lính không sinh lính (uid = plot + 1, hp 100, không đánh). */
export const structure = (plot: number, over: Partial<StructureSetup> = {}): StructureSetup => ({
  plot,
  uid: plot + 1,
  cardId: 'neutral_barracks',
  kind: 'troop',
  hp: 100,
  armor: 0,
  attack: null,
  targeting: 'closestToThrone',
  spawn: null,
  ...over,
});

/** Ngai: plot 12, uid 0, hp 300, bắn tầm 72 (đạn 8 px/tick), chọn mục tiêu gần nhất. */
export const throneSetup = (over: Partial<StructureSetup> = {}): StructureSetup => ({
  plot: 12,
  uid: 0,
  cardId: 'wheat_throne',
  kind: 'throne',
  hp: 300,
  armor: 0,
  attack: attackStats({ dmg: 6, range: 72, interval: 10, projectileSpeed: 8 }),
  targeting: 'nearest',
  spawn: null,
  ...over,
});

/** Năm 1, Ngai mặc định, không công trình, không đợt địch. */
export const battleSetup = (over: Partial<BattleSetup> = {}): BattleSetup => ({
  year: 1,
  throne: throneSetup(),
  structures: [],
  waves: [],
  ...over,
});

/** Bỏ từng lá của `hand` khỏi một bản sao của `deck` (theo bản), phần còn lại giữ thứ tự. */
const withoutHand = (deck: readonly RunState['deck'][number][], hand: readonly string[]) => {
  const rest = [...deck];
  for (const id of hand) {
    const i = rest.indexOf(id as RunState['deck'][number]);
    if (i >= 0) rest.splice(i, 1);
  }
  return rest;
};

/**
 * Ván mới năm 1 (vua lúa mì, seed 1) với các trường ghi đè. Ghi đè `hand` mà không ghi đè hai
 * chồng bài thì phần còn lại của `deck` thành `drawPile`, để bất biến
 * `hand ∪ drawPile ∪ discardPile = deck` vẫn đúng.
 */
export const runState = (over: Partial<RunState> = {}): RunState => {
  const base = { ...newRun(1, 'wheat', CONTENT), ...over };
  if (over.hand !== undefined && over.drawPile === undefined && over.discardPile === undefined) {
    return { ...base, drawPile: withoutHand(base.deck, over.hand), discardPile: [] };
  }
  return base;
};

/** Vua giả cho test: Ngai của Lúa Mì, một đơn vị `<id>_grunt` (EP `cost`), roster chỉ có đơn vị đó. */
export const fakeKing = (
  id: KingId,
  over: { cost?: number; banner?: BannerDef; cards?: readonly CardDef[] } = {},
): KingDef => {
  const wheat = CONTENT.king('wheat');
  const unit: UnitDef = {
    id: `${id}_grunt`,
    nameVi: `Lính ${id}`,
    hp: 30,
    attack: { dmg: 5, type: 'physical', range: 2, interval: 10 },
    speed: 1,
    radius: 4,
    armor: 0,
    tags: ['melee', 'human'],
    enemyCost: over.cost ?? 2,
    sprite: { w: 16, h: 16 },
  };
  return {
    ...wheat,
    id,
    nameVi: `Vua ${id}`,
    name: id,
    throne: { ...wheat.throne, id: `${id}_throne`, owner: id },
    cards: over.cards ?? [],
    units: [unit],
    enemyRoster: [{ unit: unit.id, weight: 1 }],
    banner: over.banner ?? { id: `${id}_banner`, nameVi: 'Cờ', textVi: 'Cờ hiệu thử.', effects: [] },
  };
};

/** `CONTENT` cộng thêm các vua (và thẻ/đơn vị của họ) cho test; tra cứu ưu tiên phần thêm. */
export const contentWith = (extra: {
  kings?: readonly KingDef[];
  cards?: readonly CardDef[];
  units?: readonly UnitDef[];
}): Content => {
  const kings = extra.kings ?? [];
  const cards = new Map<string, CardDef>();
  for (const k of kings) for (const c of [k.throne, ...k.cards]) cards.set(c.id, c);
  for (const c of extra.cards ?? []) cards.set(c.id, c);
  const units = new Map<string, UnitDef>();
  for (const k of kings) for (const u of k.units) units.set(u.id, u);
  for (const u of extra.units ?? []) units.set(u.id, u);
  const kingMap = new Map(kings.map((k) => [k.id, k] as const));
  const sortById = <T extends { id: string }>(items: T[]): T[] =>
    items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    ...CONTENT,
    card: (id) => cards.get(id) ?? CONTENT.card(id),
    unit: (id) => units.get(id) ?? CONTENT.unit(id),
    king: (id) => kingMap.get(id) ?? CONTENT.king(id),
    enemyRoster: (id) => {
      const king = kingMap.get(id);
      if (!king) return CONTENT.enemyRoster(id);
      return king.enemyRoster.map((r) => ({
        unit: units.get(r.unit) ?? CONTENT.unit(r.unit),
        weight: r.weight,
      }));
    },
    allCards: () => sortById([...CONTENT.allCards(), ...cards.values()]),
    allUnits: () => sortById([...CONTENT.allUnits(), ...units.values()]),
  };
};

/** Chín thẻ giả của một vua (4 thường, 3 vừa, 2 hiếm), `<king>_c1..` / `_u1..` / `_r1..`. */
export const fakeKingCards = (king: KingId): CardDef[] => {
  const make = (id: string, rarity: CardDef['rarity']): CardDef => ({
    id: id as CardDef['id'],
    owner: king,
    nameVi: id,
    name: id,
    kind: 'troop',
    rarity,
    tags: [],
    textVi: id,
    effects: [],
  });
  return [
    ...[1, 2, 3, 4].map((n) => make(`${king}_c${n}`, 'common')),
    ...[1, 2, 3].map((n) => make(`${king}_u${n}`, 'uncommon')),
    ...[1, 2].map((n) => make(`${king}_r${n}`, 'rare')),
  ];
};
