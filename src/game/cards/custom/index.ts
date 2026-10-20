/**
 * Đăng ký handler `custom` theo `CustomEffectId`. Mỗi thẻ có handler riêng ở module cùng thư mục
 * (`neutral.ts`, `wheat.ts`, `stone.ts`, `arcane.ts`) và được nối vào đây.
 */
import type { CustomEffectId } from '../../../data/types';
import { archmageRamp, arcaneHarmony, libraryVirtualStacks, mirrorEnchants } from './arcane';
import { mercenaryUpkeep } from './neutral';
import { runeCarving } from './stone';
import { harvestFestival, peasantHorde, wheatHarvest } from './wheat';
import type { IncomeHandler, StatHandler, TomeHandler } from './types';

export const CUSTOM_STAT_HANDLERS: Partial<Record<CustomEffectId, StatHandler>> = {
  peasant_horde: peasantHorde,
  library_virtual_stacks: libraryVirtualStacks,
  archmage_ramp: archmageRamp,
  arcane_harmony: arcaneHarmony,
};
export const CUSTOM_INCOME_HANDLERS: Partial<Record<CustomEffectId, IncomeHandler>> = {
  mercenary_upkeep: mercenaryUpkeep,
  wheat_harvest: wheatHarvest,
};
export const CUSTOM_TOME_HANDLERS: Partial<Record<CustomEffectId, TomeHandler>> = {
  harvest_festival: harvestFestival,
  rune_carving: runeCarving,
  mirror_enchants: mirrorEnchants,
};
