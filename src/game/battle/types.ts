import type {
  BannerDef,
  BossId,
  CardId,
  DamageType,
  KingId,
  OnHitDef,
  TargetMode,
  UnitBehaviourDef,
  UnitId,
  UnitTag,
} from '../../data/types';

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
  /** Thổ Phỉ, id vua địch, Liên Quân hai vua hoặc boss. */
  attacker: 'raiders' | 'coalition' | 'boss' | KingId;
  /** Hai vua của Liên Quân (chỉ có ở `coalition`). */
  kings?: readonly KingId[];
  /** Boss và thứ tự của nó (chỉ có ở `boss`). */
  boss?: BossId;
  bossOrdinal?: 1 | 2 | 3;
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
  /** Hiệu ứng trúng ngoài chậm/choáng/tăng dần (bỏng, độc, đẩy, kéo, hút máu, hồi đồng minh). */
  onHit?: readonly OnHitDef[];
  /** Đòn hình quạt: địch khác trong quạt cũng nhận trọn sát thương. */
  cone?: { range: number; halfAngleCos: number } | null;
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
  tags?: readonly UnitTag[];
  behaviours?: readonly UnitBehaviourDef[];
  /** Vị trí đơn vị trong danh sách id đã sắp của registry: khoá bỏng/độc của quân địch. */
  defIndex?: number;
  /** Giây "lên dây trước" cộng vào đồng hồ tăng tiến (§8.6). */
  prewind?: number;
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
    /** đẩy lùi ra xa tháp (px); 0 = không */
    knockback?: number;
  } | null;
  /** lính cùng phe trong `radius` hồi `hps` máu mỗi giây */
  healAura?: { radius: number; hps: number } | null;
  /** mỗi lần hạ địch triệu hồi 1 `stats` tại công trình, tối đa `max` mỗi trận */
  summonOnKill?: { stats: UnitStats; max: number } | null;
  /** mỗi `everyTicks` tick triệu hồi 1 `stats` tại ô, tối đa `max` mỗi trận */
  summonEvery?: { everyTicks: number; stats: UnitStats; max: number } | null;
  /** đầu trận triệu hồi `count` lính `stats` quanh ô công trình */
  startSummon?: { stats: UnitStats; count: number } | null;
  /** giây lên dây trước cho tăng tiến của công trình (§8.6) */
  prewind?: number;
  /** công trình tự đánh nhanh dần: `pps`% mỗi giây, tối đa `cap`% */
  rampAs?: { pps: number; cap: number } | null;
  /** Tháp Chuông: mỗi `everyTicks` tick lính mình trong `radius` đánh nhanh thêm `pct`% trong `ticks` tick, địch choáng `stun` tick */
  bell?: { everyTicks: number; radius: number; pct: number; ticks: number; stun: number } | null;
  /** Ổ Nhện: mỗi `everyTicks` tick, nếu lính còn ít hơn `count` thì sinh lại 1 */
  respawn?: { everyTicks: number; stats: UnitStats; count: number } | null;
  /** đánh `count` mục tiêu khác nhau mỗi nhịp (Vực Kraken) */
  multiAttack?: number;
  /** mỗi `every` địch do lính của công trình này hạ: +`gold` vàng, tối đa `max` mỗi trận */
  killGold?: { every: number; gold: number; max: number } | null;
  /** lính triệu hồi thêm tại Ngai đầu trận (Hợp Đồng Lính Đánh Thuê) */
  spawnAtThrone?: { stats: UnitStats; count: number } | null;
  /** bán kính khiêu khích: địch trong vòng này phải đánh công trình này trước; 0 = không */
  taunt: number;
  /** xung khiên: mỗi `everyTicks` tick lính mình trong `radius` nhận `amount` khiên (tối đa 2×) */
  shieldPulse: { everyTicks: number; radius: number; amount: number } | null;
}

/** Boss của trận: chỉ số đã giải, nơi và lúc xuất hiện, quân triệu hồi và Bóng Gương (spec §7.3). */
export interface BossSetup {
  id: BossId;
  ordinal: 1 | 2 | 3;
  /** Tick xuất hiện (`WAVES.spawnTick[1]`). */
  spawnTick: number;
  /** Mép đầu tiên của đợt 2. */
  edge: Edge;
  stats: UnitStats;
  /** Chỉ số quân triệu hồi theo id đơn vị (`frog`, `hornet`), để trận không tra registry. */
  summons: Readonly<Record<string, UnitStats>>;
  /** Lính của Bóng Gương: loại của công trình lính cấp cao nhất; null nếu không có công trình lính. */
  mirror: { stats: UnitStats; count: number } | null;
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
  /** Boss của trận (năm 10, 20, 30); vắng ở mọi trận khác. */
  boss?: BossSetup;
  /** Cờ hiệu của vua tấn công (chỉ hiệu ứng cần logic trong trận); vắng với Thổ Phỉ, Liên Quân, boss. */
  banner?: BannerDef;
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
  | { type: 'revive'; id: number }
  | { type: 'ended'; won: boolean };
