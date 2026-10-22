/** Lệnh người chơi lên RunState (spec §5.1, §5.5). Thuần: làm việc trên bản sao, không sửa đầu vào. */
import { Rng } from '../../core/random';
import { RUN, START_DECK_G1, battleGold, unlockCost } from '../../data/run';
import type { CardDef, CardId, KingId } from '../../data/types';
import { CUSTOM_TOME_HANDLERS, runAfterMove, runAfterPlay, runBattleEnd } from '../cards/custom';
import type { Content } from '../cards/registry';
import {
  adjacentToUnlocked,
  attachEnchant,
  checkPlay,
  levelUpBuilding,
  moveBuilding,
  placeBuilding,
  plotCol,
  plotRow,
  sacrificeBuilding,
  unlockPlot,
} from './board';
import { enactDecree, rollCouncil, selectDecree, setCouncilSelection } from './council';
import { handLimit, rerollPrice, rewardCount } from './decrees';
import { refillHand } from './deck';
import { cardOffer, enqueueOffers } from './flow';
import { hasPlayableCard } from './playable';
import { answerQuest, recordQuestCommand, settleQuests } from './quests';
import { rollConquestCards, rollOffers } from './rewards';
import type { IllegalReason, RunCommand, RunState } from './state';
import { advanceAfterBattle, finishYear } from './yearEnd';

export type RunEvent =
  | { type: 'cardPlayed'; cardId: CardId }
  | { type: 'yearStarted'; year: number }
  | { type: 'battleEnded'; won: boolean }
  | { type: 'runEnded'; won: boolean };

export type CommandResult = { state: RunState; events: RunEvent[] } | { error: IllegalReason };

const fail = (error: IllegalReason): CommandResult => ({ error });

const manhattan = (a: number, b: number): number =>
  Math.abs(plotCol(a) - plotCol(b)) + Math.abs(plotRow(a) - plotRow(b));

/** Ghi sự kiện năm mới / hết ván do bước vừa rồi gây ra; trả lại `next`. */
function settledEvents(before: RunState, next: RunState, events: RunEvent[]): RunState {
  if (next.year !== before.year) events.push({ type: 'yearStarted', year: next.year });
  if (next.phase === 'ended' && before.phase !== 'ended') events.push({ type: 'runEnded', won: next.won === true });
  return next;
}

/** Lệnh người chơi; lệnh thành công còn ghi tiến độ nhiệm vụ đang chạy (G3). */
export function applyCommand(input: RunState, cmd: RunCommand, content: Content): CommandResult {
  const result = applyBase(input, cmd, content);
  if ('error' in result) return result;
  return { ...result, state: recordQuestCommand(input, result.state, cmd, content) };
}

function applyBase(input: RunState, cmd: RunCommand, content: Content): CommandResult {
  const state = structuredClone(input);
  const events: RunEvent[] = [];

  switch (cmd.type) {
    case 'play': {
      if (state.phase !== 'planning') return fail('wrongPhase');
      if (state.played) return fail('alreadyPlayed');
      const cardId = state.hand[cmd.handIndex];
      if (!Number.isInteger(cmd.handIndex) || cardId === undefined) return fail('badTarget');
      const card = content.card(cardId);
      const illegal = checkPlay(state.plots, card, cmd.target, content);
      if (illegal !== null) return fail(illegal);

      const target = cmd.target;
      if (card.kind === 'tome') {
        for (const action of card.actions) {
          switch (action.type) {
            case 'unlockPlot':
              if (target.kind !== 'plot') return fail('badTarget');
              state.plots = unlockPlot(state.plots, target.plot);
              break;
            case 'levelUp':
              if (target.kind !== 'plot') return fail('badTarget');
              state.plots = levelUpBuilding(state.plots, target.plot, action.amount);
              break;
            case 'move': {
              if (target.kind !== 'two') return fail('badTarget');
              state.plots = moveBuilding(state.plots, target.first, target.second);
              for (const plot of [target.first, target.second]) {
                const moved = state.plots[plot]!.building;
                if (moved !== null) moved.movedYear = state.year; // dời xong thì công trình "vừa dời" năm nay
              }
              Object.assign(state, runAfterMove(state, target.first, target.second, content));
              const far = manhattan(target.first, target.second) >= 2;
              if (far && action.levelIfFar > 0) {
                state.plots = levelUpBuilding(state.plots, target.second, action.levelIfFar);
              }
              break;
            }
            case 'sacrifice': {
              if (target.kind !== 'plot') return fail('badTarget');
              const level = state.plots[target.plot]!.building!.level;
              state.plots = sacrificeBuilding(state.plots, target.plot);
              const prize = action.goldPerLevel * level;
              state.gold += prize;
              state.stats.goldEarned += prize;
              break;
            }
            case 'custom': {
              const handler = CUSTOM_TOME_HANDLERS[action.id];
              if (!handler) return fail('badTarget');
              const out = handler(state, content, action.params ?? {}, target);
              if (typeof out === 'string') return fail(out);
              Object.assign(state, out);
              break;
            }
          }
        }
      } else if (target.kind !== 'plot') {
        return fail('badTarget');
      } else if (card.kind === 'enchantment') {
        state.plots = attachEnchant(state.plots, target.plot, card.id, RUN.maxEnchantStacks);
      } else {
        const here = state.plots[target.plot]!.building;
        if (here === null) {
          state.plots = placeBuilding(state.plots, target.plot, {
            uid: state.nextUid,
            cardId,
            level: 1,
            enchants: [],
            placedYear: state.year,
            ageBonus: 0,
            counters: {},
            movedYear: null,
            permanent: {},
          });
          state.nextUid += 1;
        } else {
          state.plots = levelUpBuilding(state.plots, target.plot, 1);
        }
      }
      state.hand.splice(cmd.handIndex, 1);
      state.discardPile.push(cardId);
      state.played = true;
      Object.assign(state, runAfterPlay(input, state, card, target, content));
      events.push({ type: 'cardPlayed', cardId });
      return { state, events };
    }

    case 'discard': {
      if (state.phase !== 'planning') return fail('wrongPhase');
      if (state.played) return fail('alreadyPlayed');
      const { handIndex } = cmd;
      const sold = Number.isInteger(handIndex) ? state.hand[handIndex] : undefined;
      if (sold === undefined) return fail('badTarget');
      state.hand.splice(handIndex, 1);
      state.discardPile.push(sold);
      state.played = true;
      state.gold += RUN.skipPlayGold;
      state.stats.goldEarned += RUN.skipPlayGold;
      return { state, events };
    }

    case 'reroll': {
      if (state.phase !== 'planning') return fail('wrongPhase');
      if (state.played) return fail('alreadyPlayed');
      const cost = rerollPrice(state);
      if (state.gold < cost) return fail('notEnoughGold');
      const rng = new Rng(state.rng.draw);
      const piles = refillHand([], state.drawPile, [...state.discardPile, ...state.hand], rng, handLimit(state));
      state.hand = piles.hand;
      state.drawPile = piles.drawPile;
      state.discardPile = piles.discardPile;
      state.gold -= cost;
      if (state.freeRerollsLeft > 0) state.freeRerollsLeft -= 1;
      else state.paidRerollsThisYear += 1;
      state.rerollsThisYear += 1;
      state.rng.draw = rng.getState();
      return { state, events };
    }

    case 'unlockPlot': {
      if (state.phase !== 'planning') return fail('wrongPhase');
      const { plot } = cmd;
      if (!Number.isInteger(plot) || plot < 0 || plot >= state.plots.length) return fail('badTarget');
      if (state.plots[plot]!.unlocked) return fail('badTarget');
      if (!adjacentToUnlocked(state.plots, plot)) return fail('notAdjacent');
      const cost = unlockCost(state.purchasedPlots);
      if (state.gold < cost) return fail('notEnoughGold');
      state.plots = unlockPlot(state.plots, plot);
      state.gold -= cost;
      state.purchasedPlots += 1;
      return { state, events };
    }

    case 'setAutoFire':
      if (state.phase === 'ended') return fail('wrongPhase');
      state.autoFire = cmd.on;
      return { state, events };

    case 'startBattle':
      if (state.phase !== 'planning') return fail('wrongPhase');
      if (!state.played && hasPlayableCard(state, content)) return fail('notPlayed');
      state.phase = 'battle';
      return { state, events };

    case 'battleResult': {
      if (state.phase !== 'battle') return fail('wrongPhase');
      const { result } = cmd;
      const full = state.rules.calendar === 'full';
      state.stats.kills += result.kills;
      state.stats.completedYears += 1;
      events.push({ type: 'battleEnded', won: result.won });
      // Vàng trong trận trước, rồi vàng thắng trận (§5.5 bước 9); vàng không âm.
      state.gold = Math.max(0, state.gold + (result.goldDelta ?? 0));
      if (result.won) {
        state.stats.battlesWon += 1;
        const prize = battleGold(state.year);
        state.gold += prize;
        state.stats.goldEarned += prize;
      } else {
        state.stats.battlesLost += 1;
        state.lives -= 1;
      }

      // Chinh phục (spec §3.7): lần tấn công thứ 3 của một vua — thắng thì bị chinh phục, thua thì rút lui.
      let conquered: KingId | null = null;
      const attacker = state.army?.attacker;
      const enemy = attacker && attacker !== 'raiders' ? state.enemies[attacker] : undefined;
      if (attacker && attacker !== 'raiders' && enemy) {
        enemy.attacks += 1;
        if (enemy.attacks >= 3 && enemy.status === 'pending') {
          if (result.won) {
            enemy.status = 'conquered';
            conquered = attacker;
            state.gold += RUN.conquestGold;
            state.stats.goldEarned += RUN.conquestGold;
            state.stats.conquered += 1;
          } else {
            enemy.status = 'fled';
          }
        }
      }

      // Nhiệm vụ (theo thứ tự nhận); thưởng chọn thẻ đã nằm trong hàng đợi.
      let s = settleQuests(runBattleEnd(state, result, content), result, 'afterBattle', content);
      const finalYear = s.year >= s.rules.years;
      if (s.lives <= 0 || (finalYear && !full)) {
        // §3.10: hết mạng thì thua ngay; sau trận năm cuối còn mạng thì thắng ván (luật G1/G2: không thưởng).
        s.lives = Math.max(s.lives, 0);
        s = { ...s, phase: 'ended', won: s.lives > 0, offers: null, pendingOffers: [], pendingConquest: null };
        events.push({ type: 'runEnded', won: s.won === true });
        return { state: s, events };
      }
      if (result.won && !finalYear) {
        const rng = new Rng(s.rng.reward);
        // G1 (lịch toàn Thổ Phỉ) chỉ thưởng các thẻ G1: giao diện G1 chưa chơi được thẻ G2.
        const g1 = s.rules.calendar === 'raiders';
        const only = (cards: readonly CardDef[]): readonly CardDef[] =>
          g1 ? cards.filter((c) => START_DECK_G1.includes(c.id)) : cards;
        const cardIds = rollOffers(
          rng,
          s.year,
          { king: only(content.king(s.kingId).cards), neutral: only(content.neutralPool()) },
          rewardCount(s),
        );
        s.rng.reward = rng.getState();
        s = enqueueOffers({ ...s, pendingConquest: conquered }, [{ kind: 'reward', cardIds }]);
      }
      // Hội đồng sau thắng hay thua (chỉ ván đầy đủ, còn mạng, không phải năm cuối).
      if (full && !finalYear && (RUN.councilYears as readonly number[]).includes(s.year)) s = rollCouncil(s);
      if (s.offers === null) {
        // Không còn bước nào: năm cuối kết thúc ván ngay, còn lại nghỉ ở yearEnd chờ `advance`.
        s = finalYear ? finishYear(s, content) : { ...s, phase: 'yearEnd' };
      }
      return { state: settledEvents(input, s, events), events };
    }

    case 'pickOffer': {
      if ((state.phase !== 'reward' && state.phase !== 'conquest') || state.offers === null) {
        return fail('wrongPhase');
      }
      const offer = cardOffer(state);
      if (offer === null) return fail('wrongPhase');
      const { index } = cmd;
      // Chỉ thưởng thường được bỏ qua; chinh phục và thưởng nhiệm vụ bắt buộc chọn một thẻ.
      if (offer.kind !== 'reward' && index === null) return fail('badTarget');
      let { deck, drawPile } = state;
      let gold = state.gold;
      let goldEarned = state.stats.goldEarned;
      if (index === null) {
        gold += RUN.skipRewardGold;
        goldEarned += RUN.skipRewardGold;
      } else {
        const picked = Number.isInteger(index) ? offer.cardIds[index] : undefined;
        if (picked === undefined) return fail('badTarget');
        deck = [...deck, picked];
        // Lên đầu chồng rút: thẻ vừa chọn có ngay trên tay năm sau (không bị chôn trong chồng bỏ).
        drawPile = [picked, ...drawPile];
      }
      let next: RunState = {
        ...state,
        deck,
        drawPile,
        gold,
        stats: { ...state.stats, goldEarned },
        offers: null,
      };
      if (offer.kind === 'reward' && state.pendingConquest !== null) {
        // Sau thưởng tới chinh phục: ba thẻ của vua bại trận, bắt buộc chọn một; đứng trước các bước còn lại.
        const king = content.enemyKing(state.pendingConquest);
        const rng = new Rng(state.rng.reward);
        const cardIds = rollConquestCards(rng, content.conquestCards(king.id));
        next = {
          ...next,
          pendingConquest: null,
          pendingOffers: [{ kind: 'conquest', cardIds, king: king.id }, ...next.pendingOffers],
          rng: { ...state.rng, reward: rng.getState() },
        };
      }
      return { state: settledEvents(input, advanceAfterBattle(next, content), events), events };
    }

    case 'chooseDecree':
    case 'setCouncilSelection':
    case 'enactDecree': {
      const r =
        cmd.type === 'chooseDecree'
          ? selectDecree(state, cmd.index)
          : cmd.type === 'setCouncilSelection'
            ? setCouncilSelection(state, cmd.selection, content)
            : enactDecree(state, content);
      return typeof r === 'string' ? fail(r) : { state: r, events };
    }

    case 'answerQuest': {
      const r = answerQuest(state, cmd.accept, content);
      return typeof r === 'string' ? fail(r) : { state: r, events };
    }

    case 'advance':
      if (state.phase !== 'yearEnd') return fail('wrongPhase');
      return { state: settledEvents(input, finishYear(state, content), events), events };
  }
}
