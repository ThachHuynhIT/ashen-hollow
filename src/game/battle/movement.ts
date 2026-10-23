/**
 * Di chuyển (spec §8.9 bước 5, §8.11): ghi prevX/prevY = vị trí đầu tick; mỗi lính còn sống
 * đi thẳng về mục tiêu (dừng đúng ở khoảng cách mép = range, không vượt) hoặc về điểm nhà khi
 * rảnh — hướng tính từ vị trí đầu tick; rồi separation từ ảnh chụp vị trí, áp cùng lúc; rồi
 * đẩy lùi đang chạy; rồi kẹp biên. Công trình/Ngai không bao giờ di chuyển.
 */
import { BATTLE } from '../../data/battle';
import { separationPush } from './steering';
import { edgeDistance, isRage } from './targeting';
import { KIND_UNIT, TEAM_FOE, type BattleWorld } from './world';

/** Rảnh và cách nhà < SNAP px → đặt đúng vào nhà (không rung). */
const SNAP = 0.5;
const RAGE_MULT = 1 + BATTLE.rageSpeedPct / 100;

// Bộ đệm dùng chung cho separation (mô phỏng đồng bộ, không giữ trạng thái giữa các lần gọi).
const ids = new Int32Array(BATTLE.entityCap);
const sx = new Float64Array(BATTLE.entityCap);
const sy = new Float64Array(BATTLE.entityCap);
const sr = new Float64Array(BATTLE.entityCap);
const sFixed = new Uint8Array(BATTLE.entityCap);
const sFlying = new Uint8Array(BATTLE.entityCap);
const sTeam = new Uint8Array(BATTLE.entityCap);
const sAnchored = new Uint8Array(BATTLE.entityCap);
/** Theo id: 1 nếu lính đang trong tầm mục tiêu ở bước đi vừa rồi (đứng yên đánh). */
const engaged = new Uint8Array(BATTLE.entityCap);
const outX = new Float64Array(BATTLE.entityCap);
const outY = new Float64Array(BATTLE.entityCap);

/** Bước đi mong muốn của lính `i`, tính từ prevX/prevY (vị trí đầu tick của mọi thực thể). */
const steer = (w: BattleWorld, i: number, rage: boolean): void => {
  if (w.stunTicks[i]! > 0) return; // choáng: đứng yên (§8.6)
  let step = w.speed[i]! * (1 - w.slowPct[i]! / 100);
  if (rage && w.team[i] === TEAM_FOE) step *= RAGE_MULT;
  const px = w.prevX[i]!;
  const py = w.prevY[i]!;
  const t = w.target[i]!;
  if (t >= 0 && w.alive[t] === 1) {
    const dx = w.prevX[t]! - px;
    const dy = w.prevY[t]! - py;
    const d = Math.sqrt(dx * dx + dy * dy);
    // Kite (§8.4): địch quá gần trong lúc hồi đòn thì lùi thẳng ra xa nó.
    if (w.kiteDist[i]! > 0 && w.cooldown[i]! > 0 && d > 0 && edgeDistance(w, i, t) < w.kiteDist[i]!) {
      if (step > 0) {
        w.x[i] = px - (dx / d) * step;
        w.y[i] = py - (dy / d) * step;
      }
      return;
    }
    const gap = d - w.radius[i]! - w.radius[t]! - w.range[i]!;
    if (gap <= 0) engaged[i] = 1;
    if (gap <= 0 || step <= 0) return; // đã trong tầm (d > 0 khi gap > 0)
    const len = Math.min(step, gap);
    w.x[i] = px + (dx / d) * len;
    w.y[i] = py + (dy / d) * len;
    return;
  }
  const dx = w.homeX[i]! - px;
  const dy = w.homeY[i]! - py;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < SNAP || (step > 0 && d <= step)) {
    w.x[i] = w.homeX[i]!;
    w.y[i] = w.homeY[i]!;
    return;
  }
  if (step <= 0) return;
  w.x[i] = px + (dx / d) * step;
  w.y[i] = py + (dy / d) * step;
};

export const moveEntities = (world: BattleWorld): void => {
  const n = world.count;
  world.prevX.set(world.x.subarray(0, n));
  world.prevY.set(world.y.subarray(0, n));

  const rage = isRage(world);
  engaged.fill(0, 0, n);
  for (let i = 0; i < n; i++) {
    if (world.alive[i] === 1 && world.kind[i] === KIND_UNIT) steer(world, i, rage);
  }

  // Separation từ ảnh chụp vị trí sau bước đi, chỉ thực thể còn sống (theo id tăng dần).
  let m = 0;
  for (let i = 0; i < n; i++) {
    if (world.alive[i] === 0) continue;
    ids[m] = i;
    sx[m] = world.x[i]!;
    sy[m] = world.y[i]!;
    sr[m] = world.radius[i]!;
    sFixed[m] = world.kind[i] === KIND_UNIT ? 0 : 1;
    sFlying[m] = world.flying[i]!;
    sTeam[m] = world.team[i]!;
    sAnchored[m] = engaged[i]!;
    m += 1;
  }
  separationPush(
    {
      count: m,
      x: sx,
      y: sy,
      radius: sr,
      fixed: sFixed,
      flying: sFlying,
      team: sTeam,
      anchored: sAnchored,
    },
    BATTLE.separationPushMax,
    outX,
    outY,
    BATTLE.separationPushCross,
  );

  const lo = -BATTLE.fieldClampMargin;
  const hi = BATTLE.field + BATTLE.fieldClampMargin;
  for (let k = 0; k < m; k++) {
    const i = ids[k]!;
    if (world.kind[i] !== KIND_UNIT) continue; // công trình không bao giờ bị đẩy
    let x = world.x[i]! + outX[k]!;
    let y = world.y[i]! + outY[k]!;
    if (world.kbTicks[i]! > 0) {
      x += world.kbX[i]!;
      y += world.kbY[i]!;
      world.kbTicks[i] = world.kbTicks[i]! - 1;
      if (world.kbTicks[i] === 0) {
        world.kbX[i] = 0;
        world.kbY[i] = 0;
      }
    }
    world.x[i] = Math.min(hi, Math.max(lo, x));
    world.y[i] = Math.min(hi, Math.max(lo, y));
  }
};
