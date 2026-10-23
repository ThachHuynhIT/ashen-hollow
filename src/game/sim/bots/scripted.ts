/**
 * Bot theo kịch bản cố định (spec §13.3, G3d D6): cùng trạng thái luôn cho cùng lệnh, không dùng Rng,
 * không đổi bài / mua ô. Dùng để kiểm một ván thật chơi tới đâu (mốc năm 10) và kiểm mọi lệnh hợp lệ.
 *
 * Chơi: bật Tự bắn một lần; ưu tiên lính / tháp (chơi hoặc nâng cấp), rồi kinh tế / hỗ trợ, rồi bùa / sách,
 * mỗi nhóm theo handIndex rồi ô; hết nước đi thì bán lá đầu tay, tay trống thì ra trận.
 */
import { QUESTS } from '../../../data/quests';
import type { CardDef } from '../../../data/types';
import type { Content } from '../../cards/registry';
import { adjacentToUnlocked, checkPlay, targetCount, unlockPlot } from '../../run/board';
import { decree } from '../../run/decrees';
import { cardOffer } from '../../run/flow';
import type { CouncilSelection, PlayTarget, RunCommand, RunState } from '../../run/state';
import type { Bot } from './random';

const PLOTS = 25;

/** Nhóm ưu tiên của một thẻ: 0 lính / tháp, 1 kinh tế / hỗ trợ, 2 bùa / sách. */
const priority = (card: CardDef): 0 | 1 | 2 =>
  card.kind === 'troop' || card.kind === 'tower' ? 0 : card.kind === 'economy' || card.kind === 'support' ? 1 : 2;

/** Đích hợp lệ đầu tiên (ô tăng dần; thẻ hai ô theo cặp tăng dần), hoặc null. */
const firstTarget = (state: RunState, card: CardDef, content: Content): PlayTarget | null => {
  const count = targetCount(card);
  if (count === 0) return checkPlay(state.plots, card, { kind: 'none' }, content) === null ? { kind: 'none' } : null;
  if (count === 1) {
    for (let plot = 0; plot < PLOTS; plot++) {
      const target: PlayTarget = { kind: 'plot', plot };
      if (checkPlay(state.plots, card, target, content) === null) return target;
    }
    return null;
  }
  for (let first = 0; first < PLOTS; first++) {
    for (let second = 0; second < PLOTS; second++) {
      const target: PlayTarget = { kind: 'two', first, second };
      if (checkPlay(state.plots, card, target, content) === null) return target;
    }
  }
  return null;
};

const planning = (state: RunState, content: Content): RunCommand => {
  if (!state.autoFire) return { type: 'setAutoFire', on: true };
  if (state.played) return { type: 'startBattle' };
  let best: { handIndex: number; target: PlayTarget; group: number } | null = null;
  state.hand.forEach((cardId, handIndex) => {
    const card = content.card(cardId);
    const group = priority(card);
    if (best !== null && group >= best.group) return; // chỉ nhóm tốt hơn mới thay (hoà giữ handIndex nhỏ)
    const target = firstTarget(state, card, content);
    if (target !== null) best = { handIndex, target, group };
  });
  if (best !== null) {
    const { handIndex, target } = best as { handIndex: number; target: PlayTarget };
    return { type: 'play', handIndex, target };
  }
  return state.hand.length > 0 ? { type: 'discard', handIndex: 0 } : { type: 'startBattle' };
};

const PREFERRED_DECREES = ['decree_mobilize', 'decree_royal_armory'] as const;

const council = (state: RunState, content: Content): RunCommand => {
  const offer = state.offers;
  if (offer?.kind !== 'council') throw new Error('scriptedBot: no council offer');
  if (offer.selected === null) {
    const preferred = PREFERRED_DECREES.map((id) => offer.decreeIds.indexOf(id)).find((i) => i >= 0);
    return { type: 'chooseDecree', index: preferred ?? 0 };
  }
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
    const rares = content
      .king(state.kingId)
      .cards.filter((c) => c.rarity === 'rare')
      .map((c) => c.id)
      .sort();
    want.cardId = rares[0] ?? null;
  }
  // Thanh Lọc: không loại lá nào (an toàn, vẫn hợp lệ).
  if (JSON.stringify(want) !== JSON.stringify(offer.selection)) return { type: 'setCouncilSelection', selection: want };
  return { type: 'enactDecree' };
};

export const scriptedBot: Bot = (state, content) => {
  switch (state.phase) {
    case 'planning':
      return planning(state, content);
    case 'quest': {
      const offer = state.offers;
      const fee = offer?.kind === 'quest' ? QUESTS.find((q) => q.id === offer.questId)!.acceptGold : 0;
      return { type: 'answerQuest', accept: state.gold >= fee };
    }
    case 'council':
      return council(state, content);
    case 'reward':
    case 'conquest': {
      const count = cardOffer(state)?.cardIds.length ?? 0;
      return { type: 'pickOffer', index: count === 0 ? (state.phase === 'reward' && cardOffer(state)?.kind === 'reward' ? null : 0) : 0 };
    }
    case 'yearEnd':
      return { type: 'advance' };
    default:
      throw new Error(`scriptedBot: no command in phase ${state.phase}`);
  }
};
