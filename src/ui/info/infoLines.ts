/** Nội dung bảng thông tin nhà / lính (spec §10.7) và chỗ đặt bảng; thuần, không Phaser. */
import { STRUCT_HP } from '../../data/scaling';
import type { CardDef } from '../../data/types';
import { KIND_UNIT, type BattleWorld } from '../../game/battle/world';
import { describeCard } from '../../game/cards/describe';
import type { Content } from '../../game/cards/registry';
import type { BuildingState } from '../../game/run/state';
import { UI_PALETTE } from '../../data/uiPalette';
import type { Point, Size, TooltipContent } from '../hud/layout';

/** Bấm trượt tối đa chừng này px ngoài vòng va chạm vẫn tính là trúng. */
const HIT_SLOP = 4;
/** Khoảng cách từ điểm bấm tới bảng. */
const ANCHOR_GAP = 12;
const SCREEN_MARGIN = 4;

const DMG_TEXT = ['vật lý', 'lửa', 'phép'] as const;
const DMG_INDEX = { physical: 0, fire: 1, magic: 2 } as const;

/** Máu công trình của một thẻ ở cấp `level` (Ngai: máu Ngai). */
const structureHp = (card: CardDef, level: BuildingState['level']): number | null => {
  if (card.kind === 'throne') return card.hp;
  if (card.kind === 'troop' || card.kind === 'tower') {
    return card.structureHp ? card.structureHp[level - 1]! : STRUCT_HP[card.kind];
  }
  return null;
};

/** Tên, cấp, máu công trình và mô tả thẻ (cùng `describeCard` với tooltip). */
export const buildingInfoLines = (building: BuildingState, content: Content): string[] => {
  const card = content.card(building.cardId);
  const lines = [card.nameVi, `Cấp ${building.level}`];
  const hp = structureHp(card, building.level);
  if (hp !== null) lines.push(`Máu: ${hp}`);
  lines.push(...describeCard(card, building.level).lines);
  lines.push(...spawnedUnitLines(card, building.level, content));
  return lines;
};

/** Mỗi hiệu ứng `spawn`: "Lính: tên ×số lượng" và một dòng chỉ số gốc của lính (chưa tính Bùa/cộng thêm). */
const spawnedUnitLines = (card: CardDef, level: BuildingState['level'], content: Content): string[] => {
  if (!('effects' in card)) return [];
  const out: string[] = [];
  for (const e of card.effects) {
    if (e.type !== 'spawn') continue;
    const unit = content.unit(e.unit);
    const count = typeof e.count === 'number' ? e.count : e.count[level - 1]!;
    out.push(`Lính: ${unit.nameVi} ×${count}`);
    const a = unit.attack;
    out.push(
      `Máu lính ${unit.hp} · Sát thương ${a.dmg} (${DMG_TEXT[DMG_INDEX[a.type]] ?? 'vật lý'}) · Tầm ${a.range} · Giáp ${Math.round(unit.armor * 100)}%`,
    );
  }
  return out;
};

const tintOf = (line: string): number | undefined => {
  if (line.startsWith('Lính:') || line.startsWith('Máu lính')) return UI_PALETTE.woodDark;
  if (line.startsWith('Cấp ')) return UI_PALETTE.wood;
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

const nameOf = (world: BattleWorld, id: number, content: Content): string => {
  const label = world.label[id]!;
  try {
    return world.kind[id] === KIND_UNIT
      ? content.unit(label).nameVi
      : content.card(label as CardDef['id']).nameVi;
  } catch {
    return label;
  }
};

/** Tên, máu hiện tại / tối đa, sát thương, tầm đánh và giáp của một thực thể trong trận. */
export const entityInfoLines = (world: BattleWorld, id: number, content: Content): string[] => {
  const lines = [nameOf(world, id, content)];
  lines.push(`Máu: ${Math.ceil(Math.max(world.hp[id]!, 0))} / ${Math.round(world.maxHp[id]!)}`);
  if (world.interval[id]! > 0) {
    lines.push(`Sát thương: ${world.dmg[id]!} (${DMG_TEXT[world.dmgType[id]!] ?? 'vật lý'})`);
    lines.push(`Tầm đánh: ${world.range[id]!}`);
  } else {
    lines.push('Không tấn công');
  }
  lines.push(`Giáp: ${Math.round(world.armor[id]! * 100)}%`);
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
