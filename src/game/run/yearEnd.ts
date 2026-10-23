/**
 * Cuối bước năm (spec §3.2 bước 8, §5.5 bước 10–11): mở bước kế trong hàng đợi, hoặc kiểm tra
 * nhiệm vụ cuối năm rồi kết thúc ván / sang năm mới. Thuần, không sửa đầu vào.
 */
import type { Content } from '../cards/registry';
import { closeOffer } from './flow';
import { settleQuests } from './quests';
import type { RunState } from './state';
import { startYear } from './yearFlow';

/**
 * Cuối năm: chốt nhiệm vụ cuối năm (thưởng chọn thẻ thì mở trước, năm chưa đổi), rồi kết thúc
 * ván nếu hết mạng hoặc đã qua năm cuối (còn mạng = thắng ván), ngược lại sang năm sau.
 */
export function finishYear(state: RunState, content: Content): RunState {
  const settled = settleQuests(state, null, 'yearEnd', content);
  if (settled.offers !== null) return settled;
  if (settled.lives <= 0 || settled.year >= settled.rules.years) {
    return {
      ...settled,
      phase: 'ended',
      won: settled.lives > 0,
      offers: null,
      pendingOffers: [],
      pendingConquest: null,
    };
  }
  return startYear(settled, content);
}

/**
 * Sau khi một bước chọn xong (`offers` đã `null`): mở bước kế trong hàng đợi. Hết hàng đợi thì
 * luật cũ (G1/G2) và năm cuối sang `finishYear` ngay; ván đầy đủ nghỉ ở `yearEnd` chờ `advance`.
 */
export function advanceAfterBattle(state: RunState, content: Content): RunState {
  const next = closeOffer(state);
  if (next.offers !== null) return next;
  if (state.rules.calendar !== 'full' || state.year >= state.rules.years) return finishYear(next, content);
  return next;
}
