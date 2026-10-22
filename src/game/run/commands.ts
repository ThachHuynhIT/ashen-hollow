/** Lệnh người chơi lên RunState (spec §5.1, §5.5). Thuần: làm việc trên bản sao, không sửa đầu vào. */
import { Rng } from '../../core/random';
import { RUN, START_DECK_G1, battleGold, rerollCost, unlockCost } from '../../data/run';
import type { CardDef, CardId, KingId } from '../../data/types';
import { CUSTOM_TOME_HANDLERS } from '../cards/custom';
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
import { refillHand } from './deck';
import { hasPlayableCard } from './playable';
import { rollConquestOffers, rollOffers } from './rewards';
import type { IllegalReason, RunCommand, RunState } from './state';
import { startYear } from './yearFlow';

export type RunEvent =
  | { type: 'cardPlayed'; cardId: CardId }
  | { type: 'yearStarted'; year: number }
  | { type: 'battleEnded'; won: boolean }
  | { type: 'runEnded'; won: boolean };

export type CommandResult = { state: RunState; events: RunEvent[] } | { error: IllegalReason };

const fail = (error: IllegalReason): CommandResult => ({ error });

const manhattan = (a: number, b: number): number =>
  Math.abs(plotCol(a) - plotCol(b)) + Math.abs(plotRow(a) - plotRow(b));

function begin(state: RunState, content: Content, events: RunEvent[]): RunState {
  const next = startYear(state, content);
  events.push({ type: 'yearStarted', year: next.year });
  return next;
}

export function applyCommand(input: RunState, cmd: RunCommand, content: Content): CommandResult {
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
      const cost = rerollCost(state.rerollsThisYear + 1);
      if (state.gold < cost) return fail('notEnoughGold');
      const rng = new Rng(state.rng.draw);
      const piles = refillHand([], state.drawPile, [...state.discardPile, ...state.hand], rng, RUN.handSize);
      state.hand = piles.hand;
      state.drawPile = piles.drawPile;
      state.discardPile = piles.discardPile;
      state.gold -= cost;
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
      state.stats.kills += result.kills;
      events.push({ type: 'battleEnded', won: result.won });
      if (result.won) {
        state.stats.battlesWon += 1;
        const prize = battleGold(state.year);
        state.gold += prize;
        state.stats.goldEarned += prize;
      }
      else {
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

      const finalYear = state.year >= state.rules.years;
      if (state.lives <= 0 || finalYear) {
        // §3.10: sau trận năm cuối, còn mạng thì thắng ván (thắng hay thua trận đều vậy).
        state.lives = Math.max(state.lives, 0);
        state.phase = 'ended';
        state.won = state.lives > 0;
        state.offers = null;
        events.push({ type: 'runEnded', won: state.won });
      } else if (result.won) {
        const rng = new Rng(state.rng.reward);
        // G1 (lịch toàn Thổ Phỉ) chỉ thưởng các thẻ G1: giao diện G1 chưa chơi được thẻ G2.
        const g1 = state.rules.calendar === 'raiders';
        const only = (cards: readonly CardDef[]): readonly CardDef[] =>
          g1 ? cards.filter((c) => START_DECK_G1.includes(c.id)) : cards;
        const cardIds = rollOffers(rng, state.year, {
          king: only(content.king(state.kingId).cards),
          neutral: only(content.neutralPool()),
        });
        state.rng.reward = rng.getState();
        state.offers = { kind: 'reward', cardIds };
        state.pendingConquest = conquered;
        state.phase = 'reward';
      } else {
        state.offers = null;
        state.phase = 'yearEnd';
      }
      return { state, events };
    }

    case 'pickOffer': {
      if ((state.phase !== 'reward' && state.phase !== 'conquest') || state.offers === null) {
        return fail('wrongPhase');
      }
      if (state.offers.kind === 'council' || state.offers.kind === 'quest') return fail('wrongPhase');
      const { index } = cmd;
      const conquest = state.phase === 'conquest';
      if (conquest && index === null) return fail('badTarget'); // bắt buộc chọn một thẻ
      let { deck, drawPile } = state;
      let gold = state.gold;
      let goldEarned = state.stats.goldEarned;
      if (index === null) {
        gold += RUN.skipRewardGold;
        goldEarned += RUN.skipRewardGold;
      } else {
        const picked = Number.isInteger(index) ? state.offers.cardIds[index] : undefined;
        if (picked === undefined) return fail('badTarget');
        deck = [...deck, picked];
        // Lên đầu chồng rút: thẻ vừa chọn có ngay trên tay năm sau (không bị chôn trong chồng bỏ).
        drawPile = [picked, ...drawPile];
      }
      const stats = { ...state.stats, goldEarned };
      const picked = { ...state, deck, drawPile, gold, stats };
      if (!conquest && state.pendingConquest !== null) {
        // Sau thưởng tới chinh phục: ba thẻ của vua bại trận, bắt buộc chọn một.
        const king = content.king(state.pendingConquest);
        const rng = new Rng(state.rng.reward);
        const cardIds = rollConquestOffers(rng, king);
        return {
          state: {
            ...picked,
            phase: 'conquest',
            pendingConquest: null,
            offers: { kind: 'conquest', cardIds, king: king.id },
            rng: { ...state.rng, reward: rng.getState() },
          },
          events,
        };
      }
      return { state: begin({ ...picked, pendingConquest: null }, content, events), events };
    }

    // Hội đồng và nhiệm vụ: luật thật ở G3a-A3/A4; ngoài pha của chúng thì không hợp lệ.
    case 'chooseDecree':
    case 'setCouncilSelection':
    case 'enactDecree':
    case 'answerQuest':
      return fail('wrongPhase');

    case 'advance':
      if (state.phase !== 'yearEnd') return fail('wrongPhase');
      return { state: begin(state, content, events), events };
  }
}
