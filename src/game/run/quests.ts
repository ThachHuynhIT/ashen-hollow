/**
 * Nhiệm vụ (spec §7.2): đề nghị đầu năm, nhận / từ chối, và theo dõi tiến độ từ các lệnh thành
 * công. Thuần, không sửa đầu vào. Phần thanh toán thưởng / hết hạn thuộc A5.
 */
import { Rng } from '../../core/random';
import { QUESTS, QUEST_RULES } from '../../data/quests';
import { RUN } from '../../data/run';
import type { BuildingKind, QuestId } from '../../data/types';
import type { Content } from '../cards/registry';
import type { BattleResult } from '../battle/types';
import { THRONE_PLOT, attachEnchant, levelUpBuilding } from './board';
import { enqueueOffers, finishYearStart } from './flow';
import { rollRareOffers } from './rewards';
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
      (card.tags.includes('sacrifice') || card.actions.some((a) => a.type === 'sacrifice')) &&
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

const stacksOf = (b: PlotState['building']): number => (b ? b.enchants.reduce((n, e) => n + e.stacks, 0) : 0);

/** Công trình không phải Ngai, theo `plot` tăng dần. */
const built = (state: RunState, content: Content): { plot: number; level: number; kind: BuildingKind }[] =>
  state.plots.flatMap((p, plot) =>
    p.building === null || plot === THRONE_PLOT
      ? []
      : [{ plot, level: p.building.level, kind: content.card(p.building.cardId).kind as BuildingKind }],
  );

/**
 * Kiểm các nhiệm vụ đang chạy theo thứ tự nhận (spec §5.5 bước 9 và 11) và trả thưởng ngay, nên
 * thưởng của nhiệm vụ trước có thể giúp nhiệm vụ sau. `afterBattle` cần `result`; `yearEnd` xét
 * vàng cuối năm, nhiệm vụ không đổi bài và hết hạn (xong trước, hết hạn sau). Thưởng chọn thẻ
 * xếp vào hàng đợi. Nhiệm vụ đã xong / thất bại không bao giờ trả thưởng lần hai.
 */
export function settleQuests(
  state: RunState,
  result: BattleResult | null,
  at: 'afterBattle' | 'yearEnd',
  content: Content,
): RunState {
  if (!state.quests.some((q) => q.status === 'active')) return state;
  let s = structuredClone(state);
  const earn = (gold: number): void => {
    s.gold += gold;
    s.stats.goldEarned += gold;
  };
  const won = at === 'afterBattle' && result !== null && result.won;

  for (let i = 0; i < s.quests.length; i++) {
    if (s.quests[i]!.status !== 'active') continue;
    const q = s.quests[i]!;
    const done = (): void => {
      q.status = 'completed';
    };
    const board = built(s, content);
    switch (q.id) {
      case 'quest_untouched':
        if (won && result!.throneHpLostPct === 0) {
          done();
          earn(QUEST_RULES.untouchedGold);
        }
        break;
      case 'quest_three_barracks':
        if (board.filter((b) => b.kind === 'troop').length >= QUEST_RULES.barracks) {
          done();
          const rng = new Rng(s.rng.reward);
          const cardIds = rollRareOffers(
            rng,
            { king: content.king(s.kingId).cards, neutral: content.neutralPool() },
            QUEST_RULES.rareChoices,
          );
          s.rng.reward = rng.getState();
          s = enqueueOffers(s, [{ kind: 'questReward', cardIds, questId: q.id }]);
        }
        break;
      case 'quest_no_reroll':
        if (q.progress.rerolls! > 0) q.status = 'failed';
        else if (at === 'yearEnd' && s.year >= q.deadlineYear) {
          done();
          earn(QUEST_RULES.noRerollGold);
        }
        break;
      case 'quest_slaughter':
        if (at === 'afterBattle' && result !== null && result.kills >= QUEST_RULES.kills) {
          done();
          s.deck.push(QUEST_RULES.promoteCard);
          s.drawPile.unshift(QUEST_RULES.promoteCard);
        }
        break;
      case 'quest_double_rune': {
        const plot = s.plots.findIndex((p) => stacksOf(p.building) >= QUEST_RULES.stacks);
        if (plot >= 0) {
          done();
          const b = s.plots[plot]!.building!;
          if (stacksOf(b) >= RUN.maxEnchantStacks) earn(QUEST_RULES.doubleRuneFullGold);
          else s.plots = attachEnchant(s.plots, plot, b.enchants[0]!.cardId, RUN.maxEnchantStacks);
        }
        break;
      }
      case 'quest_land_grab':
        if (q.progress.opened! >= QUEST_RULES.opened) {
          done();
          earn(QUEST_RULES.landGrabGold);
        }
        break;
      case 'quest_master_builder':
        if (board.some((b) => b.level >= QUEST_RULES.level)) {
          done();
          const lowest = board.reduce((a, b) => (b.level < a.level ? b : a));
          s.plots = levelUpBuilding(s.plots, lowest.plot, 1);
        }
        break;
      case 'quest_blitz':
        if (won && result!.ticks <= QUEST_RULES.blitzTicks) {
          done();
          earn(QUEST_RULES.blitzGold);
        }
        break;
      case 'quest_hoard':
        if (at === 'yearEnd' && s.gold >= QUEST_RULES.hoardGold) {
          done();
          earn(QUEST_RULES.hoardReward);
        }
        break;
      case 'quest_no_help':
        if (won && result!.interventionsUsed === 0) {
          done();
          s.interventionDmgPct += QUEST_RULES.noHelpDmgPct;
        }
        break;
      case 'quest_offering':
        if (q.progress.sacrificeLevel! > 0) {
          done();
          earn(QUEST_RULES.offeringBase + q.progress.sacrificeLevel!);
        }
        break;
      case 'quest_diversity': {
        const kinds = new Set(board.map((b) => b.kind));
        if (QUEST_RULES.diversityKinds.every((k) => kinds.has(k))) {
          done();
          if (s.lives < RUN.startLives) s.lives += 1;
          else earn(QUEST_RULES.diversityGold);
        }
        break;
      }
      case 'quest_wager':
        if (at === 'afterBattle' && result !== null) {
          if (!result.won) {
            q.status = 'failed';
            q.progress.failedCondition = 1;
          } else {
            q.progress.winsInRow! += 1;
            if (q.progress.winsInRow! >= QUEST_RULES.wagerWins) {
              done();
              earn(QUEST_RULES.wagerGold);
            }
          }
        }
        break;
    }
    // Hết hạn sau khi đã có cơ hội hoàn thành trong cùng lượt kiểm.
    if (q.status === 'active' && at === 'yearEnd' && s.year >= q.deadlineYear) q.status = 'failed';
  }
  return s;
}
