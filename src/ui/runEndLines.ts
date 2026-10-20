import type { RunState } from '../game/run/state';

/** The lines of the run summary (§10.8): progress, battles, kills, conquered kings and gold. */
export const runEndLines = (state: RunState): string[] => [
  `Năm đạt được: ${state.year} / ${state.rules.years}`,
  `Trận thắng: ${state.stats.battlesWon} · Trận thua: ${state.stats.battlesLost}`,
  `Địch đã hạ: ${state.stats.kills}`,
  `Vua đã chinh phục: ${state.stats.conquered} / ${state.enemyKings.length || 2}`,
  `Vàng kiếm được: ${state.stats.goldEarned}`,
];
