/**
 * Benchmark §8.10: kịch bản chuẩn — 8 Trại × 20 = 160 lính phe mình, 3 tháp, 120 địch xuất hiện
 * ở tick 0 (4 mép × 30). Trung bình `stepBattle` trên 100 tick đầu ≤ 2 ms (ngưỡng chống flaky;
 * mục tiêu thiết kế 0.5 ms). Đo bằng process.hrtime.bigint() (performance.now bị ESLint cấm).
 */
import { describe, expect, it } from 'vitest';
import { attackStats, battleSetup, structure, unitStats } from '../testing/fixtures';
import { battleResult, stepBattle } from './step';
import type { BattleSetup, Edge } from './types';
import { createBattle, drainEvents } from './world';

/** Đồng hồ Node (Vitest chạy trên Node); khai báo tối thiểu vì dự án không kèm @types/node. */
declare const process: { hrtime: { bigint(): bigint } };

const TICKS = 100;
const LIMIT_MS = 2;

const militia = unitStats({ unit: 'militia', hp: 32, dmg: 5, speed: 1 });
const bandit = unitStats({ unit: 'bandit', hp: 30, dmg: 5, speed: 0.9 });
const archer = unitStats({
  unit: 'bandit_archer',
  hp: 22,
  dmg: 5,
  range: 56,
  interval: 14,
  projectileSpeed: 7,
  speed: 0.8,
});
const EDGES: readonly Edge[] = ['N', 'E', 'S', 'W'];

const standardSetup = (): BattleSetup =>
  battleSetup({
    year: 5,
    autoFire: true,
    structures: [
      ...[6, 7, 8, 11, 13, 16, 17, 18].map((plot) =>
        structure(plot, { cardId: 'wheat_militia', spawn: { stats: militia, count: 20 } }),
      ),
      ...[2, 10, 22].map((plot) =>
        structure(plot, {
          cardId: 'neutral_archer_tower',
          kind: 'tower',
          attack: attackStats({ dmg: 7, range: 88, interval: 12, projectileSpeed: 8 }),
          targeting: 'closestToThrone',
        }),
      ),
    ],
    waves: [
      {
        spawnTick: 0,
        spawns: EDGES.flatMap((edge) =>
          Array.from({ length: 30 }, (_, i) => ({ stats: i % 4 === 0 ? archer : bandit, edge })),
        ),
      },
    ],
  });

/** Chạy TICKS tick, trả tổng nano giây chỉ của stepBattle. */
const run = (): { ns: bigint; ended: boolean } => {
  const w = createBattle(standardSetup());
  let ns = 0n;
  for (let i = 0; i < TICKS; i++) {
    const t0 = process.hrtime.bigint();
    stepBattle(w, []);
    ns += process.hrtime.bigint() - t0;
    drainEvents(w);
  }
  return { ns, ended: battleResult(w) !== null };
};

describe('battle benchmark (§8.10)', () => {
  it(`standard scenario averages ≤ ${LIMIT_MS} ms per tick over ${TICKS} ticks`, () => {
    const probe = createBattle(standardSetup());
    stepBattle(probe, []);
    let allies = 0;
    let foes = 0;
    for (let i = 0; i < probe.count; i++) {
      if (probe.kind[i] !== 0) continue;
      if (probe.team[i] === 0) allies++;
      else foes++;
    }
    expect([allies, foes]).toEqual([160, 120]);

    run(); // làm nóng JIT, không tính
    const { ns, ended } = run();
    expect(ended).toBe(false); // đo trọn 100 tick đang đánh
    const avgMs = Number(ns) / TICKS / 1e6;
    console.info(`[benchmark] stepBattle avg ${avgMs.toFixed(3)} ms/tick over ${TICKS} ticks`);
    expect(avgMs).toBeLessThanOrEqual(LIMIT_MS);
  });

  it(`G2 scenario (pulses, chains, splash, shields, taunt) averages ≤ ${LIMIT_MS} ms per tick`, () => {
    const g2 = (): BattleSetup => {
      const base = standardSetup();
      return {
        ...base,
        structures: [
          ...base.structures.slice(0, 8),
          structure(2, {
            cardId: 'stone_mountain_heart',
            kind: 'tower',
            pulse: { everyTicks: 40, radius: 48, dmg: 30, dmgType: 'physical', stunTicks: 10 },
          }),
          structure(10, { cardId: 'stone_wall', kind: 'tower', taunt: 40 }),
          structure(22, {
            cardId: 'arcane_ward',
            kind: 'tower',
            shieldPulse: { everyTicks: 50, radius: 64, amount: 20 },
          }),
          structure(1, {
            cardId: 'arcane_mage_tower',
            kind: 'tower',
            attack: attackStats({
              dmg: 9,
              range: 80,
              interval: 14,
              projectileSpeed: 8,
              chain: { count: 1, radius: 32, falloff: 0.6 },
            }),
          }),
          structure(3, {
            cardId: 'stone_catapult',
            kind: 'tower',
            attack: attackStats({ dmg: 14, range: 96, minRange: 24, interval: 25, projectileSpeed: 5, splash: 16 }),
          }),
        ],
      };
    };
    const once = (): bigint => {
      const w = createBattle(g2());
      let ns = 0n;
      for (let i = 0; i < TICKS; i++) {
        const t0 = process.hrtime.bigint();
        stepBattle(w, []);
        ns += process.hrtime.bigint() - t0;
        drainEvents(w);
      }
      return ns;
    };
    once();
    const avgMs = Number(once()) / TICKS / 1e6;
    console.info(`[benchmark] G2 stepBattle avg ${avgMs.toFixed(3)} ms/tick over ${TICKS} ticks`);
    expect(avgMs).toBeLessThanOrEqual(LIMIT_MS);
  });
});
