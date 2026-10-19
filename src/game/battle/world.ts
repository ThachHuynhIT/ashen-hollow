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
  BattleInput,
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

/** Một đòn chờ áp ở §8.9 bước 8 (`type` là mã dmgType, `sourceId` là id người đánh, −1 nếu không có). */
export interface QueuedDamage {
  victim: number;
  raw: number;
  type: number;
  sourceUid: number;
  slowPct: number;
  slowTicks: number;
  sourceId: number;
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
  /** uid công trình (công trình: uid của chính nó; địch: −1). */
  readonly sourceUid = new Int32Array(BATTLE.entityCap);
  readonly kbTicks = new Int32Array(BATTLE.entityCap);
  /** TARGET_* (0 nearest, 1 closestToThrone, 2 lowestHp, 3 highestHp). */
  readonly targeting = new Int32Array(BATTLE.entityCap);

  /** DMG_* (0 physical, 1 fire, 2 magic). */
  readonly dmgType = new Uint8Array(BATTLE.entityCap);
  /** Id đơn vị hoặc cardId — render chọn frame. */
  readonly label: string[] = new Array<string>(BATTLE.entityCap).fill('');

  readonly projectiles = new ProjectilePool();
  projectileCount = 0;

  events: BattleEvent[] = [];
  damageQueue: QueuedDamage[] = [];

  // Thống kê (BattleResult)
  kills = 0;
  unitsLost = 0;
  /** Lính phe mình bị bỏ vì vượt trần. */
  capped = 0;
  interventionsUsed = 0;
  killsBySource: Record<number, number> = {};
  inputs: BattleInput[] = [];

  /** Số đợt địch đã xuất hiện. */
  spawnedWaves = 0;
  /** Số lính phe mình đã sinh (so với BATTLE.playerUnitCap). */
  playerUnits = 0;

  /** Tick sớm nhất can thiệp được (§7.4). */
  readyTick: number = INTERVENTION.firstReadyTick;
  boulders: Boulder[] = [];

  constructor(setup: BattleSetup) {
    this.setup = setup;
  }

  /** Cấp id mới với giá trị mặc định (alive 1, target −1); −1 nếu đã đầy entityCap. */
  addEntity(): number {
    if (this.count >= BATTLE.entityCap) return -1;
    const id = this.count;
    this.count += 1;
    this.alive[id] = 1;
    this.target[id] = -1;
    this.cooldown[id] = 0;
    return id;
  }
}

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
  w.dmg[id] = a.dmg;
  w.dmgType[id] = dmgTypeCode(a.dmgType);
  w.range[id] = a.range;
  w.minRange[id] = a.minRange;
  w.interval[id] = a.interval;
  w.projSpeed[id] = a.projectileSpeed;
  w.cleave[id] = a.cleave;
  w.onHitSlowPct[id] = a.slowPct;
  w.onHitSlowTicks[id] = a.slowTicks;
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
  w.events.push({ type: 'spawn', id });
  return id;
};

const addUnit = (
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
  w.events.push({ type: 'spawn', id });
  return id;
};

/** Vị trí lính thứ k quanh tâm (§8.7): SPAWN_OFFSETS[k % 16], vòng thứ hai trở đi × 1.5 làm tròn. */
const spawnOffset = (k: number): { dx: number; dy: number } => {
  const [ox, oy] = SPAWN_OFFSETS[k % SPAWN_OFFSETS.length]!;
  if (k < SPAWN_OFFSETS.length) return { dx: ox, dy: oy };
  return { dx: Math.round(ox * 1.5), dy: Math.round(oy * 1.5) };
};

/** Dựng trận ở tick 0 (§8.7): Ngai → công trình theo plot → lính của từng Trại theo plot. Chưa xuất đợt địch nào. */
export const createBattle = (setup: BattleSetup): BattleWorld => {
  const w = new BattleWorld(setup);
  addStructure(w, setup.throne, true);
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
