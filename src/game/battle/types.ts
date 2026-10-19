import type { UnitId } from '../../data/types';

/** Mép sân nơi quân địch xuất hiện. */
export type Edge = 'N' | 'E' | 'S' | 'W';

export interface ArmySpawn {
  unit: UnitId;
  edge: Edge;
}

export interface ArmyWave {
  spawnTick: number;
  units: readonly ArmySpawn[];
}

/** Đạo quân địch đã bốc sẵn ở đầu năm (spec §3.6). */
export interface ArmyPlan {
  attacker: 'raiders';
  budget: number;
  level: 1 | 2 | 3 | 4 | 5;
  /** Nhân HP & DMG khi chạm ENEMY_CAP mà còn ngân sách (√surplus), mặc định 1. */
  statMult: number;
  waves: readonly ArmyWave[];
}

/** Một lệnh can thiệp của người chơi (ghi lại để phát lại trận). */
export interface BattleInput {
  tick: number;
  x: number;
  y: number;
}

export interface BattleResult {
  won: boolean;
  ticks: number;
  throneHpLostPct: number;
  kills: number;
  killsBySource: Record<number, number>;
  interventionsUsed: number;
  unitsLost: number;
  capped: number;
  inputs: BattleInput[];
}
