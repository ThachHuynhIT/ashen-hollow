/** Dựng thế giới trận có boss cho test (không dùng trong mã chạy thật). */
import { RULES_FULL } from '../../data/rules';
import { CONTENT } from '../cards/registry';
import { buildBattleSetup } from '../run/battleSetup';
import { newRun, startYear } from '../run/yearFlow';
import type { StructureSetup } from './types';
import { battleSetup, throneSetup } from '../testing/fixtures';
import type { BattleSetup, BossSetup } from './types';
import { createBattle, type BattleWorld } from './world';
import { spawnBossDue } from './bosses';


/** Boss `ordinal` (1..3) của ván đầy đủ, dựng từ trạng thái thật của năm 10 / 20 / 30. */
export const realBoss = (ordinal: 1 | 2 | 3): BossSetup => {
  const year = ordinal * 10;
  const base = newRun(5, 'wheat', CONTENT, RULES_FULL);
  const s = startYear({ ...base, year: year - 1 }, CONTENT);
  const setup: BattleSetup = buildBattleSetup({ ...s, phase: 'battle' }, CONTENT);
  return setup.boss!;
};

/**
 * Trận yên tĩnh có boss: Ngai không bắn, đợt đầu rỗng; boss được đặt ngay (tick 120) tại (x, y) và đã xuất
 * hiện. Dùng `w.tick = …; tickBosses(w)` để kiểm kỹ năng ở từng tick.
 */
export const bossWorld = (
  ordinal: 1 | 2 | 3,
  structures: readonly StructureSetup[] = [],
  at: { x: number; y: number } = { x: 100, y: 192 },
  boss: BossSetup = realBoss(ordinal),
): BattleWorld => {
  const w = createBattle(
    battleSetup({
      throne: throneSetup({ attack: null }),
      structures,
      boss,
      waves: [{ spawnTick: 0, spawns: [] }],
    }),
  );
  w.tick = boss.spawnTick;
  spawnBossDue(w);
  w.x[w.bossId] = at.x;
  w.y[w.bossId] = at.y;
  w.prevX[w.bossId] = at.x;
  w.prevY[w.bossId] = at.y;
  return w;
};
