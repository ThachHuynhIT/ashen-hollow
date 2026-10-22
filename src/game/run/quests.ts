/**
 * Nhiệm vụ (spec §7.2): đề nghị đầu năm, nhận / từ chối, và theo dõi tiến độ từ các lệnh thành
 * công. Thuần, không sửa đầu vào. Phần thanh toán thưởng / hết hạn thuộc A5.
 */
import { Rng } from '../../core/random';
import { QUESTS } from '../../data/quests';
import { RUN } from '../../data/run';
import type { QuestId } from '../../data/types';
import type { Content } from '../cards/registry';
import { finishYearStart } from './flow';
import type { IllegalReason, PlotState, QuestState, RunCommand, RunState } from './state';

const unlockedCount = (plots: readonly PlotState[]): number => plots.filter((p) => p.unlocked).length;

const newProgress = (): QuestState['progress'] => ({
  rerolls: 0,
  opened: 0,
  sacrificeLevel: 0,
  winsInRow: 0,
  failedCondition: 0,
});

export const questDef = (id: QuestId) => {
  const def = QUESTS.find((q) => q.id === id);
  if (def === undefined) throw new Error(`Unknown quest ${id}`);
  return def;
};

/**
 * Đề nghị một nhiệm vụ chưa từng được đề nghị nếu năm thuộc `RUN.questYears` và còn chỗ
 * (`RUN.maxActiveQuests`). Bốc bằng `Rng(stream 'quest')`; mở bước `quest` và giữ lại việc rút bài.
 * Không đủ điều kiện thì trả nguyên trạng thái.
 */
export function offerQuest(state: RunState): RunState {
  if (!(RUN.questYears as readonly number[]).includes(state.year)) return state;
  const active = state.quests.filter((q) => q.status === 'active').length;
  if (active >= RUN.maxActiveQuests) return state;
  const pool = QUESTS.map((q) => q.id).filter((id) => !state.offeredQuestIds.includes(id));
  if (pool.length === 0) return state;
  const rng = new Rng(state.rng.quest);
  const questId = rng.pick(pool);
  return {
    ...state,
    phase: 'quest',
    offers: { kind: 'quest', questId },
    rng: { ...state.rng, quest: rng.getState() },
  };
}

/**
 * Trả lời đề nghị: nhận (trả phí nếu có) hoặc từ chối; cả hai đều đánh dấu đã đề nghị, đóng bước
 * và hoàn tất đầu năm (rút bài). Thiếu vàng → `notEnoughGold`, không đổi gì.
 */
export function answerQuest(state: RunState, accept: boolean, content: Content): RunState | IllegalReason {
  if (state.phase !== 'quest' || state.offers?.kind !== 'quest') return 'wrongPhase';
  const { questId } = state.offers;
  const def = questDef(questId);
  if (accept && state.gold < def.acceptGold) return 'notEnoughGold';
  const next: RunState = {
    ...structuredClone(state),
    offers: null,
    offeredQuestIds: [...state.offeredQuestIds, questId],
  };
  if (accept) {
    next.gold -= def.acceptGold;
    next.quests.push({
      id: questId,
      offeredYear: state.year,
      deadlineYear: state.year + def.duration - 1,
      status: 'active',
      progress: newProgress(),
    });
  }
  return finishYearStart(next, content);
}

/**
 * Ghi tiến độ của các nhiệm vụ đang chạy sau một lệnh THÀNH CÔNG (`after` là kết quả của lệnh).
 * Đếm từ lúc nhận (mọi bộ đếm bắt đầu từ 0): đổi bài (kể cả miễn phí), ô mở thêm (đo trên bàn cờ nên
 * mua ô, Khai Hoang và sắc lệnh đều tính), và cấp công trình bị hiến tế.
 */
export function recordQuestCommand(
  before: RunState,
  after: RunState,
  command: RunCommand,
  content: Content,
): RunState {
  if (!after.quests.some((q) => q.status === 'active')) return after;
  const opened = unlockedCount(after.plots) - unlockedCount(before.plots);
  let sacrificed = 0;
  if (command.type === 'play') {
    const card = content.card(before.hand[command.handIndex]!);
    if (
      card.kind === 'tome' &&
      card.actions.some((a) => a.type === 'sacrifice') &&
      command.target.kind === 'plot'
    ) {
      sacrificed = before.plots[command.target.plot]?.building?.level ?? 0;
    }
  }
  const rerolled = command.type === 'reroll' ? 1 : 0;
  if (opened <= 0 && sacrificed === 0 && rerolled === 0) return after;
  return {
    ...after,
    quests: after.quests.map((q) =>
      q.status !== 'active'
        ? q
        : {
            ...q,
            progress: {
              ...q.progress,
              rerolls: q.progress.rerolls! + rerolled,
              opened: q.progress.opened! + Math.max(opened, 0),
              sacrificeLevel: Math.max(q.progress.sacrificeLevel!, sacrificed),
            },
          },
    ),
  };
}
