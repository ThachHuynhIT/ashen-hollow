/**
 * Đăng ký handler `custom` theo `CustomEffectId`. Mỗi thẻ có handler riêng ở module cùng thư mục
 * (`neutral.ts`, `wheat.ts`, `stone.ts`, `arcane.ts`) và được nối vào đây.
 */
import type { CardDef, CustomEffectId } from '../../../data/types';
import type { BattleResult } from '../../battle/types';
import type { PlayTarget, RunState } from '../../run/state';
import type { Content } from '../registry';
import { archmageRamp, arcaneHarmony, libraryVirtualStacks, mirrorEnchants } from './arcane';
import { CLOCK_HOOKS, rewind } from './clock';
import { FORGE_HOOKS, armoryArmor, masterHammer } from './forge';
import type { FullRunCardHooks } from './fullRunTypes';
import { GROVE_HOOKS, springRain } from './grove';
import { mercenaryUpkeep } from './neutral';
import { runeCarving } from './stone';
import { TIDE_HOOKS, privateers, treasureChest } from './tide';
import { harvestFestival, peasantHorde, wheatHarvest } from './wheat';
import type { IncomeHandler, StatHandler, TomeHandler } from './types';

export const CUSTOM_STAT_HANDLERS: Partial<Record<CustomEffectId, StatHandler>> = {
  peasant_horde: peasantHorde,
  library_virtual_stacks: libraryVirtualStacks,
  archmage_ramp: archmageRamp,
  arcane_harmony: arcaneHarmony,
  armory_armor: armoryArmor,
};
export const CUSTOM_INCOME_HANDLERS: Partial<Record<CustomEffectId, IncomeHandler>> = {
  mercenary_upkeep: mercenaryUpkeep,
  wheat_harvest: wheatHarvest,
  treasure_chest: treasureChest,
};
export const CUSTOM_TOME_HANDLERS: Partial<Record<CustomEffectId, TomeHandler>> = {
  harvest_festival: harvestFestival,
  rune_carving: runeCarving,
  mirror_enchants: mirrorEnchants,
  spring_rain: springRain,
  privateers,
  master_hammer: masterHammer,
  rewind,
};

/**
 * Móc của ván đầy đủ theo thứ tự đăng ký grove / tide / forge / clock / moon / nomad (§5.5);
 * mỗi task thêm móc của vua mình ở đây.
 */
export const FULL_RUN_CARD_HOOKS: readonly Partial<FullRunCardHooks>[] = [GROVE_HOOKS, TIDE_HOOKS, FORGE_HOOKS, CLOCK_HOOKS];

export const runYearGrowth = (state: RunState, content: Content): RunState =>
  FULL_RUN_CARD_HOOKS.reduce((s, h) => (h.yearGrowth ? h.yearGrowth(s, content) : s), state);

export const runAfterPlay = (
  before: RunState,
  after: RunState,
  card: CardDef,
  target: PlayTarget,
  content: Content,
): RunState =>
  FULL_RUN_CARD_HOOKS.reduce((s, h) => (h.afterPlay ? h.afterPlay(before, s, card, target, content) : s), after);

export const runAfterMove = (state: RunState, from: number, to: number, content: Content): RunState =>
  FULL_RUN_CARD_HOOKS.reduce((s, h) => (h.afterMove ? h.afterMove(s, from, to, content) : s), state);

export const runBattleEnd = (state: RunState, result: BattleResult, content: Content): RunState =>
  FULL_RUN_CARD_HOOKS.reduce((s, h) => (h.battleEnd ? h.battleEnd(s, result, content) : s), state);
