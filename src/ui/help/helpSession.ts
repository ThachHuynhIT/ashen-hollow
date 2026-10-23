import type { GameSpeed } from '../../core/SimClock';

/** Trạng thái đóng/mở Trợ giúp và tốc độ cần trả. `null` = không có trận (menu/lên kế hoạch); `0` = đang tạm dừng — hai thứ khác nhau. */
export interface HelpSession {
  readonly open: boolean;
  readonly restoreSpeed: GameSpeed | null;
}

/** Mở Trợ giúp ghi nhớ tốc độ hiện tại; mở lần hai (đồng hồ đã bị tạm dừng) giữ nguyên tốc độ gốc. */
export const openHelpSession = (speed: GameSpeed | null, current?: HelpSession): HelpSession =>
  current?.open ? current : { open: true, restoreSpeed: speed };

/** Đóng: trả tốc độ đã nhớ (null nếu chưa mở). */
export const closeHelpSession = (session: HelpSession): { speed: GameSpeed | null } => ({
  speed: session.open ? session.restoreSpeed : null,
});
