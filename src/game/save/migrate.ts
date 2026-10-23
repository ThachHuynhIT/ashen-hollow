/**
 * Nâng cấp RunState đã lưu lên phiên bản hiện tại (thuần, không sửa đầu vào). Chỉ có migrator cho
 * state 3 → 4 vì state 1 và 2 chưa từng có định dạng trên đĩa; phiên bản khác được trả nguyên để
 * `decodeRun` từ chối.
 */
import { hashSeed } from '../../core/random';

type Loose = Record<string, unknown>;

const isObject = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);

/** State 3 → 4: thêm các trường của ván đầy đủ với giá trị trung tính, lấy seed hội đồng / nhiệm vụ từ seed ván. */
const v3to4 = (raw: Loose): Loose => {
  const seed = typeof raw.seed === 'number' ? raw.seed : 0;
  const rng = isObject(raw.rng) ? raw.rng : {};
  const stats = isObject(raw.stats) ? raw.stats : {};
  const plots = Array.isArray(raw.plots) ? raw.plots : [];
  return {
    ...raw,
    version: 4,
    plots: plots.map((p) => {
      if (!isObject(p) || !isObject(p.building)) return p;
      return { ...p, building: { ageBonus: 0, counters: {}, movedYear: null, ...p.building } };
    }),
    pendingOffers: [],
    decrees: [],
    quests: [],
    offeredQuestIds: [],
    freeRerollsLeft: 0,
    interventionDmgPct: 0,
    difficulty: 0,
    yearStartPendingDraw: false,
    paidRerollsThisYear: typeof raw.rerollsThisYear === 'number' ? raw.rerollsThisYear : 0,
    rng: {
      ...rng,
      council: hashSeed(`${seed}:council`),
      quest: hashSeed(`${seed}:quest`),
    },
    stats: {
      ...stats,
      bossesWon: 0,
      bossesDefeated: [],
      completedYears: Number(stats.battlesWon ?? 0) + Number(stats.battlesLost ?? 0),
    },
  };
};

export function migrateRunState(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  return raw.version === 3 ? v3to4(raw) : raw;
}
