/** Bot chơi ngẫu nhiên hợp lệ (spec §13.3): dùng cho headless/cân bằng, luôn sinh lệnh hợp lệ. */
import type { Rng } from '../../../core/random';
import { decree } from '../../run/decrees';
import { QUESTS } from '../../../data/quests';
import { unlockCost } from '../../../data/run';
import type { CardDef } from '../../../data/types';
import type { Content } from '../../cards/registry';
import { adjacentToUnlocked, checkPlay, targetCount, unlockPlot } from '../../run/board';
import { rerollPrice } from '../../run/decrees';
import { cardOffer } from '../../run/flow';
import type { CouncilSelection, PlayTarget, RunCommand, RunState } from '../../run/state';

export type Bot = (state: RunState, content: Content, rng: Rng) => RunCommand;

const PLOTS = 25;
/** Xác suất (1/n) mỗi lượt chọn: đổi bài, mua ô, bán thẻ thay vì chơi. */
const ONE_IN_REROLL = 6;
const ONE_IN_BUY = 3;
const ONE_IN_SELL = 10;
/** Đổi bài tối đa chừng này lần mỗi năm để bot không đốt hết vàng. */
const MAX_REROLLS = 2;

/** Mọi đích có thể thử cho một thẻ (chưa lọc hợp lệ). */
const candidateTargets = (card: CardDef): PlayTarget[] => {
  const count = targetCount(card);
  if (count === 0) return [{ kind: 'none' }];
  const targets: PlayTarget[] = [];
  if (count === 2) {
    for (let first = 0; first < PLOTS; first++) {
      for (let second = 0; second < PLOTS; second++) targets.push({ kind: 'two', first, second });
    }
  } else {
    for (let plot = 0; plot < PLOTS; plot++) targets.push({ kind: 'plot', plot });
  }
  return targets;
};

const playOptions = (state: RunState, content: Content): RunCommand[] => {
  const options: RunCommand[] = [];
  state.hand.forEach((cardId, handIndex) => {
    const card = content.card(cardId);
    for (const target of candidateTargets(card)) {
      if (checkPlay(state.plots, card, target, content) === null) {
        options.push({ type: 'play', handIndex, target });
      }
    }
  });
  return options;
};

/**
 * Bước hội đồng: chọn sắc lệnh, rồi dựng phần chọn phụ HỢP LỆ và ổn định (lấy ô thấp nhất, thẻ hiếm
 * đầu tiên, không loại bài) để lần gọi sau thấy đã khớp và ban hành.
 */
const councilCommand = (state: RunState, content: Content, rng: Rng): RunCommand => {
  const offer = state.offers;
  if (offer?.kind !== 'council') throw new Error('randomBot: no council offer');
  if (offer.selected === null) return { type: 'chooseDecree', index: rng.int(0, offer.decreeIds.length - 1) };
  const want: CouncilSelection = { plots: [], cardId: null, deckIndices: [] };
  const action = decree(offer.selected).action;
  if (action === 'expand') {
    let plots = state.plots;
    const target = Math.min(2, plots.filter((p) => !p.unlocked).length);
    while (want.plots.length < target) {
      const plot = plots.findIndex((p, i) => !p.unlocked && adjacentToUnlocked(plots, i));
      want.plots.push(plot);
      plots = unlockPlot(plots, plot);
    }
  } else if (action === 'academy') {
    want.cardId = content.king(state.kingId).cards.find((c) => c.rarity === 'rare')?.id ?? null;
  }
  if (JSON.stringify(want) !== JSON.stringify(offer.selection)) return { type: 'setCouncilSelection', selection: want };
  return { type: 'enactDecree' };
};

export const randomBot: Bot = (state, content, rng) => {
  switch (state.phase) {
    case 'planning': {
      if (state.played) return { type: 'startBattle' };
      // Các lệnh phụ (không dùng lượt): đổi bài, mua ô.
      const cost = rerollPrice(state);
      if (state.rerollsThisYear < MAX_REROLLS && state.gold >= cost && rng.int(1, ONE_IN_REROLL) === 1) {
        return { type: 'reroll' };
      }
      if (state.gold >= unlockCost(state.purchasedPlots) && rng.int(1, ONE_IN_BUY) === 1) {
        const buyable: number[] = [];
        for (let plot = 0; plot < PLOTS; plot++) {
          if (!state.plots[plot]!.unlocked && adjacentToUnlocked(state.plots, plot)) buyable.push(plot);
        }
        if (buyable.length > 0) return { type: 'unlockPlot', plot: rng.pick(buyable) };
      }
      const options = playOptions(state, content);
      if (state.hand.length > 0 && rng.int(1, ONE_IN_SELL) === 1) {
        return { type: 'discard', handIndex: rng.int(0, state.hand.length - 1) };
      }
      // Không có nước đi hợp lệ nghĩa là không lá nào chơi được: startBattle hợp lệ.
      return options.length === 0 ? { type: 'startBattle' } : rng.pick(options);
    }
    case 'quest': {
      const fee = state.offers?.kind === 'quest' ? QUESTS.find((q) => q.id === (state.offers as { questId: string }).questId)!.acceptGold : 0;
      return { type: 'answerQuest', accept: state.gold >= fee && rng.int(0, 1) === 1 };
    }
    case 'council':
      return councilCommand(state, content, rng);
    case 'reward': {
      const offer = cardOffer(state);
      const count = offer?.cardIds.length ?? 0;
      // Thưởng nhiệm vụ không được bỏ qua.
      if (offer?.kind === 'questReward') return { type: 'pickOffer', index: count === 0 ? 0 : rng.int(0, count - 1) };
      if (count === 0 || rng.int(0, 3) === 0) return { type: 'pickOffer', index: null };
      return { type: 'pickOffer', index: rng.int(0, count - 1) };
    }
    case 'conquest': {
      // Chinh phục bắt buộc chọn một thẻ.
      const count = cardOffer(state)?.cardIds.length ?? 0;
      return { type: 'pickOffer', index: count === 0 ? 0 : rng.int(0, count - 1) };
    }
    case 'yearEnd':
      return { type: 'advance' };
    default:
      throw new Error(`randomBot: no command in phase ${state.phase}`);
  }
};
