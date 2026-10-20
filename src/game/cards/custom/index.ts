/**
 * Đăng ký handler `custom` theo `CustomEffectId`. Mỗi thẻ có handler riêng ở module cùng thư mục
 * (`neutral.ts`, `wheat.ts`, `stone.ts`, `arcane.ts`) và được nối vào đây.
 */
import type { CustomEffectId } from '../../../data/types';
import { mercenaryUpkeep } from './neutral';
import type { IncomeHandler, StatHandler, TomeHandler } from './types';

export const CUSTOM_STAT_HANDLERS: Partial<Record<CustomEffectId, StatHandler>> = {};
export const CUSTOM_INCOME_HANDLERS: Partial<Record<CustomEffectId, IncomeHandler>> = {
  mercenary_upkeep: mercenaryUpkeep,
};
export const CUSTOM_TOME_HANDLERS: Partial<Record<CustomEffectId, TomeHandler>> = {};
