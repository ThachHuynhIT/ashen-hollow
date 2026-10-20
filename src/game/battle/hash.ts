/**
 * Băm trạng thái trận để kiểm tra deterministic (spec §13.2): FNV‑1a 32-bit trên các byte
 * của mọi mảng typed (thực thể 0..count−1, đạn 0..projectileCount−1), cộng count, tick và
 * projectileCount. Byte đọc qua view Uint32Array (Float64 = hai từ), nên −0 ≠ 0 và NaN được
 * băm theo bit.
 */
import type { BattleWorld } from './world';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const mixWord = (h: number, word: number): number => {
  let out = h;
  out = Math.imul(out ^ (word & 0xff), FNV_PRIME);
  out = Math.imul(out ^ ((word >>> 8) & 0xff), FNV_PRIME);
  out = Math.imul(out ^ ((word >>> 16) & 0xff), FNV_PRIME);
  out = Math.imul(out ^ ((word >>> 24) & 0xff), FNV_PRIME);
  return out;
};

const scratchF64 = new Float64Array(1);
const scratchWords = new Uint32Array(scratchF64.buffer);

/** Băm một số bất kỳ theo 64 bit của nó. */
const mixNum = (h: number, v: number): number => {
  scratchF64[0] = v;
  return mixWord(mixWord(h, scratchWords[0]!), scratchWords[1]!);
};

const mixF64 = (h: number, a: Float64Array, n: number): number => {
  const words = new Uint32Array(a.buffer, a.byteOffset, n * 2);
  let out = h;
  for (let i = 0; i < words.length; i++) out = mixWord(out, words[i]!);
  return out;
};

const mixI32 = (h: number, a: Int32Array, n: number): number => {
  const words = new Uint32Array(a.buffer, a.byteOffset, n);
  let out = h;
  for (let i = 0; i < words.length; i++) out = mixWord(out, words[i]!);
  return out;
};

const mixU8 = (h: number, a: Uint8Array, n: number): number => {
  let out = h;
  for (let i = 0; i < n; i++) out = Math.imul(out ^ a[i]!, FNV_PRIME);
  return out;
};

export const hashWorld = (world: BattleWorld): number => {
  const n = world.count;
  let h = FNV_OFFSET;
  h = mixWord(h, n);
  h = mixWord(h, world.tick);
  h = mixWord(h, world.projectileCount);
  for (const a of [
    world.x,
    world.y,
    world.prevX,
    world.prevY,
    world.hp,
    world.maxHp,
    world.dmg,
    world.range,
    world.minRange,
    world.interval,
    world.cooldown,
    world.speed,
    world.radius,
    world.armor,
    world.slowPct,
    world.projSpeed,
    world.cleave,
    world.onHitSlowPct,
    world.homeX,
    world.homeY,
    world.kbX,
    world.kbY,
  ]) {
    h = mixF64(h, a, n);
  }
  for (const a of [
    world.team,
    world.kind,
    world.alive,
    world.siege,
    world.target,
    world.slowTicks,
    world.onHitSlowTicks,
    world.sourceUid,
    world.kbTicks,
    world.targeting,
    world.killerUid,
  ]) {
    h = mixI32(h, a, n);
  }
  h = mixU8(h, world.dmgType, n);

  const p = world.projectiles;
  const m = world.projectileCount;
  for (const a of [p.px, p.py, p.speed, p.dmg, p.slowPct]) h = mixF64(h, a, m);
  for (const a of [p.slowTicks, p.targetId, p.sourceId, p.sourceUid]) h = mixI32(h, a, m);
  h = mixU8(h, p.dmgType, m);
  h = mixU8(h, p.alive, m);

  // Trạng thái ngoài mảng có ảnh hưởng mô phỏng (không băm label, thống kê kills, damageQueue).
  h = mixNum(h, world.readyTick);
  h = mixNum(h, world.spawnedWaves);
  h = mixNum(h, world.interventionsUsed);
  h = mixNum(h, world.playerUnits);
  h = mixWord(h, world.ended ? 1 : 0);
  h = mixWord(h, world.won ? 1 : 0);
  h = mixNum(h, world.endTick);
  h = mixWord(h, world.autoFire ? 1 : 0);
  h = mixNum(h, world.boulderRadius);
  h = mixWord(h, world.boulders.length);
  for (const b of world.boulders) {
    h = mixNum(h, b.x);
    h = mixNum(h, b.y);
    h = mixNum(h, b.dropTick);
    h = mixNum(h, b.impactTick);
  }
  return h >>> 0;
};
