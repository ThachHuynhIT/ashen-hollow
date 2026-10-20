/** Hiệu ứng `custom` của thẻ trung lập (spec §6.1). */
import type { IncomeHandler } from './types';

/** Trại Đánh Thuê: phí duy trì `params.gold` (mặc định 1) vàng mỗi đầu năm — trả về số âm. */
export const mercenaryUpkeep: IncomeHandler = (_ctx, params) => {
  const gold = params.gold;
  return -(typeof gold === 'number' ? gold : 1);
};
