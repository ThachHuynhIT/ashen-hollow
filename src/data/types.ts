/** Kiểu dữ liệu G1 (spec §5.1). Chỉ là mô tả, không chứa hàm; G2+ mở rộng các union. */
import type { PaletteColor } from './palette';

export type Level = 1 | 2 | 3 | 4 | 5;
/** Giá trị theo cấp L1..L5. */
export type PerLevel = readonly [number, number, number, number, number];

export type KingId =
  | 'wheat'
  | 'stone'
  | 'arcane'
  | 'grove'
  | 'tide'
  | 'forge'
  | 'clock'
  | 'moon'
  | 'nomad';
export type CardOwner = KingId | 'neutral';
export type CardId = `${CardOwner}_${string}`;
export type UnitId = string;

export type CardKind = 'throne' | 'troop' | 'tower' | 'economy' | 'support' | 'enchantment' | 'tome';
export type BuildingKind = 'throne' | 'troop' | 'tower' | 'economy' | 'support';
export type Rarity = 'common' | 'uncommon' | 'rare';
export type CardTag =
  | 'farm'
  | 'grove'
  | 'fire'
  | 'clockwork'
  | 'undead'
  | 'pirate'
  | 'cavalry'
  | 'mage'
  | 'golem'
  | 'sacrifice';

export type DamageType = 'physical' | 'fire' | 'magic';
export type UnitTag =
  | 'melee'
  | 'ranged'
  | 'flying'
  | 'siege'
  | 'boss'
  | 'summon'
  | 'human'
  | 'beast'
  | 'undead'
  | 'clockwork'
  | 'golem'
  | 'mage'
  | 'pirate'
  | 'cavalry'
  | 'construct';
export type TargetMode = 'nearest' | 'closestToThrone' | 'lowestHp' | 'highestHp';

export type OnHitDef = { readonly type: 'slow'; readonly pct: number; readonly ticks: number };

export interface AttackSpec {
  readonly dmg: number;
  readonly type: DamageType;
  /** px, khoảng cách mép–mép (§8.4) */
  readonly range: number;
  readonly minRange?: number;
  /** tick giữa hai đòn */
  readonly interval: number;
  /** px/tick; không có = đánh tức thời */
  readonly projectileSpeed?: number;
  /** số mục tiêu tối đa trong tầm cận chiến; phụ nhận 50% */
  readonly cleave?: number;
  readonly onHit?: readonly OnHitDef[];
}

export interface UnitDef {
  readonly id: UnitId;
  readonly nameVi: string;
  readonly hp: number;
  readonly attack: AttackSpec;
  /** px/tick */
  readonly speed: number;
  /** px, va chạm */
  readonly radius: number;
  /** 0..0.75 */
  readonly armor: number;
  readonly tags: readonly UnitTag[];
  /** EP ở cấp 1; 0 = không bao giờ được composeArmy chọn */
  readonly enemyCost: number;
  readonly sprite: { readonly w: 16 | 24 | 48; readonly h: 16 | 24 | 32 | 48 };
}

export type EffectDef =
  | { readonly type: 'spawn'; readonly unit: UnitId; readonly count: PerLevel }
  | { readonly type: 'tower'; readonly attack: AttackSpec; readonly targeting: TargetMode };

export type TomeTarget = 'lockedPlot' | 'buildingThenPlot';
export type TomeAction =
  | { readonly type: 'unlockPlot'; readonly gold: number }
  /** levelIfFar: +cấp nếu Manhattan ≥ 2 (0 = không) */
  | { readonly type: 'move'; readonly levelIfFar: number };

interface CardBase {
  /** `${owner}_${tên}`, ví dụ 'wheat_militia' */
  readonly id: CardId;
  readonly owner: CardOwner;
  readonly nameVi: string;
  /** tên tiếng Anh, chỉ dùng trong code/debug */
  readonly name: string;
  readonly rarity: Rarity;
  readonly tags: readonly CardTag[];
  /** mẫu có placeholder {key}, giải bởi describeCard (§5.6) */
  readonly textVi: string;
  readonly unlock?: 'meta';
}

export interface ThroneDef extends CardBase {
  readonly kind: 'throne';
  readonly hp: number;
  readonly armor: number;
  readonly attack: AttackSpec;
  readonly passive: readonly EffectDef[];
}

export interface BuildingCardDef extends CardBase {
  readonly kind: 'troop' | 'tower';
  readonly structureHp?: PerLevel;
  readonly effects: readonly EffectDef[];
}

export interface TomeCardDef extends CardBase {
  readonly kind: 'tome';
  readonly target: TomeTarget;
  readonly actions: readonly TomeAction[];
}

export type CardDef = ThroneDef | BuildingCardDef | TomeCardDef;

export interface KingDef {
  readonly id: KingId;
  readonly nameVi: string;
  readonly name: string;
  /** màu chủ đạo (§11.1) */
  readonly color: PaletteColor;
  readonly throne: ThroneDef;
  /** G1: 3 thẻ (đủ 9 từ G2), không gồm Ngai */
  readonly cards: readonly CardDef[];
  readonly units: readonly UnitDef[];
  readonly enemyRoster: readonly { readonly unit: UnitId; readonly weight: number }[];
}
