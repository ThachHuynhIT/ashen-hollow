/**
 * Móc theo thời điểm của ván đầy đủ (spec §5.5): các thẻ chinh phục cần thay đổi trạng thái ván
 * vào đúng lúc (tăng trưởng đầu năm, sau khi chơi thẻ, sau khi dời công trình, sau trận). Mỗi vua
 * khai báo một `Partial<FullRunCardHooks>`; thứ tự gọi là thứ tự đăng ký ở `custom/index.ts`.
 */
import type { CardDef } from '../../../data/types';
import type { BattleResult } from '../../battle/types';
import type { PlayTarget, RunState } from '../../run/state';
import type { Content } from '../registry';

export interface FullRunCardHooks {
  /** Bước 3 đầu năm: tăng trưởng tự động (sau `year += 1`, trước thu nhập). */
  yearGrowth(state: RunState, content: Content): RunState;
  /** Sau khi chơi một thẻ thành công (`before` trước lệnh, `after` sau lệnh). */
  afterPlay(before: RunState, after: RunState, card: CardDef, target: PlayTarget, content: Content): RunState;
  /** Sau khi một công trình được dời từ ô `from` sang ô `to`. */
  afterMove(state: RunState, from: number, to: number, content: Content): RunState;
  /** Sau trận, trước kiểm tra nhiệm vụ (§5.5 bước 9). */
  battleEnd(state: RunState, result: BattleResult, content: Content): RunState;
}
