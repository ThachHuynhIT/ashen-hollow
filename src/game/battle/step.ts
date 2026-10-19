/**
 * Một tick trận (spec §8.9) và kết thúc (§8.8). Thứ tự cố định: xuất đợt → can thiệp + tảng đá
 * → (hook, chưa có) → chọn mục tiêu → di chuyển → đánh → đạn → áp sát thương → trạng thái →
 * chết → kiểm tra kết thúc, rồi `tick += 1`. Không dùng Rng.
 */
import { BATTLE } from '../../data/battle';
import { applyDamagePhase, attackPhase, deathPhase, projectilePhase, statusPhase } from './combat';
import { boulderPhase, tryIntervene } from './intervention';
import { moveEntities } from './movement';
import { retarget } from './targeting';
import type { BattleInput, BattleResult, BattleSetup } from './types';
import { TEAM_FOE, createBattle, spawnWave, type BattleWorld } from './world';

/** Bước 1: xuất các đợt đến hạn, theo thứ tự (đợt 0 ở tick 0). */
const spawnDueWaves = (world: BattleWorld): void => {
  const waves = world.setup.waves;
  while (world.spawnedWaves < waves.length && waves[world.spawnedWaves]!.spawnTick <= world.tick) {
    spawnWave(world, world.spawnedWaves);
  }
};

const anyFoeAlive = (world: BattleWorld): boolean => {
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] === 1 && world.team[i] === TEAM_FOE) return true;
  }
  return false;
};

/** Bước 11 (§8.8): thua (Ngai ≤ 0 HP) ưu tiên hơn thắng; hết giờ với Ngai còn HP → thắng. */
const checkEnd = (world: BattleWorld): void => {
  let won: boolean | null = null;
  if (world.hp[world.throneId]! <= 0) won = false;
  else if (world.spawnedWaves >= world.setup.waves.length && !anyFoeAlive(world)) won = true;
  else if (world.tick >= BATTLE.hardLimitTick) won = true;
  if (won === null) return;
  world.ended = true;
  world.won = won;
  world.endTick = world.tick;
  world.events.push({ type: 'ended', won });
};

/** Chạy một tick (§8.9). `inputs` là lệnh can thiệp của tick này. Trận đã kết thúc → không làm gì. */
export const stepBattle = (world: BattleWorld, inputs: readonly BattleInput[]): void => {
  if (world.ended) return;
  // (1) xuất đợt
  spawnDueWaves(world);
  if (world.tick === BATTLE.rageTick) world.events.push({ type: 'rage' });
  // (2) can thiệp: lệnh của tick này theo thứ tự nhận (lệnh tick khác bị bỏ), rồi tảng đá đến hạn rơi.
  for (const input of inputs) {
    if (input.tick === world.tick) tryIntervene(world, input);
  }
  boulderPhase(world);
  // (3) hook onBattleTick — chưa có ở G1.
  retarget(world); // (4)
  moveEntities(world); // (5)
  attackPhase(world); // (6)
  projectilePhase(world); // (7)
  applyDamagePhase(world); // (8)
  statusPhase(world); // (9)
  deathPhase(world); // (10)
  checkEnd(world); // (11)
  world.tick += 1;
};

/** Kết quả trận, null khi chưa kết thúc. `ticks` = tick trong đó trận kết thúc. */
export const battleResult = (world: BattleWorld): BattleResult | null => {
  if (!world.ended) return null;
  const hp = Math.max(world.hp[world.throneId]!, 0);
  const maxHp = world.maxHp[world.throneId]!;
  return {
    won: world.won,
    ticks: world.endTick,
    throneHpLostPct: maxHp > 0 ? Math.round((1 - hp / maxHp) * 100) : 100,
    kills: world.kills,
    killsBySource: { ...world.killsBySource },
    interventionsUsed: world.interventionsUsed,
    unitsLost: world.unitsLost,
    capped: world.capped,
    inputs: world.inputs.map((i) => ({ ...i })),
  };
};

/**
 * Chạy trọn trận: mỗi tick nhận các `inputs` có `tick` bằng tick hiện tại. Ném lỗi nếu quá
 * `hardLimitTick + 1` tick mà chưa kết thúc (không thể xảy ra nếu luật hết giờ đúng).
 */
export const simulateBattle = (
  setup: BattleSetup,
  inputs: readonly BattleInput[] = [],
): BattleResult => {
  const world = createBattle(setup);
  const maxSteps = BATTLE.hardLimitTick + 1;
  for (let step = 0; step < maxSteps; step++) {
    const tick = world.tick;
    stepBattle(
      world,
      inputs.filter((i) => i.tick === tick),
    );
    const result = battleResult(world);
    if (result !== null) return result;
  }
  throw new Error(`simulateBattle: no result after ${maxSteps} ticks`);
};
