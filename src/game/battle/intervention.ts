/**
 * Can thiệp hoàng gia — Đá Tảng Hoàng Gia (spec §7.4, §8.9 bước 2). Lệnh hợp lệ lên lịch một
 * tảng đá rơi sau `delayTicks`; khi rơi, mọi địch còn sống có tâm trong `radius` nhận sát
 * thương phép (bỏ qua giáp) qua hàng đợi bước 8 và bị đẩy lùi ra xa tâm. Không gây hại phe
 * mình. Không dùng Rng; địch duyệt theo id tăng dần, tảng đá theo thứ tự thả.
 */
import { BATTLE, INTERVENTION } from '../../data/battle';
import { queueDamage } from './combat';
import type { AutoFireInput, BattleInput } from './types';
import { DMG_MAGIC, KIND_UNIT, TEAM_FOE, type BattleWorld, type Boulder } from './world';

/** sourceUid / sourceId của sát thương tảng đá (không phải công trình, không phải thực thể). */
export const BOULDER_SOURCE = -2;

/** Dưới khoảng cách này địch coi như trùng tâm và bị đẩy theo trục cố định (1, 0). */
const COINCIDENT = 1e-3;

/** Sát thương tảng đá năm `year`: dmgBase + dmgPerYear × (year − 1). */
export const boulderDamage = (year: number): number =>
  INTERVENTION.dmgBase + INTERVENTION.dmgPerYear * (year - 1);

/** Lên lịch một tảng đá (đã kiểm hợp lệ) và đặt hồi chiêu; dùng chung cho thả tay và tự bắn. */
const scheduleBoulder = (world: BattleWorld, tick: number, x: number, y: number): void => {
  world.boulders.push({ x, y, dropTick: tick, impactTick: tick + INTERVENTION.delayTicks });
  world.readyTick = tick + INTERVENTION.cooldownTicks;
  world.interventionsUsed += 1;
  world.events.push({ type: 'boulder', phase: 'drop', x, y });
};

/**
 * Thử thả tảng đá. Hợp lệ khi `input.tick === world.tick`, x/y hữu hạn trong [0, field],
 * `tick ≥ firstReadyTick` và `tick ≥ readyTick` (trận chưa kết thúc). Hợp lệ → lên lịch tảng
 * đá, `readyTick = tick + cooldownTicks`, `interventionsUsed++`, ghi vào `inputs`, sự kiện
 * `boulder drop`. Không hợp lệ → không đổi gì, trả false.
 */
export const tryIntervene = (world: BattleWorld, input: BattleInput): boolean => {
  const { tick, x, y } = input;
  if (world.ended || tick !== world.tick) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < 0 || x > BATTLE.field || y < 0 || y > BATTLE.field) return false;
  if (tick < INTERVENTION.firstReadyTick || tick < world.readyTick) return false;
  scheduleBoulder(world, tick, x, y);
  world.inputs.push({ tick, x, y });
  return true;
};

/** Bật/tắt tự bắn ở tick hiện tại; ghi vào `inputs`. Sai tick hoặc trận đã kết thúc → false. */
export const setAutoFire = (world: BattleWorld, input: AutoFireInput): boolean => {
  if (world.ended || input.tick !== world.tick) return false;
  world.autoFire = input.auto;
  world.inputs.push({ tick: input.tick, auto: input.auto });
  return true;
};

/**
 * Điểm rơi tự động: tâm của một địch sống (duyệt theo id tăng dần) có nhiều địch nhất trong
 * `world.boulderRadius` (kể cả chính nó); chỉ thay khi điểm lớn hơn hẳn nên hòa → id nhỏ nhất.
 * Kẹp vào [0, field]. Không có địch sống → null.
 */
export const pickAutoTarget = (world: BattleWorld): { x: number; y: number } | null => {
  const foes: number[] = [];
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] === 1 && world.team[i] === TEAM_FOE && world.kind[i] === KIND_UNIT) {
      foes.push(i);
    }
  }
  const r2 = world.boulderRadius * world.boulderRadius;
  let best = -1;
  let bestCount = 0;
  for (const a of foes) {
    let count = 0;
    for (const b of foes) {
      const dx = world.x[a]! - world.x[b]!;
      const dy = world.y[a]! - world.y[b]!;
      if (dx * dx + dy * dy <= r2) count += 1;
    }
    if (count > bestCount) {
      best = a;
      bestCount = count;
    }
  }
  if (best < 0) return null;
  return {
    x: Math.min(Math.max(world.x[best]!, 0), BATTLE.field),
    y: Math.min(Math.max(world.y[best]!, 0), BATTLE.field),
  };
};

/**
 * Bước 2, sau các lệnh tay của tick: nếu tự bắn đang bật, đã tới `firstReadyTick` và hết hồi
 * chiêu thì thả đá vào `pickAutoTarget`. Không địch sống → không thả, không tốn hồi chiêu.
 * Lần thả này không ghi vào `inputs` (suy ra lại khi phát lại).
 */
export const autoFirePhase = (world: BattleWorld): void => {
  if (world.ended || !world.autoFire) return;
  const tick = world.tick;
  if (tick < INTERVENTION.firstReadyTick || tick < world.readyTick) return;
  const target = pickAutoTarget(world);
  if (target === null) return;
  scheduleBoulder(world, tick, target.x, target.y);
};

const impact = (world: BattleWorld, bx: number, by: number): void => {
  world.events.push({ type: 'boulder', phase: 'impact', x: bx, y: by });
  const dmg = boulderDamage(world.setup.year);
  const r2 = world.boulderRadius * world.boulderRadius;
  const perTick = INTERVENTION.knockback / BATTLE.knockbackTicks;
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] === 0 || world.team[i] !== TEAM_FOE || world.kind[i] !== KIND_UNIT) continue;
    let dx = world.x[i]! - bx;
    let dy = world.y[i]! - by;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    const d = Math.sqrt(d2);
    if (d < COINCIDENT) {
      dx = 1;
      dy = 0;
    } else {
      dx /= d;
      dy /= d;
    }
    queueDamage(world, i, dmg, DMG_MAGIC, BOULDER_SOURCE, undefined, BOULDER_SOURCE);
    world.kbX[i] = dx * perTick;
    world.kbY[i] = dy * perTick;
    world.kbTicks[i] = BATTLE.knockbackTicks;
  }
};

/** Bước 2 (sau các lệnh): tảng đá có `impactTick ≤ tick` rơi theo thứ tự thả rồi bị bỏ khỏi danh sách. */
export const boulderPhase = (world: BattleWorld): void => {
  if (world.boulders.length === 0) return;
  const pending: Boulder[] = [];
  for (const b of world.boulders) {
    if (b.impactTick <= world.tick) impact(world, b.x, b.y);
    else pending.push(b);
  }
  world.boulders = pending;
};
