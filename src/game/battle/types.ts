import type { CardId, DamageType, KingId, TargetMode, UnitId } from '../../data/types';

/** Mép sân nơi quân địch xuất hiện. */
export type Edge = 'N' | 'E' | 'S' | 'W';

export interface ArmySpawn {
  unit: UnitId;
  edge: Edge;
}

export interface ArmyWave {
  spawnTick: number;
  units: readonly ArmySpawn[];
}

/** Đạo quân địch đã bốc sẵn ở đầu năm (spec §3.6). */
export interface ArmyPlan {
  /** Thổ Phỉ hoặc id vua địch (G2). */
  attacker: 'raiders' | KingId;
  /** Lần tấn công thứ mấy (1..3) của vua địch; không có với Thổ Phỉ. */
  attackNo?: 1 | 2 | 3;
  /** id cờ hiệu của vua địch, nếu có. */
  banner?: string;
  budget: number;
  level: 1 | 2 | 3 | 4 | 5;
  /** Nhân HP & DMG khi chạm ENEMY_CAP mà còn ngân sách (√surplus), mặc định 1. */
  statMult: number;
  waves: readonly ArmyWave[];
}

/** Một lệnh can thiệp của người chơi (ghi lại để phát lại trận). */
export interface BattleInput {
  tick: number;
  x: number;
  y: number;
}

/** Bật/tắt Đá Tảng tự bắn (§7.4). Các lần thả tự động không ghi lại: suy ra lại từ trạng thái. */
export interface AutoFireInput {
  tick: number;
  auto: boolean;
}

/** Mọi lệnh người chơi lên một trận, theo thứ tự phát lại. */
export type BattleCommand = BattleInput | AutoFireInput;

export interface BattleResult {
  won: boolean;
  ticks: number;
  throneHpLostPct: number;
  kills: number;
  killsBySource: Record<number, number>;
  interventionsUsed: number;
  unitsLost: number;
  capped: number;
  inputs: BattleCommand[];
  /** Vàng thu/chi trong trận (cướp biển, hiến vàng…); mặc định 0, áp trước vàng thắng trận (§5.5). */
  goldDelta?: number;
}

/** Chỉ số đòn đánh đã giải (cấp, bùa…) dùng trong trận. */
export interface AttackStats {
  dmg: number;
  dmgType: DamageType;
  /** px, khoảng cách mép–mép (§8.3) */
  range: number;
  minRange: number;
  /** tick giữa hai đòn */
  interval: number;
  /** px/tick; 0 = đánh tức thời */
  projectileSpeed: number;
  /** số mục tiêu tối đa; 1 = một mục tiêu */
  cleave: number;
  /** chậm gây ra khi trúng (%), 0 = không */
  slowPct: number;
  slowTicks: number;
  /** bán kính nổ; địch khác trong bán kính quanh mục tiêu nhận 50%; 0 = không */
  splash: number;
  /** nảy sang `count` địch kế tiếp trong `radius` quanh mục tiêu trước, mỗi lần × `falloff` */
  chain: { count: number; radius: number; falloff: number } | null;
  /** choáng gây ra khi trúng (tick); 0 = không */
  stunTicks: number;
  /** mỗi đòn liên tiếp vào cùng mục tiêu cộng thêm % sát thương, tối đa `rampCapPct`; 0 = không */
  rampPctPerHit: number;
  rampCapPct: number;
}

/** Chỉ số một đơn vị lúc xuất quân. */
export interface UnitStats extends AttackStats {
  unit: UnitId;
  hp: number;
  /** px/tick */
  speed: number;
  radius: number;
  armor: number;
  siege: boolean;
  sprite: { w: number; h: number };
  /** khiên lúc xuất hiện (HP ảo hấp thụ trước máu) */
  shield: number;
  /** khi chết sinh `count` đơn vị `stats` cùng phe tại chỗ */
  deathSpawn: { stats: UnitStats; count: number } | null;
}

/** Một công trình (hoặc Ngai) trên bàn cờ lúc vào trận. */
export interface StructureSetup {
  /** 0..24, hàng × 5 + cột */
  plot: number;
  /** id ổn định của công trình, ghi vào sourceUid của lính nó sinh ra */
  uid: number;
  cardId: CardId;
  kind: 'throne' | 'troop' | 'tower';
  hp: number;
  armor: number;
  attack: AttackStats | null;
  targeting: TargetMode;
  spawn: { stats: UnitStats; count: number } | null;
  /** xung vòng tròn: mỗi `everyTicks` tick gây `dmg` cho mọi địch trong `radius`, kèm choáng */
  pulse: {
    everyTicks: number;
    radius: number;
    dmg: number;
    dmgType: DamageType;
    stunTicks: number;
  } | null;
  /** bán kính khiêu khích: địch trong vòng này phải đánh công trình này trước; 0 = không */
  taunt: number;
  /** xung khiên: mỗi `everyTicks` tick lính mình trong `radius` nhận `amount` khiên (tối đa 2×) */
  shieldPulse: { everyTicks: number; radius: number; amount: number } | null;
}

export interface WaveSetup {
  spawnTick: number;
  spawns: readonly { stats: UnitStats; edge: Edge }[];
}

/** Mọi thứ trận cần biết, dựng từ RunState (Task 9). */
export interface BattleSetup {
  year: number;
  throne: StructureSetup;
  structures: readonly StructureSetup[];
  waves: readonly WaveSetup[];
  /** Đá Tảng tự bắn ngay từ đầu trận (mặc định tắt). */
  autoFire?: boolean;
  /** Can Thiệp đã chốt cho trận (sắc lệnh + nhiệm vụ); vắng = số gốc §7.4. */
  intervention?: { dmgPct: number; radius: number; cooldownTicks: number };
}

/** Sự kiện cho render, rút ra bằng drainEvents. */
export type BattleEvent =
  | { type: 'spawn'; id: number }
  | { type: 'hit'; id: number; dmg: number }
  | { type: 'death'; id: number }
  | { type: 'boulder'; phase: 'drop' | 'impact'; x: number; y: number }
  | { type: 'waveSpawned'; index: number; edges: readonly Edge[] }
  | { type: 'rage' }
  | { type: 'pulse'; id: number }
  | { type: 'shield'; id: number }
  | { type: 'ended'; won: boolean };
