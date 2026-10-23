/** Báo trước sứ giả (nhiệm vụ) cho HUD lên kế hoạch (thuần, không gieo RNG, không ghi state). */
import { QUESTS } from '../../data/quests';
import { RUN } from '../../data/run';
import type { RunState } from '../../game/run/state';

export interface QuestNotice {
  /** Năm có sứ giả kế tiếp theo lịch, hoặc null nếu hết/không có. */
  nextYear: number | null;
  active: number;
  capacity: number;
  headline: string;
  detail: string;
  /** Đã đủ chỗ nên sứ giả sẽ không đến. */
  blocked: boolean;
}

const EMPTY = (active: number): QuestNotice => ({
  nextYear: null,
  active,
  capacity: RUN.maxActiveQuests,
  headline: '',
  detail: '',
  blocked: false,
});

/** Nhãn sứ giả trên ô lịch của `year` (chỉ ván full gọi), hoặc null. */
export const questCalendarLabel = (year: number): string | null =>
  (RUN.questYears as readonly number[]).includes(year) ? 'Sứ giả' : null;

export const questNotice = (state: RunState): QuestNotice => {
  const active = state.quests.filter((q) => q.status === 'active').length;
  if (state.rules.calendar !== 'full') return EMPTY(active);
  const capacity = RUN.maxActiveQuests;
  const base = { active, capacity };
  if (state.phase === 'quest') {
    return { ...base, nextYear: state.year, headline: 'Sứ giả đang chờ', detail: 'Hãy nhận hoặc từ chối đề nghị nhiệm vụ.', blocked: false };
  }
  const nextYear = (RUN.questYears as readonly number[]).find((y) => y > state.year) ?? null;
  if (nextYear === null) {
    return { ...base, nextYear: null, headline: 'Hết sứ giả trong ván này', detail: 'Các năm có sứ giả đã qua.', blocked: false };
  }
  if (active >= capacity) {
    return {
      ...base,
      nextYear,
      headline: `Đã đủ ${capacity} nhiệm vụ`,
      detail: `Sứ giả chỉ đến khi bạn có dưới ${capacity} nhiệm vụ. Hoàn thành hoặc để một nhiệm vụ hết hạn trước năm ${nextYear}.`,
      blocked: true,
    };
  }
  if (QUESTS.every((q) => state.offeredQuestIds.includes(q.id))) {
    return { ...base, nextYear, headline: 'Không còn nhiệm vụ mới', detail: 'Mọi nhiệm vụ đã được đề nghị.', blocked: true };
  }
  const when = nextYear === state.year + 1 ? 'Năm tới' : `Năm ${nextYear}`;
  return {
    ...base,
    nextYear,
    headline: `${when}: Sứ giả`,
    detail: `Sứ giả có thể đề nghị một nhiệm vụ ở đầu năm ${nextYear}, nếu bạn đang có dưới ${capacity} nhiệm vụ.`,
    blocked: false,
  };
};
