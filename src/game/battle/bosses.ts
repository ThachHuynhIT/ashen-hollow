/**
 * Boss (spec §7.3, §8.9): xuất hiện ở `spawnTick` tại mép đầu tiên của đợt 2 và chiến đấu như một
 * đơn vị địch (cờ `boss` miễn đẩy/kéo, không tính vào trần địch). Kỹ năng của từng boss được thêm ở
 * các bước sau; ở đây chỉ có xuất hiện và điểm móc `tickBosses`.
 */
import { edgePositions, addUnit, TEAM_FOE, type BattleWorld } from './world';

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

/** Bước 3 (hook `onBattleTick`): kỹ năng của boss đã xuất hiện, nguồn theo id tăng dần. */
export function tickBosses(world: BattleWorld): void {
  if (world.bossId < 0 || world.alive[world.bossId] === 0) return;
}
