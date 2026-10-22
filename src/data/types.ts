/** Kiểu dữ liệu G1–G2 (spec §5.1). Chỉ là mô tả, không chứa hàm; G3+ mở rộng các union. */
import type { PaletteColor } from './palette';

export type Level = 1 | 2 | 3 | 4 | 5;
/** Giá trị theo cấp L1..L5. */
export type PerLevel = readonly [number, number, number, number, number];
/** Số cố định hoặc theo cấp. Trong Bùa luôn là number (nhân với số stack). */
export type Scalar = number | PerLevel;

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

export type OnHitDef =
  | { readonly type: 'slow'; readonly pct: number; readonly ticks: number }
  | { readonly type: 'stun'; readonly ticks: number }
  /** Bỏng `dps` mỗi giây trong `ticks` tick; cùng nguồn làm mới, khác nguồn cộng dồn (§8.6). */
  | { readonly type: 'burn'; readonly dps: number; readonly ticks: number }
  /** Độc `dps` mỗi lớp mỗi giây; cộng lớp tới `maxStacks` mỗi nguồn (§8.6). */
  | { readonly type: 'poison'; readonly dps: number; readonly ticks: number; readonly maxStacks: number }
  /** Đẩy mục tiêu ra xa `px` (công trình và boss miễn). */
  | { readonly type: 'knockback'; readonly px: number }
  /** Cứ `every` đòn kéo mục tiêu về phía người đánh `px`. */
  | { readonly type: 'pull'; readonly px: number; readonly every: number }
  /** Hồi `pct`% sát thương gây ra (sau giáp). */
  | { readonly type: 'lifesteal'; readonly pct: number }
  /** Hồi `hp` cho đồng minh máu thấp nhất trong `radius` px. */
  | { readonly type: 'healAlly'; readonly hp: number; readonly radius: number }
  /** Mỗi đòn liên tiếp vào cùng mục tiêu cộng `pctPerHit`% sát thương, tối đa `cap`%. */
  | { readonly type: 'rampSameTarget'; readonly pctPerHit: number; readonly cap: number };

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
  /** bán kính; mục tiêu phụ nhận 50% */
  readonly splash?: number;
  /** số mục tiêu tối đa trong tầm cận chiến; phụ nhận 50% */
  readonly cleave?: number;
  /** nảy sang `count` địch kế tiếp trong `radius`, mỗi lần nhân `falloff` */
  readonly chain?: { readonly count: number; readonly radius: number; readonly falloff: number };
  /** Hình quạt: mọi địch trong `range` nằm trong góc `halfAngleCos` quanh hướng tới mục tiêu. */
  readonly cone?: { readonly range: number; readonly halfAngleCos: number };
  readonly onHit?: readonly OnHitDef[];
}

export type UnitBehaviourDef =
  /** Chết lần đầu thì sống lại với `hpPct`% HP tối đa (một lần). */
  | { readonly type: 'reviveOnce'; readonly hpPct: number }
  /** Dưới `belowHpPct`% HP: +`dmgPct`% sát thương. */
  | { readonly type: 'enrage'; readonly belowHpPct: number; readonly dmgPct: number }
  | { readonly type: 'rampDmg'; readonly pctPerSecond: number; readonly cap: number }
  | { readonly type: 'rampAttackSpeed'; readonly pctPerSecond: number; readonly cap: number }
  /** Cứ `everyTicks` tick một lớp: +`dmgPct`% DMG và +`speedPct`% tốc, tối đa `maxStacks` lớp. */
  | {
      readonly type: 'stepBuff';
      readonly everyTicks: number;
      readonly dmgPct: number;
      readonly speedPct: number;
      readonly maxStacks: number;
    }
  /** Đòn đầu tiên: ×`dmgMult`, đẩy `knockback` px, choáng `stunTicks`. */
  | {
      readonly type: 'charge';
      readonly dmgMult: number;
      readonly knockback: number;
      readonly stunTicks: number;
    }
  /** Địch gần hơn `distance` px khi đang hồi đòn: lùi ra xa. */
  | { readonly type: 'kite'; readonly distance: number }
  /** Hồi `hpPerSec` HP mỗi giây cho lính cùng phe trong `radius` px. */
  | { readonly type: 'healAura'; readonly radius: number; readonly hpPerSec: number }
  | { readonly type: 'deathSpawn'; readonly unit: UnitId; readonly count: number }
  /** Hạ được địch thì hồi `hp`. */
  | { readonly type: 'killHeal'; readonly hp: number }
  /** +`pctPerSoul`% HP và DMG mỗi Hồn (lính cùng phe đã chết trong trận). */
  | { readonly type: 'soulScaling'; readonly pctPerSoul: number }
  | { readonly type: 'boss'; readonly id: BossId };

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
  readonly behaviours?: readonly UnitBehaviourDef[];
  /** EP ở cấp 1; 0 = không bao giờ được composeArmy chọn */
  readonly enemyCost: number;
  readonly sprite: { readonly w: 16 | 24 | 48; readonly h: 16 | 24 | 32 | 48 };
}

export type Scope = 'self' | 'neighbours' | 'board';
export interface Filter {
  readonly kinds?: readonly BuildingKind[];
  readonly tags?: readonly CardTag[];
  readonly unitTags?: readonly UnitTag[];
  readonly cardIds?: readonly CardId[];
}
export type StatKey =
  | 'hp'
  | 'dmg'
  | 'attackSpeed'
  | 'range'
  | 'speed'
  | 'armor'
  | 'unitCount'
  | 'structureHp'
  | 'knockback'
  | 'burnDps'
  | 'gold';
/** `flatPost`: cộng sau mọi % (Bùa Tia Lửa). */
export type StatMode = 'flat' | 'pct' | 'flatPost';

/** Hiệu ứng riêng của từng thẻ, tra handler theo id (danh sách đóng để TS bắt lỗi chính tả). */
export type CustomEffectId =
  | 'wheat_harvest'
  | 'peasant_horde'
  | 'harvest_festival'
  | 'mercenary_upkeep'
  | 'library_virtual_stacks'
  | 'archmage_ramp'
  | 'arcane_harmony'
  | 'rune_carving'
  | 'mirror_enchants';

export type EffectDef =
  | { readonly type: 'spawn'; readonly unit: UnitId; readonly count: PerLevel }
  | { readonly type: 'tower'; readonly attack: AttackSpec; readonly targeting: TargetMode }
  /** Đòn vòng tròn quanh công trình mỗi `everyTicks` tick. */
  | {
      readonly type: 'pulse';
      readonly everyTicks: number;
      readonly radius: Scalar;
      readonly attack: AttackSpec;
    }
  /** Vàng đầu năm. */
  | { readonly type: 'gold'; readonly amount: Scalar }
  /** Vàng đầu năm cho mỗi công trình `cardId` lân cận. */
  | { readonly type: 'goldPerNeighbour'; readonly cardId: CardId; readonly amount: Scalar }
  | {
      readonly type: 'stat';
      readonly scope: Scope;
      readonly filter?: Filter;
      readonly stat: StatKey;
      readonly mode: StatMode;
      readonly value: Scalar;
    }
  | { readonly type: 'taunt'; readonly radius: number }
  | {
      readonly type: 'shieldPulse';
      readonly radius: number;
      readonly amount: Scalar;
      readonly everyTicks: number;
    }
  | {
      readonly type: 'custom';
      readonly id: CustomEffectId;
      readonly params?: Readonly<Record<string, Scalar>>;
    };

export type TomeTarget =
  | 'none'
  | 'building'
  | 'buildingThenPlot'
  | 'buildingThenBuilding'
  | 'lockedPlot'
  | 'emptyPlot';
export type TomeAction =
  | { readonly type: 'levelUp'; readonly amount: number }
  | { readonly type: 'unlockPlot'; readonly gold: number }
  /** levelIfFar: +cấp nếu Manhattan ≥ 2 (0 = không) */
  | { readonly type: 'move'; readonly levelIfFar: number }
  | { readonly type: 'sacrifice'; readonly goldPerLevel: number }
  | {
      readonly type: 'custom';
      readonly id: CustomEffectId;
      readonly params?: Readonly<Record<string, Scalar>>;
    };

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
  readonly kind: 'troop' | 'tower' | 'economy' | 'support';
  readonly structureHp?: PerLevel;
  readonly effects: readonly EffectDef[];
}

/** Bùa: gắn lên công trình có loại trong `targets`; `perStack` áp cho mỗi stack. */
export interface EnchantCardDef extends CardBase {
  readonly kind: 'enchantment';
  readonly targets: readonly BuildingKind[];
  readonly perStack: readonly EffectDef[];
}

export interface TomeCardDef extends CardBase {
  readonly kind: 'tome';
  readonly target: TomeTarget;
  readonly actions: readonly TomeAction[];
}

export type CardDef = ThroneDef | BuildingCardDef | EnchantCardDef | TomeCardDef;

/** Hiệu ứng cờ hiệu khi vua làm địch (spec §6.3–6.5). */
export type BannerEffect =
  /** Cộng pct% vào `enemyCost` của mọi đơn vị khi tính ngân sách (âm = rẻ hơn). */
  | { readonly type: 'enemyCostPct'; readonly pct: number }
  | { readonly type: 'enemyStat'; readonly stat: 'hp' | 'speed'; readonly pct: number }
  /** Mỗi địch xuất hiện với khiên = pct% HP tối đa. */
  | { readonly type: 'enemyShieldPct'; readonly pct: number };

export interface BannerDef {
  readonly id: string;
  readonly nameVi: string;
  readonly textVi: string;
  readonly effects: readonly BannerEffect[];
}

export interface KingDef {
  readonly id: KingId;
  readonly nameVi: string;
  readonly name: string;
  /** Một dòng lối chơi, hiện ở màn chọn vua. */
  readonly blurbVi: string;
  /** màu chủ đạo (§11.1) */
  readonly color: PaletteColor;
  readonly throne: ThroneDef;
  /** G1: 3 thẻ (đủ 9 từ G2), không gồm Ngai */
  readonly cards: readonly CardDef[];
  readonly units: readonly UnitDef[];
  readonly enemyRoster: readonly { readonly unit: UnitId; readonly weight: number }[];
  /** Cờ hiệu khi làm địch. */
  readonly banner: BannerDef;
}

/** Sắc lệnh hội đồng (spec §7.1) — danh sách đóng 18 id. */
export type DecreeId = `decree_${
  | 'harvest_tax'
  | 'expand_borders'
  | 'mobilize'
  | 'recast_crown'
  | 'royal_armory'
  | 'new_armor'
  | 'royal_archers'
  | 'merchant_guild'
  | 'fourth_hand'
  | 'bigger_boulder'
  | 'quick_reflex'
  | 'amnesty'
  | 'treasury'
  | 'academy'
  | 'purge'
  | 'trade'
  | 'rune_festival'
  | 'moat'}`;

/** Nhiệm vụ (spec §7.2) — danh sách đóng 13 id. */
export type QuestId = `quest_${
  | 'untouched'
  | 'three_barracks'
  | 'no_reroll'
  | 'slaughter'
  | 'double_rune'
  | 'land_grab'
  | 'master_builder'
  | 'blitz'
  | 'hoard'
  | 'no_help'
  | 'offering'
  | 'diversity'
  | 'wager'}`;

/** Boss (spec §7.3) — năm 10, 20, 30. */
export type BossId = 'boss_bog_ogre' | 'boss_hornet_queen' | 'boss_crownless_king';
