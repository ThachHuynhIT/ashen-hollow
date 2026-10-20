/** Dựng setup trận nhỏ cho test (không dùng trong mã chạy thật). */
import { CONTENT } from '../cards/registry';
import { newRun } from '../run/yearFlow';
import type { RunState } from '../run/state';
import type { AttackStats, BattleSetup, StructureSetup, UnitStats } from '../battle/types';

/** Đòn cận chiến tức thời: dmg 5, tầm 2, 10 tick/đòn. */
export const attackStats = (over: Partial<AttackStats> = {}): AttackStats => ({
  dmg: 5,
  dmgType: 'physical',
  range: 2,
  minRange: 0,
  interval: 10,
  projectileSpeed: 0,
  cleave: 1,
  slowPct: 0,
  slowTicks: 0,
  ...over,
});

/** Lính cận chiến: hp 40, dmg 5, tầm 2, interval 10, speed 1, radius 4, armor 0. */
export const unitStats = (over: Partial<UnitStats> = {}): UnitStats => ({
  ...attackStats(),
  unit: 'test_unit',
  hp: 40,
  speed: 1,
  radius: 4,
  armor: 0,
  siege: false,
  sprite: { w: 16, h: 16 },
  ...over,
});

/** Công trình lính không sinh lính (uid = plot + 1, hp 100, không đánh). */
export const structure = (plot: number, over: Partial<StructureSetup> = {}): StructureSetup => ({
  plot,
  uid: plot + 1,
  cardId: 'neutral_barracks',
  kind: 'troop',
  hp: 100,
  armor: 0,
  attack: null,
  targeting: 'closestToThrone',
  spawn: null,
  ...over,
});

/** Ngai: plot 12, uid 0, hp 300, bắn tầm 72 (đạn 8 px/tick), chọn mục tiêu gần nhất. */
export const throneSetup = (over: Partial<StructureSetup> = {}): StructureSetup => ({
  plot: 12,
  uid: 0,
  cardId: 'wheat_throne',
  kind: 'throne',
  hp: 300,
  armor: 0,
  attack: attackStats({ dmg: 6, range: 72, interval: 10, projectileSpeed: 8 }),
  targeting: 'nearest',
  spawn: null,
  ...over,
});

/** Năm 1, Ngai mặc định, không công trình, không đợt địch. */
export const battleSetup = (over: Partial<BattleSetup> = {}): BattleSetup => ({
  year: 1,
  throne: throneSetup(),
  structures: [],
  waves: [],
  ...over,
});

/** Ván mới năm 1 (vua lúa mì, seed 1) với các trường ghi đè. */
export const runState = (over: Partial<RunState> = {}): RunState => ({
  ...newRun(1, 'wheat', CONTENT),
  ...over,
});
