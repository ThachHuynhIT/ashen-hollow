/**
 * Chọn mục tiêu (spec §8.3–8.4, §8.9 bước 4). Duyệt tuyến tính theo id tăng dần; mọi hoà
 * phân xử bằng id nhỏ hơn (so sánh chặt `<` khi duyệt tăng dần). Không dùng Rng.
 */
import { BATTLE } from '../../data/battle';
import {
  KIND_UNIT,
  TARGET_CLOSEST_TO_THRONE,
  TARGET_HIGHEST_HP,
  TARGET_LOWEST_HP,
  TEAM_ALLY,
  TEAM_FOE,
  type BattleWorld,
} from './world';

/** Khoảng cách tâm − rA − rB (âm nếu chồng nhau). */
export const edgeDistance = (world: BattleWorld, a: number, b: number): number => {
  const dx = world.x[b]! - world.x[a]!;
  const dy = world.y[b]! - world.y[a]!;
  return Math.sqrt(dx * dx + dy * dy) - world.radius[a]! - world.radius[b]!;
};

/** `minRange ≤ edgeDistance ≤ range` của người đánh. */
export const inRange = (world: BattleWorld, attacker: number, victim: number): boolean => {
  const d = edgeDistance(world, attacker, victim);
  return d <= world.range[attacker]! && d >= world.minRange[attacker]!;
};

/** Cuồng Nộ (§8.8): từ rageTick trở đi. */
export const isRage = (world: BattleWorld): boolean => world.tick >= BATTLE.rageTick;

/** Lính phe mình: địch còn sống gần nhất (so bình phương khoảng cách tâm), −1 nếu không còn. */
const nearestFoe = (w: BattleWorld, self: number): number => {
  const sx = w.x[self]!;
  const sy = w.y[self]!;
  let best = -1;
  let bestD = 0;
  for (let j = 0; j < w.count; j++) {
    if (w.alive[j] === 0 || w.team[j] !== TEAM_FOE) continue;
    const dx = w.x[j]! - sx;
    const dy = w.y[j]! - sy;
    const d = dx * dx + dy * dy;
    if (best < 0 || d < bestD) {
      best = j;
      bestD = d;
    }
  }
  return best;
};

/**
 * Địch (không Cuồng Nộ): thực thể phe mình còn sống gần nhất có khoảng cách mép ≤ enemyAggro
 * (siege: chỉ công trình/Ngai, trong siegeAggro), so theo khoảng cách mép vì bán kính công
 * trình khác lính; không có → Ngai (−1 nếu Ngai đã chết).
 */
const foeTarget = (w: BattleWorld, self: number): number => {
  const siege = w.siege[self] === 1;
  const limit = siege ? BATTLE.siegeAggro : BATTLE.enemyAggro;
  const sx = w.x[self]!;
  const sy = w.y[self]!;
  const sr = w.radius[self]!;
  let best = -1;
  let bestD = 0;
  for (let j = 0; j < w.count; j++) {
    if (w.alive[j] === 0 || w.team[j] !== TEAM_ALLY) continue;
    if (siege && w.kind[j] === KIND_UNIT) continue;
    const dx = w.x[j]! - sx;
    const dy = w.y[j]! - sy;
    const reach = limit + sr + w.radius[j]!;
    const d2 = dx * dx + dy * dy;
    if (d2 > reach * reach) continue; // sqrt chỉ cho ứng viên trong tầm aggro
    const d = Math.sqrt(d2) - sr - w.radius[j]!;
    if (best < 0 || d < bestD) {
      best = j;
      bestD = d;
    }
  }
  if (best >= 0) return best;
  return w.alive[w.throneId] === 1 ? w.throneId : -1;
};

/**
 * §8.4 cho mọi lính còn sống theo id tăng dần. Chọn lại khi `tick % retargetTicks = 0`, khi
 * chưa có mục tiêu hoặc mục tiêu đã chết. Địch khi Cuồng Nộ luôn nhắm Ngai.
 */
export const retarget = (world: BattleWorld): void => {
  const rage = isRage(world);
  const periodic = world.tick % BATTLE.retargetTicks === 0;
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] === 0 || world.kind[i] !== KIND_UNIT) continue;
    const foe = world.team[i] === TEAM_FOE;
    if (foe && rage) {
      world.target[i] = world.alive[world.throneId] === 1 ? world.throneId : -1;
      continue;
    }
    const t = world.target[i]!;
    if (!periodic && t >= 0 && world.alive[t] === 1) continue;
    world.target[i] = foe ? foeTarget(world, i) : nearestFoe(world, i);
  }
};

/**
 * Mục tiêu bắn của tháp/Ngai (hoặc bất kỳ thực thể đánh được) theo `targeting`, trong số địch
 * còn sống trong tầm; hoà → id nhỏ. −1 nếu người bắn đã chết, không có đòn (interval 0) hoặc
 * không có địch trong tầm.
 */
export const pickShotTarget = (world: BattleWorld, shooter: number): number => {
  if (world.alive[shooter] === 0 || world.interval[shooter]! <= 0) return -1;
  const mode = world.targeting[shooter]!;
  const team = world.team[shooter]!;
  const tx = world.x[world.throneId]!;
  const ty = world.y[world.throneId]!;
  const sx = world.x[shooter]!;
  const sy = world.y[shooter]!;
  let best = -1;
  let bestScore = 0;
  for (let j = 0; j < world.count; j++) {
    if (world.alive[j] === 0 || world.team[j] === team) continue;
    if (!inRange(world, shooter, j)) continue;
    let score: number;
    if (mode === TARGET_CLOSEST_TO_THRONE) {
      const dx = world.x[j]! - tx;
      const dy = world.y[j]! - ty;
      score = dx * dx + dy * dy;
    } else if (mode === TARGET_LOWEST_HP) {
      score = world.hp[j]!;
    } else if (mode === TARGET_HIGHEST_HP) {
      score = -world.hp[j]!;
    } else {
      const dx = world.x[j]! - sx;
      const dy = world.y[j]! - sy;
      score = dx * dx + dy * dy;
    }
    if (best < 0 || score < bestScore) {
      best = j;
      bestScore = score;
    }
  }
  return best;
};
