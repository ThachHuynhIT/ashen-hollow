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
  addUnit,
  spawnOffset,
  type BattleWorld,
  type QueuedDamage,
} from './world';

/** Đòn phụ của cleave và của splash nhận 50% (§8.5). */
const CLEAVE_SECONDARY = 0.5;
const SPLASH_SECONDARY = 0.5;

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
  stunTicks = 0,
): void => {
  world.damageQueue.push({
    victim,
    raw,
    type,
    sourceUid,
    slowPct: slow?.pct ?? 0,
    slowTicks: slow?.ticks ?? 0,
    sourceId,
    stunTicks,
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

/**
 * Hệ số của đòn tăng dần (`rampPct`, §6.4 Tháp Pha Lê): đòn đầu vào mục tiêu mới nhân 1, mỗi đòn
 * liên tiếp vào cùng mục tiêu cộng `rampPct`%, tối đa `rampCap`%. Đổi mục tiêu (hoặc mục tiêu
 * chết, id không tái dùng) thì đếm lại. Ghi nhớ mục tiêu và số đòn vào thế giới.
 */
const rampMultiplier = (w: BattleWorld, attacker: number, victim: number): number => {
  const pct = w.rampPct[attacker]!;
  if (pct <= 0) return 1;
  const cap = w.rampCap[attacker]!;
  const stacks =
    w.rampTarget[attacker] === victim
      ? Math.min(w.rampStacks[attacker]! + 1, Math.floor(cap / pct))
      : 0;
  w.rampTarget[attacker] = victim;
  w.rampStacks[attacker] = stacks;
  return 1 + Math.min(stacks * pct, cap) / 100;
};

/** Mọi thực thể sống khác phe `attacker` có tâm cách (cx, cy) tối đa `radius`, theo id tăng dần. */
const foesNear = (
  w: BattleWorld,
  attacker: number,
  cx: number,
  cy: number,
  radius: number,
  skip: readonly number[],
): number[] => {
  const out: number[] = [];
  const r2 = radius * radius;
  for (let j = 0; j < w.count; j++) {
    if (w.alive[j] === 0 || w.team[j] === w.team[attacker] || skip.includes(j)) continue;
    const dx = w.x[j]! - cx;
    const dy = w.y[j]! - cy;
    if (dx * dx + dy * dy <= r2) out.push(j);
  }
  return out;
};

/** Splash: địch khác trong `splash` quanh (cx, cy) nhận 50% (không gồm `skip`). */
const splashAround = (
  w: BattleWorld,
  attacker: number,
  cx: number,
  cy: number,
  skip: readonly number[],
  raw: number,
): void => {
  if (w.splash[attacker]! <= 0) return;
  for (const j of foesNear(w, attacker, cx, cy, w.splash[attacker]!, skip)) {
    queueDamage(w, j, raw * SPLASH_SECONDARY, w.dmgType[attacker]!, w.sourceUid[attacker]!, undefined, attacker);
  }
};

/** Chain: nhảy `count` lần sang địch gần nhất chưa trúng trong `radius`, mỗi lần × falloff (hòa → id nhỏ). */
const chainFrom = (w: BattleWorld, attacker: number, victim: number, raw: number): void => {
  const jumps = w.chainCount[attacker]!;
  if (jumps <= 0) return;
  const hit = [victim];
  let from = victim;
  let dmg = raw;
  for (let k = 0; k < jumps; k++) {
    const cx = w.x[from]!;
    const cy = w.y[from]!;
    let best = -1;
    let bestD2 = Infinity;
    for (const j of foesNear(w, attacker, cx, cy, w.chainRadius[attacker]!, hit)) {
      const dx = w.x[j]! - cx;
      const dy = w.y[j]! - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        best = j;
        bestD2 = d2;
      }
    }
    if (best < 0) return;
    dmg *= w.chainFalloff[attacker]!;
    queueDamage(w, best, dmg, w.dmgType[attacker]!, w.sourceUid[attacker]!, undefined, attacker);
    hit.push(best);
    from = best;
  }
};

/**
 * Một đòn đã trúng `victim`: sát thương chính (nhân hệ số tăng dần) kèm làm chậm, rồi splash
 * quanh mục tiêu và chain sang địch kế tiếp.
 */
const landStrike = (
  w: BattleWorld,
  attacker: number,
  victim: number,
  base: number,
  slow: { pct: number; ticks: number },
): void => {
  const raw = base * rampMultiplier(w, attacker, victim);
  queueDamage(
    w,
    victim,
    raw,
    w.dmgType[attacker]!,
    w.sourceUid[attacker]!,
    slow,
    attacker,
    w.onHitStunTicks[attacker]!,
  );
  splashAround(w, attacker, w.x[victim]!, w.y[victim]!, [victim], raw);
  chainFrom(w, attacker, victim, raw);
};

/** Đòn trúng ngay: mục tiêu chính 100%, rồi `cleave − 1` địch khác trong tầm gần nhất 50%. */
const strikeInstant = (w: BattleWorld, attacker: number, victim: number): void => {
  landStrike(w, attacker, victim, w.dmg[attacker]!, {
    pct: w.onHitSlowPct[attacker]!,
    ticks: w.onHitSlowTicks[attacker]!,
  });
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
    if (cd > 0 || world.stunTicks[i]! > 0) continue; // choáng: không đánh, cooldown vẫn giảm (§8.6)
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
      // Mục tiêu chết trước khi trúng: đạn rơi tại chỗ nó đứng, splash vẫn nổ (§8.5).
      splashAround(world, p.sourceId[k]!, world.x[t]!, world.y[t]!, [t], p.dmg[k]!);
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
      landStrike(world, p.sourceId[k]!, t, p.dmg[k]!, { pct: p.slowPct[k]!, ticks: p.slowTicks[k]! });
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
    // Khiên hấp thụ trước HP, sau giáp (§8.5).
    const absorbed = Math.min(world.shield[v]!, dmg);
    world.shield[v] = world.shield[v]! - absorbed;
    world.hp[v] = world.hp[v]! - (dmg - absorbed);
    world.events.push({ type: 'hit', id: v, dmg });
    if (world.hp[v]! <= 0) world.killerUid[v] = q.sourceUid;
    else {
      applySlow(world, v, q.slowPct, q.slowTicks);
      // +1: step 9 of this very tick decrements it, so the victim stays locked `stunTicks` ticks after this one.
      if (q.stunTicks > 0) world.stunTicks[v] = Math.max(world.stunTicks[v]!, q.stunTicks + 1);
    }
  }
};

/** Bước 9: chậm hết hạn sau `slowTicks` tick. (Bỏng/độc/hồi máu chưa có ở G1.) */
export const statusPhase = (world: BattleWorld): void => {
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] === 0) continue;
    if (world.stunTicks[i]! > 0) world.stunTicks[i] = world.stunTicks[i]! - 1;
    if (world.slowTicks[i]! <= 0) continue;
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
  const parents: number[] = [];
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] === 0 || world.hp[i]! > 0) continue;
    world.alive[i] = 0;
    if (world.deathSpawn[i]) parents.push(i);
    world.events.push({ type: 'death', id: i });
    if (world.team[i] === TEAM_FOE) {
      world.kills += 1;
      const uid = world.killerUid[i]!;
      if (uid >= 0) world.killsBySource[uid] = (world.killsBySource[uid] ?? 0) + 1;
    } else if (world.team[i] === TEAM_ALLY && world.kind[i] === KIND_UNIT) {
      world.unitsLost += 1;
    }
  }
  // Đẻ khi chết (§8.9 bước 10): sau khi xử lý hết các ca chết, theo id cha tăng dần, nên con
  // không chết trong cùng tick. Phe mình bị trần playerUnitCap; hết entityCap thì bỏ phần thiếu.
  for (const i of parents) {
    const spawn = world.deathSpawn[i]!;
    const team = world.team[i]!;
    for (let k = 0; k < spawn.count; k++) {
      if (team === TEAM_ALLY && world.playerUnits >= BATTLE.playerUnitCap) {
        world.capped += 1;
        continue;
      }
      const o = spawnOffset(k);
      const id = addUnit(
        world,
        spawn.stats,
        team,
        world.x[i]! + o.dx,
        world.y[i]! + o.dy,
        world.homeX[i]!,
        world.homeY[i]!,
        world.sourceUid[i]!,
      );
      if (id < 0) {
        if (team === TEAM_ALLY) world.capped += 1;
        break;
      }
      if (team === TEAM_ALLY) world.playerUnits += 1;
    }
  }
};
