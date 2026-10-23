/**
 * Vòng tầm của nhà và thực thể trong trận (thuần). Bán kính lấy đúng từ setup/world, không tính lại luật:
 * - đòn đánh đo khoảng cách MÉP–MÉP, nên vòng tới mép mục tiêu là `range + radius nguồn` (chưa cộng bán kính mục tiêu);
 * - xung, aura, khiên, khiêu khích, chuông đo từ TÂM nên dùng đúng bán kính runtime.
 */
import { BATTLE } from '../../data/battle';
import { KIND_STRUCTURE, KIND_THRONE, type BattleWorld } from '../../game/battle/world';
import type { Content } from '../../game/cards/registry';
import { structureFor } from '../../game/run/battleSetup';
import type { RunState } from '../../game/run/state';

export interface RangeSpec {
  readonly kind: 'attack' | 'minimum' | 'pulse' | 'aura' | 'shield' | 'taunt' | 'bell' | 'heal';
  /** px thế giới (chưa nhân zoom). */
  readonly radius: number;
  readonly label: string;
}

const THRONE_PLOT = 12;

const LABEL = {
  attack: 'Tầm bắn (tới mép mục tiêu)',
  minimum: 'Tầm tối thiểu (tới mép mục tiêu)',
  pulse: 'Xung (tính từ tâm)',
  aura: 'Hào quang hồi máu (tính từ tâm)',
  shield: 'Xung khiên (tính từ tâm)',
  taunt: 'Khiêu khích (tính từ tâm)',
  bell: 'Chuông (tính từ tâm)',
  heal: 'Hồi máu đồng minh (tính từ tâm)',
} as const;

const spec = (kind: RangeSpec['kind'], radius: number): RangeSpec[] =>
  radius > 0 ? [{ kind, radius, label: LABEL[kind] }] : [];

/** Các vòng của công trình / Ngai ở `plot`; rỗng nếu ô trống. */
export const buildingRanges = (state: RunState, plot: number, content: Content): readonly RangeSpec[] => {
  if (plot < 0 || plot >= state.plots.length || state.plots[plot]!.building === null) return [];
  const s = structureFor(state, plot, content);
  const edge = plot === THRONE_PLOT ? BATTLE.throneRadius : BATTLE.structureRadius;
  return [
    ...(s.attack && s.attack.range > 0 ? spec('attack', s.attack.range + edge) : []),
    ...(s.attack && s.attack.minRange > 0 ? spec('minimum', s.attack.minRange + edge) : []),
    ...spec('pulse', s.pulse?.radius ?? 0),
    ...spec('aura', s.healAura?.radius ?? 0),
    ...spec('shield', s.shieldPulse?.radius ?? 0),
    ...spec('taunt', s.taunt),
    ...spec('bell', s.bell?.radius ?? 0),
  ];
};

/** Các vòng của một thực thể sống trong trận, theo giá trị đang chạy; rỗng nếu id không hợp lệ/đã chết. */
export const entityRanges = (world: BattleWorld, id: number): readonly RangeSpec[] => {
  if (id < 0 || id >= world.count || world.alive[id] !== 1) return [];
  const edge = world.radius[id]!;
  const attacks = world.interval[id]! > 0;
  const isStructure = world.kind[id] === KIND_STRUCTURE || world.kind[id] === KIND_THRONE;
  return [
    ...(attacks ? spec('attack', world.range[id]! > 0 ? world.range[id]! + edge : 0) : []),
    ...(attacks ? spec('minimum', world.minRange[id]! > 0 ? world.minRange[id]! + edge : 0) : []),
    ...spec('pulse', world.pulseRadius[id]!),
    ...spec('aura', world.auraRadius[id]!),
    ...spec('shield', world.shieldRadius[id]!),
    ...(isStructure ? spec('taunt', world.taunt[id]!) : []),
    ...spec('bell', world.bellRadius[id]!),
    ...spec('heal', world.healAllyRadius[id]!),
  ];
};
