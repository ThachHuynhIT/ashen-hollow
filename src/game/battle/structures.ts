/**
 * Pha công trình ở bước 3 của một tick (spec §8.9 `onBattleTick`): xung vòng tròn gây sát thương
 * và choáng lên địch, xung khiên cho lính mình. Duyệt công trình theo id tăng dần; công trình
 * đã bị phá (alive 0) ngừng mọi hiệu ứng (§8.7). Không dùng Rng.
 */
import { queueDamage } from './combat';
import { BATTLE } from '../../data/battle';
import { KIND_UNIT, TEAM_ALLY, addUnit, spawnOffset, type BattleWorld } from './world';

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
        world.pulseKnock[i]!,
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
      // Capped at twice this ward's amount, but never below what a stronger ward already gave.
      const held = world.shield[j]!;
      world.shield[j] = Math.max(held, Math.min(held + amount, amount * 2));
      world.events.push({ type: 'shield', id: j });
    }
  }
};

/**
 * Tháp Chuông (§6.9): mỗi `bellEvery` tick lính mình trong bán kính đánh nhanh thêm `bellPct`% trong
 * `bellTicks` tick; địch trong bán kính bị choáng `bellStun` tick. Duyệt theo id tăng dần.
 */
export const bellPhase = (world: BattleWorld): void => {
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] === 0 || !dueAt(world, world.bellEvery[i]!)) continue;
    const r2 = world.bellRadius[i]! * world.bellRadius[i]!;
    for (let j = 0; j < world.count; j++) {
      if (world.alive[j] === 0 || world.kind[j] !== KIND_UNIT) continue;
      const dx = world.x[j]! - world.x[i]!;
      const dy = world.y[j]! - world.y[i]!;
      if (dx * dx + dy * dy > r2) continue;
      if (world.team[j] === TEAM_ALLY) {
        world.buffAsPct[j] = Math.max(world.tick < world.buffAsUntil[j]! ? world.buffAsPct[j]! : 0, world.bellPct[i]!);
        world.buffAsUntil[j] = world.tick + world.bellTicks[i]!;
        world.tuned[j] = 1; // tính lại nhịp đánh mỗi tick từ chỉ số gốc
      } else if (world.bellStun[i]! > 0) {
        world.stunTicks[j] = Math.max(world.stunTicks[j]!, world.bellStun[i]!);
      }
    }
  }
};

/**
 * Ổ Nhện (§6.9): mỗi `respawnEvery` tick, nếu số lính còn sống của công trình ít hơn số ban đầu thì
 * sinh lại 1 tại ô (chịu trần lính phe mình).
 */
export const respawnPhase = (world: BattleWorld): void => {
  for (let i = 0; i < world.count; i++) {
    const stats = world.respawnStats[i] ?? null;
    if (world.alive[i] === 0 || stats === null || !dueAt(world, world.respawnEvery[i]!)) continue;
    let living = 0;
    for (let j = 0; j < world.count; j++) {
      if (world.alive[j] === 1 && world.team[j] === TEAM_ALLY && world.kind[j] === KIND_UNIT && world.sourceUid[j] === world.sourceUid[i] && world.label[j] === stats.unit) {
        living += 1;
      }
    }
    if (living >= world.respawnCount[i]!) continue;
    if (world.playerUnits >= BATTLE.playerUnitCap) {
      world.capped += 1;
      continue;
    }
    const o = spawnOffset(living);
    const id = addUnit(world, stats, TEAM_ALLY, world.homeX[i]! + o.dx, world.homeY[i]! + o.dy, world.homeX[i]!, world.homeY[i]!, world.sourceUid[i]!);
    if (id < 0) world.capped += 1;
    else world.playerUnits += 1;
  }
};

/** Vòng Triệu Hồi (§6.10): mỗi `summonEvery` tick triệu hồi 1 lính tại ô, tối đa `summonMax` mỗi trận. */
export const summonPhase = (world: BattleWorld): void => {
  for (let i = 0; i < world.count; i++) {
    const stats = world.summonStats[i] ?? null;
    if (world.alive[i] === 0 || stats === null || !dueAt(world, world.summonEvery[i]!)) continue;
    if (world.summonDone[i]! >= world.summonMax[i]!) continue;
    if (world.playerUnits >= BATTLE.playerUnitCap) {
      world.capped += 1;
      continue;
    }
    const o = spawnOffset(world.summonDone[i]!);
    const id = addUnit(world, stats, TEAM_ALLY, world.homeX[i]! + o.dx, world.homeY[i]! + o.dy, world.homeX[i]!, world.homeY[i]!, world.sourceUid[i]!);
    world.summonDone[i] = world.summonDone[i]! + 1;
    if (id < 0) world.capped += 1;
    else world.playerUnits += 1;
  }
};
