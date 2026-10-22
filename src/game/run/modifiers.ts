/**
 * Bộ gộp chỉ số (spec §5.3): với một công trình trên bàn cờ, cộng mọi modifier từ thẻ của nó,
 * Bùa của nó, công trình khác (lân cận / toàn bàn cờ), bị động Ngai và `permanent`, thành một
 * `StatSheet` rồi `finalStat` ra giá trị cuối. Thuần, không sửa đầu vào.
 */
import type {
  BuildingKind,
  CardDef,
  CustomEffectId,
  EffectDef,
  Filter,
  Level,
  Scalar,
  StatKey,
  StatMode,
  UnitDef,
} from '../../data/types';
import { CUSTOM_STAT_HANDLERS } from '../cards/custom';
import type { StatCtx, StatHandler } from '../cards/custom/types';
import type { Content } from '../cards/registry';
import { THRONE_PLOT, neighbours } from './board';
import { decree } from './decrees';
import type { BuildingState, RunState } from './state';

export interface StatCell {
  flat: number;
  pct: number;
  /** Cộng sau mọi % (Bùa Tia Lửa). */
  flatPost: number;
}
export type StatSheet = Record<StatKey, StatCell>;

const STAT_KEYS: readonly StatKey[] = [
  'hp',
  'dmg',
  'attackSpeed',
  'range',
  'speed',
  'armor',
  'unitCount',
  'structureHp',
  'knockback',
  'burnDps',
  'gold',
];

export const emptySheet = (): StatSheet =>
  Object.fromEntries(STAT_KEYS.map((k) => [k, { flat: 0, pct: 0, flatPost: 0 }])) as StatSheet;

/** `(gốc + Σflat) × (1 + Σpct / 100) + Σ flatPost` — các % cùng loại cộng với nhau, không nhân chồng. */
export const finalStat = (base: number, cell: StatCell): number =>
  (base + cell.flat) * (1 + cell.pct / 100) + cell.flatPost;

const resolve = (value: Scalar, level: number): number =>
  typeof value === 'number' ? value : value[level - 1]!;

const add = (sheet: StatSheet, stat: StatKey, mode: StatMode, value: number): void => {
  const cell = sheet[stat];
  if (mode === 'flat') cell.flat += value;
  else if (mode === 'pct') cell.pct += value;
  else cell.flatPost += value;
};

const kindOf = (card: CardDef): BuildingKind => card.kind as BuildingKind;

const matches = (filter: Filter | undefined, card: CardDef, unit: UnitDef | undefined): boolean => {
  if (!filter) return true;
  if (filter.kinds && !filter.kinds.includes(kindOf(card))) return false;
  if (filter.cardIds && !filter.cardIds.includes(card.id)) return false;
  if (filter.tags && !filter.tags.some((t) => card.tags.includes(t))) return false;
  if (filter.unitTags && (!unit || !filter.unitTags.some((t) => unit.tags.includes(t)))) return false;
  return true;
};

/** Hiệu ứng của thẻ khi đứng trên bàn cờ như một công trình / Ngai. */
const effectsOf = (card: CardDef): readonly EffectDef[] => {
  if (card.kind === 'throne') return card.passive;
  if (card.kind === 'tome' || card.kind === 'enchantment') return [];
  return card.effects;
};

const levelOf = (state: RunState, plot: number, b: BuildingState): Level =>
  plot === THRONE_PLOT ? state.throneLevel : b.level;

/** Ngai trước, rồi plot 0..24 (bỏ Ngai). */
const sourcePlots = (): number[] => {
  const out = [THRONE_PLOT];
  for (let plot = 0; plot < 25; plot++) if (plot !== THRONE_PLOT) out.push(plot);
  return out;
};

/**
 * Mọi modifier lên công trình ở `plot`, theo thứ tự §5.3: (a) hiệu ứng của chính thẻ, (b) Bùa
 * × stack, (c)(d) công trình khác (lân cận / toàn bàn cờ) và bị động Ngai theo thứ tự nguồn,
 * (g) `permanent`. `unit` (nếu có) cho phép bộ lọc `unitTags`. Handler `custom` được gọi cho
 * từng cặp (nguồn, đích) và tự quyết có áp cho đích đó không.
 */
export function collectStatSheet(
  state: RunState,
  content: Content,
  plot: number,
  unit?: UnitDef,
  handlers: Partial<Record<CustomEffectId, StatHandler>> = CUSTOM_STAT_HANDLERS,
): StatSheet {
  const sheet = emptySheet();
  const target = state.plots[plot]?.building ?? null;
  if (target === null) return sheet;
  const targetCard = content.card(target.cardId);

  const applySource = (srcPlot: number, src: BuildingState): void => {
    const srcCard = content.card(src.cardId);
    const level = levelOf(state, srcPlot, src);
    for (const e of effectsOf(srcCard)) {
      if (e.type === 'stat') {
        const related =
          e.scope === 'self'
            ? srcPlot === plot
            : e.scope === 'neighbours'
              ? neighbours(srcPlot).includes(plot)
              : true;
        if (related && matches(e.filter, targetCard, unit)) {
          add(sheet, e.stat, e.mode, resolve(e.value, level));
        }
      } else if (e.type === 'custom') {
        const handler = handlers[e.id];
        if (!handler) continue;
        const ctx: StatCtx = {
          state,
          content,
          source: { plot: srcPlot, level, stacks: 0 },
          target: { plot, building: target },
        };
        for (const m of handler(ctx, e.params ?? {})) add(sheet, m.stat, m.mode, m.value);
      }
    }
  };

  applySource(plot, target); // (a)
  for (const entry of target.enchants) {
    // (b)
    const card = content.card(entry.cardId);
    if (card.kind !== 'enchantment') continue;
    for (const e of card.perStack) {
      if (e.type === 'stat' && matches(e.filter, targetCard, unit)) {
        add(sheet, e.stat, e.mode, resolve(e.value, 1) * entry.stacks);
      }
    }
  }
  for (const srcPlot of sourcePlots()) {
    // (c)(d)
    const src = state.plots[srcPlot]!.building;
    if (src === null || srcPlot === plot) continue;
    applySource(srcPlot, src);
  }
  for (const id of state.decrees) {
    // Sắc lệnh: sau công trình và Ngai, trước `permanent` (§5.3); mỗi sắc lệnh là một nguồn.
    for (const e of decree(id).effects) {
      if (e.type === 'stat' && matches(e.filter, targetCard, unit)) {
        add(sheet, e.stat, e.mode, resolve(e.value, 1));
      }
    }
  }
  for (const [stat, value] of Object.entries(target.permanent) as [StatKey, number][]) {
    add(sheet, stat, 'pct', value); // (g)
  }
  return sheet;
}
