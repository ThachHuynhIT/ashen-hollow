/**
 * Model thông tin nhà và lính (thuần). Chỉ số hiệu dụng lấy từ `structureFor` (cùng phép dựng với vào trận)
 * và từ `BattleWorld` đang chạy; UI không tự tính lại luật.
 */
import { TICKS_PER_SECOND } from '../../core/SimClock';
import type { CardDef, Level, UnitDef } from '../../data/types';
import { KIND_THRONE, KIND_UNIT, type BattleWorld } from '../../game/battle/world';
import type { UnitStats } from '../../game/battle/types';
import { describeCard } from '../../game/cards/describe';
import { ageOf } from '../../game/cards/custom/grove';
import type { Content } from '../../game/cards/registry';
import { structureFor } from '../../game/run/battleSetup';
import type { RunState } from '../../game/run/state';
import { behaviourLabel, damageTypeLabel, unitTagLabel } from './labels';
import { statusLines } from './infoLines';

const THRONE_PLOT = 12;
const DMG_BY_CODE = ['physical', 'fire', 'magic'] as const;

export interface LevelStars {
  readonly filled: Level;
  readonly total: 5;
  readonly label: string;
}

export const levelStars = (level: Level): LevelStars => ({ filled: level, total: 5, label: `Cấp ${level}/5` });

export interface UnitInfoModel {
  readonly title: string;
  /** Cấp của công trình sinh ra lính; null = không từ công trình của người chơi. */
  readonly sourceLevel: Level | null;
  readonly hp: number;
  readonly maxHp: number;
  readonly dmg: number;
  readonly damageType: string;
  /** px, khoảng cách mép–mép. */
  readonly range: number;
  readonly attacksPerSecond: number;
  readonly armorPct: number;
  readonly shield: number;
  /** px mỗi giây. */
  readonly speed: number;
  readonly tags: readonly string[];
  readonly behaviours: readonly string[];
  readonly statuses: readonly string[];
}

export interface BuildingInfoModel {
  readonly plot: number;
  readonly uid: number;
  readonly title: string;
  readonly stars: LevelStars;
  readonly hp: number;
  /** Máu đang có trong trận (chỉ khi mở từ trận). */
  readonly liveHp: { readonly hp: number; readonly maxHp: number } | null;
  readonly description: readonly string[];
  readonly next: readonly string[] | null;
  readonly enchants: readonly string[];
  readonly age: { readonly years: number; readonly bonus: number } | null;
  readonly spawn: UnitInfoModel | null;
}

const perSecond = (interval: number): number => (interval > 0 ? TICKS_PER_SECOND / interval : 0);

const levelOf = (state: RunState, plot: number): Level =>
  plot === THRONE_PLOT ? state.throneLevel : state.plots[plot]!.building!.level;

/** Clone chỉ đổi cấp của đúng nhà/Ngai; không chạy lệnh thật nên không đụng bộ đếm. */
const atLevel = (state: RunState, plot: number, level: Level): RunState =>
  plot === THRONE_PLOT
    ? { ...state, throneLevel: level }
    : {
        ...state,
        plots: state.plots.map((p, i) => (i === plot ? { ...p, building: { ...p.building!, level } } : p)),
      };

const fmt = (n: number): string => String(Math.round(n * 100) / 100);
const change = (label: string, from: number, to: number): string[] =>
  from === to ? [] : [`${label}: ${fmt(from)} → ${fmt(to)}`];

export const unitPreviewModel = (stats: UnitStats, def: UnitDef, sourceLevel: Level | null): UnitInfoModel => ({
  title: def.nameVi,
  sourceLevel,
  hp: stats.hp,
  maxHp: stats.hp,
  dmg: stats.dmg,
  damageType: damageTypeLabel(stats.dmgType),
  range: stats.range,
  attacksPerSecond: perSecond(stats.interval),
  armorPct: Math.round(stats.armor * 100),
  shield: Math.ceil(stats.shield),
  speed: stats.speed * TICKS_PER_SECOND,
  tags: (def.tags ?? []).map(unitTagLabel),
  behaviours: (def.behaviours ?? []).map(behaviourLabel),
  statuses: [],
});

/** Ô của công trình/Ngai ứng với thực thể trong trận; null nếu không phải công trình của ván. */
export const plotOfEntity = (world: BattleWorld, id: number, state: RunState): number | null => {
  if (world.kind[id] === KIND_THRONE) return THRONE_PLOT;
  const plot = state.plots.findIndex((p) => p.building?.uid === world.sourceUid[id]);
  return plot >= 0 && world.team[id] === 0 ? plot : null;
};

export const buildingInfoModel = (
  state: RunState,
  plot: number,
  content: Content,
  live?: { hp: number; maxHp: number },
): BuildingInfoModel | null => {
  const b = state.plots[plot]?.building;
  if (!b) return null;
  const card = content.card(b.cardId);
  const level = levelOf(state, plot);
  const setup = structureFor(state, plot, content);
  const spawnDef = setup.spawn ? content.unit(setup.spawn.stats.unit) : null;

  let next: string[] | null = null;
  if (level < 5) {
    const up = (level + 1) as Level;
    const after = structureFor(atLevel(state, plot, up), plot, content);
    next = [
      ...change('Máu', setup.hp, after.hp),
      ...(setup.spawn && after.spawn
        ? [
            ...change('Số lính', setup.spawn.count, after.spawn.count),
            ...change('Máu lính', setup.spawn.stats.hp, after.spawn.stats.hp),
            ...change('Sát thương lính', setup.spawn.stats.dmg, after.spawn.stats.dmg),
          ]
        : []),
      ...(setup.attack && after.attack
        ? [...change('Sát thương', setup.attack.dmg, after.attack.dmg), ...change('Tầm', setup.attack.range, after.attack.range)]
        : []),
      ...describeCard(card, up).lines,
    ];
  }

  const hasAge = ('tags' in card && (card as CardDef & { tags: readonly string[] }).tags.includes('grove')) || b.ageBonus > 0;
  return {
    plot,
    uid: b.uid,
    title: card.nameVi,
    stars: levelStars(level),
    hp: setup.hp,
    liveHp: live ? { hp: Math.ceil(Math.max(live.hp, 0)), maxHp: Math.round(live.maxHp) } : null,
    description: describeCard(card, level).lines,
    next,
    enchants: b.enchants.map((e) => `${content.card(e.cardId).nameVi} ×${e.stacks}`),
    age: hasAge ? { years: ageOf(b, state.year), bonus: b.ageBonus } : null,
    spawn: setup.spawn && spawnDef ? unitPreviewModel(setup.spawn.stats, spawnDef, level) : null,
  };
};

/** Bảng lính đang sống; null nếu id không phải lính còn sống. Máu/sát thương/tốc đánh lấy từ world. */
export const unitInfoModel = (
  world: BattleWorld,
  id: number,
  state: RunState,
  content: Content,
): UnitInfoModel | null => {
  if (id < 0 || id >= world.count || world.alive[id] !== 1 || world.kind[id] !== KIND_UNIT) return null;
  const def = content.unit(world.label[id]!);
  const uid = world.sourceUid[id]!;
  let sourceLevel: Level | null = null;
  if (uid >= 0 && world.team[id] === 0) {
    const plot = state.plots.findIndex((p) => p.building?.uid === uid);
    if (plot >= 0) sourceLevel = levelOf(state, plot);
  }
  return {
    title: def.nameVi,
    sourceLevel,
    hp: Math.ceil(Math.max(world.hp[id]!, 0)),
    maxHp: Math.round(world.maxHp[id]!),
    dmg: world.dmg[id]!,
    damageType: damageTypeLabel(DMG_BY_CODE[world.dmgType[id]!] ?? 'physical'),
    range: world.range[id]!,
    attacksPerSecond: perSecond(world.interval[id]!),
    armorPct: Math.round(world.armor[id]! * 100),
    shield: Math.ceil(world.shield[id]!),
    speed: world.speed[id]! * TICKS_PER_SECOND,
    tags: (def.tags ?? []).map(unitTagLabel),
    behaviours: (def.behaviours ?? []).map(behaviourLabel),
    statuses: statusLines(world, id),
  };
};
