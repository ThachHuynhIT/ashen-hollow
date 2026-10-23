/** Nội dung bảng thông tin nhà / lính (spec §10.7) và chỗ đặt bảng; thuần, không Phaser. */
import { TICKS_PER_SECOND } from '../../core/SimClock';
import type { BattleWorld } from '../../game/battle/world';
import type { RunState } from '../../game/run/state';
import { UI_PALETTE } from '../../data/uiPalette';
import type { Point, Size, TooltipContent } from '../hud/layout';
import type { BuildingInfoModel, UnitInfoModel } from './inspectionModel';

/** Bấm trượt tối đa chừng này px ngoài vòng va chạm vẫn tính là trúng. */
const HIT_SLOP = 4;
/** Khoảng cách từ điểm bấm tới bảng. */
const ANCHOR_GAP = 12;
const SCREEN_MARGIN = 4;

const tintOf = (line: string): number | undefined => {
  if (line.startsWith('Lính:') || line.startsWith('Máu lính')) return UI_PALETTE.woodDark;
  if (line.startsWith('Cấp ')) return UI_PALETTE.wood;
  if (line.startsWith('Bùa:') || line.startsWith('Đang choáng')) return UI_PALETTE.select;
  if (line.startsWith('Khiên')) return UI_PALETTE.woodDark;
  if (line.startsWith('Máu')) return UI_PALETTE.good;
  return undefined;
};

/** Dòng thông tin → nội dung bảng: dòng đầu là tiêu đề, cấp / máu / lính được tô màu bộ UI. */
export const infoContent = (lines: readonly string[]): TooltipContent => ({
  title: lines[0],
  lines: lines.slice(1).map((text) => [{ text, color: tintOf(text) }]),
});

/**
 * Thực thể sống có vòng va chạm (cộng `HIT_SLOP`) chứa điểm thế giới `(wx, wy)`: gần tâm nhất,
 * hòa thì id nhỏ nhất; không có → null.
 */
export const entityAt = (world: BattleWorld, wx: number, wy: number): number | null => {
  let best: number | null = null;
  let bestD2 = Infinity;
  for (let i = 0; i < world.count; i++) {
    if (world.alive[i] !== 1) continue;
    const dx = world.x[i]! - wx;
    const dy = world.y[i]! - wy;
    const d2 = dx * dx + dy * dy;
    const reach = world.radius[i]! + HIT_SLOP;
    if (d2 <= reach * reach && d2 < bestD2) {
      best = i;
      bestD2 = d2;
    }
  }
  return best;
};

const seconds = (ticks: number): number => Math.ceil(ticks / TICKS_PER_SECOND);

/** Trạng thái đang có trên thực thể: choáng, chậm, bỏng, độc, vô hiệu, hạ cánh, nổi giận, đã hồi sinh. */
export const statusLines = (world: BattleWorld, id: number): string[] => {
  const lines: string[] = [];
  if (world.stunTicks[id]! > 0) lines.push('Đang choáng');
  if (world.slowTicks[id]! > 0 && world.slowPct[id]! > 0) {
    lines.push(`Bị làm chậm ${Math.round(world.slowPct[id]!)}% (còn ${seconds(world.slowTicks[id]!)}s)`);
  }
  const dots = world.dots.filter((d) => d.victim === id);
  for (const [kind, label] of [['burn', 'Đang bỏng'], ['poison', 'Nhiễm độc']] as const) {
    const of = dots.filter((d) => d.kind === kind);
    if (of.length === 0) continue;
    const dps = of.reduce((sum, d) => sum + d.dps * d.stacks, 0);
    const left = Math.max(...of.map((d) => d.ticks));
    lines.push(`${label}: ${Math.round(dps)}/s (còn ${seconds(left)}s)`);
  }
  if (world.disabledUntil[id]! > world.tick) lines.push('Bị vô hiệu');
  if (id === world.bossId && world.bossLanded) lines.push('Đang hạ cánh: nhận thêm sát thương');
  if (world.enrageDmgPct[id]! > 0 && world.hp[id]! * 100 < world.enrageBelow[id]! * world.maxHp[id]!) {
    lines.push(`Nổi giận: +${Math.round(world.enrageDmgPct[id]!)}% sát thương`);
  }
  if (world.revived[id] === 1) lines.push('Đã hồi sinh');
  return lines;
};

/** Góc trên-trái của bảng cỡ `size` mở ở dưới-phải `anchor`, lật sang trái/lên và kẹp trong màn. */
export const placeInfoBox = (anchor: Point, size: Size, screen: Size): Point => {
  let x = anchor.x + ANCHOR_GAP;
  if (x + size.w > screen.w - SCREEN_MARGIN) x = anchor.x - ANCHOR_GAP - size.w;
  let y = anchor.y + ANCHOR_GAP;
  if (y + size.h > screen.h - SCREEN_MARGIN) y = anchor.y - ANCHOR_GAP - size.h;
  return {
    x: Math.max(0, Math.min(x, screen.w - size.w)),
    y: Math.max(0, Math.min(y, screen.h - size.h)),
  };
};

/**
 * Tóm tắt cuối ván (spec §10.8, G3): năm hoàn thành, vua đã chinh phục, boss đã hạ, vương miện vàng
 * (chỉ khi boss 3 thật sự bị hạ). Điểm Vương Miện và mở khoá là của G4 nên chưa hiện ở đây.
 */
export const runSummary = (state: RunState): string[] => {
  const s = state.stats;
  const lines = [
    `Năm hoàn thành: ${s.completedYears} / ${state.rules.years}`,
    `Trận thắng: ${s.battlesWon} · Trận thua: ${s.battlesLost}`,
    `Địch đã hạ: ${s.kills}`,
    `Vua đã chinh phục: ${s.conquered} / ${state.enemyKings.length || 2}`,
  ];
  if (state.rules.calendar === 'full') lines.push(`Boss đã hạ: ${s.bossesDefeated.length} / 3`);
  lines.push(`Vàng kiếm được: ${s.goldEarned}`);
  if (s.bossesDefeated.includes('boss_crownless_king')) lines.push('Vương Miện Vàng: đã hạ Vua Không Ngai!');
  return lines;
};

const num = (n: number): string => String(Math.round(n * 100) / 100);

/** Dòng chữ của model nhà (chỉ định dạng; số liệu đã hiệu dụng trong model). Không gồm khối chỉ số lính. */
export const buildingModelLines = (m: BuildingInfoModel): readonly string[] => [
  m.title,
  m.stars.label,
  m.liveHp ? `Máu: ${m.liveHp.hp} / ${m.liveHp.maxHp}` : `Máu: ${num(m.hp)}`,
  ...m.description,
  ...(m.age ? [`Tuổi: ${m.age.years} năm${m.age.bonus > 0 ? ` (thêm ${m.age.bonus})` : ''}`] : []),
  ...m.enchants.map((e) => `Bùa: ${e}`),
  ...(m.next ? ['Cấp sau:', ...m.next] : []),
];

/** Dòng chữ của model lính. */
export const unitModelLines = (m: UnitInfoModel): readonly string[] => [
  m.title,
  m.sourceLevel === null ? 'Không từ công trình của bạn' : `Cấp ${m.sourceLevel}/5`,
  `Máu: ${m.hp} / ${m.maxHp}`,
  m.attacksPerSecond > 0
    ? `Sát thương: ${num(m.dmg)} (${m.damageType}) · ${num(m.attacksPerSecond)} đòn/giây`
    : 'Không tấn công',
  `Tầm đánh: ${num(m.range)} · Tốc độ: ${num(m.speed)}`,
  `Giáp: ${m.armorPct}%`,
  ...(m.shield > 0 ? [`Khiên: ${m.shield}`] : []),
  ...(m.tags.length > 0 ? [`Loại: ${m.tags.join(', ')}`] : []),
  ...m.behaviours,
  ...m.statuses,
];
