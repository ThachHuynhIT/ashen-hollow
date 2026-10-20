/**
 * Pha công trình ở bước 3 của một tick (spec §8.9 `onBattleTick`): xung vòng tròn gây sát thương
 * và choáng lên địch, xung khiên cho lính mình. Duyệt công trình theo id tăng dần; công trình
 * đã bị phá (alive 0) ngừng mọi hiệu ứng (§8.7). Không dùng Rng.
 */
import { queueDamage } from './combat';
import { KIND_UNIT, TEAM_ALLY, type BattleWorld } from './world';

const dueAt = (world: BattleWorld, every: number): boolean =>
  every > 0 && world.tick > 0 && world.tick % every === 0;

/** Xung vòng tròn: mỗi `pulseEvery` tick (lần đầu ở tick = pulseEvery) mọi địch trong `pulseRadius`. */
export const pulsePhase = (world: BattleWorld): void => {
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] === 0 || !dueAt(world, world.pulseEvery[i]!)) continue;
    const r2 = world.pulseRadius[i]! * world.pulseRadius[i]!;
    for (let j = 0; j < world.count; j++) {
      if (world.alive[j] === 0 || world.team[j] === world.team[i]) continue;
      const dx = world.x[j]! - world.x[i]!;
      const dy = world.y[j]! - world.y[i]!;
      if (dx * dx + dy * dy > r2) continue;
      queueDamage(
        world,
        j,
        world.pulseDmg[i]!,
        world.pulseDmgType[i]!,
        world.sourceUid[i]!,
        undefined,
        i,
        world.pulseStun[i]!,
      );
    }
    world.events.push({ type: 'pulse', id: i });
  }
};

/** Xung khiên: lính mình trong `shieldRadius` nhận `shieldAmount` khiên, tối đa 2× (spec §6.5). */
export const shieldPulsePhase = (world: BattleWorld): void => {
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] === 0 || !dueAt(world, world.shieldEvery[i]!)) continue;
    const amount = world.shieldAmount[i]!;
    const r2 = world.shieldRadius[i]! * world.shieldRadius[i]!;
    for (let j = 0; j < world.count; j++) {
      if (world.alive[j] === 0 || world.team[j] !== TEAM_ALLY || world.kind[j] !== KIND_UNIT) continue;
      const dx = world.x[j]! - world.x[i]!;
      const dy = world.y[j]! - world.y[i]!;
      if (dx * dx + dy * dy > r2) continue;
      world.shield[j] = Math.min(world.shield[j]! + amount, amount * 2);
      world.events.push({ type: 'shield', id: j });
    }
  }
};
