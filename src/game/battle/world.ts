/**
 * Thế giới trận (spec §8.1–8.3, §8.7): struct-of-arrays của riêng instance, sức chứa
 * BATTLE.entityCap thực thể + pool BATTLE.projectileCap đạn. Id = chỉ số mảng, cấp tăng dần
 * theo thứ tự tạo, không tái dùng. Không dùng Rng; mọi thứ tự theo plot / thứ tự setup.
 */
import { BATTLE, INTERVENTION, SPAWN_OFFSETS } from '../../data/battle';
import type { DamageType, TargetMode } from '../../data/types';
import type {
  AttackStats,
  BattleEvent,
  BattleCommand,
  BattleSetup,
  Edge,
  StructureSetup,
  UnitStats,
} from './types';

export const TEAM_ALLY = 0;
export const TEAM_FOE = 1;
export const KIND_UNIT = 0;
export const KIND_STRUCTURE = 1;
export const KIND_THRONE = 2;

/** Mã `dmgType` trong mảng typed. */
export const DMG_PHYSICAL = 0;
export const DMG_FIRE = 1;
export const DMG_MAGIC = 2;
const DMG_CODE: Record<DamageType, number> = { physical: 0, fire: 1, magic: 2 };
export const dmgTypeCode = (t: DamageType): number => DMG_CODE[t];

/** Mã `targeting` trong mảng typed. */
export const TARGET_NEAREST = 0;
export const TARGET_CLOSEST_TO_THRONE = 1;
export const TARGET_LOWEST_HP = 2;
export const TARGET_HIGHEST_HP = 3;
const TARGET_CODE: Record<TargetMode, number> = {
  nearest: 0,
  closestToThrone: 1,
  lowestHp: 2,
  highestHp: 3,
};

/** Pool đạn struct-of-arrays dài BATTLE.projectileCap. Ô 0..projectileCount−1 đang dùng, `alive` đánh dấu đạn còn bay. */
export class ProjectilePool {
  readonly px = new Float64Array(BATTLE.projectileCap);
  readonly py = new Float64Array(BATTLE.projectileCap);
  readonly speed = new Float64Array(BATTLE.projectileCap);
  readonly dmg = new Float64Array(BATTLE.projectileCap);
  readonly slowPct = new Float64Array(BATTLE.projectileCap);
  readonly slowTicks = new Int32Array(BATTLE.projectileCap);
  readonly targetId = new Int32Array(BATTLE.projectileCap);
  /** id thực thể đã bắn (thứ tự áp sát thương §8.9 bước 8). */
  readonly sourceId = new Int32Array(BATTLE.projectileCap);
  readonly sourceUid = new Int32Array(BATTLE.projectileCap);
  readonly dmgType = new Uint8Array(BATTLE.projectileCap);
  readonly alive = new Uint8Array(BATTLE.projectileCap);
}

/** Bỏng / độc đang chạy trên một mục tiêu (§8.6); khoá `key` = uid công trình (phe mình) hoặc 1e6 + defIndex (địch). */
export interface Dot {
  victim: number;
  kind: 'burn' | 'poison';
  key: number;
  dps: number;
  /** Tick còn lại. */
  ticks: number;
  /** Số lớp (độc); bỏng luôn 1. */
  stacks: number;
}

/** Một đòn chờ áp ở §8.9 bước 8 (`type` là mã dmgType, `sourceId` là id người đánh, −1 nếu không có). */
export interface QueuedDamage {
  victim: number;
  raw: number;
  type: number;
  sourceUid: number;
  slowPct: number;
  slowTicks: number;
  sourceId: number;
  /** Choáng gây ra khi trúng (tick); 0 = không. */
  stunTicks: number;
  /** Đẩy thêm (px) từ người đánh khi trúng, ví dụ đòn xung phong; 0 = không. */
  knock: number;
}

/** Tảng đá hoàng gia đang rơi (§7.4), theo thứ tự tạo. */
export interface Boulder {
  x: number;
  y: number;
  dropTick: number;
  impactTick: number;
}

export class BattleWorld {
  readonly setup: BattleSetup;
  /** Số tick đã chạy. */
  tick = 0;
  /** Id cao nhất + 1. */
  count = 0;
  readonly throneId = 0;

  // Float64Array — vị trí, chỉ số, trạng thái
  readonly x = new Float64Array(BATTLE.entityCap);
  readonly y = new Float64Array(BATTLE.entityCap);
  /** Vị trí đầu tick (render nội suy). */
  readonly prevX = new Float64Array(BATTLE.entityCap);
  readonly prevY = new Float64Array(BATTLE.entityCap);
  readonly hp = new Float64Array(BATTLE.entityCap);
  readonly maxHp = new Float64Array(BATTLE.entityCap);
  readonly dmg = new Float64Array(BATTLE.entityCap);
  readonly range = new Float64Array(BATTLE.entityCap);
  readonly minRange = new Float64Array(BATTLE.entityCap);
  /** NB: công trình không đánh (attack === null) có interval 0 và range 0 — mã chiến đấu phải chặn trường hợp này. */
  readonly interval = new Float64Array(BATTLE.entityCap);
  readonly cooldown = new Float64Array(BATTLE.entityCap);
  readonly speed = new Float64Array(BATTLE.entityCap);
  readonly radius = new Float64Array(BATTLE.entityCap);
  readonly armor = new Float64Array(BATTLE.entityCap);
  /** Chậm đang chịu (%). */
  readonly slowPct = new Float64Array(BATTLE.entityCap);
  /** Tốc độ đạn của đòn (px/tick), 0 = tức thời. */
  readonly projSpeed = new Float64Array(BATTLE.entityCap);
  readonly cleave = new Float64Array(BATTLE.entityCap);
  /** Chậm gây ra khi trúng (%). */
  readonly onHitSlowPct = new Float64Array(BATTLE.entityCap);
  /** Khiên hiện có (HP ảo hấp thụ trước máu). */
  readonly shield = new Float64Array(BATTLE.entityCap);
  readonly splash = new Float64Array(BATTLE.entityCap);
  readonly chainRadius = new Float64Array(BATTLE.entityCap);
  readonly chainFalloff = new Float64Array(BATTLE.entityCap);
  readonly rampPct = new Float64Array(BATTLE.entityCap);
  readonly rampCap = new Float64Array(BATTLE.entityCap);
  /** Bán kính khiêu khích của công trình (0 = không). */
  readonly taunt = new Float64Array(BATTLE.entityCap);
  readonly pulseRadius = new Float64Array(BATTLE.entityCap);
  readonly pulseDmg = new Float64Array(BATTLE.entityCap);
  readonly shieldRadius = new Float64Array(BATTLE.entityCap);
  readonly shieldAmount = new Float64Array(BATTLE.entityCap);
  /** Điểm về khi rảnh (tâm ô công trình sinh ra; công trình = chính nó). */
  readonly homeX = new Float64Array(BATTLE.entityCap);
  readonly homeY = new Float64Array(BATTLE.entityCap);
  /** Dịch đẩy lùi mỗi tick, còn `kbTicks` tick. */
  readonly kbX = new Float64Array(BATTLE.entityCap);
  readonly kbY = new Float64Array(BATTLE.entityCap);

  // Int32Array
  readonly team = new Int32Array(BATTLE.entityCap);
  readonly kind = new Int32Array(BATTLE.entityCap);
  readonly alive = new Int32Array(BATTLE.entityCap);
  readonly siege = new Int32Array(BATTLE.entityCap);
  /** Id mục tiêu, −1 = không có. */
  readonly target = new Int32Array(BATTLE.entityCap);
  readonly slowTicks = new Int32Array(BATTLE.entityCap);
  readonly onHitSlowTicks = new Int32Array(BATTLE.entityCap);
  /** Choáng đang chịu (tick) và choáng gây ra khi trúng. */
  readonly stunTicks = new Int32Array(BATTLE.entityCap);
  readonly onHitStunTicks = new Int32Array(BATTLE.entityCap);
  /** Mục tiêu và số đòn liên tiếp của đòn tăng dần (`rampPct`), −1 = chưa có. */
  readonly rampTarget = new Int32Array(BATTLE.entityCap).fill(-1);
  readonly rampStacks = new Int32Array(BATTLE.entityCap);
  readonly chainCount = new Int32Array(BATTLE.entityCap);
  /** Xung vòng tròn và xung khiên của công trình. */
  readonly pulseEvery = new Int32Array(BATTLE.entityCap);
  readonly pulseStun = new Int32Array(BATTLE.entityCap);
  readonly shieldEvery = new Int32Array(BATTLE.entityCap);
  /** uid công trình (công trình: uid của chính nó; địch: −1). */
  readonly sourceUid = new Int32Array(BATTLE.entityCap);
  readonly kbTicks = new Int32Array(BATTLE.entityCap);
  /** TARGET_* (0 nearest, 1 closestToThrone, 2 lowestHp, 3 highestHp). */
  readonly targeting = new Int32Array(BATTLE.entityCap);
  /** sourceUid của đòn đưa HP về ≤ 0 trong tick (thống kê killsBySource); −1 = chưa có. */
  readonly killerUid = new Int32Array(BATTLE.entityCap);

  // ---- hành vi và hiệu ứng trúng của G3 (spec §5.1, §8.3, §8.6) ----
  /** Chỉ số gốc; hành vi tăng tiến tính lại dmg / interval / speed / maxHp từ các giá trị này mỗi tick. */
  readonly baseDmg = new Float64Array(BATTLE.entityCap);
  readonly baseInterval = new Float64Array(BATTLE.entityCap);
  readonly baseSpeed = new Float64Array(BATTLE.entityCap);
  readonly baseMaxHp = new Float64Array(BATTLE.entityCap);
  readonly coneRange = new Float64Array(BATTLE.entityCap);
  readonly coneCos = new Float64Array(BATTLE.entityCap);
  readonly burnDps = new Float64Array(BATTLE.entityCap);
  readonly poisonDps = new Float64Array(BATTLE.entityCap);
  readonly lifestealPct = new Float64Array(BATTLE.entityCap);
  readonly healAllyHp = new Float64Array(BATTLE.entityCap);
  readonly healAllyRadius = new Float64Array(BATTLE.entityCap);
  readonly knockPx = new Float64Array(BATTLE.entityCap);
  readonly pullPx = new Float64Array(BATTLE.entityCap);
  readonly killHealHp = new Float64Array(BATTLE.entityCap);
  readonly auraRadius = new Float64Array(BATTLE.entityCap);
  readonly auraHps = new Float64Array(BATTLE.entityCap);
  readonly rampDmgPps = new Float64Array(BATTLE.entityCap);
  readonly rampDmgCap = new Float64Array(BATTLE.entityCap);
  readonly rampAsPps = new Float64Array(BATTLE.entityCap);
  readonly rampAsCap = new Float64Array(BATTLE.entityCap);
  readonly stepDmgPct = new Float64Array(BATTLE.entityCap);
  readonly stepSpeedPct = new Float64Array(BATTLE.entityCap);
  readonly enrageBelow = new Float64Array(BATTLE.entityCap);
  readonly enrageDmgPct = new Float64Array(BATTLE.entityCap);
  readonly soulPct = new Float64Array(BATTLE.entityCap);
  readonly chargeMult = new Float64Array(BATTLE.entityCap);
  readonly chargeKb = new Float64Array(BATTLE.entityCap);
  readonly kiteDist = new Float64Array(BATTLE.entityCap);
  readonly revivePct = new Float64Array(BATTLE.entityCap);
  /** Giây "lên dây trước" (§8.6). */
  readonly prewind = new Float64Array(BATTLE.entityCap);
  readonly burnTicks = new Int32Array(BATTLE.entityCap);
  readonly poisonTicks = new Int32Array(BATTLE.entityCap);
  readonly poisonMax = new Int32Array(BATTLE.entityCap);
  readonly pullEvery = new Int32Array(BATTLE.entityCap);
  /** Số đòn đã trúng, đếm cho `pull`. */
  readonly pullHits = new Int32Array(BATTLE.entityCap);
  readonly stepEvery = new Int32Array(BATTLE.entityCap);
  readonly stepMax = new Int32Array(BATTLE.entityCap);
  readonly chargeStun = new Int32Array(BATTLE.entityCap);
  readonly killSummonMax = new Int32Array(BATTLE.entityCap);
  readonly killSummonDone = new Int32Array(BATTLE.entityCap);
  readonly summonEvery = new Int32Array(BATTLE.entityCap);
  readonly summonMax = new Int32Array(BATTLE.entityCap);
  readonly summonDone = new Int32Array(BATTLE.entityCap);
  /** Tăng tốc đánh tạm thời (Tháp Chuông): % và tick kết thúc. */
  readonly buffAsPct = new Float64Array(BATTLE.entityCap);
  readonly buffAsUntil = new Int32Array(BATTLE.entityCap);
  readonly bellEvery = new Int32Array(BATTLE.entityCap);
  readonly bellRadius = new Float64Array(BATTLE.entityCap);
  readonly bellPct = new Float64Array(BATTLE.entityCap);
  readonly bellTicks = new Int32Array(BATTLE.entityCap);
  readonly bellStun = new Int32Array(BATTLE.entityCap);
  readonly respawnEvery = new Int32Array(BATTLE.entityCap);
  readonly respawnCount = new Int32Array(BATTLE.entityCap);
  /** Số mục tiêu khác nhau mỗi nhịp của công trình (mặc định 1). */
  readonly multiCount = new Int32Array(BATTLE.entityCap).fill(1);
  readonly killGoldEvery = new Int32Array(BATTLE.entityCap);
  readonly killGoldAmount = new Float64Array(BATTLE.entityCap);
  readonly killGoldMax = new Int32Array(BATTLE.entityCap);
  /** Đẩy lùi của xung vòng tròn (px). */
  readonly pulseKnock = new Float64Array(BATTLE.entityCap);
  /** Vị trí đơn vị trong registry đã sắp (khoá bỏng/độc của địch); −1 nếu không có. */
  readonly defIndex = new Int32Array(BATTLE.entityCap).fill(-1);
  /** Id thực thể có đòn kết liễu (killHeal); −1 = chưa có. */
  readonly killerId = new Int32Array(BATTLE.entityCap).fill(-1);
  /** 1 = đơn vị bay (§8.4). */
  readonly flying = new Uint8Array(BATTLE.entityCap);
  /** 1 = boss: miễn đẩy / kéo. */
  readonly boss = new Uint8Array(BATTLE.entityCap);
  /** 1 = đã sống lại một lần (Bất Tử và `reviveOnce` dùng chung, không ai sống lại hai lần). */
  readonly revived = new Uint8Array(BATTLE.entityCap);
  /** 1 = còn đòn xung phong chưa dùng; 1 = còn một lần sống lại. */
  readonly chargeReady = new Uint8Array(BATTLE.entityCap);
  readonly reviveReady = new Uint8Array(BATTLE.entityCap);
  /** 1 = có hành vi tăng tiến cần tính lại mỗi tick. */
  readonly tuned = new Uint8Array(BATTLE.entityCap);

  /** DMG_* (0 physical, 1 fire, 2 magic). */
  readonly dmgType = new Uint8Array(BATTLE.entityCap);
  /** DMG_* của xung vòng tròn. */
  readonly pulseDmgType = new Uint8Array(BATTLE.entityCap);
  /** Đơn vị sinh ra khi chết, theo id thực thể (không băm: suy ra từ setup). */
  readonly deathSpawn: ({ stats: UnitStats; count: number } | null)[] = new Array(BATTLE.entityCap).fill(null);
  /** Id đơn vị hoặc cardId — render chọn frame. */
  readonly label: string[] = new Array<string>(BATTLE.entityCap).fill('');
  /** Chỉ số lính sinh lại của Ổ Nhện (không băm: suy ra từ setup). */
  readonly respawnStats: (UnitStats | null)[] = new Array(BATTLE.entityCap).fill(null);
  /** Chỉ số lính triệu hồi của Tháp Bóng Đêm và Vòng Triệu Hồi (suy ra từ setup). */
  readonly killSummonStats: (UnitStats | null)[] = new Array(BATTLE.entityCap).fill(null);
  readonly summonStats: (UnitStats | null)[] = new Array(BATTLE.entityCap).fill(null);

  readonly projectiles = new ProjectilePool();
  projectileCount = 0;

  events: BattleEvent[] = [];
  damageQueue: QueuedDamage[] = [];
  /** Bỏng / độc đang chạy, theo thứ tự tạo. */
  dots: Dot[] = [];
  /** Đã cộng vàng cuối trận (killGold) chưa. */
  battleGoldSettled = false;
  /** Hồn của mỗi phe: số lính của phe đó đã chết trong trận (§8.9 bước 10). */
  souls: [number, number] = [0, 0];
  /** Vàng thu/chi trong trận (cướp biển…); cộng vào kết quả trận. */
  goldDelta = 0;

  // ---- cờ hiệu của vua địch cần logic trong trận (§6.6–6.11) ----
  /** Tái Sinh: % HP tối đa địch hồi mỗi giây. */
  regenPct = 0;
  /** Đếm Ngược: mọi địch +`bannerRampPps`% DMG mỗi giây, tối đa `bannerRampCap`% (cộng với tăng tiến riêng). */
  bannerRampPps = 0;
  bannerRampCap = 0;
  /** Bất Tử: số địch còn được sống lại và HP% khi sống lại. */
  undyingLeft = 0;
  undyingHpPct = 0;
  /** Cướp Bóc: mỗi `lootEveryPct`% HP Ngai mất thêm mất `lootGold` vàng, tối đa `lootMax`; theo dõi mốc HP thấp nhất. */
  lootEveryPct = 0;
  lootGold = 0;
  lootMax = 0;
  lootSteps = 0;
  throneMinHp = 0;

  // Thống kê (BattleResult)
  kills = 0;
  unitsLost = 0;
  /** Lính phe mình bị bỏ vì vượt trần. */
  capped = 0;
  interventionsUsed = 0;
  killsBySource: Record<number, number> = {};
  inputs: BattleCommand[] = [];

  /** Số đợt địch đã xuất hiện. */
  spawnedWaves = 0;
  /** Số lính phe mình đã sinh (so với BATTLE.playerUnitCap). */
  playerUnits = 0;

  /** Tick sớm nhất can thiệp được (§7.4). */
  readyTick: number = INTERVENTION.firstReadyTick;
  boulders: Boulder[] = [];
  /** Đá Tảng tự bắn đang bật (§7.4). */
  autoFire: boolean;
  /** Bán kính tảng đá (§7.4); khởi tạo từ INTERVENTION.radius để sắc lệnh đổi được. */
  boulderRadius: number = INTERVENTION.radius;
  /** % sát thương Can Thiệp cộng thêm (sắc lệnh, nhiệm vụ). */
  boulderDmgPct = 0;
  /** Hồi chiêu Can Thiệp sau khi giảm. */
  cooldownTicks: number = INTERVENTION.cooldownTicks;

  /** Trận đã kết thúc (§8.8); khi đó stepBattle không làm gì nữa. */
  ended = false;
  won = false;
  /** Tick trong đó trận kết thúc (BattleResult.ticks), −1 khi chưa. */
  endTick = -1;

  constructor(setup: BattleSetup) {
    this.setup = setup;
    this.autoFire = setup.autoFire ?? false;
    if (setup.intervention) {
      this.boulderDmgPct = setup.intervention.dmgPct;
      this.boulderRadius = setup.intervention.radius;
      this.cooldownTicks = setup.intervention.cooldownTicks;
    }
    for (const e of setup.banner?.effects ?? []) {
      if (e.type === 'enemyRegenPct') this.regenPct += e.pct;
      else if (e.type === 'enemyRampDmg') {
        this.bannerRampPps = e.pctPerSecond;
        this.bannerRampCap = e.cap;
      } else if (e.type === 'undying') {
        const total = setup.waves.reduce((n, w) => n + w.spawns.length, 0);
        this.undyingLeft = Math.floor((total * e.pct) / 100);
        this.undyingHpPct = e.hpPct;
      } else if (e.type === 'throneGoldLoss') {
        this.lootEveryPct = e.everyPct;
        this.lootGold = e.gold;
        this.lootMax = e.max;
      }
    }
  }

  /** Cấp id mới với giá trị mặc định (alive 1, target −1); −1 nếu đã đầy entityCap. */
  addEntity(): number {
    if (this.count >= BATTLE.entityCap) return -1;
    const id = this.count;
    this.count += 1;
    this.alive[id] = 1;
    this.target[id] = -1;
    this.killerUid[id] = -1;
    this.cooldown[id] = 0;
    return id;
  }
}

/** Hồi máu không vượt `maxHp`. */
export const heal = (w: BattleWorld, id: number, amount: number): void => {
  w.hp[id] = Math.min(w.maxHp[id]!, w.hp[id]! + amount);
};

/** Tâm ô `plot` (hàng × 5 + cột) trong toạ độ thế giới (§8.2). */
export const plotCenter = (plot: number): { x: number; y: number } => {
  const col = plot % 5;
  const row = Math.floor(plot / 5);
  const half = BATTLE.plot / 2;
  return {
    x: BATTLE.boardOrigin + BATTLE.plot * col + half,
    y: BATTLE.boardOrigin + BATTLE.plot * row + half,
  };
};

/**
 * Vị trí xuất hiện của `count` lính trên một mép (§8.2): hàng `perRow` lính cách nhau
 * spawnSpacing, căn giữa quanh trung điểm mép, ngoài cánh đồng spawnOutside; hàng sau
 * lùi ra thêm spawnRowGap.
 */
export const edgePositions = (edge: Edge, count: number): { x: number; y: number }[] => {
  const field = BATTLE.field;
  const perRow = Math.floor((BATTLE.edgeSpan * field) / BATTLE.spawnSpacing) + 1;
  const mid = field / 2;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const along = mid + (i - row * perRow - (inRow - 1) / 2) * BATTLE.spawnSpacing;
    const depth = BATTLE.spawnOutside + row * BATTLE.spawnRowGap;
    switch (edge) {
      case 'N':
        out.push({ x: along, y: -depth });
        break;
      case 'S':
        out.push({ x: along, y: field + depth });
        break;
      case 'W':
        out.push({ x: -depth, y: along });
        break;
      case 'E':
        out.push({ x: field + depth, y: along });
        break;
    }
  }
  return out;
};

const setAttack = (w: BattleWorld, id: number, a: AttackStats | null): void => {
  if (a === null) return; // mảng mới tạo đã là 0
  w.baseDmg[id] = a.dmg;
  w.baseInterval[id] = a.interval;
  if (a.cone) {
    w.coneRange[id] = a.cone.range;
    w.coneCos[id] = a.cone.halfAngleCos;
  }
  for (const h of a.onHit ?? []) {
    switch (h.type) {
      case 'burn':
        w.burnDps[id] = h.dps;
        w.burnTicks[id] = h.ticks;
        break;
      case 'poison':
        w.poisonDps[id] = h.dps;
        w.poisonTicks[id] = h.ticks;
        w.poisonMax[id] = h.maxStacks;
        break;
      case 'knockback':
        w.knockPx[id] = h.px;
        break;
      case 'pull':
        w.pullPx[id] = h.px;
        w.pullEvery[id] = h.every;
        break;
      case 'lifesteal':
        w.lifestealPct[id] = h.pct;
        break;
      case 'healAlly':
        w.healAllyHp[id] = h.hp;
        w.healAllyRadius[id] = h.radius;
        break;
      default:
        break; // slow / stun / rampSameTarget đã phẳng hoá trong AttackStats
    }
  }
  w.dmg[id] = a.dmg;
  w.dmgType[id] = dmgTypeCode(a.dmgType);
  w.range[id] = a.range;
  w.minRange[id] = a.minRange;
  w.interval[id] = a.interval;
  w.projSpeed[id] = a.projectileSpeed;
  w.cleave[id] = a.cleave;
  w.onHitSlowPct[id] = a.slowPct;
  w.onHitSlowTicks[id] = a.slowTicks;
  w.splash[id] = a.splash;
  w.chainCount[id] = a.chain?.count ?? 0;
  w.chainRadius[id] = a.chain?.radius ?? 0;
  w.chainFalloff[id] = a.chain?.falloff ?? 0;
  w.onHitStunTicks[id] = a.stunTicks;
  w.rampPct[id] = a.rampPctPerHit;
  w.rampCap[id] = a.rampCapPct;
};

const place = (w: BattleWorld, id: number, x: number, y: number): void => {
  w.x[id] = x;
  w.y[id] = y;
  w.prevX[id] = x;
  w.prevY[id] = y;
};

const addStructure = (w: BattleWorld, s: StructureSetup, isThrone: boolean): number => {
  const id = w.addEntity();
  if (id < 0) return id;
  const c = plotCenter(s.plot);
  place(w, id, c.x, c.y);
  w.homeX[id] = c.x;
  w.homeY[id] = c.y;
  w.team[id] = TEAM_ALLY;
  w.kind[id] = isThrone ? KIND_THRONE : KIND_STRUCTURE;
  w.hp[id] = s.hp;
  w.maxHp[id] = s.hp;
  w.armor[id] = s.armor;
  w.radius[id] = isThrone ? BATTLE.throneRadius : BATTLE.structureRadius;
  w.speed[id] = 0;
  w.sourceUid[id] = s.uid;
  w.targeting[id] = TARGET_CODE[s.targeting];
  w.label[id] = s.cardId;
  setAttack(w, id, s.attack);
  w.taunt[id] = s.taunt;
  if (s.pulse) {
    w.pulseEvery[id] = s.pulse.everyTicks;
    w.pulseRadius[id] = s.pulse.radius;
    w.pulseDmg[id] = s.pulse.dmg;
    w.pulseDmgType[id] = dmgTypeCode(s.pulse.dmgType);
    w.pulseStun[id] = s.pulse.stunTicks;
    w.pulseKnock[id] = s.pulse.knockback ?? 0;
  }
  if (s.healAura) {
    w.auraRadius[id] = s.healAura.radius;
    w.auraHps[id] = s.healAura.hps;
  }
  w.multiCount[id] = Math.max(s.multiAttack ?? 1, 1);
  if ((s.prewind ?? 0) > 0) {
    w.prewind[id] = s.prewind!;
    w.tuned[id] = 1;
  }
  if (s.rampAs) {
    w.rampAsPps[id] = s.rampAs.pps;
    w.rampAsCap[id] = s.rampAs.cap;
    w.tuned[id] = 1;
  }
  if (s.bell) {
    w.bellEvery[id] = s.bell.everyTicks;
    w.bellRadius[id] = s.bell.radius;
    w.bellPct[id] = s.bell.pct;
    w.bellTicks[id] = s.bell.ticks;
    w.bellStun[id] = s.bell.stun;
  }
  if (s.summonOnKill) {
    w.killSummonMax[id] = s.summonOnKill.max;
    w.killSummonStats[id] = s.summonOnKill.stats;
  }
  if (s.summonEvery) {
    w.summonEvery[id] = s.summonEvery.everyTicks;
    w.summonMax[id] = s.summonEvery.max;
    w.summonStats[id] = s.summonEvery.stats;
  }
  if (s.respawn) {
    w.respawnEvery[id] = s.respawn.everyTicks;
    w.respawnCount[id] = s.respawn.count;
    w.respawnStats[id] = s.respawn.stats;
  }
  if (s.killGold) {
    w.killGoldEvery[id] = s.killGold.every;
    w.killGoldAmount[id] = s.killGold.gold;
    w.killGoldMax[id] = s.killGold.max;
  }
  if (s.shieldPulse) {
    w.shieldEvery[id] = s.shieldPulse.everyTicks;
    w.shieldRadius[id] = s.shieldPulse.radius;
    w.shieldAmount[id] = s.shieldPulse.amount;
  }
  w.events.push({ type: 'spawn', id });
  return id;
};

/** Thêm một lính ở (x, y) với điểm về (homeX, homeY); −1 nếu đầy entityCap. Phát sự kiện spawn. */
export const addUnit = (
  w: BattleWorld,
  stats: UnitStats,
  team: number,
  x: number,
  y: number,
  homeX: number,
  homeY: number,
  sourceUid: number,
): number => {
  const id = w.addEntity();
  if (id < 0) return id;
  place(w, id, x, y);
  w.homeX[id] = homeX;
  w.homeY[id] = homeY;
  w.team[id] = team;
  w.kind[id] = KIND_UNIT;
  w.hp[id] = stats.hp;
  w.maxHp[id] = stats.hp;
  w.speed[id] = stats.speed;
  w.radius[id] = stats.radius;
  w.armor[id] = stats.armor;
  w.siege[id] = stats.siege ? 1 : 0;
  w.sourceUid[id] = sourceUid;
  w.targeting[id] = TARGET_NEAREST;
  w.label[id] = stats.unit;
  setAttack(w, id, stats);
  w.shield[id] = stats.shield;
  w.deathSpawn[id] = stats.deathSpawn;
  initBehaviours(w, id, stats);
  w.events.push({ type: 'spawn', id });
  return id;
};

/** Ghi thẻ, khoá bỏng/độc và mọi hành vi của `stats` vào các mảng của thực thể `id`. */
function initBehaviours(w: BattleWorld, id: number, stats: UnitStats): void {
  w.baseSpeed[id] = stats.speed;
  w.baseMaxHp[id] = stats.hp;
  w.defIndex[id] = stats.defIndex ?? -1;
  w.prewind[id] = stats.prewind ?? 0;
  w.flying[id] = stats.tags?.includes('flying') ? 1 : 0;
  w.boss[id] = stats.tags?.includes('boss') ? 1 : 0;
  for (const b of stats.behaviours ?? []) {
    switch (b.type) {
      case 'reviveOnce':
        w.revivePct[id] = b.hpPct;
        w.reviveReady[id] = 1;
        break;
      case 'enrage':
        w.enrageBelow[id] = b.belowHpPct;
        w.enrageDmgPct[id] = b.dmgPct;
        w.tuned[id] = 1;
        break;
      case 'rampDmg':
        w.rampDmgPps[id] = (w.rampDmgPps[id] ?? 0) + b.pctPerSecond; // nhiều nguồn tăng tiến cùng loại cộng với nhau (§5.3)
        w.rampDmgCap[id] = (w.rampDmgCap[id] ?? 0) + b.cap;
        w.tuned[id] = 1;
        break;
      case 'rampAttackSpeed':
        w.rampAsPps[id] = (w.rampAsPps[id] ?? 0) + b.pctPerSecond;
        w.rampAsCap[id] = (w.rampAsCap[id] ?? 0) + b.cap;
        w.tuned[id] = 1;
        break;
      case 'stepBuff':
        w.stepEvery[id] = b.everyTicks;
        w.stepDmgPct[id] = b.dmgPct;
        w.stepSpeedPct[id] = b.speedPct;
        w.stepMax[id] = b.maxStacks;
        w.tuned[id] = 1;
        break;
      case 'charge':
        w.chargeMult[id] = b.dmgMult;
        w.chargeKb[id] = b.knockback;
        w.chargeStun[id] = b.stunTicks;
        w.chargeReady[id] = 1;
        break;
      case 'kite':
        w.kiteDist[id] = b.distance;
        break;
      case 'healAura':
        w.auraRadius[id] = b.radius;
        w.auraHps[id] = b.hpPerSec;
        break;
      case 'killHeal':
        w.killHealHp[id] = b.hp;
        break;
      case 'soulScaling':
        w.soulPct[id] = b.pctPerSoul;
        w.tuned[id] = 1;
        break;
      default:
        break; // deathSpawn đã có ở addUnit; boss là việc của task boss
    }
  }
  if (w.prewind[id]! > 0 || (w.team[id] === TEAM_FOE && w.bannerRampPps > 0)) w.tuned[id] = 1;
}

/** Vị trí lính thứ k quanh tâm (§8.7): SPAWN_OFFSETS[k % 16], vòng thứ hai trở đi × 1.5 làm tròn. */
export const spawnOffset = (k: number): { dx: number; dy: number } => {
  const [ox, oy] = SPAWN_OFFSETS[k % SPAWN_OFFSETS.length]!;
  if (k < SPAWN_OFFSETS.length) return { dx: ox, dy: oy };
  return { dx: Math.round(ox * 1.5), dy: Math.round(oy * 1.5) };
};

/** Dựng trận ở tick 0 (§8.7): Ngai → công trình theo plot → lính của từng Trại theo plot. Chưa xuất đợt địch nào. */
export const createBattle = (setup: BattleSetup): BattleWorld => {
  const w = new BattleWorld(setup);
  addStructure(w, setup.throne, true);
  w.throneMinHp = w.maxHp[w.throneId]!;
  const sorted = [...setup.structures].sort((a, b) => a.plot - b.plot || a.uid - b.uid);
  for (const s of sorted) addStructure(w, s, false);
  for (const s of sorted) {
    if (s.kind !== 'troop' || s.spawn === null) continue;
    const c = plotCenter(s.plot);
    for (let k = 0; k < s.spawn.count; k++) {
      if (w.playerUnits >= BATTLE.playerUnitCap) {
        w.capped += 1;
        continue;
      }
      const o = spawnOffset(k);
      const id = addUnit(w, s.spawn.stats, TEAM_ALLY, c.x + o.dx, c.y + o.dy, c.x, c.y, s.uid);
      if (id < 0) w.capped += 1;
      else w.playerUnits += 1;
    }
  }
  // Triệu hồi đầu trận (§8.7): Đàn Tế theo ô, rồi lính đánh thuê của Hợp Đồng tại Ngai.
  for (const s of sorted) {
    const start = s.startSummon;
    if (!start) continue;
    const c = plotCenter(s.plot);
    for (let k = 0; k < start.count; k++) {
      if (w.playerUnits >= BATTLE.playerUnitCap) {
        w.capped += 1;
        continue;
      }
      const o = spawnOffset(k);
      const id = addUnit(w, start.stats, TEAM_ALLY, c.x + o.dx, c.y + o.dy, c.x, c.y, s.uid);
      if (id < 0) w.capped += 1;
      else w.playerUnits += 1;
    }
  }
  // Triệu hồi đầu trận tại Ngai (§8.7): lính đánh thuê của Hợp Đồng.
  const at = setup.throne.spawnAtThrone;
  if (at) {
    const c = plotCenter(setup.throne.plot);
    for (let k = 0; k < at.count; k++) {
      if (w.playerUnits >= BATTLE.playerUnitCap) {
        w.capped += 1;
        continue;
      }
      const o = spawnOffset(k);
      const id = addUnit(w, at.stats, TEAM_ALLY, c.x + o.dx, c.y + o.dy, c.x, c.y, setup.throne.uid);
      if (id < 0) w.capped += 1;
      else w.playerUnits += 1;
    }
  }
  return w;
};

/**
 * Xuất đợt địch `index` (§8.7): lính theo thứ tự `spawns`, mỗi mép lấy edgePositions(mép, số
 * lính của mép) theo thứ tự xuất hiện. Hết entityCap thì phần thiếu bị bỏ.
 */
export const spawnWave = (world: BattleWorld, index: number): void => {
  const wave = world.setup.waves[index];
  if (wave === undefined) throw new RangeError(`spawnWave: no wave ${index}`);
  const edges: Edge[] = [];
  const perEdge: Record<Edge, number> = { N: 0, E: 0, S: 0, W: 0 };
  for (const s of wave.spawns) {
    if (perEdge[s.edge] === 0) edges.push(s.edge);
    perEdge[s.edge] += 1;
  }
  const slots: Record<Edge, { x: number; y: number }[]> = {
    N: edgePositions('N', perEdge.N),
    E: edgePositions('E', perEdge.E),
    S: edgePositions('S', perEdge.S),
    W: edgePositions('W', perEdge.W),
  };
  const used: Record<Edge, number> = { N: 0, E: 0, S: 0, W: 0 };
  for (const s of wave.spawns) {
    const p = slots[s.edge][used[s.edge]]!;
    used[s.edge] += 1;
    if (addUnit(world, s.stats, TEAM_FOE, p.x, p.y, p.x, p.y, -1) < 0) break;
  }
  world.spawnedWaves += 1;
  world.events.push({ type: 'waveSpawned', index, edges });
};

/** Trả các sự kiện tích luỹ từ lần rút trước và làm rỗng hàng. */
export const drainEvents = (world: BattleWorld): BattleEvent[] => {
  const out = world.events;
  world.events = [];
  return out;
};
