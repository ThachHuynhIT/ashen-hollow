/**
 * Đăng ký handler `custom` theo `CustomEffectId`. Rỗng ở G2a; mỗi thẻ G2b thêm handler của nó
 * ở module cùng thư mục và nối vào đây.
 */
import type { CustomEffectId } from '../../../data/types';
import type { IncomeHandler, StatHandler, TomeHandler } from './types';

export const CUSTOM_STAT_HANDLERS: Partial<Record<CustomEffectId, StatHandler>> = {};
export const CUSTOM_INCOME_HANDLERS: Partial<Record<CustomEffectId, IncomeHandler>> = {};
export const CUSTOM_TOME_HANDLERS: Partial<Record<CustomEffectId, TomeHandler>> = {};
