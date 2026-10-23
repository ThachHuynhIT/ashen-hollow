/**
 * Đạo quân của năm (spec §3.5–3.6): theo ô của lịch — Thổ Phỉ, một vua địch (kèm cờ hiệu), Liên Quân
 * (gộp roster hai vua) hoặc đội quân đi kèm boss. Thuần, deterministic; kết quả lưu vào `RunState.army`.
 */
import { SLOT_MULT } from '../../data/battle';
import type { KingId, UnitDef } from '../../data/types';
import { armyBudget, composeArmy, type ComposeEntry } from '../battle/compose';
import type { ArmyPlan } from '../battle/types';
import type { Content } from '../cards/registry';
import { calendarFor, slotMultFor } from './calendar';
import type { RunState } from './state';

/** Gộp nhiều roster: cùng `UnitId` thì cộng trọng số. */
export function mergeRosters(
  rosters: readonly (readonly { unit: string; weight: number; enemyCost: number }[])[],
): ComposeEntry[] {
  const out: ComposeEntry[] = [];
  for (const roster of rosters) {
    for (const r of roster) {
      const same = out.find((e) => e.unit === r.unit);
      if (same) same.weight += r.weight;
      else out.push({ unit: r.unit, weight: r.weight, enemyCost: r.enemyCost });
    }
  }
  return out;
}

/** Đưa tổng trọng số của từng roster về bằng nhau (mỗi vua một phần như nhau), giữ tỷ trọng bên trong. */
export function normalizeRosters(
  rosters: readonly (readonly { unit: string; weight: number; enemyCost: number }[])[],
): { unit: string; weight: number; enemyCost: number }[][] {
  return rosters.map((roster) => {
    const total = roster.reduce((sum, r) => sum + r.weight, 0);
    return roster.map((r) => ({ ...r, weight: total > 0 ? (r.weight / total) * 100 : 0 }));
  });
}

const entries = (
  roster: readonly { unit: UnitDef; weight: number }[],
  costMult = 1,
): { unit: string; weight: number; enemyCost: number }[] =>
  roster.map((r) => ({ unit: r.unit.id, weight: r.weight, enemyCost: r.unit.enemyCost * costMult }));

/** Đạo quân của `state.year` theo lịch của `state.rules`. */
export function buildYearArmy(state: RunState, content: Content): ArmyPlan {
  const year = state.year;
  const slot = calendarFor(state.rules)[year - 1] ?? { kind: 'raiders' as const };
  const budget = (mult: number): number => armyBudget(year, mult, state.difficulty);
  const kingAt = (n: number): KingId => state.enemyKings[n - 1]!;

  switch (slot.kind) {
    case 'king': {
      const kingId = kingAt(slot.king);
      const king = content.enemyKing(kingId);
      // Cờ hiệu `enemyCostPct` làm đổi giá đơn vị khi tính ngân sách (spec §3.6).
      const costMult =
        1 + king.banner.effects.reduce((sum, e) => (e.type === 'enemyCostPct' ? sum + e.pct : sum), 0) / 100;
      const extraEdges = king.banner.effects.reduce((sum, e) => (e.type === 'extraEdge' ? sum + e.count : sum), 0);
      return composeArmy(entries(content.enemyRoster(kingId), costMult), budget(slotMultFor(slot)), year, state.seed, {
        attacker: kingId,
        attackNo: slot.attack,
        banner: king.banner.id,
        extraEdges,
      });
    }
    case 'coalition': {
      const kings = slot.kings.map(kingAt);
      const roster = mergeRosters(kings.map((k) => entries(content.enemyRoster(k))));
      return composeArmy(roster, budget(slotMultFor(slot)), year, state.seed, { attacker: 'coalition', kings });
    }
    case 'boss': {
      const mult = SLOT_MULT.boss[slot.ordinal - 1]!;
      const roster =
        slot.ordinal === 1
          ? entries(content.raiderRoster())
          : slot.ordinal === 2
            ? mergeRosters([kingAt(3), kingAt(4)].map((k) => entries(content.enemyRoster(k))))
            : mergeRosters(normalizeRosters(state.enemyKings.map((k) => entries(content.enemyRoster(k)))));
      return composeArmy(roster, budget(mult), year, state.seed, {
        attacker: 'boss',
        boss: slot.boss,
        bossOrdinal: slot.ordinal,
        ...(slot.ordinal === 2 ? { kings: [kingAt(3), kingAt(4)] } : {}),
      });
    }
    default:
      return composeArmy(entries(content.raiderRoster()), budget(slotMultFor(slot)), year, state.seed, {});
  }
}
