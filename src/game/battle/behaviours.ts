/**
 * Hành vi đơn vị (spec §5.1, §8.4, §8.6, §8.9): chỉ số tăng tiến tính lại mỗi tick từ chỉ số gốc,
 * hiệu ứng trúng (hút máu, hồi đồng minh, bỏng, độc, đẩy, kéo) và sống lại. Không dùng Rng, không
 * lượng giác; duyệt theo id tăng dần, hoà → id nhỏ.
 */
import { BATTLE, STATUS } from '../../data/battle';
import { addDot, dotKey } from './statuses';
import { KIND_UNIT, TEAM_FOE, heal, type BattleWorld } from './world';

/**
 * Bước 3: với đơn vị có hành vi tăng tiến, đặt `dmg`, `interval`, `speed`, `maxHp` từ chỉ số gốc
 * và đồng hồ `t = tick / 10 + prewind` (giây) — tính lại hoàn toàn nên không nhân chồng. Các
 * phần trăm cùng loại (tăng dần, lớp, cuồng nộ, Hồn) cộng với nhau (§5.3).
 */
export function tickBehaviours(w: BattleWorld): void {
  for (let i = 0; i < w.count; i++) {
    if (w.alive[i] === 0 || w.tuned[i] === 0) continue;
    const secs = w.tick / 10 + w.prewind[i]!;
    const souls = w.souls[w.team[i] === TEAM_FOE ? TEAM_FOE : 0]!;
    const soulBonus = w.soulPct[i]! * souls;
    let dmgPct = soulBonus + Math.min(w.rampDmgPps[i]! * secs, w.rampDmgCap[i]!);
    if (w.team[i] === TEAM_FOE && w.bannerRampPps > 0) dmgPct += Math.min(w.bannerRampPps * secs, w.bannerRampCap);
    let speedPct = 0;
    if (w.stepEvery[i]! > 0) {
      const stacks = Math.min(Math.floor((w.tick + w.prewind[i]! * STATUS.everyTicks) / w.stepEvery[i]!), w.stepMax[i]!);
      dmgPct += stacks * w.stepDmgPct[i]!;
      speedPct += stacks * w.stepSpeedPct[i]!;
    }
    if (w.enrageDmgPct[i]! > 0 && w.hp[i]! * 100 < w.enrageBelow[i]! * w.maxHp[i]!) dmgPct += w.enrageDmgPct[i]!;
    const buff = w.tick < w.buffAsUntil[i]! ? w.buffAsPct[i]! : 0;
    const asPct = Math.min(w.rampAsPps[i]! * secs, w.rampAsCap[i]!) + buff;
    w.dmg[i] = w.baseDmg[i]! * (1 + dmgPct / 100);
    w.speed[i] = w.baseSpeed[i]! * (1 + speedPct / 100);
    if (w.baseInterval[i]! > 0) {
      w.interval[i] = Math.max(w.baseInterval[i]! / (1 + asPct / 100), w.baseInterval[i]! * STATUS.minIntervalFactor);
    }
    if (w.soulPct[i]! > 0) {
      const max = w.baseMaxHp[i]! * (1 + soulBonus / 100);
      if (max !== w.maxHp[i]) {
        w.hp[i] = w.hp[i]! + (max - w.maxHp[i]!); // phần máu tăng thêm được cấp luôn
        w.maxHp[i] = max;
      }
    }
  }
}

/** Dịch `victim` thẳng ra xa (sign 1) hoặc về phía (sign −1) `from`, chia đều trong `knockbackTicks`. */
const kick = (w: BattleWorld, victim: number, from: number, px: number, sign: 1 | -1): void => {
  if (w.kind[victim] !== KIND_UNIT || w.boss[victim] === 1 || px <= 0) return; // công trình và boss miễn
  const dx = w.x[victim]! - w.x[from]!;
  const dy = w.y[victim]! - w.y[from]!;
  const d = Math.sqrt(dx * dx + dy * dy);
  const ux = d > 0 ? dx / d : 1;
  const uy = d > 0 ? dy / d : 0;
  const per = (px / BATTLE.knockbackTicks) * sign;
  w.kbX[victim] = ux * per;
  w.kbY[victim] = uy * per;
  w.kbTicks[victim] = BATTLE.knockbackTicks;
};

/**
 * Bước 8, sau mỗi đòn của `source` lên `target` gây `dealt` sát thương (sau giáp): hút máu, hồi
 * đồng minh máu thấp nhất, bỏng, độc, đẩy lùi, kéo (mỗi `every` đòn).
 */
export function hitBehaviours(w: BattleWorld, source: number, target: number, dealt: number, knock = 0): void {
  if (w.alive[source] === 0) return;
  if (w.lifestealPct[source]! > 0 && dealt > 0) heal(w, source, (dealt * w.lifestealPct[source]!) / 100);
  if (w.healAllyHp[source]! > 0) {
    const r2 = w.healAllyRadius[source]! * w.healAllyRadius[source]!;
    let best = -1;
    for (let j = 0; j < w.count; j++) {
      if (j === source || w.alive[j] === 0 || w.team[j] !== w.team[source] || w.kind[j] !== KIND_UNIT) continue;
      if (w.hp[j]! >= w.maxHp[j]!) continue;
      const dx = w.x[j]! - w.x[source]!;
      const dy = w.y[j]! - w.y[source]!;
      if (dx * dx + dy * dy > r2) continue;
      if (best < 0 || w.hp[j]! < w.hp[best]!) best = j;
    }
    if (best >= 0) heal(w, best, w.healAllyHp[source]!);
  }
  if (w.alive[target] === 0 || w.hp[target]! <= 0) return;
  if (w.burnDps[source]! > 0) addDot(w, target, 'burn', dotKey(w, source), w.burnDps[source]!, w.burnTicks[source]!, 0);
  if (w.poisonDps[source]! > 0) {
    addDot(w, target, 'poison', dotKey(w, source), w.poisonDps[source]!, w.poisonTicks[source]!, w.poisonMax[source]!);
  }
  if (knock + w.knockPx[source]! > 0) kick(w, target, source, knock + w.knockPx[source]!, 1);
  if (w.pullPx[source]! > 0) {
    w.pullHits[source] = w.pullHits[source]! + 1;
    if (w.pullHits[source]! % w.pullEvery[source]! === 0) kick(w, target, source, w.pullPx[source]!, -1);
  }
}

/**
 * Bước 10: sống lại một lần (`reviveOnce`) với `hpPct`% HP tối đa. Trả true nếu đã sống lại — người
 * gọi bỏ qua cái chết (không hạ gục, không mất lính, không sinh lính con).
 */
export function deathBehaviours(w: BattleWorld, id: number): boolean {
  let pct: number;
  if (w.reviveReady[id] === 1) {
    w.reviveReady[id] = 0;
    pct = w.revivePct[id]!;
  } else if (w.undyingLeft > 0 && w.team[id] === TEAM_FOE && w.kind[id] === KIND_UNIT && w.revived[id] === 0) {
    // Bất Tử (§6.10): những địch đầu tiên bị hạ sống lại; một đơn vị không bao giờ sống lại hai lần.
    w.undyingLeft -= 1;
    pct = w.undyingHpPct;
  } else {
    return false;
  }
  w.revived[id] = 1;
  w.hp[id] = (w.maxHp[id]! * pct) / 100;
  w.killerUid[id] = -1;
  w.killerId[id] = -1;
  w.events.push({ type: 'revive', id });
  return true;
}

/**
 * Cuối trận: vàng từ `killGold` (Thuyền Cướp Biển): mỗi `every` địch do lính của công trình hạ được
 * `gold`, tối đa `max`. Gom vào `goldDelta`, chỉ một lần mỗi trận.
 */
export function settleBattleGold(w: BattleWorld): void {
  if (w.battleGoldSettled) return;
  w.battleGoldSettled = true;
  for (let i = 0; i < w.count; i++) {
    if (w.killGoldEvery[i]! <= 0) continue;
    const kills = w.killsBySource[w.sourceUid[i]!] ?? 0;
    w.goldDelta += Math.min(Math.floor(kills / w.killGoldEvery[i]!), w.killGoldMax[i]!) * w.killGoldAmount[i]!;
  }
}

/**
 * Cờ hiệu Cướp Bóc (§6.7), sau bước chết: theo dõi mức HP Ngai thấp nhất; mỗi `lootEveryPct`% HP
 * tối đa mất thêm (mốc cao nhất đã đạt, hồi máu rồi mất lại không tính hai lần) người chơi mất
 * `lootGold` vàng, tối đa `lootMax` mỗi trận.
 */
export function bannerPhase(w: BattleWorld): void {
  if (w.lootGold <= 0) return;
  const hp = Math.max(w.hp[w.throneId]!, 0);
  if (hp < w.throneMinHp) w.throneMinHp = hp;
  const max = w.maxHp[w.throneId]!;
  const steps = Math.min(Math.floor(((max - w.throneMinHp) * 100) / (max * w.lootEveryPct)), w.lootMax);
  if (steps > w.lootSteps) {
    w.goldDelta -= (steps - w.lootSteps) * w.lootGold;
    w.lootSteps = steps;
  }
}
