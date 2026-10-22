/**
 * Bỏng, độc và hồi máu theo giây (spec §8.6, §8.9 bước 9). Bỏng/độc khoá theo nguồn: công trình
 * phe mình theo `sourceUid`, đơn vị địch theo `defIndex`. Cùng khoá làm mới thời gian và giữ
 * `dps` mạnh hơn; khác khoá cộng dồn; độc cộng lớp tới `maxStacks` mỗi khoá. Hiệu lực mỗi khi
 * `tick % 10 = 0`. Không dùng Rng; duyệt theo thứ tự tạo / id tăng dần.
 */
import { STATUS } from '../../data/battle';
import { mitigate } from './damage';
import { KIND_UNIT, TEAM_FOE, heal, type BattleWorld } from './world';

/** Khoá bỏng/độc của quân địch cách xa khoá uid công trình (uid < 1e6). */
export const FOE_KEY_BASE = 1_000_000;

/** Khoá bỏng/độc do người đánh `source` gây ra. */
export const dotKey = (w: BattleWorld, source: number): number =>
  w.sourceUid[source]! >= 0 ? w.sourceUid[source]! : FOE_KEY_BASE + Math.max(w.defIndex[source]!, 0);

/**
 * Thêm một lần bỏng / độc lên `victim`. Bỏng: cùng khoá → `ticks` mới, `dps = max`; khác khoá →
 * mục mới. Độc: cùng khoá → thêm một lớp (tối đa `maxStacks`), làm mới thời gian.
 */
export function addDot(
  w: BattleWorld,
  victim: number,
  kind: 'burn' | 'poison',
  key: number,
  dps: number,
  ticks: number,
  maxStacks: number,
): void {
  const found = w.dots.find((d) => d.victim === victim && d.kind === kind && d.key === key);
  if (found === undefined) {
    w.dots.push({ victim, kind, key, dps, ticks, stacks: 1 });
    return;
  }
  found.ticks = ticks;
  found.dps = Math.max(found.dps, dps);
  if (kind === 'poison') found.stacks = Math.min(found.stacks + 1, Math.max(maxStacks, 1));
}

/** Sát thương liên tục lên `victim` (qua giáp, qua khiên), ghi nguồn hạ gục nếu chết. */
const damage = (w: BattleWorld, victim: number, raw: number, fire: boolean, key: number): void => {
  const dmg = Math.max(0, mitigate(raw, fire ? 'fire' : 'magic', w.armor[victim]!));
  const absorbed = Math.min(w.shield[victim]!, dmg);
  w.shield[victim] = w.shield[victim]! - absorbed;
  w.hp[victim] = w.hp[victim]! - (dmg - absorbed);
  w.events.push({ type: 'hit', id: victim, dmg });
  if (w.hp[victim]! <= 0 && w.killerUid[victim]! < 0) w.killerUid[victim] = key < FOE_KEY_BASE ? key : -1;
};

/** Bước 9: hồi máu từ aura, sát thương bỏng/độc ở tick chia hết cho 10; trừ thời gian mỗi tick. */
export function tickStatuses(w: BattleWorld): void {
  const pulse = w.tick % STATUS.everyTicks === 0;
  if (pulse) {
    for (let i = 0; i < w.count; i++) {
      if (w.alive[i] === 0 || w.auraHps[i]! <= 0) continue;
      const r2 = w.auraRadius[i]! * w.auraRadius[i]!;
      for (let j = 0; j < w.count; j++) {
        if (w.alive[j] === 0 || w.team[j] !== w.team[i] || w.kind[j] !== KIND_UNIT) continue;
        const dx = w.x[j]! - w.x[i]!;
        const dy = w.y[j]! - w.y[i]!;
        if (dx * dx + dy * dy <= r2) heal(w, j, w.auraHps[i]!);
      }
    }
  }
  if (pulse && w.regenPct > 0) {
    // Tái Sinh (§6.6): mọi địch hồi một phần HP tối đa mỗi giây, theo id tăng dần.
    for (let i = 0; i < w.count; i++) {
      if (w.alive[i] === 0 || w.team[i] !== TEAM_FOE || w.kind[i] !== KIND_UNIT) continue;
      heal(w, i, (w.maxHp[i]! * w.regenPct) / 100);
    }
  }
  const live: typeof w.dots = [];
  for (const d of w.dots) {
    if (w.alive[d.victim] === 0 || w.hp[d.victim]! <= 0) continue;
    if (pulse) damage(w, d.victim, d.dps * d.stacks, d.kind === 'burn', d.key);
    d.ticks -= 1; // sau khi gây sát thương: tick cuối của thời hạn vẫn được tính
    if (d.ticks > 0) live.push(d);
  }
  w.dots = live;
}
