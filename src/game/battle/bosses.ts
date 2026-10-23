/**
 * Boss (spec §7.3, §8.9): xuất hiện ở `spawnTick` tại mép đầu tiên của đợt 2 và chiến đấu như một đơn vị
 * địch (cờ `boss` miễn đẩy/kéo, không tính vào trần địch). Kỹ năng chạy theo TUỔI boss `tick − bossSpawnTick`
 * (nên Ném Bùn đầu tiên ở tick 200, Đàn Ong ở 170…), nguồn theo id tăng dần, không dùng Rng.
 */
import { BATTLE } from '../../data/battle';
import { BOSS_RULES } from '../../data/bosses';
import {
  DMG_PHYSICAL,
  KIND_STRUCTURE,
  TEAM_FOE,
  addUnit,
  edgePositions,
  spawnOffset,
  type BattleWorld,
} from './world';
import type { UnitStats } from './types';

/** Bước 1: nếu đến `spawnTick` và boss chưa xuất hiện thì đặt boss ở mép đã chọn (đúng một lần). */
export function spawnBossDue(world: BattleWorld): void {
  const boss = world.setup.boss;
  if (boss === undefined || world.bossSpawned || world.tick < boss.spawnTick) return;
  const p = edgePositions(boss.edge, 1)[0]!;
  const id = addUnit(world, boss.stats, TEAM_FOE, p.x, p.y, p.x, p.y, -1);
  world.bossSpawned = true;
  world.bossSpawnTick = world.tick;
  world.bossId = id;
}

/**
 * Sinh tối đa `count` lính `stats` quanh boss (vị trí `SPAWN_OFFSETS` theo số lính đã sinh). Dừng khi đủ
 * `bossSummonCap` lính còn sống hoặc hết id thực thể (id không tái dùng; phần thiếu tính vào `capped`).
 * Trả số lính sinh được.
 */
export function spawnBossSummons(world: BattleWorld, stats: UnitStats, count: number): number {
  const boss = world.bossId;
  if (boss < 0) return 0;
  let made = 0;
  for (let k = 0; k < count; k++) {
    if (world.bossSummonsAlive >= BATTLE.bossSummonCap) break;
    const o = spawnOffset(world.bossSummonSeq);
    const id = addUnit(world, stats, TEAM_FOE, world.x[boss]! + o.dx, world.y[boss]! + o.dy, world.x[boss]!, world.y[boss]!, -1);
    if (id < 0) {
      world.capped += 1;
      break;
    }
    world.bossSummonSeq += 1;
    world.isBossSummon[id] = 1;
    world.bossSummonsAlive += 1;
    made += 1;
  }
  return made;
}

/** Ném Bùn: 60 vật lý vào tháp có DMG cao nhất trong tầm (hoà → ô nhỏ nhất) và vô hiệu nó 30 tick. */
function mudThrow(world: BattleWorld, boss: number): void {
  const rules = BOSS_RULES.bog;
  const r2 = rules.mudRange * rules.mudRange;
  let best = -1;
  let bestDmg = -1;
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] === 0 || world.kind[i] !== KIND_STRUCTURE || world.isTower[i] === 0) continue;
    const dx = world.x[i]! - world.x[boss]!;
    const dy = world.y[i]! - world.y[boss]!;
    if (dx * dx + dy * dy > r2) continue;
    const dmg = Math.max(world.dmg[i]!, world.pulseDmg[i]!);
    if (dmg > bestDmg) {
      best = i; // duyệt id tăng dần = ô tăng dần: hoà giữ ô nhỏ nhất
      bestDmg = dmg;
    }
  }
  if (best < 0) return;
  world.damageQueue.push({
    victim: best,
    raw: rules.mudDmg,
    type: DMG_PHYSICAL,
    sourceUid: -1,
    slowPct: 0,
    slowTicks: 0,
    sourceId: boss,
    stunTicks: 0,
    knock: 0,
  });
  world.disabledUntil[best] = world.tick + rules.mudDisableTicks;
}

/**
 * Sau khi boss nhận sát thương (sau bước 8 và sau bỏng/độc), trước khi chết: Gọi Ếch của Ông Kẹ — lần đầu
 * HP xuống dưới 50% sinh 10 ếch, đúng một lần dù hồi máu rồi xuống lại; boss đã chết thì không gọi.
 */
export function afterBossDamage(world: BattleWorld, id: number): void {
  const boss = world.setup.boss;
  if (boss === undefined || id !== world.bossId || world.alive[id] === 0 || world.hp[id]! <= 0) return;
  if (boss.ordinal === 1 && !world.bossFrogsCalled && world.hp[id]! * 100 < BOSS_RULES.bog.frogBelowHpPct * world.maxHp[id]!) {
    world.bossFrogsCalled = true;
    spawnBossSummons(world, boss.summons.frog!, BOSS_RULES.bog.frogCount);
  }
}

/** Hạ Cánh: mỗi 150 tick tuổi, đáp 40 tick — mất tag bay, không tấn công, nhận thêm sát thương (xem combat). */
function updateLanding(world: BattleWorld, boss: number, age: number): void {
  const rules = BOSS_RULES.hornet;
  const landed = age > 0 && age % rules.landEveryTicks < rules.landTicks;
  world.bossLanded = landed;
  world.bossLandEnd = landed ? world.tick + (rules.landTicks - (age % rules.landEveryTicks)) : -1;
  world.flying[boss] = landed ? 0 : 1;
}

/** Bước 3 (hook `onBattleTick`): kỹ năng của boss đã xuất hiện, theo tuổi boss. */
export function tickBosses(world: BattleWorld): void {
  const boss = world.bossId;
  const setup = world.setup.boss;
  if (setup === undefined || boss < 0 || world.alive[boss] === 0) return;
  const age = world.tick - world.bossSpawnTick;
  afterBossDamage(world, boss);
  if (setup.ordinal === 1) {
    if (age > 0 && age % BOSS_RULES.bog.mudEveryTicks === 0) mudThrow(world, boss);
  } else if (setup.ordinal === 2) {
    updateLanding(world, boss, age);
    if (age > 0 && age % BOSS_RULES.hornet.swarmEveryTicks === 0) {
      spawnBossSummons(world, setup.summons.hornet!, BOSS_RULES.hornet.swarmCount);
    }
  }
}
