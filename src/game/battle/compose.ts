import { ENEMY_BUDGET, ENEMY_CAP, ENEMY_LEVEL_COST, WAVES } from '../../data/battle';
import type { UnitId } from '../../data/types';
import { Rng, hashSeed } from '../../core/random';
import type { ArmySpawn, ArmyPlan, ArmyWave, Edge } from './types';

export interface ComposeEntry {
  unit: UnitId;
  weight: number;
  /** EP ở cấp 1. */
  enemyCost: number;
}

const EDGES: readonly Edge[] = ['N', 'E', 'S', 'W'];
const LEVELS = [1, 2, 3, 4, 5] as const;

/** Ngân sách EP của một đạo quân (độ khó Gai 0): round(ENEMY_BUDGET[year−1] × slot). */
export const armyBudget = (year: number, slot: number): number => {
  const idx = Math.min(Math.max(year, 1), ENEMY_BUDGET.length) - 1;
  return Math.round(ENEMY_BUDGET[idx]! * slot);
};

/** Chọn theo trọng số trong `pool` (thứ tự cố định, không phụ thuộc Map/Set). */
const pickWeighted = (pool: readonly ComposeEntry[], rng: Rng): ComposeEntry => {
  let total = 0;
  for (const e of pool) total += e.weight;
  let r = rng.next() * total;
  for (const e of pool) {
    if (r < e.weight) return e;
    r -= e.weight;
  }
  return pool[pool.length - 1]!;
};

/** Thuần và xác định: cùng đầu vào → cùng ArmyPlan (spec §3.6). */
export const composeArmy = (
  roster: readonly ComposeEntry[],
  budget: number,
  year: number,
  seed: number,
): ArmyPlan => {
  const rng = new Rng(hashSeed(`${seed}:army:${year}`));

  let weightSum = 0;
  let costSum = 0;
  for (const e of roster) {
    weightSum += e.weight;
    costSum += e.weight * e.enemyCost;
  }
  const avg = weightSum > 0 ? costSum / weightSum : 1;

  let level: ArmyPlan['level'] = 5;
  for (const l of LEVELS) {
    if (budget / (avg * ENEMY_LEVEL_COST[l - 1]!) <= ENEMY_CAP) {
      level = l;
      break;
    }
  }
  const levelCost = ENEMY_LEVEL_COST[level - 1]!;

  const chosen: UnitId[] = [];
  let spent = 0;
  while (chosen.length < ENEMY_CAP) {
    const remaining = budget - spent;
    const pool = roster.filter((e) => e.weight > 0 && e.enemyCost * levelCost <= remaining);
    if (pool.length === 0) break;
    const e = pickWeighted(pool, rng);
    chosen.push(e.unit);
    spent += e.enemyCost * levelCost;
  }

  const statMult = chosen.length >= ENEMY_CAP && spent > 0 && spent < budget ? Math.sqrt(budget / spent) : 1;

  const n = chosen.length;
  const sizes = [Math.floor(n * WAVES.share[0]), Math.floor(n * WAVES.share[1]), 0];
  sizes[2] = n - sizes[0]! - sizes[1]!;

  const dual = year >= 10;
  const waves: ArmyWave[] = [];
  let cursor = 0;
  for (let w = 0; w < WAVES.share.length; w++) {
    const edgeA = rng.pick(EDGES);
    const edgeB = dual ? rng.pick(EDGES.filter((e) => e !== edgeA)) : edgeA;
    const units: ArmySpawn[] = [];
    for (let i = 0; i < sizes[w]!; i++) {
      units.push({ unit: chosen[cursor++]!, edge: i % 2 === 0 ? edgeA : edgeB });
    }
    waves.push({ spawnTick: WAVES.spawnTick[w]!, units });
  }

  return { attacker: 'raiders', budget, level, statMult, waves };
};
