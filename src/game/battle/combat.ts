/**
 * Chiến đấu (spec §8.3, §8.5–8.6, §8.9 bước 6–10): đánh tạo sự kiện sát thương hoặc đạn,
 * đạn bay bám mục tiêu, áp sát thương theo thứ tự (id nguồn, id mục tiêu, thứ tự tạo), chậm,
 * rồi xử lý chết theo id tăng dần. Không dùng Rng; mọi lựa chọn hoà theo id.
 */
import { BATTLE } from '../../data/battle';
import type { DamageType } from '../../data/types';
import { edgeDistance, inRange, pickShotTarget } from './targeting';
import {
  DMG_FIRE,
  DMG_MAGIC,
  KIND_UNIT,
  TEAM_ALLY,
  TEAM_FOE,
  type BattleWorld,
  type QueuedDamage,
} from './world';

/** Đòn phụ của cleave nhận 50% (§8.5). */
const CLEAVE_SECONDARY = 0.5;

/** Sát thương sau giáp (§8.5): vật lý `raw × (1 − giáp)`, lửa `raw × (1 − giáp/2)`, phép `raw`. */
export const mitigate = (raw: number, type: DamageType, armor: number): number => {
  if (type === 'magic') return raw;
  if (type === 'fire') return raw * (1 - armor / 2);
  return raw * (1 - armor);
};

const mitigateCode = (raw: number, code: number, armor: number): number => {
  if (code === DMG_MAGIC) return raw;
  if (code === DMG_FIRE) return raw * (1 - armor / 2);
  return raw * (1 - armor);
};

/**
 * Xếp một đòn chờ áp ở bước 8. `type` là mã DMG_*; `sourceId` là id thực thể gây đòn (−1 nếu
 * không có, ví dụ can thiệp) — khoá sắp xếp đầu tiên khi áp.
 */
export const queueDamage = (
  world: BattleWorld,
  victim: number,
  raw: number,
  type: number,
  sourceUid: number,
  slow?: { pct: number; ticks: number },
  sourceId = -1,
): void => {
  world.damageQueue.push({
    victim,
    raw,
    type,
    sourceUid,
    slowPct: slow?.pct ?? 0,
    slowTicks: slow?.ticks ?? 0,
    sourceId,
  });
};

const queueHit = (w: BattleWorld, attacker: number, victim: number, raw: number): void => {
  queueDamage(
    w,
    victim,
    raw,
    w.dmgType[attacker]!,
    w.sourceUid[attacker]!,
    { pct: w.onHitSlowPct[attacker]!, ticks: w.onHitSlowTicks[attacker]! },
    attacker,
  );
};

/** Đòn trúng ngay: mục tiêu chính 100%, rồi `cleave − 1` địch khác trong tầm gần nhất 50%. */
const strikeInstant = (w: BattleWorld, attacker: number, victim: number): void => {
  queueHit(w, attacker, victim, w.dmg[attacker]!);
  const extra = w.cleave[attacker]! - 1;
  if (extra < 1) return;
  const team = w.team[attacker]!;
  const others: { id: number; d: number }[] = [];
  for (let j = 0; j < w.count; j++) {
    if (j === victim || w.alive[j] === 0 || w.team[j] === team) continue;
    if (!inRange(w, attacker, j)) continue;
    others.push({ id: j, d: edgeDistance(w, attacker, j) });
  }
  others.sort((a, b) => a.d - b.d || a.id - b.id);
  const n = Math.min(extra, others.length);
  for (let k = 0; k < n; k++) {
    queueHit(w, attacker, others[k]!.id, w.dmg[attacker]! * CLEAVE_SECONDARY);
  }
};

/** Bắn đạn từ tâm người bắn; pool đầy → trúng ngay (§8.5). */
const fire = (w: BattleWorld, attacker: number, victim: number): void => {
  if (w.projSpeed[attacker]! <= 0 || w.projectileCount >= BATTLE.projectileCap) {
    strikeInstant(w, attacker, victim);
    return;
  }
  const p = w.projectiles;
  const k = w.projectileCount;
  w.projectileCount += 1;
  p.px[k] = w.x[attacker]!;
  p.py[k] = w.y[attacker]!;
  p.speed[k] = w.projSpeed[attacker]!;
  p.dmg[k] = w.dmg[attacker]!;
  p.dmgType[k] = w.dmgType[attacker]!;
  p.slowPct[k] = w.onHitSlowPct[attacker]!;
  p.slowTicks[k] = w.onHitSlowTicks[attacker]!;
  p.targetId[k] = victim;
  p.sourceId[k] = attacker;
  p.sourceUid[k] = w.sourceUid[attacker]!;
  p.alive[k] = 1;
};

/**
 * Bước 6 (Quyết định 7): mỗi thực thể còn sống có đòn (interval > 0), id tăng dần:
 * `cooldown = max(cooldown − 1, 0)`; khi = 0 và có mục tiêu trong tầm thì đánh và
 * `cooldown += interval`. Lính đánh `target` của mình; công trình/Ngai chọn bằng pickShotTarget.
 */
export const attackPhase = (world: BattleWorld): void => {
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] === 0 || world.interval[i]! <= 0) continue;
    const cd = Math.max(world.cooldown[i]! - 1, 0);
    world.cooldown[i] = cd;
    if (cd > 0) continue;
    let t: number;
    if (world.kind[i] === KIND_UNIT) {
      t = world.target[i]!;
      if (t < 0 || world.alive[t] === 0 || world.team[t] === world.team[i]) continue;
      if (!inRange(world, i, t)) continue;
    } else {
      t = pickShotTarget(world, i);
      if (t < 0) continue;
    }
    fire(world, i, t);
    world.cooldown[i] = cd + world.interval[i]!;
  }
};

/**
 * Bước 7: mỗi đạn còn bay (theo thứ tự tạo) tiến `speed` px tới vị trí hiện tại của mục tiêu;
 * tới nơi (khoảng cách tâm ≤ speed) thì xếp sát thương. Mục tiêu đã chết → đạn biến mất. Cuối
 * bước dồn pool để ô 0..projectileCount−1 là đạn còn bay theo thứ tự tạo.
 */
export const projectilePhase = (world: BattleWorld): void => {
  const p = world.projectiles;
  const n = world.projectileCount;
  for (let k = 0; k < n; k++) {
    if (p.alive[k] === 0) continue;
    const t = p.targetId[k]!;
    if (world.alive[t] === 0) {
      p.alive[k] = 0;
      continue;
    }
    const dx = world.x[t]! - p.px[k]!;
    const dy = world.y[t]! - p.py[k]!;
    const d = Math.sqrt(dx * dx + dy * dy);
    const s = p.speed[k]!;
    if (d <= s) {
      p.px[k] = world.x[t]!;
      p.py[k] = world.y[t]!;
      p.alive[k] = 0;
      queueDamage(
        world,
        t,
        p.dmg[k]!,
        p.dmgType[k]!,
        p.sourceUid[k]!,
        { pct: p.slowPct[k]!, ticks: p.slowTicks[k]! },
        p.sourceId[k]!,
      );
      continue;
    }
    p.px[k] = p.px[k]! + (dx / d) * s;
    p.py[k] = p.py[k]! + (dy / d) * s;
  }

  let m = 0;
  for (let k = 0; k < n; k++) {
    if (p.alive[k] === 0) continue;
    if (m !== k) {
      p.px[m] = p.px[k]!;
      p.py[m] = p.py[k]!;
      p.speed[m] = p.speed[k]!;
      p.dmg[m] = p.dmg[k]!;
      p.slowPct[m] = p.slowPct[k]!;
      p.slowTicks[m] = p.slowTicks[k]!;
      p.targetId[m] = p.targetId[k]!;
      p.sourceId[m] = p.sourceId[k]!;
      p.sourceUid[m] = p.sourceUid[k]!;
      p.dmgType[m] = p.dmgType[k]!;
      p.alive[m] = 1;
      p.alive[k] = 0;
    }
    m += 1;
  }
  world.projectileCount = m;
};

/** Chậm (§8.6): lấy mạnh nhất, làm mới thời gian, tối đa maxSlowPct. */
const applySlow = (w: BattleWorld, id: number, pct: number, ticks: number): void => {
  if (pct <= 0 || ticks <= 0) return;
  w.slowPct[id] = Math.min(Math.max(w.slowPct[id]!, pct), BATTLE.maxSlowPct);
  w.slowTicks[id] = Math.max(w.slowTicks[id]!, ticks);
};

/**
 * Bước 8: áp hàng đợi theo (id nguồn, id mục tiêu, thứ tự tạo). Mục tiêu đã chết (alive 0 hoặc
 * HP ≤ 0 từ đòn trước trong tick) bỏ qua. Đòn đưa HP về ≤ 0 ghi `killerUid`; còn sống thì
 * nhận `onHit` chậm.
 */
export const applyDamagePhase = (world: BattleWorld): void => {
  const queue = world.damageQueue;
  world.damageQueue = [];
  const order = queue.map((_, i) => i);
  order.sort((a, b) => {
    const qa = queue[a]!;
    const qb = queue[b]!;
    return qa.sourceId - qb.sourceId || qa.victim - qb.victim || a - b;
  });
  for (const i of order) {
    const q: QueuedDamage = queue[i]!;
    const v = q.victim;
    if (world.alive[v] === 0 || world.hp[v]! <= 0) continue;
    const dmg = Math.max(0, mitigateCode(q.raw, q.type, world.armor[v]!));
    world.hp[v] = world.hp[v]! - dmg;
    world.events.push({ type: 'hit', id: v, dmg });
    if (world.hp[v]! <= 0) world.killerUid[v] = q.sourceUid;
    else applySlow(world, v, q.slowPct, q.slowTicks);
  }
};

/** Bước 9: chậm hết hạn sau `slowTicks` tick. (Bỏng/độc/hồi máu chưa có ở G1.) */
export const statusPhase = (world: BattleWorld): void => {
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] === 0 || world.slowTicks[i]! <= 0) continue;
    world.slowTicks[i] = world.slowTicks[i]! - 1;
    if (world.slowTicks[i] === 0) world.slowPct[i] = 0;
  }
};

/**
 * Bước 10, id tăng dần: thực thể còn sống có HP ≤ 0 chết (`alive = 0`, sự kiện `death`). Địch
 * chết → `kills`, và `killsBySource[killerUid]` nếu nguồn là công trình phe mình (uid ≥ 0);
 * lính phe mình chết → `unitsLost`.
 */
export const deathPhase = (world: BattleWorld): void => {
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] === 0 || world.hp[i]! > 0) continue;
    world.alive[i] = 0;
    world.events.push({ type: 'death', id: i });
    if (world.team[i] === TEAM_FOE) {
      world.kills += 1;
      const uid = world.killerUid[i]!;
      if (uid >= 0) world.killsBySource[uid] = (world.killsBySource[uid] ?? 0) + 1;
    } else if (world.team[i] === TEAM_ALLY && world.kind[i] === KIND_UNIT) {
      world.unitsLost += 1;
    }
  }
};
