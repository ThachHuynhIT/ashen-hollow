/** Thứ tự bước trong năm và hàng đợi lựa chọn (spec §3.2, §5.5). Thuần, không sửa đầu vào. */
import { Rng } from '../../core/random';
import type { Content } from '../cards/registry';
import { handLimit } from './decrees';
import { refillHand } from './deck';
import { hasPlayableCard } from './playable';
import type { CardOfferState, OfferState, RunPhase, RunState } from './state';

/** Bước đang mở nếu là chọn thẻ (thưởng, chinh phục, thưởng nhiệm vụ); ngược lại `null`. */
export const cardOffer = (state: Pick<RunState, 'offers'>): CardOfferState | null => {
  const offer = state.offers;
  return offer === null || offer.kind === 'council' || offer.kind === 'quest' ? null : offer;
};

/** Pha tương ứng với bước đang mở; thưởng nhiệm vụ dùng chung pha chọn thẻ `reward`. */
const phaseOf = (offer: OfferState): RunPhase => {
  switch (offer.kind) {
    case 'reward':
    case 'questReward':
      return 'reward';
    case 'conquest':
      return 'conquest';
    case 'council':
      return 'council';
    case 'quest':
      return 'quest';
  }
};

/**
 * Xếp thêm các bước chờ theo thứ tự. Chưa có bước nào đang mở thì mở bước đầu tiên; đang mở
 * thì giữ nguyên bước đó (không roll lại) và nối đuôi hàng đợi.
 */
export function enqueueOffers(state: RunState, offers: readonly OfferState[]): RunState {
  const queue = [...state.pendingOffers, ...structuredClone(offers)];
  if (state.offers !== null || queue.length === 0) return { ...state, pendingOffers: queue };
  const [first, ...rest] = queue as [OfferState, ...OfferState[]];
  return { ...state, offers: first, pendingOffers: rest, phase: phaseOf(first) };
}

/**
 * Đóng bước đang mở: mở bước kế trong hàng đợi nguyên vẹn (không roll lại), hết hàng đợi thì về
 * `yearEnd` — điểm nghỉ nội bộ trước khi sang năm (`advance`).
 */
export function closeOffer(state: RunState): RunState {
  const [next, ...rest] = state.pendingOffers;
  if (next === undefined) return { ...state, offers: null, pendingOffers: [], phase: 'yearEnd' };
  return { ...state, offers: next, pendingOffers: rest, phase: phaseOf(next) };
}

/**
 * Nửa sau của đầu năm: rút bài rồi về pha lập kế hoạch. Chỉ chạy khi `yearStartPendingDraw`;
 * gọi lần nữa không đổi gì (không rút lại, không đổi RNG).
 */
export function finishYearStart(state: RunState, content: Content): RunState {
  if (!state.yearStartPendingDraw) return state;
  const rng = new Rng(state.rng.draw);
  // A hand with no playable card would repeat every year (nothing drawn, battle auto-starts):
  // send it to the discard pile so other cards can reach the hand.
  const recycle = state.hand.length > 0 && !hasPlayableCard(state, content);
  const piles = refillHand(
    recycle ? [] : state.hand,
    state.drawPile,
    recycle ? [...state.discardPile, ...state.hand] : state.discardPile,
    rng,
    handLimit(state),
  );
  return {
    ...state,
    ...piles,
    phase: 'planning',
    yearStartPendingDraw: false,
    rng: { ...state.rng, draw: rng.getState() },
  };
}
